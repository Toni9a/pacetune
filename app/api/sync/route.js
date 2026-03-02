import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_NAMES } from "@/lib/oauth";
import { syncRunWindow } from "@/lib/pacetune";
import {
  getProviderRefreshToken,
  getSessionUserId,
  hasSupabaseConfig,
  ownerCookieName,
  persistReport
} from "@/lib/supabase-rest";

export async function GET(request) {
  try {
    if (!hasSupabaseConfig()) {
      return NextResponse.json(
        { error: "Supabase is required for account-mapped sync. Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const userId = getSessionUserId(cookieStore);
    if (!userId) {
      return NextResponse.json({ error: "No user session. Connect Spotify and Strava first." }, { status: 401 });
    }

    const spotifyRefreshToken = await getProviderRefreshToken(userId, "spotify");
    const stravaRefreshToken = await getProviderRefreshToken(userId, "strava");

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

    await persistReport(userId, report, "live");

    const response = NextResponse.json(report);
    response.cookies.set(ownerCookieName(), userId, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 365 * 24 * 60 * 60
    });
    response.cookies.set(COOKIE_NAMES.spotifyRefresh, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
    response.cookies.set(COOKIE_NAMES.stravaRefresh, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unknown error." }, { status: 500 });
  }
}
