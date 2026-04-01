// frontend/src/components/AddDomainModal.tsx

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { cn } from "../lib/utils";
import { Plus, X, Globe, RefreshCw, AlertCircle } from "lucide-react";

const CATEGORIES = [
  {
    key: "SAAS",
    label: "SaaS",
    icon: "💻",
    desc: "Subskrypcje, SaaS (Smart-Edu, MaturaPolski)",
  },
  {
    key: "ECOMMERCE",
    label: "E-commerce",
    icon: "🛒",
    desc: "Sklep, prowizja 12% (Stojan)",
  },
  {
    key: "CONTENT_SITE",
    label: "Content",
    icon: "📝",
    desc: "Blog, ebooki, artykuły (ebookcopywriting)",
  },
  {
    key: "SATELLITE",
    label: "Satelita SEO",
    icon: "🛰️",
    desc: "Domena satelitarna pod SEO",
  },
  {
    key: "OTHER",
    label: "Inne",
    icon: "📋",
    desc: "Portfolio, landing page, inne",
  },
];

const SITEMAP_OPTIONS = [
  "/sitemap-index.xml",
  "/sitemap.xml",
  "/sitemap_index.xml",
  "/sitemap-0.xml",
];

const LINK_GROUPS = [
  { key: "", label: "— brak —" },
  { key: "EDU", label: "EDU — edukacyjne" },
  { key: "COPY", label: "COPY — copywriting" },
  { key: "MOTORS", label: "MOTORS — silniki" },
  { key: "PERSONAL", label: "PERSONAL — osobiste" },
];

const LINK_ROLES = [
  { key: "", label: "— brak —" },
  { key: "MAIN", label: "MAIN — główna" },
  { key: "SATELLITE", label: "SATELLITE — satelita" },
  { key: "SUPPORT", label: "SUPPORT — wsparcie" },
];

