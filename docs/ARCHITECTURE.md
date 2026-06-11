# Architecture temps reel - Mondial 26

Je vais concevoir l'architecture temps réel complète. Aucun préambule — voici le livrable.

# Architecture temps réel — Mondial 26

## 0. Nouvelles colonnes / tables (vue d'ensemble)

| Objet | Type | Raison |
|---|---|---|
| `matches.api_fixture_id` | `bigint unique` | Lier un match à la fixture API-Football |
| `matches.last_synced_at` | `timestamptz` | Diagnostic + détection de staleness |
| `matches.status_long` | `text` | Statut brut API (`1H`, `HT`, `FT`, `AET`, `PEN`…) |
| `match_events.api_event_id` | `text` | Dédoublonnage déterministe (fallback hash) |
| `match_events.team_id` | `uuid → teams.id` | Cibler les notifs « fans d'une équipe » |
| `match_events.detail` | `text` | `Normal Goal`, `Penalty`, `Yellow Card`… |
| `match_events.assist_name` | `text` | Affichage timeline |
| `match_events.player_out` | `text` | Remplacements (joueur sortant) |
| `match_lineups` | table | Compos (endpoint `lineups`) |
| `notification_prefs` | table | Préférences notif par utilisateur |
| `favorite_teams` | table | Équipes suivies (ciblage notifs) |
| `notifications_log` | table | Anti-spam / idempotence push |
| `sync_state` | table (1 ligne) | État du cron, cadence adaptative |

---

## 1. Sync live — Edge Function `sync-live`

### 1.1 Colonnes ajoutées sur l'existant

```sql
alter table matches
  add column if not exists api_fixture_id bigint unique,
  add column if not exists last_synced_at timestamptz,
  add column if not exists status_long text;

-- match_events : on fiabilise le dédoublonnage et le ciblage
alter table match_events
  add column if not exists api_event_id  text,
  add column if not exists team_id       uuid references teams(id),
  add column if not exists detail        text,
  add column if not exists assist_name   text,
  add column if not exists player_out    text;

-- Clé d'idempotence : un event = (match, minute, type, joueur, équipe)
create unique index if not exists uq_match_events_dedupe
  on match_events (match_id, type, minute, coalesce(player_name,''), coalesce(team,''));
```

> API-Football ne fournit pas d'ID d'event stable et fiable. On dédoublonne donc sur la **clé naturelle** `(match_id, type, minute, player_name, team)`. `api_event_id` reste un confort si présent.

### 1.2 État du cron (cadence adaptative + auto-désactivation)

```sql
create table if not exists sync_state (
  id              int primary key default 1 check (id = 1),
  live_active     boolean not null default false,
  last_run_at     timestamptz,
  last_live_count int not null default 0,
  next_kickoff    timestamptz
);
insert into sync_state (id) values (1) on conflict do nothing;
```

### 1.3 Logique de la fonction (Deno / Edge Function)

```ts
// supabase/functions/sync-live/index.ts
import { createClient } from "jsr:@supabase/supabase-js@2";

const API = "https://v3.football.api-sports.io";
const HEADERS = { "x-apisports-key": Deno.env.get("API_FOOTBALL_KEY")! };
const LEAGUE = 1, SEASON = 2026; // World Cup

Deno.serve(async (req) => {
  // Sécurité : appel réservé au cron (header secret)
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET"))
    return new Response("forbidden", { status: 403 });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1) Fixtures live
  const r = await fetch(`${API}/fixtures?live=all&league=${LEAGUE}&season=${SEASON}`, { headers: HEADERS });
  const { response: live } = await r.json();

  for (const fx of live) {
    const fid = fx.fixture.id;
    const st  = fx.fixture.status.short;        // 1H, HT, 2H, ET, P, FT, AET, PEN
    const min = fx.fixture.status.elapsed;
    const isFinished = ["FT", "AET", "PEN"].includes(st);

    // 2) Score 90' (temps réglementaire) — clé pour le barème
    //    goals = score courant (peut inclure prolongations) ; score.fulltime = fin du temps régl.
    const reg = fx.score.fulltime;              // {home, away} figé à 90'
    const homeReg = isFinished ? reg.home : fx.goals.home;
    const awayReg = isFinished ? reg.away : fx.goals.away;

    await sb.from("matches").update({
      home_score: fx.goals.home,
      away_score: fx.goals.away,
      home_score_reg: homeReg,
      away_score_reg: awayReg,
      minute: min,
      status: isFinished ? "finished" : "live",
      status_long: st,
      last_synced_at: new Date().toISOString(),
    }).eq("api_fixture_id", fid);

    // 3) Events → upsert dédoublonné
    const matchRow = await sb.from("matches").select("id").eq("api_fixture_id", fid).single();
    const matchId = matchRow.data?.id;
    if (!matchId) continue;

    const ev = await fetch(`${API}/fixtures/events?fixture=${fid}`, { headers: HEADERS });
    const { response: events } = await ev.json();

    const rows = events.map((e) => ({
      match_id: matchId,
      type: e.type,                              // Goal | Card | subst | Var
      detail: e.detail,                          // Normal Goal | Penalty | Yellow Card…
      minute: e.time.elapsed + (e.time.extra ?? 0),
      player_name: e.player?.name ?? null,
      assist_name: e.assist?.name ?? null,
      player_out: e.type === "subst" ? e.assist?.name ?? null : null,
      team: e.team?.name ?? null,
      // team_id résolu via map fifa/name → teams.id (préchargée)
    }));

    if (rows.length)
      await sb.from("match_events")
        .upsert(rows, { onConflict: "match_id,type,minute,player_name,team", ignoreDuplicates: true });
  }

  // 4) MàJ état + auto-désactivation
  await sb.from("sync_state").update({
    live_active: live.length > 0,
    last_run_at: new Date().toISOString(),
    last_live_count: live.length,
  }).eq("id", 1);

  return new Response(JSON.stringify({ live: live.length }), {
    headers: { "content-type": "application/json" },
  });
});
```

