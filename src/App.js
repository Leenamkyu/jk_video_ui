import React, { useState, useEffect, useRef } from "react";
import { SharedVideoProvider, useSharedVideo } from "./context/SharedVideoContext";
import VideoUploadSection from "./components/VideoUploadSection";
import AnalysisTab from "./components/AnalysisTab";
import HighlightTab from "./components/HighlightTab";
import RagTab from "./components/RagTab";

/* 🟣 상단 전역 Progress Bar */
function GlobalProgressBar() {
  const { highlightStatus, ragStatus, fetchAnalyzeFromServer } = useSharedVideo();
  const isActive = highlightStatus === "running" || ragStatus === "running";

  return (
    <div
      className={`fixed top-0 left-0 w-full h-[4px] transition-all duration-300 z-50 ${
        isActive ? "opacity-100 animate-progress" : "opacity-0"
      }`}
      style={{
        background: "linear-gradient(90deg, #8b5cf6, #ec4899, #f59e0b)",
        backgroundSize: "200% 100%",
      }}
    ></div>
  );
}

/* 🧭 좌측 네비게이션 */
function LeftSidebar({ activeTab, setActiveTab }) {
  const menuItems = [
    { key: "upload", label: "📁 영상 입력" },
    { key: "analysis", label: "🎞 원본영상분석" },
    { key: "rag", label: "💬 대화형 요약/검색" },
    { key: "highlight", label: "✂️ 하이라이트 생성" },
  ];

  return (
    <div className="w-1/5 hidden lg:flex flex-col p-5 bg-white/80 rounded-2xl border border-gray-200 shadow-xl">
      <h2 className="text-2xl font-extrabold text-purple-700 mb-8 text-center">
        🎬 AI 영상 분석
      </h2>

      <nav className="space-y-3">
        {menuItems.map((m) => (
          <button
            key={m.key}
            onClick={() => setActiveTab(m.key)}
            className={`w-full text-left px-5 py-3 rounded-xl font-semibold transition-all duration-200 ${
              activeTab === m.key
                ? "bg-purple-600 text-white shadow-lg"
                : "bg-gray-100 hover:bg-purple-100 text-gray-700"
            }`}
          >
            {m.label}
          </button>
        ))}
      </nav>

      <footer className="mt-auto text-center text-xs text-gray-400 pt-6 border-t border-gray-100">
        © 2025 JK-Video Highlight Studio
      </footer>
    </div>
  );
}

