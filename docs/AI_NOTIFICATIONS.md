# Notifications générées par IA — Mondial 26

## Objectif
Des notifications **jamais répétitives**, drôles, avec du **piquant**, ancrées dans l'**actualité RÉELLE** du match — tout en restant **bon enfant** et dans **nos valeurs** (zéro vulgarité, respect des valeurs musulmanes).

## Principe : données réelles → génération → modération

1. **Source de vérité (l'actu réelle)** = **API-Football** (buts, buteurs, minutes, cartons, retournements) + nos données (classement, séries, qui est dernier, taux de réussite). Matière fiable, sûre et inépuisable.
2. **Générateur = Claude.** On lui passe : le *type* de notif (son objectif), les *faits réels* (variables), des *consignes de ton* (street, piquant, bon enfant, valeurs), ET la *liste des dernières formulations déjà utilisées* → pour éviter toute répétition (effet surprise garanti).
   - **Haiku 4.5** : notifs en masse (rapide, peu cher).
   - **Sonnet 4.6** : résumés de journée plus travaillés.
3. **Enrichissement optionnel = Grok** (le « piquant d'actu »). Son seul vrai atout : accès temps réel à X/Twitter (buzz, memes). On l'utilise comme **matière brute** que Claude **réécrit et nettoie**. Grok ne parle jamais directement à l'utilisateur → contrôle total du ton et des valeurs. À activer en Phase 2 si on veut plus de piquant.
4. **Modération = passe finale** (Claude avec règles strictes + liste noire de mots). Valide / rejette / régénère. Rien ne part sans passer la modération.

## Anti-répétition (l'effet surprise)
- On stocke les N dernières notifs (ou « angles » de blague) par type / joueur.
- On les passe au générateur avec « n'utilise aucune de ces formulations ».
- On varie l'angle (registres différents) + température élevée.
- La **banque statique** (`docs/NOTIFICATIONS.md`) = filet de secours (si l'IA échoue / hors-ligne) + exemples de ton (few-shot).

## Grok vs Claude — recommandation
- **Claude = générateur + modérateur** : imbattable pour tenir le ton ET les valeurs.
- **Grok = source d'actu/buzz optionnelle**, jamais en direct vers l'utilisateur.
- On démarre **sans Grok** (les faits du match suffisent à varier énormément), on l'ajoute si on veut.

## Pipeline technique (Brique 1)
- Edge Function `generate-notif` : reçoit `(type, faits)` → appelle l'API Anthropic → modération → renvoie le texte → `send-push`.
- Déclenchée par les events (trigger sur `match_events`) ou les crons (rappels, résumés, top 3).
- Secrets Supabase : `ANTHROPIC_API_KEY` (+ optionnel `XAI_API_KEY` pour Grok).
- Garde-fous valeurs : règles strictes dans le prompt + liste noire + passe de modération + fallback banque statique.

> Note : au moment d'implémenter, se référer à la doc API Claude (modèles, pricing, tool use) avant d'écrire le code d'appel.
