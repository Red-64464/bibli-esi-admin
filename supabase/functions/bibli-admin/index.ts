import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const allowedOrigin = "https://bibliesi-admin.75.119.140.201.nip.io";

function headers(request: Request) {
  const origin = request.headers.get("origin");
  return {
    "Access-Control-Allow-Origin": origin === allowedOrigin ? origin : allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    Vary: "Origin",
  };
}

function response(request: Request, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: headers(request) });
}

function text(value: unknown, max = 120) {
  return typeof value === "string" && value.trim() && value.trim().length <= max
    ? value.trim()
    : null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(request) });
  if (request.method !== "POST" || !supabaseUrl || !anonKey || !serviceRoleKey)
    return response(request, 400, { error: "Requête ou configuration invalide." });

  const token = request.headers.get("authorization");
  if (!token?.startsWith("Bearer ")) return response(request, 401, { error: "Connexion requise." });

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: token } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: callerData } = await callerClient.auth.getUser();
  const caller = callerData.user;
  if (!caller) return response(request, 401, { error: "Session invalide." });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: callerProfile } = await admin
    .from("bibli_profiles")
    .select("role")
    .eq("id", caller.id)
    .maybeSingle();
  if (callerProfile?.role !== "super_admin")
    return response(request, 403, { error: "Accès réservé au super administrateur." });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = body?.action;
  const id = text(body?.id, 80);

  try {
    if (action === "create") {
      const email = text(body?.email, 254)?.toLowerCase();
      const username = text(body?.username, 80);
      const password = text(body?.password, 200);
      const role = body?.role === "super_admin" ? "super_admin" : "librarian";
      const displayName = text(body?.display_name, 120);
      if (!email?.includes("@") || !username || !password || password.length < 12)
        return response(request, 400, { error: "E-mail, nom, et mot de passe de 12 caractères minimum requis." });
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createError || !created.user) throw createError ?? new Error("Création du compte impossible.");
      const { error: profileError } = await admin.from("bibli_profiles").insert({
        id: created.user.id,
        username,
        display_name: displayName,
        email,
        role,
        permissions: role === "librarian" && body?.permissions && typeof body.permissions === "object" ? body.permissions : {},
      });
      if (profileError) {
        await admin.auth.admin.deleteUser(created.user.id);
        throw profileError;
      }
      return response(request, 201, { ok: true });
    }

    if (!id) return response(request, 400, { error: "Compte invalide." });
    if (id === caller.id && ["delete", "set-role"].includes(String(action)))
      return response(request, 400, { error: "Vous ne pouvez pas modifier ce paramètre sur votre propre compte." });

    if (action === "delete") {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw error;
      return response(request, 200, { ok: true });
    }

    if (action === "set-password") {
      const password = text(body?.password, 200);
      if (!password || password.length < 12) return response(request, 400, { error: "Mot de passe de 12 caractères minimum requis." });
      const { error } = await admin.auth.admin.updateUserById(id, { password });
      if (error) throw error;
      return response(request, 200, { ok: true });
    }

    if (action === "set-role") {
      const role = body?.role === "super_admin" ? "super_admin" : "librarian";
      const { error } = await admin.from("bibli_profiles").update({ role }).eq("id", id);
      if (error) throw error;
      return response(request, 200, { ok: true });
    }

    if (action === "set-permissions") {
      if (!body?.permissions || typeof body.permissions !== "object" || Array.isArray(body.permissions))
        return response(request, 400, { error: "Permissions invalides." });
      const { error } = await admin.from("bibli_profiles").update({ permissions: body.permissions }).eq("id", id);
      if (error) throw error;
      return response(request, 200, { ok: true });
    }

    if (action === "update-profile") {
      const username = text(body?.username, 80);
      const displayName = text(body?.display_name, 120);
      const email = text(body?.email, 254)?.toLowerCase();
      if (!username || !email?.includes("@")) return response(request, 400, { error: "Nom et e-mail valides requis." });
      const { error: authError } = await admin.auth.admin.updateUserById(id, { email, email_confirm: true });
      if (authError) throw authError;
      const { error } = await admin.from("bibli_profiles").update({ username, display_name: displayName, email }).eq("id", id);
      if (error) throw error;
      return response(request, 200, { ok: true });
    }

    return response(request, 400, { error: "Action inconnue." });
  } catch (error) {
    console.error("bibli-admin", error);
    return response(request, 400, { error: error instanceof Error ? error.message : "Opération impossible." });
  }
});
