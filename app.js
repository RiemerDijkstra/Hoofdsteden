(() => {
'use strict';
const C = window.COUNTRIES;
const byId = Object.fromEntries(C.map(c => [c.id, c]));
const flagURL = {};
C.forEach(c => flagURL[c.id] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(c.flag));
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

/* ---------- teksten NL / EN ---------- */
const T = {
  nl: {
    brand: 'Hoofdsteden', topicCap: 'Hoofdsteden', topicFlag: 'Vlaggen', questions: 'vragen',
    country: 'Land', capital: 'Hoofdstad', flag: 'Vlag', swap: 'Draai de richting om',
    seen: (a, b) => `<b>${a}</b> van ${b} landen gehad`,
    reset: 'Voortgang wissen', resetSure: 'Tik nog eens om te wissen',
    askCap: 'Wat is de hoofdstad?', askRev: 'Van welk land is dit de hoofdstad?', askFlag: 'Welk land is dit?',
    phCap: 'Typ de hoofdstad', phLand: 'Typ het land', next: 'Verder', check: 'Controleer',
    choice: 'Kies', type: 'Typ', choiceL: 'Meerkeuze', typeL: 'Typen',
    words: ['Foutloos!', 'Goed bezig!', 'Blijven oefenen'], streak: 'Reeks', best: 'Beste',
    home: 'Home', again: 'Nog een ronde', start: 'Start ronde', quit: 'Stoppen',
    less: 'Minder vragen', more: 'Meer vragen', langBtn: 'NL', langSwitch: 'Switch to English',
    soundOn: 'Geluid aanzetten', soundOff: 'Geluid uitzetten', outline: 'Omtrek van een land'
  },
  en: {
    brand: 'Capitals', topicCap: 'Capitals', topicFlag: 'Flags', questions: 'questions',
    country: 'Country', capital: 'Capital', flag: 'Flag', swap: 'Reverse direction',
    seen: (a, b) => `<b>${a}</b> of ${b} countries seen`,
    reset: 'Reset progress', resetSure: 'Tap again to reset',
    askCap: "What's the capital?", askRev: 'Which country has this capital?', askFlag: 'Which country is this?',
    phCap: 'Type the capital', phLand: 'Type the country', next: 'Next', check: 'Check',
    choice: 'Pick', type: 'Type', choiceL: 'Multiple choice', typeL: 'Typing',
    words: ['Flawless!', 'Nice work!', 'Keep practising'], streak: 'Streak', best: 'Best',
    home: 'Home', again: 'Play again', start: 'Start round', quit: 'Quit',
    less: 'Fewer questions', more: 'More questions', langBtn: 'EN', langSwitch: 'Wissel naar Nederlands',
    soundOn: 'Turn sound on', soundOff: 'Turn sound off', outline: 'Outline of a country'
  }
};
const t = k => T[S.lang][k];
const countryName = c => S.lang === 'en' ? c.en : c.name;
const capName = c => S.lang === 'en' ? c.capEn : c.cap;

/* ---------- opslag ---------- */
const KEY = 'hoofdsteden.v1';
let S = { d: { cap: {}, rev: {}, flag: {} }, count: 10, mode: 'choice', game: 'cap', rev: false,
          lang: 'nl', sound: true, streak: 0, best: 0 };
try {
  const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (raw) {
    if (raw.p && !raw.d) { raw.d = { cap: raw.p, rev: {}, flag: {} }; delete raw.p; }   // oude versie omzetten
    S = Object.assign(S, raw); S.d = Object.assign({ cap: {}, rev: {}, flag: {} }, S.d);
  }
} catch (e) {}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
const deckKey = () => S.game === 'flag' ? 'flag' : (S.rev ? 'rev' : 'cap');
const deck = () => S.d[deckKey()];

/* ---------- geluid (Web Audio, geen bestanden nodig) ---------- */
let AC = null;
function audio() {
  if (!S.sound) return null;
  try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); }
  catch (e) { return null; }
  return AC;
}
function tone(ac, freq, when, dur, { type = 'triangle', vol = .22, glide = 0 } = {}) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, when);
  if (glide) o.frequency.exponentialRampToValueAtTime(glide, when + dur);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(vol, when + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  o.connect(g).connect(ac.destination); o.start(when); o.stop(when + dur + 0.02);
}
const sfx = {
  good() { const ac = audio(); if (!ac) return; const n = ac.currentTime;
    tone(ac, 784, n, .13); tone(ac, 1175, n + .09, .22); tone(ac, 2350, n + .09, .12, { type: 'sine', vol: .05 }); },
  bad() { const ac = audio(); if (!ac) return; const n = ac.currentTime;
    tone(ac, 220, n, .16, { vol: .25, glide: 190 }); tone(ac, 165, n + .13, .3, { vol: .25, glide: 120 }); },
  streak() { const ac = audio(); if (!ac) return; const n = ac.currentTime + .2;
    [1047, 1319, 1568, 2093].forEach((f, i) => tone(ac, f, n + i * .07, .16, { vol: .14 })); },
  pop() { const ac = audio(); if (!ac) return; tone(ac, 520, ac.currentTime, .09, { type: 'sine', vol: .18, glide: 900 }); },
  done() { const ac = audio(); if (!ac) return; const n = ac.currentTime;
    [523, 659, 784, 1047].forEach((f, i) => tone(ac, f, n + i * .09, .25, { vol: .16 })); }
};

