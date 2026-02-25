"use client";

import { useMemo, useState } from "react";

function asInputValue(date) {
  return date.toISOString().slice(0, 16);
}

function defaultStart() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return asInputValue(d);
}

function defaultEnd() {
  return asInputValue(new Date());
}

function fmtPace(secPerKm) {
  if (!Number.isFinite(secPerKm) || secPerKm <= 0) {
    return "n/a";
  }
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}:${String(sec).padStart(2, "0")} /km`;
}

export default function SyncPanel({ ready }) {
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState(null);

  const canRun = useMemo(() => ready && !loading, [ready, loading]);

  async function onSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString()
      });
      const response = await fetch(`/api/sync?${qs}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Sync failed.");
      }
      setReport(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel">
      <h2>Sync Runs + Songs</h2>
      <p>Choose a date window and fetch your run/song mapping from live APIs.</p>
      <form onSubmit={onSubmit}>
        <div className="field-grid">
          <div>
            <label htmlFor="start">Start</label>
            <input id="start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="end">End</label>
            <input id="end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} required />
          </div>
        </div>
        <div className="action-row">
          <button className="btn primary" type="submit" disabled={!canRun}>
            {loading ? "Syncing..." : "Run Sync"}
          </button>
        </div>
      </form>
      {!ready ? <p className="error">Connect both Spotify and Strava first.</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {report ? (
        <div>
          <p>
            <strong>Runs found:</strong> {report.run_count}
          </p>
          {report.runs.map((run) => (
            <article className="run" key={run.run_id}>
              <h3>{run.name}</h3>
              <p>
                <strong>Run:</strong> {run.start_time} to {run.end_time}
              </p>
              <p>
                <strong>Distance:</strong> {run.distance_km.toFixed(2)} km
              </p>
              <p>
                <strong>Songs during run:</strong> {run.tracks_during_run.length}
              </p>
              <details>
                <summary>Songs</summary>
                <ul className="songs">
                  {run.tracks_during_run.map((song) => (
                    <li key={`${song.track_id}-${song.ended_at}`}>
                      <strong>{song.track_name}</strong> {song.artists} ({song.started_at} to {song.ended_at})
                    </li>
                  ))}
                </ul>
              </details>
              <details>
                <summary>Splits</summary>
                <ul className="songs">
                  {run.splits.map((split) => {
                    const pace = split.distance_km > 0 ? split.elapsed_time_s / split.distance_km : 0;
                    return (
                      <li key={`${run.run_id}-${split.split_index}`}>
                        Split {split.split_index}: {split.start_time} to {split.end_time}, {fmtPace(pace)}
                      </li>
                    );
                  })}
                </ul>
              </details>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
