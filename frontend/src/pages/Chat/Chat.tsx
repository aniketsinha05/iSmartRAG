import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { ChatSummary, Message } from "../../types";
import { askQuestion } from "../../services/askService";
import {
  askClassroom,
  createChat,
  deleteChat,
  fetchChat,
  fetchChats,
} from "../../services/classroomService";

function formatWhen(iso: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

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
  classroom,
}: {
  setQuestionCount: Dispatch<SetStateAction<number>>;
  // when set, the chat only uses the documents of this classroom
  classroom?: { id: number; name: string };
}) {
  const classroomId = classroom?.id;
  const [messages, setMessages] = useState<Message[]>([]);
  // classroom chats are saved on the backend: the open chat and the list of saved chats
  const [chatId, setChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [ready, setReady] = useState(classroomId === undefined);
  const [notice, setNotice] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // opening a classroom chat loads its saved chats from the backend (newest one opens)
  useEffect(() => {
    if (classroomId === undefined) return;

    let cancelled = false;

    (async () => {
      try {
        const list = (await fetchChats(classroomId)).filter(
          (c) => c.messageCount > 0
        );

        if (cancelled) return;
        setChats(list);

        if (list.length > 0) {
          const chat = await fetchChat(classroomId, list[0].id);

          if (cancelled) return;
          setChatId(chat.id);
          setMessages(chat.messages);
        }
      } catch (error) {
        console.error(error);

        if (!cancelled) {
          setNotice("Could not load the saved chats. Is the backend running?");
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [classroomId]);

  const refreshChats = async () => {
    if (classroomId === undefined) return;

    try {
      setChats((await fetchChats(classroomId)).filter((c) => c.messageCount > 0));
    } catch (error) {
      console.error(error);
    }
  };

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
      let activeChat = chatId;

      // the chat is created on the backend with the first question
      if (classroom && !activeChat) {
        activeChat = (await createChat(classroom.id)).id;
        setChatId(activeChat);
      }

      const data = classroom
        ? await askClassroom(classroom.id, question, 5, activeChat ?? undefined)
        : await askQuestion(question, 5);

      setMessages((current) => [
        ...current,
        {
          role: "ai",
          text:
            data.answer ||
            (classroom
              ? `I couldn't find an answer in ${classroom.name}.`
              : "I couldn't find an answer in your knowledge base."),
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
      refreshChats();
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

  const openChat = async (id: string) => {
    if (classroomId === undefined || id === chatId || loading) return;

    try {
      const chat = await fetchChat(classroomId, id);
      setChatId(chat.id);
      setMessages(chat.messages);
      setNotice("");
    } catch (error) {
      console.error(error);
      setNotice("Could not open that chat.");
    }
  };

  const removeChat = async (chat: ChatSummary) => {
    if (classroomId === undefined) return;

    if (!window.confirm(`Delete the chat "${chat.title}"?`)) return;

    try {
      await deleteChat(classroomId, chat.id);

      if (chat.id === chatId) {
        setChatId(null);
        setMessages([]);
      }

      await refreshChats();
    } catch (error) {
      console.error(error);
      setNotice("Could not delete the chat.");
    }
  };

  const newChat = () => {
    setChatId(null);
    setMessages([]);
    setNotice("");
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

        {classroom ? (
          chats.length === 0 ? (
            <p className="ct-empty">No saved chats yet.</p>
          ) : (
            chats.map((chat) => (
              <div
                key={chat.id}
                className={`ct-hist ${chat.id === chatId ? "active" : ""}`}
              >
                <button
                  type="button"
                  className="ct-hist-main"
                  onClick={() => openChat(chat.id)}
                >
                  <strong>{chat.title}</strong>
                  <small>{formatWhen(chat.updatedAt)}</small>
                </button>

                <button
                  type="button"
                  className="ct-hist-del"
                  aria-label="Delete chat"
                  onClick={() => removeChat(chat)}
                >
                  ✕
                </button>
              </div>
            ))
          )
        ) : firstQuestion ? (
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
          {!ready && messages.length === 0 ? (
            <div className="ct-welcome">
              <p>Loading chats...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="ct-welcome">
              <div className="ct-logo">iS</div>
              <h2>How can I help you today?</h2>
              <p>
                {classroom
                  ? `Ask a question and I'll answer only from the documents added to ${classroom.name}.`
                  : "Ask a question and I'll answer from the documents and websites in your knowledge base."}
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
              placeholder={
                classroom
                  ? `Ask anything about ${classroom.name}...`
                  : "Ask anything about your knowledge base..."
              }
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

          {notice && <p className="ct-note">{notice}</p>}

          <p className="ct-note">
            {classroom
              ? `Answers use only the documents in ${classroom.name}. `
              : "Answers are generated from your indexed sources. "}
            Enter to send, Shift+Enter for a new line.
          </p>
        </div>
      </div>
    </div>
  );
}