/* ---------- spaced repetition ----------
   Elk land heeft per spelmodus een niveau 0..5 (Leitner-bakjes).
   Goed = niveau omhoog (meerkeuze tot 3, typen tot 5), fout = terug naar 0.
   Kans op een land = basisgewicht van het niveau × hoe 'toe' het is aan herhaling
   (tijd sinds laatst gezien ÷ interval van dat niveau). Er is altijd een ondergrens,
   dus elk land kan in elke ronde voorkomen. */
const BASE = [10, 6, 3, 1.5, 0.7, 0.35];
const INTERVAL_H = [0, 0.25, 4, 24, 72, 168];
const W_NEW = 3, FLOOR = 0.12;
function weight(r) {
  if (!r) return W_NEW;
  let w = BASE[r.l];
  if (INTERVAL_H[r.l]) {
    const due = (Date.now() - (r.last || 0)) / (INTERVAL_H[r.l] * 3.6e6);
    w *= Math.min(2.5, Math.max(0.3, due));
  }
  return Math.max(FLOOR, w);
}
function pickRound(n) {
  const d = deck(), pool = C.map(c => ({ id: c.id, w: weight(d[c.id]) })), out = [];
  n = Math.min(n, pool.length);
  while (out.length < n) {
    const tot = pool.reduce((a, b) => a + b.w, 0); let r = Math.random() * tot, i = 0;
    for (; i < pool.length - 1; i++) { r -= pool[i].w; if (r <= 0) break; }
    out.push(pool[i].id); pool.splice(i, 1);
  }
  return out;
}
function record(id, ok, typed) {
  const d = deck(), r = d[id] || (d[id] = { l: 0, ok: 0, bad: 0 });
  if (ok) { r.ok++; if (r.l < (typed ? 5 : 3)) r.l++; } else { r.bad++; r.l = 0; }
  r.last = Date.now();
}

