-- ============================================================
-- مشروع "احسم" — مخطط قاعدة البيانات + سياسات الأمان (RLS)
-- الاستخدام: انسخ الملف كامل والصقه في Supabase → SQL Editor → Run
-- ============================================================


-- ============================================================
-- 1) الجداول
-- ============================================================

-- بروفايل المستخدم (مرتبط بجدول auth.users الجاهز من Supabase)
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  tone         text not null default 'مرح' check (tone in ('مرح', 'جدي')),
  created_at   timestamptz not null default now()
);

-- القرار: إما شخصي (solo) أو جماعي بالتصويت (group)
create table if not exists public.decisions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null,
  category   text not null check (category in ('food', 'entertainment', 'shopping', 'time')),
  mode       text not null default 'solo'  check (mode in ('solo', 'group')),
  status     text not null default 'open'  check (status in ('open', 'closed')),
  -- الكود القصير اللي ينحط في رابط المشاركة: /vote/:share_code
  share_code text unique default encode(gen_random_bytes(6), 'hex'),
  closes_at  timestamptz,          -- مهلة التصويت (تُملأ في وضع group فقط)
  winner_option_id uuid,           -- يُملأ من Edge Function عند الإقفال
  created_at timestamptz not null default now()
);

-- الخيارات المطروحة داخل القرار (من 2 إلى 5 حسب الـ PRD)
create table if not exists public.options (
  id          uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.decisions (id) on delete cascade,
  label       text not null,
  image_url   text,                        -- صورة مرفوعة في Storage (اختيارية)
  score       numeric not null default 0,  -- ناتج الـ Weighted Scoring
  created_at  timestamptz not null default now()
);

-- مفتاح الفائز يُضاف بعد إنشاء جدول options (مرجع دائري)
alter table public.decisions
  drop constraint if exists decisions_winner_option_id_fkey;
alter table public.decisions
  add constraint decisions_winner_option_id_fkey
  foreign key (winner_option_id) references public.options (id) on delete set null;

-- إجابات صاحب القرار على الأسئلة الديناميكية + وزن كل إجابة
create table if not exists public.answers (
  id           uuid primary key default gen_random_uuid(),
  decision_id  uuid not null references public.decisions (id) on delete cascade,
  question_key text not null,               -- مثال: 'budget' / 'time' / 'mood'
  value        text not null,
  weight       numeric not null default 1,
  created_at   timestamptz not null default now()
);

-- أصوات المشاركين في القرار الجماعي (بدون تسجيل دخول — اسم فقط)
create table if not exists public.votes (
  id          uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.decisions (id) on delete cascade,
  option_id   uuid not null references public.options (id) on delete cascade,
  voter_name  text not null,
  weight      numeric not null default 1,   -- صوت صاحب القرار ممكن يكون أثقل
  created_at  timestamptz not null default now(),
  -- كل شخص يصوّت مرة وحدة في نفس القرار
  unique (decision_id, voter_name)
);

-- رضا المستخدم عن القرار — أساس طبقة التعلم الشخصي
create table if not exists public.feedback (
  id           uuid primary key default gen_random_uuid(),
  decision_id  uuid not null unique references public.decisions (id) on delete cascade,
  satisfaction int not null check (satisfaction between 1 and 5),
  created_at   timestamptz not null default now()
);

-- فهارس للاستعلامات المتكررة
create index if not exists idx_decisions_user     on public.decisions (user_id, created_at desc);
create index if not exists idx_decisions_share    on public.decisions (share_code);
create index if not exists idx_options_decision   on public.options (decision_id);
create index if not exists idx_answers_decision   on public.answers (decision_id);
create index if not exists idx_votes_decision     on public.votes (decision_id);


-- ============================================================
-- 2) إنشاء البروفايل تلقائياً عند تسجيل مستخدم جديد
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================
-- 3) تفعيل RLS
-- تنبيه: بمجرد تفعيله يتوقف كل شي عن الشغل إلا اللي تسمح به السياسات تحت
-- ============================================================

alter table public.profiles  enable row level security;
alter table public.decisions enable row level security;
alter table public.options   enable row level security;
alter table public.answers   enable row level security;
alter table public.votes     enable row level security;
alter table public.feedback  enable row level security;


-- ---------- profiles: كل واحد يشوف ويعدّل بروفايله فقط ----------
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);


