(function () {
  "use strict";

  const E = window.VocEngine;
  const DATA = window.VOC_DATA || {};

  const LANGS = {
    en: { name: "Anglais", flag: "🇬🇧", short: "EN", accents: [] },
    it: { name: "Italien", flag: "🇮🇹", short: "IT", accents: ["à", "è", "é", "ì", "ò", "ù"] },
  };
  const FR_ACCENTS = ["é", "è", "ê", "à", "ç", "ù", "â", "ô", "î", "û"];

  const KEY_PROGRESS = "voc-progress-v1";
  const KEY_SETTINGS = "voc-settings-v1";

  const $view = document.getElementById("view");
  const $title = document.getElementById("title");
  const $back = document.getElementById("back-btn");
  const $statsBtn = document.getElementById("stats-btn");
  const $importFile = document.getElementById("import-file");

  // ---------- Stockage (uniquement sur l'appareil) ----------

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function store(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* stockage indisponible : l'app fonctionne quand même pour la session */
    }
  }

  let progress = load(KEY_PROGRESS, {});
  let settings = load(KEY_SETTINGS, {});
  const saveProgress = () => store(KEY_PROGRESS, progress);
  const saveSettings = () => store(KEY_SETTINGS, settings);
  const getP = (key) => progress[key];

  function langSettings(lang) {
    settings[lang] = Object.assign({ themes: null, dir: "f", game: "mix", size: 20 }, settings[lang]);
    return settings[lang];
  }

  // ---------- Profil : prénom et couleur ----------

  // Les couleurs elles-mêmes sont définies dans style.css ([data-color="…"]).
  const COLORS = [
    ["indigo", "Indigo", "#3f37c9"],
    ["violet", "Violet", "#7b2cbf"],
    ["rose", "Rose", "#d6336c"],
    ["orange", "Orange", "#c2410c"],
    ["vert", "Vert", "#2b8a3e"],
    ["turquoise", "Turquoise", "#0b7f7f"],
    ["bleu", "Bleu", "#1971c2"],
    ["nuit", "Nuit", "#343a5e"],
  ];

  function profile() {
    settings.profile = Object.assign({ name: "", color: "indigo", welcomed: false }, settings.profile);
    return settings.profile;
  }

  function applyTheme() {
    const pr = profile();
    const color = COLORS.find((c) => c[0] === pr.color) || COLORS[0];
    document.documentElement.dataset.color = color[0];
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", color[2]);
  }

  // ---------- Vocabulaire ----------

  function toList(x) {
    return (Array.isArray(x) ? x : [x]).map((s) => String(s == null ? "" : s).trim()).filter(Boolean);
  }
  function slug(s) {
    return E.stripAccents(E.norm(s)).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  const THEMES = {};
  for (const lang of Object.keys(LANGS)) {
    const themes = (DATA[lang] && DATA[lang].themes) || [];
    THEMES[lang] = themes.map((t, ti) => {
      const title = t.title || "Thème " + (ti + 1);
      const id = lang + ":" + slug(title);
      const words = (t.words || [])
        .map((w) => {
          const fr = toList(w[0]);
          const tr = toList(w[1]);
          return {
            id: lang + ":" + E.norm(fr.join("|")) + "=" + E.norm(tr[0] || ""),
            lang,
            themeId: id,
            theme: title,
            fr,
            tr,
            note: w[2] ? String(w[2]) : "",
          };
        })
        .filter((w) => w.fr.length && w.tr.length);
      return { id, title, words };
    });
  }

  function makeItem(word, dir) {
    const fwd = dir === "f";
    return {
      key: word.id + "|" + dir,
      wid: word.id,
      word,
      dir,
      prompt: fwd ? word.fr : word.tr,
      answer: fwd ? word.tr : word.fr,
      answerLang: fwd ? word.lang : "fr",
    };
  }

  function itemsFor(lang, themes, dir) {
    const dirs = dir === "both" ? ["f", "r"] : [dir];
    const seen = new Set();
    const out = [];
    for (const t of themes) {
      for (const w of t.words) {
        if (seen.has(w.id)) continue;
        seen.add(w.id);
        for (const d of dirs) out.push(makeItem(w, d));
      }
    }
    return out;
  }

  function selectedThemes(lang) {
    const ls = langSettings(lang);
    if (!ls.themes) return THEMES[lang];
    return THEMES[lang].filter((t) => ls.themes.includes(t.id));
  }

  // ---------- Utilitaires d'affichage ----------

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  const joinList = (list) => list.join(", ");
  const rnd = (n) => Math.floor(Math.random() * n);

  function setHeader(title, back) {
    $title.textContent = title;
    $back.hidden = !back;
    $statsBtn.hidden = state.view === "stats" || state.view === "session" || state.view === "settings";
  }

  function seg(key, options, current) {
    return `<div class="seg" role="group">${options
      .map(
        ([value, label]) =>
          `<button type="button" class="seg-btn${String(value) === String(current) ? " active" : ""}" data-action="set" data-key="${key}" data-value="${value}">${esc(label)}</button>`
      )
      .join("")}</div>`;
  }

  function wordRow(item, meta) {
    return `<li class="word-row"><span><b>${esc(joinList(item.prompt))}</b> → ${esc(joinList(item.answer))}</span>${
      meta ? `<span class="muted nowrap">${meta}</span>` : ""
    }</li>`;
  }

  // ---------- État / navigation ----------

  const state = { view: "home", lang: null, statsFrom: "home" };
  let session = null;

  function go(view) {
    state.view = view;
    render();
    window.scrollTo(0, 0);
  }

  function render() {
    if (state.view === "home") renderHome();
    else if (state.view === "lang") renderLang();
    else if (state.view === "session") renderSession();
    else if (state.view === "summary") renderSummary();
    else if (state.view === "stats") renderStats();
    else if (state.view === "settings") renderSettings();
  }

  // ---------- Accueil ----------

  function renderHome() {
    setHeader("📚 Voc", false);
    const now = Date.now();
    const pr = profile();
    let totalDue = 0;
    let totalFresh = 0;
    const cards = Object.keys(LANGS)
      .map((lang) => {
        const L = LANGS[lang];
        const items = itemsFor(lang, THEMES[lang], langSettings(lang).dir);
        const c = E.counts(items, getP, now);
        totalDue += c.due;
        totalFresh += c.fresh;
        const nWords = THEMES[lang].reduce((n, t) => n + t.words.length, 0);
        const badges = [
          c.due ? `<span class="badge badge-due">${c.due} à revoir</span>` : "",
          c.fresh ? `<span class="badge">${c.fresh} nouveaux</span>` : "",
          !c.due && !c.fresh && c.total ? `<span class="badge badge-ok">À jour ✓</span>` : "",
        ].join("");
        return `<button class="lang-card lang-${lang}" data-action="open-lang" data-lang="${lang}">
          <span class="lang-flag">${L.flag}</span>
          <span class="lang-info">
            <span class="lang-name">${L.name}</span>
            <span class="lang-meta">${nWords} mots · ${THEMES[lang].length} thème${THEMES[lang].length > 1 ? "s" : ""}</span>
            <span class="badges">${badges}</span>
          </span>
          <span class="chevron">›</span>
        </button>`;
      })
      .join("");
    let top;
    if (!pr.welcomed) {
      top = `<form class="welcome panel" data-form="welcome">
        <h2>Bienvenue sur Voc 👋</h2>
        <p class="muted small">Comment tu t'appelles ?</p>
        <input id="welcome-name" class="text-input" type="text" maxlength="30" autocomplete="given-name"
          autocapitalize="words" placeholder="Ton prénom" value="${esc(pr.name)}" />
        <div class="row">
          <button type="button" class="btn ghost" data-action="skip-welcome">Plus tard</button>
          <button type="submit" class="btn primary">C'est parti</button>
        </div>
      </form>`;
    } else {
      const hour = new Date().getHours();
      const hello = hour >= 18 || hour < 4 ? "Bonsoir" : "Bonjour";
      let sub;
      if (totalDue) sub = `${totalDue} mot${totalDue > 1 ? "s" : ""} à revoir aujourd'hui`;
      else if (totalFresh) sub = `${totalFresh} nouveau${totalFresh > 1 ? "x" : ""} mot${totalFresh > 1 ? "s" : ""} t'attend${totalFresh > 1 ? "ent" : ""}.`;
      else sub = "Tout est à jour, bravo ! 🎉";
      top = `<div class="greeting">
        <div>
          <h2 class="greeting-title">${hello}${pr.name ? " " + esc(pr.name) : ""} 👋</h2>
          <p class="greeting-sub">${sub}</p>
        </div>
        <button class="icon-round" data-action="open-settings" aria-label="Personnaliser">🎨</button>
      </div>`;
    }

    $view.innerHTML = `${top}<div class="stack">${cards}</div>
      <p class="hint">Les mots ratés, mal orthographiés ou trouvés trop lentement reviennent plus souvent, jusqu'à ce qu'ils soient vraiment acquis.</p>`;
  }

  // ---------- Personnaliser ----------

  function renderSettings() {
    setHeader("🎨 Personnaliser", true);
    const pr = profile();
    const swatches = COLORS.map(
      ([id, label, hex]) =>
        `<button type="button" class="swatch${pr.color === id ? " active" : ""}" data-action="color" data-color="${id}"
          style="--swatch:${hex}" aria-label="${label}" aria-pressed="${pr.color === id}">
          <span class="swatch-dot"></span><span class="swatch-label">${label}</span>
        </button>`
    ).join("");
    $view.innerHTML = `
      <section class="panel">
        <h2>Prénom</h2>
        <input id="settings-name" class="text-input" type="text" maxlength="30" autocomplete="given-name"
          autocapitalize="words" placeholder="Ton prénom" value="${esc(pr.name)}" />
        <p class="muted small">Affiché sur l'accueil : « Bonjour <span id="name-preview">${pr.name ? esc(pr.name) : "…"}</span> 👋 »</p>
      </section>
      <section class="panel">
        <h2>Couleur</h2>
        <div class="swatches">${swatches}</div>
      </section>`;
  }

  // ---------- Langue ----------

  function renderLang() {
    const lang = state.lang;
    const L = LANGS[lang];
    const ls = langSettings(lang);
    setHeader(`${L.flag} ${L.name}`, true);
    const now = Date.now();

    const items = itemsFor(lang, selectedThemes(lang), ls.dir);
    const c = E.counts(items, getP, now);
    const nDiff = E.pickDifficult(items, getP, Infinity).length;
    const none = !items.length;

    const themeRows = THEMES[lang]
      .map((t) => {
        const ti = itemsFor(lang, [t], ls.dir);
        const tc = E.counts(ti, getP, now);
        const pct = Math.round(E.mastery(ti, getP) * 100);
        const checked = !ls.themes || ls.themes.includes(t.id);
        return `<label class="theme-row">
          <input type="checkbox" data-change="theme" data-id="${esc(t.id)}" ${checked ? "checked" : ""} />
          <span class="theme-main">
            <span class="theme-title">${esc(t.title)}</span>
            <span class="bar"><span style="width:${pct}%"></span></span>
          </span>
          <span class="theme-meta">${tc.mastered}/${tc.total}${tc.due ? `<br><span class="due-dot">${tc.due} à revoir</span>` : ""}</span>
        </label>`;
      })
      .join("");

    $view.innerHTML = `
      <div class="stack">
        <button class="mode-btn primary" data-action="start" data-mode="daily" ${none ? "disabled" : ""}>
          <span class="mode-title">▶ Entraînement du jour</span>
          <span class="mode-desc">${c.due || c.fresh ? `${c.due} à revoir · ${c.fresh} nouveaux` : "Tout est à jour ✓ (entraînement libre)"}</span>
        </button>
        <button class="mode-btn" data-action="start" data-mode="difficult" ${nDiff ? "" : "disabled"}>
          <span class="mode-title">🎯 Mots difficiles</span>
          <span class="mode-desc">${nDiff ? `${nDiff} mot${nDiff > 1 ? "s" : ""} où ça coince` : "Aucun pour l'instant"}</span>
        </button>
        <button class="mode-btn" data-action="start" data-mode="intensive" ${none ? "disabled" : ""}>
          <span class="mode-title">🔥 Révision intensive</span>
          <span class="mode-desc">Tous les mots des thèmes cochés, jusqu'à les savoir. Idéal avant un test.</span>
        </button>
      </div>

      <section class="panel">
        <div class="opt"><span class="opt-label">Sens</span>${seg("dir", [["f", `FR → ${L.short}`], ["r", `${L.short} → FR`], ["both", "Les deux"]], ls.dir)}</div>
        <div class="opt"><span class="opt-label">Jeu</span>${seg("game", [["mix", "Mix"], ["card", "Cartes"], ["qcm", "QCM"], ["write", "Écrit"]], ls.game)}</div>
        <div class="opt"><span class="opt-label">Mots par session</span>${seg("size", [[10, "10"], [20, "20"], [30, "30"]], ls.size)}</div>
        <p class="hint small">${gameHint(ls.game)}</p>
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2>Thèmes</h2>
          <span>
            <button class="link-btn" data-action="themes-all">Tous</button> ·
            <button class="link-btn" data-action="themes-none">Aucun</button>
          </span>
        </div>
        ${themeRows || `<p class="muted">Aucun thème pour l'instant.</p>`}
        ${none && THEMES[lang].length ? `<p class="muted">Coche au moins un thème.</p>` : ""}
      </section>`;
  }

  function gameHint(game) {
    return {
      mix: "Mix : QCM pour découvrir un nouveau mot, puis à l'écrit.",
      card: "Cartes : tu retournes la carte et tu dis honnêtement si tu savais.",
      qcm: "QCM : 4 propositions. Ne suffit pas à lui seul pour maîtriser un mot.",
      write: "Écrit : le plus exigeant, l'orthographe et les articles comptent.",
    }[game];
  }

  // ---------- Session ----------

  const MODE_TITLES = { daily: "▶ Entraînement", difficult: "🎯 Mots difficiles", intensive: "🔥 Révision intensive", retry: "🔁 Erreurs" };

  function startSession(mode, preset) {
    const lang = state.lang;
    const ls = langSettings(lang);
    const now = Date.now();
    const items = itemsFor(lang, selectedThemes(lang), ls.dir);
    let picked;
    if (preset) picked = E.shuffle(preset.slice());
    else if (mode === "daily") picked = E.pickDaily(items, getP, now, ls.size);
    else if (mode === "difficult") picked = E.shuffle(E.pickDifficult(items, getP, ls.size));
    else picked = E.shuffle(items.slice());
    if (!picked.length) return;

    session = {
      lang,
      mode,
      game: ls.game,
      pool: itemsFor(lang, THEMES[lang], "both"),
      queue: picked.map((item) => ({ item, fails: 0, need: 1 })),
      total: picked.length,
      done: 0,
      results: new Map(),
      current: null,
      phase: "ask",
      last: null,
    };
    state.view = "session";
    window.scrollTo(0, 0);
    next();
  }

  function kindFor(entry) {
    if (session.game !== "mix") return session.game;
    const p = getP(entry.item.key);
    return !p || !p.seen ? "qcm" : "write";
  }

  function buildOptions(item) {
    const correct = joinList(item.answer);
    const same = [];
    const other = [];
    const seen = new Set([E.norm(correct)]);
    for (const it of E.shuffle(session.pool.slice())) {
      if (it.dir !== item.dir) continue;
      const label = joinList(it.answer);
      const k = E.norm(label);
      if (seen.has(k)) continue;
      seen.add(k);
      (it.word.themeId === item.word.themeId ? same : other).push(label);
    }
    const distractors = same.concat(other).slice(0, 3);
    return E.shuffle([correct].concat(distractors)).map((label) => ({ label, correct: label === correct }));
  }

  function next() {
    const s = session;
    s.current = s.queue.shift() || null;
    s.last = null;
    if (!s.current) {
      go("summary");
      return;
    }
    const c = s.current;
    c.kind = kindFor(c);
    c.options = c.kind === "qcm" ? buildOptions(c.item) : null;
    s.phase = "ask";
    render();
    c.shownAt = Date.now();
    if (c.kind === "write") {
      const input = document.getElementById("answer");
      if (input) input.focus();
    }
  }

  // La touche Entrée qui valide une réponse ne doit pas aussi passer le corrigé.
  function continueSession() {
    if (Date.now() - (session.feedbackAt || 0) < 400) return;
    next();
  }

  function insertLater(entry, offset) {
    session.queue.splice(Math.min(offset, session.queue.length), 0, entry);
  }

  // Remet le mot dans la file : vite s'il est raté, un peu plus tard s'il doit être confirmé.
  function reschedule(entry, q) {
    const s = session;
    if (q <= 1) {
      entry.fails++;
      entry.need = s.mode === "intensive" ? 2 : 1;
      if (s.mode === "intensive" || entry.fails <= 3) {
        insertLater(entry, 2 + rnd(2));
        return;
      }
      s.done++;
      return;
    }
    entry.need--;
    if (entry.need > 0) {
      insertLater(entry, 4 + rnd(4));
      return;
    }
    s.done++;
  }

  function answer(q, info) {
    const s = session;
    const c = s.current;
    const key = c.item.key;
    const before = progress[key];
    const snap = { fails: c.fails, need: c.need, done: s.done };
    progress[key] = E.applyResult(before, q, Date.now(), c.kind === "qcm" ? { maxBox: E.QCM_MAX_BOX } : undefined);
    saveProgress();

    const rec = s.results.get(key) || { item: c.item, qs: [] };
    rec.qs.push(q);
    s.results.set(key, rec);

    reschedule(c, q);
    s.last = { entry: c, q, info, before, snap };

    if (c.kind === "card") {
      next();
      return;
    }
    s.phase = "feedback";
    s.feedbackAt = Date.now();
    render();
    const btn = document.getElementById("continue-btn");
    if (btn) btn.focus({ preventScroll: true });
  }

  // "J'avais juste" : annule la dernière correction et compte la réponse comme juste.
  function override() {
    const s = session;
    const l = s.last;
    if (!l) return;
    const c = l.entry;
    if (l.before) progress[c.item.key] = l.before;
    else delete progress[c.item.key];
    c.fails = l.snap.fails;
    c.need = l.snap.need;
    s.done = l.snap.done;
    const idx = s.queue.indexOf(c);
    if (idx >= 0) s.queue.splice(idx, 1);
    const rec = s.results.get(c.item.key);
    if (rec) rec.qs.pop();
    answer(3, { given: l.info.given, overridden: true });
  }

  function submitWrite(value) {
    const c = session.current;
    if (!value.trim()) return;
    const it = c.item;
    const elapsed = Date.now() - c.shownAt;
    const res = E.checkAnswer(value, it.answer, it.answerLang);
    const slow = elapsed > E.slowLimit("write", joinList(it.answer));
    answer(E.quality(res.verdict, slow), { given: value, res, slow });
  }

  function chooseOption(i) {
    const c = session.current;
    const opt = c.options[i];
    if (!opt) return;
    c.chosen = i;
    const slow = Date.now() - c.shownAt > E.slowLimit("qcm");
    answer(opt.correct ? (slow ? 2 : 3) : 0, { given: opt.label, qcm: true, slow });
  }

  function articleMsg(r) {
    if (r.expectedArticle === "to" || r.givenArticle === "to") {
      return `N'oublie pas le «&nbsp;to&nbsp;» des verbes : <b>${esc(r.expected)}</b>`;
    }
    if (!r.givenArticle) return `Il manque l'article : <b>${esc(r.expected)}</b>`;
    if (!r.expectedArticle) return `Pas d'article ici : <b>${esc(r.expected)}</b>`;
    return `Mauvais article : <b>${esc(r.expected)}</b> <span class="muted">(et non «&nbsp;${esc(r.givenArticle)}&nbsp;»)</span>`;
  }

  function describe(q, info, item) {
    const lines = [];
    let title;
    let cls;
    const res = info.res;
    const multi = item.answer.length > 1;

    if (info.overridden) {
      title = "👍 Compté comme juste";
      cls = "ok";
    } else if (info.dontKnow) {
      title = "📖 À apprendre";
      cls = "bad";
    } else if (info.qcm) {
      if (q === 0) {
        title = "❌ Faux";
        cls = "bad";
      } else if (q === 2) {
        title = "🐢 Juste, mais tu as hésité";
        cls = "slow";
      } else {
        title = "✅ Juste !";
        cls = "ok";
      }
    } else {
      const hasArticle = res.items.some((r) => r.status === "article");
      if (res.verdict === "correct") {
        title = info.slow ? "🐢 Juste, mais un peu lent" : "✅ Juste !";
        cls = info.slow ? "slow" : "ok";
        if (info.slow) lines.push("Ce mot reviendra un peu plus vite pour l'automatiser.");
      } else if (res.verdict === "typo") {
        title = "✏️ Presque ! Attention à l'orthographe";
        cls = "almost";
      } else if (res.verdict === "partial") {
        title = "🧩 Presque ! Il manque une partie";
        cls = "almost";
      } else {
        title = hasArticle && !multi ? "❌ Attention à l'article" : "❌ Faux";
        cls = "bad";
      }
      for (const r of res.items) {
        if (r.status === "accent") lines.push(`N'oublie pas l'accent : <b>${esc(r.accentWords.join(", "))}</b>`);
        else if (r.status === "typo") lines.push(`Orthographe : <b>${esc(r.expected)}</b> <span class="muted">(tu as écrit «&nbsp;${esc(r.given)}&nbsp;»)</span>`);
        else if (r.status === "article") lines.push(articleMsg(r));
        else if (r.status === "missing" && multi) lines.push(`Il manquait : <b>${esc(r.expected)}</b>`);
      }
      if (res.extras.length) {
        lines.push(
          multi
            ? `Pas dans la liste du livre : «&nbsp;${esc(res.extras.join(", "))}&nbsp;»`
            : `Tu as écrit : «&nbsp;${esc(res.extras.join(", "))}&nbsp;»`
        );
      }
    }
    return { title, cls, lines };
  }

  function accentBar(lang) {
    const chars = lang === "fr" ? FR_ACCENTS : LANGS[lang].accents;
    if (!chars.length) return "";
    return `<div class="accent-bar">${chars
      .map((ch) => `<button type="button" class="accent-btn" data-action="accent" data-char="${ch}">${ch}</button>`)
      .join("")}</div>`;
  }

  function renderSession() {
    const s = session;
    const c = s.current;
    const it = c.item;
    const L = LANGS[s.lang];
    setHeader(MODE_TITLES[s.mode], true);

    const pct = Math.round((s.done / s.total) * 100);
    const from = it.dir === "f" ? "Français" : L.name;
    const to = it.dir === "f" ? L.name : "Français";
    const feedback = s.phase === "feedback";
    const last = s.last;

    let body = "";
    if (c.kind === "write") {
      const stateCls = feedback ? (last.q >= 2 ? "is-ok" : last.q === 1 ? "is-almost" : "is-bad") : "";
      body = `<form class="write-form" data-form="write">
        <input id="answer" class="answer-input ${stateCls}" type="text" autocomplete="off" autocorrect="off"
          autocapitalize="off" spellcheck="false" enterkeyhint="${feedback ? "next" : "done"}"
          placeholder="${it.answer.length > 1 ? "Sépare par des virgules" : "Ta réponse"}"
          value="${feedback ? esc(last.info.given || "") : ""}" ${feedback ? "readonly" : ""} />
        ${feedback ? "" : accentBar(it.answerLang)}
        ${
          feedback
            ? ""
            : `<div class="row">
                <button type="button" class="btn ghost" data-action="dont-know">Je ne sais pas</button>
                <button type="submit" class="btn primary">Valider</button>
              </div>`
        }
      </form>`;
    } else if (c.kind === "qcm") {
      body = `<div class="options">${c.options
        .map((o, i) => {
          let cls = "";
          if (feedback) {
            if (o.correct) cls = " correct";
            else if (i === c.chosen) cls = " wrong";
          }
          return `<button class="option${cls}" data-action="qcm" data-i="${i}" ${feedback ? "disabled" : ""}>${esc(o.label)}</button>`;
        })
        .join("")}</div>`;
    } else if (c.kind === "card") {
      body =
        s.phase === "reveal"
          ? `<div class="card-answer">${esc(joinList(it.answer))}</div>
             ${it.word.note ? `<div class="fb-note">💡 ${esc(it.word.note)}</div>` : ""}
             <div class="self-grade">
               <button class="btn grade-bad" data-action="self" data-q="0">😕 Raté</button>
               <button class="btn grade-slow" data-action="self" data-q="2">🤔 Hésité</button>
               <button class="btn grade-ok" data-action="self" data-q="3">😎 Su</button>
             </div>`
          : `<button class="btn primary wide" data-action="reveal">Voir la réponse</button>`;
    }

    let fb = "";
    if (feedback) {
      const d = describe(last.q, last.info, it);
      const canOverride = c.kind === "write" && last.q <= 1 && !last.info.dontKnow;
      fb = `<div class="feedback fb-${d.cls}">
        <div class="fb-title">${d.title}</div>
        ${d.lines.map((x) => `<div class="fb-line">${x}</div>`).join("")}
        <div class="fb-answer"><span class="muted">Réponse :</span> <b>${esc(joinList(it.answer))}</b></div>
        ${it.word.note ? `<div class="fb-note">💡 ${esc(it.word.note)}</div>` : ""}
        <div class="row">
          ${canOverride ? `<button class="btn ghost small" data-action="override">J'avais juste</button>` : "<span></span>"}
          <button class="btn primary" id="continue-btn" data-action="continue">Continuer</button>
        </div>
      </div>`;
    }

    $view.innerHTML = `
      <div class="session-top">
        <div class="bar big"><span style="width:${pct}%"></span></div>
        <span class="counter">${s.done}/${s.total}</span>
      </div>
      <div class="q-card">
        <div class="q-meta"><span>${esc(it.word.theme)}</span><span>${from} → ${to}</span></div>
        <div class="q-prompt">${esc(joinList(it.prompt))}</div>
        ${it.answer.length > 1 ? `<div class="q-hint">${it.answer.length} réponses attendues</div>` : ""}
        ${body}
      </div>
      ${fb}`;
  }

  function quitSession() {
    if (!session) return go("lang");
    if (session.results.size === 0 || confirm("Arrêter la session ? Tes progrès sont déjà enregistrés.")) {
      if (session.results.size) go("summary");
      else go("lang");
    }
  }

  // ---------- Fin de session ----------

  function renderSummary() {
    const s = session;
    setHeader("Bilan", true);
    const recs = [...s.results.values()];
    const first = recs.filter((r) => r.qs[0] >= 2).length;
    const hard = recs.filter((r) => r.qs.some((q) => q <= 1));
    const slow = recs.filter((r) => !r.qs.some((q) => q <= 1) && r.qs.some((q) => q === 2));
    const ratio = recs.length ? first / recs.length : 0;
    const emoji = ratio >= 0.9 ? "🏆" : ratio >= 0.7 ? "🎉" : ratio >= 0.4 ? "💪" : "📖";

    $view.innerHTML = `
      <div class="panel center">
        <div class="big-emoji">${emoji}</div>
        <h2>${s.queue.length || s.current ? "Session interrompue" : "Session terminée"}</h2>
        <p><b>${first}</b> / ${recs.length} justes du premier coup</p>
      </div>
      ${
        hard.length
          ? `<section class="panel"><h2>Où ça a coincé</h2><ul class="word-list">${hard
              .map((r) => wordRow(r.item, `${r.qs.filter((q) => q <= 1).length} ✗`))
              .join("")}</ul></section>`
          : ""
      }
      ${
        slow.length
          ? `<section class="panel"><h2>🐢 Juste, mais lent</h2><ul class="word-list">${slow
              .map((r) => wordRow(r.item, ""))
              .join("")}</ul></section>`
          : ""
      }
      <div class="stack">
        ${hard.length ? `<button class="btn primary wide" data-action="retry">🔁 Revoir ${hard.length > 1 ? `ces ${hard.length} mots` : "ce mot"}</button>` : ""}
        <button class="btn wide" data-action="to-lang">Retour</button>
      </div>`;
  }

  // ---------- Progrès ----------

  function renderStats() {
    setHeader("📊 Progrès", true);
    const now = Date.now();
    const blocks = Object.keys(LANGS)
      .map((lang) => {
        const L = LANGS[lang];
        const items = itemsFor(lang, THEMES[lang], "both").filter((it) => getP(it.key) || it.dir === "f");
        const c = E.counts(items, getP, now);
        const diff = E.pickDifficult(items, getP, 12);
        return `<section class="panel">
          <h2>${L.flag} ${L.name}</h2>
          <div class="stat-grid">
            <div><b>${c.fresh}</b><span>Nouveaux</span></div>
            <div><b>${c.learning}</b><span>En cours</span></div>
            <div><b>${c.mastered}</b><span>Maîtrisés</span></div>
          </div>
          <h3>Mots où ça coince</h3>
          ${
            diff.length
              ? `<ul class="word-list">${diff
                  .map((it) => {
                    const p = getP(it.key);
                    const meta = [p.wrong ? `${p.wrong} ✗` : "", p.typo ? `${p.typo} ✏️` : "", p.slow ? `${p.slow} 🐢` : ""]
                      .filter(Boolean)
                      .join(" · ");
                    return wordRow(it, meta);
                  })
                  .join("")}</ul>`
              : `<p class="muted">Rien pour l'instant 👌</p>`
          }
        </section>`;
      })
      .join("");

    $view.innerHTML = `${blocks}
      <section class="panel">
        <h2>💾 Sauvegarde</h2>
        <p class="muted small">Les progrès sont enregistrés uniquement sur ce téléphone. Exporte une sauvegarde de temps en temps (par exemple dans Fichiers ou iCloud) pour ne rien perdre.</p>
        <div class="stack">
          <button class="btn wide" data-action="export">⬆️ Exporter mes progrès</button>
          <button class="btn wide" data-action="import">⬇️ Importer une sauvegarde</button>
          <button class="btn ghost danger wide" data-action="reset">Tout remettre à zéro</button>
        </div>
      </section>`;
  }

  async function exportData() {
    const data = JSON.stringify({ app: "voc", version: 1, date: new Date().toISOString(), progress, settings });
    const name = `voc-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([data], name, { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Sauvegarde Voc" });
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return;
      }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  $importFile.addEventListener("change", async () => {
    const f = $importFile.files && $importFile.files[0];
    $importFile.value = "";
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!data || data.app !== "voc" || typeof data.progress !== "object") throw new Error("format");
      if (!confirm("Remplacer les progrès actuels par cette sauvegarde ?")) return;
      progress = data.progress || {};
      settings = data.settings || {};
      saveProgress();
      saveSettings();
      applyTheme();
      alert("Sauvegarde importée ✓");
      render();
    } catch (e) {
      alert("Ce fichier n'est pas une sauvegarde Voc valide.");
    }
  });

  // ---------- Événements ----------

  $back.addEventListener("click", () => {
    if (state.view === "lang") go("home");
    else if (state.view === "stats") go(state.statsFrom === "lang" && state.lang ? "lang" : "home");
    else if (state.view === "session") quitSession();
    else if (state.view === "summary") go("lang");
    else if (state.view === "settings") go("home");
  });

  $statsBtn.addEventListener("click", () => {
    state.statsFrom = state.view === "lang" ? "lang" : "home";
    go("stats");
  });

  // Les boutons d'accent ne doivent pas faire perdre le focus au champ (sinon le clavier se ferme).
  $view.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".accent-btn")) e.preventDefault();
  });

  $view.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el || el.disabled) return;
    const a = el.dataset.action;
    if (a === "open-lang") {
      state.lang = el.dataset.lang;
      go("lang");
    } else if (a === "open-settings") {
      go("settings");
    } else if (a === "skip-welcome") {
      profile().welcomed = true;
      saveSettings();
      render();
    } else if (a === "color") {
      profile().color = el.dataset.color;
      saveSettings();
      applyTheme();
      render();
    } else if (a === "set") {
      const ls = langSettings(state.lang);
      const v = el.dataset.value;
      ls[el.dataset.key] = el.dataset.key === "size" ? Number(v) : v;
      saveSettings();
      render();
    } else if (a === "themes-all" || a === "themes-none") {
      langSettings(state.lang).themes = a === "themes-all" ? null : [];
      saveSettings();
      render();
    } else if (a === "start") {
      startSession(el.dataset.mode);
    } else if (a === "dont-know") {
      answer(0, { given: "", dontKnow: true });
    } else if (a === "qcm") {
      chooseOption(Number(el.dataset.i));
    } else if (a === "reveal") {
      session.phase = "reveal";
      render();
    } else if (a === "self") {
      answer(Number(el.dataset.q), { self: true });
    } else if (a === "continue") {
      continueSession();
    } else if (a === "override") {
      override();
    } else if (a === "accent") {
      const input = document.getElementById("answer");
      if (!input || input.readOnly) return;
      const ch = el.dataset.char;
      const start = input.selectionStart == null ? input.value.length : input.selectionStart;
      const end = input.selectionEnd == null ? start : input.selectionEnd;
      input.value = input.value.slice(0, start) + ch + input.value.slice(end);
      input.focus();
      input.setSelectionRange(start + ch.length, start + ch.length);
    } else if (a === "retry") {
      const hard = [...session.results.values()].filter((r) => r.qs.some((q) => q <= 1)).map((r) => r.item);
      startSession("retry", hard);
    } else if (a === "to-lang") {
      go("lang");
    } else if (a === "export") {
      exportData();
    } else if (a === "import") {
      $importFile.click();
    } else if (a === "reset") {
      if (confirm("Effacer tous les progrès (anglais et italien) ? C'est définitif.")) {
        progress = {};
        saveProgress();
        render();
      }
    }
  });

  $view.addEventListener("change", (e) => {
    const el = e.target;
    if (el.dataset.change !== "theme") return;
    const ls = langSettings(state.lang);
    const all = THEMES[state.lang].map((t) => t.id);
    let sel = ls.themes ? ls.themes.slice() : all.slice();
    if (el.checked) sel.push(el.dataset.id);
    else sel = sel.filter((id) => id !== el.dataset.id);
    sel = all.filter((id) => sel.includes(id));
    ls.themes = sel.length === all.length ? null : sel;
    saveSettings();
    render();
  });

  $view.addEventListener("input", (e) => {
    if (e.target.id !== "settings-name") return;
    profile().name = e.target.value.trim();
    saveSettings();
    const preview = document.getElementById("name-preview");
    if (preview) preview.textContent = profile().name || "…";
  });

  $view.addEventListener("submit", (e) => {
    e.preventDefault();
    if (e.target.dataset.form === "welcome") {
      const pr = profile();
      pr.name = document.getElementById("welcome-name").value.trim();
      pr.welcomed = true;
      saveSettings();
      render();
      return;
    }
    if (!session || state.view !== "session") return;
    if (session.phase === "feedback") continueSession();
    else submitWrite(document.getElementById("answer").value);
  });

  applyTheme();
  render();
})();
