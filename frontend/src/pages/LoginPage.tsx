// frontend/src/pages/LoginPage.tsx

import { useState } from "react";
import { setToken } from "../lib/auth";
import { api } from "../lib/api";
import { Activity } from "lucide-react";

export function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.login(login, password);
      if (res.token) {
        setToken(res.token);
        onLogin();
      } else {
        setError(res.error || "Login failed");
      }
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-panel-bg flex items-center justify-center">
      <div className="bg-panel-card border border-panel-border rounded-lg p-8 w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-8 h-8 rounded-md bg-accent-blue/20 flex items-center justify-center">
            <Activity className="w-4 h-4 text-accent-blue" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight">SEO Panel</div>
            <div className="text-[10px] text-panel-muted font-mono uppercase tracking-widest">
              Command Center
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-panel-muted block mb-1">Login</label>
            <input
              className="input w-full"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs text-panel-muted block mb-1">Hasło</label>
            <input
              className="input w-full"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <div className="text-xs text-accent-red">{error}</div>}
          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
          >
            {loading ? "Logowanie..." : "Zaloguj"}
          </button>
        </form>
      </div>
    </div>
  );
}
