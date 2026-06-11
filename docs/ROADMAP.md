# Feuille de route - Mondial 26

# Mondial 26 — Feuille de route unifiée

## 1. Vue d'ensemble des fonctionnalités par espace

### Espace ACCUEIL (Mon QG)
- Carte « À chaud » : prochain prono à poser + compte à rebours avant verrouillage
- Tuiles Points / Rang / Série en cours (streak 🔥)
- Bandeau Live si match en cours (points provisoires)
- Boss du jour (carte podium repliable)
- Le buzz : 2-3 dernières activités du pool
- Rappel bonus tournoi si fenêtre ouverte
- Mini-rappel dernier match joué + points gagnés

### Espace MATCHS (la salle des machines)
- Liste filtrable : À pronostiquer / Tous / Par tour / Par jour
- Stepper de score inline (prono en < 10 s, auto-save)
- Badge points + pastille multiplicateur de tour (×1 → ×6)
- Entrée vers Bonus tournoi
- **Détail match** (écran clé) : en-tête live, ton prono, pronos des autres (après verrouillage), timeline événements, compos, mini-classement du match

### Espace LIVE (la dopamine)
- Matchs en cours : score + minute pulsée (Realtime)
- Ton prono vs score actuel + points provisoires qui clignotent
- Fil d'événements live taquin
- Si rien en cours : prochain coup d'envoi + countdown

### Espace CLASSEMENT (le nerf de la guerre)
- Pool GLOBAL unique, toggle Général / Ce tour / Aujourd'hui
- Top 3 podium sobre + ta ligne épinglée (sticky)
- Toggle Live 🔴 / Officiel (points figés + provisoires)
- Tap joueur → mini-profil public

### Espace CHAT (le vestiaire)
- Fil global du pool, réactions, réponses
- Messages système taquins auto-postés
- Partage prono/match en un tap

### Espaces transverses (header)
- **Centre d'activité** (cloche) : tacles reçus, résumés perso, rappels, résultats de pronos — source des Web Push
- **Profil + Réglages** (avatar) : profil public, fuseau horaire, préférences notifs par type, avatar/pseudo, barème
- **Mes stats** (onglet du profil) : taux de réussite, fétiche/bête noire
- **Palmarès** (onglet du profil) : badges & trophées, tableau d'honneur des boss

---

## 2. Architecture d'écrans & menu final

```
HEADER (toujours) : [Avatar→Profil]   « Mondial 26 »   [Cloche→Activité •]

BOTTOM NAV (5 onglets)
 1. Accueil   🏠  QG perso (défaut au lancement)
 2. Matchs    📅  poser/modifier pronos → Détail match
 3. Live      🔴  temps réel + points provisoires
 4. Classement 🏆 pool global + toggle Live/Officiel
 5. Chat      💬  vestiaire social

ÉCRANS HORS-ONGLET (push depuis les onglets)
 • Détail match      ← Matchs / Live / Accueil
 • Bonus tournoi     ← Accueil (carte) + Matchs (entrée)
 • Mini-profil public← Classement / Chat
 • Centre d'activité ← cloche header
 • Profil + Réglages ← avatar header
     ├─ Mes stats   (taux réussite, fétiche/bête noire)
     └─ Palmarès    (badges, tableau d'honneur)
```

**Règle d'or** : 5 onglets max, le secondaire (stats, palmarès, bonus, réglages) vit dans le header ou en sous-écran. Le dashboard ne montre que 4-5 blocs pour ne pas surcharger.

---

## 3. Base de données — ajouts consolidés (sans doublon)

### Schéma des nouveautés