export function AddDomainModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();

  // Step 1: Basic info
  const [domain, setDomain] = useState("");
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("CONTENT_SITE");
  const [sitemapPath, setSitemapPath] = useState("/sitemap-index.xml");
  const [customSitemap, setCustomSitemap] = useState("");

  // Step 2: GSC
  const [gscProperty, setGscProperty] = useState("");
  const [gscType, setGscType] = useState<"domain" | "url">("domain");

  // Step 3: GA4
  const [ga4PropertyId, setGa4PropertyId] = useState("");

  // Step 4: Link strategy
  const [linkGroup, setLinkGroup] = useState("");
  const [linkRole, setLinkRole] = useState("");

  // UI state
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");

  // Auto-fill GSC property from domain
  const handleDomainChange = (val: string) => {
    // Strip protocol and trailing slash
    let clean = val.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    setDomain(clean);

    // Auto-fill label from domain
    if (!label) {
      const parts = clean.replace("www.", "").split(".");
      if (parts.length >= 2) {
        setLabel(parts[0].charAt(0).toUpperCase() + parts[0].slice(1));
      }
    }

    // Auto-fill GSC property
    const baseDomain = clean.replace("www.", "");
    if (gscType === "domain") {
      setGscProperty(`sc-domain:${baseDomain}`);
    } else {
      setGscProperty(`https://${clean}/`);
    }
  };

  const handleGscTypeChange = (type: "domain" | "url") => {
    setGscType(type);
    const baseDomain = domain.replace("www.", "");
    if (type === "domain") {
      setGscProperty(`sc-domain:${baseDomain}`);
    } else {
      setGscProperty(`https://${domain}/`);
    }
  };

  const addDomain = useMutation({
    mutationFn: async () => {
      const siteUrl = domain.startsWith("http") ? domain : `https://${domain}`;
      const finalSitemap = customSitemap || sitemapPath;

      // 1. Create domain
      const created = await api.addDomain({
        domain: domain.replace("www.", ""),
        siteUrl,
        gscProperty: gscProperty || null,
        sitemapPath: finalSitemap,
        label: label || null,
        category,
        linkGroup: linkGroup || null,
        linkRole: linkRole || null,
      });

      // 2. If GA4 property provided, add integration
      if (ga4PropertyId && created.id) {
        try {
          await api.addIntegration(created.id, {
            provider: "GOOGLE_ANALYTICS",
            propertyId: ga4PropertyId.startsWith("properties/")
              ? ga4PropertyId
              : `properties/${ga4PropertyId}`,
          });
        } catch (e: any) {
          console.error("GA4 integration failed:", e);
          // Don't fail the whole operation
        }
      }

      return created;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["domains"] });
      onClose();
    },
    onError: (err: any) => {
      setError(err.message || "Nie udało się dodać domeny");
    },
  });

  const canSubmit = domain.length > 3 && domain.includes(".");

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-panel-card border border-panel-border rounded-xl p-6 w-[560px] max-h-[90vh] overflow-y-auto space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-accent-blue" />
            <h3 className="text-sm font-bold">Dodaj domenę</h3>
          </div>
          <button
            onClick={onClose}
            className="text-panel-muted hover:text-panel-text"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((s) => (
            <button
              key={s}
              onClick={() => setStep(s)}
              className={cn(
                "flex-1 h-1.5 rounded-full transition-all",
                step >= s ? "bg-accent-blue" : "bg-panel-border",
              )}
            />
          ))}
        </div>

        {/* ═══ STEP 1: Basic Info ═══ */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="text-[10px] text-accent-blue font-bold uppercase tracking-wider">
              Krok 1/4 — Podstawowe dane
            </div>

            {/* Domain */}
            <div>
              <label className="text-[10px] text-panel-muted uppercase tracking-wider mb-1 block">
                Domena *
              </label>
              <input
                className="input w-full"
                placeholder="np. nowastrona.pl lub www.nowastrona.pl"
                value={domain}
                onChange={(e) => handleDomainChange(e.target.value)}
                autoFocus
              />
              <div className="text-[9px] text-panel-dim mt-0.5">
                URL: https://{domain || "..."}
              </div>
            </div>

            {/* Label */}
            <div>
              <label className="text-[10px] text-panel-muted uppercase tracking-wider mb-1 block">
                Etykieta (wyświetlana nazwa)
              </label>
              <input
                className="input w-full"
                placeholder="np. Nowa Strona, Mój Blog"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>

            {/* Category */}
            <div>
              <label className="text-[10px] text-panel-muted uppercase tracking-wider mb-1 block">
                Kategoria
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.key}
                    onClick={() => setCategory(cat.key)}
                    className={cn(
                      "p-2 rounded-lg border text-left transition-all",
                      category === cat.key
                        ? "border-accent-blue bg-accent-blue/10"
                        : "border-panel-border hover:border-panel-text/20",
                    )}
                  >
                    <div className="text-sm mb-0.5">
                      {cat.icon} {cat.label}
                    </div>
                    <div className="text-[8px] text-panel-dim leading-tight">
                      {cat.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Sitemap */}
            <div>
              <label className="text-[10px] text-panel-muted uppercase tracking-wider mb-1 block">
                Ścieżka sitemap
              </label>
              <div className="flex gap-1.5 flex-wrap mb-1">
                {SITEMAP_OPTIONS.map((sp) => (
                  <button
                    key={sp}
                    onClick={() => {
                      setSitemapPath(sp);
                      setCustomSitemap("");
                    }}
                    className={cn(
                      "px-2 py-0.5 rounded text-[10px] border font-mono transition-all",
                      sitemapPath === sp && !customSitemap
                        ? "border-accent-blue bg-accent-blue/10 text-accent-blue"
                        : "border-panel-border text-panel-muted",
                    )}
                  >
                    {sp}
                  </button>
                ))}
              </div>
              <input
                className="input w-full text-[11px]"
                placeholder="lub wpisz własną ścieżkę..."
                value={customSitemap}
                onChange={(e) => setCustomSitemap(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* ═══ STEP 2: GSC ═══ */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="text-[10px] text-accent-blue font-bold uppercase tracking-wider">
              Krok 2/4 — Google Search Console
            </div>

            <div className="bg-panel-bg/50 rounded-lg p-3 text-[10px] text-panel-muted space-y-1">
              <div className="font-semibold text-panel-text">
                Jak podłączyć GSC:
              </div>
              <div>
                1. Wejdź na{" "}
                <span className="text-accent-blue">
                  search.google.com/search-console
                </span>
              </div>
              <div>
                2. Dodaj property → Domain:{" "}
                <span className="font-mono text-panel-text">
                  {domain.replace("www.", "") || "twojadomena.pl"}
                </span>
              </div>
              <div>3. Zweryfikuj przez DNS (TXT record w Route 53)</div>
            </div>

            {/* GSC type */}
            <div>
              <label className="text-[10px] text-panel-muted uppercase tracking-wider mb-1 block">
                Typ property
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => handleGscTypeChange("domain")}
                  className={cn(
                    "flex-1 px-3 py-2 rounded-lg border text-[11px] transition-all",
                    gscType === "domain"
                      ? "border-accent-blue bg-accent-blue/10 text-accent-blue"
                      : "border-panel-border text-panel-muted",
                  )}
                >
                  <div className="font-bold">Domain property</div>
                  <div className="text-[9px] text-panel-dim">
                    sc-domain:domena.pl
                  </div>
                </button>
                <button
                  onClick={() => handleGscTypeChange("url")}
                  className={cn(
                    "flex-1 px-3 py-2 rounded-lg border text-[11px] transition-all",
                    gscType === "url"
                      ? "border-accent-blue bg-accent-blue/10 text-accent-blue"
                      : "border-panel-border text-panel-muted",
                  )}
                >
                  <div className="font-bold">URL prefix</div>
                  <div className="text-[9px] text-panel-dim">
                    https://domena.pl/
                  </div>
                </button>
              </div>
            </div>

            {/* GSC property value */}
            <div>
              <label className="text-[10px] text-panel-muted uppercase tracking-wider mb-1 block">
                GSC Property
              </label>
              <input
                className="input w-full font-mono"
                value={gscProperty}
                onChange={(e) => setGscProperty(e.target.value)}
                placeholder="sc-domain:example.pl"
              />
              <div className="text-[9px] text-panel-dim mt-0.5">
                Możesz pominąć — dodasz później w ustawieniach domeny
              </div>
            </div>
          </div>
        )}

        {/* ═══ STEP 3: GA4 ═══ */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="text-[10px] text-accent-blue font-bold uppercase tracking-wider">
              Krok 3/4 — Google Analytics 4
            </div>

            <div className="bg-panel-bg/50 rounded-lg p-3 text-[10px] text-panel-muted space-y-1">
              <div className="font-semibold text-panel-text">
                Jak podłączyć GA4:
              </div>
              <div>
                1. Wejdź na{" "}
                <span className="text-accent-blue">analytics.google.com</span>
              </div>
              <div>
                2. Utwórz property dla{" "}
                <span className="font-mono text-panel-text">
                  {domain || "twojadomena.pl"}
                </span>
              </div>
              <div>
                3. Admin → Property Access Management → dodaj Service Account
                jako <strong>Viewer</strong>
              </div>
              <div>
                4. Skopiuj Property ID (np.{" "}
                <span className="font-mono">properties/123456789</span>)
              </div>
            </div>

            <div>
              <label className="text-[10px] text-panel-muted uppercase tracking-wider mb-1 block">
                GA4 Property ID
              </label>
              <input
                className="input w-full font-mono"
                placeholder="properties/123456789 lub sam numer: 123456789"
                value={ga4PropertyId}
                onChange={(e) => setGa4PropertyId(e.target.value)}
              />
              <div className="text-[9px] text-panel-dim mt-0.5">
                Opcjonalne — możesz dodać integrację później w zakładce
                Integracje
              </div>
            </div>
          </div>
        )}

        {/* ═══ STEP 4: Link Strategy ═══ */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="text-[10px] text-accent-blue font-bold uppercase tracking-wider">
              Krok 4/4 — Strategia linkowania
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-panel-muted uppercase tracking-wider mb-1 block">
                  Grupa linkowa
                </label>
                <select
                  className="input w-full"
                  value={linkGroup}
                  onChange={(e) => setLinkGroup(e.target.value)}
                >
                  {LINK_GROUPS.map((g) => (
                    <option key={g.key} value={g.key}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-panel-muted uppercase tracking-wider mb-1 block">
                  Rola w grupie
                </label>
                <select
                  className="input w-full"
                  value={linkRole}
                  onChange={(e) => setLinkRole(e.target.value)}
                >
                  {LINK_ROLES.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-panel-bg/50 rounded-lg p-3 space-y-1.5">
              <div className="text-[10px] font-bold text-panel-text uppercase tracking-wider mb-2">
                Podsumowanie
              </div>
              <Row label="Domena" value={domain} />
              <Row label="Etykieta" value={label || "—"} />
              <Row
                label="Kategoria"
                value={
                  CATEGORIES.find((c) => c.key === category)?.label || category
                }
              />
              <Row label="Sitemap" value={customSitemap || sitemapPath} mono />
              <Row label="GSC" value={gscProperty || "— pominięto —"} mono />
              <Row label="GA4" value={ga4PropertyId || "— pominięto —"} mono />
              <Row label="Grupa" value={linkGroup || "—"} />
              <Row label="Rola" value={linkRole || "—"} />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-accent-red text-[11px] bg-accent-red/10 px-3 py-2 rounded">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2 border-t border-panel-border">
          <div>
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="btn btn-ghost text-xs"
              >
                ← Wstecz
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-ghost text-xs">
              Anuluj
            </button>
            {step < 4 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={step === 1 && !canSubmit}
                className="btn btn-primary text-xs"
              >
                Dalej →
              </button>
            ) : (
              <button
                onClick={() => addDomain.mutate()}
                disabled={!canSubmit || addDomain.isPending}
                className="btn btn-primary text-xs flex items-center gap-1"
              >
                {addDomain.isPending ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <Plus className="w-3 h-3" />
                )}
                Dodaj domenę
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center text-[10px]">
      <span className="text-panel-muted w-20 shrink-0">{label}</span>
      <span
        className={cn(
          "text-panel-text truncate",
          mono && "font-mono text-[9px]",
        )}
      >
        {value}
      </span>
    </div>
  );
}
