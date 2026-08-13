"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data?.session ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });

    return () => {
      active = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  // الاسم يمشي في raw_user_meta_data لأن trigger handle_new_user يقرأه
  // منه عند إنشاء البروفايل — وبدونه يرجع لأول جزء من الإيميل.
  const signUp = useCallback(async (email, password, displayName) => {
    const name = displayName?.trim();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: name ? { data: { display_name: name } } : undefined,
    });
    if (error) return { ok: false, message: error.message };
    // لو تأكيد الإيميل مفعّل في Supabase، ما تجي جلسة إلا بعد التأكيد
    return { ok: true, needsConfirmation: !data.session };
  }, []);

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  // التوكن هو الهوية الموثوقة لنداء /api/decide
  const accessToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signUp,
      signIn,
      signOut,
      accessToken,
    }),
    [session, loading, signUp, signIn, signOut, accessToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
