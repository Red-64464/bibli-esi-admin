import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import bcrypt from "bcryptjs";

const AuthContext = createContext(null);
const SESSION_KEY = "biblio_admin_session";

export function AuthProvider({ children }) {
  // undefined = loading, null = not logged in, object = logged in
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      setSession(stored ? JSON.parse(stored) : null);
    } catch {
      setSession(null);
    }
  }, []);

  const signIn = async (username, password) => {
    const { data, error } = await supabase
      .from("users")
      .select("id, username, role, password_hash")
      .eq("username", username)
      .single();

    if (error || !data) throw new Error("Utilisateur introuvable.");

    const valid = await bcrypt.compare(password, data.password_hash);
    if (!valid) throw new Error("Mot de passe incorrect.");

    const sess = { id: data.id, username: data.username, role: data.role };
    localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
    setSession(sess);
  };

  const signOut = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ session, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
