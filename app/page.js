import { cookies } from "next/headers";
import SyncPanel from "@/components/sync-panel";
import { COOKIE_NAMES } from "@/lib/oauth";

export default async function HomePage() {
  const cookieStore = await cookies();
  const spotifyConnected = Boolean(cookieStore.get(COOKIE_NAMES.spotifyRefresh)?.value);
  const stravaConnected = Boolean(cookieStore.get(COOKIE_NAMES.stravaRefresh)?.value);

  return (
    <main className="page">
      <section className="hero">
        <h1>PaceTune</h1>
        <p>Connect Spotify and Strava, then sync your run timeline with your listening history.</p>
        <div className="status-grid">
          <div className="status-item">
            <span>Spotify</span>
            <span className={`pill ${spotifyConnected ? "ok" : "missing"}`}>
              {spotifyConnected ? "Connected" : "Missing"}
            </span>
          </div>
          <div className="status-item">
            <span>Strava</span>
            <span className={`pill ${stravaConnected ? "ok" : "missing"}`}>
              {stravaConnected ? "Connected" : "Missing"}
            </span>
          </div>
        </div>
        <div className="action-row">
          <a className="btn" href="/api/auth/spotify/start">
            Connect Spotify
          </a>
          <a className="btn" href="/api/auth/strava/start">
            Connect Strava
          </a>
          <a className="btn" href="/api/auth/logout">
            Disconnect
          </a>
        </div>
      </section>
      <SyncPanel ready={spotifyConnected && stravaConnected} />
    </main>
  );
}
