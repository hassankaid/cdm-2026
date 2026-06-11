-- =====================================================================
-- 0006 — Bonus tournoi (seed + résolution des points)
-- =====================================================================

-- Définition des 5 bonus. Verrou = coup d'envoi du 1er match.
insert into tournament_bonuses (key, label, points, value_kind, locked_at) values
  ('winner',      'Vainqueur de la Coupe du Monde', 20, 'team',   (select min(kickoff) from matches)),
  ('finalist',    'Finaliste',                      10, 'team',   (select min(kickoff) from matches)),
  ('top_scorer',  'Meilleur buteur (Soulier d''or)',15, 'player', (select min(kickoff) from matches)),
  ('best_player', 'Meilleur joueur (Ballon d''or)', 12, 'player', (select min(kickoff) from matches)),
  ('best_gk',     'Meilleur gardien (Gant d''or)',  10, 'player', (select min(kickoff) from matches))
on conflict (key) do nothing;

-- Résolution : quand result_value est renseigné, on attribue les points
create or replace function resolve_bonus(p_key text)
returns void language sql as $$
  update bonus_predictions bp
  set points = case when lower(trim(bp.value)) = lower(trim(b.result_value)) then b.points else 0 end,
      updated_at = now()
  from tournament_bonuses b
  where bp.bonus_key = p_key and b.key = p_key and b.result_value is not null;
$$;

create or replace function trg_bonus_resolve()
returns trigger language plpgsql as $$
begin
  if NEW.result_value is not null and NEW.result_value is distinct from OLD.result_value then
    perform resolve_bonus(NEW.key);
  end if;
  return NEW;
end;
$$;

drop trigger if exists bonus_resolve_trigger on tournament_bonuses;
create trigger bonus_resolve_trigger
  after update on tournament_bonuses
  for each row execute function trg_bonus_resolve();
