-- =====================================================================
-- 0003 — Fondations du temps réel (le match en direct)
-- =====================================================================

-- Suivi de synchro sur matches
alter table matches add column if not exists last_synced_at timestamptz;
alter table matches add column if not exists status_long text;

-- Remplacements : joueur sortant
alter table match_events add column if not exists player_out text;

-- État global du moteur de sync (une seule ligne, accès service_role uniquement)
create table if not exists sync_state (
  id              int primary key default 1,
  live_active     boolean not null default false,
  last_run_at     timestamptz,
  last_live_count int not null default 0,
  next_kickoff    timestamptz,
  constraint sync_state_singleton check (id = 1)
);
insert into sync_state (id) values (1) on conflict (id) do nothing;
alter table sync_state enable row level security; -- pas de policy => invisible aux clients

-- Compositions (lineups)
create table if not exists match_lineups (
  id            bigint generated always as identity primary key,
  match_id      bigint not null references matches (id) on delete cascade,
  team_id       bigint references teams (id),
  formation     text,
  player_name   text not null,
  player_number int,
  position      text,
  grid          text,
  is_starter    boolean not null default true,
  api_player_id bigint,
  unique (match_id, team_id, player_name)
);
alter table match_lineups enable row level security;
drop policy if exists "lineups readable" on match_lineups;
create policy "lineups readable" on match_lineups for select to authenticated using (true);

-- ------------------------------------------------------------------
-- Vues classement temps réel (points provisoires pendant le live)
-- ------------------------------------------------------------------
create or replace view prediction_points_live as
select
  pr.id,
  pr.user_id,
  pr.match_id,
  m.status as match_status,
  case
    when m.status = 'finished' then coalesce(pr.points, 0)
    when m.status = 'live'
         and m.home_score is not null and m.away_score is not null
      then prediction_base_points(pr.pred_home, pr.pred_away, m.home_score, m.away_score)
           * stage_multiplier(m.stage)
    else 0
  end as live_points,
  (m.status = 'live') as is_provisional
from predictions pr
join matches m on m.id = pr.match_id;

-- Vue interne : jamais exposée aux clients (éviterait de lire les pronos des autres)
revoke all on prediction_points_live from anon, authenticated;

create or replace view leaderboard_live as
select
  p.id as user_id,
  p.display_name,
  p.avatar_url,
  coalesce((select sum(ppl.live_points) from prediction_points_live ppl where ppl.user_id = p.id), 0)
    + coalesce((select sum(bp.points) from bonus_predictions bp where bp.user_id = p.id), 0)
    as total_live,
  coalesce((select sum(ppl.live_points) from prediction_points_live ppl
            where ppl.user_id = p.id and not ppl.is_provisional), 0)
    + coalesce((select sum(bp.points) from bonus_predictions bp where bp.user_id = p.id), 0)
    as total_official,
  coalesce((select count(*) from prediction_points_live ppl
            where ppl.user_id = p.id and ppl.is_provisional and ppl.live_points > 0), 0)
    as live_hits
from profiles p;

-- ------------------------------------------------------------------
-- Realtime : pousser matches + match_events vers les clients
-- ------------------------------------------------------------------
alter table matches replica identity full;
alter table match_events replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table matches;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table match_events;
  exception when others then null;
  end;
end $$;
