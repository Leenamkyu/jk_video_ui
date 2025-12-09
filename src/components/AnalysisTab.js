import React, { useEffect, useState, useRef } from "react";
import { useSharedVideo } from "../context/SharedVideoContext";

function AnalysisTab() {
  const { sharedVideoUrl, analyzeCache, videoMeta } = useSharedVideo();
  const [segments, setSegments] = useState([]);
  const [summaryTitle, setSummaryTitle] = useState("");
  const [summaryPoints, setSummaryPoints] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const videoRef = useRef(null);
  const listRef = useRef(null);

  // ✅ 1️⃣ 분석 데이터 로드 (analyzeCache → videoMeta 순서로 fallback)
  useEffect(() => {
    if (!sharedVideoUrl) return;

    const cached = analyzeCache?.[sharedVideoUrl];
    const source = cached || videoMeta;

    if (!source) return;

    setSegments(source.segments || []);
    setSummaryTitle(source.summary_title || "🎬 분석 결과 요약");
    setSummaryPoints(source.summary_points || []);
  }, [sharedVideoUrl, analyzeCache, videoMeta]);

  // ✅ 2️⃣ 영상 시간에 맞춰 현재 STT 구간 업데이트
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !segments.length) return;

    const handleTimeUpdate = () => {
      const t = video.currentTime;
      const idx = segments.findIndex(
        (s, i) =>
          t >= s.start &&
          (i === segments.length - 1 || t < segments[i + 1].start)
      );
      if (idx !== -1 && idx !== currentIndex) {
        setCurrentIndex(idx);
        const item = listRef.current?.children[idx];
        if (item) {
          item.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [segments, currentIndex]);

  // ✅ 3️⃣ 특정 자막 클릭 시 해당 구간으로 이동
  const handleSeek = (time) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      videoRef.current.play();
    }
  };

  if (!sharedVideoUrl) {
    return (
      <div className="text-center text-gray-500 mt-10">
        ⚡ 영상을 업로드하거나 URL을 입력해주세요.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 제목 */}
      <h2 className="text-3xl font-extrabold text-center text-purple-700">
        🎞 원본 영상 분석
      </h2>

      {/* 요약 */}
      <div className="bg-white border rounded-xl p-5 shadow-sm">
        <h3 className="text-xl font-bold text-purple-700 mb-2">{summaryTitle}</h3>
        <ul className="list-disc list-inside text-gray-700 space-y-1 ml-3">
          {summaryPoints.length > 0 ? (
            summaryPoints.map((p, i) => <li key={i}>{p}</li>)
          ) : (
            <li className="text-gray-400 italic">요약 정보가 없습니다.</li>
          )}
        </ul>
      </div>

      {/* 영상 플레이어 */}
      <div className="flex justify-center">
        <video
          ref={videoRef}
          src={sharedVideoUrl}
          controls
          className="w-full max-w-3xl rounded-xl shadow-lg border border-gray-200"
        />
      </div>

      {/* 실시간 자막 */}
      <div
        className="bg-gray-50 border rounded-xl p-4 h-96 overflow-y-auto shadow-inner"
        ref={listRef}
      >
        <h4 className="text-lg font-semibold text-purple-700 mb-3">
          🗣 실시간 자막 (STT)
        </h4>
        {segments.length === 0 ? (
          <p className="text-gray-400 text-sm italic text-center">
            STT 정보가 없습니다.
          </p>
        ) : (
          <ul className="space-y-1">
            {segments.map((seg, i) => (
              <li
                key={i}
                onClick={() => handleSeek(seg.start)}
                className={`cursor-pointer p-2 rounded-md transition text-sm ${
                  i === currentIndex
                    ? "bg-purple-100 border-l-4 border-purple-500 font-semibold text-purple-800"
                    : "hover:bg-purple-50 text-gray-800"
                }`}
              >
                <span className="text-xs text-gray-500 mr-2">
                  [{formatTime(seg.start)}]
                </span>
                {seg.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ✅ 시간 포맷
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default AnalysisTab;
