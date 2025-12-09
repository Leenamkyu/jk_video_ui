import React, { createContext, useContext, useState } from "react";
import { getVideoKey } from "../utils/getVideoKey";

const SharedVideoContext = createContext();

export const SharedVideoProvider = ({ children }) => {
  const [sharedVideoUrl, setSharedVideoUrl] = useState("");
  const [analyzeCache, setAnalyzeCache] = useState({});
  const [ragCache, setRagCache] = useState({});
  const [highlightResults, setHighlightResults] = useState({});
  const [analyzeStatus, setAnalyzeStatus] = useState(null);
  const [videoMeta, setVideoMeta] = useState(null);

  const [highlightStatus, setHighlightStatus] = useState("idle");
  const [ragStatus, setRagStatus] = useState("idle");
  const [ragReady, setRagReady] = useState(false);

  const [refreshFlag, setRefreshFlag] = useState(0);
  const refreshVideoList = () => setRefreshFlag((prev) => prev + 1);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const TTL_MS = 1000 * 60 * 60 * 12; // 12시간

  const buildCacheKey = (url) => getVideoKey(url);

  // 영상 선택
  const selectVideo = (url, meta = null) => {
    setSharedVideoUrl(url);
    setAnalyzeStatus(null);
    setHighlightStatus("idle");
    setRagStatus("idle");
    setRagReady(false);
    setVideoMeta(meta);

    // 🔥 meta 안에 분석 정보가 이미 들어있는 경우 → analyzeCache에 바로 반영
    if (meta) {
      const {
        duration_sec,
        duration,
        focus,
        segments,
        full_text,       // 혹시 나중에 백엔드에서 넣어줄 수도 있으니 같이 꺼내놓기
      } = meta;

      // full_text가 없으면 segments의 text를 이어 붙여서 대략 복원
      let mergedText = full_text || "";
      if (!mergedText && Array.isArray(segments)) {
        try {
          mergedText = segments
            .map((s) => s.text || s.segment || "")
            .filter(Boolean)
            .join(" ");
        } catch (e) {
          console.warn("full_text 생성 중 오류(무시 가능):", e);
        }
      }

      setAnalyzeCache((prev) => ({
        ...prev,
        [url]: {
          ...(prev[url] || {}),

          // /analyze와 맞추기 위해 사용하는 필드들
          original_duration_sec: duration_sec || prev[url]?.original_duration_sec,
          segments: Array.isArray(segments) ? segments : prev[url]?.segments || [],
          full_text: mergedText || prev[url]?.full_text || "",

          // 추천 초점/길이도 같이 세팅
          recommended_focus: Array.isArray(focus) ? focus : prev[url]?.recommended_focus || [],
          recommended_duration: Array.isArray(duration) ? duration : prev[url]?.recommended_duration || [],
        },
      }));

      console.log("✅ selectVideo → analyzeCache 복원:", url, meta);
    }
  };

  // AI 분석 결과
  const saveAnalyzeResult = (url, data) => {
    setAnalyzeCache((prev) => ({ ...prev, [url]: data }));
    setAnalyzeStatus("done");
  };

  // 하이라이트 저장
  const saveHighlightResult = (url, result) =>
    setHighlightResults((prev) => ({ ...prev, [url]: result }));

  const getHighlightResult = (url) => highlightResults[url] || null;

  // RAG 저장
  const saveRagSession = (url, session) => {
    const key = buildCacheKey(url);
    setRagCache((prev) => ({ ...prev, [key]: session }));

    try {
      localStorage.setItem(
        key,
        JSON.stringify({ timestamp: Date.now(), messages: session })
      );
    } catch (e) {
      console.warn("⚠️ 로컬 캐시 저장 실패:", e);
    }
  };

  const getRagSession = (url) => {
    const key = buildCacheKey(url);
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.timestamp > TTL_MS) {
        localStorage.removeItem(key);
        return [];
      }
      return parsed.messages || [];
    } catch {
      return [];
    }
  };

  // 전체 데이터 삭제
  const clearVideoData = (url) => {
    const key = buildCacheKey(url);
    localStorage.removeItem(key);

    setAnalyzeCache((prev) => ({ ...prev, [url]: undefined }));
    setHighlightResults((prev) => ({ ...prev, [url]: undefined }));
    setRagCache((prev) => ({ ...prev, [key]: undefined }));

    if (sharedVideoUrl === url) {
      setSharedVideoUrl("");
      setVideoMeta(null);
      setAnalyzeStatus(null);
      setHighlightStatus("idle");
      setRagStatus("idle");
      setRagReady(false);
    }

    console.log("🧹 영상 관련 상태 + 캐시 삭제 완료:", key);
  };

  // ✅ 선택된 영상에 대해 /analyze 다시 호출
  const runAnalyze = async (videoUrl) => {
    if (!videoUrl) return null;

    try {
      setAnalyzeStatus("running");

      const formData = new FormData();
      formData.append("url", videoUrl);

      const res = await fetch(`${API_BASE_URL}/analyze`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      console.log("🔍 /analyze 결과:", data);

      // 캐시에 저장
      setAnalyzeCache((prev) => ({
        ...prev,
        [videoUrl]: data,
      }));

      setAnalyzeStatus("done");
      return data;
    } catch (e) {
      console.error("❌ /analyze 오류:", e);
      setAnalyzeStatus("error");
      return null;
    }
  };

  const fetchAnalyzeFromServer = async (videoKey, videoUrl) => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/analyze_result?video_key=${encodeURIComponent(videoKey)}`
      );
      const data = await res.json();

      if (!data.found) {
        console.log("📭 analyze_result 없음, 서버에서 STT 자급자족 모드로 동작");
        return;
      }

      setAnalyzeCache((prev) => ({
        ...prev,
        [videoUrl]: {
          ...(prev[videoUrl] || {}),
          original_duration_sec: data.original_duration_sec,
          segments: data.segments || [],
          full_text: data.full_text || "",
          recommended_focus: data.recommended_focus || [],
          recommended_duration: data.recommended_duration || [],
        },
      }));

      console.log("✅ analyzeCache 복구 완료:", videoUrl);
    } catch (e) {
      console.error("❌ fetchAnalyzeFromServer 오류:", e);
    }
  };

  // ============================================================
  // 🔥 하이라이트 여러 개 생성하는 runHighlight 로 변경
  // ============================================================
  const runHighlight = async (focus, duration, highlightCount, segments, fullText, highlightMode, totalDuration) => {
    setHighlightStatus("running");

    const fd = new FormData();
    fd.append("focus", focus);
    fd.append("duration", duration);
    fd.append("highlight_count", highlightCount);
    fd.append("url", sharedVideoUrl);
    fd.append("total_duration", totalDuration);
    fd.append("segments_json", JSON.stringify(segments || []));
    fd.append("full_text", fullText || "");

    const endpoint =
      highlightMode === "voice"
        ? `http://127.0.0.1:8000/highlight_voice`
        : `${API_BASE_URL}/highlight`;

    const resp = await fetch(endpoint, {
      method: "POST",
      body: fd,
    });

    const data = await resp.json();
    saveHighlightResult(sharedVideoUrl, data);
    setHighlightStatus("done");
    return data;
  };

  // RAG 분석
  const runRagSetup = async () => {
    if (!sharedVideoUrl) return alert("⚠️ 영상을 먼저 업로드해주세요!");
    try {
      setRagStatus("running");
      const fd = new FormData();
      fd.append("url", sharedVideoUrl);

      const resp = await fetch(`${API_BASE_URL}/rag/setup`, {
        method: "POST",
        body: fd,
      });

      if (resp.ok) {
        setRagReady(true);
        setRagStatus("done");
      } else {
        setRagStatus("idle");
      }
    } catch (err) {
      console.error("❌ RAG 분석 실패:", err);
      setRagStatus("idle");
    }
  };

  return (
    <SharedVideoContext.Provider
      value={{
        sharedVideoUrl,
        setSharedVideoUrl,
        selectVideo,
        analyzeCache,
        saveAnalyzeResult,
        ragCache,
        saveRagSession,
        getRagSession,
        highlightResults,
        saveHighlightResult,
        getHighlightResult,
        analyzeStatus,
        setAnalyzeStatus,
        videoMeta,
        highlightStatus,
        runHighlight,        // 🔥 multiple highlight 지원 버전
        ragStatus,
        ragReady,
        setRagReady,
        runRagSetup,
        clearVideoData,
        refreshFlag,
        refreshVideoList,
        runAnalyze,
        analyzeStatus,
        fetchAnalyzeFromServer
      }}
    >
      {children}
    </SharedVideoContext.Provider>
  );
};

export const useSharedVideo = () => useContext(SharedVideoContext);