import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { DashboardPage } from "./pages/DashboardPage";
import { TimelinePage } from "./pages/TimelinePage";
import { InsightsPage } from "./pages/InsightsPage";
import { DomainDetailPage } from "./pages/DomainDetailPage";
import { AlertsPage } from "./pages/AlertsPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="/domains/:id" element={<DomainDetailPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/timeline" element={<TimelinePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
