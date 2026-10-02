import Stat from "../../components/common/Stat";

type StatsGridProps = {
  sourceCount: number;
  questionCount: number;
  quizCount: number;
};

export default function StatsGrid({
  sourceCount,
  questionCount,
  quizCount,
}: StatsGridProps) {
  return (
    <div className="stats-grid">
      <Stat number={String(sourceCount)} label="Sources" icon="📄" />

      <Stat
        number={String(questionCount)}
        label="Questions Asked"
        icon="💬"
      />

      <Stat
        number={String(quizCount)}
        label="Quizzes Completed"
        icon="✓"
      />

      <Stat number="0" label="Study Sessions" icon="🧠" />
    </div>
  );
}