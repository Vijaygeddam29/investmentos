import { useState, useRef, useEffect, useCallback } from "react";
import { useListAnthropicConversations, useCreateAnthropicConversation, useGetAnthropicConversation, useDeleteAnthropicConversation } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, X, Plus, Trash2, ChevronLeft, Send, Loader2, Bot, User, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ChatPanelProps {
  companyContext?: {
    ticker: string;
    name: string;
    scores?: Record<string, number | null>;
    momentum?: Record<string, unknown>;
    valuation?: Record<string, unknown>;
  } | null;
}

interface StreamingMessage {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

const SUGGESTED = [
  "Explain NVIDIA's current setup and whether now is a good entry point",
  "Compare Microsoft and Apple on valuation and momentum",
  "What does a Fortress score above 0.8 mean in practice?",
  "How should I think about portfolio concentration risk?",
  "What sectors look strongest for the next 6 months?",
];

export function ChatPanel({ companyContext }: ChatPanelProps) {
  const [open, setOpen] = useState(false);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [showConvList, setShowConvList] = useState(true);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [localMessages, setLocalMessages] = useState<StreamingMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();

  const { data: convList = [], refetch: refetchConvs } = useListAnthropicConversations({ query: { enabled: open } });
  const { data: activeConv, refetch: refetchConv } = useGetAnthropicConversation(activeConvId ?? 0, {
    query: { enabled: !!activeConvId },
  });
  const createConv = useCreateAnthropicConversation();
  const deleteConv = useDeleteAnthropicConversation();

  useEffect(() => {
    if (activeConv?.messages) {
      setLocalMessages(activeConv.messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
    }
  }, [activeConv?.messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages]);

  const openConversation = useCallback((id: number) => {
    setActiveConvId(id);
    setShowConvList(false);
  }, []);

  const newConversation = useCallback(async () => {
    const title = companyContext
      ? `${companyContext.ticker} — ${new Date().toLocaleDateString()}`
      : `Chat — ${new Date().toLocaleDateString()}`;
    const conv = await createConv.mutateAsync({ data: { title } });
    refetchConvs();
    setActiveConvId(conv.id);
    setLocalMessages([]);
    setShowConvList(false);
  }, [companyContext, createConv, refetchConvs]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return;
    let convId = activeConvId;

    if (!convId) {
      const title = companyContext
        ? `${companyContext.ticker} — ${new Date().toLocaleDateString()}`
        : text.slice(0, 50);
      const conv = await createConv.mutateAsync({ data: { title } });
      convId = conv.id;
      setActiveConvId(conv.id);
      setShowConvList(false);
      refetchConvs();
    }

    setLocalMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setStreaming(true);

    setLocalMessages((prev) => [...prev, { role: "assistant", content: "", streaming: true }]);

    try {
      const body: Record<string, unknown> = { content: text };
      if (companyContext) body.companyContext = companyContext;

      const res = await fetch(`${BASE}/api/anthropic/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const json = JSON.parse(line.slice(6));
            if (json.content) {
              setLocalMessages((prev) => {
                const msgs = [...prev];
                const last = msgs[msgs.length - 1];
                if (last?.streaming) {
                  msgs[msgs.length - 1] = { ...last, content: last.content + json.content };
                }
                return msgs;
              });
            }
            if (json.done) {
              setLocalMessages((prev) => {
                const msgs = [...prev];
                const last = msgs[msgs.length - 1];
                if (last?.streaming) {
                  msgs[msgs.length - 1] = { ...last, streaming: false };
                }
                return msgs;
              });
            }
          } catch {}
        }
      }
    } catch (err) {
      setLocalMessages((prev) => {
        const msgs = [...prev];
        const last = msgs[msgs.length - 1];
        if (last?.streaming) {
          msgs[msgs.length - 1] = { ...last, content: "Sorry, something went wrong. Please try again.", streaming: false };
        }
        return msgs;
      });
    } finally {
      setStreaming(false);
      refetchConv();
    }
  }, [activeConvId, companyContext, createConv, refetchConvs, refetchConv, streaming]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteConv.mutateAsync({ id });
    if (activeConvId === id) {
      setActiveConvId(null);
      setLocalMessages([]);
      setShowConvList(true);
    }
    refetchConvs();
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full shadow-2xl",
          "bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200",
          "border border-primary/20 hover:scale-105 active:scale-95",
          open && "hidden"
        )}
      >
        <Sparkles className="h-4 w-4" />
        <span className="text-sm font-semibold">Ask AI Analyst</span>
      </button>

      {open && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col w-[420px] h-[620px] rounded-2xl shadow-2xl border border-border bg-background overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              {!showConvList && activeConvId && (
                <button
                  onClick={() => { setShowConvList(true); }}
                  className="p-1 rounded hover:bg-muted transition-colors"
                >
                  <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
              <Bot className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">
                {companyContext ? `Analyst · ${companyContext.ticker}` : "AI Analyst"}
              </span>
              {companyContext && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {companyContext.name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={newConversation}
                className="p-1.5 rounded hover:bg-muted transition-colors"
                title="New conversation"
              >
                <Plus className="h-4 w-4 text-muted-foreground" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {showConvList ? (
            <div className="flex flex-col flex-1 min-h-0">
              <div className="p-4 border-b border-border">
                <button
                  onClick={newConversation}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 hover:bg-primary/20 border border-primary/20 transition-colors text-left"
                >
                  <Plus className="h-4 w-4 text-primary flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-primary">New conversation</div>
                    <div className="text-xs text-muted-foreground">Ask anything about stocks or the market</div>
                  </div>
                </button>
              </div>

              {convList.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium text-foreground mb-1">Your AI Research Analyst</div>
                    <div className="text-xs text-muted-foreground leading-relaxed">Ask about any stock, compare companies, understand scores, or get entry/exit guidance.</div>
                  </div>
                  <div className="w-full space-y-2">
                    {SUGGESTED.map((s) => (
                      <button
                        key={s}
                        onClick={() => { newConversation().then(() => sendMessage(s)); }}
                        className="w-full text-left text-xs px-3 py-2 rounded-lg border border-border hover:border-primary/40 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-1">
                    {[...convList].reverse().map((conv) => (
                      <div
                        key={conv.id}
                        onClick={() => openConversation(conv.id)}
                        className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted cursor-pointer group transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <MessageCircle className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm truncate">{conv.title}</span>
                        </div>
                        <button
                          onClick={(e) => handleDelete(conv.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-all"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          ) : (
            <div className="flex flex-col flex-1 min-h-0">
              <ScrollArea className="flex-1 px-4">
                <div className="py-4 space-y-4">
                  {localMessages.length === 0 && (
                    <div className="text-center py-8">
                      <div className="text-xs text-muted-foreground">
                        {companyContext
                          ? `Ask me anything about ${companyContext.name} — entry timing, valuation, risks, price targets…`
                          : "Ask me anything about stocks, markets, or your portfolio strategy."}
                      </div>
                      <div className="mt-4 space-y-2">
                        {(companyContext
                          ? [
                              `Is ${companyContext.ticker} a good entry right now?`,
                              `What are the biggest risks for ${companyContext.ticker}?`,
                              `Give me a price target and DCF fair value for ${companyContext.ticker}`,
                              `Compare ${companyContext.ticker} to its sector peers`,
                            ]
                          : SUGGESTED.slice(0, 3)
                        ).map((s) => (
                          <button
                            key={s}
                            onClick={() => sendMessage(s)}
                            className="w-full text-left text-xs px-3 py-2 rounded-lg border border-border hover:border-primary/40 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {localMessages.map((msg, i) => (
                    <div key={i} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
                      {msg.role === "assistant" && (
                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mt-0.5">
                          <Bot className="h-3.5 w-3.5 text-primary" />
                        </div>
                      )}
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground rounded-tr-sm"
                            : "bg-muted text-foreground rounded-tl-sm"
                        )}
                      >
                        {msg.role === "assistant" ? (
                          <div className="prose prose-sm prose-invert max-w-none leading-relaxed [&>p]:mb-2 [&>ul]:mb-2 [&>ol]:mb-2 [&>h1]:text-sm [&>h2]:text-sm [&>h3]:text-sm [&>strong]:text-foreground">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                            {msg.streaming && (
                              <span className="inline-block w-1.5 h-4 bg-primary/60 animate-pulse ml-0.5 rounded-sm" />
                            )}
                          </div>
                        ) : (
                          <span className="leading-relaxed">{msg.content}</span>
                        )}
                      </div>
                      {msg.role === "user" && (
                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center mt-0.5">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
              </ScrollArea>

              <div className="p-3 border-t border-border bg-card/50">
                <div className="flex items-end gap-2 bg-muted rounded-xl px-3 py-2 border border-border focus-within:border-primary/50 transition-colors">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={companyContext ? `Ask about ${companyContext.ticker}…` : "Ask your analyst anything…"}
                    className="flex-1 bg-transparent text-sm resize-none outline-none min-h-[20px] max-h-[100px] leading-relaxed placeholder:text-muted-foreground"
                    rows={1}
                    disabled={streaming}
                  />
                  <button
                    onClick={() => sendMessage(input)}
                    disabled={!input.trim() || streaming}
                    className="flex-shrink-0 p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
                  >
                    {streaming ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
                <div className="text-center mt-1.5">
                  <span className="text-[10px] text-muted-foreground/50">Powered by Claude · ~1.5¢ per message</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
