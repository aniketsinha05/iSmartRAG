import { useState } from "react";
import type { QuizAttemptSummary } from "../../types";
import { formatDate, scoreClass } from "./quizUtils";

type Props = {
  attempts: QuizAttemptSummary[];
  busy: boolean;
  onReview: (id: string) => void;
};

export default function RecentAttempts({ attempts, busy, onReview }: Props) {
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? attempts : attempts.slice(0, 5);

  return (
    <section className="sx-card">
      <div className="hm-head-row">
        <h3>Recent Attempts</h3>
        {attempts.length > 5 && (
          <button type="button" className="hm-link" onClick={() => setShowAll(!showAll)}>
            {showAll ? "Show less" : "View All"}
          </button>
        )}
      </div>

      {attempts.length === 0 ? (
        <div className="hm-empty">No attempts yet. Generate a quiz to get started.</div>
      ) : (
        <div className="kb-table-wrap">
          <table className="kb-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Classroom</th>
                <th>Questions</th>
                <th>Score</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td>{formatDate(a.createdAt)}</td>
                  <td>{a.classroomName}</td>
                  <td>{a.numQuestions}</td>
                  <td className={scoreClass(a.score)}>{a.score}%</td>
                  <td>
                    <button
                      type="button"
                      className="kb-action"
                      disabled={busy}
                      onClick={() => onReview(a.id)}
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}