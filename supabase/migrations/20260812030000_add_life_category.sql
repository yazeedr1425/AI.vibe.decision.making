-- ============================================================
-- إضافة فئة "قرار مصيري" (life)
-- التصميم الجديد يعرض 5 فئات، والقيد الحالي يقبل 4 فقط،
-- فأي محاولة حفظ لقرار مصيري كانت بترفض من القاعدة.
-- ============================================================

alter table public.decisions
  drop constraint if exists decisions_category_check;

alter table public.decisions
  add constraint decisions_category_check
  check (category in ('food', 'entertainment', 'shopping', 'time', 'life'));
