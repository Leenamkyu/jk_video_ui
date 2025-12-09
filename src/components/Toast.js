import React from "react";

function Toast({ type = "success", message = "" }) {
  const bgColor =
    type === "success"
      ? "bg-green-500"
      : type === "error"
      ? "bg-red-500"
      : "bg-gray-800";

  return (
    <div
      className={`
        fixed top-6 right-6 px-5 py-3 rounded-xl shadow-lg text-white z-[9999]
        flex items-center gap-2
        animate-slideInFade
        ${bgColor}
      `}
    >
      {/* 아이콘 */}
      {type === "success" && (
        <span className="text-xl">✅</span>
      )}
      {type === "error" && (
        <span className="text-xl">❌</span>
      )}

      {/* 메시지 */}
      <span className="font-medium">{message}</span>
    </div>
  );
}

export default Toast;