**Notes clés :**
- Le **score 90'** (`home_score_reg`/`away_score_reg`) vient de `fx.score.fulltime` une fois le match fini → garantit que le barème (qui porte sur 90 min) ignore prolongations/tirs au but. Pendant le match, le score courant fait office de provisoire.
- **Fin de match** : `status='finished'` + `*_score_reg` renseignés → **le trigger de points existant** (`AFTER UPDATE OF status ON matches`) recalcule les points définitifs dans `predictions.points`. On ne touche pas à cette logique.
- `team_id` : on précharge un `Map(name|fifa → teams.id)` au début de la fonction pour résoudre l'équipe de chaque event (utile pour le ciblage push).

### 1.4 Planification (pg_cron + pg_net) avec auto-désactivation

Deux crons : un **« gardien »** léger qui décide d'activer le sync, et le **sync rapide** qui ne tape l'API que s'il y a du live.

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- A) Sync rapide toutes les 60s — mais court-circuit immédiat si pas de live attendu
create or replace function trigger_sync_live() returns void language plpgsql security definer as $$
declare s sync_state; nb_now int;
begin
  select * into s from sync_state where id = 1;

  -- Y a-t-il un match en cours OU dont le coup d'envoi est passé depuis < 3h ?
  select count(*) into nb_now from matches
   where status = 'live'
      or (status = 'scheduled' and kickoff <= now() and kickoff > now() - interval '3 hours');

  if nb_now = 0 then
    update sync_state set live_active = false where id = 1;  -- auto-désactivation
    return;
  end if;

  perform net.http_post(
    url     := 'https://<ref>.supabase.co/functions/v1/sync-live',
    headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>', 'Content-Type','application/json'),
    body    := '{}'::jsonb
  );
end $$;

select cron.schedule('sync-live-fast', '* * * * *', $$ select trigger_sync_live(); $$); -- chaque minute
```

Pour descendre **sous la minute** (≈30s), on planifie deux jobs décalés ou on lance un appel + un `pg_sleep`-free second `net.http_post` :

```sql
-- Cadence ~30s : second tir décalé de 30s via un job qui attend puis poste
select cron.schedule('sync-live-fast-30', '* * * * *',
  $$ select pg_sleep(30); select trigger_sync_live(); $$);
```

**Résumé planification :** cron chaque minute (× éventuel décalage 30s) → `trigger_sync_live()` ne paie l'appel HTTP **que** s'il existe un match `live` ou un `scheduled` récemment démarré. Hors fenêtre de matchs → `live_active=false`, **zéro appel API** (économie quota API-Football).

---

## 2. Classement temps réel + points provisoires

Principe : **ne pas écrire** les points provisoires dans `predictions.points` (réservé au définitif via trigger). On les **calcule à la volée** dans une vue, en réutilisant la même formule de barème.

### 2.1 Fonction de barème partagée (source unique de vérité)

```sql
-- Réutilisée par le trigger définitif ET par la vue provisoire
create or replace function compute_points(
  pred_h int, pred_a int, real_h int, real_a int, mult int
) returns int language sql immutable as $$
  select case
    when pred_h is null or real_h is null then 0
    when pred_h = real_h and pred_a = real_a then 3 * mult           -- score exact
    when (pred_h - pred_a) = (real_h - real_a) then 2 * mult         -- bonne différence
    when sign(pred_h - pred_a) = sign(real_h - real_a) then 1 * mult -- bonne issue
    else 0
  end;
