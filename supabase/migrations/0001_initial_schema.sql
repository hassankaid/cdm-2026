-- =====================================================================
-- Pronos Coupe du Monde 2026 — Schéma initial
-- =====================================================================
-- Conventions :
--  * Tout est en UTC (timestamptz). L'affichage local se fait côté client.
--  * Lecture publique pour les données "officielles" (teams, matches, events).
--  * Écriture des données officielles réservée au service_role (cron / edge functions).
--  * Le verrouillage des pronos au coup d'envoi est imposé par RLS (inviolable).
-- =====================================================================

-- ------------------------------------------------------------------
-- ENUMS
-- ------------------------------------------------------------------
create type match_stage as enum (
  'group',        -- phase de groupes      (×1)
  'round32',      -- 16es de finale        (×2)
  'round16',      -- 8es de finale         (×3)
  'quarter',      -- quarts                (×4)
  'semi',         -- demi-finales          (×5)
  'third_place',  -- match pour la 3e place(×6)
  'final'         -- finale                (×6)
);

create type match_status as enum (
  'scheduled',    -- à venir
  'live',         -- en cours
  'finished',     -- terminé
  'postponed',
  'cancelled'
);

-- Multiplicateur de points par tour
create or replace function stage_multiplier(s match_stage)
returns int language sql immutable as $$
  select case s
    when 'group'       then 1
    when 'round32'     then 2
    when 'round16'     then 3
    when 'quarter'     then 4
    when 'semi'        then 5
    when 'third_place' then 6
    when 'final'       then 6
  end;
$$;

-- ------------------------------------------------------------------
-- PROFILES (un par utilisateur authentifié)
-- ------------------------------------------------------------------
create table profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

-- Crée automatiquement le profil à l'inscription
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ------------------------------------------------------------------
-- TEAMS (48 équipes)
-- ------------------------------------------------------------------
create table teams (
  id            bigint generated always as identity primary key,
  api_team_id   bigint unique,             -- id chez API-Football
  fifa_code     text unique,               -- ex. 'FRA'
  name          text not null,             -- nom officiel
  name_fr       text,                      -- nom en français
  flag_emoji    text,
  group_letter  char(1)                    -- 'A'..'L' (null hors phase de groupes)
);

-- ------------------------------------------------------------------
-- MATCHES (104 matchs)
-- ------------------------------------------------------------------
create table matches (
  id              bigint generated always as identity primary key,
  api_fixture_id  bigint unique,           -- id chez API-Football
  stage           match_stage not null,
  group_letter    char(1),                 -- pour la phase de groupes
  round_label     text,                    -- ex. '16e de finale', 'Quart 3'
  match_number    int,                     -- n° officiel FIFA (1..104)
  -- Équipes : null tant que non connues (placeholders type "1er groupe A")
  home_team_id    bigint references teams (id),
  away_team_id    bigint references teams (id),
  home_placeholder text,                   -- ex. 'Vainqueur Groupe A'
  away_placeholder text,
  kickoff         timestamptz not null,
  venue           text,
  status          match_status not null default 'scheduled',
  minute          int,                     -- minute de jeu si live
  -- Score affiché (live ou final, peut inclure prolongation)
  home_score      int,
  away_score      int,
  -- Score à 90' (temps réglementaire) — c'est CELUI utilisé pour le calcul des points
  home_score_reg  int,
  away_score_reg  int,
  -- Pour les matchs à élimination directe
  went_to_extra   boolean not null default false,
  went_to_pens    boolean not null default false,
  winner_team_id  bigint references teams (id),  -- qualifié réel
  updated_at      timestamptz not null default now()
);

create index matches_kickoff_idx on matches (kickoff);
create index matches_status_idx  on matches (status);

-- ------------------------------------------------------------------
-- PREDICTIONS (un prono par joueur et par match)
-- ------------------------------------------------------------------
create table predictions (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references profiles (id) on delete cascade,
  match_id    bigint not null references matches (id) on delete cascade,
  pred_home   int not null check (pred_home >= 0 and pred_home <= 99),
  pred_away   int not null check (pred_away >= 0 and pred_away <= 99),
  points      int,                          -- null tant que le match n'est pas calculé
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, match_id)
);

create index predictions_match_idx on predictions (match_id);

-- Calcul des points d'un prono (base) à partir des scores à 90'
create or replace function prediction_base_points(
  ph int, pa int, rh int, ra int
) returns int language sql immutable as $$
  select case
    when ph is null or pa is null or rh is null or ra is null then null
    when ph = rh and pa = ra then 3                              -- score exact
    when (ph - pa) = (rh - ra) then 2                            -- bonne diff (inclut bonne issue)
    when sign(ph - pa) = sign(rh - ra) then 1                    -- bonne issue
    else 0
  end;
