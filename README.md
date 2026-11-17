# 📚 Voc

Petite application web (PWA) pour apprendre son vocabulaire d'**anglais** et d'**italien** sur son téléphone.

L'app est personnelle : elle retient où ça coince. Un mot raté, mal orthographié ou trouvé trop lentement revient plus souvent, jusqu'à ce qu'il soit vraiment acquis.

## Fonctionnalités

- **Deux langues** : 🇬🇧 anglais et 🇮🇹 italien, vocabulaire organisé par thèmes (comme dans le livre)
- **Trois modes**
  - **▶ Entraînement du jour** : les mots à revoir aujourd'hui (les plus difficiles d'abord), puis des nouveaux
  - **🎯 Mots difficiles** : uniquement les mots où ça coince
  - **🔥 Révision intensive** : tous les mots des thèmes choisis, jusqu'à les savoir (idéal avant un test)
- **Quatre façons de jouer** : Mix, Cartes recto-verso, QCM, Écrit
- **Sens au choix** : FR → langue (par défaut), langue → FR, ou les deux
- **Correction précise à l'écrit**
  - accent oublié : compté juste, avec un rappel (« N'oublie pas l'accent : città »)
  - faute d'orthographe : « presque », le mot revient vite
  - article manquant ou faux : compté faux (« Il manque l'article : the house »)
  - plusieurs traductions : il faut toutes les donner, dans n'importe quel ordre, séparées par des virgules
  - réponse juste mais lente : le mot revient un peu plus tôt
- **Progrès** : mots nouveaux / en cours / maîtrisés, liste des mots qui coincent, sauvegarde exportable

Toutes les données restent sur le téléphone (`localStorage`). Rien n'est envoyé à un serveur.

## Comment ça marche (répétition espacée)

Chaque mot est dans une « boîte » de 0 à 7. Une bonne réponse le fait monter d'une boîte (au maximum une par jour), et il revient plus tard : 1, 2, 4, 8, 16, 35 puis 70 jours. Une erreur le renvoie à la boîte 0 et il revient dans la même session. Un mot est considéré comme **maîtrisé** à partir de la boîte 4.

Le QCM seul ne peut pas faire dépasser la boîte 2 : reconnaître un mot ne veut pas dire savoir l'écrire.

## Ajouter du vocabulaire

Le vocabulaire est dans [`data/vocab.js`](data/vocab.js). Le format est décrit en haut du fichier. Le plus simple est d'envoyer les photos des pages du livre à Claude, qui les transcrit dans ce fichier (voir [`CLAUDE.md`](CLAUDE.md)).

## Utilisation

Ouvre le lien GitHub Pages depuis le téléphone, puis ajoute la page à l'écran d'accueil (Safari : Partager → « Sur l'écran d'accueil »). L'app marche ensuite hors ligne. Après une mise à jour du vocabulaire, les nouveaux mots apparaissent au lancement suivant.

## Développement local

```bash
python3 -m http.server 5174
```

Puis ouvre `http://localhost:5174`.

Tests du moteur (correction des réponses et répétition espacée) :

```bash
node --test tests/engine.test.js
```

## Stack technique

HTML / CSS / JavaScript vanilla, sans framework ni build. Hébergeable gratuitement sur GitHub Pages.
