const BASE = "/api";

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { ...headers, ...opts.headers },
  });
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

  // Jobs
  getJobs: () => request<any[]>("/jobs"),
};