```
─── COLONNES SUR L'EXISTANT ────────────────────────────────
matches        + api_fixture_id   bigint unique     -- lien API-Football
               + last_synced_at    timestamptz       -- diagnostic staleness
               + status_long       text              -- statut brut (1H,HT,FT,AET,PEN)
               + home_team_id      uuid → teams(id)  -- fétiche/bête noire, logos *(si absent)*
               + away_team_id      uuid → teams(id)

match_events   + api_event_id      text              -- confort dédoublonnage
               + team_id           uuid → teams(id)  -- ciblage notifs "fans"
               + detail            text              -- Normal Goal, Penalty, Yellow Card…
               + assist_name       text
               + player_out        text              -- remplacements
               + INDEX UNIQUE (match_id,type,minute,coalesce(player_name,''),coalesce(team,''))

profiles       + current_streak    int default 0     -- cache streak (push)
               + best_streak       int default 0

─── TABLES SEED / CONFIG ───────────────────────────────────
stage_multipliers(stage text PK, multiplier int)      -- mapping tour→× (×1..×6)
badges(code text PK, label_fr, description_fr, icon, category, rarity)  -- catalogue

─── TABLES TEMPS RÉEL & SYNC ───────────────────────────────
sync_state(id=1 PK, live_active bool, last_run_at, last_live_count, next_kickoff)
match_lineups(id, match_id→matches, team_id→teams, formation, player_name,
              player_number, position, grid, is_starter, api_player_id,
              UNIQUE(match_id,team_id,player_name))

─── TABLES GAMIFICATION ────────────────────────────────────
daily_awards(id, award_date date, scope text/*day|stage*/, scope_key text,
             user_id→profiles, points int, created_at)
user_badges(user_id→profiles, badge_code→badges, earned_at, context jsonb,
            PK(user_id,badge_code))

─── TABLES NOTIFICATIONS ───────────────────────────────────
notification_prefs(user_id PK→profiles, goals, cards, kickoff, lock_reminder,
                   final_result, only_my_preds, rank_changes)
favorite_teams(user_id→profiles, team_id→teams, PK(user_id,team_id))
notifications_log(id, event_key text unique, created_at)   -- idempotence push

─── FONCTIONS (source unique de vérité barème) ─────────────
compute_points(pred_h,pred_a,real_h,real_a,mult) → int   -- partagée trigger+vue
stage_mult(stage) → int                                   -- ou lit stage_multipliers
trigger_sync_live()        -- garde-fou cron (zéro appel hors match)
notify_on_event()          -- trigger AFTER INSERT match_events → push
push_targets_for_event()   -- RPC ciblage cohortes

─── VUES ───────────────────────────────────────────────────
prediction_points_live   -- points par prono (définitif OU provisoire si live)
leaderboard_live         -- classement avec total figé + provisoire + rank()
(player_stats / player_team_affinity : optionnelles, plus tard si volume)

─── REALTIME ───────────────────────────────────────────────
publication supabase_realtime + replica identity full
  → matches, match_events, (match_lineups optionnel)
```

### Récap décisionnel

| Objet | Indispensable ? | Sert |
|---|---|---|
| `matches.api_fixture_id / last_synced_at / status_long` | **requis** | sync live |
| `matches.home_team_id / away_team_id` | **requis si absent** | fétiche, logos, ciblage |
| `match_events` (+5 cols, index unique) | **requis** | timeline + dédoublonnage |
| `compute_points` + `stage_mult` | **requis** | cohérence provisoire↔définitif |
| `prediction_points_live` + `leaderboard_live` | **requis** | classement live |
| `sync_state`, `match_lineups` | **requis** | sync + écran détail |
| `notification_prefs`, `favorite_teams`, `notifications_log` | **requis** notifs | push ciblé |
| `daily_awards`, `badges`, `user_badges` | requis gamif | boss du jour, palmarès |
| `stage_multipliers` | recommandé | propreté du mapping |
| `profiles.current/best_streak` | optionnel (cache) | streak rapide |

---

## 4. Ordre de construction pragmatique

**Déjà fait (socle) :** auth, import des matchs, saisie pronos + verrouillage RLS au coup d'envoi, calcul auto des points (trigger sur `predictions.points`), classement de base (vue `leaderboard`).

### 🎯 BRIQUE 0 (LA PROCHAINE) — Le match en direct
*Objectif : écran détail match + sync live + classement temps réel. C'est le cœur battant de l'app.*

**0a. Fondations DB (prérequis tout le reste)**
- Colonnes `matches` : `api_fixture_id`, `last_synced_at`, `status_long`, `home_team_id`, `away_team_id` (vérifier si déjà présents)
- Colonnes + index unique `match_events`
- `stage_multipliers` (seed) + fonctions `compute_points` / `stage_mult`
- *Dépend de : existant. Bloque : tout le reste.*

**0b. Sync live (ingestion)**
- Table `sync_state`
- Edge Function `sync-live` (fixtures live → scores, `*_score_reg`, minute, status, events dédoublonnés, résolution `team_id`)
- Crons `pg_cron` + `pg_net` avec garde-fou `trigger_sync_live()` (zéro appel hors fenêtre)
- *Dépend de : 0a. Vérifier : le trigger de points existant se déclenche bien sur `status='finished'` + `*_score_reg`.*

**0c. Classement temps réel (calcul)**
- Vues `prediction_points_live` + `leaderboard_live`
- *Dépend de : 0a (compute_points), 0b (scores live alimentés).*

