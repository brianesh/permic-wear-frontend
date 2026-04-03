export default function StatCard({ label, value, change, up, sub, accent, icon }) {
  return (
    <div className="stat-card" style={{"--accent": accent}}>
      <div className="stat-card-top">
        <span className="stat-icon">{icon}</span>
        <span className={`stat-change ${up ? "stat-change--up" : "stat-change--down"}`}>{change}</span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-sub">{sub}</div>
      <div className="stat-bar">
        <div className="stat-bar-fill" style={{width: up?"72%":"38%"}} />
      </div>
    </div>
  );
}
