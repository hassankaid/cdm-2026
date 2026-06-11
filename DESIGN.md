# ⚽ Pronos Coupe du Monde 2026 — Design

Application de pronostics entre amis pour la Coupe du Monde 2026 (USA/Canada/Mexique,
11 juin → 19 juillet 2026, 48 équipes, 104 matchs).

## 🎯 Objectif
Chaque ami a un compte, pronostique le score des matchs (verrouillage au coup d'envoi),
suit les matchs en direct (buts, buteurs, cartons, notifications), et grimpe au classement.
Expérience **immersive, gamifiée, addictive**.

## 🧱 Stack technique
- **Frontend** : Next.js 16 (App Router) + TypeScript + Tailwind v4 — PWA installable (web + mobile)
- **Backend** : Supabase — Auth (email + mot de passe), Postgres, Realtime, Edge Functions
- **Données foot** : API-Football (api-sports.io) — scores, buteurs, cartons, minute, en direct
- **Notifications** : Web Push (PWA)
- **Hébergement** : Vercel

## 🧮 Système de points

### Par match (score à la fin du temps réglementaire, 90 min)
| Condition | Points (base) |
|---|---|
| Bonne issue (1 / N / 2) | **1** |
| Bonne issue + bonne différence de buts | **2** |
| Score exact | **3** |

Règles : « bonne différence de buts » inclut toujours la bonne issue. Le score exact
inclut la bonne différence. On garde le **meilleur palier atteint** (pas de cumul).

### Multiplicateur par tour
| Tour | Groupes | 16es | 8es | Quarts | Demies | Finale / 3e place |
|---|---|---|---|---|---|---|
| ×  | 1 | 2 | 3 | 4 | 5 | 6 |

Points du match = points de base × multiplicateur du tour.
→ L'enjeu monte, le classement reste ouvert jusqu'à la fin.

> Phases finales : le prono porte sur le score **à 90 min**. Prolongation et tirs au but
> ne comptent pas dans le score pronostiqué (mais servent à calculer le qualifié réel).

### Bonus « tournoi » (verrouillés avant le 1er match, résolus à la fin)
Vainqueur, Finaliste, Meilleur buteur, Meilleur joueur, Meilleur gardien. Barème à régler
(ex. Vainqueur 20, Finaliste 10, Meilleur buteur 15, Meilleur joueur 10, Meilleur gardien 10).

## ⏱️ Règles de pronostic (verrouillage)
- Tous les matchs sont visibles ; on saisit/modifie son prono **jusqu'au coup d'envoi**.
- **Verrouillage côté serveur** (politique RLS) : tout prono est refusé si `now() ≥ kickoff`.
  Impossible à contourner depuis le client.
- Matchs à élimination directe : le prono **s'ouvre quand les 2 équipes sont connues**.
- Les pronos des autres deviennent visibles **après le coup d'envoi** (anti-copie).
- Notification quotidienne le matin (matchs du jour) + rappel avant un match sans prono.

## 📺 Match en direct
- Écran live : minute + score, timeline (⚽ buts/buteurs, 🟨🟥 cartons, changements).
- Animation + son court au but. Notifications push : coup d'envoi, but, mi-temps, fin.
- Une Edge Function interroge API-Football (~15–20 s) pendant les matchs live et écrit les
  événements ; Supabase Realtime les pousse à tous les écrans instantanément.

## 🏆 Moteur de classement & phase finale (brique délicate)
- 12 groupes de 4 → 1ers + 2es + **8 meilleurs 3es** = 32 en 16es de finale.
- Classement de groupe : points → diff. de buts → buts marqués → (départages FIFA).
- Sélection des 8 meilleurs 3es puis attribution dans le tableau selon la **table
  officielle FIFA** (le placement des 3es dépend des groupes d'où ils viennent).
- Implémenté comme une fonction Postgres / Edge Function recalculée à chaque résultat.

## 🗺️ Feuille de route
- **Phase 0** — Setup : env, squelette, schéma BDD ✅ (en cours)
- **Phase 1** — MVP : auth, liste des matchs, saisie prono + verrou, classement (scores saisis à la main au début)
- **Phase 2** — Scores automatiques : intégration API-Football, calcul auto des points
- **Phase 3** — Temps réel + notifications : live, buteurs, push
- **Phase 4** — Immersion & fun : design WC26 (drapeaux, stades, anims), mini-ligues, partage
- **Phase 5** — Fiabilisation : fuseaux horaires, perfs, PWA offline, anti-triche

## 🗃️ Modèle de données (résumé)
Voir `supabase/migrations/0001_initial_schema.sql`.
- `profiles` — joueurs (lié à auth.users)
- `teams` — 48 équipes (code FIFA, drapeau, groupe)
- `matches` — 104 matchs (tour, groupe, équipes, coup d'envoi, statut, scores)
- `predictions` — pronos (unique par joueur/match, points calculés)
- `match_events` — événements live (buts, cartons…)
- `tournament_bonuses` / `bonus_predictions` — bonus tournoi
- `push_subscriptions` — abonnements notifications push
