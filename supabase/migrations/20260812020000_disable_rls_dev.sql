-- ============================================================
-- تعطيل RLS مؤقتاً أثناء التطوير
--
-- ⚠️ تحذير: بعد تشغيل هذا الملف، أي شخص يملك anon key
-- (وهو يُشحن مع كل صفحة في المتصفح) يقدر يقرأ ويكتب ويحذف
-- في كل الجداول الستة بدون أي قيد.
--
-- مقبول الحين لأن ما فيه بيانات حقيقية ولا مستخدمين،
-- لكن لازم يُعاد تفعيله قبل ما يستخدم التطبيق أي شخص غيرك.
-- انظر القسم الأخير للتراجع.
-- ============================================================

alter table public.profiles  disable row level security;
alter table public.decisions disable row level security;
alter table public.options   disable row level security;
alter table public.answers   disable row level security;
alter table public.votes     disable row level security;
alter table public.feedback  disable row level security;


-- ============================================================
-- ملاحظة: هذا الأمر لا يحذف السياسات — تبقى معرّفة في القاعدة
-- لكنها متوقفة. بمجرد إعادة تفعيل RLS ترجع تشتغل كما هي.
--
-- سياسات storage.objects غير متأثرة — الـ bucket لسه محمي.
-- ============================================================


-- ============================================================
-- للتراجع (شغّل هذا قبل الإطلاق):
--
-- alter table public.profiles  enable row level security;
-- alter table public.decisions enable row level security;
-- alter table public.options   enable row level security;
-- alter table public.answers   enable row level security;
-- alter table public.votes     enable row level security;
-- alter table public.feedback  enable row level security;
--
-- وبعدها شغّل 20260812010000_fix_guest_access_rls.sql
-- لأن السياسات الأصلية فيها ثغرة share_code.
-- ============================================================
