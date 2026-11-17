# Voc — notes pour Claude

App PWA (HTML/CSS/JS vanilla, pas de build) pour qu'une lycéenne (gymnase suisse, 18 ans) apprenne son vocabulaire d'anglais et d'italien sur iPhone. Tout est en français.

## Fichiers

- `data/vocab.js` : tout le vocabulaire (`window.VOC_DATA`). **C'est le fichier qu'on modifie le plus souvent.**
- `engine.js` : fonctions pures. Correction des réponses (`checkAnswer`) et répétition espacée (`applyResult`, `pickDaily`…). Testé par `tests/engine.test.js` (`node --test tests/engine.test.js`).
- `app.js` : interface (rendu par `innerHTML` + délégation d'événements via `data-action`).
- `sw.js` : cache hors ligne (stale-while-revalidate). Incrémenter `CACHE_NAME` si on ajoute un fichier à `ASSETS`.

## Transcrire des photos de pages de vocabulaire

Quand l'utilisateur envoie des photos du livre :

1. Le **titre du thème** est en haut de la page → `title`.
2. Une entrée par ligne : `[français, traduction]` ou `[français, traduction, note]`.
3. Recopier **exactement** comme dans le livre : articles compris (`the house`, `la città`, `to go`), accents, orthographe britannique si le livre l'utilise.
4. Plusieurs traductions à connaître → tableau : `["the sofa", "the couch"]`. Elles seront toutes demandées (ordre libre). Pareil côté français si le livre en donne plusieurs.
5. Une partie optionnelle du livre → entre parenthèses : `"to tidy (up)"`.
6. Infos utiles (pluriel irrégulier, genre, faux ami) → 3e élément `note`.
7. Ajouter le thème dans `en.themes` ou `it.themes` ; supprimer les thèmes « Exemple »/« Esempio » quand le vrai vocabulaire arrive.
8. En cas de doute sur un mot illisible, demander plutôt que deviner, et lister les doutes à la fin.

L'identifiant d'un mot (et donc ses progrès) dépend du français et de la première traduction. Corriger une faute dans ces champs remet ce mot à zéro, ce qui est acceptable.