/* 🎞 우측 패널 — 최근 영상 리스트 */
function RightSidebar() {
  const {
    sharedVideoUrl,
    selectVideo,
    clearVideoData,
    refreshFlag,
    getHighlightResult,   // 🔥 하이라이트 결과 조회 추가
    fetchAnalyzeFromServer 
  } = useSharedVideo();

  const [videos, setVideos] = useState([]);
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const USER_ID = "default_user";

  const fetchVideos = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/list_videos?user_id=${USER_ID}`);
      const data = await res.json();
      setVideos(data.videos || []);
    } catch (e) {
      console.error("❌ 최근 영상 불러오기 실패:", e);
    }
  };

  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return; // 두 번째 실행 차단
    initialized.current = true;
    fetchVideos();
  }, []);

  useEffect(() => {
    if (refreshFlag === 0) return;
    fetchVideos();
  }, [refreshFlag]); // ✅ 새 영상 업로드 시 자동 갱신

  const handleDelete = async (fileName, videoUrl) => {
    if (
      !window.confirm(
        `'${fileName}' 영상을 삭제하시겠습니까? (AI 대화도 함께 삭제됩니다)`
      )
    )
      return;

    try {
      const formData = new FormData();
      formData.append("user_id", USER_ID);
      formData.append("file_name", fileName);

      const res = await fetch(`${API_BASE_URL}/delete_video`, {
        method: "DELETE",
        body: formData,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      alert("✅ 영상 및 세션이 삭제되었습니다.");

      // ✅ 1️⃣ context 상태 초기화
      clearVideoData(videoUrl);

      // ✅ 2️⃣ 로컬 캐시 완전 삭제 (TTL 기반 RAG 캐시 제거)
      Object.keys(localStorage)
        .filter((k) => k.startsWith("rag_"))
        .forEach((k) => localStorage.removeItem(k));

      // ✅ 3️⃣ react state 캐시도 제거
      sessionStorage.clear?.();

      // ✅ 4️⃣ 리스트 새로고침
      fetchVideos();
    } catch (e) {
      console.error("❌ 삭제 실패:", e);
      alert("삭제 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="w-1/5 hidden lg:flex flex-col p-5 bg-white/80 rounded-2xl border border-gray-200 shadow-xl">
      <h3 className="text-lg font-semibold text-purple-700 mb-4">
        📺 최근 업로드된 영상
      </h3>

      {videos.length === 0 ? (
        <p className="text-gray-500 text-sm text-center mt-8">
          최근 업로드된 영상이 없습니다.
        </p>
      ) : (
        <ul className="space-y-3 overflow-y-auto">
          {videos.map((v) => {
            // 🔥 이 영상에 대해 생성된 하이라이트 정보 가져오기
            const highlightInfo = getHighlightResult(v.video_url);

            return (
              <li
                key={v.uploaded_at}
                className={`p-3 rounded-xl border transition flex justify-between items-center ${
                  sharedVideoUrl === v.video_url
                    ? "bg-purple-100 border-purple-400 text-purple-800 font-medium"
                    : "bg-white border-gray-200 hover:bg-gray-50 text-gray-700"
                }`}
              >
                <div
                  className="flex-1 cursor-pointer truncate text-sm"
                  onClick={() => {
                    const meta = {
                      focus: v.recommended_focus || [],
                      duration: v.recommended_duration || [],
                      summary_title: v.summary_title || "",
                      summary_points: v.summary_points || [],
                      segments: v.segments || [],
                      duration_sec: v.duration_sec || 0,
                    };
                    selectVideo(v.video_url, meta);
                  }}
                  title={v.video_url}
                >
                  🎞 {v.file_name}
                  <div className="text-xs text-gray-400 mt-1">
                    {new Date(v.uploaded_at).toLocaleString("ko-KR")}
                  </div>

                  {/* 기존 상태 표시 */}
                  {v.status === "completed" && (
                    <span className="text-green-600 text-xs font-semibold">
                      완료됨
                    </span>
                  )}

                  {/* 🔥 하이라이트 상태 표시 */}
                  {highlightInfo?.results?.length > 0 ? (
                    <div className="mt-1 text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded-lg inline-block">
                      ✂️ {highlightInfo.results.length}개 생성됨
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-gray-400">
                      하이라이트 없음
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleDelete(v.file_name, v.video_url)}
                  className="text-red-500 text-xs hover:text-red-700 ml-2"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* 🟣 상단 현재 영상 표시 */
function VideoIndicator({ onReset }) {
  const { sharedVideoUrl } = useSharedVideo();
  if (!sharedVideoUrl) return null;

  return (
    <div className="w-full bg-purple-50 border border-purple-200 rounded-xl p-3 flex items-center justify-between shadow-sm">
      <div className="text-sm text-gray-700 truncate max-w-[80%]">
        🎞 현재 영상:{" "}
        <span
          className="text-purple-700 font-medium break-words block max-w-[800px]"
          title={sharedVideoUrl}
        >
          {sharedVideoUrl}
        </span>
      </div>
      <button
        onClick={onReset}
        className="px-3 py-1 text-sm font-semibold text-purple-600 hover:text-purple-800 underline"
      >
        다른 영상 선택
      </button>
    </div>
  );
}

/* 🧩 중앙 메인 콘텐츠 */
function CenterPanel({ activeTab, setActiveTab, addLog }) {
  const { sharedVideoUrl, selectVideo } = useSharedVideo();

  const renderContent = () => {
    if (activeTab === "upload") return <VideoUploadSection />;
    if (!sharedVideoUrl)
      return (
        <div className="text-center text-gray-500 mt-10">
          ⚡ 영상을 업로드하거나 URL을 입력해주세요.
        </div>
      );

    return (
      <>
        <VideoIndicator onReset={() => selectVideo("")} />
        <div className="mt-6">
          {activeTab === "analysis" && <AnalysisTab />}
          {activeTab === "rag" && <RagTab />}
          {activeTab === "highlight" && <HighlightTab setStatusLog={addLog} />}
        </div>
      </>
    );
  };

  return (
    <div className="flex-1 flex flex-col p-6 bg-white/80 rounded-2xl shadow-2xl border border-gray-200">
      {/* 전역 프로그레스바 */}
      <GlobalProgressBar />
      {renderContent()}
    </div>
  );
}

/* 🧩 최종 App */
function App() {
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState("upload");

  const addLog = (msg) => {
    setLogs((prev) => [
      ...prev.slice(-49),
      `[${new Date().toLocaleTimeString()}] ${msg}`,
    ]);
  };

  return (
    <SharedVideoProvider>
      <div className="min-h-screen flex gap-5 p-6 bg-gradient-to-r from-purple-100 via-pink-100 to-yellow-100">
        <LeftSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        <CenterPanel
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          addLog={addLog}
        />
        <RightSidebar />
      </div>
    </SharedVideoProvider>
  );
}

export default App;