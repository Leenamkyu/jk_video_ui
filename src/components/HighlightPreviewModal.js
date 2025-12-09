// src/components/HighlightPreviewModal.js
import React, { useEffect } from "react";

function HighlightPreviewModal({ isOpen, onClose, videoUrl, thumbnailUrl, title, onExport }) {

  // ESC로 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  // 렌더링 조건
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-[90%] max-w-2xl p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-800 transition"
        >
          ✖
        </button>

        <h2 className="text-2xl font-bold text-purple-700 mb-4 text-center">
          🎬 {title || "하이라이트 미리보기"}
        </h2>

        <div className="rounded-xl overflow-hidden border border-gray-300 shadow-md">
          {videoUrl ? (
            <video
              src={videoUrl}
              controls
              autoPlay
              className="w-full rounded-xl"
            />
          ) : (
            <div className="p-10 text-center text-gray-500">로딩 중...</div>
          )}
        </div>

        {/* 버튼 영역 */}
        <div className="mt-5 flex flex-col gap-3 items-center">

          {/* 다운로드 */}
          <a
            href={videoUrl}
            download
            className="px-5 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 shadow w-full text-center"
          >
            ⬇ 다운로드
          </a>

          {/* 새 탭에서 보기 */}
          <a
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-600 hover:underline text-sm"
          >
            🔗 새 탭에서 보기
          </a>

          {/* 🔥 내보내기 버튼 */}
          <button
            onClick={() => onExport(videoUrl, thumbnailUrl)}
            className="px-5 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow w-full text-center"
          >
            📤 내보내기
          </button>

        </div>
      </div>
    </div>
  );
}

export default HighlightPreviewModal;
