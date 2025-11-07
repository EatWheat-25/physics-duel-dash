import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, apikey",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: expiredOffers } = await service
      .from("match_offers")
      .select("*")
      .eq("state", "pending")
      .lt("expires_at", new Date().toISOString());

    if (expiredOffers && expiredOffers.length > 0) {
      for (const offer of expiredOffers) {
        await service
          .from("match_offers")
          .update({ state: "expired" })
          .eq("id", offer.id);

        await service
          .from("queue")
          .update({ status: "waiting" })
          .in("player_id", [offer.p1, offer.p2]);
      }

      console.log(`Expired ${expiredOffers.length} offers`);
    }

    return json({ success: true, expired: expiredOffers?.length || 0 });
  } catch (e: any) {
    console.error("Sweeper error:", e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
