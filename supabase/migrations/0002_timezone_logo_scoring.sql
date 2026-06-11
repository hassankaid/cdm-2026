-- =====================================================================
-- 0002 — Fuseau horaire joueur, logo des équipes, calcul auto des points
-- =====================================================================

-- Fuseau horaire par joueur (IANA, ex. 'Europe/Paris', 'America/New_York').
-- Tout est stocké en UTC ; on convertit à l'affichage et pour les notifications.
alter table profiles add column timezone text not null default 'Europe/Paris';

-- Logo / drapeau officiel de l'équipe (URL fournie par l'API).
alter table teams add column logo_url text;

-- Le profil reprend aussi le fuseau choisi à l'inscription
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, timezone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'timezone', 'Europe/Paris')
  );
  return new;
end;
$$;

-- ------------------------------------------------------------------
-- CALCUL AUTOMATIQUE DES POINTS
-- ------------------------------------------------------------------
-- Recalcule les points de tous les pronos d'un match (score à 90' × multiplicateur du tour)
create or replace function recompute_match_points(p_match_id bigint)
returns void language sql as $$
  update predictions pr
  set points = prediction_base_points(pr.pred_home, pr.pred_away, m.home_score_reg, m.away_score_reg)
               * stage_multiplier(m.stage),
      updated_at = now()
  from matches m
  where pr.match_id = p_match_id
    and m.id = p_match_id
    and m.home_score_reg is not null
    and m.away_score_reg is not null;
$$;

-- Déclencheur : dès qu'un match est terminé avec un score à 90', on recalcule
create or replace function trg_matches_score()
returns trigger language plpgsql as $$
begin
  if NEW.status = 'finished'
     and NEW.home_score_reg is not null
     and NEW.away_score_reg is not null
     and (
       TG_OP = 'INSERT'
       or OLD.status is distinct from NEW.status
       or OLD.home_score_reg is distinct from NEW.home_score_reg
       or OLD.away_score_reg is distinct from NEW.away_score_reg
     )
  then
    perform recompute_match_points(NEW.id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists matches_score_trigger on matches;
create trigger matches_score_trigger
  after insert or update on matches
  for each row execute function trg_matches_score();
