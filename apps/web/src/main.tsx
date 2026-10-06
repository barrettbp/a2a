import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import { ClaimPage } from "./pages/ClaimPage";
import { CreatePage } from "./pages/CreatePage";
import { NotFoundPage } from "./pages/ErrorPage";
import { RoomPage } from "./pages/RoomPage";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CreatePage />} />
        <Route path="/r/:roomId" element={<RoomPage />} />
        <Route path="/i/:inviteToken" element={<ClaimPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
