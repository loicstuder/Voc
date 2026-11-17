/* Voc — moteur : vérification des réponses et répétition espacée.
   Fonctions pures, utilisables dans le navigateur (window.VocEngine) et dans Node (tests). */
(function (root) {
  "use strict";

  const HOUR = 3600 * 1000;
  const DAY = 24 * HOUR;

  // Chaque mot est dans une "boîte" (0 à 7). Plus la boîte est haute, plus le mot revient tard.
  // Boîte 0 = à revoir tout de suite.
  const INTERVALS_DAYS = [0, 1, 2, 4, 8, 16, 35, 70];
  const MAX_BOX = INTERVALS_DAYS.length - 1;
  const MASTERED_BOX = 4; // à partir de là, on considère le mot comme maîtrisé
  const QCM_MAX_BOX = 2; // reconnaître un mot (QCM) ne suffit pas pour le maîtriser
  const DIFFICULT_THRESHOLD = 1; // seuil du score de difficulté pour "Mots difficiles"

  // Qualité d'une réponse :
  // 0 = faux / je ne sais pas, 1 = presque (orthographe, réponse incomplète),
  // 2 = juste mais lent / hésité, 3 = juste et rapide.

  const ARTICLES = {
    en: ["the", "a", "an", "to"],
    it: ["il", "lo", "la", "i", "gli", "le", "l'", "un", "uno", "una", "un'"],
    fr: ["le", "la", "les", "l'", "un", "une", "des", "se", "s'"],
  };

  // ---------- Normalisation ----------

  function norm(s) {
    return String(s == null ? "" : s)
      .normalize("NFC")
      .toLowerCase()
      .replace(/[’‘`´ʼ]/g, "'")
      .replace(/\s*'\s*/g, "'")
      .replace(/\s+/g, " ")
      .replace(/^[\s.,;:!?]+|[\s.,;:!?]+$/g, "")
      .trim();
  }

  function stripAccents(s) {
    return s.normalize("NFD").replace(/[̀-ͯ]/g, "").normalize("NFC");
  }

  // Une réponse du livre peut contenir une partie optionnelle entre parenthèses :
  // "to tidy (up)" accepte "to tidy" et "to tidy up".
  function variants(expected) {
    const out = new Set();
    out.add(norm(expected.replace(/\([^)]*\)/g, " ")));
    out.add(norm(expected.replace(/[()]/g, "")));
    return [...out].filter(Boolean);
  }

  function splitArticle(s, lang) {
    const list = ARTICLES[lang] || [];
    const elided = s.match(/^([a-z]+')(.*)$/);
    if (elided && list.includes(elided[1])) return [elided[1], elided[2]];
    const sp = s.indexOf(" ");
    if (sp > 0 && list.includes(s.slice(0, sp))) return [s.slice(0, sp), s.slice(sp + 1)];
    return ["", s];
  }

  // Distance d'édition (une inversion de deux lettres compte pour une seule faute).
  function distance(a, b) {
    const m = a.length;
    const n = b.length;
    if (!m) return n;
    if (!n) return m;
    const d = [];
    for (let i = 0; i <= m; i++) {
      d.push(new Array(n + 1).fill(0));
      d[i][0] = i;
    }
    for (let j = 0; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        }
      }
    }
    return d[m][n];
  }

  // Nombre de fautes de frappe tolérées comme "faute d'orthographe" plutôt que "faux".
  function tolerance(s) {
    const n = s.replace(/[\s']/g, "").length;
    if (n < 4) return 0;
    if (n < 9) return 1;
    return 2;
  }

  // Mots de la réponse attendue dont l'accent est faux ou manquant.
  function accentWords(given, expected) {
    if (given.length !== expected.length) return [expected];
    const words = [];
    const re = /[^\s']+/g;
    let m;
    while ((m = re.exec(expected))) {
      for (let k = 0; k < m[0].length; k++) {
        if (given[m.index + k] !== expected[m.index + k]) {
          words.push(m[0]);
          break;
        }
      }
    }
    return words.length ? words : [expected];
  }

  const RANK = { exact: 4, accent: 3, typo: 2, article: 1, wrong: 0 };

  // Compare une réponse à UNE traduction attendue.
  function compareOne(given, expected, lang) {
    const g = norm(given);
    let best = { status: "wrong" };
    if (!g) return best;
    for (const e of variants(expected)) {
      let r;
      if (g === e) {
        r = { status: "exact" };
      } else {
        const gs = stripAccents(g);
        const es = stripAccents(e);
        if (gs === es) {
          r = { status: "accent", accentWords: accentWords(g, e) };
        } else {
          const [ga, gr] = splitArticle(gs, lang);
          const [ea, er] = splitArticle(es, lang);
          if (ga !== ea && (gr === er || distance(gr, er) <= tolerance(er))) {
            r = { status: "article", givenArticle: ga, expectedArticle: ea };
          } else if (distance(gs, es) <= tolerance(es)) {
            r = { status: "typo" };
          } else {
            r = { status: "wrong" };
          }
        }
      }
      if (RANK[r.status] > RANK[best.status]) best = r;
    }
    return best;
  }

  // Vérifie une réponse écrite contre la liste des traductions attendues.
  // Toutes les traductions doivent être données, dans n'importe quel ordre,
  // séparées par une virgule, un point-virgule ou une barre oblique.
  function checkAnswer(input, expectedList, lang) {
    const expected = expectedList.slice();
    const parts =
      expected.length === 1
        ? [String(input || "").trim()].filter(Boolean)
        : String(input || "")
            .split(/[,;/]/)
            .map((s) => s.trim())
            .filter(Boolean);

    const pairs = [];
    expected.forEach((e, i) => {
      parts.forEach((g, j) => {
        const r = compareOne(g, e, lang);
        if (r.status !== "wrong") pairs.push({ i, j, r });
      });
    });
    pairs.sort((a, b) => RANK[b.r.status] - RANK[a.r.status]);

    const items = expected.map((e) => ({ expected: e, status: "missing", given: "" }));
    const usedE = new Set();
    const usedG = new Set();
    for (const p of pairs) {
      if (usedE.has(p.i) || usedG.has(p.j)) continue;
      usedE.add(p.i);
      usedG.add(p.j);
      Object.assign(items[p.i], p.r, { given: parts[p.j] });
    }
    const extras = parts.filter((_, j) => !usedG.has(j));

    let good = 0;
    let typo = 0;
    let bad = 0;
    for (const it of items) {
      if (it.status === "exact" || it.status === "accent") good++;
      else if (it.status === "typo") typo++;
      else bad++;
    }

    let verdict;
    if (bad === 0 && typo === 0) verdict = "correct";
    else if (bad === 0) verdict = "typo";
    else if (expected.length > 1 && good + typo > 0) verdict = "partial";
    else verdict = "wrong";

    return { verdict, items, extras };
  }

  // Au-delà de ce temps, une bonne réponse est considérée comme "lente".
  function slowLimit(kind, answerText) {
    if (kind === "qcm") return 6000;
    if (kind === "write") return 5000 + 300 * String(answerText || "").length;
    return Infinity;
  }

  function quality(verdict, slow) {
    if (verdict === "correct") return slow ? 2 : 3;
    if (verdict === "typo" || verdict === "partial") return 1;
    return 0;
  }

  // ---------- Répétition espacée ----------

  function newProgress() {
    return { box: 0, due: 0, seen: 0, ok: 0, typo: 0, wrong: 0, slow: 0, lapses: 0, hist: [], last: 0, lastUp: 0 };
  }

  function applyResult(prev, q, now, opts) {
    const p = Object.assign(newProgress(), prev || {});
    const maxBox = opts && opts.maxBox != null ? opts.maxBox : MAX_BOX;
    p.hist = (p.hist || []).concat(q).slice(-10);
    p.seen += 1;
    p.last = now;

    let box = p.box;
    if (q === 0) {
      p.wrong++;
      if (p.box >= 2) p.lapses++;
      box = 0;
    } else if (q === 1) {
      p.typo++;
      box = Math.min(Math.max(0, p.box - 1), 1);
    } else if (q === 2) {
      p.ok++;
      p.slow++;
      box = Math.max(1, p.box > 2 ? p.box - 1 : p.box);
    } else {
      p.ok++;
      box = p.box >= maxBox ? p.box : Math.min(maxBox, p.box + 1);
    }

    // Un mot ne monte que d'une boîte par jour (sauf pour atteindre la boîte 1),
    // pour que répéter 5 fois un mot le même soir ne le fasse pas disparaître 2 semaines.
    if (box > p.box) {
      if (box > 1 && now - p.lastUp < 12 * HOUR) box = Math.max(p.box, 1);
      if (box > p.box) p.lastUp = now;
    }
    p.box = box;
    p.due = now + INTERVALS_DAYS[p.box] * DAY;
    return p;
  }

  // Score de difficulté : les erreurs récentes pèsent plus que les anciennes.
  function weakness(p) {
    if (!p || !p.hist || !p.hist.length) return 0;
    let w = 0;
    let f = 1;
    for (let i = p.hist.length - 1; i >= 0; i--) {
      w += (3 - p.hist[i]) * f;
      f *= 0.75;
    }
    return w + (p.lapses || 0) * 0.5;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function wordIdOf(it) {
    return it.wid || it.key;
  }

  // Entraînement du jour : d'abord les mots à revoir (les plus difficiles en premier),
  // puis des nouveaux mots, puis (si tout est à jour) les mots qui reviendront bientôt.
  function pickDaily(items, getP, now, size) {
    const due = [];
    const fresh = [];
    const rest = [];
    for (const it of items) {
      const p = getP(it.key);
      if (!p || !p.seen) fresh.push(it);
      else if (p.due <= now) due.push(it);
      else rest.push(it);
    }
    due.sort((a, b) => weakness(getP(b.key)) - weakness(getP(a.key)) || getP(a.key).due - getP(b.key).due);
    rest.sort((a, b) => getP(a.key).due - getP(b.key).due);

    const out = [];
    const used = new Set();
    for (const list of [due, fresh, rest]) {
      for (const it of list) {
        if (out.length >= size) break;
        if (used.has(wordIdOf(it))) continue;
        used.add(wordIdOf(it));
        out.push(it);
      }
    }
    return shuffle(out);
  }

  function pickDifficult(items, getP, size) {
    return items
      .map((it) => ({ it, w: weakness(getP(it.key)) }))
      .filter((x) => x.w >= DIFFICULT_THRESHOLD)
      .sort((a, b) => b.w - a.w)
      .slice(0, size)
      .map((x) => x.it);
  }

  function counts(items, getP, now) {
    const c = { total: items.length, fresh: 0, due: 0, learning: 0, mastered: 0 };
    for (const it of items) {
      const p = getP(it.key);
      if (!p || !p.seen) {
        c.fresh++;
        continue;
      }
      if (p.due <= now) c.due++;
      if (p.box >= MASTERED_BOX) c.mastered++;
      else c.learning++;
    }
    return c;
  }

  function mastery(items, getP) {
    if (!items.length) return 0;
    let s = 0;
    for (const it of items) {
      const p = getP(it.key);
      if (p) s += Math.min(p.box, MASTERED_BOX) / MASTERED_BOX;
    }
    return s / items.length;
  }

  const api = {
    DAY,
    INTERVALS_DAYS,
    MAX_BOX,
    MASTERED_BOX,
    QCM_MAX_BOX,
    DIFFICULT_THRESHOLD,
    norm,
    stripAccents,
    distance,
    compareOne,
    checkAnswer,
    slowLimit,
    quality,
    newProgress,
    applyResult,
    weakness,
    shuffle,
    pickDaily,
    pickDifficult,
    counts,
    mastery,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.VocEngine = api;
})(typeof window !== "undefined" ? window : globalThis);
