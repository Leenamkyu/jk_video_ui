import React, { useState, useEffect } from "react";
import HighlightPreviewModal from "./HighlightPreviewModal";
import { useSharedVideo } from "../context/SharedVideoContext";
import ExportVodModal from "./ExportVodModal";
import Toast from "./Toast";

function HighlightTab() {
  const {
    sharedVideoUrl,
    analyzeCache,
    getHighlightResult,
    saveHighlightResult,
    highlightStatus,
    runHighlight,
    videoMeta,
    runAnalyze,
    analyzeStatus,
  } = useSharedVideo();

  const [focus, setFocus] = useState("");
  const [recommendedFocusList, setRecommendedFocusList] = useState([]);
  const [duration, setDuration] = useState("30");
  const [recommendedDurations, setRecommendedDurations] = useState([]);

  // 하이라이트 개수
  const [highlightCount, setHighlightCount] = useState(1);

  // 분석 방식: 텍스트 / 음성 가중치
  const [highlightMode, setHighlightMode] = useState("text"); // "text" | "voice"

  // 결과
  const [results, setResults] = useState([]);

  // 미리보기 모달
  const [showPreview, setShowPreview] = useState(false);
  const [previewVideoUrl, setPreviewVideoUrl] = useState(null);
  const [previewTitle, setPreviewTitle] = useState("하이라이트 미리보기");
  const [selectedThumbnail, setSelectedThumbnail] = useState(null);

  // 내보내기 모달
  const [exportOpen, setExportOpen] = useState(false);
  const [exportVideoUrl, setExportVideoUrl] = useState(null);
  const [exportThumbnailUrl, setExportThumbnailUrl] = useState(null);

  // ✅ 어떤 하이라이트를 선택했는지 기억
  const [selectedResult, setSelectedResult] = useState(null);
  // ✅ AI 추천 제목
  const [suggestedTitle, setSuggestedTitle] = useState("");

  const [originalDuration, setOriginalDuration] = useState(null);
  const [toast, setToast] = useState(null);
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

  useEffect(() => {
    console.log("🎯 videoMeta in HighlightTab:", videoMeta);
  }, [videoMeta]);

  // =============================
  // /analyze 결과 반영
  // =============================
  useEffect(() => {
    if (!sharedVideoUrl) return;
    const data = analyzeCache?.[sharedVideoUrl];
    if (!data) return;

    if (data.original_duration_sec)
      setOriginalDuration(data.original_duration_sec);

    if (data.recommended_focus?.length) {
      const cleaned = data.recommended_focus.map((x) => x.trim());
      setRecommendedFocusList(cleaned);
      setFocus(cleaned[0] || "");
    }

    if (data.recommended_duration?.length) {
      const durations = [...data.recommended_duration]
        .sort((a, b) => a - b)
        .map(String);
      setRecommendedDurations(durations);
      setDuration(String(durations[0]));
    }
  }, [sharedVideoUrl, analyzeCache]);

  // 영상 바뀌면 결과 초기화
  useEffect(() => {
    setResults([]);
    setSelectedResult(null);
  }, [sharedVideoUrl]);

  // 기존 highlight 결과 복원
  useEffect(() => {
    if (!sharedVideoUrl) return;
    const prev = getHighlightResult(sharedVideoUrl);
    if (prev?.results) setResults(prev.results);
  }, [sharedVideoUrl, getHighlightResult]);

  // list_videos 반영
  useEffect(() => {
    if (!videoMeta) return;

    if (Array.isArray(videoMeta.focus)) {
      setRecommendedFocusList(videoMeta.focus);
      setFocus((prev) => prev || videoMeta.focus[0]);
    }

    if (Array.isArray(videoMeta.duration)) {
      const sorted = [...videoMeta.duration].sort((a, b) => a - b);
      setRecommendedDurations(sorted.map(String));
      setDuration(String(sorted[0]));
    }

    if (videoMeta.duration_sec) setOriginalDuration(videoMeta.duration_sec);
  }, [videoMeta]);

  const handleReAnalyze = async () => {
    if (!sharedVideoUrl) {
      alert("분석할 영상을 먼저 선택해주세요!");
      return;
    }

    const data = await runAnalyze(sharedVideoUrl);

    if (!data) {
      alert("영상 분석에 실패했습니다 😢");
      return;
    }

    if (data.original_duration_sec) {
      setOriginalDuration(data.original_duration_sec);
    }

    if (data.recommended_focus?.length) {
      const cleaned = data.recommended_focus.map((x) => x.trim());
      setRecommendedFocusList(cleaned);
      setFocus(cleaned[0] || "");
    }

    if (data.recommended_duration?.length) {
      const durations = [...data.recommended_duration]
        .sort((a, b) => a - b)
        .map(String);
      setRecommendedDurations(durations);
      setDuration(String(durations[0]));
    }
  };

  // =============================
  // 하이라이트 생성
  // =============================
  const handleSubmit = async () => {
    const finalFocus = focus || recommendedFocusList[0];
    if (!finalFocus) return alert("하이라이트 초점을 선택해주세요!");

    const durationSec = parseInt(duration, 10);
    if (Number.isNaN(durationSec) || durationSec <= 0) {
      alert("유효한 하이라이트 길이를 초 단위로 입력해주세요!");
      return;
    }

    const analyze = analyzeCache?.[sharedVideoUrl] || {};
    const segments = analyze.segments || [];
    const fullText = analyze.full_text || "";
    const totalDuration = String(
      analyzeCache?.duration_sec || originalDuration || 0
    );

    const newResult = await runHighlight(
      finalFocus,
      String(durationSec),
      highlightCount,
      segments,
      fullText,
      highlightMode,
      totalDuration
    );

    if (newResult?.results) {
      setResults(newResult.results);
      saveHighlightResult(sharedVideoUrl, newResult);
    }
  };

  // 완료 상태 감지
  useEffect(() => {
    if (highlightStatus === "done" && sharedVideoUrl) {
      const newResult = getHighlightResult(sharedVideoUrl);
      if (newResult?.results) setResults(newResult.results);
    }
  }, [highlightStatus, sharedVideoUrl, getHighlightResult]);

  const formatDuration = (sec) => {
    if (!sec) return "00:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  // 내보내기 버튼 → ExportVodModal 열기
  const handleExport = async (videoUrl, thumbnailUrl) => {
    setExportVideoUrl(videoUrl);
    setExportThumbnailUrl(thumbnailUrl);

    // ✅ AI(reason) 기반 제목 추천
    let title = "";
    if (selectedResult?.reason) {
      // 예: "골 장면과 리액션이 함께 나오는 구간"
      title = selectedResult.reason.trim();
    } else if (selectedResult?.index != null) {
      title = `하이라이트 #${selectedResult.index}`;
    } else {
      title = "AI 하이라이트";
    }

    // 백엔드에 reason 기준 제목 요청
    try {
      const payload = {
        reason: selectedResult?.reason || "",
        focus,
        mode: highlightMode,
        index: selectedResult?.index,
        duration: selectedResult?.duration,
      };

      const res = await fetch(`${API_BASE_URL}/highlight_title`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`status ${res.status}`);
      }

      const data = await res.json();
      const titleFromAI = (data.title || "").trim();

      setSuggestedTitle(titleFromAI || title);
    } catch (e) {
      console.error("❌ 제목 추천 API 오류:", e);
      setSuggestedTitle(title);
    }

    setExportOpen(true);
  };

  // ExportVodModal → 제출 완료
  const handleExportSubmit = async (title, url, thumbnailUrl, time) => {
    console.log("🔥 내보낼 제목:", title);
    console.log("🔥 내보낼 URL:", url);
    console.log("🔥 내보낼 썸네일URL:", thumbnailUrl);
    console.log("🔥 내보낼 길이:", time);

    try {
      const query = new URLSearchParams({
        videoTitle: title,
        videoUrl: url,
        thumbnailUrl: thumbnailUrl,
        videoTime: String(time),
      });

      const response = await fetch(
        `https://hdev.hmall.com/api/hf/ev/v1/evnt-redis/insert?${query.toString()}`,
        { method: "GET" }
      );

      if (!response.ok) {
        throw new Error("Export failed");
      }

      setToast({ type: "success", message: "내보내기 완료!" });
    } catch (error) {
      console.error("❌ 내보내기 오류:", error);
      setToast({ type: "error", message: "내보내기 실패 😢" });
    } finally {
      setExportOpen(false);
      setTimeout(() => setToast(null), 2000);
    }
  };

  return (
    <div className="space-y-8">
      {/* 제목 + 재분석 버튼 */}
      <div className="flex items-center flex-nowrap w-full">
        <div className="w-1/3 min-w-[120px]" />
        <h2 className="text-3xl font-extrabold text-purple-700 text-center w-1/3 whitespace-nowrap">
          ✂️ AI 하이라이트 생성기
        </h2>
        <div className="w-1/3 min-w-[180px] flex justify-end">
          <button
            type="button"
            onClick={handleReAnalyze}
            disabled={!sharedVideoUrl || analyzeStatus === "running"}
            className={`px-4 py-2 text-sm rounded-xl border font-semibold transition whitespace-nowrap
              ${
                !sharedVideoUrl
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : analyzeStatus === "running"
                  ? "bg-gray-400 text-white cursor-wait"
                  : "bg-white text-purple-700 border-purple-400 hover:bg-purple-50"
              }`}
          >
            {analyzeStatus === "running" ? "분석 중..." : "🔍 영상 다시 분석하기"}
          </button>
        </div>
      </div>

      {/* 설정 */}
      <div className="flex flex-col space-y-2">
        <label className="font-semibold text-gray-700">하이라이트 설정</label>

        {/* 초점 + 개수 */}
        <div className="flex gap-4">
          <select
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            className="flex-1 p-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-purple-400 shadow-sm"
          >
            {recommendedFocusList.map((f, i) => (
              <option key={i}>{f}</option>
            ))}
          </select>

          <select
            value={highlightCount}
            onChange={(e) => setHighlightCount(Number(e.target.value))}
            className="w-32 p-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-purple-400 shadow-sm text-center"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}개
              </option>
            ))}
          </select>
        </div>

        {/* 분석 방식 선택 */}
        <div className="flex gap-4 mt-2">
          <select
            value={highlightMode}
            onChange={(e) => setHighlightMode(e.target.value)}
            className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-purple-400 shadow-sm"
          >
            <option value="text">🧠 키워드/내용 중심 (기본)</option>
            <option value="voice">🎤 키워드 + 음성 강조 (실험)</option>
          </select>
        </div>
      </div>

      {/* 길이 */}
      <div className="flex flex-col space-y-2">
        <div className="flex justify-between items-center">
          <label className="font-semibold text-gray-700">
            하이라이트 길이
          </label>
          {originalDuration && (
            <span className="text-sm text-gray-500">
              전체 {formatDuration(originalDuration)}
            </span>
          )}
        </div>

        {/* 추천 길이 + 직접 입력 한 줄 */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* 왼쪽: 추천 길이 버튼들 */}
          <div className="flex flex-wrap gap-3">
            {recommendedDurations.map((d) => (
              <label
                key={d}
                className={`px-4 py-2 rounded-xl border cursor-pointer ${
                  duration === d
                    ? "bg-purple-600 text-white border-purple-600"
                    : "bg-white border-gray-300 hover:bg-purple-100"
                }`}
              >
                <input
                  type="radio"
                  name="duration"
                  value={d}
                  checked={duration === d}
                  onChange={() => setDuration(d)}
                  className="hidden"
                />
                {d}초
              </label>
            ))}
          </div>

          {/* 오른쪽: 직접 입력 */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm text-gray-500 whitespace-nowrap">
              직접 입력
            </span>
            <input
              type="number"
              min={1}
              max={originalDuration ? Math.floor(originalDuration) : undefined}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-24 p-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-purple-400 shadow-sm text-right"
              placeholder="초"
            />
            <span className="text-sm text-gray-500">초</span>
          </div>
        </div>
      </div>

      {/* 생성 버튼 */}
      <button
        onClick={handleSubmit}
        disabled={highlightStatus === "running"}
        className={`w-full py-3 rounded-2xl font-bold text-white text-lg transition ${
          highlightStatus === "running"
            ? "bg-gray-400 cursor-wait"
            : "bg-purple-600 hover:bg-purple-700"
        }`}
      >
        {highlightStatus === "running" ? "생성 중..." : "하이라이트 생성"}
      </button>

      {/* 생성된 결과 */}
      {results.length > 0 && (
        <div className="mt-6 space-y-4">
          <h3 className="text-xl font-bold text-purple-700">
            🎬 생성된 하이라이트
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.map((item, idx) => (
              <div
                key={idx}
                onClick={() => {
                  setPreviewVideoUrl(item.highlight_url);
                  setPreviewTitle(`#${idx + 1} 하이라이트`);
                  setSelectedThumbnail(item.thumbnail_url);
                  setShowPreview(true);
                  setSelectedResult(item); // ✅ 어떤 하이라이트인지 저장
                }}
                className="border p-4 rounded-xl shadow hover:shadow-lg cursor-pointer transition"
              >
                <h4 className="font-semibold text-gray-700 flex justify-between">
                  #{idx + 1} 하이라이트
                  <span className="text-sm text-gray-500">
                    {Math.round(item.duration)}초
                  </span>
                </h4>

                <video
                  src={item.highlight_url}
                  className="mt-2 rounded transition-all duration-200 hover:scale-[1.02]"
                  muted
                  preload="metadata"
                  onMouseEnter={(e) => e?.target?.play()}
                  onMouseLeave={(e) => {
                    e.target.pause();
                    e.target.currentTime = 0;
                  }}
                />

                {item?.final_score != null && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-600 border">
                    <div className="flex justify-between">
                      <span>🧠 내용 점수:</span>
                      <span className="font-medium">
                        {item.text_score?.toFixed(3)}
                      </span>
                    </div>

                    <div className="flex justify-between mt-1">
                      <span>🎤 음성 강조 점수:</span>
                      <span className="font-medium">
                        {item.voice_score?.toFixed(3)}
                      </span>
                    </div>

                    <div className="flex justify-between mt-1">
                      <span>⭐ 최종 점수:</span>
                      <span className="font-bold text-purple-600">
                        {item.final_score?.toFixed(3)}
                      </span>
                    </div>

                    {item.reason && (
                      <p className="mt-2 text-xs text-gray-500">
                        📌 이유: {item.reason}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 미리보기 모달 */}
      <HighlightPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        videoUrl={previewVideoUrl}
        thumbnailUrl={selectedThumbnail}
        title={previewTitle}
        onExport={handleExport}
      />

      {/* 내보내기 모달 */}
      <ExportVodModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        onSubmit={handleExportSubmit}
        videoUrl={exportVideoUrl}
        thumbnailUrl={exportThumbnailUrl}
        videoTime={duration}
        defaultTitle={suggestedTitle} // ✅ 여기서 전달
      />

      {toast && <Toast type={toast.type} message={toast.message} />}
    </div>
  );
}

export default HighlightTab;
