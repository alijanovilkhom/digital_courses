"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

type Msg = { id: number; role: "user" | "assistant"; content: string; sources?: string[] };
type ErrorCode = "not_configured" | "rate_limited" | "quota" | "busy" | "upstream" | "bad_request" | "network";

const EXAMPLES = ["e1", "e2", "e3", "e4"] as const;
const KNOWN_ERRORS = new Set<string>(["not_configured", "rate_limited", "quota", "busy", "upstream", "bad_request"]);
const MAX_QUESTION = 1000; // keep in step with the limit in /api/chat
const MAX_SOURCES = 3;

class ChatError extends Error {
  constructor(public code: ErrorCode) {
    super(code);
  }
}

function readSources(res: Response): string[] {
  try {
    const list = JSON.parse(decodeURIComponent(res.headers.get("x-sources") ?? "[]")) as string[];
    // File name only, without the folder, and the first few: they are ordered by relevance
    return [...new Set(list.map((s) => s.split("/").pop() ?? s))].slice(0, MAX_SOURCES);
  } catch {
    return [];
  }
}

export default function Assistant() {
  const t = useTranslations("Assistant");
  const locale = useLocale();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const nextId = useRef(0);

  // Keep the newest text in view inside the chat box only; the page itself does not scroll
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, error]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || loading) return;

    const before = messages;
    const history = [...before, { id: nextId.current++, role: "user" as const, content: text }];
    const botId = nextId.current++;
    setMessages([...history, { id: botId, role: "assistant", content: "" }]);
    setInput("");
    setError(null);
    setLoading(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let answer = "";
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({ locale, messages: history.map(({ role, content }) => ({ role, content })) }),
      });
      if (!res.ok) {
        const { error: code } = await res.json().catch(() => ({ error: "upstream" }));
        throw new ChatError(KNOWN_ERRORS.has(code) ? code : "upstream");
      }
      const sources = readSources(res);
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setMessages((m) => m.map((x) => (x.id === botId ? { ...x, content: answer } : x)));
      }
      setMessages((m) => m.map((x) => (x.id === botId ? { ...x, content: answer, sources } : x)));
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setError(err instanceof ChatError ? err.code : "network");
      if (!answer) {
        // Nothing arrived: take the question back out and return it to the field so it can be sent again
        setMessages(before);
        setInput(text);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="section" id="assistant">
      <div className="wrap grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-6">
        <div className="lg:col-span-5">
          <h2>{t("title")}</h2>
          <p className="section__intro">{t("intro")}</p>
          <ul className="flex flex-col gap-2">
            {EXAMPLES.map((key) => (
              <li key={key}>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => ask(t(`examples.${key}`))}
                  className="flex min-h-11 w-full items-center rounded-[var(--r-sm)] border border-border bg-surface px-4 py-2 text-left transition-colors hover:bg-raised disabled:opacity-50"
                >
                  {t(`examples.${key}`)}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex h-[min(560px,70svh)] flex-col rounded-[var(--r-lg)] border border-border bg-surface lg:col-span-7">
          <div className="flex items-center justify-between border-b border-border px-5 py-2">
            <span className="font-medium">{t("title")}</span>
            <button
              type="button"
              onClick={() => {
                abortRef.current?.abort();
                setMessages([]);
                setError(null);
                setLoading(false);
              }}
              disabled={messages.length === 0}
              className="min-h-11 text-sm text-muted transition-colors hover:text-foreground disabled:invisible"
            >
              {t("clear")}
            </button>
          </div>

          <div
            ref={listRef}
            role="log"
            aria-live="polite"
            aria-label={t("chatLabel")}
            className="flex flex-1 flex-col gap-4 overflow-y-auto p-5"
          >
            {messages.length === 0 && <p className="text-muted">{t("emptyHint")}</p>}
            {messages.map((m) =>
              m.role === "user" ? (
                <p key={m.id} className="max-w-[85%] self-end whitespace-pre-wrap rounded-[var(--r-sm)] bg-raised px-4 py-3">
                  {m.content}
                </p>
              ) : (
                <div key={m.id} className="max-w-[85%]">
                  {m.content ? (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  ) : (
                    <p className="text-muted">{t("thinking")}</p>
                  )}
                  {m.sources && m.sources.length > 0 && (
                    <p className="mt-2 font-mono text-[13px] text-muted">
                      {t("sources")}: {m.sources.join(", ")}
                    </p>
                  )}
                </div>
              ),
            )}
            {error && (
              <p role="alert" className="rounded-[var(--r-sm)] border border-border px-4 py-3">
                {t(`errors.${error}`)}
              </p>
            )}
          </div>

          <form
            className="flex gap-3 border-t border-border p-4"
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={MAX_QUESTION}
              placeholder={t("placeholder")}
              aria-label={t("inputLabel")}
              autoComplete="off"
              className="h-11 min-w-0 flex-1 rounded-[var(--r-sm)] border border-border bg-background px-4 placeholder:text-muted"
            />
            <button type="submit" disabled={loading || !input.trim()} className="btn btn--primary disabled:opacity-50">
              {t("send")}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
