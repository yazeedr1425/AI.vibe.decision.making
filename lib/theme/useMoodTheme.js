"use client";

import { useEffect } from "react";

/**
 * يكتب data-mood على <html>، فتتبدل متغيرات CSS كلها ويتلوّن الموقع.
 *
 * كان هذا الأثر موجوداً في الصفحة الرئيسية فقط، فتغيير "المزاج
 * الافتراضي" في الإعدادات كان يحفظ القيمة بدون ما يتغير أي لون —
 * المستخدم يختار ولا يشوف نتيجة. صار hook مشترك حتى ما تفترق
 * الصفحتان مرة ثانية.
 *
 * التنظيف يشيل السمة عند مغادرة الصفحة، فلو خرجت من الإعدادات بدون
 * حفظ يرجع اللون لما هو محفوظ فعلاً في بروفايلك.
 */
export function useMoodTheme(mood) {
  useEffect(() => {
    const root = document.documentElement;
    if (mood) root.dataset.mood = mood;
    else delete root.dataset.mood;

    return () => {
      delete root.dataset.mood;
    };
  }, [mood]);
}
