-- =====================================================================
-- 0009 — Classements de groupe (source : API-Football, départages FIFA)
-- =====================================================================
create table group_standings (
  team_id      bigint primary key references teams (id) on delete cascade,
  group_letter char(1),
  rank         int,
  played       int,
  win          int,
  draw         int,
  lose         int,
  gf           int,
  ga           int,
  gd           int,
  points       int,
  updated_at   timestamptz not null default now()
);
alter table group_standings enable row level security;
create policy "standings readable" on group_standings for select to authenticated using (true);
