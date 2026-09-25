(() => {
'use strict';
const C = window.COUNTRIES;
const byId = Object.fromEntries(C.map(c => [c.id, c]));
const flagURL = {};
C.forEach(c => flagURL[c.id] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(c.flag));
const $ = id => document.getElementById(id);

/* ---------- opslag (localStorage) ---------- */
const KEY = 'hoofdsteden.v1';
let S = { p: {}, count: 10, mode: 'choice', sound: true, streak: 0, best: 0 };
try { const raw = localStorage.getItem(KEY); if (raw) S = Object.assign(S, JSON.parse(raw)); } catch (e) {}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

/* ---------- geluid (Web Audio, geen bestanden nodig) ---------- */
let AC = null;
function audio() {
  if (!S.sound) return null;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
  } catch (e) { return null; }
  return AC;
}
function tone(ac, freq, t, dur, { type = 'triangle', vol = .22, glide = 0 } = {}) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
}
const sfx = {
  good() { const ac = audio(); if (!ac) return; const t = ac.currentTime;
    tone(ac, 784, t, .13); tone(ac, 1175, t + .09, .22); tone(ac, 2350, t + .09, .12, { type: 'sine', vol: .05 }); },
  bad() { const ac = audio(); if (!ac) return; const t = ac.currentTime;
    tone(ac, 220, t, .16, { vol: .25, glide: 190 }); tone(ac, 165, t + .13, .3, { vol: .25, glide: 120 }); },
  streak() { const ac = audio(); if (!ac) return; const t = ac.currentTime + .2;
    [1047, 1319, 1568, 2093].forEach((f, i) => tone(ac, f, t + i * .07, .16, { vol: .14 })); },
  pop() { const ac = audio(); if (!ac) return; tone(ac, 520, ac.currentTime, .09, { type: 'sine', vol: .18, glide: 900 }); },
  done() { const ac = audio(); if (!ac) return; const t = ac.currentTime;
    [523, 659, 784, 1047].forEach((f, i) => tone(ac, f, t + i * .09, .25, { vol: .16 })); }
};
const SPK = {
  on: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
  off: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>'
};
function paintSound() {
  document.querySelectorAll('[data-sound-toggle]').forEach(b => {
    b.innerHTML = S.sound ? SPK.on : SPK.off;
    b.setAttribute('aria-label', S.sound ? 'Geluid uitzetten' : 'Geluid aanzetten');
    b.setAttribute('aria-pressed', S.sound);
  });
}
document.querySelectorAll('[data-sound-toggle]').forEach(b => b.onclick = () => {
  S.sound = !S.sound; save(); paintSound(); if (S.sound) sfx.pop();
});

/* ---------- leermethode: Leitner / spaced repetition ---------- */
// Niveau 0..5. Fout = terug naar 0. Goed = +1 (meerkeuze telt tot niveau 3, typen tot 5).
const W = [10, 6, 3, 1.4, 0.6, 0.25], W_NEW = 3;
function weight(id) {
  const r = S.p[id]; if (!r) return W_NEW;
  let w = W[r.l];
  if (Date.now() - (r.last || 0) < 3 * 60e3) w *= 0.3;   // net gezien: even minder vaak
  return w;
}
function pickRound(n) {
  const pool = C.map(c => ({ id: c.id, w: weight(c.id) })), out = [];
  n = Math.min(n, pool.length);
  while (out.length < n) {
    const tot = pool.reduce((a, b) => a + b.w, 0); let r = Math.random() * tot, i = 0;
    for (; i < pool.length - 1; i++) { r -= pool[i].w; if (r <= 0) break; }
    out.push(pool[i].id); pool.splice(i, 1);
  }
  return out;
}
function record(id, ok, typed) {
  const r = S.p[id] || (S.p[id] = { l: 0, ok: 0, bad: 0 });
  if (ok) { r.ok++; if (r.l < (typed ? 5 : 3)) r.l++; } else { r.bad++; r.l = 0; }
  r.last = Date.now();
}

/* ---------- reeks (streak) ---------- */
const FLAME = '<svg viewBox="0 0 24 24"><path class="flame" d="M12 2.5c.6 3.2 2.3 4.6 3.8 6.2 1.6 1.7 2.7 3.5 2.7 6A6.5 6.5 0 0 1 12 21.5a6.5 6.5 0 0 1-6.5-6.8c0-2.2 1-3.9 2.3-5.2.2 1.6.9 2.8 2 3.4-.3-3.7.4-7.2 2.2-10.4z"/><path d="M12 13.2c1.6 1.4 2.6 2.5 2.6 4.1a2.6 2.6 0 0 1-5.2 0c0-1.3.9-2.6 2.6-4.1z" fill="#fff" opacity=".7"/></svg>';
function paintStreak(anim) {
  const el = $('streak');
  el.innerHTML = FLAME + '<span>' + S.streak + '</span>';
  el.classList.toggle('hot', S.streak > 0);
  el.setAttribute('aria-label', 'Reeks: ' + S.streak + ' goed op rij');
  if (anim) { el.classList.remove('bump', 'broke'); void el.offsetWidth; el.classList.add(anim); }
}

