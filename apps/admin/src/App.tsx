import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { io } from "socket.io-client";
import { toast } from "sonner";
import { LoginPage } from "./pages/LoginPage.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { PageantDetailPage } from "./pages/PageantDetailPage.js";
import { CategoriesPage } from "./pages/CategoriesPage.js";
import { CandidatesPage } from "./pages/CandidatesPage.js";
import { JudgesPage } from "./pages/JudgesPage.js";
import { LiveControlPage } from "./pages/LiveControlPage.js";
import { ResultsPage } from "./pages/ResultsPage.js";

const SOCKET_URL = window.location.origin;

function GlobalAssistanceNotifier() {
  useEffect(() => {
    const socket = io(SOCKET_URL);
    const handleAlert = (data: { judgeName: string; judgeId: string }) => {
      toast.warning(`🚨 Assistance Requested`, {
        id: `assistance-${data.judgeId}`,
        description: `Judge "${data.judgeName}" is requesting assistance!`,
        position: "bottom-left",
        duration: 3000,
      });
    };

    socket.on("judge:assistance-alert", handleAlert);

    return () => {
      socket.off("judge:assistance-alert", handleAlert);
      socket.disconnect();
    };
  }, []);

  return null;
}

export default function App() {
  return (
    <>
      <GlobalAssistanceNotifier />
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/pageants/:id" element={<PageantDetailPage />} />
        <Route path="/pageants/:id/categories" element={<CategoriesPage />} />
        <Route path="/pageants/:id/candidates" element={<CandidatesPage />} />
        <Route path="/pageants/:id/judges" element={<JudgesPage />} />
        <Route path="/pageants/:id/live" element={<LiveControlPage />} />
        <Route path="/pageants/:id/results" element={<ResultsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
