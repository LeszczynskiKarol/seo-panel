import { getToken, clearToken } from "./auth";

const BASE = "/api";

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body) headers["Content-Type"] = "application/json";

  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { ...headers, ...opts.headers },
  });

  if (res.status === 401) {
    clearToken();
    window.location.reload();
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const err = await res.text().catch(() => "Request failed");
    throw new Error(err);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  // Overview
  getOverview: () => request<any>("/overview"),
  getAlerts: (params?: string) =>
    request<any[]>(`/alerts${params ? `?${params}` : ""}`),
  resolveAlert: (id: string) =>
    request<any>(`/alerts/${id}/resolve`, { method: "PATCH" }),

  // Domains
  getDomains: () => request<any[]>("/domains"),
  getDomain: (id: string) => request<any>(`/domains/${id}`),
  addDomain: (data: any) =>
    request<any>("/domains", { method: "POST", body: JSON.stringify(data) }),
  deleteDomain: (id: string) =>
    request<void>(`/domains/${id}`, { method: "DELETE" }),

  // Domain pages
  getDomainPages: (id: string, params?: string) =>
    request<{ pages: any[]; total: number }>(
      `/domains/${id}/pages${params ? `?${params}` : ""}`,
    ),
  getPageDetail: (domainId: string, pageId: string) =>
    request<any>(`/domains/${domainId}/pages/${pageId}`),
  getOrphanPages: (id: string) => request<any[]>(`/domains/${id}/orphan-pages`),
  getBrokenLinks: (id: string) => request<any[]>(`/domains/${id}/broken-links`),
  getQueries: (id: string, params?: string) =>
    request<any[]>(`/domains/${id}/queries${params ? `?${params}` : ""}`),

  // Actions
  syncSitemap: (id: string) =>
    request<any>(`/domains/${id}/sync-sitemap`, { method: "POST" }),
  pullGsc: (id: string, data?: any) =>
    request<any>(`/domains/${id}/pull-gsc`, {
      method: "POST",
      body: JSON.stringify(data || {}),
    }),
  checkIndexing: (id: string) =>
    request<any>(`/domains/${id}/check-indexing`, { method: "POST" }),
  crawlLinks: (id: string) =>
    request<any>(`/domains/${id}/crawl-links`, { method: "POST" }),

  // Bulk
  syncAllSitemaps: () => request<any>("/sync-all-sitemaps", { method: "POST" }),
  pullAllGsc: (days = 3) =>
    request<any>("/pull-all-gsc", {
      method: "POST",
      body: JSON.stringify({ days }),
    }),

  // Analytics
  getQuickWins: (domainId?: string) =>
    request<any[]>(
      `/analytics/quick-wins${domainId ? `?domainId=${domainId}` : ""}`,
    ),
  getContentGaps: (domainId?: string) =>
    request<any[]>(
      `/analytics/content-gaps${domainId ? `?domainId=${domainId}` : ""}`,
    ),
  getCannibalization: (domainId: string) =>
    request<any[]>(`/analytics/cannibalization/${domainId}`),
  getCrossDomainLinks: () => request<any[]>("/analytics/cross-domain-links"),
  getIndexingVelocity: (domainId?: string) =>
    request<any>(
      `/analytics/indexing-velocity${domainId ? `?domainId=${domainId}` : ""}`,
    ),
  getDomainHealth: (domainId: string) =>
    request<any>(`/analytics/health/${domainId}`),
  getPositionMovers: (domainId: string) =>
    request<any>(`/analytics/movers/${domainId}`),
  getStalePages: (domainId?: string) =>
    request<any[]>(
      `/analytics/stale-pages${domainId ? `?domainId=${domainId}` : ""}`,
    ),
  // Timeline
  getDomainTimeline: (domainId: string, limit = 100) =>
    request<any[]>(`/timeline/domain/${domainId}?limit=${limit}`),
  getPageHistory: (pageId: string) => request<any>(`/timeline/page/${pageId}`),
  getDomainBacklinks: (domainId: string) =>
    request<any>(`/timeline/backlinks/${domainId}`),
  syncBacklinks: (domainId: string) =>
    request<any>(`/timeline/sync-backlinks/${domainId}`, { method: "POST" }),
  detectChanges: () => request<any>("/timeline/detect-all", { method: "POST" }),

  // Auth
  login: (login: string, password: string) =>
    fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, password }),
    }).then((r) => r.json()),

  // Tracked
  toggleTracked: (domainId: string, pageId: string) =>
    request<any>(`/domains/${domainId}/pages/${pageId}/track`, {
      method: "PATCH",
    }),
  getTrackedPages: (domainId: string, days = 30) =>
    request<any[]>(`/domains/${domainId}/tracked?days=${days}`),

  trackUrl: (domainId: string, url: string) =>
    request<any>(`/domains/${domainId}/track-url`, {
      method: "POST",
      body: JSON.stringify({ url }),
    }),
  untrackPage: (domainId: string, pageId: string) =>
    request<any>(`/domains/${domainId}/pages/${pageId}/track`, {
      method: "DELETE",
    }),

  addKeyword: (domainId: string, pageId: string, keyword: string) =>
    request<any>(`/domains/${domainId}/pages/${pageId}/keywords`, {
      method: "POST",
      body: JSON.stringify({ keyword }),
    }),
  removeKeyword: (domainId: string, pageId: string, kwId: string) =>
    request<void>(`/domains/${domainId}/pages/${pageId}/keywords/${kwId}`, {
      method: "DELETE",
    }),
  checkKeywords: (domainId: string) =>
    request<any>(`/domains/${domainId}/check-keywords`, { method: "POST" }),

  // Watchlist
  getWatchlist: () => request<any[]>("/watchlist"),
  addWatchKeyword: (keyword: string) =>
    request<any>("/watchlist", {
      method: "POST",
      body: JSON.stringify({ keyword }),
    }),
  removeWatchKeyword: (id: string) =>
    request<void>(`/watchlist/${id}`, { method: "DELETE" }),
  checkWatchlist: () =>
    request<any>("/watchlist/check-all", { method: "POST" }),
  getWatchKeyword: (id: string) => request<any>(`/watchlist/${id}`),

  // Domain Keywords
  getDomainKeywords: (domainId: string) =>
    request<any[]>(`/domains/${domainId}/domain-keywords`),
  addDomainKeyword: (domainId: string, keyword: string) =>
    request<any>(`/domains/${domainId}/domain-keywords`, {
      method: "POST",
      body: JSON.stringify({ keyword }),
    }),
  removeDomainKeyword: (domainId: string, kwId: string) =>
    request<void>(`/domains/${domainId}/domain-keywords/${kwId}`, {
      method: "DELETE",
    }),
  checkDomainKeywords: (domainId: string) =>
    request<any>(`/domains/${domainId}/check-domain-keywords`, {
      method: "POST",
    }),

  getDomainKeywordDaily: (domainId: string, kwId: string, days = 30) =>
    request<any>(
      `/domains/${domainId}/domain-keywords/${kwId}/daily?days=${days}`,
    ),

  getQueryDaily: (domainId: string, pageId: string, query: string, days = 30) =>
    request<any>(
      `/domains/${domainId}/pages/${pageId}/query-daily?query=${encodeURIComponent(query)}&days=${days}`,
    ),

  analyzeCrossLinks: (domainId: string) =>
    request<any>(`/ai/analyze-crosslinks/${domainId}`, { method: "POST" }),

  analyzeInternalLinks: (domainId: string) =>
    request<any>(`/ai/analyze-internal/${domainId}`, { method: "POST" }),

  getAIProposals: (domainId?: string, status?: string) => {
    const params = new URLSearchParams();
    if (domainId) params.set("domainId", domainId);
    if (status) params.set("status", status);
    return request<any[]>(`/ai/proposals?${params.toString()}`);
  },

  approveProposal: (id: string) =>
    request<any>(`/ai/proposals/${id}/approve`, { method: "POST" }),

  rejectProposal: (id: string) =>
    request<any>(`/ai/proposals/${id}/reject`, { method: "POST" }),

  updateDomainGithub: (id: string, githubRepo: string) =>
    request<any>(`/ai/domains/${id}/github`, {
      method: "PATCH",
      body: JSON.stringify({ githubRepo }),
    }),

  getDomainsConfig: () => request<any[]>(`/ai/domains-config`),

  getApiLogs: (params?: string) =>
    request<any>(`/analytics/api-logs${params ? `?${params}` : ""}`),

  triggerDeploy: (domainId: string) =>
    request<any>(`/ai/deploy/${domainId}`, { method: "POST" }),

  // Jobs
  getJobs: () => request<any[]>("/jobs"),
};
