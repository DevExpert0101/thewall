import { supabase } from "@/lib/supabase";
import { seedVoices } from "@/lib/seed";

export const dynamic = "force-dynamic";

const WALL_MINUTES = parseInt(process.env.SIMULATED_WALL_MINUTES ?? "5", 10);

export async function POST() {
  const now = new Date();
  const title = `The Wall — ${now.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })}`;

  const { data: wall, error } = await supabase.rpc("reset_wall", {
    duration_minutes: WALL_MINUTES,
    new_wall_title: title,
  });

  if (error || !wall) {
    return Response.json(
      { error: error?.message ?? "Failed to start a new wall." },
      { status: 500 },
    );
  }

  const { seeded, trending } = await seedVoices(supabase, wall.id);

  return Response.json({
    ok: true,
    wallId: wall.id,
    endsAt: wall.ends_at,
    seeded,
    trending,
  });
}
