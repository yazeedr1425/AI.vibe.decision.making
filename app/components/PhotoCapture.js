"use client";

import { useEffect, useRef, useState } from "react";
import { shrinkImage } from "@/lib/vision/shrink";
import { Camera, TriangleAlert } from "./icons";

/**
 * «صوّر خياراتك» — صورة منيو أو منتجين أو عرضين، والخيارات تتعبى
 * بلا كتابة. يكمل الإملاء الصوتي: ذاك للي يتكلم، وهذا للي قدامه
 * الخيارات مطبوعة أصلاً.
 *
 * capture="environment" يفتح الكاميرا الخلفية مباشرة على الجوال،
 * وعلى الكمبيوتر يفتح منتقي الملفات — نفس الخاصية تخدم الحالتين.
 */
export default function PhotoCapture({ onOptions }) {
  const inputRef = useRef(null);
  const abort = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [scene, setScene] = useState(null);

  useEffect(() => () => abort.current?.abort(), []);

  const read = async (file) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setScene(null);

    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;

    try {
      const { base64, mimeType } = await shrinkImage(file);

      const res = await fetch("/api/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mimeType }),
        signal: controller.signal,
      });
      const payload = await res.json().catch(() => null);
      if (controller.signal.aborted) return;

      if (!res.ok || !payload?.ok) {
        setError(payload?.error ?? "ما قدرنا نقرأ الصورة — جرب مرة ثانية.");
        return;
      }

      setScene(payload.scene);
      onOptions(payload.options);
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error("[photo] failed:", err);
      setError("ما قدرنا نقرأ الصورة — جرب مرة ثانية.");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          read(e.target.files?.[0]);
          // نفس الملف مرتين (بعد خطأ مثلاً) ما يطلق change بدون تصفير
          e.target.value = "";
        }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground disabled:opacity-50"
      >
        <Camera size={16} />
        {busy ? "… نقرأ الصورة" : "صوّر خياراتك"}
      </button>

      {error && (
        <p
          role="status"
          className="flex w-full items-center gap-1.5 text-sm text-muted"
        >
          <TriangleAlert size={15} className="shrink-0" />
          {error}
        </p>
      )}

      {scene && !error && (
        <p role="status" className="w-full text-sm text-muted">
          {scene}
        </p>
      )}
    </>
  );
}
