-- ============================================================
-- سجل الفائزين — public.decision_winners
--
-- `decisions.winner_option_id` عمودٌ واحد يُكتب فوقه: النقاش يقلب
-- الحكم فيمحو ما قبله، والإقفال يكتب فوق ما كان. فيبقى في القاعدة
-- الفائز الأخير وحده، وما ضاع ليس زينة — «حكم المحرّك بكذا ثم
-- صحّحه المستخدم لكذا» هو بالضبط المادة التي تميّز رأياً قَبِله
-- المستخدم من رأيٍ رفضه، وعليها يُبنى ما يقرأه `/api/patterns`.
--
-- فالعمود يبقى كما هو، مؤشراً على الفائز الحالي بقراءة واحدة
-- (تقرأه `get_vote_page` للضيف، وسجل القرارات، و`/api/decide`)،
-- وهذا الجدول يحفظ كيف وصلنا إليه. مؤشرٌ وسجل، لا بديلان.
-- ============================================================


-- ============================================================
-- 1) الجدول
-- ============================================================

create table if not exists public.decision_winners (
  id           uuid primary key default gen_random_uuid(),
  decision_id  uuid not null references public.decisions (id) on delete cascade,
  -- `set null` لا `cascade`، ونصوّر التسمية معه: حذف الخيار يفقدنا
  -- المرجع لا الواقعة — والسجل الذي تُحذف منه وقائع ليس سجلاً
  option_id    uuid references public.options (id) on delete set null,
  option_label text not null,
  -- من أين جاء هذا الحكم. `backfill` للصفوف التي عبّأناها من العمود
  -- وقت هذه المهاجرة، ومصدرها الحقيقي غير معروف
  source       text not null check (source in ('decide', 'discuss', 'vote', 'backfill')),
  -- تعليل الحكم كما كُتب للمستخدم: سبب المحرّك، أو رد النقاش، أو
  -- إعلان التصويت. اختياري — الواقعة تصح بدونه
  reason       text,
  created_at   timestamptz not null default now()
);

-- القراءة الوحيدة المتوقعة: «أحكام هذا القرار مرتّبة» — فالفهرس
-- المركّب يخدمها ويغطي المفتاح الأجنبي في آن
create index if not exists decision_winners_decision_idx
  on public.decision_winners (decision_id, created_at desc);

create index if not exists decision_winners_option_idx
  on public.decision_winners (option_id);


-- ============================================================
-- 2) الفائز لازم يكون خياراً من نفس القرار
-- نفس حارس `check_winner_belongs` على العمود، ولنفس السبب: قيد
-- مركّب على (option_id, decision_id) يمنع `on delete set null`
-- ============================================================

create or replace function public.check_winner_row_belongs()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.option_id is not null and not exists (
    select 1 from public.options o
    where o.id = new.option_id and o.decision_id = new.decision_id
  ) then
    raise exception 'الفائز لازم يكون خياراً من نفس القرار';
  end if;
  return new;
end;
$$;

drop trigger if exists decision_winners_belong_check on public.decision_winners;
create trigger decision_winners_belong_check
  before insert or update of option_id, decision_id on public.decision_winners
  for each row execute function public.check_winner_row_belongs();

-- دالة مُشغِّل لا تُستدعى كـ RPC، والمُشغِّل لا يفحص صلاحية EXECUTE
-- على دالته — فسحبها لا يعطّل الفحص. مثل `check_winner_belongs`
revoke execute on function public.check_winner_row_belongs() from public, anon, authenticated;


-- ============================================================
-- 3) RLS — لصاحب القرار وحده، وبلا تعديل ولا حذف
-- الضيف لا يمر من هنا: صفحة التصويت تقرأ الفائز من `get_vote_page`
-- ============================================================

alter table public.decision_winners enable row level security;

drop policy if exists "decision_winners_owner_select" on public.decision_winners;
create policy "decision_winners_owner_select" on public.decision_winners
  for select to authenticated
  using (public.decision_is_owned(decision_id));

drop policy if exists "decision_winners_owner_insert" on public.decision_winners;
create policy "decision_winners_owner_insert" on public.decision_winners
  for insert to authenticated
  with check (public.decision_is_owned(decision_id));

-- ملاحظة مقصودة، مثل `votes`: ما فيه سياسة update ولا delete.
-- سجلٌ يُعدَّل بأثر رجعي لا يشهد على شيء


-- ============================================================
-- 4) تعبئة الموجود
--
-- المصدر `backfill` لا `decide`: قرارٌ قديم قد يكون فائزه حكم
-- المحرّك وقد يكون تصحيح النقاش، ولا شيء في القاعدة يفرّق. وأول
-- ما يُكتب في سجلٍ غرضه أن يكون شاهداً لا يصح أن يكون تخميناً.
--
-- `created_at` من القرار لا `now()`، وإلا بدت كل الأحكام القديمة
-- كأنها وقعت لحظة المهاجرة.
-- ============================================================

insert into public.decision_winners
  (decision_id, option_id, option_label, source, created_at)
select d.id, o.id, o.label, 'backfill', d.created_at
from public.decisions d
join public.options o on o.id = d.winner_option_id
where not exists (
  select 1 from public.decision_winners w where w.decision_id = d.id
);
