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

  // ============================================================
  // 🔥 하이라이트 여러 개 생성하는 runHighlight 로 변경
  // ============================================================
  const runHighlight = async (focus, duration, highlightCount, segments, fullText) => {
    setHighlightStatus("running");

    const fd = new FormData();
    fd.append("focus", focus);
    fd.append("duration", duration);
    fd.append("highlight_count", highlightCount);
    fd.append("url", sharedVideoUrl);

    fd.append("segments_json", JSON.stringify(segments || []));
    fd.append("full_text", fullText || "");

    const resp = await fetch(`${API_BASE_URL}/highlight`, {
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
        refreshVideoList
      }}
    >
      {children}
    </SharedVideoContext.Provider>
  );
};

export const useSharedVideo = () => useContext(SharedVideoContext);
