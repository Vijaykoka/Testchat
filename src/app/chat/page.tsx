"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, MessageCircle, ChevronDown } from "lucide-react";

interface Source {
  source: string;
  page: number;
  title: string;
  score: number;
  snippet: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi! Ask me anything about our product manuals and documentation.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSources, setShowSources] = useState<Record<number, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function toggleSources(idx: number) {
    setShowSources((prev) => ({ ...prev, [idx]: !prev[idx] }));
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) throw new Error("Request failed");
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer, sources: data.sources },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I couldn't process your request." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-[#070d1a]">
      <header className="flex items-center justify-between border-b border-[#4BACC6]/10 bg-[#0E2841]/60 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#4BACC6]/20">
            <MessageCircle className="h-5 w-5 text-[#4BACC6]" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Support</h1>
            <p className="text-xs text-[#4BACC6]">Ask about any product manual</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-[#4BACC6]/10 px-3 py-1.5">
          <span className="h-2 w-2 rounded-full bg-green-400" />
          <span className="text-xs text-[#4BACC6]">Online</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.map((msg, i) => (
            <div key={i}>
              <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-5 py-3 text-sm leading-relaxed md:text-base ${
                    msg.role === "user"
                      ? "bg-gradient-to-r from-[#4BACC6] to-[#2A8AA6] text-white"
                      : "glass text-slate-200"
                  }`}
                >
                  {msg.content}
                </div>
              </div>

              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-1 flex justify-start">
                  <button
                    onClick={() => toggleSources(i)}
                    className="flex items-center gap-1 rounded-lg px-3 py-1 text-xs text-[#4BACC6]/70 transition-colors hover:bg-[#4BACC6]/10 hover:text-[#4BACC6]"
                  >
                    <ChevronDown className={`h-3 w-3 transition-transform ${showSources[i] ? "rotate-180" : ""}`} />
                    {showSources[i] ? "Hide" : "View"} sources ({msg.sources.length})
                  </button>
                </div>
              )}

              {msg.sources && showSources[i] && (
                <div className="mt-1 flex flex-wrap gap-2">
                  {msg.sources.map((src, j) => (
                    <div key={j} className="rounded-lg border border-[#4BACC6]/10 bg-[#4BACC6]/5 px-3 py-2">
                      <p className="text-xs font-medium text-[#4BACC6]">
                        {src.source.replace(/\.pdf$/i, "")} &mdash; Page {src.page}
                      </p>
                      <p className="mt-0.5 text-xs leading-tight text-slate-500">{src.snippet}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="glass flex items-center gap-2 rounded-2xl px-5 py-3 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching documentation...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="border-t border-[#4BACC6]/10 bg-[#0E2841]/60 px-4 py-4 md:px-8">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about product manuals..."
            className="flex-1 rounded-xl border border-[#4BACC6]/15 bg-[#070d1a] px-5 py-3 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-[#4BACC6]/40 md:text-base"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-[#4BACC6] to-[#2A8AA6] text-white transition-all duration-200 hover:brightness-110 active:scale-95 disabled:opacity-40"
            aria-label="Send"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