/* ---------- iconen ---------- */
const PIN = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>';
const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M13 6l6 6-6 6"/></svg>';
const FLAME = '<svg viewBox="0 0 24 24"><path class="flame" d="M12 2.5c.6 3.2 2.3 4.6 3.8 6.2 1.6 1.7 2.7 3.5 2.7 6A6.5 6.5 0 0 1 12 21.5a6.5 6.5 0 0 1-6.5-6.8c0-2.2 1-3.9 2.3-5.2.2 1.6.9 2.8 2 3.4-.3-3.7.4-7.2 2.2-10.4z"/><path d="M12 13.2c1.6 1.4 2.6 2.5 2.6 4.1a2.6 2.6 0 0 1-5.2 0c0-1.3.9-2.6 2.6-4.1z" fill="#fff" opacity=".7"/></svg>';
const FLAME_ON = FLAME.replace('class="flame"', 'fill="#ffb83a"');
const SPK = {
  on: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
  off: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>'
};
const MODE_ICON = {
  choice: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="2.5"/><rect x="13" y="3" width="8" height="8" rx="2.5"/><rect x="3" y="13" width="8" height="8" rx="2.5"/><rect x="13" y="13" width="8" height="8" rx="2.5"/></svg>',
  type: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M5 7h14M12 7v12M9 19h6"/></svg>'
};

/* ---------- segmentknoppen ---------- */
function paintSeg(el, attr, val) {
  el.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset[attr] === val));
  const on = el.querySelector(`[data-${attr}="${val}"]`), k = el.querySelector('.knob');
  if (on && on.offsetWidth) { k.style.left = on.offsetLeft + 'px'; k.style.width = on.offsetWidth + 'px'; }
}
const modeEls = [...document.querySelectorAll('[data-mode-switch]')];
function buildMode() {
  modeEls.forEach(el => {
    el.innerHTML = `<span class="knob"></span>
      <button data-m="choice" aria-label="${t('choiceL')}">${MODE_ICON.choice}<span class="lbl">${t('choice')}</span></button>
      <button data-m="type" aria-label="${t('typeL')}">${MODE_ICON.type}<span class="lbl">${t('type')}</span></button>`;
    el.querySelectorAll('button').forEach(b => b.onclick = () => setMode(b.dataset.m));
  });
  paintMode();
}
function paintMode() { modeEls.forEach(el => paintSeg(el, 'm', S.mode)); }
function setMode(m) {
  if (S.mode === m) return;
  S.mode = m; save(); paintMode();
  if (Q && !Q.answered) renderAnswer();
}

/* ---------- taal, geluid ---------- */
function applyLang() {
  document.documentElement.lang = S.lang;
  document.title = t('brand');
  document.querySelectorAll('[data-t]').forEach(el => el.textContent = t(el.dataset.t));
  $('lang').textContent = t('langBtn'); $('lang').setAttribute('aria-label', t('langSwitch'));
  $('minus').setAttribute('aria-label', t('less')); $('plus').setAttribute('aria-label', t('more'));
  $('start').setAttribute('aria-label', t('start')); $('quit').setAttribute('aria-label', t('quit'));
  $('swap').setAttribute('aria-label', t('swap')); $('swap').title = t('swap');
  buildMode(); paintSound();
}
$('lang').onclick = () => { S.lang = S.lang === 'nl' ? 'en' : 'nl'; save(); applyLang(); renderHome(); sfx.pop(); };
function paintSound() {
  document.querySelectorAll('[data-sound-toggle]').forEach(b => {
    b.innerHTML = S.sound ? SPK.on : SPK.off;
    b.setAttribute('aria-label', S.sound ? t('soundOff') : t('soundOn'));
  });
}
document.querySelectorAll('[data-sound-toggle]').forEach(b => b.onclick = () => { S.sound = !S.sound; save(); paintSound(); sfx.pop(); });

/* ---------- reeks ---------- */
function paintStreak(anim) {
  const el = $('streak');
  el.innerHTML = FLAME + '<span>' + S.streak + '</span>';
  el.classList.toggle('hot', S.streak > 0);
  el.setAttribute('aria-label', `${t('streak')}: ${S.streak}`);
  if (anim) { el.classList.remove('bump', 'broke'); void el.offsetWidth; el.classList.add(anim); }
}

