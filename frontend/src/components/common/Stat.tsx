type StatProps = {
  number: string;
  label: string;
  icon: string;
};

export default function Stat({
  number,
  label,
  icon,
}: StatProps) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>

      <div>
        <strong>{number}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}