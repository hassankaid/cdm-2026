-- =====================================================================
-- 0014_score_adjust — ajustement manuel de score (admin)
-- Un champ profiles.score_adjust (par défaut 0) ajouté au total des deux
-- classements (accueil + live). Permet de corriger/bonifier un total à la
-- main sans toucher aux pronos ni polluer les bonus tournoi. Réversible.
-- =====================================================================
alter table profiles add column if not exists score_adjust int not null default 0;

create or replace view leaderboard as
  select
    p.id            as user_id,
    p.display_name,
    p.avatar_url,
    coalesce(sum(pr.points), 0)
      + coalesce((select sum(bp.points) from bonus_predictions bp where bp.user_id = p.id), 0)
      + p.score_adjust
                    as total_points,
    count(pr.points) filter (where pr.points is not null) as scored_predictions,
    count(*) filter (where pr.points = 3) as exact_scores
  from profiles p
  left join predictions pr on pr.user_id = p.id
  group by p.id, p.display_name, p.avatar_url, p.score_adjust;

create or replace view leaderboard_live as
select
  p.id as user_id,
  p.display_name,
  p.avatar_url,
  coalesce((select sum(ppl.live_points) from prediction_points_live ppl where ppl.user_id = p.id), 0)
    + coalesce((select sum(bp.points) from bonus_predictions bp where bp.user_id = p.id), 0)
    + p.score_adjust
    as total_live,
  coalesce((select sum(ppl.live_points) from prediction_points_live ppl
            where ppl.user_id = p.id and not ppl.is_provisional), 0)
    + coalesce((select sum(bp.points) from bonus_predictions bp where bp.user_id = p.id), 0)
    + p.score_adjust
    as total_official,
  coalesce((select count(*) from prediction_points_live ppl
            where ppl.user_id = p.id and ppl.is_provisional and ppl.live_points > 0), 0)
    as live_hits
from profiles p;
