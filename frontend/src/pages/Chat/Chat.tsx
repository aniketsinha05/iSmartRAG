import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Classroom, ChatSummary, Message, Source } from "../../types";
import { fetchSources } from "../../services/sourcesService";
import { apiClient } from "../../services/apiClient";

import {
  fetchClassrooms,
  fetchGeneralChats,
  createGeneralChat,
  fetchGeneralChat,
  deleteGeneralChat,
} from "../../services/classroomService";

const SUGGESTIONS = [
  { title: "Summarize my sources",  text: "Summarize the main points across my sources." },
  { title: "Find the key findings", text: "What are the key findings?" },
  { title: "Compare sources",       text: "Compare information from different sources." },
  { title: "Explain a concept",     text: "Explain the most important concept in simple terms." },
];

const ACTIVE_CHAT_KEY = "mybookai-active-chat";
const FRESH_CHAT_KEY = "mybookai-fresh-chat";
const NEW_CHAT = "__new__"; // saved when a blank chat is open

const SCOPE_KEY = "mybookai-chat-scope";

// Classroom ids are real database ids now (no fixed 1-5), so accept any positive id.
const readScope = (): number[] => {
  try {
    return (localStorage.getItem(SCOPE_KEY) ?? "")
      .split(",")
      .map(Number)
      .filter((n) => Number.isInteger(n) && n >= 1);
  } catch {
    return [];
  }
};

const readActiveChat = (): string | null => {
  try { return localStorage.getItem(ACTIVE_CHAT_KEY); } catch { return null; }
};

