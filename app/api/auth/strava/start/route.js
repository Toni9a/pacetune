import { NextResponse } from "next/server";
import { appUrl, commonCookieOptions, COOKIE_NAMES, makeState } from "@/lib/oauth";

export async function GET() {
  if (!process.env.STRAVA_CLIENT_ID) {
    return NextResponse.json({ error: "Missing STRAVA_CLIENT_ID." }, { status: 500 });
  }

  const redirectUri = `${appUrl()}/api/auth/strava/callback`;
  const state = makeState();
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri,
    approval_prompt: "auto",
    scope: "read,activity:read_all",
    state
  });

  const response = NextResponse.redirect(`https://www.strava.com/oauth/authorize?${params}`);
  response.cookies.set(COOKIE_NAMES.stravaState, state, {
    ...commonCookieOptions(),
    maxAge: 10 * 60
  });
  return response;
}