/* ---------- moduswissel ---------- */
const ICON = {
  choice: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="2.5"/><rect x="13" y="3" width="8" height="8" rx="2.5"/><rect x="3" y="13" width="8" height="8" rx="2.5"/><rect x="13" y="13" width="8" height="8" rx="2.5"/></svg>',
  type: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M5 7h14M12 7v12M9 19h6"/></svg>'
};
document.querySelectorAll('[data-mode-switch]').forEach(el => {
  el.innerHTML = `<span class="knob"></span>
    <button data-m="choice" aria-label="Meerkeuze">${ICON.choice}<span class="lbl">Kies</span></button>
    <button data-m="type" aria-label="Typen">${ICON.type}<span class="lbl">Typ</span></button>`;
  el.querySelectorAll('button').forEach(b => b.onclick = () => setMode(b.dataset.m));
});
function paintMode() {
  document.querySelectorAll('[data-mode-switch]').forEach(el => {
    el.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === S.mode));
    const on = el.querySelector(`[data-m="${S.mode}"]`), k = el.querySelector('.knob');
    if (on.offsetWidth) { k.style.left = on.offsetLeft + 'px'; k.style.width = on.offsetWidth + 'px'; }
  });
}
function setMode(m) {
  if (S.mode === m) return;
  S.mode = m; save(); paintMode();
  if (Q && !Q.answered) renderAnswer();   // direct wisselen, ook midden in een vraag
}

/* ---------- 3D taart-startknop ---------- */
const SLICES = [
  { key: 'm', label: 'Onder de knie', top: '#1c8a45', side: '#12662f' },
  { key: 'g', label: 'Gaat goed',     top: '#33ad5f', side: '#218444' },
  { key: 'l', label: 'Oefenen',       top: '#9bdc5c', side: '#72b43a' },
  { key: 'n', label: 'Nieuw',         top: '#52c972', side: '#319f51' },
];
function stats() {
  const s = { m: 0, g: 0, l: 0, n: 0 };
  C.forEach(c => { const r = S.p[c.id]; if (!r) s.n++; else if (r.l >= 4) s.m++; else if (r.l >= 2) s.g++; else s.l++; });
  return s;
}
function pieLayer(pressed) {
  const cx = 125, rx = 108, ry = 66, D = pressed ? 8 : 28, cy = 80 + (pressed ? 20 : 0);
  const st = stats(), tot = C.length;
  const pt = (a, dy = 0) => [cx + rx * Math.cos(a), cy + dy + ry * Math.sin(a)].map(v => v.toFixed(2)).join(',');
  let a = -Math.PI / 2, tops = '', sides = '', seps = '';
  const segs = SLICES.map(s => ({ ...s, v: st[s.key] })).filter(s => s.v > 0);
  segs.forEach(s => {
    const a0 = a, a1 = a + (s.v / tot) * Math.PI * 2; a = a1;
    tops += segs.length === 1
      ? `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${s.top}"/>`
      : `<path d="M${cx},${cy} L${pt(a0)} A${rx},${ry} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${pt(a1)} Z" fill="${s.top}"/>`;
    if (segs.length > 1) seps += `<path d="M${cx},${cy} L${pt(a0)}" stroke="#fff" stroke-opacity=".55" stroke-width="2.5" stroke-linecap="round"/>`;
    const s0 = Math.max(a0, 0), s1 = Math.min(a1, Math.PI);   // alleen de voorkant is zichtbaar
    if (s1 > s0) sides += `<path d="M${pt(s0)} A${rx},${ry} 0 0 1 ${pt(s1)} L${pt(s1, D)} A${rx},${ry} 0 0 0 ${pt(s0, D)} Z" fill="${s.side}"/>`;
  });
  const tri = `<g transform="translate(${cx + 6},${cy}) scale(1,.8)">
      <path d="M-22,-30 Q-22,-38 -14,-34 L30,-6 Q37,0 30,6 L-14,34 Q-22,38 -22,30 Z" fill="#0b5a24" opacity=".25" transform="translate(0,7)"/>
      <path d="M-22,-30 Q-22,-38 -14,-34 L30,-6 Q37,0 30,6 L-14,34 Q-22,38 -22,30 Z" fill="#fff"/></g>`;
  return `<g class="${pressed ? 'st-down' : 'st-up'}">${sides}${tops}${seps}
    <ellipse cx="${cx}" cy="${cy}" rx="${rx - 1}" ry="${ry - 1}" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="2"/>${tri}</g>`;
}
const startBtn = $('start');
function paintPie() {
  startBtn.innerHTML = `<svg viewBox="0 0 250 190" aria-hidden="true"><g class="bob">
    <ellipse cx="125" cy="172" rx="102" ry="12" fill="#000" opacity=".06"/>${pieLayer(false)}${pieLayer(true)}</g></svg>`;
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
  paintPie(); paintMode(); paintSound();
  const st = stats();
  $('legend').innerHTML = SLICES.map(s => `<span><i style="background:${s.top}"></i>${s.label} ${st[s.key]}</span>`).join('');
  $('best').innerHTML = S.best > 0
    ? `${FLAME.replace('class="flame"', 'fill="#ffb83a"')} Reeks nu ${S.streak} · beste ooit ${S.best}` : '';
}
function step(dir) {
  let i = STEPS.indexOf(S.count); if (i < 0) i = 1;
  i = Math.max(0, Math.min(STEPS.length - 1, i + dir)); S.count = STEPS[i]; save(); renderHome(); sfx.pop();
}
$('minus').onclick = () => step(-1);
$('plus').onclick = () => step(1);
const resetBtn = $('reset'); let resetArm = null;
resetBtn.onclick = () => {
  if (!resetArm) {
    resetBtn.textContent = 'Tik nog eens om alles te wissen'; resetBtn.classList.add('warn');
    resetArm = setTimeout(() => { resetArm = null; resetBtn.textContent = 'Voortgang wissen'; resetBtn.classList.remove('warn'); }, 3000);
    return;
  }
  clearTimeout(resetArm); resetArm = null;
  S.p = {}; S.streak = 0; S.best = 0; save();
  resetBtn.textContent = 'Voortgang wissen'; resetBtn.classList.remove('warn'); renderHome();
};

