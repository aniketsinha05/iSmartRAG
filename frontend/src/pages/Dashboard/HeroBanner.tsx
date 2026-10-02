import type { Page } from "../../types";

type HeroBannerProps = {
  setPage: (page: Page) => void;
};

export default function HeroBanner({ setPage }: HeroBannerProps) {
  return (
    <section className="hero-banner">
      <div className="hero-content">
        <span className="hero-label">YOUR AI STUDY ASSISTANT</span>

        <h1>Study smarter with iSmartRAG</h1>

        <p>
          Upload your study material, ask questions and test your
          knowledge using your own personalized knowledge base.
        </p>

        <button
          className="hero-btn"
          onClick={() => setPage("Knowledge Base")}
        >
          Build Knowledge Base →
        </button>
      </div>

      <div className="hero-decoration">
        <div className="floating-card card-one">📚</div>
        <div className="floating-card card-two">💡</div>
        <div className="hero-orb">AI</div>
      </div>
    </section>
  );
}