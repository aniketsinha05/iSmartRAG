import { useState } from "react";
import type { QuizQuestion } from "../../types";
import { LETTERS, sourceLabel } from "./quizUtils";

type Props = {
  questions: QuizQuestion[];
  onFinish: (answers: (number | null)[]) => void;
};

function optionClass(i: number, picked: number | null, answerIndex: number) {
  if (picked === null) return "qz-option";
  if (i === answerIndex) return "qz-option qz-correct";
  if (i === picked) return "qz-option qz-wrong";
  return "qz-option qz-dim";
}

export default function QuizPlayer({ questions, onFinish }: Props) {
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

  return (
    <section className="sx-card">
      <div className="qz-field-head">
        <h3>
          Question {index + 1} of {questions.length}
        </h3>
        <span className="sx-hint">{q.type === "tf" ? "True / False" : "Multiple choice"}</span>
      </div>

      <div className="qz-bar">
        <div
          className="qz-bar-fill"
          style={{ width: `${(done / questions.length) * 100}%` }}
        />
      </div>

      <strong>{q.question}</strong>

      {q.options.map((option, i) => (
        <button
          key={i}
          type="button"
          disabled={answered}
          className={optionClass(i, picked, q.answerIndex)}
          onClick={() => pick(i)}
        >
          <span className="qz-letter">{LETTERS[i]}.</span>
          <span>{option}</span>
        </button>
      ))}

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
        <button type="button" className="hm-primary" disabled={!answered} onClick={next}>
          {isLast ? "Finish quiz" : "Next question"}
        </button>
      </div>
    </section>
  );
}