"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

// ما الذي على الشاشة الآن، ومن يقدر يغيّره.
//
// المساعد ما ينفع بلا هذا: «وين أنا؟» تحتاج معرفة الخطوة، و«حطها
// برجر وسوشي» تحتاج يد تصل لحالة الصفحة. الصفحة تسجّل لقطتها
// وأفعالها هنا، والمساعد يقرأ ويستدعي.
//
// ⚠️ التسجيل عبر ref لا state: الصفحة تسجّل في كل رندر، ولو خزّناها
// في state لصار كل تسجيل يعيد الرندر ويسجّل من جديد — حلقة لا تنتهي.
const ScreenContext = createContext(null);

export function ScreenProvider({ children }) {
  const snapshot = useRef({ screen: "غير معروف", summary: "", facts: {} });
  const actions = useRef({});

  // منطقة الإعلان: كل ما يُكتب فيها يقرأه قارئ الشاشة فوراً.
  // نضيف مسافة صفرية عند تكرار نفس النص، وإلا اعتبره القارئ بلا
  // تغيير وسكت — فخ معروف في aria-live.
  const [announcement, setAnnouncement] = useState("");
  const lastRef = useRef("");

  const announce = useCallback((text) => {
    if (!text) return;
    const next = text === lastRef.current ? `${text}​` : text;
    lastRef.current = next;
    setAnnouncement(next);
  }, []);

  const register = useCallback((next) => {
    snapshot.current = { ...snapshot.current, ...next };
  }, []);

  const registerActions = useCallback((next) => {
    actions.current = { ...actions.current, ...next };
  }, []);

  const read = useCallback(() => snapshot.current, []);
  const getActions = useCallback(() => actions.current, []);

  const value = useMemo(
    () => ({ register, registerActions, read, getActions, announce }),
    [register, registerActions, read, getActions, announce],
  );

  return (
    <ScreenContext.Provider value={value}>
      {children}
      {/* منطقة حيّة واحدة للتطبيق كله — الإعلانات المتفرقة في عدة
          مناطق تتضارب عند بعض القارئات */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>
    </ScreenContext.Provider>
  );
}

export function useScreen() {
  const ctx = useContext(ScreenContext);
  if (!ctx) throw new Error("useScreen must be used inside <ScreenProvider>");
  return ctx;
}
