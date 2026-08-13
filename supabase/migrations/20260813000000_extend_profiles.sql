-- ============================================================
-- توسعة جدول profiles
--
-- ما أنشأنا جدول users جديد عمداً: هوية المستخدم في auth.users،
-- و profiles هو انعكاسها في السكيما العامة. أي جدول موازٍ كان
-- بيكرر الهوية، و decisions.user_id أصلاً يشير إلى auth.users.
--
-- القيم في القيود مطابقة لما في الكود:
--   lib/engine/mood.js  → hyped | calm | drained | happy
--   lib/engine/tone.js  → مرح | جدي   (موجود من قبل)
-- ============================================================

alter table public.profiles
  add column if not exists avatar_url    text,
  add column if not exists locale        text        not null default 'ar',
  add column if not exists read_aloud    boolean     not null default false,
  add column if not exists default_mood  text,
  add column if not exists last_seen_at  timestamptz;

-- اللغة: عربي أو إنجليزي فقط حالياً
alter table public.profiles
  drop constraint if exists profiles_locale_check;
alter table public.profiles
  add constraint profiles_locale_check
  check (locale in ('ar', 'en'));

-- المزاج الافتراضي: نفس معرّفات MOODS، و null تعني "بدون تفضيل"
alter table public.profiles
  drop constraint if exists profiles_default_mood_check;
alter table public.profiles
  add constraint profiles_default_mood_check
  check (default_mood is null or default_mood in ('hyped', 'calm', 'drained', 'happy'));

-- ============================================================
-- توثيق الأعمدة — يظهر في Table Editor وفي مخطط PostgREST
-- ============================================================

comment on column public.profiles.avatar_url   is 'رابط صورة المستخدم (اختياري)';
comment on column public.profiles.locale       is 'لغة الواجهة: ar أو en';
comment on column public.profiles.read_aloud   is 'تفضيل القراءة الصوتية — كان محفوظاً في localStorage فقط';
comment on column public.profiles.default_mood is 'المزاج الافتراضي عند فتح التطبيق';
comment on column public.profiles.last_seen_at is 'آخر نشاط، لقياس الاستخدام لاحقاً';

-- ============================================================
-- ملاحظة على RLS: ما نحتاج سياسات جديدة.
--   profiles_select_own و profiles_update_own تغطيان الأعمدة الجديدة،
--   والإدخال يتم من trigger handle_new_user وهو security definer
--   فيتجاوز RLS. القيم الافتراضية تنطبق على الصفوف الجديدة تلقائياً.
-- ============================================================
