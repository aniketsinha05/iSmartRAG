import type { QuizQuestion } from "../../types";
import { LETTERS, percentOf, scoreClass, sourceLabel } from "./quizUtils";

type Props = {
  questions: QuizQuestion[];
  answers: (number | null)[];
  title: string;
  saveState: "saving" | "saved" | "failed" | "none";
  onRetry?: () => void;
  onNew: () => void;
  newLabel: string;
};

const SAVE_TEXT = {
  saving: "Saving your attempt...",
  saved: "Attempt saved.",
  failed: "Could not save this attempt. The score above is still correct.",
  none: "",
};

export default function QuizResult({
  questions,
  answers,
  title,
  saveState,
  onRetry,
  onNew,
  newLabel,
}: Props) {
  const total = questions.length;
  const wrong = questions
    .map((q, i) => ({ q, i, a: answers[i] ?? null }))
    .filter(({ q, a }) => a !== q.answerIndex);
  const correct = total - wrong.length;
  const percent = percentOf(correct, total);

  return (
    <section className="sx-card">
      <span className="sx-hint">{title}</span>
      <div className={`qz-score ${scoreClass(percent)}`}>{percent}%</div>
      <p>
        {correct} of {total} correct
      </p>
      {SAVE_TEXT[saveState] && <small className="hm-meta">{SAVE_TEXT[saveState]}</small>}

      {wrong.length === 0 ? (
        <p>All answers correct. Nothing to review.</p>
      ) : (
        <>
          <h3 style={{ marginTop: 16 }}>Review wrong answers ({wrong.length})</h3>
          {wrong.map(({ q, i, a }) => (
            <div className="qz-review" key={q.id}>
              <strong>
                {i + 1}. {q.question}
              </strong>
              <p className="qz-bad">
                Your answer: {a === null ? "Skipped" : `${LETTERS[a]}. ${q.options[a]}`}
              </p>
              <p className="qz-good">
                Correct: {LETTERS[q.answerIndex]}. {q.options[q.answerIndex]}
              </p>
              <p>{q.explanation}</p>
              <small>Source: {sourceLabel(q.source)}</small>
            </div>
          ))}
        </>
      )}

      <div className="qz-actions">
        {onRetry && (
          <button type="button" className="sx-btn" onClick={onRetry}>
            Retry
          </button>
        )}
        <button type="button" className="hm-primary" onClick={onNew}>
          {newLabel}
        </button>
      </div>
    </section>
  );
}