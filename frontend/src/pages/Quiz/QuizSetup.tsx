import { useEffect, useState } from "react";
import type { Classroom, QuizDifficulty, QuizSettings, Source } from "../../types";
import { fetchClassroomDocuments } from "../../services/classroomService";

const DIFFICULTIES: QuizDifficulty[] = ["easy", "medium", "hard"];
const COUNTS: (5 | 10)[] = [5, 10];

type Props = {
  classrooms: Classroom[];
  busy: boolean;
  error: string;
  onGenerate: (settings: QuizSettings) => void;
};

export default function QuizSetup({ classrooms, busy, error, onGenerate }: Props) {
  const [classroomId, setClassroomId] = useState<number | null>(null);
  const [docs, setDocs] = useState<Source[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
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

  const toggleDoc = (name: string) =>
    setSelected((cur) =>
      cur.includes(name) ? cur.filter((n) => n !== name) : [...cur, name]
    );

  const canGenerate =
    activeId !== null && !docsLoading && docs.length > 0 && !busy;

  const generate = () => {
    if (activeId === null) return;
    onGenerate({
      classroomId: activeId,
      documentNames: selected,
      numQuestions,
      difficulty,
      includeTrueFalse,
    });
  };

  return (
    <section className="sx-card">
      <div className="sx-card-head">
        <div className="sx-card-icon">{"\u2699\uFE0F"}</div>
        <div>
          <h3>1. Quiz Setup</h3>
          <p>Choose your classroom, documents and quiz settings.</p>
        </div>
      </div>

      {classrooms.length === 0 ? (
        <div className="hm-empty">No classrooms found. Is the backend running?</div>
      ) : (
        <>
          <div className="qz-field">
            <strong>Select Classroom</strong>
            <select
              className="sx-select"
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
          </div>

          <div className="qz-field">
            <div className="qz-field-head">
              <strong>Select Documents (Optional)</strong>
              <span className="sx-hint">
                {selected.length === 0 ? "All documents" : `${selected.length} selected`}
              </span>
            </div>

            {docsLoading ? (
              <div className="hm-meta">Loading documents...</div>
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
              <div className="qz-docs">
                {docs.map((d) => (
                  <label key={d.name} className="qz-doc">
                    <input
                      type="checkbox"
                      checked={selected.includes(d.name)}
                      disabled={busy}
                      onChange={() => toggleDoc(d.name)}
                    />
                    <span>{d.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="qz-field">
            <strong>Number of Questions</strong>
            <div className="qz-seg">
              {COUNTS.map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={busy}
                  className={`hm-tab ${numQuestions === n ? "active" : ""}`}
                  onClick={() => setNumQuestions(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="qz-field">
            <strong>Difficulty</strong>
            <div className="qz-seg">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  type="button"
                  disabled={busy}
                  className={`hm-tab ${difficulty === d ? "active" : ""}`}
                  onClick={() => setDifficulty(d)}
                >
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="qz-field">
            <strong>Question Type</strong>
            <label className="qz-doc">
              <input
                type="checkbox"
                checked={includeTrueFalse}
                disabled={busy}
                onChange={(e) => setIncludeTrueFalse(e.target.checked)}
              />
              <span>Multiple choice, plus some True / False</span>
            </label>
          </div>

          {error && <p className="hm-error">{error}</p>}

          <button
            type="button"
            className="hm-primary"
            style={{ width: "100%", marginTop: 16 }}
            disabled={!canGenerate}
            onClick={generate}
          >
            {busy ? "Generating..." : "\u2728 Generate Quiz"}
          </button>
        </>
      )}
    </section>
  );
}