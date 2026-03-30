import { useState, useMemo } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Wrench,
  Brain,
  MessageSquare,
  Zap,
  Clock,
  Database,
} from "lucide-react";
import { cn } from "../lib/utils";

interface ContextViewerProps {
  context: string;
}

// Parse the structured context into sections
interface ParsedSection {
  type:
    | "system_prompt"
    | "history"
    | "user_question"
    | "iteration"
    | "final"
    | "raw";
  title: string;
  content: string;
  iteration?: number;
  tools?: { name: string; input: string; result: string; duration: string }[];
  thinking?: string;
  meta?: string;
}

function parseContext(raw: string): ParsedSection[] {
  const sections: ParsedSection[] = [];

  // Try structured format first
  const systemMatch = raw.match(/┌─── SYSTEM PROMPT ─+┐\n([\s\S]*?)└─+┘/);
  const historyMatch = raw.match(
    /┌─── HISTORIA KONWERSACJI ─+┐\n([\s\S]*?)└─+┘/,
  );
  const questionMatch = raw.match(
    /┌─── PYTANIE UŻYTKOWNIKA ─+┐\n([\s\S]*?)└─+┘/,
  );
  const finalMatch = raw.match(
    /┌─── FINALNA ODPOWIEDŹ CLAUDE ─+┐\n([\s\S]*?)└─+┘/,
  );

  if (!systemMatch) {
    // Fallback: raw unstructured context
    return [{ type: "raw", title: "Pełny kontekst", content: raw }];
  }

  sections.push({
    type: "system_prompt",
    title: "System Prompt",
    content: systemMatch[1].trim(),
  });

  if (historyMatch) {
    sections.push({
      type: "history",
      title: "Historia konwersacji",
      content: historyMatch[1].trim(),
    });
  }

  if (questionMatch) {
    sections.push({
      type: "user_question",
      title: "Pytanie użytkownika",
      content: questionMatch[1].trim(),
    });
  }

  // Parse iterations
  const iterRegex = /╔══ ITERACJA (\d+) ══+╗\n([\s\S]*?)╚══+╝/g;
  let iterMatch;
  while ((iterMatch = iterRegex.exec(raw)) !== null) {
    const iterNum = parseInt(iterMatch[1]);
    const iterContent = iterMatch[2];

    // Parse meta line
    const metaMatch = iterContent.match(
      /║ Tokens: IN=(\d+) OUT=(\d+) \| Stop: (\S+)/,
    );

    // Parse thinking
    const thinkMatch = iterContent.match(
      /║ 💭 CLAUDE MYŚLI:\n([\s\S]*?)(?=║\n║ 🔧|$)/,
    );

    // Parse tool calls
    const tools: ParsedSection["tools"] = [];
    const toolRegex =
      /║ 🔧 TOOL: (\S+)\n║ 📥 INPUT: (.+)\n║ ⏱  (\d+ms \| \d+ chars)\n║ 📤 FULL RESULT:\n║ ─+\n([\s\S]*?)║ ─+/g;
    let toolMatch;
    while ((toolMatch = toolRegex.exec(iterContent)) !== null) {
      tools.push({
        name: toolMatch[1],
        input: toolMatch[2],
        result: toolMatch[4].trim(),
        duration: toolMatch[3],
      });
    }

    sections.push({
      type: "iteration",
      title: `Iteracja ${iterNum}`,
      iteration: iterNum,
      content: iterContent,
      tools,
      thinking: thinkMatch ? thinkMatch[1].trim() : undefined,
      meta: metaMatch
        ? `IN: ${metaMatch[1]} | OUT: ${metaMatch[2]} | Stop: ${metaMatch[3]}`
        : undefined,
    });
  }

  if (finalMatch) {
    sections.push({
      type: "final",
      title: "Podsumowanie",
      content: finalMatch[1].trim(),
    });
  }

  return sections;
}

function SectionIcon({ type }: { type: ParsedSection["type"] }) {
  switch (type) {
    case "system_prompt":
      return <FileText className="w-3 h-3 text-accent-purple" />;
    case "history":
      return <MessageSquare className="w-3 h-3 text-panel-muted" />;
    case "user_question":
      return <MessageSquare className="w-3 h-3 text-accent-blue" />;
    case "iteration":
      return <Wrench className="w-3 h-3 text-accent-yellow" />;
    case "final":
      return <Zap className="w-3 h-3 text-accent-green" />;
    default:
      return <Database className="w-3 h-3 text-panel-muted" />;
  }
}

