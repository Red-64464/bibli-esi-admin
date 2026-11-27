import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined);

  const loadProfile = async (authUser) => {
    if (!authUser) {
      setSession(null);
      return;
    }
    const { data, error } = await supabase
      .from("bibli_profiles")
      .select("id, username, display_name, email, role, permissions")
      .eq("id", authUser.id)
      .maybeSingle();
    if (error || !data) {
      await supabase.auth.signOut();
      setSession(null);
      return;
    }
    setSession({ ...data, username: data.username || authUser.email, permissions: data.permissions || {} });
  };

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data: { session: authSession } }) => {
      if (!active) return;
      if (authSession?.user) { await loadProfile(authSession.user); return; }
      try {
        const response = await fetch('/direct-access.json', { cache: 'no-store' });
        if (!response.ok) { setSession(null); return; }
        const config = await response.json();
        if (!config.email || !config.password) { setSession(null); return; }
        const { data, error } = await supabase.auth.signInWithPassword(config);
        if (error || !data.user) { setSession(null); return; }
        if (active) await loadProfile(data.user);
      } catch { if (active) setSession(null); }
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, authSession) => {
      if (active) loadProfile(authSession?.user ?? null);
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (identifier, password) => {
    const localUsernameLogin =
      import.meta.env.DEV && import.meta.env.VITE_AUTH_LOGIN_MODE === "username";
    const username = identifier.trim();
    if (localUsernameLogin && !/^[a-zA-Z0-9._-]{3,80}$/.test(username)) {
      throw new Error("Saisissez un nom d’utilisateur valide.");
    }
    const email = localUsernameLogin
      ? `${username.toLowerCase()}@local.bibliesi.test`
      : username;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error("E-mail ou mot de passe incorrect.");
    await loadProfile(data.user);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  return <AuthContext.Provider value={{ session, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
