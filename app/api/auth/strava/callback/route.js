import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { appUrl, commonCookieOptions, COOKIE_NAMES, formBody, parseJson } from "@/lib/oauth";
import { findUserByProvider, getSessionUserId, hasSupabaseConfig, upsertProviderAccount } from "@/lib/supabase-rest";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const err = url.searchParams.get("error");

    if (err) {
      return NextResponse.redirect(`${appUrl()}?strava_error=${encodeURIComponent(err)}`);
    }
    if (!code || !state) {
      return NextResponse.redirect(`${appUrl()}?strava_error=missing_code_or_state`);
    }

    const cookieStore = await cookies();
    const expectedState = cookieStore.get(COOKIE_NAMES.stravaState)?.value;
    if (!expectedState || expectedState !== state) {
      return NextResponse.redirect(`${appUrl()}?strava_error=invalid_state`);
    }

    const tokenResponse = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: "authorization_code"
      })
    });
    const payload = await parseJson(tokenResponse, "Strava code exchange");
    const stravaUserId = payload?.athlete?.id;
    if (!stravaUserId) {
      return NextResponse.redirect(`${appUrl()}?strava_error=missing_strava_user_id`);
    }

    if (!payload.refresh_token) {
      return NextResponse.redirect(`${appUrl()}?strava_error=missing_refresh_token`);
    }

    const response = NextResponse.redirect(`${appUrl()}?strava_connected=1`);
    response.cookies.set(COOKIE_NAMES.stravaState, "", { ...commonCookieOptions(), maxAge: 0 });
    if (hasSupabaseConfig()) {
      const existingUser = await findUserByProvider("strava", stravaUserId);
      const sessionUser = getSessionUserId(cookieStore);
      const userId = sessionUser || existingUser || crypto.randomUUID();
      await upsertProviderAccount({
        userId,
        provider: "strava",
        providerUserId: stravaUserId,
        refreshToken: payload.refresh_token
      });
      response.cookies.set(COOKIE_NAMES.userSession, userId, {
        ...commonCookieOptions(),
        maxAge: 365 * 24 * 60 * 60
      });
    } else {
      // Legacy fallback mode without Supabase persistence.
      response.cookies.set(COOKIE_NAMES.stravaRefresh, payload.refresh_token, {
        ...commonCookieOptions(),
        maxAge: 365 * 24 * 60 * 60
      });
    }
    return response;
  } catch (error) {
    return NextResponse.redirect(`${appUrl()}?strava_error=${encodeURIComponent(error.message || "callback_failed")}`);
  }
}
