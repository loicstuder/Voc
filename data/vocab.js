/* Vocabulaire de l'app.
 *
 * Format :
 *   { title: "Titre du thème", words: [ [français, traduction, note?], ... ] }
 *
 * - français / traduction : une chaîne, ou un tableau s'il y a plusieurs traductions
 *   à connaître (ex. ["the sofa", "the couch"]). Toutes seront demandées, dans n'importe quel ordre.
 * - Écrire exactement comme dans le livre, avec l'article ("the house", "la città", "to go").
 * - Une partie entre parenthèses est optionnelle : "to tidy (up)" accepte "to tidy" et "to tidy up".
 * - note (optionnelle) : affichée après la réponse (pluriel irrégulier, genre, etc.).
 *
 * Les thèmes "Exemple" ci-dessous servent à tester l'app ; ils seront remplacés
 * par le vrai vocabulaire (à partir des photos du livre).
 */
window.VOC_DATA = {
  en: {
    themes: [
      {
        title: "Exemple – At home",
        words: [
          ["la maison", "the house"],
          ["la chambre (à coucher)", "the bedroom"],
          ["la cuisine", "the kitchen"],
          ["le canapé", ["the sofa", "the couch"]],
          ["l'étagère", "the shelf", "Pluriel : the shelves"],
          ["le grenier", "the attic"],
          ["déménager", "to move (house)"],
          ["louer", ["to rent", "to let"]],
          ["le voisin, la voisine", "the neighbour", "Orthographe britannique (US : neighbor)"],
          ["confortable", "comfortable"],
          ["ranger", "to tidy (up)"],
          ["le loyer", "the rent"],
        ],
      },
    ],
  },
  it: {
    themes: [
      {
        title: "Esempio – La città",
        words: [
          ["la ville", "la città"],
          ["la rue", "la strada"],
          ["la place", "la piazza"],
          ["le quartier", "il quartiere"],
          ["le magasin", "il negozio"],
          ["le café (boisson)", "il caffè"],
          ["le pont", "il ponte"],
          ["l'hôpital", "l'ospedale", "Masculin : un ospedale"],
          ["pourquoi, parce que", "perché"],
          ["le feu (de signalisation)", "il semaforo"],
          ["la gare", "la stazione"],
          ["l'étudiant", "lo studente", "lo devant s + consonne"],
          ["tourner à gauche", ["girare a sinistra", "svoltare a sinistra"]],
        ],
      },
    ],
  },
};
