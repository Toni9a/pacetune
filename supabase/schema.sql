create extension if not exists pgcrypto;

create table if not exists pacetune_users (
  id uuid primary key,
  created_at timestamptz not null default now()
);

create table if not exists pacetune_runs (
  owner_id uuid not null references pacetune_users(id) on delete cascade,
  run_id text not null,
  name text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  distance_km numeric not null,
  elapsed_time_s integer not null,
  source text not null default 'live',
  last_synced_at timestamptz not null default now(),
  primary key (owner_id, run_id)
);

create table if not exists pacetune_tracks (
  owner_id uuid not null references pacetune_users(id) on delete cascade,
  run_id text not null,
  track_id text not null,
  track_name text not null,
  artists text not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_ms integer not null,
  primary key (owner_id, run_id, track_id, ended_at),
  foreign key (owner_id, run_id) references pacetune_runs(owner_id, run_id) on delete cascade
);

create table if not exists pacetune_splits (
  owner_id uuid not null references pacetune_users(id) on delete cascade,
  run_id text not null,
  split_index integer not null,
  distance_km numeric not null,
  elapsed_time_s integer not null,
  moving_time_s integer not null default 0,
  start_time timestamptz not null,
  end_time timestamptz not null,
  primary key (owner_id, run_id, split_index),
  foreign key (owner_id, run_id) references pacetune_runs(owner_id, run_id) on delete cascade
);

create table if not exists pacetune_split_tracks (
  owner_id uuid not null references pacetune_users(id) on delete cascade,
  run_id text not null,
  split_index integer not null,
  track_id text not null,
  ended_at timestamptz not null,
  primary key (owner_id, run_id, split_index, track_id, ended_at),
  foreign key (owner_id, run_id, split_index) references pacetune_splits(owner_id, run_id, split_index) on delete cascade,
  foreign key (owner_id, run_id, track_id, ended_at) references pacetune_tracks(owner_id, run_id, track_id, ended_at) on delete cascade
);

alter table pacetune_users enable row level security;
alter table pacetune_runs enable row level security;
alter table pacetune_tracks enable row level security;
alter table pacetune_splits enable row level security;
alter table pacetune_split_tracks enable row level security;

-- Server routes use service role key, so RLS policies are optional for MVP.
