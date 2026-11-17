// Tests du moteur : node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../engine.js");

const check = (input, expected, lang) => E.checkAnswer(input, expected, lang);

test("réponse exacte, casse et espaces ignorés", () => {
  assert.equal(check("  The House ", ["the house"], "en").verdict, "correct");
});

test("accent manquant = juste, avec le mot à corriger", () => {
  const r = check("la citta", ["la città"], "it");
  assert.equal(r.verdict, "correct");
  assert.equal(r.items[0].status, "accent");
  assert.deepEqual(r.items[0].accentWords, ["città"]);
});

test("faute d'orthographe = presque", () => {
  assert.equal(check("the kitchne", ["the kitchen"], "en").verdict, "typo");
  assert.equal(check("comfortible", ["comfortable"], "en").verdict, "typo");
});

test("mot court : pas de tolérance", () => {
  assert.equal(check("hot", ["hat"], "en").verdict, "wrong");
});

test("article manquant ou faux = faux, avec le détail", () => {
  const r1 = check("house", ["the house"], "en");
  assert.equal(r1.verdict, "wrong");
  assert.equal(r1.items[0].status, "article");
  const r2 = check("il strada", ["la strada"], "it");
  assert.equal(r2.verdict, "wrong");
  assert.equal(r2.items[0].expectedArticle, "la");
  assert.equal(r2.items[0].givenArticle, "il");
  assert.equal(check("move", ["to move"], "en").items[0].status, "article");
});

test("article élidé italien et apostrophes", () => {
  assert.equal(check("l’ospedale", ["l'ospedale"], "it").verdict, "correct");
  assert.equal(check("l' ospedale", ["l'ospedale"], "it").verdict, "correct");
  assert.equal(check("ospedale", ["l'ospedale"], "it").items[0].status, "article");
});

test("plusieurs traductions, dans n'importe quel ordre", () => {
  assert.equal(check("the couch, the sofa", ["the sofa", "the couch"], "en").verdict, "correct");
  assert.equal(check("the couch / the sofa", ["the sofa", "the couch"], "en").verdict, "correct");
  const partial = check("the sofa", ["the sofa", "the couch"], "en");
  assert.equal(partial.verdict, "partial");
  assert.equal(partial.items[1].status, "missing");
});

test("partie optionnelle entre parenthèses", () => {
  assert.equal(check("to tidy", ["to tidy (up)"], "en").verdict, "correct");
  assert.equal(check("to tidy up", ["to tidy (up)"], "en").verdict, "correct");
});

test("réponse vide = faux", () => {
  assert.equal(check("", ["the house"], "en").verdict, "wrong");
});

test("qualité selon le verdict et la vitesse", () => {
  assert.equal(E.quality("correct", false), 3);
  assert.equal(E.quality("correct", true), 2);
  assert.equal(E.quality("typo", false), 1);
  assert.equal(E.quality("wrong", false), 0);
});

test("une erreur renvoie le mot à la boîte 0, à revoir tout de suite", () => {
  const now = Date.now();
  let p = E.applyResult(null, 3, now);
  p = E.applyResult(p, 3, now + 2 * E.DAY);
  assert.equal(p.box, 2);
  p = E.applyResult(p, 0, now + 4 * E.DAY);
  assert.equal(p.box, 0);
  assert.equal(p.due, now + 4 * E.DAY);
  assert.equal(p.lapses, 1);
});

test("un mot ne monte que d'une boîte par jour", () => {
  const now = Date.now();
  let p = E.applyResult(null, 3, now);
  p = E.applyResult(p, 3, now + 1000);
  p = E.applyResult(p, 3, now + 2000);
  assert.equal(p.box, 1);
});

test("le QCM ne fait pas dépasser la boîte 2", () => {
  let t = Date.now();
  let p = null;
  for (let i = 0; i < 5; i++) {
    p = E.applyResult(p, 3, t, { maxBox: E.QCM_MAX_BOX });
    t += E.DAY;
  }
  assert.equal(p.box, 2);
});

test("score de difficulté : élevé après des erreurs, redescend après des réussites", () => {
  let p = E.applyResult(null, 0, 0);
  assert.ok(E.weakness(p) >= E.DIFFICULT_THRESHOLD);
  for (let i = 1; i <= 5; i++) p = E.applyResult(p, 3, i * E.DAY);
  assert.ok(E.weakness(p) < E.DIFFICULT_THRESHOLD);
});

test("entraînement du jour : mots à revoir d'abord, puis nouveaux", () => {
  const now = 10 * E.DAY;
  const progress = {
    a: Object.assign(E.newProgress(), { seen: 1, due: now - 1, hist: [0] }),
    b: Object.assign(E.newProgress(), { seen: 1, due: now + E.DAY, hist: [3] }),
  };
  const items = ["a", "b", "c", "d"].map((key) => ({ key, wid: key }));
  const picked = E.pickDaily(items, (k) => progress[k], now, 2).map((i) => i.key).sort();
  assert.deepEqual(picked, ["a", "c"]);
});