/* ---------- 3D taart-startknop: vult zich met landen die je al hebt gehad ---------- */
function pieLayer(pressed, frac) {
  const cx = 125, rx = 108, ry = 66, D = pressed ? 8 : 28, cy = 80 + (pressed ? 20 : 0);
  const pt = (a, dy = 0) => [cx + rx * Math.cos(a), cy + dy + ry * Math.sin(a)].map(v => v.toFixed(2)).join(',');
  const segs = [{ v: frac, top: '#2fb35a', side: '#1f8a42' }, { v: 1 - frac, top: '#7fd998', side: '#52b56e' }].filter(s => s.v > 0.0001);
  let a = -Math.PI / 2, tops = '', sides = '', seps = '';
  segs.forEach(s => {
    const a0 = a, a1 = a + s.v * Math.PI * 2; a = a1;
    tops += segs.length === 1
      ? `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${s.top}"/>`
      : `<path d="M${cx},${cy} L${pt(a0)} A${rx},${ry} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${pt(a1)} Z" fill="${s.top}"/>`;
    if (segs.length > 1) seps += `<path d="M${cx},${cy} L${pt(a0)}" stroke="#fff" stroke-opacity=".6" stroke-width="2.5" stroke-linecap="round"/>`;
    const s0 = Math.max(a0, 0), s1 = Math.min(a1, Math.PI);          // alleen de voorkant is zichtbaar
    if (s1 > s0) sides += `<path d="M${pt(s0)} A${rx},${ry} 0 0 1 ${pt(s1)} L${pt(s1, D)} A${rx},${ry} 0 0 0 ${pt(s0, D)} Z" fill="${s.side}"/>`;
  });
  const tri = `<g transform="translate(${cx + 6},${cy}) scale(1,.8)">
      <path d="M-22,-30 Q-22,-38 -14,-34 L30,-6 Q37,0 30,6 L-14,34 Q-22,38 -22,30 Z" fill="#0b5a24" opacity=".25" transform="translate(0,7)"/>
      <path d="M-22,-30 Q-22,-38 -14,-34 L30,-6 Q37,0 30,6 L-14,34 Q-22,38 -22,30 Z" fill="#fff"/></g>`;
  return `<g class="${pressed ? 'st-down' : 'st-up'}">${sides}${tops}${seps}
    <ellipse cx="${cx}" cy="${cy}" rx="${rx - 1}" ry="${ry - 1}" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="2"/>${tri}</g>`;
}
const startBtn = $('start');
function paintPie(frac) {
  startBtn.innerHTML = `<svg viewBox="0 0 250 190" aria-hidden="true"><g class="bob">
    <ellipse cx="125" cy="172" rx="102" ry="12" fill="#000" opacity=".06"/>${pieLayer(false, frac)}${pieLayer(true, frac)}</g></svg>`;
}
const press = on => startBtn.classList.toggle('down', on);
startBtn.addEventListener('pointerdown', () => press(true));
['pointerup', 'pointerleave', 'pointercancel'].forEach(e => startBtn.addEventListener(e, () => press(false)));
startBtn.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') press(true); });
startBtn.addEventListener('keyup', () => press(false));
startBtn.onclick = () => { sfx.pop(); setTimeout(startRound, 90); };

