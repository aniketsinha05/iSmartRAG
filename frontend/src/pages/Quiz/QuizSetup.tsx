import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Classroom, QuizDifficulty, QuizSettings, Source } from "../../types";
import { fetchClassroomDocuments } from "../../services/classroomService";
import Icon from "../../components/common/Icon";

const DIFFICULTIES: { value: QuizDifficulty; label: string; hint: string }[] = [
  { value: "easy", label: "Easy", hint: "Recall key facts" },
  { value: "medium", label: "Medium", hint: "Apply what you know" },
  { value: "hard", label: "Hard", hint: "Analyse and compare" },
];
const COUNTS: (5 | 10)[] = [5, 10];

type Props = {
  classrooms: Classroom[];
  busy: boolean;
  error: string;
  onGenerate: (settings: QuizSettings) => void;
};

function Step({
  n,
  title,
  hint,
  children,
}: {
  n: number;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="qz-step">
      <span className="qz-step-num">{n}</span>
      <div className="qz-step-body">
        <div className="qz-step-head">
          <strong>{title}</strong>
          {hint && <span className="qz-hint">{hint}</span>}
        </div>
        {children}
      </div>
    </div>
  );
}

export default function QuizSetup({ classrooms, busy, error, onGenerate }: Props) {
  const [classroomId, setClassroomId] = useState<number | null>(null);
  const [docs, setDocs] = useState<Source[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [numQuestions, setNumQuestions] = useState<5 | 10>(5);
  const [difficulty, setDifficulty] = useState<QuizDifficulty>("medium");
  const [includeTrueFalse, setIncludeTrueFalse] = useState(false);

  const defaultId =
    (classrooms.find((c) => c.documentCount > 0) ?? classrooms[0])?.id ?? null;
  const activeId = classroomId ?? defaultId;

  useEffect(() => {
    if (activeId === null) return;
    let cancelled = false;
    setDocsLoading(true);
    setSelected([]);
    fetchClassroomDocuments(activeId)
      .then((data) => {
        if (!cancelled) setDocs(data.documents);
      })
      .catch(() => {
        if (!cancelled) setDocs([]);
      })
      .finally(() => {
        if (!cancelled) setDocsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  const toggleDoc = (id: number) =>
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((n) => n !== id) : [...cur, id]
    );

  const canGenerate =
    activeId !== null && !docsLoading && docs.length > 0 && !busy;

  const scopeCount = selected.length === 0 ? docs.length : selected.length;

  const generate = () => {
    if (activeId === null) return;
    onGenerate({
      classroomId: activeId,
      documentIds: selected,
      numQuestions,
      difficulty,
      includeTrueFalse,
    });
  };

  return (
    <section className="qz-card">
      <header className="qz-card-head">
        <h2>Create a quiz</h2>
        <p>Choose what to study, then how you want to be tested.</p>
      </header>

      {classrooms.length === 0 ? (
        <div className="hm-empty">
          No classrooms yet. Create one on the Classroom page first.
        </div>
      ) : (
        <>
          <Step n={1} title="Classroom" hint="Where the questions come from">
            <select
              className="sx-select full"
              value={activeId ?? ""}
              disabled={busy}
              onChange={(e) => setClassroomId(Number(e.target.value))}
            >
              {classrooms.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.documentCount} docs)
                </option>
              ))}
            </select>
          </Step>

          <Step
            n={2}
            title="Documents"
            hint={selected.length === 0 ? "All documents (default)" : `${selected.length} selected`}
          >
            {docsLoading ? (
              <span className="qz-hint">Loading documents...</span>
            ) : docs.length === 0 ? (
              <div className="hm-empty">
                This classroom has no documents yet.
                <br />
                <button
                  type="button"
                  className="hm-link"
                  onClick={() => {
                    window.location.hash = `/classroom/${activeId}`;
                  }}
                >
                  Open the classroom to add some
                </button>
              </div>
            ) : (
              <>
                <div className="qz-docs">
                  {docs.map((d) => (
                    <label
                      key={d.id}
                      className={`qz-doc ${selected.includes(d.id) ? "on" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={selected.includes(d.id)}
                        disabled={busy}
                        onChange={() => toggleDoc(d.id)}
                      />
                      <span>{d.name}</span>
                    </label>
                  ))}
                </div>
                {selected.length > 0 && (
                  <button type="button" className="hm-link qz-clear" onClick={() => setSelected([])}>
                    Clear selection
                  </button>
                )}
              </>
            )}
          </Step>

          <Step n={3} title="Difficulty">
            <div className="qz-choices">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  disabled={busy}
                  className={`qz-choice ${difficulty === d.value ? "active" : ""}`}
                  onClick={() => setDifficulty(d.value)}
                >
                  <strong>{d.label}</strong>
                  <span>{d.hint}</span>
                </button>
              ))}
            </div>
          </Step>

          <Step n={4} title="Length and style">
            <div className="qz-seg" role="group" aria-label="Number of questions">
              {COUNTS.map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={busy}
                  className={numQuestions === n ? "active" : ""}
                  onClick={() => setNumQuestions(n)}
                >
                  {n} questions
                </button>
              ))}
            </div>

            <label className="qz-doc">
              <input
                type="checkbox"
                checked={includeTrueFalse}
                disabled={busy}
                onChange={(e) => setIncludeTrueFalse(e.target.checked)}
              />
              <span>Mix in some true / false questions</span>
            </label>
          </Step>

          <footer className="qz-footer">
            <p className="qz-summary">
              {numQuestions} {difficulty} questions from {scopeCount} document
              {scopeCount === 1 ? "" : "s"}
              {includeTrueFalse ? ", including true / false" : ""}.
            </p>

            {error && <p className="hm-error">{error}</p>}

            <button
              type="button"
              className="hm-primary qz-generate"
              disabled={!canGenerate}
              onClick={generate}
            >
              {busy ? (
                "Generating..."
              ) : (
                <>
                  <Icon name="sparkle" size={16} />
                  Generate quiz
                </>
              )}
            </button>
          </footer>
        </>
      )}
    </section>
  );
}