$$;

-- Multiplicateur de tour
create or replace function stage_mult(stage text) returns int language sql immutable as $$
  select case stage
    when 'group'  then 1 when 'r32' then 2 when 'r16' then 3
    when 'quarter' then 4 when 'semi' then 5 when 'final' then 6 else 1 end;
$$;
```

### 2.2 Vue des points par prono (live + définitif)

```sql
create or replace view prediction_points_live as
select
  p.user_id,
  p.match_id,
  m.status,
  m.stage,
  -- pour les matchs FINIS : on s'aligne sur predictions.points (déjà calculé par le trigger)
  -- pour les matchs LIVE   : score courant traité comme final (réglementaire)
  case
    when m.status = 'finished' then p.points
    when m.status = 'live' then
      compute_points(p.pred_home, p.pred_away,
                     coalesce(m.home_score_reg, m.home_score),
                     coalesce(m.away_score_reg, m.away_score),
                     stage_mult(m.stage))
    else 0
  end as points_effectifs,
  (m.status = 'live') as is_provisional
from predictions p
join matches m on m.id = p.match_id;
```

### 2.3 Vue classement live (remplace/complète `leaderboard`)

```sql
create or replace view leaderboard_live as
select
  pr.id            as user_id,
  pr.display_name,
  pr.avatar_url,
  coalesce(sum(ppl.points_effectifs)            , 0) as total_points,
  coalesce(sum(ppl.points_effectifs) filter (where not ppl.is_provisional), 0) as points_definitifs,
  coalesce(sum(ppl.points_effectifs) filter (where ppl.is_provisional)    , 0) as points_provisoires,
  bool_or(ppl.is_provisional)                        as a_du_live,
  rank() over (order by sum(ppl.points_effectifs) desc) as position
from profiles pr
left join prediction_points_live ppl on ppl.user_id = pr.id
group by pr.id, pr.display_name, pr.avatar_url
order by total_points desc;
```

Le front affiche `total_points` avec un badge « live » quand `points_provisoires > 0`, et peut montrer le delta provisoire (« +5 en direct »). Quand le match passe `finished`, le trigger fige `predictions.points` et la part provisoire bascule en définitif — sans saut de valeur (même formule, même score réglementaire).

---

## 3. Supabase Realtime — canaux & abonnements

### 3.1 Tables exposées (publication)

```sql
alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table match_events;
-- replica identity full pour recevoir le contenu complet des UPDATE
alter table matches      replica identity full;
alter table match_events replica identity full;
```

> Une **vue** (`leaderboard_live`) ne diffuse pas via Realtime. Deux options : (a) le front recalcule/ré-interroge la vue à chaque event reçu sur `matches` (simple, suffisant pour un groupe d'amis) ; (b) on matérialise un `leaderboard_snapshot` rafraîchi par le trigger et on l'ajoute à la publication. Recommandé : **option (a)** au lancement, (b) si le pool grossit.

### 3.2 Canaux

| Canal | Source | Filtre | Usage front |
|---|---|---|---|
| `matches` | postgres_changes UPDATE | `status=eq.live` | Score/minute live partout (cards, header) |
| `match:<id>:events` | postgres_changes INSERT | `match_id=eq.<id>` | Timeline écran détail |
| `leaderboard` | broadcast | — | Re-fetch `leaderboard_live` au signal |

### 3.3 Abonnement front (Next.js)

```ts
// Scores live globaux
supabase.channel("live-matches")
  .on("postgres_changes",
    { event: "UPDATE", schema: "public", table: "matches", filter: "status=eq.live" },
    (payload) => updateMatchInStore(payload.new))
  .subscribe();

// Écran détail : events d'UN match
supabase.channel(`match:${matchId}:events`)
  .on("postgres_changes",
    { event: "INSERT", schema: "public", table: "match_events", filter: `match_id=eq.${matchId}` },
    (payload) => pushEventToTimeline(payload.new))
  .subscribe();

// Classement : à chaque UPDATE de matches live, on re-fetch la vue (option a)
supabase.channel("live-matches")
  .on("postgres_changes", { event: "UPDATE", schema: "public", table: "matches" },
    () => debouncedRefetch("leaderboard_live"));
