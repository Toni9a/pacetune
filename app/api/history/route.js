import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionUserId, hasSupabaseConfig, loadOwnerHistory } from "@/lib/supabase-rest";

export async function GET() {
  try {
    if (!hasSupabaseConfig()) {
      return NextResponse.json({ error: "Supabase is not configured." }, { status: 400 });
    }

    const cookieStore = await cookies();
    const userId = getSessionUserId(cookieStore);
    if (!userId) {
      return NextResponse.json({ error: "No user session. Connect Spotify + Strava first." }, { status: 401 });
    }

    const report = await loadOwnerHistory(userId);
    if (!report.run_count) {
      return NextResponse.json({ error: "No saved history yet. Run a sync first." }, { status: 404 });
    }
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unknown error." }, { status: 500 });
  }
}
