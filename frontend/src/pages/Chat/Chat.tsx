import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Message } from "../../types";
import { askQuestion } from "../../services/askService";

const SUGGESTIONS = [
  {
    title: "Summarize my sources",
    text: "Summarize the main points across my sources.",
  },
  {
    title: "Find the key findings",
    text: "What are the key findings?",
  },
  {
    title: "Compare sources",
    text: "Compare information from different sources.",
  },
  {
    title: "Explain a concept",
    text: "Explain the most important concept in simple terms.",
  },
];

export default function Chat({
  setQuestionCount,
}: {
  setQuestionCount: Dispatch<SetStateAction<number>>;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const resize = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const send = async (text = input) => {
    const question = text.trim();
    if (!question || loading) return;

    setMessages((current) => [...current, { role: "user", text: question }]);
    setQuestionCount((count) => count + 1);
    setInput("");
    setLoading(true);

    requestAnimationFrame(() => {
      if (inputRef.current) inputRef.current.style.height = "auto";
    });

    try {
      const data = await askQuestion(question, 5);

      setMessages((current) => [
        ...current,
        {
          role: "ai",
          text:
            data.answer ||
            "I couldn't find an answer in your knowledge base.",
        },
      ]);
    } catch (error) {
      console.error(error);
      setMessages((current) => [
        ...current,
        {
          role: "ai",
          text: "I couldn't reach the backend. Check that it's running, then try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const copy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(index);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      // clipboard unavailable
    }
  };

  const newChat = () => {
    setMessages([]);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
  };

  const firstQuestion = messages.find((m) => m.role === "user")?.text;

  return (
    <div className="ct-page">
      <aside className="ct-side">
        <button type="button" className="ct-new" onClick={newChat}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New chat
        </button>

        <span className="ct-side-title">Recent</span>

        {firstQuestion ? (
          <div className="ct-item">
            <strong>{firstQuestion}</strong>
            <small>Current conversation</small>
          </div>
        ) : (
          <p className="ct-empty">No conversations yet.</p>
        )}
      </aside>

      <div className="ct-main">
        <div className="ct-scroll">
          {messages.length === 0 ? (
            <div className="ct-welcome">
              <div className="ct-logo">iS</div>
              <h2>How can I help you today?</h2>
              <p>
                Ask a question and I'll answer from the documents and websites
                in your knowledge base.
              </p>

              <div className="ct-suggest">
                {SUGGESTIONS.map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    className="ct-card"
                    onClick={() => send(item.text)}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="ct-thread">
              {messages.map((message, index) =>
                message.role === "user" ? (
                  <div className="ct-row user" key={index}>
                    <div className="ct-bubble-user">{message.text}</div>
                  </div>
                ) : (
                  <div className="ct-row" key={index}>
                    <div className="ct-avatar">iS</div>

                    <div className="ct-ai">
                      <div className="ct-text">{message.text}</div>

                      <div className="ct-tools">
                        <button
                          type="button"
                          className="ct-tool"
                          onClick={() => copy(message.text, index)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="9" y="9" width="11" height="11" rx="2" />
                            <path d="M5 15V6a2 2 0 0 1 2-2h9" />
                          </svg>
                          {copied === index ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              )}

              {loading && (
                <div className="ct-row">
                  <div className="ct-avatar">iS</div>
                  <div className="ct-dots" aria-label="Searching">
                    <i></i>
                    <i></i>
                    <i></i>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="ct-composer-wrap">
          <div className="ct-composer">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              placeholder="Ask anything about your knowledge base..."
              onChange={(event) => {
                setInput(event.target.value);
                resize();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
            />

            <button
              type="button"
              className="ct-send"
              onClick={() => send()}
              disabled={loading || !input.trim()}
              aria-label="Send message"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>

          <p className="ct-note">
            Answers are generated from your indexed sources. Enter to send,
            Shift+Enter for a new line.
          </p>
        </div>
      </div>
    </div>
  );
}