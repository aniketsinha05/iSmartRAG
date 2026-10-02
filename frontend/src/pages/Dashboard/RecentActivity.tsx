export default function RecentActivity() {
  return (
    <section className="section-block">
      <div className="section-heading">
        <div>
          <h2>Recent Activity</h2>
          <p>Your latest learning activity.</p>
        </div>
      </div>

      <div className="activity-card">
        <div className="empty-state">
          <div>📭</div>

          <h3>No activity yet</h3>

          <p>
            Your uploaded sources, questions and quiz activity will
            appear here.
          </p>
        </div>
      </div>
    </section>
  );
}