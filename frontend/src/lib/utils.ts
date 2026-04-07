import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function fmtNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pl-PL");
}

export function fmtDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("pl-PL");
}

export function fmtPercent(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

export function fmtPosition(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toFixed(1);
}

export function verdictColor(verdict: string): string {
  switch (verdict) {
    case "PASS":
      return "text-accent-green";
    case "FAIL":
      return "text-accent-red";
    case "NEUTRAL":
      return "text-accent-amber";
    default:
      return "text-panel-muted";
  }
}

export function verdictBadge(verdict: string): string {
  switch (verdict) {
    case "PASS":
      return "badge-pass";
    case "FAIL":
      return "badge-fail";
    case "NEUTRAL":
      return "badge-neutral";
    case "REMOVAL_REQUESTED":
      return "badge-neutral bg-accent-amber/10 text-accent-amber";
    case "REMOVED":
      return "badge-fail bg-accent-red/10 text-accent-red";
    default:
      return "badge-unknown";
  }
}

export function severityColor(severity: string): string {
  switch (severity) {
    case "CRITICAL":
      return "text-accent-red";
    case "HIGH":
      return "text-accent-red";
    case "MEDIUM":
      return "text-accent-amber";
    case "LOW":
      return "text-panel-muted";
    default:
      return "text-panel-muted";
  }
}

export function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    SAAS: "SaaS",
    ECOMMERCE: "E-commerce",
    CONTENT_SITE: "Content",
    SATELLITE: "Satellite SEO",
    OTHER: "Inne",
  };
  return map[cat] || cat;
}

export function categoryColor(cat: string): string {
  const map: Record<string, string> = {
    SAAS: "bg-accent-purple/15 text-accent-purple",
    ECOMMERCE: "bg-accent-cyan/15 text-accent-cyan",
    CONTENT_SITE: "bg-accent-blue/15 text-accent-blue",
    SATELLITE: "bg-accent-amber/15 text-accent-amber",
    OTHER: "bg-panel-border text-panel-muted",
  };
  return map[cat] || "bg-panel-border text-panel-muted";
}