/* ---------- home ---------- */
const STEPS = [5, 10, 15, 20, 25, 30, 40, 50];
function renderHome() {
  $('count').textContent = S.count;
  const seen = C.filter(c => deck()[c.id]).length;
  paintPie(seen / C.length);
  $('seen').innerHTML = t('seen')(seen, C.length);
  paintSeg($('tabs'), 'g', S.game);
  const parts = S.game === 'flag' ? [t('flag'), t('country')] : S.rev ? [t('capital'), t('country')] : [t('country'), t('capital')];
  $('dirtxt').innerHTML = `${esc(parts[0])}${ARROW}${esc(parts[1])}`;
  $('swap').classList.toggle('hide', S.game === 'flag');
  $('swap').classList.toggle('flipped', S.rev);
  $('reset').textContent = t('reset'); $('reset').classList.remove('warn');
  paintMode(); paintSound();
}
$('tabs').querySelectorAll('button').forEach(b => b.onclick = () => { if (S.game !== b.dataset.g) { S.game = b.dataset.g; save(); renderHome(); sfx.pop(); } });
$('swap').onclick = () => { S.rev = !S.rev; save(); renderHome(); sfx.pop(); };
function step(dir) {
  let i = STEPS.indexOf(S.count); if (i < 0) i = 1;
  i = Math.max(0, Math.min(STEPS.length - 1, i + dir)); S.count = STEPS[i]; save(); renderHome(); sfx.pop();
}
$('minus').onclick = () => step(-1);
$('plus').onclick = () => step(1);
let resetArm = null;
$('reset').onclick = () => {
  const b = $('reset');
  if (!resetArm) {
    b.textContent = t('resetSure'); b.classList.add('warn');
    resetArm = setTimeout(() => { resetArm = null; renderHome(); }, 3000); return;
  }
  clearTimeout(resetArm); resetArm = null;
  S.d = { cap: {}, rev: {}, flag: {} }; S.streak = 0; S.best = 0; save(); renderHome();
};

/* ---------- quiz ---------- */
let R = null, Q = null;
const nextBtn = $('next'), stage = $('stage');
function show(id) { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id)); paintMode(); }
function startRound() {
  R = { deck: deckKey(), ids: pickRound(S.count), i: 0, score: 0, misses: [] };
  show('quiz'); paintStreak(); nextQ();
}
const askKey = () => R.deck === 'flag' ? 'askFlag' : R.deck === 'rev' ? 'askRev' : 'askCap';
const answersAreCapitals = () => R.deck === 'cap';

