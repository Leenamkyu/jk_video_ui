import React, { useState } from "react";
import { useSharedVideo } from "../context/SharedVideoContext";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

function VideoUploadSection() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const {
    setSharedVideoUrl,
    saveAnalyzeResult,
    analyzeStatus,
    setAnalyzeStatus,
    refreshVideoList
  } = useSharedVideo();

  const [inputType, setInputType] = useState("file");
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  // ✅ 업로드 후 /analyze 호출
  const analyzeAfterUpload = async (s3Url) => {
    try {
      setAnalyzeStatus("analyzing");
      const formData = new FormData();
      formData.append("url", s3Url);
      const resp = await fetch(`${API_BASE_URL}/analyze`, {
        method: "POST",
        body: formData,
      });
      const data = await resp.json();
      if (data?.error) throw new Error(data.error);
      saveAnalyzeResult(s3Url, data);
      setUploaded(true);
      setAnalyzeStatus("done");
      refreshVideoList();
    } catch (err) {
      console.error("❌ 분석 실패:", err);
      alert("AI 분석 중 오류 발생: " + err.message);
      setAnalyzeStatus("idle");
    }
  };

  // ✅ S3 업로드
  const uploadToS3 = async (file) => {
    // presigned POST 받기
    const fd = new FormData();
    fd.append("filename", file.name);

    const resp = await fetch(`${API_BASE_URL}/generate-presigned-post`, {
      method: "POST",
      body: fd,
    });

    const { presigned_post, key } = await resp.json();

    // S3에 업로드
    const uploadForm = new FormData();
    Object.entries(presigned_post.fields).forEach(([k, v]) => {
      uploadForm.append(k, v);
    });
    uploadForm.append("file", file);

    const uploadResp = await fetch(presigned_post.url, {
      method: "POST",
      body: uploadForm,
    });

    if (!uploadResp.ok) throw new Error("S3 업로드 실패");

    // SLAHS 문제 해결
    const baseUrl = presigned_post.url.replace(/\/$/, "");
    const s3Url = `${baseUrl}/${key}`;

    console.log("🎉 업로드 성공:", s3Url);

    setSharedVideoUrl(s3Url);
    await analyzeAfterUpload(s3Url);
  };


  // ✅ YouTube 업로드
  const handleYoutubeUpload = async () => {
    if (!videoUrl) return;
    setLoading(true);
    try {
      setAnalyzeStatus("analyzing");
      const formData = new FormData();
      formData.append("video_url", videoUrl);
      const resp = await fetch(`${API_BASE_URL}/upload-youtube`, {
        method: "POST",
        body: formData,
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);

      const s3Url = data.s3_url;
      setSharedVideoUrl(s3Url);
      await analyzeAfterUpload(s3Url);
    } catch (err) {
      console.error("YouTube 업로드 실패:", err);
      alert("YouTube 업로드 오류: " + err.message);
      setAnalyzeStatus("idle");
    } finally {
      setLoading(false);
    }
  };

  // ✅ 파일 업로드
  const handleVideoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setVideoFile(file);
    setLoading(true);
    try {
      await uploadToS3(file);
    } catch (err) {
      console.error("업로드 실패:", err);
      alert("업로드 중 오류 발생");
      setAnalyzeStatus("idle");
    } finally {
      setLoading(false);
    }
  };

  // ✅ 새로운 영상으로 초기화
  const handleReset = () => {
    setSharedVideoUrl("");
    setVideoFile(null);
    setVideoUrl("");
    setUploaded(false);
    setAnalyzeStatus(null);
  };

  return (
    <div className="w-full bg-white/80 backdrop-blur-md rounded-2xl shadow-lg p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-purple-700">
          🎥 영상 업로드 / 연결
        </h2>

        {uploaded && (
          <button
            onClick={handleReset}
            className="text-sm text-red-600 hover:text-red-800 font-medium"
          >
            🔄 다른 영상으로 교체
          </button>
        )}
      </div>

      {!uploaded ? (
        <>
          {/* ✅ 입력 방식 선택 */}
          <div className="flex space-x-6 mb-4">
            <label className="flex items-center cursor-pointer space-x-2">
              <input
                type="radio"
                value="file"
                checked={inputType === "file"}
                onChange={() => setInputType("file")}
                className="accent-purple-500"
              />
              <span>파일 업로드</span>
            </label>
            <label className="flex items-center cursor-pointer space-x-2">
              <input
                type="radio"
                value="url"
                checked={inputType === "url"}
                onChange={() => setInputType("url")}
                className="accent-purple-500"
              />
              <span>URL 입력</span>
            </label>
          </div>

          {/* ✅ 파일 업로드 */}
          {inputType === "file" && (
            <div>
              <input
                type="file"
                accept="video/*"
                onChange={handleVideoChange}
                disabled={loading || analyzeStatus === "analyzing"}
                className="block w-full text-sm text-gray-700
                           file:mr-4 file:py-2 file:px-4
                           file:rounded-xl file:border-0
                           file:text-sm file:font-semibold
                           file:bg-purple-600 file:text-white
                           hover:file:bg-purple-700 cursor-pointer"
              />
              {videoFile && (
                <p className="text-sm text-gray-600 mt-2">
                  📄 선택된 파일:{" "}
                  <span className="font-medium text-purple-700">
                    {videoFile.name}
                  </span>
                </p>
              )}
            </div>
          )}

          {/* ✅ URL 입력 */}
          {inputType === "url" && (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="https://www.youtube.com/watch?v=abc123"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && videoUrl) {
                    e.preventDefault();
                    await handleYoutubeUpload();
                  }
                }}
                className="w-full p-3 border border-gray-300 rounded-xl
                          focus:ring-2 focus:ring-purple-400 focus:border-transparent
                          text-gray-800 placeholder-gray-400 shadow-sm transition"
              />
              {videoUrl && (
                <button
                  onClick={handleYoutubeUpload}
                  disabled={loading || analyzeStatus === "analyzing"}
                  className={`mt-2 px-5 py-2 rounded-xl font-semibold text-white transition ${
                    loading || analyzeStatus === "analyzing"
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-purple-600 hover:bg-purple-700"
                  }`}
                >
                  {loading || analyzeStatus === "analyzing"
                    ? "분석 중..."
                    : "🎥 URL 분석하기"}
                </button>
              )}
            </div>
          )}

          {/* ✅ 상태 표시 */}
          {analyzeStatus === "analyzing" && (
            <div className="mt-5 p-3 rounded-xl bg-yellow-50 border border-yellow-300 text-yellow-700 animate-pulse">
              🤖 AI가 영상을 분석 중입니다. 잠시만 기다려주세요...
            </div>
          )}
        </>
      ) : (
        // ✅ 업로드 완료 상태
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-center text-green-700">
          ✅ 영상 업로드 및 분석이 완료되었습니다.
          <br />
          하이라이트 생성 또는 대화형 검색 탭에서 계속 진행하세요.
        </div>
      )}

      {/* ✅ 분석 완료 알림 */}
      {analyzeStatus === "done" && uploaded && (
        <div className="mt-4 p-3 bg-green-50 border border-green-300 rounded-xl text-green-700 text-center">
          🎉 AI 분석이 완료되었습니다!
        </div>
      )}
    </div>
  );
}

export default VideoUploadSection;
