import { createClient } from "@supabase/supabase-js";

// ⚠️ سيرفر فقط — لا تستورد هذا الملف في أي كومبوننت فيه "use client".
//
// يستخدم service role key اللي يتجاوز RLS بالكامل. هذا مقصود هنا:
// سجل قرارات المستخدم محمي بسياسة decisions_owner_all اللي تعتمد على
// auth.uid()، وفي الـ route ما فيه جلسة مستخدم، فبدون service role
// الاستعلام يرجع فاضي دائماً بدل ما يرجع بيانات المستخدم.
//
// المتغير بدون بادئة NEXT_PUBLIC_ عمداً حتى ما ينحزم مع كود المتصفح.

let cached = null;

export function supabaseAdmin() {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — set both in .env.local"
    );
  }

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return cached;
}