function nextQ() {
  if (R.i >= R.ids.length) return endRound();
  Q = { c: byId[R.ids[R.i]], answered: false };
  $('prog').style.width = (R.i / R.ids.length * 100) + '%';
  $('ask').textContent = t(askKey());
  stage.classList.remove('revealed');
  $('tagslot').innerHTML = '';
  nextBtn.classList.remove('show', 'red'); nextBtn.classList.add('green'); nextBtn.blur();
  renderScene(); renderAnswer();
}
function landSVG(c) {
  const shape = c.ctx !== null
    ? `<path class="ctx" d="${c.ctx}"/><path class="side" d="${c.d}" transform="translate(0,3)"/><path class="top" d="${c.d}"/>
       <circle class="ring" cx="${c.ring[0]}" cy="${c.ring[1]}" r="17"/>`
    : `<path class="side" d="${c.d}" transform="translate(0,6)"/><path class="top" d="${c.d}"/>`;
  return `<svg class="land" viewBox="0 0 200 206" role="img" aria-label="${t('outline')}">${shape}</svg>`;
}
function renderScene() {
  const c = Q.c; let html;
  if (R.deck === 'flag') html = `<div class="actor enter" id="actor"><div class="bigflag"><img alt="" src="${flagURL[c.id]}"></div></div>`;
  else if (R.deck === 'rev') html = `<div class="actor enter" id="actor">${landSVG(c)}</div>
      <div class="sticker city pop">${PIN}<span>${esc(capName(c))}</span></div>`;
  else html = `<div class="actor enter" id="actor">${landSVG(c)}</div>
      <div class="sticker flag pop"><img alt="" src="${flagURL[c.id]}"></div>`;
  $('scene').innerHTML = html;
  $('scene').classList.remove('bad');
}
function label(id) { const c = byId[id]; return answersAreCapitals() ? capName(c) : countryName(c); }
function optionsFor(c) {
  const used = new Set([answersAreCapitals() ? c.capEn : c.id]), pick = [];
  for (const tier of [C.filter(x => x.sub === c.sub), C.filter(x => x.region === c.region), C]) {
    const sh = tier.filter(x => x.id !== c.id).sort(() => Math.random() - .5);
    for (const x of sh) {
      if (pick.length >= 3) break;
      const k = answersAreCapitals() ? x.capEn : x.id;
      if (!used.has(k)) { used.add(k); pick.push(x.id); }
    }
  }
  return [c.id, ...pick].sort(() => Math.random() - .5);
}
function renderAnswer() {
  const box = $('answer');
  if (S.mode === 'choice') {
    Q.opts = Q.opts || optionsFor(Q.c);
    box.innerHTML = `<div class="opts">${Q.opts.map((id, i) => `<button class="key opt" data-i="${i}">${esc(label(id))}</button>`).join('')}</div>`;
    box.querySelectorAll('.opt').forEach(b => b.onclick = () => answerChoice(b));
  } else {
    box.innerHTML = `<div class="typebox"><input id="typed" autocomplete="off" autocorrect="off" autocapitalize="words" spellcheck="false" enterkeyhint="done"
        placeholder="${answersAreCapitals() ? t('phCap') : t('phLand')}" aria-label="${answersAreCapitals() ? t('capital') : t('country')}">
      <button class="key green" id="check" aria-label="${t('check')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button></div>`;
    const inp = $('typed');
    inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (inp.value.trim()) answerTyped(); } };
    $('check').onclick = () => { if (inp.value.trim()) answerTyped(); else inp.focus(); };
    setTimeout(() => inp.focus({ preventScroll: true }), 30);
  }
}
function answerChoice(btn) {
  if (Q.answered) return;
  const ok = Q.opts[+btn.dataset.i] === Q.c.id;
  document.querySelectorAll('.opt').forEach(b => {
    b.disabled = true;
    if (Q.opts[+b.dataset.i] === Q.c.id) b.classList.add('right');
    else if (b === btn) b.classList.add('wrong'); else b.classList.add('dim');
  });
  finish(ok, false);
}

/* typen: accenten, hoofdletters en kleine tikfouten maken niet uit,
   maar een tikfout die net zo dicht bij een ánder land/hoofdstad ligt telt niet (Austria ≠ Australia) */
