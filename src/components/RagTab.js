import React, { useState, useEffect, useRef } from "react";
import { useSharedVideo } from "../context/SharedVideoContext";
import { getVideoKey } from "../utils/getVideoKey";

function RagTab() {
  const {
    sharedVideoUrl,
    saveRagSession,
    getRagSession,
    runRagSetup,
    ragStatus,
    ragReady,
    setRagReady,
  } = useSharedVideo();

  const [conversation, setConversation] = useState([]);
  const [question, setQuestion] = useState("");
  const [isTyping, setIsTyping] = useState(false); // ⭐ 추가
  const chatBoxRef = useRef(null);
  const fetchedRef = useRef(null);
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

  // -------------------------------
  // 📌 영상 변경 시 초기화
  // -------------------------------
  useEffect(() => {
    if (!sharedVideoUrl) return;
    setConversation([]);
    fetchedRef.current = null;
  }, [sharedVideoUrl]);

  // -------------------------------
  // 📌 캐시 → DynamoDB 세션 복원
  // -------------------------------
  useEffect(() => {
    if (!sharedVideoUrl) return;

    const videoKey = getVideoKey(sharedVideoUrl);
    if (fetchedRef.current === videoKey) return;
    fetchedRef.current = videoKey;

    const cached = getRagSession(sharedVideoUrl);
    if (cached && cached.length > 0) {
      setConversation(cached);
      setRagReady(true);
      return;
    }

    // DynamoDB에서 복원
    (async () => {
      try {
        const resp = await fetch(
          `${API_BASE_URL}/rag/history?video_url=${encodeURIComponent(
            sharedVideoUrl
          )}`
        );
        const data = await resp.json();

        if (data.history && data.history.length > 0) {
          const restored = data.history.map((m) => {
            const t = m.time_full || null;

            return {
              role: m.role,
              content: m.message,
              time: t
                ? new Date(t).toLocaleTimeString("ko-KR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "",
              timeFull: t || new Date().toISOString(),
            };
          });

          setConversation(restored);
          setRagReady(true);
          saveRagSession(sharedVideoUrl, restored);
        } else {
          setConversation([]);
          setRagReady(false);
        }
      } catch (err) {
        console.error("❌ 세션 복원 오류:", err);
      }
    })();
  }, [sharedVideoUrl]);

  // -------------------------------
  // 📌 자동 스크롤
  // -------------------------------
  useEffect(() => {
    if (chatBoxRef.current)
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
  }, [conversation, isTyping]); // ⭐ typing bubble 보일 때도 스크롤

  // -------------------------------
  // 📌 대화 캐시 저장
  // -------------------------------
  useEffect(() => {
    if (!sharedVideoUrl || conversation.length === 0) return;
    saveRagSession(sharedVideoUrl, conversation);
  }, [conversation]);

  // -------------------------------
  // 📌 질문 전송
  // -------------------------------
  const handleAsk = async () => {
    if (!ragReady) return alert("먼저 영상 분석을 시작해주세요!");
    if (!question.trim()) return;

    const now = new Date();
    const userMsg = {
      role: "user",
      content: question,
      time: now.toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      timeFull: now.toISOString(),
    };
    setConversation((prev) => [...prev, userMsg]);
    setQuestion("");

    // ⭐ 입력중 표시 시작
    setIsTyping(true);

    const currentVideo = sharedVideoUrl;

    try {
      const formData = new FormData();
      formData.append("question", question);
      formData.append("video_url", sharedVideoUrl);
      formData.append("user_id", "default_user");

      const resp = await fetch(`${API_BASE_URL}/rag/ask`, {
        method: "POST",
        body: formData,
      });

      const data = await resp.json();
      const answer = data.answer || "답변 생성 실패 😢";

      // ⭐ 입력중 표시 종료
      setIsTyping(false);

      if (sharedVideoUrl !== currentVideo) return;

      const serverTime = data.time_full || new Date().toISOString();

      const aiMsg = {
        role: "assistant",
        content: answer,
        time: new Date(serverTime).toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        timeFull: serverTime,
      };

      setConversation((prev) => [...prev, aiMsg]);
    } catch (err) {
      setIsTyping(false);
      console.error("❌ 질문 오류:", err);
      alert("질의응답 실패: " + err.message);
    }
  };

  // ============================================================
  // 📌 UI 렌더링 + 날짜 구분선(Date Divider)
  // ============================================================
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-purple-700 text-center">
        💬 영상 내용 질의응답 (RAG)
      </h2>

      <div className="text-gray-600 text-center">
        🎞 현재 영상:
        <span className="text-purple-600 ml-2 font-semibold">
          {sharedVideoUrl || "없음"}
        </span>
      </div>

      {!ragReady && (
        <button
          onClick={runRagSetup}
          disabled={ragStatus === "running" || !sharedVideoUrl}
          className={`w-full py-3 rounded-2xl font-bold text-white text-lg ${
            ragStatus === "running"
              ? "bg-gray-400 cursor-wait"
              : "bg-purple-600 hover:bg-purple-700"
          }`}
        >
          {ragStatus === "running" ? "분석 중..." : "🔍 영상 분석 시작"}
        </button>
      )}

      {(ragReady || conversation.length > 0) && (
        <>
          <div
            ref={chatBoxRef}
            className="bg-gray-50 border rounded-xl p-4 h-96 overflow-y-auto space-y-4"
          >
            {conversation.length === 0 ? (
              <p className="text-gray-400 text-center italic">
                아직 대화가 없습니다.
              </p>
            ) : (
              conversation.map((msg, i) => {
                const prev = conversation[i - 1];
                const currentDate = new Date(
                  msg.timeFull
                ).toLocaleDateString("ko-KR", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  weekday: "short",
                });
                const prevDate =
                  i > 0
                    ? new Date(prev.timeFull).toLocaleDateString("ko-KR", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        weekday: "short",
                      })
                    : null;

                const showDateDivider = currentDate !== prevDate;

                return (
                  <React.Fragment key={i}>
                    {showDateDivider && (
                      <div className="text-center text-gray-400 text-xs my-2 flex items-center justify-center">
                        <div className="flex-grow border-t border-gray-200 mx-2"></div>
                        <span className="whitespace-nowrap">{currentDate}</span>
                        <div className="flex-grow border-t border-gray-200 mx-2"></div>
                      </div>
                    )}

                    <div
                      className={`flex items-end ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      {msg.role === "assistant" && (
                        <div className="flex flex-col items-center mr-2">
                          <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm shadow">
                            🤖
                          </div>
                        </div>
                      )}

                      <div
                        className={`max-w-[70%] px-4 py-2 rounded-2xl shadow text-sm break-words ${
                          msg.role === "user"
                            ? "bg-purple-600 text-white rounded-br-none"
                            : "bg-green-100 text-gray-800 rounded-bl-none"
                        }`}
                      >
                        <div>{msg.content}</div>
                        <div
                          className={`text-xs mt-1 ${
                            msg.role === "user"
                              ? "text-purple-200 text-right"
                              : "text-gray-500 text-left"
                          }`}
                        >
                          {msg.time}
                        </div>
                      </div>

                      {msg.role === "user" && (
                        <div className="flex flex-col items-center ml-2">
                          <div className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm shadow">
                            👤
                          </div>
                        </div>
                      )}
                    </div>
                  </React.Fragment>
                );
              })
            )}

            {/* 🟢 AI 입력중 말풍선 */}
            {isTyping && (
              <div className="flex items-start mt-2">
                {/* 아이콘 */}
                <div className="flex flex-col items-center mr-2">
                  <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm shadow">
                    🤖
                  </div>
                </div>

                {/* 말풍선 */}
                <div className="bg-green-100 text-gray-700 px-4 py-2 rounded-2xl shadow max-w-[70%] flex items-center space-x-1">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
              </div>
            )}
          </div>

          <div className="flex mt-3 space-x-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAsk()}
              placeholder="질문을 입력하세요..."
              className="flex-grow p-3 border rounded-xl focus:ring-2 focus:ring-purple-400"
            />
            <button
              onClick={handleAsk}
              className="px-5 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700"
            >
              전송
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default RagTab;
