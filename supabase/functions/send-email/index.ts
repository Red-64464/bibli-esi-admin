// Supabase Edge Function — send-email
// Utilise Resend (https://resend.com) pour envoyer des emails.
//
// Variables d'environnement requises (Supabase Dashboard → Settings → Edge Functions → Secrets) :
//   RESEND_API_KEY  → votre clé API Resend (ex: re_xxxxxxx)
//   FROM_EMAIL      → adresse expéditeur (ex: bibliotheque@esi.dz)
//
// Déploiement :
//   supabase functions deploy send-email --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { to, subject, text } = await req.json();

    if (!to || !subject) {
      return new Response(
        JSON.stringify({ error: "Champs 'to' et 'subject' requis." }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    const apiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail =
      Deno.env.get("FROM_EMAIL") ?? "noreply@bibliotheque-esi.dz";

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY non configuré." }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Bibliothèque ESI <${fromEmail}>`,
        to: [to],
        subject,
        text: text ?? "",
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return new Response(JSON.stringify({ error: data }), {
        status: res.status,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, id: data.id }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
