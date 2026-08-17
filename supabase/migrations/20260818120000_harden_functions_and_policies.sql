-- إغلاق تحذيرات مدقّق Supabase — أمناً وأداءً.
--
-- ما تغيّره هذي المهاجرة صلاحيات ونصوص سياسات فقط. ولا تلمس بياناً
-- ولا شكلَ جدول، وكل قاعدة تبقى تحرس ما كانت تحرسه.

-- ---------------------------------------------------------------
-- ١) أمن: دوال SECURITY DEFINER مكشوفة على /rest/v1/rpc
-- ---------------------------------------------------------------

-- دالتا مُشغِّل (trigger). المُشغِّل لا يفحص صلاحية EXECUTE على دالته،
-- فسحبها لا يوقف إنشاء البروفايل عند التسجيل ولا فحص الفائز — ويمنع
-- استدعاءها كـ RPC، وهي ما وُضعت لذلك أصلاً.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.check_winner_belongs() from public, anon, authenticated;

-- تُستدعى داخل cast_vote وحدها، وهي SECURITY DEFINER تعمل بصلاحيات
-- مالكها — فالنداء الداخلي لا يحتاج صلاحية المستدعي. ولا سياسة
-- تستعملها، فسحبها من الجميع بلا أثر.
revoke execute on function public.decision_accepts_votes(uuid) from public, anon, authenticated;

-- ⚠️ `authenticated` تبقى لها الصلاحية عمداً: هذي الدالة تُنادى داخل
-- سياسات RLS على options و answers و feedback و votes، وتعبير السياسة
-- يُقيَّم بصلاحيات صاحب الطلب لا بصلاحيات الجدول. سحبها من
-- `authenticated` يكسر كل وصول لتلك الجداول. نسحبها من الضيف فقط،
-- وهو لا يملك قراراً أصلاً فالجواب له `false` دائماً.
revoke execute on function public.decision_is_owned(uuid) from public, anon;

-- cast_vote و get_vote_page تبقيان مكشوفتين للضيف عمداً: التصويت بلا
-- حساب يمر منهما، ووزن الصوت مثبَّت في الخادم. حذفهما يكسر الميزة.

-- ---------------------------------------------------------------
-- ٢) أداء: `auth.uid()` يُعاد تقييمها لكل صف
--
-- لفّها في `(select …)` يخلي المخطِّط يحسبها مرة واحدة كثابت بدل
-- استدعاء لكل صف. التعبير نفسه والنتيجة نفسها.
-- ---------------------------------------------------------------

alter policy "decisions_owner_all" on public.decisions
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "analyses_owner_all" on public.analyses
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "profiles_select_own" on public.profiles
  using ((select auth.uid()) = id);

alter policy "profiles_update_own" on public.profiles
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ---------------------------------------------------------------
-- ٣) أداء: سياستان متساهلتان لنفس الدور ونفس الفعل على options
--
-- `options_owner_write` معرّفة FOR ALL فهي تغطي SELECT بنفس التعبير
-- ونفس الدور، فبقاء `options_select_owner` يعني تقييم شرطين متطابقين
-- لكل صف. الحذف لا يغيّر من يقرأ ماذا.
-- ---------------------------------------------------------------

drop policy if exists "options_select_owner" on public.options;

-- ---------------------------------------------------------------
-- ٤) أداء: مفاتيح أجنبية بلا فهرس
--
-- `winner_option_id` صار يُكتب بعد النقاش كذلك (تصحيح الفائز)، فقراءته
-- والانضمام عليه يتكرران.
-- ---------------------------------------------------------------

create index if not exists decisions_winner_option_id_idx
  on public.decisions (winner_option_id);

create index if not exists votes_option_id_idx
  on public.votes (option_id);
