import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Message } from "../../types";

export default function Chat({
  setQuestionCount,
}: {
  setQuestionCount: Dispatch<SetStateAction<number>>;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  const sendMessage = (text = input) => {
    const userMessage = text.trim();

    if (!userMessage) return;

    setMessages((current) => [
      ...current,
      {
        role: "user",
        text: userMessage,
      },
    ]);

    setQuestionCount((count) => count + 1);
    setInput("");
  };

  const newChat = () => {
    setMessages([]);
    setInput("");
  };

  return (
    <div className="chat-page">
      <aside className="chat-history">
        <button className="new-chat-btn" onClick={newChat}>
          + New Chat
        </button>

        <span className="history-title">RECENT CHATS</span>

        {messages.length > 0 ? (
          <div className="chat-history-item active">
            <span>💬</span>

            <div>
              <strong>
                {messages
                  .find((message) => message.role === "user")
                  ?.text.slice(0, 25) || "New conversation"}
              </strong>
              <small>Just now</small>
            </div>
          </div>
        ) : (
          <div className="no-chats">No conversations yet.</div>
        )}
      </aside>

      <div className="chat-main">
        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="chat-welcome">
              <div className="chat-logo">iS</div>

              <h2>Ask iSmartRAG</h2>

              <p>
                Ask questions about the material in your
                knowledge base.
              </p>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                className={`message-row ${
                  message.role === "user"
                    ? "user-message"
                    : "ai-message"
                }`}
                key={index}
              >
                <div className="message-avatar">
                  {message.role === "ai" ? "iS" : "U"}
                </div>

                <div className="message-bubble">
                  <p>{message.text}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="chat-input-area">
          <div className="chat-input-box">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  sendMessage();
                }
              }}
              placeholder="Ask anything about your knowledge base..."
            />

            <button onClick={() => sendMessage()}>↑</button>
          </div>

          <small>
            Connect your AI/RAG backend later to generate
            answers from your actual sources.
          </small>
        </div>
      </div>
    </div>
  );
}