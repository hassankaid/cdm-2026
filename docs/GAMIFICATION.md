# Gamification et stats - Mondial 26

Voici la conception complète. Aucune exploration de code nécessaire : c'est du game design pur, basé sur ton schéma existant.

---

# Mondial 26 — Gamification & Stats perso

## Conventions communes (rappel barème)
- **Points d'un prono** (déjà en base `predictions.points`) : `(issue=1 | diff=2 | exact=3) × multiplicateur de tour`. On ne recalcule jamais à la main dans le front : on lit `predictions.points`.
- **Tour → multiplicateur** : on déduit de `matches.stage` (groupes ×1, 8es ×2, quarts ×3, demies ×4, 3e place ×5, finale ×6). On stocke ce mapping dans une petite table `stage_multipliers(stage text PK, multiplier int)` pour éviter le "magic number" partout.
- Tout est calculable à partir de l'existant. Les colonnes "stockées" proposées sont des **optimisations/caches**, jamais des prérequis.

---

## 1. Dashboard perso — « Mon QG »

**Définition.** Page d'accueil après login. Vue d'ensemble en un coup d'œil : où j'en suis, ce que je dois faire maintenant.

**Calcul (données existantes).**
- *Mes points* : `SELECT total_points FROM leaderboard WHERE id = auth.uid()` (la vue existe déjà).
- *Mon rang* : `rank()` sur la vue `leaderboard` ordonnée par `total_points DESC` → on lit la ligne de l'utilisateur.
- *Mes pronos validés / en attente* : count sur `predictions` joint à `matches` (`kickoff < now()` = joué, sinon à venir).
- *Prochains matchs à pronostiquer* : `matches WHERE kickoff > now() AND status='scheduled'` LEFT JOIN `predictions` (de l'user) → ceux **sans** prono, triés par `kickoff ASC`, limités à 3-5. Affichage du kickoff converti au `profiles.timezone`.

**Ce qu'on affiche.**
- En-tête : avatar + `display_name` + pastille de rang (« #4 / 23 »).
- 3 grosses tuiles : **Points**, **Rang**, **Série en cours** (cf. §3).
- Bandeau « À pronostiquer » : cartes des prochains matchs sans prono, avec compte à rebours et bouton « Mets ton prono ». Si tout est rempli : message complice (« Tout est calé, t'es un pro 🧠 »).
- Mini-rappel du dernier match joué + points gagnés (« +6 sur la finale, t'as géré »).

**Nouvelles tables/colonnes.** Aucune. Tout dérive de `leaderboard`, `predictions`, `matches`, `profiles`.

---

## 2. Taux de réussite — « Mes stats de tireur »

**Définition.** Indicateurs de régularité, calculés sur les matchs **terminés** uniquement (`matches.status='finished'`) où l'user a un prono.

**3 métriques retenues (simples à lire).**

| Métrique | Calcul | Lisibilité |
|---|---|---|
| **% Bon résultat** | `nb pronos avec points > 0` / `nb pronos joués` | « Tu vises juste 6 fois sur 10 » |
| **% Score exact** | `nb pronos exacts` / `nb pronos joués`. Exact = `pred_home=home_score_reg AND pred_away=away_score_reg` | la métrique « sniper » |
| **Moyenne points / match** | `SUM(points)` / `nb pronos joués` | compare l'efficacité indépendamment du nombre de matchs |

> On compare sur le **temps réglementaire** (`home_score_reg`/`away_score_reg`), cohérent avec la règle. `home_score` final sert seulement à l'affichage du vrai score.

**Ce qu'on affiche.** 3 jauges circulaires (2 en %, 1 en pts/match), avec une ligne de comparaison « moyenne du pool » (calculable sur la vue : moyenne de tous les joueurs). Petit tag identitaire dérivé : ≥25% exact → « Sniper 🎯 », bon résultat élevé mais peu d'exacts → « Le régulier », sinon « Le parieur du cœur ❤️ ».

**Nouvelles tables/colonnes.** Aucune en base. Pour la perf à l'échelle d'un pool d'amis (faible volume), calcul à la volée. Si besoin plus tard : vue `player_stats` agrégée.

---

## 3. Série en cours (streak) + record perso — « La hess inversée, la chauffe »

**Définition.**
- **Série en cours** : nombre de pronos consécutifs avec `points > 0` (bon résultat), en partant du dernier match terminé et en remontant **dans l'ordre des `kickoff`**. Un prono à 0 pt casse la série. Un match sans prono **casse aussi** (sinon on récompense l'absence).
- **Record perso** : plus longue série jamais réalisée sur le tournoi.

**Calcul.** Window function sur `predictions ⨝ matches` (finished) ordonnés par `kickoff` :
- Streak courant = compter depuis la fin tant que `points > 0`.
- Record = plus longue suite de `points > 0` consécutifs (gaps-and-islands classique en SQL).

**Ce qu'on affiche.** Compteur « 🔥 ×4 » sur le dashboard, animation quand ça monte. Sous-titre record (« record perso : 6 »). Quand un match live est en cours et que ton prono est **provisoirement bon**, on affiche la série « +1 en attente » en pointillé (s'aligne sur le live du §5).

**Nouvelles colonnes (cache, optionnel).** Sur `profiles` : `current_streak int default 0`, `best_streak int default 0`. Recalculés par l'Edge Function de scoring après chaque match finalisé. Permet d'éviter de rescanner tout l'historique à chaque chargement et de déclencher des push (« Série de 5 ! »).

---

## 4. Meilleur du jour / de la journée — « L'homme du match »

**Définition.** Deux échelles :
- **Meilleur du jour** : joueur ayant gagné le plus de points sur les matchs terminés d'une **date calendaire** (fuseau de référence du tournoi, ex. Europe/Paris pour le groupe).
- **Meilleur de la journée / du tour** : même chose agrégé par `stage` (phase de groupes J1, J2… ou un tour entier).

**Calcul.** `SUM(predictions.points)` groupé par `user` filtré sur les matchs dont `kickoff::date = :jour` (ou `stage = :tour`), `ORDER BY sum DESC LIMIT 1` (+ podium top 3). Égalité départagée par % exact du jour.

**Ce qu'on affiche.** Carte « 👑 Boss du jour : Karim — +9 pts » sur le dashboard et en tête du classement, avec podium repliable (top 3). Historique « Tableau d'honneur » : la liste des boss de chaque jour → crée du récit et du chambrage bon enfant.

**Nouvelles tables (cache + historique).** `daily_awards(id, award_date date, scope text /* 'day' | stage */, scope_key text, user_id, points int, created_at)`. Écrite par l'Edge Function quand tous les matchs d'un jour/tour passent `finished`. Sert l'historique du tableau d'honneur et les badges (§7) sans recalcul.

---

## 5. Classement EN TEMPS RÉEL avec points provisoires — « Le live qui pique »

**Concept.** Pendant qu'un match se joue, on calcule des **points provisoires** comme si le score actuel (temps réglementaire en cours) était le score final, et on les ajoute au total figé. Le classement bouge en direct → tension maximale, les gens restent sur l'app pendant le match.

**Calcul.**
- **Points figés** = `total_points` de la vue `leaderboard` (uniquement matchs `finished`, jamais modifiés par le live).
- **Points provisoires d'un match live** : pour chaque prono d'un match `status IN ('live','1H','HT','2H')`, appliquer le barème sur `(matches.home_score, matches.away_score)` **courants** × multiplicateur du tour. Exactement la même fonction de scoring que le définitif, nourrie par le score live d'API-Football.
- **Total live affiché** = `points figés + Σ points provisoires des matchs en cours`.
- Classement live = re-tri sur ce total live.

**Exemple.** Match 1-0 à la 24'. Ton prono 1-0 → bonne issue + bonne diff + score exact = 3 pts × ×1 (groupes) = **+3 provisoires** comptés tout de suite. Si ça passe 2-0, ton prono devient « bonne issue seule » → provisoire retombe à **+1**, ton rang live redescend en direct.

**Affichage.**
- Toggle en haut du classement : **« Live 🔴 »** vs « Officiel ». En live, les lignes affichent `total figé` + `(+X)` en couleur, flèches ↑/↓ de mouvement de rang, score du match en cours.
- Sur le dashboard : carte « Ton prono en ce moment : 1-0 ✅ +3 provisoires » qui se met à jour.
- **Mention claire « provisoire / non définitif »** pour éviter la frustration quand ça bouge.

**Technique.** Pas de stockage : c'est **dérivé et éphémère**. L'Edge Function de polling API-Football met à jour `matches.minute/home_score/away_score/status`; Supabase **Realtime** pousse ces changements; le client recalcule le total live côté front (ou via une **vue `leaderboard_live`** qui fait le calcul en SQL et que le client interroge à chaque tick). Les `predictions.points` ne sont écrits **qu'à la finalisation** du match (`status='finished'`, sur le réglementaire), jamais pendant le live.

> Garde-fou : si un match part en prolongation/tab (KO), le live continue d'afficher le **réglementaire** (`home_score_reg/away_score_reg` une fois figés), conformément à la règle des 90 min.

---

## 6. Équipe fétiche & bête noire — « Ton équipe doudou & ta malédiction »

**Définition.**
- **Équipe fétiche** : l'équipe (parmi celles que tu as pronostiquées) sur laquelle tu as la **meilleure moyenne de points par match**.
- **Bête noire** : celle où ta moyenne est la **plus faible** (là où tu te plantes).

**Calcul.** Un prono concerne **deux équipes** (home + away du match). On « explose » chaque prono joué en 2 lignes (une par équipe via `matches.home_team`/`away_team`), puis `AVG(points) GROUP BY team`. Seuil mini de **3 matchs** par équipe pour éviter qu'une seule rencontre désigne une fétiche. Départage : total de points, puis % exact.

> Pré-requis schéma : il faut un lien match→équipes. Si `matches` n'a pas déjà `home_team_id`/`away_team_id` vers `teams`, c'est la **seule** dépendance à ajouter (très probablement déjà là vu `teams` + `group_letter`). Affichage via `teams.name_fr` + `teams.logo_url`.

**Ce qu'on affiche.** Deux cartes côte à côte : « 💚 Fétiche : Maroc — 2,4 pts/match » / « 😤 Bête noire : Brésil — 0,3 pts/match », avec logos. Ton complice : « Le Maroc te porte, lâche plus jamais ce prono » / « Le Brésil, votre histoire c'est compliqué 😅 ».

**Nouvelles tables/colonnes.** Aucune (dérivé). Cache possible plus tard dans une vue `player_team_affinity`.

---

## 7. Badges & trophées — « Le palmarès »

**Définition.** Récompenses débloquables, mélange skill + assiduité + fun. Affichées en grille (débloqués en couleur, verrouillés en grisé avec la condition).

**Liste concrète (toutes calculables sur l'existant).**

*Skill / précision*
- **Sniper** — 1er score exact. / **Triple Sniper** — 3 exacts d'affilée.
- **Boule de cristal** — exact sur un match à élimination directe (×2+).
- **Le Visionnaire** — exact sur la **finale**.
- **Sans faute du jour** — 100% de bons résultats sur une journée (≥3 matchs).

*Régularité / streak*
- **En chauffe** — série de 3. / **Brûlant 🔥** — série de 5. / **Incandescent** — série de 8.
- **Métronome** — pronos posés sur 100% des matchs d'un tour.
- **Lève-tôt** — prono déposé > 24h avant le coup d'envoi (sur `predictions.created_at` vs `kickoff`).

*Compétition / classement*
- **Boss du jour** — finir meilleur du jour (depuis `daily_awards`). / **Roi de la semaine**.
- **Sur le podium** — entrer dans le top 3 global. / **Le Patron** — finir #1 à la fin d'un tour.
- **La Remontada** — gagner 5+ places au classement en une journée.
- **Champion du Mondial** — #1 au classement final. (trophée ultime)

*Fun / assiduité (bon enfant)*
- **Premier au stade** — tout premier prono du tournoi posé.
- **Fidèle au poste** — connecté/pronostiqué chaque jour de la phase de groupes.
- **Cœur sur l'équipe** — pronostiqué la même équipe gagnante 4 fois (fétiche assumée).
- **Le Courageux** — avoir tenté un score à 3+ buts d'écart… et l'avoir eu exact.
- **L'Outsider** — exact sur une victoire où peu de joueurs du pool avaient vu juste.

**Calcul.** Chaque badge = une règle SQL sur `predictions`/`matches`/`daily_awards`/`leaderboard`. Évaluées par l'Edge Function de scoring **après chaque finalisation de match** (et pour les badges live/streak, après chaque mise à jour pertinente).

**Nouvelles tables.**
- `badges(code text PK, label_fr text, description_fr text, icon text, category text, rarity text)` — catalogue statique (seed).
- `user_badges(user_id, badge_code, earned_at, context jsonb /* ex: {match_id, day} */, PRIMARY KEY(user_id, badge_code))` — débloqués.
- Déblocage → notification **Web Push** (« 🏅 Badge débloqué : Brûlant ! ») pour le côté addictif.

---

## Récap des ajouts en base (tout le reste est dérivé)

| Objet | Type | Pourquoi | Indispensable ? |
|---|---|---|---|
| `stage_multipliers` | table seed | mapping tour→×, propre | recommandé |
| `matches.home_team_id` / `away_team_id` | colonnes FK→`teams` | fétiche/bête noire, logos | requis **si absent** |
| `profiles.current_streak` / `best_streak` | colonnes cache | streak rapide + push | optionnel (cache) |
| `daily_awards` | table | boss du jour + historique + badges | recommandé |
| `badges` / `user_badges` | tables | palmarès | requis pour §7 |
| vue `leaderboard_live` | vue | classement live SQL | recommandé pour §5 |

**Principe directeur UX** : le dashboard ne montre que 4-5 blocs (Points/Rang/Série, À pronostiquer, Boss du jour, Live si match en cours). Le reste (stats détaillées, fétiche, palmarès) vit dans des onglets « Mes stats » et « Palmarès » pour ne pas surcharger. Tout le calcul lourd se fait dans l'**Edge Function de scoring** au moment de la finalisation, pas au chargement de page.