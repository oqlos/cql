import { Routes, Route, Navigate } from "react-router-dom";
import Scenarios from "./pages/Scenarios";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/connect-scenario/scenarios" replace />} />
      {/* Primary route — mirrors the maskservice path so the iframe URL is identical. */}
      <Route path="/connect-scenario/scenarios" element={<Scenarios />} />
      <Route path="/connect-scenario/scenarios/:id" element={<Scenarios />} />
      {/* Backwards compatible aliases. */}
      <Route path="/scenarios" element={<Scenarios />} />
      <Route path="/scenarios/:id" element={<Scenarios />} />
    </Routes>
  );
}
