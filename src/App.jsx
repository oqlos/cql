import { Routes, Route, Navigate } from "react-router-dom";
import Scenarios from "./pages/Scenarios";
import LibraryEditor from "./pages/LibraryEditor";
import EditorPlaceholder from "./pages/EditorPlaceholder";
import MapEditor from "./pages/MapEditor";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/scenarios" replace />} />
      {/* Primary route — matches www pattern (cql.oqlos.localhost/scenarios). */}
      <Route path="/scenarios" element={<Scenarios />} />
      <Route path="/scenarios/:id" element={<Scenarios />} />

      {/* DSL-family editors — iframe targets from maskservice
          /connect-scenario/{dsl,func,library,map,scenario}-editor pages. */}
      <Route path="/dsl-editor" element={<EditorPlaceholder kind="dsl-editor" />} />
      <Route path="/func-editor" element={<EditorPlaceholder kind="func-editor" />} />
      <Route path="/library-editor" element={<LibraryEditor />} />
      <Route path="/map-editor" element={<MapEditor />} />
      <Route path="/scenario-editor" element={<EditorPlaceholder kind="scenario-editor" />} />
      <Route path="/operator-parameters" element={<EditorPlaceholder kind="operator-parameters" />} />

      {/* Backwards compatible alias for iframe embeds using the old path. */}
      <Route path="/connect-scenario/scenarios" element={<Scenarios />} />
      <Route path="/connect-scenario/scenarios/:id" element={<Scenarios />} />
      <Route path="/connect-scenario/dsl-editor" element={<EditorPlaceholder kind="dsl-editor" />} />
      <Route path="/connect-scenario/func-editor" element={<EditorPlaceholder kind="func-editor" />} />
      <Route path="/connect-scenario/library-editor" element={<LibraryEditor />} />
      <Route path="/connect-scenario/map-editor" element={<MapEditor />} />
      <Route path="/connect-scenario/scenario-editor" element={<EditorPlaceholder kind="scenario-editor" />} />
    </Routes>
  );
}