$$;

-- ------------------------------------------------------------------
-- MATCH EVENTS (timeline live)
-- ------------------------------------------------------------------
create type event_type as enum ('goal','own_goal','penalty_goal','penalty_missed','yellow','red','subst','var');

create table match_events (
  id           bigint generated always as identity primary key,
  api_event_id text,                        -- dédoublonnage côté API
  match_id     bigint not null references matches (id) on delete cascade,
  team_id      bigint references teams (id),
  type         event_type not null,
  minute       int,
  minute_extra int,
  player_name  text,
  assist_name  text,
  detail       text,
  created_at   timestamptz not null default now(),
  unique (match_id, api_event_id)
);

create index match_events_match_idx on match_events (match_id, minute);

-- ------------------------------------------------------------------
-- BONUS TOURNOI
-- ------------------------------------------------------------------
create table tournament_bonuses (
  key          text primary key,            -- 'winner','runner_up','top_scorer','best_player','best_gk'
  label        text not null,
  points       int not null,
  value_kind   text not null,               -- 'team' ou 'player'
  result_value text,                         -- résolu en fin de tournoi (team_id ou nom)
  locked_at    timestamptz                   -- = coup d'envoi du 1er match
);

create table bonus_predictions (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references profiles (id) on delete cascade,
  bonus_key  text not null references tournament_bonuses (key),
  value      text not null,                 -- team_id (texte) ou nom de joueur
  points     int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, bonus_key)
);

-- ------------------------------------------------------------------
-- PUSH (Web Push)
-- ------------------------------------------------------------------
create table push_subscriptions (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references profiles (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------
-- CLASSEMENT (vue)
-- ------------------------------------------------------------------
create or replace view leaderboard as
  select
    p.id            as user_id,
    p.display_name,
    p.avatar_url,
    coalesce(sum(pr.points), 0)
      + coalesce((select sum(bp.points) from bonus_predictions bp where bp.user_id = p.id), 0)
                    as total_points,
    count(pr.points) filter (where pr.points is not null) as scored_predictions,
    count(*) filter (where pr.points = 3) as exact_scores
  from profiles p
  left join predictions pr on pr.user_id = p.id
  group by p.id, p.display_name, p.avatar_url;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table profiles            enable row level security;
alter table teams               enable row level security;
alter table matches             enable row level security;
alter table predictions         enable row level security;
alter table match_events        enable row level security;
alter table tournament_bonuses  enable row level security;
alter table bonus_predictions   enable row level security;
alter table push_subscriptions  enable row level security;

-- Profiles : tout le monde voit (pour le classement), chacun modifie le sien
create policy "profiles readable" on profiles for select to authenticated using (true);
create policy "update own profile" on profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- Données officielles : lecture pour tous les connectés, écriture service_role uniquement
create policy "teams readable"   on teams   for select to authenticated using (true);
create policy "matches readable" on matches for select to authenticated using (true);
create policy "events readable"  on match_events for select to authenticated using (true);
create policy "bonuses readable" on tournament_bonuses for select to authenticated using (true);

-- PREDICTIONS — le coeur du verrouillage
-- Lecture : ses propres pronos toujours ; ceux des autres seulement après le coup d'envoi
create policy "read predictions" on predictions for select to authenticated using (
  auth.uid() = user_id
  or exists (select 1 from matches m where m.id = match_id and now() >= m.kickoff)
);
-- Insertion : seulement les siens, et seulement AVANT le coup d'envoi
create policy "insert own prediction before kickoff" on predictions for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (select 1 from matches m where m.id = match_id and now() < m.kickoff)
  );
-- Modification : seulement les siens, et seulement AVANT le coup d'envoi
create policy "update own prediction before kickoff" on predictions for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from matches m where m.id = match_id and now() < m.kickoff)
  );

-- BONUS PREDICTIONS — verrou au lancement du tournoi (locked_at du bonus)
create policy "read bonus predictions" on bonus_predictions for select to authenticated using (
  auth.uid() = user_id
  or exists (select 1 from tournament_bonuses b where b.key = bonus_key and b.locked_at is not null and now() >= b.locked_at)
);
create policy "insert own bonus before lock" on bonus_predictions for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (select 1 from tournament_bonuses b where b.key = bonus_key and (b.locked_at is null or now() < b.locked_at))
  );
create policy "update own bonus before lock" on bonus_predictions for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from tournament_bonuses b where b.key = bonus_key and (b.locked_at is null or now() < b.locked_at))
  );

-- PUSH : chacun gère ses abonnements
create policy "manage own push" on push_subscriptions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
