import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./index.css";

function Placeholder({ label }: { label: string }) {
  return <main className="p-6 text-slate-900">{label}</main>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Placeholder label="Snapwork: create room (Phase 3)" />} />
        <Route path="/r/:roomId" element={<Placeholder label="Room (Phase 3)" />} />
        <Route path="/i/:inviteToken" element={<Placeholder label="Claim (Phase 3)" />} />
        <Route path="*" element={<Placeholder label="Not found" />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