function CollapsibleSection({
  section,
  defaultOpen = false,
}: {
  section: ParsedSection;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-panel-border/40 rounded-md overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors",
          "hover:bg-panel-hover/30",
          open ? "bg-panel-hover/20" : "bg-panel-card/50",
        )}
      >
        {open ? (
          <ChevronDown className="w-3 h-3 text-panel-muted shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 text-panel-muted shrink-0" />
        )}
        <SectionIcon type={section.type} />
        <span className="text-[10px] font-mono font-semibold text-panel-text">
          {section.title}
        </span>
        {section.meta && (
          <span className="text-[8px] text-panel-muted ml-auto font-mono">
            {section.meta}
          </span>
        )}
        {section.type === "system_prompt" && (
          <span className="text-[8px] text-panel-muted ml-auto font-mono">
            {(section.content.length / 1024).toFixed(1)} KB
          </span>
        )}
      </button>

      {open && (
        <div className="border-t border-panel-border/30">
          {section.type === "iteration" && section.tools?.length ? (
            <div className="space-y-0">
              {section.thinking && (
                <div className="px-3 py-2 bg-accent-purple/5 border-b border-panel-border/20">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Brain className="w-3 h-3 text-accent-purple" />
                    <span className="text-[9px] font-mono font-semibold text-accent-purple">
                      Claude myśli:
                    </span>
                  </div>
                  <pre className="text-[9px] font-mono text-panel-dim whitespace-pre-wrap leading-relaxed">
                    {section.thinking}
                  </pre>
                </div>
              )}
              {section.tools.map((tool, i) => (
                <ToolCallView key={i} tool={tool} index={i} />
              ))}
            </div>
          ) : (
            <pre className="px-3 py-2 text-[9px] font-mono text-panel-dim whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-auto">
              {section.content}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function ToolCallView({
  tool,
  index,
}: {
  tool: NonNullable<ParsedSection["tools"]>[number];
  index: number;
}) {
  const [showResult, setShowResult] = useState(false);

  return (
    <div className="border-b border-panel-border/20 last:border-b-0">
      {/* Tool header */}
      <div className="px-3 py-1.5 bg-panel-bg/40 flex items-center gap-2">
        <Wrench className="w-2.5 h-2.5 text-accent-yellow" />
        <span className="text-[9px] font-mono font-bold text-accent-yellow">
          {tool.name}
        </span>
        <span className="text-[8px] text-panel-muted font-mono">
          {tool.duration}
        </span>
      </div>

      {/* Input */}
      <div className="px-3 py-1 bg-accent-blue/5">
        <span className="text-[8px] font-mono text-accent-blue font-semibold">
          INPUT:{" "}
        </span>
        <span className="text-[9px] font-mono text-panel-text">
          {tool.input}
        </span>
      </div>

      {/* Result toggle */}
      <div className="px-3 py-1">
        <button
          onClick={() => setShowResult(!showResult)}
          className="flex items-center gap-1 text-[9px] font-mono text-accent-green hover:text-accent-green/80"
        >
          {showResult ? (
            <ChevronDown className="w-2.5 h-2.5" />
          ) : (
            <ChevronRight className="w-2.5 h-2.5" />
          )}
          <Database className="w-2.5 h-2.5" />
          RESULT ({tool.result.length.toLocaleString()} znaków,{" "}
          {tool.result.split("\n").length} linii)
        </button>
      </div>

      {showResult && (
        <pre className="px-3 py-2 text-[9px] font-mono text-panel-dim whitespace-pre-wrap leading-relaxed max-h-[600px] overflow-auto bg-panel-bg/30 border-t border-panel-border/20">
          {tool.result}
        </pre>
      )}
    </div>
  );
}

export function ContextViewer({ context }: ContextViewerProps) {
  const [open, setOpen] = useState(false);
  const sections = useMemo(() => parseContext(context), [context]);

  const approxTokens = Math.round(context.length / 4);
  const toolCount = sections
    .filter((s) => s.type === "iteration")
    .reduce((sum, s) => sum + (s.tools?.length || 0), 0);
  const iterCount = sections.filter((s) => s.type === "iteration").length;

  return (
    <div className="mt-1.5">
      <button
        onClick={() => setOpen(!open)}
        className="text-[9px] text-panel-muted hover:text-accent-purple flex items-center gap-1.5 font-mono"
      >
        <span>{open ? "▼" : "▶"}</span>
        <Database className="w-3 h-3" />
        Kontekst Claude ({(context.length / 1024).toFixed(1)} KB, ~
        {approxTokens.toLocaleString()} tok.
        {iterCount > 0 && ` | ${iterCount} iteracji, ${toolCount} tool calls`})
      </button>

      {open && (
        <div className="mt-2 space-y-1.5">
          {sections.map((section, i) => (
            <CollapsibleSection
              key={i}
              section={section}
              defaultOpen={section.type === "iteration"}
            />
          ))}
        </div>
      )}
    </div>
  );
}
