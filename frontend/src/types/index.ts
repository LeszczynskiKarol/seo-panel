export interface Domain {
  id: string;
  domain: string;
  siteUrl: string;
  gscProperty: string | null;
  sitemapPath: string;
  label: string | null;
  category: string;
  isActive: boolean;
  totalPages: number;
  indexedPages: number;
  avgPosition: number | null;
  totalClicks: number;
  totalImpressions: number;
  lastGscPull: string | null;
  lastCrawl: string | null;
  lastSitemapSync: string | null;
}

export interface DomainDetail extends Domain {
  dailyStats: GscDaily[];
  indexingStats: { verdict: string; count: number }[];
  alerts: Alert[];
}

export interface Page {
  id: string;
  domainId: string;
  url: string;
  path: string;
  inSitemap: boolean;
  indexingVerdict: string;
  coverageState: string | null;
  lastCrawlTime: string | null;
  lastChecked: string | null;
  clicks: number;
  impressions: number;
  ctr: number | null;
  position: number | null;
  internalLinksIn: number;
  internalLinksOut: number;
  externalLinksOut: number;
  brokenLinksOut: number;
  firstSubmitted: string | null;
  statusChangedAt: string | null;
  previousVerdict: string | null;
}

export interface GscDaily {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number | null;
  position: number | null;
}

export interface Alert {
  id: string;
  domainId: string;
  pageId: string | null;
  type: string;
  severity: string;
  title: string;
  description: string | null;
  isResolved: boolean;
  createdAt: string;
  domain?: { domain: string; label: string | null };
  page?: { path: string; url: string };
}

export interface Link {
  id: string;
  fromPageId: string;
  toPageId: string | null;
  toUrl: string;
  anchorText: string | null;
  isInternal: boolean;
  isBroken: boolean;
  statusCode: number | null;
  fromPage?: { path: string; url: string };
}

export interface Overview {
  domains: number;
  totalPages: number;
  totalIndexed: number;
  indexRate: number;
  totalClicks: number;
  totalImpressions: number;
  alertCount: number;
  recentTraffic: { date: string; clicks: number; impressions: number }[];
}

export interface Query {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}