```

> RLS : `matches` et `match_events` sont en lecture publique (authentifié) — les abonnements passent donc sans souci. Realtime respecte la RLS via le JWT du client.

---

## 4. Web Push — pipeline & ciblage

### 4.1 Tables (la table `push_subscriptions` existe déjà)

```sql
-- Préférences par utilisateur
create table if not exists notification_prefs (
  user_id          uuid primary key references profiles(id) on delete cascade,
  goals            boolean not null default true,   -- buts
  cards            boolean not null default false,  -- cartons (rouges surtout)
  kickoff          boolean not null default true,   -- coup d'envoi de mes pronos
  lock_reminder    boolean not null default true,   -- "ferme ton prono, ça siffle bientôt"
  final_result     boolean not null default true,   -- points encaissés
  only_my_preds    boolean not null default false,  -- ne notifier que mes matchs pronostiqués
  rank_changes     boolean not null default true    -- "tu t'es fait doubler"
);

-- Équipes suivies (ciblage "fans d'une équipe")
create table if not exists favorite_teams (
  user_id uuid references profiles(id) on delete cascade,
  team_id uuid references teams(id)   on delete cascade,
  primary key (user_id, team_id)
);

-- Idempotence : ne pas renvoyer 2× la même notif (le cron repasse les events)
create table if not exists notifications_log (
  id          bigserial primary key,
  event_key   text unique,   -- ex: 'goal:<match_event_id>' ou 'kickoff:<match_id>'
  created_at  timestamptz default now()
);
```

### 4.2 Déclenchement & ciblage

Le push est déclenché par un **trigger `AFTER INSERT ON match_events`** qui appelle l'Edge Function `send-push` via `pg_net` (ou par `sync-live` directement après l'upsert des nouveaux events). Idempotence garantie par `notifications_log.event_key`.

```sql
create or replace function notify_on_event() returns trigger
language plpgsql security definer as $$
begin
  -- on ne push que sur buts et cartons rouges
  if new.type = 'Goal' or (new.type = 'Card' and new.detail = 'Red Card') then
    perform net.http_post(
      url     := 'https://<ref>.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object('x-cron-secret','<CRON_SECRET>','Content-Type','application/json'),
      body    := to_jsonb(new)
    );
  end if;
  return new;
end $$;

create trigger trg_notify_event after insert on match_events
  for each row execute function notify_on_event();
```

**Cohortes de ciblage** (résolues côté Edge Function en SQL) — l'utilisateur reçoit la notif s'il est dans **au moins une** cohorte ET que sa préférence correspondante est active :

```sql
-- Destinataires d'un but dans le match :match_id, équipe :team_id
with cibles as (
  -- a) fans de l'une des deux équipes du match
  select ft.user_id from favorite_teams ft
   join matches m on m.id = :match_id
   where ft.team_id in (m.home_team_id, m.away_team_id)
  union
  -- b) joueurs ayant pronostiqué ce match
  select p.user_id from predictions p where p.match_id = :match_id
)
select s.endpoint, s.p256dh, s.auth, np.*
from cibles c
join push_subscriptions s on s.user_id = c.user_id
join notification_prefs  np on np.user_id = c.user_id
where np.goals = true
  and (np.only_my_preds = false
       or exists (select 1 from predictions p2
                  where p2.user_id = c.user_id and p2.match_id = :match_id));
