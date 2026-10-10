import type { Page } from "../../types";

type FeatureProps = {
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
};

function Feature({
  icon,
  title,
  description,
  onClick,
}: FeatureProps) {
  return (
    <button className="feature-card" onClick={onClick}>
      <div className="feature-icon">{icon}</div>

      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>

      <span className="feature-arrow">→</span>
    </button>
  );
}

type FeatureGridProps = {
  setPage: (page: Page) => void;
};

export default function FeatureGrid({ setPage }: FeatureGridProps) {
  return (
    <section className="section-block">
      <div className="section-heading">
        <div>
          <h2>What would you like to do?</h2>
          <p>Choose a learning activity to get started.</p>
        </div>
      </div>

      <div className="feature-grid">
        <Feature
          icon="📚"
          title="Knowledge Base"
          description="Upload documents and add websites to your study collection."
          onClick={() => setPage("Knowledge Base")}
        />

        <Feature
          icon="✨"
          title="Ask MyBookAI"
          description="Ask questions and get answers from your study material."
          onClick={() => setPage("Chat")}
        />

        <Feature
          icon="🧠"
          title="Take a Quiz"
          description="Test yourself with questions based on your knowledge base."
          onClick={() => setPage("Quiz")}
        />
      </div>
    </section>
  );
}