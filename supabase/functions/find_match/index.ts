import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, apikey",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const { subject, region = "pk" } = await req.json();
    if (!subject) return json({ error: "Missing subject" }, 400);

    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const lockKey = `matchmaker:${subject}:${region}`;
    const { data: locked } = await service.rpc("try_lock", { lock_key: lockKey });
    if (!locked) return json({ status: "busy" });

    try {
      const { data: profile } = await service.from("profiles").select("username").eq("id", user.id).maybeSingle();
      const displayName = profile?.username || user.email?.split("@")[0] || "Player";

      await service.from("players").upsert({
        id: user.id,
        display_name: displayName,
        region
      });

      const { data: p } = await service.from("players").select("mmr").eq("id", user.id).maybeSingle();
      const mmr = p?.mmr ?? 1000;

      await service.from("queue").upsert({
        player_id: user.id,
        subject,
        chapter: "default",
        mmr,
        region,
        status: "waiting",
        enqueued_at: new Date().toISOString(),
      }, { onConflict: "player_id" });

      const { data: result, error: matchError } = await service.rpc("match_players", {
        subject_in: subject,
        region_in: region,
      });

      if (matchError) {
        console.error("Match error:", matchError);
        return json({ error: matchError.message }, 500);
      }

      if (result && result.length > 0) {
        const offer = result[0];
        return json({
          status: "offered",
          offerId: offer.offer_id,
          matchId: offer.match_id,
          opponentId: offer.p1_id === user.id ? offer.p2_id : offer.p1_id,
          opponentName: offer.p1_id === user.id ? offer.p2_name : offer.p1_name,
        });
      }

      return json({ status: "waiting" });
    } finally {
      await service.rpc("unlock", { lock_key: lockKey });
    }
  } catch (e: any) {
    console.error("Error in find_match:", e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
