-- ============================================================
-- إصلاح ثغرات وصول الضيوف (RLS)
-- المشكلة: السياسات القديمة تسمح لأي شخص يملك anon key بقراءة
-- كل القرارات الجماعية وخياراتها وأصواتها — بما فيها share_code —
-- بدون ما يعرف الرابط. RLS يفلتر الصفوف، لكنه ما يقدر يفرض على
-- العميل إنه يفلتر بـ share_code.
--
-- الحل: الضيوف ما عاد لهم وصول مباشر للجداول. كل شي يمر عبر
-- دوال security definer تطلب share_code كوسيط.
-- ============================================================


-- ============================================================
-- 1) إلغاء وصول الضيوف المباشر
-- ============================================================

drop policy if exists "decisions_public_group_select" on public.decisions;

drop policy if exists "options_select_visible" on public.options;
create policy "options_select_owner" on public.options
  for select to authenticated
  using (public.decision_is_owned(decision_id));

drop policy if exists "votes_select_group" on public.votes;
create policy "votes_select_owner" on public.votes
  for select to authenticated
  using (public.decision_is_owned(decision_id));

-- الإدخال المباشر للأصوات ممنوع نهائياً — يمر عبر cast_vote فقط،
-- لأن السياسة القديمة كانت تسمح للضيف يحدد weight بنفسه
drop policy if exists "votes_insert_open" on public.votes;

-- ما عادت مستخدمة بعد إزالة سياسات الضيوف
drop function if exists public.decision_is_visible(uuid);


-- ============================================================
-- 2) قراءة صفحة التصويت عبر share_code
-- ترجع القرار + الخيارات + النتائج الحالية، بدون تسريب share_code
-- ============================================================

create or replace function public.get_vote_page(code text)
returns jsonb
language sql
stable
security definer set search_path = public
as $$
  select jsonb_build_object(
    'decision', jsonb_build_object(
      'id',        d.id,
      'title',     d.title,
      'category',  d.category,
      'status',    d.status,
      'closes_at', d.closes_at,
      'is_open',   d.status = 'open' and (d.closes_at is null or d.closes_at > now()),
      'winner_option_id', d.winner_option_id
    ),
    'options', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',        o.id,
        'label',     o.label,
        'image_url', o.image_url,
        'votes',     coalesce((select sum(v.weight) from public.votes v where v.option_id = o.id), 0)
      ) order by o.created_at)
      from public.options o
      where o.decision_id = d.id
    ), '[]'::jsonb)
  )
  from public.decisions d
  where d.share_code = code and d.mode = 'group';
$$;


-- ============================================================
-- 3) تسجيل صوت عبر share_code
-- الوزن مثبّت على 1 — ما عاد العميل يقدر يتحكم فيه
-- ============================================================

create or replace function public.cast_vote(code text, p_option_id uuid, p_voter_name text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  d_id uuid;
begin
  if p_voter_name is null or btrim(p_voter_name) = '' then
    raise exception 'الاسم مطلوب' using errcode = '22023';
  end if;

  select d.id into d_id
  from public.decisions d
  where d.share_code = code
    and d.mode   = 'group'
    and d.status = 'open'
    and (d.closes_at is null or d.closes_at > now());

  if d_id is null then
    raise exception 'التصويت مقفل أو الرابط غير صحيح' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.options o
    where o.id = p_option_id and o.decision_id = d_id
  ) then
    raise exception 'الخيار لا ينتمي لهذا القرار' using errcode = '22023';
  end if;

  insert into public.votes (decision_id, option_id, voter_name, weight)
  values (d_id, p_option_id, btrim(p_voter_name), 1);
exception
  when unique_violation then
    raise exception 'هذا الاسم صوّت من قبل في هذا القرار' using errcode = '23505';
end;
$$;


-- ============================================================
-- 4) الصلاحيات
-- ============================================================

grant execute on function public.get_vote_page(text)              to anon, authenticated;
grant execute on function public.cast_vote(text, uuid, text)      to anon, authenticated;


-- ============================================================
-- 5) قيد إضافي: الفائز لازم يكون خياراً من نفس القرار
-- (بـ trigger مو composite FK، عشان نحافظ على on delete set null)
-- ============================================================

create or replace function public.check_winner_belongs()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.winner_option_id is not null and not exists (
    select 1 from public.options o
    where o.id = new.winner_option_id and o.decision_id = new.id
  ) then
    raise exception 'الفائز لازم يكون خياراً من نفس القرار';
  end if;
  return new;
end;
$$;

drop trigger if exists decisions_winner_check on public.decisions;
create trigger decisions_winner_check
  before insert or update of winner_option_id on public.decisions
  for each row execute function public.check_winner_belongs();
