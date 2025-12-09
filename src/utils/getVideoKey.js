export const getVideoKey = (url) => {
  if (!url) return "rag_unknown";
  try {
    const { pathname } = new URL(url);
    const parts = pathname.split("/");

    // 파일명 + 상위폴더 + url 해시 일부로 고유 키 생성
    const filePart = parts.slice(-2).join("_");

    // ✅ UTF-8 안전하게 인코딩한 후 Base64 처리
    const safeBase64 = btoa(encodeURIComponent(url))
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 6);

    return `rag_${filePart}_${safeBase64}`;
  } catch {
    // fallback
    try {
      const safeBase64 = btoa(encodeURIComponent(url)).replace(/[^a-zA-Z0-9]/g, "").slice(0, 6);
      return `rag_${safeBase64}`;
    } catch {
      return "rag_invalid";
    }
  }
};