const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[’'`.,()]/g, '').replace(/[-_]/g, ' ').replace(/\bst\b/g, 'saint').replace(/^(the|de|het) /, '')
  .replace(/\s+/g, ' ').trim();
function lev(a, b) {
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    m[i][j] = Math.min(m[i-1][j] + 1, m[i][j-1] + 1, m[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
  return m[a.length][b.length];
}
function isCorrect(input, c) {
  const field = answersAreCapitals() ? 'alt' : 'names', v = norm(input);
  if (!v) return false;
  let best = Infinity;
  for (const a of c[field]) {
    const n = norm(a); if (n === v) return true;
    if (lev(n, v) <= (n.length <= 4 ? 0 : n.length <= 8 ? 1 : 2)) best = Math.min(best, lev(n, v));
  }
  if (best === Infinity) return false;
  for (const x of C) if (x.id !== c.id) for (const a of x[field]) if (lev(norm(a), v) <= best) return false;
  return true;
}
function answerTyped() {
  if (Q.answered) return;
  const inp = $('typed'), ok = isCorrect(inp.value, Q.c);
  inp.readOnly = true; inp.blur(); inp.classList.add(ok ? 'right' : 'wrong');
  $('check').disabled = true;
  finish(ok, true);
}

function finish(ok, typed) {
  Q.answered = true; const c = Q.c;
  record(c.id, ok, typed);
  if (ok) {
    R.score++; S.streak++; if (S.streak > S.best) S.best = S.streak;
    sfx.good(); if (S.streak % 5 === 0) sfx.streak();
    paintStreak('bump');
  } else {
    R.misses.push(c.id);
    const had = S.streak > 0; S.streak = 0;
    sfx.bad(); paintStreak(had ? 'broke' : null);
    $('scene').classList.add('bad');
  }
  save();
  const actor = $('actor'); actor.classList.remove('enter'); void actor.offsetWidth; actor.classList.add(ok ? 'hop' : 'shake');
  // onthulling: land schuift omhoog, naamkaartje valt erin
  setTimeout(() => stage.classList.add('revealed'), ok ? 250 : 380);
  const nm = R.deck === 'rev'
    ? `<img alt="" src="${flagURL[c.id]}">${esc(countryName(c))}`
    : esc(countryName(c));
  const sub = R.deck === 'rev' ? '' : `<div class="sub">${PIN}${esc(capName(c))}</div>`;
  const colors = ['#4cc76a', '#ffb83a', '#58b7f2', '#ff8fa3', '#4cc76a', '#ffd24a', '#58b7f2', '#9bdc5c'];
  const burst = ok ? colors.map((col, i) => {
    const a = i / colors.length * Math.PI * 2 + .3, r = 70 + (i % 3) * 18;
    return `<i class="burst" style="background:${col};--x:${(Math.cos(a) * r * 1.6).toFixed(0)}px;--y:${(Math.sin(a) * r).toFixed(0)}px"></i>`;
  }).join('') : '';
  $('tagslot').innerHTML = `<div class="tag ${ok ? '' : 'bad'}"><div class="nm">${nm}</div>${sub}</div>${burst}`;
  nextBtn.classList.toggle('green', ok); nextBtn.classList.toggle('red', !ok);
  nextBtn.classList.add('show');
  $('prog').style.width = ((R.i + 1) / R.ids.length * 100) + '%';
  setTimeout(() => nextBtn.focus({ preventScroll: true }), 30);
}
nextBtn.onclick = e => { e.stopPropagation(); goNext(); };
stage.addEventListener('click', () => goNext());
function goNext() { if (Q && Q.answered) { R.i++; nextQ(); } }

function endRound() {
  Q = null; show('end'); sfx.done();
  const n = R.ids.length, pct = R.score / n, w = t('words');
  $('score').innerHTML = `${R.score}<small> / ${n}</small>`;
  $('endword').textContent = pct === 1 ? w[0] : pct >= .7 ? w[1] : w[2];
  $('endstreak').innerHTML = `<span class="chip">${FLAME_ON}${t('streak')} ${S.streak}</span><span class="chip">${FLAME_ON}${t('best')} ${S.best}</span>`;
  $('misses').innerHTML = R.misses.map(id => {
    const c = byId[id];
    const [main, small] = R.deck === 'cap' ? [capName(c), countryName(c)] : [countryName(c), capName(c)];
    return `<div class="miss"><img alt="" src="${flagURL[id]}"><div><b>${esc(main)}</b><span>${esc(small)}</span></div></div>`;
  }).join('');
}
$('again').onclick = () => { sfx.pop(); startRound(); };
$('tohome').onclick = () => { show('home'); renderHome(); };
$('quit').onclick = () => { Q = null; show('home'); renderHome(); };

document.addEventListener('keydown', e => {
  if (!$('quiz').classList.contains('on') || !Q) return;
  if (Q.answered && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); goNext(); return; }
  if (!Q.answered && S.mode === 'choice' && /^[1-4]$/.test(e.key)) document.querySelector(`.opt[data-i="${+e.key - 1}"]`)?.click();
});
window.addEventListener('resize', () => { paintMode(); paintSeg($('tabs'), 'g', S.game); });
document.fonts?.ready.then(() => { paintMode(); paintSeg($('tabs'), 'g', S.game); });
applyLang(); renderHome();

/* ---------- offline / installeerbaar ---------- */
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !location.hostname.endsWith('claude.ai') && !location.hostname.endsWith('claudeusercontent.com')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
})();
