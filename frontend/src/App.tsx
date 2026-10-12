import { useCallback, useEffect, useState } from "react";
import type { Page, Source } from "./types";

import DashboardPage from "./pages/Dashboard/Dashboard";
import KnowledgeBasePage from "./pages/KnowledgeBase/KnowledgeBase";
import AppShell from "./components/layout/AppShell";
import Chat from "./pages/Chat/Chat";
import Quiz from "./pages/Quiz/Quiz";
import Settings from "./pages/Settings/Settings";
import ClassroomPage from "./pages/Classroom/Classroom";
import ClassroomPicker from "./pages/Classroom/ClassroomPicker";

import "./App.css";
import "./theme.css";
import { fetchSources } from "./services/sourcesService";

const SLUGS: Record<Page, string> = {
  Dashboard: "home",
  "Knowledge Base": "knowledge-base",
  Chat: "chat",
  Quiz: "quiz",
  Settings: "settings",
  Classroom: "classroom",
};

// ── helpers ──────────────────────────────────────────────────────────────────

function classroomIdFromHash(): number | null {
  // only match /classroom/:id (not /classroom/:id/chat — that's the Chat page now)
  const match = window.location.hash.match(/^#\/classroom\/(\d+)(?!\/chat)/);
  const id = match ? Number(match[1]) : null;
  return id !== null && id >= 1 && id <= 5 ? id : null;
}

/** Pre-selected classroom IDs for the Chat page. */
function chatClassroomIdsFromHash(): number[] {
  const hash = window.location.hash;

  // /chat/cr/1,2,3
  const chatMatch = hash.match(/^#\/chat\/cr\/([0-9,]+)/);
  if (chatMatch) {
    return chatMatch[1]
      .split(",")
      .map(Number)
      .filter((n) => n >= 1 && n <= 5);
  }

  // Legacy /classroom/:id/chat  → treat as classroom pre-selected
  const crChatMatch = hash.match(/^#\/classroom\/(\d+)\/chat/);
  if (crChatMatch) {
    const id = Number(crChatMatch[1]);
    return id >= 1 && id <= 5 ? [id] : [];
  }

  return [];
}

function pageFromHash(): Page {
  const hash = window.location.hash;

  // /classroom/:id/chat → Chat page (classroom will be pre-selected)
  if (/^#\/classroom\/\d+\/chat/.test(hash)) return "Chat";

  // /chat or /chat/cr/...
  if (/^#\/chat/.test(hash)) return "Chat";

  if (classroomIdFromHash() !== null) return "Classroom";

  const slug = hash.replace(/^#\/?/, "").split("/")[0];
  return (
    (Object.keys(SLUGS) as Page[]).find((p) => SLUGS[p] === slug) ??
    "Dashboard"
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function App() {
  const [page, setPageState] = useState<Page>(pageFromHash);
  const [classroomId, setClassroomId] = useState<number | null>(
    classroomIdFromHash
  );
  const [chatClassroomIds, setChatClassroomIds] = useState<number[]>(
    chatClassroomIdsFromHash
  );

  const setPage = useCallback((next: Page) => {
    window.location.hash = `/${SLUGS[next]}`;
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      setPageState(pageFromHash());
      setClassroomId(classroomIdFromHash());
      setChatClassroomIds(chatClassroomIdsFromHash());
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const [collapsed, setCollapsed] = useState(() => window.innerWidth <= 900);
  const [sources, setSources] = useState<Source[]>([]);
  const [questionCount, setQuestionCount] = useState(0);
  const [quizCount] = useState(0);

  const refreshSources = useCallback(async () => {
    try {
      setSources(await fetchSources());
    } catch (error) {
      console.error("Could not load sources", error);
    }
  }, []);

  useEffect(() => {
    refreshSources();
  }, [refreshSources]);

  return (
    <AppShell
      page={page}
      setPage={setPage}
      collapsed={collapsed}
      setCollapsed={setCollapsed}
    >
      {page === "Dashboard" && (
        <DashboardPage
          setPage={setPage}
          sources={sources}
          setSources={setSources}
          questionCount={questionCount}
          setQuestionCount={setQuestionCount}
        />
      )}

      {page === "Knowledge Base" && (
        <KnowledgeBasePage
          sources={sources}
          refreshSources={refreshSources}
          setPage={setPage}
        />
      )}

      {page === "Chat" && (
        <Chat
          setQuestionCount={setQuestionCount}
          initialClassroomIds={chatClassroomIds}
        />
      )}

      {page === "Quiz" && (
        <Quiz
          quizCount={quizCount}
          sourceCount={sources.length}
          setPage={setPage}
        />
      )}

      {page === "Settings" && <Settings sourceCount={sources.length} />}

      {page === "Classroom" && classroomId === null && (
        <ClassroomPicker sources={sources} refreshSources={refreshSources} />
      )}

      {page === "Classroom" && classroomId !== null && (
        <ClassroomPage
          key={classroomId}
          classroomId={classroomId}
          sources={sources}
          refreshSources={refreshSources}
          setPage={setPage}
          setQuestionCount={setQuestionCount}
        />
      )}
    </AppShell>
  );
}

export default App;