/* ---------- quiz ---------- */
let R = null, Q = null;
const nextBtn = $('next');
function show(id) { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id)); paintMode(); }
function startRound() {
  R = { ids: pickRound(S.count), i: 0, score: 0, misses: [], bestInRound: 0 };
  show('quiz'); paintStreak(); nextQ();
}
function nextQ() {
  if (R.i >= R.ids.length) return endRound();
  Q = { c: byId[R.ids[R.i]], answered: false };
  $('prog').style.width = (R.i / R.ids.length * 100) + '%';
  const ask = $('ask'); ask.textContent = 'Wat is de hoofdstad?'; ask.classList.remove('named');
  nextBtn.classList.remove('show', 'red'); nextBtn.classList.add('green');
  nextBtn.blur();
  renderStage(); renderAnswer();
}
function renderStage() {
  const c = Q.c, shape = c.ctx !== null
    ? `<path class="ctx" d="${c.ctx}"/><path class="side" d="${c.d}" transform="translate(0,3)"/><path class="top" d="${c.d}"/>
       <circle class="ring" cx="${c.ring[0]}" cy="${c.ring[1]}" r="17"/>`
    : `<path class="side" d="${c.d}" transform="translate(0,6)"/><path class="top" d="${c.d}"/>`;
  $('stage').innerHTML =
    `<svg class="land pop" id="land" viewBox="0 0 200 206" role="img" aria-label="Omtrek van een land">${shape}</svg>
     <div class="flag pop"><img alt="Vlag" src="${flagURL[c.id]}"></div>`;
}
function optionsFor(c) {
  const used = new Set([c.cap]), pick = [];
  for (const t of [C.filter(x => x.sub === c.sub), C.filter(x => x.region === c.region), C]) {
    const sh = t.filter(x => x.id !== c.id).sort(() => Math.random() - .5);
    for (const x of sh) { if (pick.length >= 3) break; if (!used.has(x.cap)) { used.add(x.cap); pick.push(x.cap); } }
  }
  return [c.cap, ...pick].sort(() => Math.random() - .5);
}
function renderAnswer() {
  const box = $('answer');
  if (S.mode === 'choice') {
    Q.opts = Q.opts || optionsFor(Q.c);
    box.innerHTML = `<div class="opts">${Q.opts.map((o, i) => `<button class="key opt" data-i="${i}">${o}</button>`).join('')}</div>`;
    box.querySelectorAll('.opt').forEach(b => b.onclick = () => answerChoice(b));
  } else {
    box.innerHTML = `<div class="typebox"><input id="typed" autocomplete="off" autocorrect="off" autocapitalize="words" spellcheck="false" enterkeyhint="done" placeholder="Typ de hoofdstad" aria-label="Hoofdstad">
      <button class="key green" id="check" aria-label="Controleer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button></div>
      <div class="solution" id="solution"></div>`;
    const inp = $('typed');
    inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (inp.value.trim()) answerTyped(); } };
    $('check').onclick = () => { if (inp.value.trim()) answerTyped(); else inp.focus(); };
    setTimeout(() => inp.focus({ preventScroll: true }), 30);
  }
}
function answerChoice(btn) {
  if (Q.answered) return;
  const ok = Q.opts[+btn.dataset.i] === Q.c.cap;
  document.querySelectorAll('.opt').forEach(b => {
    b.disabled = true;
    if (Q.opts[+b.dataset.i] === Q.c.cap) b.classList.add('right');
    else if (b === btn) b.classList.add('wrong'); else b.classList.add('dim');
  });
  finish(ok, false);
}
const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[’'`.]/g, '').replace(/[-_]/g, ' ').replace(/\bst\b/g, 'saint').replace(/\s+/g, ' ').trim();
function lev(a, b) {
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    m[i][j] = Math.min(m[i-1][j] + 1, m[i][j-1] + 1, m[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
  return m[a.length][b.length];
}
function answerTyped() {
  if (Q.answered) return;
  const inp = $('typed'), v = norm(inp.value);
  let ok = false, near = false;
  for (const a of Q.c.alt) {
    const n = norm(a);
    if (n === v) { ok = true; near = false; break; }
    if (lev(n, v) <= (n.length <= 4 ? 0 : n.length <= 8 ? 1 : 2)) { ok = true; near = true; }
  }
  inp.readOnly = true; inp.blur(); inp.classList.add(ok ? 'right' : 'wrong');
  $('check').disabled = true;
  const sol = $('solution');
  if (!ok || near || norm(inp.value) !== norm(Q.c.cap)) {
    sol.innerHTML = `<small>${ok ? 'Goed:' : 'Juist:'}</small>${Q.c.cap}`;
    sol.classList.add('show');
  }
  finish(ok, true);
}
function finish(ok, typed) {
  Q.answered = true; const c = Q.c;
  record(c.id, ok, typed);
  if (ok) {
    R.score++; S.streak++;
    if (S.streak > S.best) S.best = S.streak;
    R.bestInRound = Math.max(R.bestInRound, S.streak);
    sfx.good(); if (S.streak % 5 === 0) sfx.streak();
    paintStreak('bump');
  } else {
    R.misses.push(c.id);
    const had = S.streak > 0; S.streak = 0;
    sfx.bad(); paintStreak(had ? 'broke' : null);
    $('land').classList.add('bad');
  }
  save();
  const ask = $('ask'); ask.textContent = c.name; ask.classList.add('named');
  nextBtn.classList.toggle('green', ok); nextBtn.classList.toggle('red', !ok);
  nextBtn.classList.add('show');
  $('prog').style.width = ((R.i + 1) / R.ids.length * 100) + '%';
  if (S.mode === 'choice') setTimeout(() => nextBtn.focus({ preventScroll: true }), 30);
}
nextBtn.onclick = () => { if (Q && Q.answered) { R.i++; nextQ(); } };
const esc = s => s.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

function endRound() {
  Q = null; show('end'); sfx.done();
  const n = R.ids.length, pct = R.score / n;
  $('score').innerHTML = `${R.score}<small> / ${n}</small>`;
  $('endmsg').textContent =
    pct === 1 ? 'Foutloos! Deze landen komen voorlopig minder vaak terug.' :
    pct >= .7 ? 'Lekker bezig. Je missers komen snel weer langs.' :
    pct >= .4 ? 'Goede oefenronde. Je missers krijg je vaker te zien.' :
                'Deze waren pittig. Ze komen vaker terug, zo leer je ze vanzelf.';
  const fl = FLAME.replace('class="flame"', 'fill="#ffb83a"');
  $('endstreak').innerHTML = `<span class="chip">${fl}Reeks nu ${S.streak}</span><span class="chip">${fl}Beste ooit ${S.best}</span>`;
  $('misses').innerHTML = R.misses.map(id => { const c = byId[id];
    return `<div class="miss"><img alt="" src="${flagURL[id]}"><div><b>${esc(c.cap)}</b><span>${esc(c.name)}</span></div></div>`; }).join('');
}
$('again').onclick = () => { sfx.pop(); startRound(); };
$('tohome').onclick = () => { show('home'); renderHome(); };
$('quit').onclick = () => { Q = null; show('home'); renderHome(); };

document.addEventListener('keydown', e => {
  if (!$('quiz').classList.contains('on') || !Q) return;
  if (Q.answered && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); nextBtn.click(); return; }
  if (!Q.answered && S.mode === 'choice' && /^[1-4]$/.test(e.key)) document.querySelector(`.opt[data-i="${+e.key - 1}"]`)?.click();
});
window.addEventListener('resize', paintMode);
document.fonts?.ready.then(paintMode);
renderHome();

/* ---------- offline / installeerbaar ---------- */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
})();