```

### 4.3 Edge Function `send-push` (VAPID)

```ts
// supabase/functions/send-push/index.ts
import webpush from "npm:web-push@3";
webpush.setVapidDetails(
  "mailto:contact@hassankaid.com",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

Deno.serve(async (req) => {
  const ev = await req.json(); // match_event
  const sb = createClient(URL, SERVICE_ROLE);

  // Idempotence
  const key = `${ev.type}:${ev.id}`;
  const { error } = await sb.from("notifications_log").insert({ event_key: key });
  if (error) return new Response("dup", { status: 200 }); // déjà envoyé

  const { data: targets } = await sb.rpc("push_targets_for_event", { p_event_id: ev.id });

  // Message "street" bon enfant
  const payload = JSON.stringify({
    title: "⚽ BUUUUT !",
    body: `${ev.player_name} plante pour ${ev.team} (${ev.minute}') — vérifie ton prono khouya !`,
    url: `/match/${ev.match_id}`,
  });

  await Promise.allSettled((targets ?? []).map((t) =>
    webpush.sendNotification(
      { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } },
      payload,
    ).catch(async (e) => {
      if (e.statusCode === 410 || e.statusCode === 404) // subscription morte
        await sb.from("push_subscriptions").delete().eq("endpoint", t.endpoint);
    })
  ));

  return new Response("ok");
});
```

**Autres déclencheurs push** (cron dédiés, mêmes garde-fous d'idempotence) :
- **Rappel verrouillage** (`lock_reminder`) : cron qui repère les pronos manquants pour un match dont le kickoff est dans 15 min → « Ça va siffler, t'as pas posé ton prono ! ».
- **Coup d'envoi** (`kickoff`) : à `status` → `live`.
- **Résultat final** (`final_result`) : à `status` → `finished`, push personnalisé « +X pts encaissés ».
- **Changement de rang** (`rank_changes`) : comparaison `leaderboard_live` avant/après match.

---

## 5. Écran détail match — données nécessaires

### 5.1 Table des compos

```sql
create table if not exists match_lineups (
  id            bigserial primary key,
  match_id      uuid references matches(id) on delete cascade,
  team_id       uuid references teams(id),
  formation     text,                         -- "4-3-3"
  player_name   text not null,
  player_number int,
  position      text,                          -- G, D, M, A
  grid          text,                          -- "1:1" (placement terrain, API-Football)
  is_starter    boolean not null default true, -- titulaire / remplaçant
  api_player_id bigint,
  unique (match_id, team_id, player_name)
);
alter publication supabase_realtime add table match_lineups; -- optionnel (compos arrivent ~40 min avant)
```

Alimentée par un appel `GET /fixtures/lineups?fixture=<fid>` (disponible ~20-40 min avant le coup d'envoi), intégré dans `sync-live` ou un cron pré-match dédié (économe : 1 appel par match, une fois les compos publiées).

### 5.2 Données consommées par l'écran

| Bloc UI | Source | Détail |
|---|---|---|
| En-tête live | `matches` (Realtime) | `home_score`/`away_score`, `minute`, `status`, logos via `teams.logo_url` |
| Score 90' | `matches.*_score_reg` | Affiché à part une fois fini (prolongations/TAB séparés) |
| Timeline | `match_events` (Realtime INSERT) | tri par `minute` ; icônes selon `type`+`detail` (but/csc/pénalty, jaune/rouge, remplacement avec `assist_name`/`player_out`) |
| Compos | `match_lineups` | 2 colonnes (titulaires + banc), `formation`, terrain via `grid` |
| Mon prono | `predictions` | mon `pred_home`/`pred_away` + points (provisoires via `prediction_points_live`) |
| Pronos des potes | `predictions` + `profiles` | qui a mis quoi (lecture publique) |

### 5.3 Requête d'hydratation initiale (avant abonnement Realtime)

```sql
-- one-shot au chargement de la page, puis Realtime prend le relais
select
  m.*,
  (select coalesce(json_agg(e order by e.minute), '[]') from match_events e where e.match_id = m.id) as events,
  (select coalesce(json_agg(l), '[]') from match_lineups l where l.match_id = m.id)                  as lineups,
  (select row_to_json(p) from predictions p where p.match_id = m.id and p.user_id = auth.uid())      as my_pred,
  (select coalesce(json_agg(json_build_object(
            'name', pr.display_name, 'h', p2.pred_home, 'a', p2.pred_away))
          , '[]')
     from predictions p2 join profiles pr on pr.id = p2.user_id
    where p2.match_id = m.id)                                                                        as all_preds
from matches m
where m.id = :match_id;
```

---

## Récap des migrations à appliquer

1. **`matches`** : `api_fixture_id`, `last_synced_at`, `status_long`.
2. **`match_events`** : `api_event_id`, `team_id`, `detail`, `assist_name`, `player_out` + index unique de dédoublonnage.
3. **Nouvelles tables** : `sync_state`, `match_lineups`, `notification_prefs`, `favorite_teams`, `notifications_log`.
4. **Fonctions** : `compute_points`, `stage_mult`, `trigger_sync_live`, `notify_on_event`, RPC `push_targets_for_event`.
5. **Vues** : `prediction_points_live`, `leaderboard_live`.
6. **Realtime** : publication + `replica identity full` sur `matches`, `match_events`, (`match_lineups`).
7. **Edge Functions** : `sync-live`, `send-push`.
8. **Crons** : `sync-live-fast` (+ décalage 30s), rappels verrouillage / kickoff / résultat / rang.

**Garde-fou central :** une **seule formule de barème** (`compute_points`) partagée entre le calcul provisoire (vue) et définitif (trigger existant), et le **score réglementaire** (`*_score_reg`) comme référence unique → aucune incohérence quand le provisoire bascule en définitif.