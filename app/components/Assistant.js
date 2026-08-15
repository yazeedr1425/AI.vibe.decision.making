"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useScreen } from "@/lib/a11y/ScreenContext";
import { Sparkles, TriangleAlert } from "./icons";

const ROUTES = {
  home: "/",
  how: "/how",
  plan: "/plan",
  analyze: "/analyze",
  settings: "/settings",
  login: "/login",
  history: "/#history",
};

const OPENING = "المساعد جاهز. اسأل وين أنت، أو قل له وش تبي يسوي.";

/**
 * مساعد الوصول — نافذة نصية تُفتح من أي مكان بـ Alt+M.
 *
 * ما ينطق شيئاً بنفسه: الرد نص يدخل منطقة aria-live، وقارئ الشاشة
 * يقرأه بصوت المستخدم وسرعته وإعداداته. تطبيق ينطق فوق قارئ الشاشة
 * يزاحمه ويطلع صوتان فوق بعض — وهذا أسوأ من لا شي.
 *
 * والزر مو للمكفوفين وحدهم: أي واحد يبي ينجز بلا فأرة يستفيد.
 */
export default function Assistant() {
  const router = useRouter();
  const { read, getActions, announce } = useScreen();

  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [log, setLog] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const inputRef = useRef(null);
  const dialogRef = useRef(null);
  const openerRef = useRef(null);
  const logRef = useRef([]);

  useEffect(() => {
    logRef.current = log;
  }, [log]);

  // Alt+M من أي مكان. Alt عشان ما نسرق حرفاً من حقول الكتابة —
  // اختصار بحرف مجرد يكسر الكتابة على مستخدم قارئ الشاشة.
  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "m") {
        e.preventDefault();
        openerRef.current = document.activeElement;
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // فتح: التركيز داخل الحقل + إعلان الجاهزية. إغلاق: التركيز يرجع
  // لمن فتح — بدونها يضيع مستخدم لوحة المفاتيح في أول الصفحة.
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      announce(OPENING);
    } else if (openerRef.current instanceof HTMLElement) {
      openerRef.current.focus();
      openerRef.current = null;
    }
  }, [open, announce]);

  // حبس التركيز داخل النافذة + Escape للإغلاق
  const onDialogKey = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
      return;
    }
    if (e.key !== "Tab") return;
    const focusables = dialogRef.current?.querySelectorAll(
      'button, [href], input, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (!focusables?.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const runActions = useCallback(
    (actions) => {
      const api = getActions();
      for (const action of actions) {
        switch (action.type) {
          case "set_options":
            api.setOptions?.(action.options);
            break;
          case "set_category":
            api.setCategory?.(action.categoryId);
            break;
          case "set_mood":
            api.setMood?.(action.moodId);
            break;
          case "decide":
            api.decide?.();
            break;
          case "breakdown":
            api.breakdown?.();
            break;
          case "restart":
            api.restart?.();
            break;
          case "read_result":
            if (api.readResult) announce(api.readResult());
            break;
          case "go":
            router.push(ROUTES[action.page] ?? "/");
            break;
          default:
            break;
        }
      }
    },
    [getActions, router, announce],
  );

  const send = async (e) => {
    e.preventDefault();
    const text = message.trim();
    if (!text || busy) return;

    setMessage("");
    setError(null);
    setBusy(true);
    setLog((prev) => [...prev, { who: "user", text }]);

    try {
      const res = await fetch("/api/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          snapshot: read(),
          history: logRef.current.slice(-6),
        }),
      });
      const payload = await res.json().catch(() => null);

      if (!res.ok || !payload?.ok) {
        const msg = payload?.error ?? "ما قدرت أساعدك الحين.";
        setError(msg);
        announce(msg);
        return;
      }

      setLog((prev) => [...prev, { who: "guide", text: payload.reply }]);
      // الإعلان قبل التنفيذ: المستخدم يسمع وش راح يصير قبل ما تتبدل
      // الشاشة تحته
      announce(payload.reply);
      runActions(payload.actions);
    } catch (err) {
      console.error("[assistant] failed:", err);
      const msg = "ما وصلنا للخادم — تأكد من اتصالك.";
      setError(msg);
      announce(msg);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  if (!open) {
    return (
      // مخفي بصرياً حتى يستقبل التركيز: مستخدم لوحة المفاتيح يلقاه
      // بأول Tab، ومستخدم الفأرة ما ينزعج بزر عائم
      <button
        type="button"
        onClick={() => {
          openerRef.current = document.activeElement;
          setOpen(true);
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:bottom-4 focus:start-4 focus:z-50 focus:flex focus:items-center focus:gap-2 focus:rounded-full focus:bg-ink focus:px-5 focus:py-3 focus:text-white"
      >
        <Sparkles size={16} />
        افتح مساعد الوصول — Alt وحرف M
      </button>
    );
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="مساعد الوصول"
      onKeyDown={onDialogKey}
      className="fixed bottom-0 start-0 z-50 m-4 flex w-[min(28rem,calc(100vw-2rem))] flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-[0_20px_60px_rgba(23,20,15,0.25)]"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <Sparkles size={17} className="text-accent" />
          مساعد الوصول
        </h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-line px-3 py-1 text-sm text-muted transition-colors hover:text-foreground"
        >
          إغلاق
        </button>
      </div>

      <p className="text-sm text-muted">
        اسألني وين أنت، أو قل لي وش تبيني أسوي — أعبّي خياراتك، أحسمها،
        أو أوديك لصفحة ثانية.
      </p>

      {log.length > 0 && (
        <div className="flex max-h-56 flex-col gap-2 overflow-y-auto">
          {log.map((entry, i) => (
            <p
              key={i}
              className={
                "rounded-xl px-3 py-2 text-sm leading-relaxed " +
                (entry.who === "user"
                  ? "self-start border border-line"
                  : "self-end bg-accent-soft")
              }
            >
              <span className="sr-only">
                {entry.who === "user" ? "أنت: " : "المساعد: "}
              </span>
              {entry.text}
            </p>
          ))}
        </div>
      )}

      {error && (
        <p className="flex items-center gap-1.5 text-sm text-muted">
          <TriangleAlert size={15} className="shrink-0" />
          {error}
        </p>
      )}

      <form onSubmit={send} className="flex items-center gap-2">
        <label htmlFor="assistant-input" className="sr-only">
          اكتب سؤالك أو طلبك للمساعد
        </label>
        <input
          id="assistant-input"
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={busy}
          placeholder="مثال: حطها برجر وسوشي واحسمها"
          className="w-full rounded-xl border border-line bg-background px-3 py-2.5 outline-none transition-colors focus:border-accent disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy}
          className="shrink-0 rounded-xl bg-accent px-4 py-2.5 font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "…" : "أرسل"}
        </button>
      </form>
    </div>
  );
}
