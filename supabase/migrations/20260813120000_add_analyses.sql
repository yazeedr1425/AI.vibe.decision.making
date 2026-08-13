-- ============================================================
-- وكيل تحليل المخاطر — جدول التحليلات الاستراتيجية
--
-- ليش جدول مستقل بدل ما نضيف فئة لـ decisions؟
-- شكل البيانات مختلف جذرياً: decisions مبني على خيارات قصيرة
-- (جدول options) وإجابات مفتاحية (جدول answers)، بينما التحليل
-- الاستراتيجي مخرجاته وثائق منظّمة (SWOT، شجرة مسارات، مراجع).
-- دمجهما كان بيجبرنا نحشر jsonb في decisions ونخلي نصف أعمدة
-- كل صف فاضية.
-- ============================================================

create table if not exists public.analyses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,

  -- المدخل الخام من المستخدم
  statement   text not null,
  context     text,

  -- مخرجات كل وكيل، بترتيب خط الأنابيب
  findings    text,               -- الباحث: نص مع حقائق السوق
  sources     jsonb not null default '[]'::jsonb,  -- [{uri, title}] من grounding
  swot        jsonb,              -- {strengths, weaknesses, opportunities, threats}
  paths       jsonb not null default '[]'::jsonb,  -- شجرة المسارات + درجات المخاطرة
  challenges  jsonb,              -- محامي الشيطان
  recommendation jsonb,           -- المُركِّب

  model       text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_analyses_user_created
  on public.analyses (user_id, created_at desc);


-- ============================================================
-- RLS — نفس نمط decisions_owner_all: المالك فقط.
--
-- ⚠️ ملاحظة: 20260812020000_disable_rls_dev.sql يعطّل RLS على
-- الجداول الستة الأصلية. هذا الجدول جديد فـ RLS يبقى مفعّلاً
-- عليه. لو صار سلوك غير متوقع أثناء التطوير، السبب هو ذا —
-- والحل الصحيح إعادة تفعيل RLS على البقية، مو تعطيله هنا.
-- ============================================================

alter table public.analyses enable row level security;

drop policy if exists analyses_owner_all on public.analyses;
create policy analyses_owner_all
  on public.analyses
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
