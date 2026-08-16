"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { profileService } from "@/lib/services/profile";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useMoodTheme } from "./useMoodTheme";

/**
 * المزاج يملكه الجذر لا الصفحة.
 *
 * كان كل صفحة تحمل حالة مزاجها وتنادي useMoodTheme بنفسها، فوقع
 * خطآن: الصفحات اللي ما تناديه (خطة اليوم، تحليل المخاطر، التصويت)
 * ما تتلوّن أصلاً، والأسوأ أن تنظيف الـ hook يمسح data-mood عند
 * مغادرة الرئيسية — فالانتقال لخطة اليوم كان يشيل اللون فعلياً لا
 * ينساه فقط.
 *
 * جعل الـ hook مشتركاً ما كفى لأن الحالة بقيت موزّعة. المزوّد يعيش
 * في التخطيط الجذري: يُركّب مرة، وما ينفكّ مع التنقّل، فالسمة تبقى
 * على <html> في كل المسارات.
 */
const MoodContext = createContext(null);

export function MoodProvider({ children }) {
  const { user } = useAuth();

  // المزاج موسوم بصاحبه، ويُشتق عند الرندر بدل ما يُصفَّر داخل أثر:
  // التصفير بـ setState في جسم الأثر ممنوع هنا، والوسم يخلي مزاج
  // الحساب السابق يسقط من نفسه عند الخروج.
  const [owned, setOwned] = useState({ userId: null, mood: null });

  // معاينة الإعدادات: تعلو على المحفوظ مؤقتاً وترجع عند المغادرة.
  // undefined = لا معاينة، null = معاينة «بدون مزاج». التمييز لازم:
  // ‎??‎ وحدها تخلط الاثنين فتُظهر ضغطة «بدون» اللونَ المحفوظ.
  const [preview, setPreview] = useState(undefined);

  // البذرة مرة واحدة لكل مستخدم — لولا الوسم لعاد تفضيل البروفايل
  // بعد كل تنقّل فيدهس اختياراً غيّره المستخدم قبل قليل
  const seededFor = useRef(null);

  const currentUserId = user?.id ?? null;

  useEffect(() => {
    if (!user) return;
    if (seededFor.current === user.id) return;
    seededFor.current = user.id;

    let active = true;
    profileService.get().then((result) => {
      if (!active || !result.ok || !result.profile.default_mood) return;
      setOwned({ userId: user.id, mood: result.profile.default_mood });
    });

    return () => {
      active = false;
    };
  }, [user]);

  const mood = owned.userId === currentUserId ? owned.mood : null;

  const setMood = useCallback(
    (next) => setOwned({ userId: currentUserId, mood: next }),
    [currentUserId],
  );

  useMoodTheme(preview !== undefined ? preview : mood);

  return (
    <MoodContext.Provider value={{ mood, setMood, preview, setPreview }}>
      {children}
    </MoodContext.Provider>
  );
}

export function useMood() {
  const context = useContext(MoodContext);
  if (!context) throw new Error("useMood خارج MoodProvider");
  return context;
}

/**
 * معاينة الإعدادات تُضبط في معالج الضغطة لا في أثر — المعاينة نتيجة
 * فعل من المستخدم، وضبط الحالة داخل جسم الأثر ممنوع في هذا المشروع.
 * هذا الـ hook مسؤول عن الإلغاء فقط: مغادرة الصفحة بلا حفظ ترجّع
 * اللون للمحفوظ في البروفايل.
 */
export function useClearMoodPreview() {
  const { setPreview } = useMood();
  useEffect(() => () => setPreview(undefined), [setPreview]);
}
