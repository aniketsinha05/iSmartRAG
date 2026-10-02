export default function Quiz({ quizCount }: { quizCount: number }) {
  return (
    <div className="page-content">
      <div className="quiz-start">
        <div className="quiz-icon-large">🧠</div>

        <span className="hero-label">KNOWLEDGE CHECK</span>

        <h1>Test your knowledge</h1>

        <p>
          Quiz questions will be generated from your
          knowledge base once the RAG system is connected.
        </p>

        <div className="quiz-options">
          <div>
            <span>Questions</span>
            <strong>0</strong>
          </div>

          <div>
            <span>Completed</span>
            <strong>{quizCount}</strong>
          </div>

          <div>
            <span>Source</span>
            <strong>Knowledge Base</strong>
          </div>
        </div>

        <button
          className="primary-btn quiz-start-btn"
          disabled
        >
          Quiz Not Ready Yet
        </button>
      </div>
    </div>
  );
}