const writeActiveChat = (id: string | null) => {
  try {
    if (id) localStorage.setItem(ACTIVE_CHAT_KEY, id);
    else localStorage.removeItem(ACTIVE_CHAT_KEY);
  } catch {}
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function Chat({
  setQuestionCount,
}: {
  setQuestionCount: Dispatch<SetStateAction<number>>;
}) {
  // ── messages / loading ───────────────────────────────────────────────────
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [copied, setCopied]     = useState<number | null>(null);

  // ── persistence ──────────────────────────────────────────────────────────
  const [chatId, setChatId]     = useState<string | null>(null);
  const [chatList, setChatList] = useState<ChatSummary[]>([]);
  const [ready, setReady]       = useState(false);

  // ── classroom picker ─────────────────────────────────────────────────────
  const [classroomIds, setClassroomIds]               = useState<number[]>(readScope);
  const [availableClassrooms, setAvailableClassrooms] = useState<Classroom[]>([]);
  const [showPicker, setShowPicker]                   = useState(false);

  // ── Knowledge Base document picker (by document id) ──────────────────────
  const [availableSources, setAvailableSources] = useState<Source[]>([]);
  const [selectedDocIds, setSelectedDocIds]     = useState<number[]>([]);
  const [sourceSearch, setSourceSearch]         = useState("");

  const bottomRef   = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLTextAreaElement>(null);
  const pickerRef   = useRef<HTMLDivElement>(null);
  const scopeBtnRef = useRef<HTMLButtonElement>(null);

  // ── scroll to bottom ─────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // ── load classrooms + documents once ─────────────────────────────────────
  useEffect(() => {
    fetchClassrooms()
      .then((rooms) => {
        setAvailableClassrooms(rooms);
        // drop saved scope ids that no longer exist (deleted classroom / other account)
        setClassroomIds((curr) => curr.filter((id) => rooms.some((r) => r.id === id)));
      })
      .catch(console.error);

    fetchSources().then(setAvailableSources).catch(console.error);
  }, []);

  // ── load persisted chats on mount ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const list = (await fetchGeneralChats()).filter((c) => c.messageCount > 0);
        if (cancelled) return;
        setChatList(list);

        // Arriving from another page: open a new chat instead of restoring one
        let fresh = false;
        try {
          fresh = sessionStorage.getItem(FRESH_CHAT_KEY) === "1";
          sessionStorage.removeItem(FRESH_CHAT_KEY);
        } catch {}

        if (fresh) {
          writeActiveChat(NEW_CHAT);
          return;
        }

        if (list.length === 0) return;

        const saved = readActiveChat();
        if (saved === NEW_CHAT) return; // a blank chat was open, keep it blank
        const target = list.find((c) => c.id === saved) ?? list[0];

        const chat = await fetchGeneralChat(target.id);
        if (cancelled) return;
        setChatId(chat.id);
        setMessages(chat.messages);
        writeActiveChat(chat.id);
      } catch (err) {
        console.error("Could not load saved chats:", err);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // keep the selected classrooms across refresh
  useEffect(() => {
    try {
      if (classroomIds.length > 0) {
        localStorage.setItem(SCOPE_KEY, classroomIds.join(","));
      } else {
        localStorage.removeItem(SCOPE_KEY);
      }
    } catch {}
  }, [classroomIds]);

  // ── close picker on outside click (the + button handles its own toggle) ──
  useEffect(() => {
    if (!showPicker) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (pickerRef.current?.contains(target)) return;
      if (scopeBtnRef.current?.contains(target)) return;
      setShowPicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPicker]);

  // ── helpers ──────────────────────────────────────────────────────────────
  const refreshChatList = async () => {
    try {
      const list = (await fetchGeneralChats()).filter((c) => c.messageCount > 0);
      setChatList(list);
    } catch (err) {
      console.error(err);
    }
  };

  const resize = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  // ── send ─────────────────────────────────────────────────────────────────
  const send = async (text = input) => {
    const question = text.trim();
    if (!question || loading) return;

    setMessages((curr) => [...curr, { role: "user", text: question }]);
    setQuestionCount((c) => c + 1);
    setInput("");
    setLoading(true);
    setShowPicker(false);
    requestAnimationFrame(() => {
      if (inputRef.current) inputRef.current.style.height = "auto";
    });

    try {
      // Lazily create a chat session on the first message of a new conversation
      let activeChatId = chatId;
      if (!activeChatId) {
        const created = await createGeneralChat();
        activeChatId = created.id;
        setChatId(activeChatId);
        writeActiveChat(activeChatId);
      }

      // apiClient adds the Authorization header
      const response = await apiClient("/chat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          classroom_ids: classroomIds,
          document_ids: selectedDocIds,
          n_results: 5,
          chat_id: activeChatId,
        }),
      });

      const data = await response.json();

      setMessages((curr) => [
        ...curr,
        {
          role: "ai",
          text: data.answer || "I couldn't find an answer in your knowledge base.",
        },
      ]);

      await refreshChatList();
    } catch (err) {
      console.error(err);
      setMessages((curr) => [
        ...curr,
        {
          role: "ai",
          text: "I couldn't get an answer. Check that the backend is running, then try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // ── sidebar actions ───────────────────────────────────────────────────────
  const openChat = async (id: string) => {
    if (id === chatId || loading) return;
    try {
      const chat = await fetchGeneralChat(id);
      setChatId(chat.id);
      setMessages(chat.messages);
      writeActiveChat(chat.id);
    } catch (err) {
      console.error(err);
    }
  };

  const removeChat = async (chat: ChatSummary) => {
    if (!window.confirm(`Delete the chat "${chat.title}"?`)) return;
    try {
      await deleteGeneralChat(chat.id);
      if (chat.id === chatId) {
        setChatId(null);
        setMessages([]);
        writeActiveChat(NEW_CHAT);
      }
      await refreshChatList();
    } catch (err) {
      console.error(err);
    }
  };

  const newChat = () => {
    setChatId(null);
    writeActiveChat(NEW_CHAT);
    setMessages([]);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
  };

  // ── picker helpers ────────────────────────────────────────────────────────
  const toggleClassroom = (id: number) =>
    setClassroomIds((curr) =>
      curr.includes(id) ? curr.filter((c) => c !== id) : [...curr, id]
    );

  const toggleDoc = (id: number) =>
    setSelectedDocIds((curr) =>
      curr.includes(id) ? curr.filter((d) => d !== id) : [...curr, id]
    );

  const filteredSources = availableSources.filter((source) =>
    source.name.toLowerCase().includes(sourceSearch.toLowerCase())
  );

  const copy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(index);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {}
  };

  const selectedRooms = availableClassrooms.filter((r) => classroomIds.includes(r.id));
  const selectedDocs  = availableSources.filter((s) => selectedDocIds.includes(s.id));
  const hasScope = selectedRooms.length > 0 || selectedDocs.length > 0;

  const scopeParts = [
    ...selectedRooms.map((r) => r.name),
    ...(selectedDocs.length > 0
      ? [`${selectedDocs.length} document${selectedDocs.length === 1 ? "" : "s"}`]
      : []),
  ];
  const scopeLabel = hasScope ? scopeParts.join(" + ") : "all your documents";

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="ct-page">

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className="ct-side">
        <button type="button" className="ct-new" onClick={newChat}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New chat
        </button>

        <span className="ct-side-title">Recent</span>

        {!ready && <p className="ct-empty">Loading…</p>}

        {ready && chatList.length === 0 && (
          <p className="ct-empty">No saved chats yet.</p>
        )}

        {ready && chatList.map((chat) => (
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
        ))}
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <div className="ct-main">
        <div className="ct-scroll">
          {messages.length === 0 ? (
            <div className="ct-welcome">
              <div className="ct-logo">iS</div>
              <h2>How can I help you today?</h2>
              <p>
                {hasScope
                  ? `Searching in ${scopeLabel}.`
                  : "Ask a question and I'll answer from all documents in your knowledge base."}
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
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2"
                            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
                    <i /><i /><i />
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* ── Composer area ─────────────────────────────────────────────── */}
        <div className="ct-composer-wrap">

          {/* Scope badges */}
          {hasScope && (
            <div className="ct-badges">
              {selectedRooms.map((r) => (
                <span key={`room-${r.id}`} className="ct-badge">
                  🏫 {r.name}
                  <button
                    type="button"
                    onClick={() => toggleClassroom(r.id)}
                    aria-label={`Remove ${r.name}`}
                  >
                    ×
                  </button>
                </span>
              ))}

              {selectedDocs.map((d) => (
                <span key={`doc-${d.id}`} className="ct-badge">
                  📄 {d.name.length > 28 ? d.name.slice(0, 25) + "…" : d.name}
                  <button
                    type="button"
                    onClick={() => toggleDoc(d.id)}
                    aria-label={`Remove ${d.name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Picker dropdown */}
          {showPicker && (
            <div className="ct-picker" ref={pickerRef}>
              <div className="ct-picker-head">
                <span>Filter by classroom</span>
                <button type="button" className="hm-x" onClick={() => setShowPicker(false)}>
                  ✕
                </button>
              </div>

              {availableClassrooms.length === 0 && (
                <div className="hm-empty">No classrooms yet.</div>
              )}

              {availableClassrooms.map((r) => (
                <label key={r.id} className="ct-picker-item">
                  <input
                    type="checkbox"
                    checked={classroomIds.includes(r.id)}
                    onChange={() => toggleClassroom(r.id)}
                  />
                  <span>🏫</span>
                  <span style={{ flex: 1 }}>{r.name}</span>
                  <span className="sx-hint">
                    {r.documentCount} doc{r.documentCount !== 1 ? "s" : ""}
                  </span>
                </label>
              ))}

              {/* Knowledge Base documents */}
              <div className="ct-picker-head">
                <span>Knowledge Base Documents</span>
                <button
                  type="button"
                  className="ct-picker-clear"
                  style={{ width: "auto", borderTop: 0, padding: "0 4px" }}
                  onClick={() => setSelectedDocIds([])}
                >
                  Clear
                </button>
              </div>

              <div style={{ padding: "0 16px 8px" }}>
                <input
                  className="sx-input full"
                  placeholder="Search documents..."
                  value={sourceSearch}
                  onChange={(e) => setSourceSearch(e.target.value)}
                />
              </div>

              <div style={{ maxHeight: 220, overflowY: "auto" }}>
                {filteredSources.length === 0 && (
                  <div className="hm-empty">
                    {availableSources.length === 0
                      ? "No documents yet. Upload one first."
                      : "No documents match."}
                  </div>
                )}

                {filteredSources.map((source) => (
                  <label key={source.id} className="ct-picker-item">
                    <input
                      type="checkbox"
                      checked={selectedDocIds.includes(source.id)}
                      onChange={() => toggleDoc(source.id)}
                    />
                    <span>📄</span>
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {source.name}
                    </span>
                  </label>
                ))}
              </div>

              {hasScope && (
                <button
                  type="button"
                  className="ct-picker-clear"
                  onClick={() => {
                    setClassroomIds([]);
                    setSelectedDocIds([]);
                    setShowPicker(false);
                  }}
                >
                  ✕ Clear — search all documents
                </button>
              )}
            </div>
          )}

          {/* Composer */}
          <div className="ct-composer">
            <button
              ref={scopeBtnRef}
              type="button"
              className={`ct-scope-btn ${hasScope ? "active" : ""}`}
              onClick={() => setShowPicker((v) => !v)}
              aria-label="Filter by classroom or document"
              title={
                hasScope
                  ? `Searching in ${scopeLabel}`
                  : "Search all documents — click to filter by classroom or document"
              }
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>

            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              placeholder={
                hasScope
                  ? `Ask anything in ${scopeLabel}…`
                  : "Ask anything about your knowledge base…"
              }
              onChange={(e) => { setInput(e.target.value); resize(); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
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
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.2"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>

          <p className="ct-note">
            {hasScope
              ? `Searching ${scopeLabel} — shared documents are used once. `
              : "Searching all your indexed sources. "}
            Enter to send · Shift+Enter for a new line.
          </p>
        </div>
      </div>
    </div>
  );
}