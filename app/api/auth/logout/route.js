import { NextResponse } from "next/server";
import { appUrl, commonCookieOptions, COOKIE_NAMES } from "@/lib/oauth";
import { legacyOwnerCookieName } from "@/lib/supabase-rest";

export async function GET() {
  const response = NextResponse.redirect(appUrl());
  response.cookies.set(COOKIE_NAMES.spotifyRefresh, "", { ...commonCookieOptions(), maxAge: 0 });
  response.cookies.set(COOKIE_NAMES.stravaRefresh, "", { ...commonCookieOptions(), maxAge: 0 });
  response.cookies.set(COOKIE_NAMES.spotifyState, "", { ...commonCookieOptions(), maxAge: 0 });
  response.cookies.set(COOKIE_NAMES.stravaState, "", { ...commonCookieOptions(), maxAge: 0 });
  response.cookies.set(COOKIE_NAMES.userSession, "", { ...commonCookieOptions(), maxAge: 0 });
  response.cookies.set(legacyOwnerCookieName(), "", { ...commonCookieOptions(), maxAge: 0 });
  return response;
}
