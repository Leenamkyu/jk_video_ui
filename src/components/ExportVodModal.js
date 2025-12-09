import React, { useState, useEffect } from "react";

function ExportVodModal({ isOpen, onClose, onSubmit, videoUrl, thumbnailUrl, videoTime, defaultTitle = "" }) {
  const [videoTitle, setVideoTitle] = useState(defaultTitle);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setVideoTitle(defaultTitle || "");
    }
  }, [defaultTitle, isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-[90%] max-w-md p-6 relative animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-800 transition"
        >
          ✖
        </button>

        <h2 className="text-xl font-bold text-purple-700 mb-5 text-center">
          📤 동영상 내보내기
        </h2>

        <label className="block text-gray-600 mb-2 font-medium">동영상 제목</label>
        <input
          type="text"
          placeholder="예: 하이라이트_001"
          className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:outline-none transition"
          value={videoTitle}
          onChange={(e) => setVideoTitle(e.target.value)}
        />

        {/* URL 표시 (읽기전용) */}
        <div className="mt-4 text-sm text-gray-500 bg-gray-100 px-3 py-2 rounded-lg break-words">
          <span className="font-medium text-gray-600">영상 URL:</span><br />
          {videoUrl}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 rounded-xl hover:bg-gray-300 transition"
          >
            취소
          </button>
          <button
            onClick={() => videoTitle.trim() && onSubmit(videoTitle, videoUrl, thumbnailUrl, videoTime)}
            className="px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition shadow"
          >
            ✔ 내보내기
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExportVodModal;