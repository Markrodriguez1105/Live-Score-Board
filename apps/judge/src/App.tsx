import { Routes, Route, Navigate } from "react-router-dom";
import { PinEntryPage } from "./pages/PinEntryPage.js";
import { ScoringPage } from "./pages/ScoringPage.js";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PinEntryPage />} />
      <Route path="/score" element={<ScoringPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
