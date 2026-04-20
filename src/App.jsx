import { Routes, Route, Navigate } from "react-router-dom";
import Scenarios from "./pages/Scenarios";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/scenarios" replace />} />
      <Route path="/scenarios" element={<Scenarios />} />
      <Route path="/scenarios/:id" element={<Scenarios />} />
    </Routes>
  );
}