-- ---------- decisions ----------
-- صاحب القرار: صلاحية كاملة على قراراته
drop policy if exists "decisions_owner_all" on public.decisions;
create policy "decisions_owner_all" on public.decisions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- الضيوف (anon): يقرأون القرارات الجماعية فقط.
-- الحماية الفعلية = share_code العشوائي في الرابط، لأن الـ id غير معروف للغريب.
drop policy if exists "decisions_public_group_select" on public.decisions;
create policy "decisions_public_group_select" on public.decisions
  for select to anon, authenticated
  using (mode = 'group');


-- ---------- options ----------
-- دالة مساعدة: هل هذا القرار مملوك للمستخدم الحالي أو جماعي؟
create or replace function public.decision_is_visible(d_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.decisions d
    where d.id = d_id
      and (d.user_id = auth.uid() or d.mode = 'group')
  );
$$;

create or replace function public.decision_is_owned(d_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.decisions d
    where d.id = d_id and d.user_id = auth.uid()
  );
$$;

-- دالة مساعدة: هل التصويت على هذا القرار ما زال مفتوحاً؟
create or replace function public.decision_accepts_votes(d_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.decisions d
    where d.id = d_id
      and d.mode   = 'group'
      and d.status = 'open'
      and (d.closes_at is null or d.closes_at > now())
  );
$$;

drop policy if exists "options_select_visible" on public.options;
create policy "options_select_visible" on public.options
  for select to anon, authenticated
  using (public.decision_is_visible(decision_id));

drop policy if exists "options_owner_write" on public.options;
create policy "options_owner_write" on public.options
  for all to authenticated
  using (public.decision_is_owned(decision_id))
  with check (public.decision_is_owned(decision_id));


-- ---------- answers: خاصة بصاحب القرار فقط ----------
drop policy if exists "answers_owner_all" on public.answers;
create policy "answers_owner_all" on public.answers
  for all to authenticated
  using (public.decision_is_owned(decision_id))
  with check (public.decision_is_owned(decision_id));


-- ---------- votes ----------
-- أي شخص يقرأ أصوات القرار الجماعي (عشان النتائج اللايف)
drop policy if exists "votes_select_group" on public.votes;
create policy "votes_select_group" on public.votes
  for select to anon, authenticated
  using (public.decision_is_visible(decision_id));

-- الإضافة مسموحة للضيوف، بشرط أن التصويت ما زال مفتوحاً ولم تنتهِ المهلة
drop policy if exists "votes_insert_open" on public.votes;
create policy "votes_insert_open" on public.votes
  for insert to anon, authenticated
  with check (public.decision_accepts_votes(decision_id));

-- ملاحظة مقصودة: ما فيه سياسة update/delete للأصوات — الصوت نهائي ولا يُعدّل


-- ---------- feedback: خاص بصاحب القرار ----------
drop policy if exists "feedback_owner_all" on public.feedback;
create policy "feedback_owner_all" on public.feedback
  for all to authenticated
  using (public.decision_is_owned(decision_id))
  with check (public.decision_is_owned(decision_id));


-- ============================================================
-- 4) تفعيل Realtime على الجداول اللي تتحدّث لحظياً
-- (بدون هذا الجزء لن تظهر الأصوات مباشرة في صفحة التصويت)
-- ============================================================

alter publication supabase_realtime add table public.votes;
alter publication supabase_realtime add table public.decisions;


-- ============================================================
-- 5) Storage — bucket صور الخيارات
-- ملاحظة: أنشئ الـ bucket من اللوحة (Storage → New bucket → option-images, Public)
-- ثم شغّل سياسات الرفع التالية
-- ============================================================

insert into storage.buckets (id, name, public)
values ('option-images', 'option-images', true)
on conflict (id) do nothing;

-- القراءة مفتوحة للجميع (الصور تُعرض في صفحة التصويت العامة)
drop policy if exists "option_images_public_read" on storage.objects;
create policy "option_images_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'option-images');

-- الرفع للمستخدمين المسجّلين فقط، وكل واحد داخل مجلد باسم user id
drop policy if exists "option_images_auth_upload" on storage.objects;
create policy "option_images_auth_upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'option-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "option_images_owner_delete" on storage.objects;
create policy "option_images_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'option-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ============================================================
-- انتهى. للتحقق: Supabase → Table Editor لازم تشوف 6 جداول،
-- وكل واحد فيه علامة "RLS enabled".
-- ============================================================
