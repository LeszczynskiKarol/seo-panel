import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "../lib/api";
import { cn, fmtDate } from "../lib/utils";
import {
  Send,
  Bot,
  User,
  RefreshCw,
  Sparkles,
  Clock,
  Zap,
  Plus,
  Trash2,
  MessageSquare,
  ChevronLeft,
} from "lucide-react";

interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
  matchedDomain?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  durationMs?: number | null;
  createdAt?: string;
  context?: string | null;
}

export function ChatPage() {
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load conversations list
  const { data: conversations } = useQuery({
    queryKey: ["chat-conversations"],
    queryFn: api.getChatConversations,
  });

  // Load active conversation
  const { data: activeConv } = useQuery({
    queryKey: ["chat-conversation", activeConvId],
    queryFn: () => api.getChatConversation(activeConvId!),
    enabled: !!activeConvId,
  });

  // When active conversation loads, set messages
  useEffect(() => {
    if (activeConv?.messages) {
      setMessages(activeConv.messages);
    }
  }, [activeConv]);

  const sendMessage = useMutation({
    mutationFn: async (question: string) => {
      setMessages((prev) => [...prev, { role: "user", content: question }]);
      return api.sendChat(question, activeConvId || undefined);
    },
    onSuccess: (data) => {
      if (!activeConvId) {
        setActiveConvId(data.conversationId);
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer,
          matchedDomain: data.matchedDomain,
          inputTokens: data.usage?.input_tokens,
          outputTokens: data.usage?.output_tokens,
          durationMs: data.durationMs,
          context: data.context,
        },
      ]);
      qc.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
    onError: (err: any) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Błąd: ${err.message}` },
      ]);
    },
  });

  const deleteConv = useMutation({
    mutationFn: (id: string) => api.deleteChatConversation(id),
    onSuccess: (_, id) => {
      if (activeConvId === id) {
        setActiveConvId(null);
        setMessages([]);
      }
      qc.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
  });

  const handleSend = () => {
    if (!input.trim() || sendMessage.isPending) return;
    const q = input.trim();
    setInput("");
    sendMessage.mutate(q);
  };

  const startNewChat = () => {
    setActiveConvId(null);
    setMessages([]);
  };

  const loadConversation = (id: string) => {
    setActiveConvId(id);
  };

  const suggestions = [
    "Podsumuj stan SEO Stojana — co wymaga uwagi?",
    "Która domena ma najgorszy spam score?",
    "Porównaj DA moich domen",
    "Które strony tracą pozycje?",
    "Jaką strategię linkowania dla grupy MOTORS?",
    "Które domeny mają najwięcej orphan pages?",
  ];

  return (
    <div className="flex h-[calc(100vh-0px)]">
      {/* Sidebar — conversations list */}
      {sidebarOpen && (
        <div className="w-56 border-r border-panel-border bg-panel-surface flex flex-col shrink-0">
          <div className="p-3 border-b border-panel-border">
            <button
              onClick={startNewChat}
              className="btn btn-primary w-full text-xs flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Nowy chat
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {(conversations || []).map((conv: any) => (
              <div
                key={conv.id}
                className={cn(
                  "flex items-start gap-2 px-3 py-2 cursor-pointer border-b border-panel-border/30 group transition-all",
                  activeConvId === conv.id
                    ? "bg-panel-hover"
                    : "hover:bg-panel-hover/30",
                )}
                onClick={() => loadConversation(conv.id)}
              >
                <MessageSquare className="w-3 h-3 text-panel-muted shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-panel-text truncate">
                    {conv.title || "Nowa rozmowa"}
                  </div>
                  <div className="text-[8px] text-panel-muted mt-0.5">
                    {conv._count?.messages || 0} wiad. ·{" "}
                    {fmtDate(conv.updatedAt)}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConv.mutate(conv.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-panel-muted hover:text-accent-red transition-all shrink-0"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-4 py-2.5 border-b border-panel-border bg-panel-surface shrink-0 flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-panel-muted hover:text-panel-text"
          >
            <ChevronLeft
              className={cn(
                "w-4 h-4 transition-transform",
                !sidebarOpen && "rotate-180",
              )}
            />
          </button>
          <Sparkles className="w-4 h-4 text-accent-purple" />
          <h1 className="text-sm font-bold font-mono">SEO Chat</h1>
          <span className="text-[9px] text-panel-muted">
            Claude + dane z 23 domen
          </span>
          {activeConvId && (
            <button
              onClick={startNewChat}
              className="ml-auto btn btn-ghost text-[10px] flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Nowy
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-6">
              <div className="text-center">
                <Sparkles className="w-8 h-8 text-accent-purple mx-auto mb-3 opacity-50" />
                <div className="text-sm font-semibold text-panel-text mb-1">
                  SEO Analyst AI
                </div>
                <div className="text-xs text-panel-muted max-w-md">
                  Zapytaj o cokolwiek dotyczącego Twoich domen — pozycje,
                  backlinki, indeksowanie, strategię.
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 max-w-lg">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(s)}
                    className="text-left text-[10px] text-panel-dim hover:text-panel-text bg-panel-card border border-panel-border rounded-lg px-3 py-2 hover:bg-panel-hover/30 transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex gap-3",
                msg.role === "user" ? "justify-end" : "",
              )}
            >
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-accent-purple/15 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-accent-purple" />
                </div>
              )}
              <div
                className={cn(
                  "rounded-lg px-4 py-3 max-w-[75%]",
                  msg.role === "user"
                    ? "bg-accent-blue/15 text-panel-text"
                    : "bg-panel-card border border-panel-border",
                )}
              >
                {msg.role === "assistant" ? (
                  <div className="space-y-2">
                    {msg.matchedDomain && (
                      <div className="text-[9px] text-accent-purple font-mono">
                        Kontekst: {msg.matchedDomain}
                      </div>
                    )}
                    <div className="text-xs text-panel-text leading-relaxed chat-markdown">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                    {msg.context && <ContextViewer context={msg.context} />}
                    {(msg.inputTokens || msg.durationMs) && (
                      <div className="flex items-center gap-3 text-[8px] text-panel-muted pt-1 border-t border-panel-border/30">
                        {msg.inputTokens != null &&
                          msg.outputTokens != null && (
                            <span className="flex items-center gap-0.5">
                              <Zap className="w-2.5 h-2.5" />
                              {msg.inputTokens + msg.outputTokens} tokens
                            </span>
                          )}
                        {msg.durationMs != null && (
                          <span className="flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {(msg.durationMs / 1000).toFixed(1)}s
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-panel-text">{msg.content}</div>
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-7 h-7 rounded-full bg-accent-blue/15 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5 text-accent-blue" />
                </div>
              )}
            </div>
          ))}

          {sendMessage.isPending && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-accent-purple/15 flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5 text-accent-purple animate-pulse" />
              </div>
              <div className="bg-panel-card border border-panel-border rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-panel-muted">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Analizuję dane...
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-3 border-t border-panel-border bg-panel-surface shrink-0">
          <div className="flex gap-2">
            <input
              className="input flex-1 text-sm"
              placeholder="Zapytaj o SEO..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              disabled={sendMessage.isPending}
            />
            <button
              className="btn btn-primary flex items-center gap-1.5"
              onClick={handleSend}
              disabled={!input.trim() || sendMessage.isPending}
            >
              {sendMessage.isPending ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContextViewer({ context }: { context: string }) {
  const [open, setOpen] = useState(false);

  // Count approximate tokens (rough: 4 chars ≈ 1 token)
  const approxTokens = Math.round(context.length / 4);

  return (
    <div className="mt-1.5">
      <button
        onClick={() => setOpen(!open)}
        className="text-[9px] text-panel-muted hover:text-accent-purple flex items-center gap-1 font-mono"
      >
        <span>{open ? "▼" : "▶"}</span>
        Kontekst wysłany do Claude ({(context.length / 1024).toFixed(1)} KB, ~
        {approxTokens} tok.)
      </button>
      {open && (
        <pre className="mt-1.5 text-[9px] font-mono text-panel-dim bg-panel-bg/60 border border-panel-border rounded-md p-3 max-h-[400px] overflow-auto whitespace-pre-wrap leading-relaxed">
          {context}
        </pre>
      )}
    </div>
  );
}
