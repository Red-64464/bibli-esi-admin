import { createClient } from "@supabase/supabase-js";

// Configuration Supabase via variables d'environnement
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("⚠️ Variables Supabase manquantes dans .env");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: "public" },
  global: {
    headers: { "x-client-info": "bibli-esi" },
  },
});
