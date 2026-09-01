// Bibl'ESI — secure mail relay.
// Secrets stay server-side. The caller must be a library member with the
// `notifications` permission (or a super administrator).

import { createClient } from "jsr:@supabase/supabase-js@2";

declare const Deno: {
  serve: (fn: (req: Request) => Promise<Response> | Response) => void;
  env: { get: (key: string) => string | undefined };
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const resendApiKey = Deno.env.get("RESEND_API_KEY");
const fromEmail = Deno.env.get("FROM_EMAIL");
const emailJsServiceId = Deno.env.get("EMAILJS_SERVICE_ID");
const emailJsTemplateId = Deno.env.get("EMAILJS_TEMPLATE_ID");
const emailJsReminderTemplateId = Deno.env.get("EMAILJS_TEMPLATE_REMINDER_ID");
const emailJsPublicKey = Deno.env.get("EMAILJS_PUBLIC_KEY");
const allowedOrigin = "https://bibliesi-admin.75.119.140.201.nip.io";
const rateLimits = new Map<string, { count: number; resetAt: number }>();

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

function reply(request: Request, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: headers(request) });
}

function shortText(value: unknown, maxLength: number) {
  return typeof value === "string" && value.trim().length <= maxLength ? value.trim() : null;
}

function email(value: unknown) {
  const result = shortText(value, 254)?.toLowerCase();
  return result && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result) ? result : null;
}

function allowRequest(userId: string) {
  const now = Date.now();
  const current = rateLimits.get(userId);
  if (!current || current.resetAt <= now) {
    rateLimits.set(userId, { count: 1, resetAt: now + 10 * 60_000 });
    return true;
  }
  if (current.count >= 5) return false;
  current.count += 1;
  return true;
}

async function sendWithTimeout(payload: Record<string, unknown>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    return await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function sendWithEmailJs(payload: Record<string, unknown>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    return await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(request) });
  const emailJsReady = Boolean(emailJsServiceId && emailJsTemplateId && emailJsPublicKey);
  if (request.method !== "POST" || !supabaseUrl || !anonKey || !serviceRoleKey || (!resendApiKey && !emailJsReady))
    return reply(request, 503, { error: "Service e-mail indisponible." });

  const token = request.headers.get("authorization");
  if (!token?.startsWith("Bearer ")) return reply(request, 401, { error: "Connexion requise." });

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: token } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: callerData } = await caller.auth.getUser();
  if (!callerData.user) return reply(request, 401, { error: "Session invalide." });
  if (!allowRequest(callerData.user.id)) return reply(request, 429, { error: "Trop d'e-mails envoyés. Réessayez dans quelques minutes." });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile } = await admin
    .from("bibli_profiles")
    .select("role, permissions")
    .eq("id", callerData.user.id)
    .maybeSingle();
  const canNotify = profile?.role === "super_admin" || profile?.permissions?.notifications === true;
  if (!canNotify) return reply(request, 403, { error: "Permission de notification requise." });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const to = email(body?.to);
  const subject = shortText(body?.subject, 160);
  const text = shortText(body?.text ?? "", 5_000);
  const toName = shortText(body?.toName ?? "", 120) ?? "";
  const titre = shortText(body?.titre ?? "", 240) ?? "";
  const dateRetour = shortText(body?.dateRetour ?? "", 32) ?? "";
  const joursRetard = typeof body?.joursRetard === "number" && Number.isInteger(body.joursRetard)
    ? Math.max(0, Math.min(body.joursRetard, 9_999))
    : 0;
  const templateType = body?.templateType === "reminder" ? "reminder" : "confirmation";
  if (!to || !subject || text === null) return reply(request, 400, { error: "Destinataire, sujet ou message invalide." });

  // A notification may target an enrolled student or another library account,
  // never an arbitrary address supplied by an attacker.
  const [{ data: student }, { data: member }] = await Promise.all([
    admin.from("bibli_etudiants").select("id").eq("email", to).maybeSingle(),
    admin.from("bibli_profiles").select("id").eq("email", to).maybeSingle(),
  ]);
  if (!student && !member) return reply(request, 400, { error: "Le destinataire doit être un étudiant inscrit ou un compte bibliothèque." });

  try {
    const response = resendApiKey && fromEmail
      ? await sendWithTimeout({ from: `Bibliothèque ESI <${fromEmail}>`, to: [to], subject, text })
      : await sendWithEmailJs({
          service_id: emailJsServiceId,
          template_id: templateType === "reminder" ? (emailJsReminderTemplateId || emailJsTemplateId) : emailJsTemplateId,
          user_id: emailJsPublicKey,
          template_params: {
            to_email: to,
            to_name: toName,
            subject,
            message: text,
            titre,
            date_retour: dateRetour,
            jours_retard: String(joursRetard),
          },
        });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      console.error("send-email provider", response.status);
      return reply(request, 502, { error: "Le fournisseur e-mail a refusé l'envoi." });
    }
    await admin.from("bibli_activity_logs").insert({
      actor_id: callerData.user.id,
      action_type: "email_envoye",
      description: `E-mail envoyé vers ${to}`,
      user_info: "fonction sécurisée send-email",
    });
    return reply(request, 200, { ok: true, id: data?.id ?? null });
  } catch (error) {
    console.error("send-email failure", error instanceof Error ? error.name : "unknown");
    return reply(request, 502, { error: "Impossible de joindre le fournisseur e-mail." });
  }
});
