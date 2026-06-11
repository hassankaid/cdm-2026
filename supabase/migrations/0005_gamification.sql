-- =====================================================================
-- 0005 — Gamification : séries, stats, fétiche/bête noire, boss/clown
-- =====================================================================

-- Points de base (1/2/3, sans multiplicateur) — nécessaire pour les stats
-- (score exact, taux de réussite, séries, affinité par équipe).
alter table predictions add column if not exists base_points int;

-- Cache de la série (streak) de bons pronos
alter table profiles add column if not exists current_streak int not null default 0;
alter table profiles add column if not exists best_streak    int not null default 0;

-- Le calcul des points renseigne aussi base_points
create or replace function recompute_match_points(p_match_id bigint)
returns void language sql as $$
  update predictions pr
  set base_points = prediction_base_points(pr.pred_home, pr.pred_away, m.home_score_reg, m.away_score_reg),
      points      = prediction_base_points(pr.pred_home, pr.pred_away, m.home_score_reg, m.away_score_reg)
                    * stage_multiplier(m.stage),
      updated_at  = now()
  from matches m
  where pr.match_id = p_match_id
    and m.id = p_match_id
    and m.home_score_reg is not null
    and m.away_score_reg is not null;
$$;

-- Récompenses du jour (boss / clown), une par jour et par type
create table daily_awards (
  id         bigint generated always as identity primary key,
  award_date date not null,
  kind       text not null,                      -- 'boss' | 'clown'
  user_id    uuid references profiles (id) on delete cascade,
  points     int,
  created_at timestamptz not null default now(),
  unique (award_date, kind)
);
alter table daily_awards enable row level security;
create policy "awards readable" on daily_awards for select to authenticated using (true);

-- Stats par joueur (taux de réussite, scores exacts, etc.)
create or replace view player_stats as
select
  p.id                                                              as user_id,
  p.display_name,
  count(pr.base_points)                                             as graded,        -- matchs notés
  count(*) filter (where pr.base_points > 0)                        as hits,          -- bons pronos
  count(*) filter (where pr.base_points = 3)                        as exacts,        -- scores exacts
  coalesce(sum(pr.points), 0)                                       as total_points,
  p.current_streak,
  p.best_streak,
  case when count(pr.base_points) > 0
    then round(100.0 * count(*) filter (where pr.base_points > 0) / count(pr.base_points))
    else 0 end                                                      as success_rate
from profiles p
left join predictions pr on pr.user_id = p.id
group by p.id, p.display_name, p.current_streak, p.best_streak;

-- Affinité par équipe (pour fétiche / bête noire)
create or replace view player_team_affinity as
select user_id, team_id, count(*) as n, round(avg(base_points), 2) as avg_pts
from (
  select pr.user_id, m.home_team_id as team_id, pr.base_points
  from predictions pr join matches m on m.id = pr.match_id
  where pr.base_points is not null and m.home_team_id is not null
  union all
  select pr.user_id, m.away_team_id as team_id, pr.base_points
  from predictions pr join matches m on m.id = pr.match_id
  where pr.base_points is not null and m.away_team_id is not null
) t
group by user_id, team_id;
