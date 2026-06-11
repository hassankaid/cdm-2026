# UX et navigation - Mondial 26

# Architecture de navigation — Mondial 26

## 1. Principe directeur

Mobile-first, le pouce reste en bas. **5 onglets max** dans la bottom nav (au-delà, ça devient illisible). Tout ce qui est secondaire (réglages, bonus, activité) vit dans le header ou en push depuis les écrans principaux. Une règle d'or : **chaque écran fait UNE chose et la fait à fond.**

---

## 2. Bottom nav — les 5 onglets

| # | Onglet | Icône | Rôle en une phrase |
|---|--------|-------|--------------------|
| 1 | **Accueil** | maison (`home`) | Le QG perso : ton prochain prono à poser, ton rang, le buzz du jour. |
| 2 | **Matchs** | calendrier/ballon (`calendar`) | Tous les matchs, là où on pose et modifie ses pronos. |
| 3 | **Live** | point pulsé rouge (`radio`/`activity`) | Le cœur battant : matchs en cours, score live, tes points qui montent en direct. |
| 4 | **Classement** | trophée (`trophy`) | Le pool global, du premier au dernier. |
| 5 | **Chat** | bulle (`message-circle`) | Le vestiaire : on chambre, on commente, on charrie. |

**Header global (toujours visible)** : à gauche l'avatar (→ Profil), au centre le logo « Mondial 26 », à droite la **cloche d'activité** avec pastille de compteur (→ Centre d'activité). Ces deux accès ne mangent pas un onglet précieux.

---

## 3. Détail des écrans

### Onglet 1 — Accueil (QG perso)
- **Rôle** : point d'entrée qui pousse à l'action immédiate.
- **Contenu** :
  - Carte « À chaud » : le **prochain match à pronostiquer** avec compte à rebours avant verrouillage (« Plus que 2 h pour caler ton prono, ça presse ! »). CTA direct → ouvre le sélecteur de score.
  - Bandeau **Live** si un match tourne (mini-score cliquable → Live).
  - **Ton rang** du moment (carte compacte : place, points, flèche montée/descente).
  - **Le buzz** : 2-3 dernières activités du pool (tacles, gros scores) → tease vers Chat/Activité.
  - Rappel **bonus tournoi** si une fenêtre est ouverte (vainqueur, meilleur buteur…).
- **Accès** : onglet 1, écran par défaut au lancement.

### Onglet 2 — Matchs
- **Rôle** : poser, voir, modifier ses pronos. La salle des machines.
- **Contenu** :
  - Filtres en haut : **À pronostiquer** (par défaut) / Tous / Par tour (Groupes, 16e… Finale) / Par jour.
  - Liste de cartes match : drapeaux + noms FR, date/heure **au fuseau du joueur**, statut (à venir / verrouillé / terminé).
  - Sur chaque carte non verrouillée : **stepper de score** inline (deux compteurs +/−) pour poser vite, sans changer d'écran.
  - Badge points gagnés sur les matchs terminés.
  - Pastille discrète « ×2 / ×6 » indiquant le **multiplicateur de tour**.
- **Accès** : onglet 2. Tap sur une carte → **Détail match**.

### Écran — Détail match (non-onglet, ouvert depuis Matchs/Live/Accueil)
- **Rôle** : tout savoir sur UN match.
- **Contenu** :
  - En-tête équipes, kickoff au fuseau local, tour + multiplicateur.
  - **Ton prono** (modifiable tant que non verrouillé, sinon figé avec cadenas).
  - Avant le match : **ce qu'ont pronostiqué les autres** (révélé seulement après verrouillage, pour pas copier).
  - Pendant/après : timeline des **événements** (buts, cartons, minutes) via `match_events`, compos.
  - Mini-classement « qui a cartonné sur ce match ».
- **Accès** : tap sur n'importe quelle carte match.

### Onglet 3 — Live
- **Rôle** : l'immersion temps réel, le frisson.
- **Contenu** :
  - Liste des matchs **en cours** (score, minute pulsée via Realtime).
  - Pour chaque match live : **ton prono vs score actuel**, et tes **points provisoires** qui clignotent quand ça bouge.
  - Fil d'événements live (« BUUUT à la 67' ! Ton prono tient bon 👀 »).
  - Si aucun match en cours : prochain coup d'envoi + compte à rebours, et « rejoue les temps forts » du dernier match.