**0d. Realtime (diffusion)**
- Publication + `replica identity full` sur `matches`, `match_events`
- Abonnements front : canal `live-matches`, canal `match:<id>:events`, re-fetch debounced de `leaderboard_live`
- *Dépend de : 0b, 0c.*

**0e. Écran Détail match + onglet Live (UI)**
- Requête d'hydratation one-shot (match + events + my_pred + all_preds), puis Realtime
- Détail match : en-tête live, ton prono, timeline, mini-classement
- Onglet Live : matchs en cours, prono vs score, points provisoires pulsés
- Toggle Live/Officiel sur le Classement
- *Dépend de : 0c, 0d. Compos (`match_lineups`) ajoutables en sous-étape 0f.*

**0f. Compos (complément détail match)**
- Table `match_lineups` + appel `lineups` (cron pré-match ~40 min avant)
- *Dépend de : 0a. Non bloquant pour le live des scores.*

---

### 🔔 BRIQUE 1 — Notifications Web Push
*Objectif : ramener les gens dans l'app (le moteur d'addiction).*
- Tables `notification_prefs`, `favorite_teams`, `notifications_log`
- RPC `push_targets_for_event` (cohortes : fans d'équipe ∪ pronostiqueurs du match)
- Edge Function `send-push` (VAPID) + trigger `notify_on_event` (buts, rouges)
- Crons dédiés : rappel verrouillage (kickoff −15 min), coup d'envoi, résultat final, changement de rang
- Écran Réglages → préférences par type
- *Dépend de : BRIQUE 0 (events live alimentent les push). `push_subscriptions` existe déjà.*

### 🏆 BRIQUE 2 — Gamification & boss du jour
*Objectif : créer du récit et du chambrage entre matchs.*
- Table `daily_awards` (écrite par l'Edge de scoring quand tous les matchs d'un jour/tour passent `finished`)
- Carte « Boss du jour » sur Accueil + tableau d'honneur
- Streak : `profiles.current_streak / best_streak` (recalcul post-finalisation) + tuile dashboard
- Onglet « Mes stats » : taux de réussite (3 métriques), fétiche/bête noire (dérivé via `home_team_id/away_team_id`)
- *Dépend de : BRIQUE 0 (home/away_team_id, scoring fiable). Synergie BRIQUE 1 (push « Badge débloqué »).*

### 🏅 BRIQUE 3 — Badges & palmarès
*Objectif : récompenses long terme.*
- Tables `badges` (seed catalogue) + `user_badges`
- Règles SQL évaluées par l'Edge de scoring après chaque finalisation
- Onglet « Palmarès » (grille débloqués/grisés) + push « Badge débloqué »
- *Dépend de : BRIQUE 2 (`daily_awards` pour Boss/Roi), BRIQUE 1 (push).*

### 💬 BRIQUE 4 — Chat + messages système
*Objectif : addiction relationnelle.*
- Table `chat_messages` (à concevoir : auteur, contenu, type humain/système, réactions)
- Onglet Chat + Centre d'activité
- Messages système taquins auto-postés (banque de notifications ci-dessus : clown du soir, boss du jour, tacle ciblé, top 3, récap…)
- *Dépend de : BRIQUE 0 + 2 (matière à chambrer : scores, boss, séries).*

---

### Chemin critique résumé
```
SOCLE EXISTANT
   └─► BRIQUE 0  Le match en direct  ◄══ LA PROCHAINE
         0a DB → 0b Sync → 0c Vues live → 0d Realtime → 0e UI → (0f Compos)
            │
            ├─► BRIQUE 1  Web Push        (events → notifs ciblées)
            ├─► BRIQUE 2  Gamif/Boss      (scoring fiable → daily_awards, stats)
            │      └─► BRIQUE 3  Badges/Palmarès
            └─► BRIQUE 4  Chat/Système    (matière à chambrer)
```

**Principe directeur transverse** : une **seule formule de barème** (`compute_points`) partagée entre provisoire (vue) et définitif (trigger), avec le **score réglementaire** (`*_score_reg`) comme référence unique → aucun saut de points quand le live bascule en officiel. Tout le calcul lourd se fait dans l'Edge Function de scoring à la finalisation, jamais au chargement de page.

Fichiers de specs sources (référence) : les 4 specs fournies sont conceptuelles (game design / archi), aucune n'existe encore sur disque dans `C:\Users\Hassa\world-cup-2026` — cette feuille de route les consolide en un plan d'exécution unique.