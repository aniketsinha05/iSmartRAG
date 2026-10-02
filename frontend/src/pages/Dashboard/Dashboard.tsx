import type { Page } from "../../types";
import HeroBanner from "./HeroBanner";
import StatsGrid from "./StatsGrid";
import FeatureGrid from "./FeatureGrid";
import RecentActivity from "./RecentActivity";

type DashboardProps = {
  setPage: (page: Page) => void;
  sourceCount: number;
  questionCount: number;
  quizCount: number;
};

export default function Dashboard({
  setPage,
  sourceCount,
  questionCount,
  quizCount,
}: DashboardProps) {
  return (
    <div className="page-content">
      <HeroBanner setPage={setPage} />

      <StatsGrid
        sourceCount={sourceCount}
        questionCount={questionCount}
        quizCount={quizCount}
      />

      <FeatureGrid setPage={setPage} />

      <RecentActivity />
    </div>
  );
}