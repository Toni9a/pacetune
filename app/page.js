import { cookies } from "next/headers";
import SyncPanel from "@/components/sync-panel";
import { COOKIE_NAMES } from "@/lib/oauth";
import { getSessionUserId, hasSupabaseConfig, listProvidersForUser } from "@/lib/supabase-rest";

export default async function HomePage() {
  const cookieStore = await cookies();
  let spotifyConnected = Boolean(cookieStore.get(COOKIE_NAMES.spotifyRefresh)?.value);
  let stravaConnected = Boolean(cookieStore.get(COOKIE_NAMES.stravaRefresh)?.value);

  if (hasSupabaseConfig()) {
    const userId = getSessionUserId(cookieStore);
    if (userId) {
      const providers = await listProvidersForUser(userId);
      spotifyConnected = providers.has("spotify");
      stravaConnected = providers.has("strava");
    } else {
      spotifyConnected = false;
      stravaConnected = false;
    }
  }

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
      <section className="panel">
        <h2>Example PaceTune</h2>
        <p>What users see after sync: songs grouped by each progressive km split.</p>
        <div className="landing-demo">
          <div className="chat-row">
            <div className="bubble">
              <p className="bubble-title">1 km</p>
              <p className="bubble-line">
                Dreams <span>- Fleetwood Mac</span>
              </p>
              <p className="bubble-line">
                Japanese Denim <span>- Daniel Caesar</span>
              </p>
            </div>
            <p className="bubble-meta">5:25 /km</p>
          </div>
          <div className="chat-row">
            <div className="bubble">
              <p className="bubble-title">2 km</p>
              <p className="bubble-line">
                Small Worlds <span>- Mac Miller</span>
              </p>
            </div>
            <p className="bubble-meta">6:40 /km</p>
          </div>
          <div className="chat-row">
            <div className="bubble empty">
              <p className="bubble-title">3 km</p>
              <p className="bubble-line muted">No song in this split</p>
            </div>
            <p className="bubble-meta">6:12 /km</p>
          </div>
        </div>
      </section>
      <SyncPanel ready={spotifyConnected && stravaConnected} />
    </main>
  );
}
