// frontend/src/pages/AILinksPage.tsx

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { cn, fmtDate } from "../lib/utils";
import {
  RefreshCw,
  Check,
  X,
  GitBranch,
  ExternalLink,
  ArrowRight,
  Settings,
  Zap,
  Link2,
  Unlink,
} from "lucide-react";

export function AILinksPage() {
  const qc = useQueryClient();
  const [selectedDomain, setSelectedDomain] = useState("");
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [showConfig, setShowConfig] = useState(false);

  const { data: domainsConfig } = useQuery({
    queryKey: ["ai-domains-config"],
    queryFn: api.getDomainsConfig,
  });

  const { data: proposals, isLoading: proposalsLoading } = useQuery({
    queryKey: ["ai-proposals", selectedDomain, statusFilter],
    queryFn: () => api.getAIProposals(selectedDomain, statusFilter),
    enabled: true,
  });

  const analyzeSitemapInternal = useMutation({
    mutationFn: (domainId: string) =>
      api.analyzeBySitemap(domainId, "INTERNAL"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-proposals"] }),
  });

  const analyzeSitemapCross = useMutation({
    mutationFn: (domainId: string) =>
      api.analyzeBySitemap(domainId, "CROSSLINK"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-proposals"] }),
  });

  const analyzeCross = useMutation({
    mutationFn: (domainId: string) => api.analyzeCrossLinks(domainId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-proposals"] }),
  });

  const analyzeInternal = useMutation({
    mutationFn: (domainId: string) => api.analyzeInternalLinks(domainId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-proposals"] }),
  });

  const approve = useMutation({
    mutationFn: (id: string) => api.approveProposal(id),
    onSuccess: (data: any) => {
      if (data?.error) {
        alert(`Błąd: ${data.message || data.error}`);
      } else if (data?.commitSha) {
        alert(`Commit ${data.commitSha.slice(0, 7)} — link dodany na GitHub!`);
      }
      qc.invalidateQueries({ queryKey: ["ai-proposals"] });
    },
    onError: (err: any) => {
      try {
        const parsed = JSON.parse(err.message);
        alert(`Błąd: ${parsed.message || err.message}`);
      } catch {
        alert(`Błąd: ${err.message}`);
      }
    },
  });

  const triggerDeploy = useMutation({
    mutationFn: (domainId: string) => api.triggerDeploy(domainId),
  });

  const reject = useMutation({
    mutationFn: (id: string) => api.rejectProposal(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-proposals"] }),
  });

  const selectedDomainConfig = domainsConfig?.find(
    (d: any) => d.id === selectedDomain,
  );
  const isAnalyzing =
    analyzeCross.isPending ||
    analyzeInternal.isPending ||
    analyzeSitemapCross.isPending ||
    analyzeSitemapInternal.isPending;

  const crossProposals = (proposals || []).filter(
    (p: any) => p.type === "CROSSLINK",
  );
  const internalProposals = (proposals || []).filter(
    (p: any) => p.type === "INTERNAL",
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <Zap className="w-5 h-5 text-accent-amber" /> AI Link Builder
          </h1>
          <p className="text-xs text-panel-muted mt-0.5">
            Automatyczna analiza i wdrożenie cross-linków i linków wewnętrznych
          </p>
        </div>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="btn btn-ghost text-xs"
        >
          <Settings className="w-3.5 h-3.5 mr-1" /> Konfiguracja
        </button>
      </div>

      {/* GitHub Config Panel */}
      {showConfig && <GitHubConfigPanel domains={domainsConfig || []} />}

      {/* Domain selector + Actions */}
      <div className="flex items-center gap-3">
        <select
          className="input text-xs py-1.5 min-w-[200px]"
          value={selectedDomain}
          onChange={(e) => setSelectedDomain(e.target.value)}
        >
          <option value="">Wszystkie domeny</option>
          {(domainsConfig || []).map((d: any) => (
            <option key={d.id} value={d.id} disabled={!d.githubRepo}>
              {d.label || d.domain} {!d.githubRepo ? "(brak repo)" : ""}
            </option>
          ))}
        </select>

        {selectedDomain && selectedDomainConfig?.githubRepo && (
          <>
            <button
              className="btn btn-primary text-xs"
              onClick={() => analyzeCross.mutate(selectedDomain)}
              disabled={isAnalyzing}
            >
              {analyzeCross.isPending ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
              ) : (
                <Link2 className="w-3.5 h-3.5 mr-1" />
              )}
              Analizuj cross-linki
            </button>
            <button
              className="btn btn-ghost text-xs border border-accent-purple/30 text-accent-purple hover:bg-accent-purple/10"
              onClick={() => analyzeInternal.mutate(selectedDomain)}
              disabled={isAnalyzing}
            >
              {analyzeInternal.isPending ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
              ) : (
                <Unlink className="w-3.5 h-3.5 mr-1" />
              )}
              Analizuj linki wewnętrzne
            </button>
            <span className="text-[9px] text-panel-muted">Dynamiczne:</span>
            <button
              className="btn btn-ghost text-xs border border-accent-amber/30 text-accent-amber hover:bg-accent-amber/10"
              onClick={() => analyzeSitemapCross.mutate(selectedDomain)}
              disabled={
                isAnalyzing ||
                analyzeSitemapCross.isPending ||
                analyzeSitemapInternal.isPending
              }
            >
              {analyzeSitemapCross.isPending ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
              ) : null}
              Cross (sitemap)
            </button>
            <button
              className="btn btn-ghost text-xs border border-accent-amber/30 text-accent-amber hover:bg-accent-amber/10"
              onClick={() => analyzeSitemapInternal.mutate(selectedDomain)}
              disabled={
                isAnalyzing ||
                analyzeSitemapCross.isPending ||
                analyzeSitemapInternal.isPending
              }
            >
              {analyzeSitemapInternal.isPending ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
              ) : null}
              Wewnętrzne (sitemap)
            </button>

            <button
              className="btn btn-ghost text-xs border border-accent-green/30 text-accent-green hover:bg-accent-green/10"
              onClick={() => triggerDeploy.mutate(selectedDomain)}
              disabled={triggerDeploy.isPending}
            >
              {triggerDeploy.isPending ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
              ) : null}
              {triggerDeploy.isPending ? "Deploying..." : "Deploy"}
            </button>
          </>
        )}

        {isAnalyzing && (
          <span className="text-[10px] text-accent-amber animate-pulse">
            Claude analizuje dane... to może potrwać 30-60s
          </span>
        )}
      </div>

      {/* Status filter */}
      <div className="flex gap-1">
        {["PENDING", "MANUAL", "COMMITTED", "REJECTED", ""].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              "badge cursor-pointer",
              statusFilter === s ? "badge-pass" : "badge-unknown",
            )}
          >
            {s === ""
              ? "Wszystkie"
              : s === "PENDING"
                ? "Oczekujące"
                : s === "MANUAL"
                  ? "Do ręcznego wdrożenia"
                  : s === "COMMITTED"
                    ? "Zatwierdzone"
                    : "Odrzucone"}
          </button>
        ))}
      </div>

      {/* Results */}
      {proposalsLoading ? (
        <div className="flex justify-center py-8">
          <RefreshCw className="w-4 h-4 animate-spin text-panel-muted" />
        </div>
      ) : !(proposals || []).length ? (
        <div className="bg-panel-card border border-panel-border rounded p-8 text-center">
          <Zap className="w-8 h-8 text-panel-muted mx-auto mb-2" />
          <div className="text-sm text-panel-muted">
            {selectedDomain
              ? "Brak propozycji. Uruchom analizę."
              : "Wybierz domenę i uruchom analizę."}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Cross-link proposals */}
          {crossProposals.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-panel-muted uppercase tracking-wider mb-2 flex items-center gap-2">
                <Link2 className="w-3.5 h-3.5 text-accent-cyan" /> Cross-linki (
                {crossProposals.length})
              </div>
              <div className="space-y-2">
                {crossProposals.map((p: any) => (
                  <ProposalCard
                    key={p.id}
                    proposal={p}
                    onApprove={() => approve.mutate(p.id)}
                    onReject={() => reject.mutate(p.id)}
                    isApproving={approve.isPending}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Internal link proposals */}
          {internalProposals.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-panel-muted uppercase tracking-wider mb-2 flex items-center gap-2">
                <Unlink className="w-3.5 h-3.5 text-accent-purple" /> Linki
                wewnętrzne ({internalProposals.length})
              </div>
              <div className="space-y-2">
                {internalProposals.map((p: any) => (
                  <ProposalCard
                    key={p.id}
                    proposal={p}
                    onApprove={() => approve.mutate(p.id)}
                    onReject={() => reject.mutate(p.id)}
                    isApproving={approve.isPending}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProposalCard({
  proposal: p,
  onApprove,
  onReject,
  isApproving,
}: {
  proposal: any;
  onApprove: () => void;
  onReject: () => void;
  isApproving: boolean;
}) {
  const [showDiff, setShowDiff] = useState(false);

  return (
    <div
      className={cn(
        "bg-panel-card border rounded-lg overflow-hidden",
        p.status === "COMMITTED"
          ? "border-accent-green/30"
          : p.status === "REJECTED"
            ? "border-accent-red/30 opacity-60"
            : "border-panel-border",
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs">
            <span
              className={cn(
                "badge",
                p.type === "CROSSLINK"
                  ? "badge-pass"
                  : "bg-accent-purple/20 text-accent-purple",
              )}
            >
              {p.type === "CROSSLINK" ? "Cross-link" : "Wewnętrzny"}
            </span>
            <span
              className={cn(
                "badge",
                p.status === "PENDING"
                  ? "badge-neutral"
                  : p.status === "COMMITTED"
                    ? "badge-pass"
                    : "badge-fail",
              )}
            >
              {p.status}
            </span>
            {p.commitSha && (
              <span className="text-[9px] text-panel-muted font-mono">
                <GitBranch className="w-3 h-3 inline mr-0.5" />
                {p.commitSha.slice(0, 7)}
              </span>
            )}
          </div>

          <div className="mt-2 flex items-center gap-2 text-[11px]">
            <span className="font-mono text-accent-blue">{p.sourcePath}</span>
            <ArrowRight className="w-3 h-3 text-panel-muted shrink-0" />
            <a
              href={p.targetUrl}
              target="_blank"
              className="font-mono text-accent-cyan hover:underline truncate"
            >
              {p.type === "CROSSLINK"
                ? `${p.targetDomain}${p.targetPath}`
                : p.targetPath}
            </a>
          </div>

          <div className="mt-1 text-[11px]">
            <span className="text-panel-muted">Anchor:</span>{" "}
            <span className="text-accent-amber font-semibold">
              "{p.anchorText}"
            </span>
          </div>

          <div className="mt-1 text-[10px] text-panel-dim">{p.reason}</div>
          {p.context && (
            <div className="mt-1.5 text-[10px] bg-accent-amber/5 border border-accent-amber/20 rounded px-2 py-1.5">
              <span className="text-accent-amber font-semibold">
                Jak wdrożyć:{" "}
              </span>
              <span className="text-panel-text">{p.context}</span>
            </div>
          )}
          <div className="mt-2 flex items-center gap-2 text-[9px] text-panel-muted">
            <span>
              <GitBranch className="w-3 h-3 inline" /> {p.githubRepo}
            </span>
            <span>→ {p.filePath}</span>
            <span>{fmtDate(p.createdAt)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1.5 shrink-0">
          {p.status === "PENDING" && (
            <>
              <button
                onClick={onApprove}
                disabled={isApproving}
                className="btn btn-primary text-[10px] py-1 px-2 flex items-center gap-1"
              >
                <Check className="w-3 h-3" /> Zatwierdź
              </button>
              <button
                onClick={onReject}
                className="btn btn-ghost text-[10px] py-1 px-2 flex items-center gap-1 text-accent-red hover:bg-accent-red/10"
              >
                <X className="w-3 h-3" /> Odrzuć
              </button>
            </>
          )}
          {p.status === "MANUAL" && (
            <button
              onClick={onReject}
              className="btn btn-ghost text-[10px] py-1 px-2 flex items-center gap-1"
            >
              <Check className="w-3 h-3" /> Zrobione
            </button>
          )}
          {p.filePath !== "manual" && (
            <button
              onClick={() => setShowDiff(!showDiff)}
              className="btn btn-ghost text-[10px] py-1 px-2"
            >
              {showDiff ? "Ukryj diff" : "Pokaż diff"}
            </button>
          )}
        </div>
      </div>

      {/* Diff viewer */}
      {showDiff && (
        <div className="border-t border-panel-border">
          <DiffViewer
            original={p.originalCode}
            proposed={p.proposedCode}
            filePath={p.filePath}
          />
        </div>
      )}
    </div>
  );
}

function DiffViewer({
  original,
  proposed,
  filePath,
}: {
  original: string;
  proposed: string;
  filePath: string;
}) {
  const origLines = original.split("\n");
  const propLines = proposed.split("\n");

  // Simple diff — find changed lines
  const maxLines = Math.max(origLines.length, propLines.length);
  const diffs: {
    type: "same" | "removed" | "added" | "context";
    lineNum: number;
    text: string;
  }[] = [];

  // Find first and last difference
  let firstDiff = -1;
  let lastDiff = -1;
  for (let i = 0; i < maxLines; i++) {
    if (origLines[i] !== propLines[i]) {
      if (firstDiff === -1) firstDiff = i;
      lastDiff = i;
    }
  }

  if (firstDiff === -1) {
    return (
      <div className="p-3 text-xs text-panel-muted text-center">Brak zmian</div>
    );
  }

  // Show context around changes
  const contextSize = 3;
  const startLine = Math.max(0, firstDiff - contextSize);
  const endLine = Math.min(maxLines - 1, lastDiff + contextSize);

  // Build unified-ish diff
  for (let i = startLine; i <= endLine; i++) {
    const origLine = origLines[i] || "";
    const propLine = propLines[i] || "";

    if (origLine === propLine) {
      diffs.push({ type: "same", lineNum: i + 1, text: origLine });
    } else {
      if (origLine)
        diffs.push({ type: "removed", lineNum: i + 1, text: origLine });
      if (propLine)
        diffs.push({ type: "added", lineNum: i + 1, text: propLine });
    }
  }

  return (
    <div className="overflow-x-auto">
      <div className="px-3 py-1.5 bg-panel-bg/50 text-[9px] text-panel-muted font-mono border-b border-panel-border">
        {filePath} · linie {startLine + 1}–{endLine + 1}
      </div>
      <pre className="text-[10px] font-mono leading-relaxed">
        {diffs.map((d, i) => (
          <div
            key={i}
            className={cn(
              "px-3 py-0.5",
              d.type === "removed"
                ? "bg-accent-red/10 text-accent-red"
                : d.type === "added"
                  ? "bg-accent-green/10 text-accent-green"
                  : "text-panel-dim",
            )}
          >
            <span className="inline-block w-8 text-right mr-3 text-panel-muted select-none">
              {d.type === "added" ? "+" : d.type === "removed" ? "-" : " "}
              {d.lineNum}
            </span>
            {d.text}
          </div>
        ))}
      </pre>
    </div>
  );
}

function GitHubConfigPanel({ domains }: { domains: any[] }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [repoValue, setRepoValue] = useState("");

  const updateRepo = useMutation({
    mutationFn: ({ id, repo }: { id: string; repo: string }) =>
      api.updateDomainGithub(id, repo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-domains-config"] });
      setEditing(null);
    },
  });

  return (
    <div className="bg-panel-card border border-panel-border rounded-lg p-4">
      <div className="text-xs font-semibold mb-3 flex items-center gap-2">
        <GitBranch className="w-3.5 h-3.5 text-accent-blue" /> Konfiguracja
        repozytoriów GitHub
      </div>
      <div className="text-[10px] text-panel-muted mb-3">
        Podaj nazwy repozytoriów (bez właściciela) dla każdej domeny. Wymagane
        do analizy i commitów.
      </div>
      <div className="space-y-1.5">
        {domains.map((d: any) => (
          <div key={d.id} className="flex items-center gap-2 text-[11px]">
            <span className="font-mono text-panel-text w-[200px] truncate">
              {d.label || d.domain}
            </span>
            {editing === d.id ? (
              <div className="flex gap-1 flex-1">
                <input
                  className="input text-[11px] py-0.5 flex-1 font-mono"
                  placeholder="nazwa-repo"
                  value={repoValue}
                  onChange={(e) => setRepoValue(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    updateRepo.mutate({ id: d.id, repo: repoValue })
                  }
                />
                <button
                  className="btn btn-primary text-[10px] py-0.5 px-2"
                  onClick={() =>
                    updateRepo.mutate({ id: d.id, repo: repoValue })
                  }
                >
                  Zapisz
                </button>
                <button
                  className="btn btn-ghost text-[10px] py-0.5 px-2"
                  onClick={() => setEditing(null)}
                >
                  Anuluj
                </button>
              </div>
            ) : (
              <>
                <span
                  className={cn(
                    "font-mono flex-1",
                    d.githubRepo ? "text-accent-green" : "text-panel-muted",
                  )}
                >
                  {d.githubRepo || "nie skonfigurowane"}
                </span>
                <button
                  className="btn btn-ghost text-[10px] py-0.5 px-1"
                  onClick={() => {
                    setEditing(d.id);
                    setRepoValue(d.githubRepo || "");
                  }}
                >
                  Edytuj
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
