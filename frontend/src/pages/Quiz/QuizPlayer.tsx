import { useEffect, useState } from "react";
import type { QuizQuestion } from "../../types";
import Icon from "../../components/common/Icon";
import { LETTERS, sourceLabel } from "./quizUtils";

type Props = {
  questions: QuizQuestion[];
  onFinish: (answers: (number | null)[]) => void;
  onExit: () => void;
};

function optionClass(i: number, picked: number | null, answerIndex: number) {
  if (picked === null) return "qz-option";
  if (i === answerIndex) return "qz-option qz-correct";
  if (i === picked) return "qz-option qz-wrong";
  return "qz-option qz-dim";
}

export default function QuizPlayer({ questions, onFinish, onExit }: Props) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() =>
    questions.map(() => null)
  );

  const q = questions[index];
  const picked = answers[index];
  const answered = picked !== null;
  const isLast = index === questions.length - 1;
  const done = index + (answered ? 1 : 0);

  const pick = (option: number) => {
    if (answered) return;
    setAnswers((cur) => cur.map((a, i) => (i === index ? option : a)));
  };

  const next = () => {
    if (isLast) onFinish(answers);
    else setIndex(index + 1);
  };

  // Keyboard: A-D to answer, Enter / right arrow for next
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      const choice = ["a", "b", "c", "d"].indexOf(e.key.toLowerCase());
      if (choice >= 0 && choice < q.options.length) {
        pick(choice);
        return;
      }
      if (e.key === "Enter" && target.tagName === "BUTTON") return;
      if ((e.key === "Enter" || e.key === "ArrowRight") && answered) next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <section className="qz-card">
      <div className="qz-play-top">
        <button type="button" className="qz-ghost" onClick={onExit}>
          <Icon name="arrowLeft" size={16} />
          Exit quiz
        </button>
        <span className="qz-counter">
          Question {index + 1} of {questions.length}
        </span>
      </div>

      <div className="qz-bar">
        <div
          className="qz-bar-fill"
          style={{ width: `${(done / questions.length) * 100}%` }}
        />
      </div>

      <span className="qz-tag">
        {q.type === "tf" ? "True / False" : "Multiple choice"}
      </span>
      <h2 className="qz-question">{q.question}</h2>

      <div className="qz-options">
        {q.options.map((option, i) => (
          <button
            key={i}
            type="button"
            disabled={answered}
            className={optionClass(i, picked, q.answerIndex)}
            onClick={() => pick(i)}
          >
            <span className="qz-letter">{LETTERS[i]}</span>
            <span className="qz-option-text">{option}</span>
            {answered && i === q.answerIndex && <Icon name="check" size={18} />}
            {answered && i === picked && i !== q.answerIndex && (
              <Icon name="close" size={18} />
            )}
          </button>
        ))}
      </div>

      {answered && (
        <div className="qz-feedback">
          <strong className={picked === q.answerIndex ? "qz-good" : "qz-bad"}>
            {picked === q.answerIndex ? "Correct" : "Not quite"}
          </strong>
          {picked !== q.answerIndex && (
            <p>
              Correct answer: {LETTERS[q.answerIndex]}. {q.options[q.answerIndex]}
            </p>
          )}
          <p>{q.explanation}</p>
          <small>Source: {sourceLabel(q.source)}</small>
        </div>
      )}

      <div className="qz-actions">
        <span className="qz-keys">Press A to D to answer, Enter for next</span>
        <button type="button" className="hm-primary" disabled={!answered} onClick={next}>
          {isLast ? "Finish quiz" : "Next question"}
        </button>
      </div>
    </section>
  );
}