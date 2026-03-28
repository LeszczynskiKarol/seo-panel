import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { WatchlistPage } from "./pages/WatchlistPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DomainDetailPage } from "./pages/DomainDetailPage";
import { AlertsPage } from "./pages/AlertsPage";
import { InsightsPage } from "./pages/InsightsPage";
import { TimelinePage } from "./pages/TimelinePage";
import { LoginPage } from "./pages/LoginPage";
import { isAuthenticated } from "./lib/auth";

export default function App() {
  const [authed, setAuthed] = useState(isAuthenticated());

  if (!authed) {
    return <LoginPage onLogin={() => setAuthed(true)} />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="/domains/:id" element={<DomainDetailPage />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/timeline" element={<TimelinePage />} />
        <Route path="/watchlist" element={<WatchlistPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
