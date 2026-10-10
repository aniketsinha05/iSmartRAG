import { useCallback, useEffect, useState } from "react";
import type { Page, Source } from "./types";

import DashboardPage from "./pages/Dashboard/Dashboard";
import KnowledgeBasePage from "./pages/KnowledgeBase/KnowledgeBase";
import AppShell from "./components/layout/AppShell";
import Chat from "./pages/Chat/Chat";
import Quiz from "./pages/Quiz/Quiz";
import Settings from "./pages/Settings/Settings";

import "./App.css";
import "./theme.css";
import { fetchSources } from "./services/sourcesService";

// Each page has a URL hash so a refresh (or Back/Forward) keeps you on it.
const SLUGS: Record<Page, string> = {
  Dashboard: "home",
  "Knowledge Base": "knowledge-base",
  Chat: "chat",
  Quiz: "quiz",
  Settings: "settings",
};

function pageFromHash(): Page {
  const slug = window.location.hash.replace(/^#\/?/, "");
  return (Object.keys(SLUGS) as Page[]).find((p) => SLUGS[p] === slug) ?? "Dashboard";
}

function App() {
  const [page, setPageState] = useState<Page>(pageFromHash);

  const setPage = useCallback((next: Page) => {
    window.location.hash = `/${SLUGS[next]}`;
  }, []);

  useEffect(() => {
    const onHashChange = () => setPageState(pageFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  // Sidebar starts open on desktop and closed on small screens.
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

      {page === "Chat" && <Chat setQuestionCount={setQuestionCount} />}

      {page === "Quiz" && <Quiz quizCount={quizCount} sourceCount={sources.length} setPage={setPage} />}

      {page === "Settings" && <Settings sourceCount={sources.length} />}
    </AppShell>
  );
}

export default App;