import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { WatchlistPage } from "./pages/WatchlistPage";
import { ProfitabilityPage } from "./pages/ProfitabilityPage";
import { ConversionsPage } from "./pages/ConversionsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ChatPage } from "./pages/ChatPage";
import { MozAnalyticsPage } from "./pages/MozAnalyticsPage";
import { DomainDetailPage } from "./pages/DomainDetailPage";
import { AILinksPage } from "./pages/AILinksPage";
import { APIAnalyticsPage } from "./pages/AnalyticsPage";
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
        <Route path="/profitability" element={<ProfitabilityPage />} />
        <Route path="/conversions" element={<ConversionsPage />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/timeline" element={<TimelinePage />} />
        <Route path="/ai-links" element={<AILinksPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/watchlist" element={<WatchlistPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/api-analytics" element={<APIAnalyticsPage />} />
        <Route path="/moz-analytics" element={<MozAnalyticsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
