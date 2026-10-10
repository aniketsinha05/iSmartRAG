import { useState } from "react";
import type { Page, Source } from "./types";

import DashboardPage from "./pages/Dashboard/Dashboard";
import KnowledgeBasePage from "./pages/KnowledgeBase/KnowledgeBase";
import AppShell from "./components/layout/AppShell";
import Chat from "./pages/Chat/Chat";
import Quiz from "./pages/Quiz/Quiz";
import Settings from "./pages/Settings/Settings";

import "./App.css";

function App() {
  const [page, setPage] = useState<Page>("Dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [questionCount, setQuestionCount] = useState(0);
  const [quizCount] = useState(0);

  return (
    <AppShell
      page={page}
      setPage={setPage}
      mobileOpen={mobileOpen}
      setMobileOpen={setMobileOpen}
    >
      {page === "Dashboard" && (
        <DashboardPage
          setPage={setPage}
          sourceCount={sources.length}
          questionCount={questionCount}
          quizCount={quizCount}
        />
      )}

      {page === "Knowledge Base" && (
        <KnowledgeBasePage
          sources={sources}
          setSources={setSources}
        />
      )}

      {page === "Chat" && (
        <Chat setQuestionCount={setQuestionCount} />
      )}

      {page === "Quiz" && (
        <Quiz quizCount={quizCount} />
      )}

            {page === "Settings" && <Settings sourceCount={sources.length} />}
    </AppShell>
  );
}

export default App;