- **Accès** : onglet 3. Tap match → Détail match (vue live).

### Onglet 4 — Classement
- **Rôle** : le nerf de la guerre, le pool global unique.
- **Contenu** :
  - Liste classée (vue `leaderboard`) : rang, avatar, pseudo, points, évolution (▲▼).
  - **Ta ligne épinglée** (sticky) même si t'es 47e, toujours visible.
  - Toggle de période : **Général / Ce tour / Aujourd'hui**.
  - Top 3 mis en avant (podium sobre, pas de surenchère).
  - Tap sur un joueur → **mini-profil public** (pseudo, rang, palmarès de pronos, sans données privées).
- **Accès** : onglet 4.

### Onglet 5 — Chat (le vestiaire)
- **Rôle** : la vie sociale, l'addiction relationnelle.
- **Contenu** :
  - Fil de discussion global du pool.
  - Messages système taquins auto-postés (« Karim a mis 5-0 pour le Maroc, il y croit dur comme fer 🔥 »).
  - Réactions rapides (emojis), réponses.
  - Partage d'un prono ou d'un match en un tap.
- **Accès** : onglet 5. Pastille non-lus sur l'icône.

### Écran — Centre d'activité (accès cloche header)
- **Rôle** : tout ce qui te concerne, regroupé. À distinguer du Chat (collectif).
- **Contenu** :
  - **Tacles reçus** (quelqu'un t'a charrié), mentions.
  - **Résumés** : « Ton bilan de la journée : +7 pts, tu grimpes de 3 places. »
  - Rappels de pronos non posés / fenêtres bonus qui ferment.
  - Résultats de tes pronos quand un match se termine.
  - Filtre : Tout / Me concerne / Système.
- **Accès** : cloche en haut à droite (pastille compteur). Source des notifs **Web Push**.

### Écran — Profil + Réglages (accès avatar header)
- **Rôle** : identité et contrôle.
- **Contenu** :
  - **Profil public** : avatar, pseudo (`display_name`), rang, stats (pronos exacts, série en cours, meilleur coup).
  - **Réglages** (sous-section) :
    - **Fuseau horaire** (`timezone`) — pour l'affichage de tous les kickoffs.
    - **Préférences de notifs** Web Push : coup d'envoi, but dans un match suivi, résultat de prono, tacles, résumé quotidien, bonus — chacun activable/désactivable.
    - Avatar (`avatar_url`), pseudo.
    - À propos / barème des points (rappel pédagogique) / déconnexion.
- **Accès** : avatar en haut à gauche.

### Écran — Bonus tournoi (accès Accueil + Matchs)
- **Rôle** : les paris longue durée (vainqueur, meilleur buteur, surprise…).
- **Contenu** :
  - Liste des bonus dispo (`tournament_bonuses`) avec date de fermeture et points en jeu.
  - Sélecteur dédié par bonus (équipe/joueur), stockage `bonus_predictions`.
  - État : ouvert / verrouillé / résolu (avec points obtenus).
- **Accès** : carte dédiée sur **Accueil** quand une fenêtre est ouverte, + entrée permanente via filtre/onglet secondaire dans **Matchs**. Pas d'onglet bottom dédié (secondaire).

---

## 4. Parcours clés

