import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { hasSupabaseConfig, loadOwnerHistory, ownerCookieName } from "@/lib/supabase-rest";

export async function GET() {
  try {
    if (!hasSupabaseConfig()) {
      return NextResponse.json({ error: "Supabase is not configured." }, { status: 400 });
    }

    const cookieStore = await cookies();
    const ownerId = cookieStore.get(ownerCookieName())?.value;
    if (!ownerId) {
      return NextResponse.json({ error: "No saved history yet. Run a sync first." }, { status: 404 });
    }

    const report = await loadOwnerHistory(ownerId);
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unknown error." }, { status: 500 });
  }
}
