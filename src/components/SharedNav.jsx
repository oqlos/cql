import { Link } from "react-router-dom";

export default function SharedNav() {
  return (
    <nav className="nav">
      <Link to="/" className="nav-logo"><em>OqlOS</em> CQL</Link>
      <div className="nav-links">
        <Link to="/scenarios">Scenarios</Link>
        <span style={{ color: "var(--text-muted)", fontSize: 13 }}>CQL Editor v0.1.0</span>
      </div>
    </nav>
  );
}
