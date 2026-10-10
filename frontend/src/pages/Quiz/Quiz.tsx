import type { Page } from "../../types";

const STEPS = [
  {
    title: "Choose your material",
    text: "Pick the documents and websites you want to be tested on.",
  },
  {
    title: "Answer questions",
    text: "Work through multiple-choice questions generated from your sources.",
  },
  {
    title: "Review your score",
    text: "See what you got right, with a short explanation for each answer.",
  },
];

export default function Quiz({
  quizCount,
  sourceCount = 0,
  setPage,
}: {
  quizCount: number;
  sourceCount?: number;
  setPage?: (page: Page) => void;
}) {
  const hasSources = sourceCount > 0;

  return (
    <div className="page-content sx-page qz-page">
      <div className="sx-header">
        <div className="sx-header-icon">{"\uD83E\uDDE0"}</div>
        <div>
          <h1>Quiz</h1>
          <p>Test yourself on the material in your knowledge base.</p>
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
            <strong>{quizCount}</strong>
            <small>This session</small>
          </div>
        </div>

        <div className="kb-stat">
          <div className="kb-stat-icon">{"\uD83C\uDFC6"}</div>
          <div>
            <span>Best score</span>
            <strong>{"\u2014"}</strong>
            <small>Take a quiz to set one</small>
          </div>
        </div>
      </div>

      <div className="qz-grid">
        <section className="sx-card">
          <div className="sx-card-head">
            <div className="sx-card-icon">{"\uD83D\uDCCB"}</div>
            <div>
              <h3>How it works</h3>
              <p>Three steps from your sources to a score.</p>
            </div>
          </div>

          {STEPS.map((step, index) => (
            <div className="qz-step" key={step.title}>
              <span className="qz-num">{index + 1}</span>
              <div>
                <strong>{step.title}</strong>
                <span className="sx-hint">{step.text}</span>
              </div>
            </div>
          ))}
        </section>

        <section className="sx-card qz-status">
          <span className="sx-pill">Not available yet</span>

          <h3>Quiz generation isn't connected yet</h3>

          <p>
            {hasSources
              ? "Your sources are indexed and ready. Quizzes will appear here once generation is connected to the backend."
              : "Add at least one document or website first, so there is something to build questions from."}
          </p>

          {setPage && (
            <button
              type="button"
              className="hm-primary"
              onClick={() => setPage(hasSources ? "Knowledge Base" : "Dashboard")}
            >
              {hasSources ? "View knowledge base" : "Add a source"}
            </button>
          )}
        </section>
      </div>
    </div>
  );
}