import { supabase } from "@/lib/supabase";

// قراءة وتحديث بروفايل المستخدم.
// الصف يُنشأ تلقائياً من trigger handle_new_user عند التسجيل،
// فما نحتاج insert هنا — فقط select و update.

async function currentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}

export const profileService = {
  async get() {
    const user = await currentUser();
    if (!user) return { ok: false, reason: "unauthenticated" };

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, display_name, tone, locale, read_aloud, default_mood, avatar_url",
      )
      .eq("id", user.id)
      .maybeSingle();

    if (error)
      return { ok: false, reason: "query_failed", message: error.message };
    if (!data)
      return { ok: false, reason: "missing", message: "ما لقينا بروفايلك." };

    return { ok: true, profile: data, email: user.email };
  },

  async update(patch) {
    const user = await currentUser();
    if (!user) return { ok: false, reason: "unauthenticated" };

    const { data, error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", user.id)
      .select(
        "id, display_name, tone, locale, read_aloud, default_mood, avatar_url",
      )
      .single();

    if (error)
      return { ok: false, reason: "update_failed", message: error.message };
    return { ok: true, profile: data };
  },

  // تُستدعى بصمت — فشلها ما يهم المستخدم
  async touchLastSeen() {
    const user = await currentUser();
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", user.id);
  },
};
