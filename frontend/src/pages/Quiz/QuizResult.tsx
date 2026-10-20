import type { CSSProperties } from "react";
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
  const headline =
    percent >= 80 ? "Excellent work" : percent >= 60 ? "Good effort" : "Keep practising";

  return (
    <section className="qz-card">
      <div className="qz-result-top">
        <div
          className={`qz-ring ${scoreClass(percent)}`}
          style={{ "--pct": percent } as CSSProperties}
        >
          <span>{percent}%</span>
        </div>

        <div>
          <span className="qz-hint">{title}</span>
          <h2>{headline}</h2>
          <p>
            {correct} of {total} correct
          </p>
          {SAVE_TEXT[saveState] && <small className="hm-meta">{SAVE_TEXT[saveState]}</small>}
        </div>
      </div>

      <div className="qz-breakdown">
        <div>
          <strong>{correct}</strong>
          <span>Correct</span>
        </div>
        <div>
          <strong>{wrong.length}</strong>
          <span>To review</span>
        </div>
      </div>

      {wrong.length === 0 ? (
        <p>All answers correct. Nothing to review.</p>
      ) : (
        <>
          <h3>Review wrong answers</h3>
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
        {onRetry ? (
          <button type="button" className="sx-btn" onClick={onRetry}>
            Retry
          </button>
        ) : (
          <span />
        )}
        <button type="button" className="hm-primary" onClick={onNew}>
          {newLabel}
        </button>
      </div>
    </section>
  );
}