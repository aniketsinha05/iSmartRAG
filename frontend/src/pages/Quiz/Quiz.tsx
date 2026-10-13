import { useCallback, useEffect, useState } from "react";
import type {
  Classroom,
  QuizAttemptSummary,
  QuizQuestion,
  QuizSettings,
} from "../../types";
import { fetchClassrooms } from "../../services/classroomService";
import {
  fetchQuizAttempt,
  fetchQuizAttempts,
  generateQuiz,
  saveQuizAttempt,
} from "../../services/quizService";
import QuizSetup from "./QuizSetup";
import QuizPlayer from "./QuizPlayer";
import QuizResult from "./QuizResult";
import RecentAttempts from "./RecentAttempts";
import { errorText, formatDate } from "./quizUtils";

type View = "setup" | "playing" | "result";
type SaveState = "saving" | "saved" | "failed" | "none";

export default function Quiz({ sourceCount }: { sourceCount: number }) {
  const [view, setView] = useState<View>("setup");
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [attempts, setAttempts] = useState<QuizAttemptSummary[]>([]);
  const [settings, setSettings] = useState<QuizSettings | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [resultTitle, setResultTitle] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("none");
  const [round, setRound] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");

  const refreshAttempts = useCallback(async () => {
    try {
      setAttempts(await fetchQuizAttempts());
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    refreshAttempts();
    fetchClassrooms()
      .then(setClassrooms)
      .catch((err) => {
        console.error(err);
        setLoadError("Could not load classrooms. Is the backend running?");
      });
  }, [refreshAttempts]);

  const generate = async (s: QuizSettings) => {
    setGenerating(true);
    setError("");
    try {
      const qs = await generateQuiz(s);
      setSettings(s);
      setQuestions(qs);
      setReviewing(false);
      setRound((r) => r + 1);
      setView("playing");
    } catch (err) {
      console.error(err);
      setError(errorText(err, "Could not generate the quiz. Is the backend running?"));
    } finally {
      setGenerating(false);
    }
  };

  const finish = async (given: (number | null)[]) => {
    if (!settings) return;
    setAnswers(given);
    setResultTitle(classrooms.find((c) => c.id === settings.classroomId)?.name ?? "Quiz");
    setSaveState("saving");
    setView("result");
    try {
      await saveQuizAttempt(settings, questions, given);
      setSaveState("saved");
      refreshAttempts();
    } catch (err) {
      console.error(err);
      setSaveState("failed");
    }
  };

  const review = async (id: string) => {
    setOpening(true);
    setError("");
    try {
      const a = await fetchQuizAttempt(id);
      setQuestions(a.questions);
      setAnswers(a.answers);
      setResultTitle(`${a.classroomName} \u00B7 ${formatDate(a.createdAt)}`);
      setSaveState("none");
      setReviewing(true);
      setView("result");
    } catch (err) {
      console.error(err);
      setError(errorText(err, "Could not open this attempt."));
    } finally {
      setOpening(false);
    }
  };

  const retry = () => {
    setAnswers([]);
    setRound((r) => r + 1);
    setView("playing");
  };

  const newQuiz = () => {
    setError("");
    setView("setup");
  };

  const best = attempts.reduce<QuizAttemptSummary | null>(
    (b, a) => (b === null || a.score > b.score ? a : b),
    null
  );
  const lastFive = attempts.slice(0, 5);
  const average = lastFive.length
    ? Math.round(lastFive.reduce((sum, a) => sum + a.score, 0) / lastFive.length)
    : null;

  return (
    <div className="page-content sx-page qz-page">
      <div className="sx-header">
        <div className="sx-header-icon">{"\uD83E\uDDE0"}</div>
        <div>
          <h1>Quiz</h1>
          <p>
            Test yourself on the material in your knowledge base. Generate
            AI-powered quizzes from your classroom documents.
          </p>
        </div>
      </div>

      <div className="qz-stats">
        <div className="kb-stat">
          <div className="kb-stat-icon">{"\uD83D\uDCC4"}</div>
          <div>
            <span>Sources available</span>
            <strong>{sourceCount}</strong>
            <small>Documents and websites</small>
          </div>
        </div>
        <div className="kb-stat">
          <div className="kb-stat-icon">{"\u2705"}</div>
          <div>
            <span>Quizzes completed</span>
            <strong>{attempts.length}</strong>
            <small>Across all classrooms</small>
          </div>
        </div>
        <div className="kb-stat">
          <div className="kb-stat-icon">{"\uD83C\uDFC6"}</div>
          <div>
            <span>Best score</span>
            <strong>{best ? `${best.score}%` : "\u2014"}</strong>
            <small>{best ? best.classroomName : "Take a quiz to set one"}</small>
          </div>
        </div>
        <div className="kb-stat">
          <div className="kb-stat-icon">{"\uD83D\uDCCA"}</div>
          <div>
            <span>Average score</span>
            <strong>{average !== null ? `${average}%` : "\u2014"}</strong>
            <small>Last 5 attempts</small>
          </div>
        </div>
      </div>

      {loadError && <p className="hm-error">{loadError}</p>}

      <div className="qz-layout">
        <div className="qz-col">
          <QuizSetup
            classrooms={classrooms}
            busy={generating}
            error={error}
            onGenerate={generate}
          />
          <RecentAttempts attempts={attempts} busy={opening} onReview={review} />
        </div>

        <div className="qz-col">
          {view === "setup" && (
            <section className="sx-card qz-status">
              {generating ? (
                <>
                  <h3>Generating your quiz...</h3>
                  <p>This takes about 5-10 seconds.</p>
                </>
              ) : (
                <>
                  <h3>Your quiz will appear here</h3>
                  <p>
                    Choose a classroom and settings on the left, then press
                    Generate Quiz.
                  </p>
                </>
              )}
            </section>
          )}

          {view === "playing" && (
            <QuizPlayer key={round} questions={questions} onFinish={finish} />
          )}

          {view === "result" && (
            <QuizResult
              questions={questions}
              answers={answers}
              title={resultTitle}
              saveState={saveState}
              onRetry={reviewing ? undefined : retry}
              onNew={newQuiz}
              newLabel={reviewing ? "Back" : "New quiz"}
            />
          )}
        </div>
      </div>
    </div>
  );
}