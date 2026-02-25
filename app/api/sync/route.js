import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_NAMES } from "@/lib/oauth";
import { syncRunWindow } from "@/lib/pacetune";

export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const spotifyRefreshToken = cookieStore.get(COOKIE_NAMES.spotifyRefresh)?.value;
    const stravaRefreshToken = cookieStore.get(COOKIE_NAMES.stravaRefresh)?.value;

    if (!spotifyRefreshToken || !stravaRefreshToken) {
      return NextResponse.json(
        { error: "Missing connected provider. Connect Spotify and Strava first." },
        { status: 400 }
      );
    }

    const url = new URL(request.url);
    const now = new Date();
    const defaultStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const start = url.searchParams.get("start") || defaultStart.toISOString();
    const end = url.searchParams.get("end") || now.toISOString();

    const report = await syncRunWindow({
      spotifyRefreshToken,
      stravaRefreshToken,
      start,
      end
    });
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unknown error." }, { status: 500 });
  }
}
