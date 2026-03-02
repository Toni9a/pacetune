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

function mmss(totalSeconds) {
  const t = Math.max(0, Math.round(totalSeconds || 0));
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtShortDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(d);
}

function songsBySplit(run) {
  let cumulativeKm = 0;
  return run.splits.map((split) => {
    const pace = split.distance_km > 0 ? split.elapsed_time_s / split.distance_km : 0;
    cumulativeKm += Number(split.distance_km || 0);
    const rounded = Math.round(cumulativeKm * 10) / 10;
    const kmLabel = Number.isInteger(rounded) ? `${rounded} km` : `${rounded.toFixed(1)} km`;
    return {
      ...split,
      paceLabel: fmtPace(pace),
      kmLabel,
      songs: split.songs || []
    };
  });
}

export default function SyncPanel({ ready }) {
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState(null);
  const [viewMode, setViewMode] = useState("messages");
  const [source, setSource] = useState("live");
  const [demoScenario, setDemoScenario] = useState("mellow");
  const [bgMode, setBgMode] = useState("plain");
  const [bgImage, setBgImage] = useState("");
  const [exportingRunId, setExportingRunId] = useState(null);

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
      setSource("live");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function onLoadDemo() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/demo-report?scenario=${encodeURIComponent(demoScenario)}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load demo data.");
      }
      setReport(payload);
      setSource("demo");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function onPickBackground(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setBgImage(reader.result);
        setBgMode("photo");
      }
    };
    reader.readAsDataURL(file);
  }

  async function exportShareCard(run) {
    try {
      setExportingRunId(run.run_id);
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1520;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Canvas not available.");
      }

      ctx.fillStyle = "#f3eee6";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (bgMode === "photo" && bgImage) {
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = bgImage;
        });
        ctx.drawImage(img, 42, 42, canvas.width - 84, canvas.height - 84);
        ctx.globalAlpha = 1;
      } else {
        const gradient = ctx.createLinearGradient(42, 42, canvas.width - 42, canvas.height - 42);
        gradient.addColorStop(0, "#edf3ff");
        gradient.addColorStop(1, "#f8fbff");
        ctx.fillStyle = gradient;
        ctx.fillRect(42, 42, canvas.width - 84, canvas.height - 84);
      }

      function roundedRect(x, y, w, h, r) {
        const rr = Math.min(r, h / 2, w / 2);
        ctx.beginPath();
        ctx.moveTo(x + rr, y);
        ctx.arcTo(x + w, y, x + w, y + h, rr);
        ctx.arcTo(x + w, y + h, x, y + h, rr);
        ctx.arcTo(x, y + h, x, y, rr);
        ctx.arcTo(x, y, x + w, y, rr);
        ctx.closePath();
      }

      function wrapText(text, maxWidth) {
        const words = String(text || "").split(" ");
        const lines = [];
        let current = "";
        for (const word of words) {
          const test = current ? `${current} ${word}` : word;
          if (ctx.measureText(test).width <= maxWidth) {
            current = test;
          } else {
            if (current) {
              lines.push(current);
            }
            current = word;
          }
        }
        if (current) {
          lines.push(current);
        }
        return lines;
      }

      roundedRect(42, 42, canvas.width - 84, canvas.height - 84, 24);
      ctx.save();
      ctx.clip();
      if (bgMode === "photo" && bgImage) {
        const shade = ctx.createLinearGradient(42, 42, 42, canvas.height - 42);
        shade.addColorStop(0, "rgba(12, 22, 38, 0.08)");
        shade.addColorStop(1, "rgba(12, 22, 38, 0.28)");
        ctx.fillStyle = shade;
        ctx.fillRect(42, 42, canvas.width - 84, canvas.height - 84);
      }
      ctx.restore();

      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      roundedRect(42, 42, canvas.width - 84, canvas.height - 84, 24);
      ctx.stroke();

      const splitRows = songsBySplit(run).slice(0, 8);
      let y = 95;
      for (const split of splitRows) {
        const lines = [];
        lines.push(split.kmLabel);
        if (split.songs.length) {
          for (const s of split.songs) {
            lines.push(`${s.track_name} - ${s.artists}`);
          }
        } else {
          lines.push("No song in this split");
        }

        ctx.font = "500 23px 'Avenir Next', 'Trebuchet MS', sans-serif";
        let bubbleLineCount = 0;
        for (const line of lines) {
          bubbleLineCount += Math.max(1, wrapText(line, 640).length);
        }
        const bubbleHeight = Math.max(98, 26 + bubbleLineCount * 30);
        const bubbleWidth = 690;
        const x = canvas.width - bubbleWidth - 70;

        roundedRect(x, y, bubbleWidth, bubbleHeight, 50);
        const bubbleGrad = ctx.createLinearGradient(x, y, x + bubbleWidth, y + bubbleHeight);
        bubbleGrad.addColorStop(0, split.songs.length ? "#2b8ff2" : "#617fb9");
        bubbleGrad.addColorStop(1, split.songs.length ? "#1563e8" : "#4c6ca7");
        ctx.fillStyle = bubbleGrad;
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + bubbleWidth - 2, y + bubbleHeight - 16);
        ctx.lineTo(x + bubbleWidth + 20, y + bubbleHeight + 10);
        ctx.lineTo(x + bubbleWidth - 2, y + bubbleHeight + 3);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#eef4ff";
        ctx.font = "700 24px 'Avenir Next', 'Trebuchet MS', sans-serif";
        let ty = y + 36;
        const firstLines = wrapText(lines[0], 660);
        for (const line of firstLines) {
          ctx.fillText(line, x + 36, ty);
          ty += 30;
        }
        ctx.font = "500 23px 'Avenir Next', 'Trebuchet MS', sans-serif";
        for (let i = 1; i < lines.length; i += 1) {
          const wrapped = wrapText(lines[i], 660);
          for (const line of wrapped) {
            ctx.fillText(line, x + 36, ty);
            ty += 29;
          }
        }

        ctx.fillStyle = "rgba(64, 78, 107, 0.88)";
        ctx.font = "500 18px 'Avenir Next', 'Trebuchet MS', sans-serif";
        const paceText = split.paceLabel;
        const paceW = ctx.measureText(paceText).width;
        ctx.fillText(paceText, x + bubbleWidth - paceW + 2, y + bubbleHeight + 40);

        y += bubbleHeight + 56;
        if (y > canvas.height - 120) {
          break;
        }
      }

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) {
        throw new Error("Could not create image.");
      }
      const file = new File([blob], `pacetune-${run.run_id}.png`, { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `${run.name} - PaceTune`,
          text: "My run + soundtrack",
          files: [file]
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `pacetune-${run.run_id}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      setError(err?.message || "Failed to export share card.");
    } finally {
      setExportingRunId(null);
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
          <button className="btn" type="button" onClick={onLoadDemo} disabled={loading}>
            Use Demo Data
          </button>
        </div>
        <div className="demo-controls">
          <label htmlFor="demo-scenario">Demo Scenario</label>
          <select
            id="demo-scenario"
            value={demoScenario}
            onChange={(e) => setDemoScenario(e.target.value)}
            disabled={loading}
          >
            <option value="mellow">Mellow Tempo</option>
            <option value="tempo">Tempo Session</option>
            <option value="longrun">Long Run (2 runs)</option>
            <option value="silent">No Song Splits</option>
          </select>
        </div>
      </form>
      {!ready ? <p className="error">Connect both Spotify and Strava first.</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {report ? (
        <div>
          {source === "demo" ? (
            <p className="demo-badge">
              Viewing demo data: <strong>{report.scenario_label || demoScenario}</strong> (no provider login required).
            </p>
          ) : null}
          <div className="view-toggle" role="tablist" aria-label="Visualization mode">
            <button
              type="button"
              className={`chip ${viewMode === "messages" ? "active" : ""}`}
              onClick={() => setViewMode("messages")}
            >
              Messages
            </button>
            <button
              type="button"
              className={`chip ${viewMode === "list" ? "active" : ""}`}
              onClick={() => setViewMode("list")}
            >
              List
            </button>
          </div>
          {viewMode === "messages" ? (
            <div className="demo-controls">
              <label htmlFor="msg-bg-mode">Message Background</label>
              <select id="msg-bg-mode" value={bgMode} onChange={(e) => setBgMode(e.target.value)}>
                <option value="plain">Plain</option>
                <option value="photo">Photo</option>
              </select>
              <input type="file" accept="image/*" onChange={onPickBackground} />
            </div>
          ) : null}
          <p>
            <strong>Runs found:</strong> {report.run_count}
          </p>
          {report.runs.map((run) => (
            <article className="run" key={run.run_id}>
              <h3>{run.name}</h3>
              <p>
                <strong>Run:</strong> {fmtShortDateTime(run.start_time)} to {fmtShortDateTime(run.end_time)}
              </p>
              <p>
                <strong>Distance:</strong> {run.distance_km.toFixed(2)} km
              </p>
              <p>
                <strong>Songs during run:</strong> {run.tracks_during_run.length}
              </p>
              <div className="action-row">
                <button
                  type="button"
                  className="btn"
                  onClick={() => exportShareCard(run)}
                  disabled={exportingRunId === run.run_id}
                >
                  {exportingRunId === run.run_id ? "Preparing Card..." : "Share Card"}
                </button>
              </div>
              {viewMode === "messages" ? (
                <div
                  className={`chat-thread chat-thread-stage ${bgMode === "photo" && bgImage ? "with-photo" : ""}`}
                  style={bgMode === "photo" && bgImage ? { backgroundImage: `url(${bgImage})` } : undefined}
                >
                  {songsBySplit(run).map((split) => (
                    <div className="chat-row" key={`${run.run_id}-${split.split_index}`}>
                      <div className={`bubble ${split.songs.length ? "" : "empty"}`}>
                        <p className="bubble-title">
                          {split.kmLabel}
                        </p>
                        {split.songs.length ? (
                          split.songs.map((song) => (
                            <p className="bubble-line" key={`${song.track_id}-${song.ended_at}`}>
                              {song.track_name}
                              <span> - {song.artists}</span>
                            </p>
                          ))
                        ) : (
                          <p className="bubble-line muted">No song in this split</p>
                        )}
                      </div>
                      <p className="bubble-meta">{split.paceLabel}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <details>
                    <summary>Songs</summary>
                    <ul className="songs">
                      {run.tracks_during_run.map((song) => (
                        <li key={`${song.track_id}-${song.ended_at}`}>
                          <strong>{song.track_name}</strong> {song.artists} ({fmtShortDateTime(song.started_at)} to{" "}
                          {fmtShortDateTime(song.ended_at)})
                        </li>
                      ))}
                    </ul>
                  </details>
                  <details>
                    <summary>Splits</summary>
                    <ul className="songs">
                      {songsBySplit(run).map((split) => (
                        <li key={`${run.run_id}-${split.split_index}`}>
                          Split {split.split_index}: {fmtShortDateTime(split.start_time)} to {fmtShortDateTime(split.end_time)},{" "}
                          {split.paceLabel}
                        </li>
                      ))}
                    </ul>
                  </details>
                </>
              )}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
