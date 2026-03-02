const DEMO_SCENARIOS = {
  mellow: {
    label: "Mellow Tempo",
    window_start: "2026-02-24T17:20:00.000Z",
    window_end: "2026-02-24T18:20:00.000Z",
    runs: [
      {
        run_id: "demo-mellow-1",
        name: "Easy Evening Run",
        start_time: "2026-02-24T17:27:22.000Z",
        end_time: "2026-02-24T18:08:44.000Z",
        distance_km: 6.32,
        elapsed_time_s: 2482,
        tracks_during_run: [
          { track_id: "m1", track_name: "Dreams", artists: "Fleetwood Mac", started_at: "2026-02-24T17:27:20.000Z", ended_at: "2026-02-24T17:31:31.000Z", duration_ms: 251000 },
          { track_id: "m2", track_name: "Japanese Denim", artists: "Daniel Caesar", started_at: "2026-02-24T17:31:40.000Z", ended_at: "2026-02-24T17:35:20.000Z", duration_ms: 220000 },
          { track_id: "m3", track_name: "Small Worlds", artists: "Mac Miller", started_at: "2026-02-24T17:35:55.000Z", ended_at: "2026-02-24T17:40:26.000Z", duration_ms: 271000 },
          { track_id: "m4", track_name: "Nights", artists: "Frank Ocean", started_at: "2026-02-24T17:41:00.000Z", ended_at: "2026-02-24T17:46:08.000Z", duration_ms: 308000 },
          { track_id: "m5", track_name: "Blind", artists: "SZA", started_at: "2026-02-24T17:52:00.000Z", ended_at: "2026-02-24T17:54:30.000Z", duration_ms: 150000 }
        ],
        splits: [
          { split_index: 1, distance_km: 1, elapsed_time_s: 325, moving_time_s: 325, start_time: "2026-02-24T17:27:22.000Z", end_time: "2026-02-24T17:32:47.000Z", songs: [
            { track_id: "m1", track_name: "Dreams", artists: "Fleetwood Mac", started_at: "2026-02-24T17:27:20.000Z", ended_at: "2026-02-24T17:31:31.000Z", duration_ms: 251000 },
            { track_id: "m2", track_name: "Japanese Denim", artists: "Daniel Caesar", started_at: "2026-02-24T17:31:40.000Z", ended_at: "2026-02-24T17:35:20.000Z", duration_ms: 220000 }
          ] },
          { split_index: 2, distance_km: 1, elapsed_time_s: 400, moving_time_s: 383, start_time: "2026-02-24T17:32:47.000Z", end_time: "2026-02-24T17:39:27.000Z", songs: [
            { track_id: "m2", track_name: "Japanese Denim", artists: "Daniel Caesar", started_at: "2026-02-24T17:31:40.000Z", ended_at: "2026-02-24T17:35:20.000Z", duration_ms: 220000 },
            { track_id: "m3", track_name: "Small Worlds", artists: "Mac Miller", started_at: "2026-02-24T17:35:55.000Z", ended_at: "2026-02-24T17:40:26.000Z", duration_ms: 271000 }
          ] },
          { split_index: 3, distance_km: 1, elapsed_time_s: 405, moving_time_s: 405, start_time: "2026-02-24T17:39:27.000Z", end_time: "2026-02-24T17:46:12.000Z", songs: [
            { track_id: "m3", track_name: "Small Worlds", artists: "Mac Miller", started_at: "2026-02-24T17:35:55.000Z", ended_at: "2026-02-24T17:40:26.000Z", duration_ms: 271000 },
            { track_id: "m4", track_name: "Nights", artists: "Frank Ocean", started_at: "2026-02-24T17:41:00.000Z", ended_at: "2026-02-24T17:46:08.000Z", duration_ms: 308000 }
          ] },
          { split_index: 4, distance_km: 1, elapsed_time_s: 372, moving_time_s: 356, start_time: "2026-02-24T17:46:12.000Z", end_time: "2026-02-24T17:52:24.000Z", songs: [] },
          { split_index: 5, distance_km: 1, elapsed_time_s: 456, moving_time_s: 408, start_time: "2026-02-24T17:52:24.000Z", end_time: "2026-02-24T18:00:00.000Z", songs: [
            { track_id: "m5", track_name: "Blind", artists: "SZA", started_at: "2026-02-24T17:52:00.000Z", ended_at: "2026-02-24T17:54:30.000Z", duration_ms: 150000 }
          ] }
        ]
      }
    ]
  },
  tempo: {
    label: "Tempo Session",
    window_start: "2026-03-03T06:30:00.000Z",
    window_end: "2026-03-03T08:00:00.000Z",
    runs: [
      {
        run_id: "demo-tempo-1",
        name: "Tempo Intervals",
        start_time: "2026-03-03T07:02:00.000Z",
        end_time: "2026-03-03T07:47:00.000Z",
        distance_km: 8.04,
        elapsed_time_s: 2700,
        tracks_during_run: [
          { track_id: "t1", track_name: "HUMBLE.", artists: "Kendrick Lamar", started_at: "2026-03-03T07:01:30.000Z", ended_at: "2026-03-03T07:04:27.000Z", duration_ms: 177000 },
          { track_id: "t2", track_name: "POWER", artists: "Kanye West", started_at: "2026-03-03T07:04:33.000Z", ended_at: "2026-03-03T07:09:45.000Z", duration_ms: 312000 },
          { track_id: "t3", track_name: "Titanium", artists: "David Guetta, Sia", started_at: "2026-03-03T07:09:52.000Z", ended_at: "2026-03-03T07:13:58.000Z", duration_ms: 246000 },
          { track_id: "t4", track_name: "Dog Days Are Over", artists: "Florence + The Machine", started_at: "2026-03-03T07:14:10.000Z", ended_at: "2026-03-03T07:18:22.000Z", duration_ms: 252000 },
          { track_id: "t5", track_name: "As It Was", artists: "Harry Styles", started_at: "2026-03-03T07:19:00.000Z", ended_at: "2026-03-03T07:21:48.000Z", duration_ms: 168000 },
          { track_id: "t6", track_name: "Can't Hold Us", artists: "Macklemore & Ryan Lewis", started_at: "2026-03-03T07:22:10.000Z", ended_at: "2026-03-03T07:26:32.000Z", duration_ms: 262000 }
        ],
        splits: [
          { split_index: 1, distance_km: 1, elapsed_time_s: 330, moving_time_s: 325, start_time: "2026-03-03T07:02:00.000Z", end_time: "2026-03-03T07:07:30.000Z", songs: [
            { track_id: "t1", track_name: "HUMBLE.", artists: "Kendrick Lamar", started_at: "2026-03-03T07:01:30.000Z", ended_at: "2026-03-03T07:04:27.000Z", duration_ms: 177000 },
            { track_id: "t2", track_name: "POWER", artists: "Kanye West", started_at: "2026-03-03T07:04:33.000Z", ended_at: "2026-03-03T07:09:45.000Z", duration_ms: 312000 }
          ] },
          { split_index: 2, distance_km: 1, elapsed_time_s: 300, moving_time_s: 296, start_time: "2026-03-03T07:07:30.000Z", end_time: "2026-03-03T07:12:30.000Z", songs: [
            { track_id: "t2", track_name: "POWER", artists: "Kanye West", started_at: "2026-03-03T07:04:33.000Z", ended_at: "2026-03-03T07:09:45.000Z", duration_ms: 312000 },
            { track_id: "t3", track_name: "Titanium", artists: "David Guetta, Sia", started_at: "2026-03-03T07:09:52.000Z", ended_at: "2026-03-03T07:13:58.000Z", duration_ms: 246000 }
          ] },
          { split_index: 3, distance_km: 1, elapsed_time_s: 350, moving_time_s: 338, start_time: "2026-03-03T07:12:30.000Z", end_time: "2026-03-03T07:18:20.000Z", songs: [
            { track_id: "t3", track_name: "Titanium", artists: "David Guetta, Sia", started_at: "2026-03-03T07:09:52.000Z", ended_at: "2026-03-03T07:13:58.000Z", duration_ms: 246000 },
            { track_id: "t4", track_name: "Dog Days Are Over", artists: "Florence + The Machine", started_at: "2026-03-03T07:14:10.000Z", ended_at: "2026-03-03T07:18:22.000Z", duration_ms: 252000 }
          ] },
          { split_index: 4, distance_km: 1, elapsed_time_s: 295, moving_time_s: 292, start_time: "2026-03-03T07:18:20.000Z", end_time: "2026-03-03T07:23:15.000Z", songs: [
            { track_id: "t5", track_name: "As It Was", artists: "Harry Styles", started_at: "2026-03-03T07:19:00.000Z", ended_at: "2026-03-03T07:21:48.000Z", duration_ms: 168000 },
            { track_id: "t6", track_name: "Can't Hold Us", artists: "Macklemore & Ryan Lewis", started_at: "2026-03-03T07:22:10.000Z", ended_at: "2026-03-03T07:26:32.000Z", duration_ms: 262000 }
          ] },
          { split_index: 5, distance_km: 1, elapsed_time_s: 360, moving_time_s: 346, start_time: "2026-03-03T07:23:15.000Z", end_time: "2026-03-03T07:29:15.000Z", songs: [
            { track_id: "t6", track_name: "Can't Hold Us", artists: "Macklemore & Ryan Lewis", started_at: "2026-03-03T07:22:10.000Z", ended_at: "2026-03-03T07:26:32.000Z", duration_ms: 262000 }
          ] }
        ]
      }
    ]
  },
  longrun: {
    label: "Long Run (2 runs)",
    window_start: "2026-03-10T07:00:00.000Z",
    window_end: "2026-03-10T12:00:00.000Z",
    runs: [
      {
        run_id: "demo-long-1",
        name: "Saturday Long Run",
        start_time: "2026-03-10T08:05:00.000Z",
        end_time: "2026-03-10T09:39:00.000Z",
        distance_km: 14.2,
        elapsed_time_s: 5640,
        tracks_during_run: [
          { track_id: "l1", track_name: "All Too Well (10 Minute Version)", artists: "Taylor Swift", started_at: "2026-03-10T08:06:00.000Z", ended_at: "2026-03-10T08:16:15.000Z", duration_ms: 615000 },
          { track_id: "l2", track_name: "Vienna", artists: "Billy Joel", started_at: "2026-03-10T08:16:40.000Z", ended_at: "2026-03-10T08:20:14.000Z", duration_ms: 214000 },
          { track_id: "l3", track_name: "Pink + White", artists: "Frank Ocean", started_at: "2026-03-10T08:20:20.000Z", ended_at: "2026-03-10T08:23:14.000Z", duration_ms: 174000 },
          { track_id: "l4", track_name: "Golden", artists: "Jill Scott", started_at: "2026-03-10T08:24:00.000Z", ended_at: "2026-03-10T08:28:56.000Z", duration_ms: 296000 }
        ],
        splits: [
          { split_index: 1, distance_km: 1, elapsed_time_s: 375, moving_time_s: 365, start_time: "2026-03-10T08:05:00.000Z", end_time: "2026-03-10T08:11:15.000Z", songs: [
            { track_id: "l1", track_name: "All Too Well (10 Minute Version)", artists: "Taylor Swift", started_at: "2026-03-10T08:06:00.000Z", ended_at: "2026-03-10T08:16:15.000Z", duration_ms: 615000 }
          ] },
          { split_index: 2, distance_km: 1, elapsed_time_s: 390, moving_time_s: 370, start_time: "2026-03-10T08:11:15.000Z", end_time: "2026-03-10T08:17:45.000Z", songs: [
            { track_id: "l1", track_name: "All Too Well (10 Minute Version)", artists: "Taylor Swift", started_at: "2026-03-10T08:06:00.000Z", ended_at: "2026-03-10T08:16:15.000Z", duration_ms: 615000 },
            { track_id: "l2", track_name: "Vienna", artists: "Billy Joel", started_at: "2026-03-10T08:16:40.000Z", ended_at: "2026-03-10T08:20:14.000Z", duration_ms: 214000 }
          ] },
          { split_index: 3, distance_km: 1, elapsed_time_s: 410, moving_time_s: 392, start_time: "2026-03-10T08:17:45.000Z", end_time: "2026-03-10T08:24:35.000Z", songs: [
            { track_id: "l2", track_name: "Vienna", artists: "Billy Joel", started_at: "2026-03-10T08:16:40.000Z", ended_at: "2026-03-10T08:20:14.000Z", duration_ms: 214000 },
            { track_id: "l3", track_name: "Pink + White", artists: "Frank Ocean", started_at: "2026-03-10T08:20:20.000Z", ended_at: "2026-03-10T08:23:14.000Z", duration_ms: 174000 }
          ] }
        ]
      },
      {
        run_id: "demo-long-2",
        name: "Recovery Shuffle",
        start_time: "2026-03-10T10:10:00.000Z",
        end_time: "2026-03-10T10:38:00.000Z",
        distance_km: 4.9,
        elapsed_time_s: 1680,
        tracks_during_run: [
          { track_id: "l5", track_name: "A-Punk", artists: "Vampire Weekend", started_at: "2026-03-10T10:12:10.000Z", ended_at: "2026-03-10T10:14:25.000Z", duration_ms: 135000 },
          { track_id: "l6", track_name: "Electric Feel", artists: "MGMT", started_at: "2026-03-10T10:14:40.000Z", ended_at: "2026-03-10T10:18:30.000Z", duration_ms: 230000 }
        ],
        splits: [
          { split_index: 1, distance_km: 1, elapsed_time_s: 360, moving_time_s: 350, start_time: "2026-03-10T10:10:00.000Z", end_time: "2026-03-10T10:16:00.000Z", songs: [
            { track_id: "l5", track_name: "A-Punk", artists: "Vampire Weekend", started_at: "2026-03-10T10:12:10.000Z", ended_at: "2026-03-10T10:14:25.000Z", duration_ms: 135000 },
            { track_id: "l6", track_name: "Electric Feel", artists: "MGMT", started_at: "2026-03-10T10:14:40.000Z", ended_at: "2026-03-10T10:18:30.000Z", duration_ms: 230000 }
          ] },
          { split_index: 2, distance_km: 1, elapsed_time_s: 345, moving_time_s: 336, start_time: "2026-03-10T10:16:00.000Z", end_time: "2026-03-10T10:21:45.000Z", songs: [
            { track_id: "l6", track_name: "Electric Feel", artists: "MGMT", started_at: "2026-03-10T10:14:40.000Z", ended_at: "2026-03-10T10:18:30.000Z", duration_ms: 230000 }
          ] },
          { split_index: 3, distance_km: 1, elapsed_time_s: 360, moving_time_s: 350, start_time: "2026-03-10T10:21:45.000Z", end_time: "2026-03-10T10:27:45.000Z", songs: [] }
        ]
      }
    ]
  },
  silent: {
    label: "No Song Splits",
    window_start: "2026-03-14T09:00:00.000Z",
    window_end: "2026-03-14T10:30:00.000Z",
    runs: [
      {
        run_id: "demo-silent-1",
        name: "Phone Died Mid-Run",
        start_time: "2026-03-14T09:12:00.000Z",
        end_time: "2026-03-14T09:57:00.000Z",
        distance_km: 7.1,
        elapsed_time_s: 2700,
        tracks_during_run: [
          { track_id: "s1", track_name: "Sunset Lover", artists: "Petit Biscuit", started_at: "2026-03-14T09:10:30.000Z", ended_at: "2026-03-14T09:14:10.000Z", duration_ms: 220000 }
        ],
        splits: [
          { split_index: 1, distance_km: 1, elapsed_time_s: 355, moving_time_s: 350, start_time: "2026-03-14T09:12:00.000Z", end_time: "2026-03-14T09:17:55.000Z", songs: [
            { track_id: "s1", track_name: "Sunset Lover", artists: "Petit Biscuit", started_at: "2026-03-14T09:10:30.000Z", ended_at: "2026-03-14T09:14:10.000Z", duration_ms: 220000 }
          ] },
          { split_index: 2, distance_km: 1, elapsed_time_s: 370, moving_time_s: 356, start_time: "2026-03-14T09:17:55.000Z", end_time: "2026-03-14T09:24:05.000Z", songs: [] },
          { split_index: 3, distance_km: 1, elapsed_time_s: 385, moving_time_s: 370, start_time: "2026-03-14T09:24:05.000Z", end_time: "2026-03-14T09:30:30.000Z", songs: [] }
        ]
      }
    ]
  }
};

export function demoScenarioOptions() {
  return Object.entries(DEMO_SCENARIOS).map(([id, value]) => ({ id, label: value.label }));
}

export function makeDemoReport(scenario = "mellow") {
  const selected = DEMO_SCENARIOS[scenario] || DEMO_SCENARIOS.mellow;
  return {
    generated_at: new Date().toISOString(),
    scenario,
    scenario_label: selected.label,
    window_start: selected.window_start,
    window_end: selected.window_end,
    run_count: selected.runs.length,
    runs: selected.runs
  };
}