**A. Poser un prono (le geste central, < 10 s)**
`Accueil` → carte « À chaud » → stepper de score → valider → micro-confirmation (« C'est calé ! 👊 »).
*Variante* : `Matchs` → filtre « À pronostiquer » → stepper inline sur la carte → auto-save. Verrouillage auto au coup d'envoi (RLS), carte grisée + cadenas.

**B. Suivre un match live (l'immersion)**
Push « Coup d'envoi ! » → tap → `Live` → carte du match → ton prono vs score, points provisoires qui pulsent → tap → `Détail match` timeline d'événements Realtime. À la fin : push « +5 pts, score exact, énorme ! ».

**C. Consulter le classement (la comparaison)**
`Classement` → ta ligne sticky d'abord → toggle « Aujourd'hui » pour voir le mouvement du jour → tap sur le 1er → mini-profil public pour jauger le rival.

**D. Lire le chat / les notifs (le social)**
Pastille sur `Chat` → fil du vestiaire → réagir/répondre. *En parallèle* : cloche header → `Centre d'activité` → « Tu t'es fait tacler par Yacine » → tap → contexte (match/prono concerné) → riposte dans le Chat.

---

## 5. Arbre d'arborescence

```
Mondial 26 (PWA)
│
├── [HEADER global]
│   ├── Avatar (gauche) ─────────► Profil + Réglages
│   │                                ├── Profil public (pseudo, rang, stats)
│   │                                └── Réglages
│   │                                     ├── Fuseau horaire (timezone)
│   │                                     ├── Préférences notifs (Web Push, par type)
│   │                                     ├── Avatar / Pseudo
│   │                                     └── Barème / À propos / Déconnexion
│   ├── Logo « Mondial 26 » (centre)
│   └── Cloche activité + pastille (droite) ─► Centre d'activité
│                                                ├── Tacles reçus / mentions
│                                                ├── Résumés quotidiens
│                                                ├── Rappels pronos / bonus
│                                                ├── Résultats de pronos
│                                                └── Filtre : Tout / Me concerne / Système
│
└── [BOTTOM NAV]
    │
    ├── 1. Accueil (QG perso) ◄── écran par défaut
    │     ├── Carte « À chaud » (prochain prono + countdown) ─► sélecteur de score
    │     ├── Bandeau Live (si match en cours) ──────────────► Live
    │     ├── Ton rang du moment ───────────────────────────► Classement
    │     ├── Le buzz (3 dernières activités) ───────────────► Chat / Activité
    │     └── Rappel Bonus (si fenêtre ouverte) ─────────────► Bonus tournoi
    │
    ├── 2. Matchs
    │     ├── Filtres : À pronostiquer / Tous / Par tour / Par jour
    │     ├── Entrée Bonus tournoi ──────────────────────────► Bonus tournoi
    │     │                                                      ├── Liste bonus (points en jeu, fermeture)
    │     │                                                      ├── Sélecteur par bonus
    │     │                                                      └── État : ouvert/verrouillé/résolu
    │     └── Carte match (stepper inline) ──────────────────► Détail match
    │           ├── En-tête équipes + tour + multiplicateur
    │           ├── Ton prono (modifiable / cadenassé)
    │           ├── Pronos des autres (après verrouillage)
    │           ├── Timeline événements (buts, cartons, compos)
    │           └── Mini-classement du match
    │
    ├── 3. Live
    │     ├── Matchs en cours (score + minute pulsée Realtime)
    │     ├── Ton prono vs score + points provisoires
    │     ├── Fil d'événements live
    │     └── (vide) prochain coup d'envoi + countdown ──────► Détail match
    │
    ├── 4. Classement (pool GLOBAL unique)
    │     ├── Toggle : Général / Ce tour / Aujourd'hui
    │     ├── Top 3 (podium sobre)
    │     ├── Liste classée (vue leaderboard)
    │     ├── Ta ligne épinglée (sticky)
    │     └── Tap joueur ────────────────────────────────────► Mini-profil public
    │
    └── 5. Chat (le vestiaire)
          ├── Fil global du pool
          ├── Messages système taquins (auto)
          ├── Réactions / réponses
          └── Partage prono / match
```

---

## 6. Notes de conception (pour rester addictif et clair)

- **Le prono en < 10 s** : le stepper inline partout évite les changements d'écran. C'est le geste roi, il doit être sans friction.
- **Live = dopamine** : points provisoires qui pulsent, micro-animations sur chaque but. C'est l'onglet qui fait revenir pendant les matchs.
- **Chat vs Activité bien séparés** : le Chat est collectif (le vestiaire), l'Activité est perso (ce qui *te* concerne). Ne pas mélanger, sinon on noie l'info.
- **Sticky « ta ligne »** au classement : même dernier, le joueur se voit et veut remonter. Anti-décrochage.
- **Verrouillage visible** : cadenas clair au coup d'envoi, jamais de prono « perdu » par surprise. La confiance avant le fun.
- **Ton complice partout** : les micro-copies (« ça presse ! », « C'est calé ! 👊 », « il y croit dur comme fer 🔥 ») portent l'ADN street bon enfant, sans jamais de vulgarité ni d'humiliation.