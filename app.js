/* 量词南瓜丰收季 — 一年级华文·量词
 * 玩法：把下面的量词卡「拖」或「点一下卡再点南瓜」送到南瓜上，对了就收割进篮子。
 * 构想来源：陈晓琪老师。
 */
'use strict';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const GAP = /（\s*）/;

function shuffle(a) {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}

/* ───────────── 画面元件 ───────────── */
const emoji = (code, flip) => `<img class="em${flip ? ' flip' : ''}" src="assets/emoji/${code}.svg" alt="" draggable="false">`;
const SIZE = { 1: 1, 2: 0.62, 3: 0.5, 4: 0.46, 5: 0.34 };
function artHTML(art) {
  const s = SIZE[art.length] || 0.34;
  return `<div class="art n${art.length}" style="--s:${s}">${art.map(a => emoji(a.c, a.flip)).join('')}</div>`;
}
const gapSpan = word => `<span class="gap${word ? ' filled' : ''}">${word || '？'}</span>`;
function phraseHTML(it, word) {
  const py = (window.PY && window.PY[it.text]) || [];
  let k = 0;
  const chars = str => [...str].map(ch => {
    let p = py[k++];
    if (p === 'YI') p = it.answer === '片' ? 'yí' : 'yì';
    return p && p !== ch ? `<ruby>${ch}<rt class="py">${p}</rt></ruby>` : ch;
  }).join('');
  const [a, b] = it.text.split(GAP);
  const left = chars(a); k++;           // 跳过空格位
  return left + gapSpan(word) + chars(b);
}

function pumpkinSVG() {
  return `<svg viewBox="0 0 200 170" class="pk-svg" aria-hidden="true">
    <ellipse cx="100" cy="158" rx="78" ry="9" fill="#4A3B34" opacity=".22"/>
    <ellipse cx="100" cy="154" rx="62" ry="5" fill="#4A3B34" opacity=".28"/>
    <ellipse cx="46" cy="96" rx="40" ry="56" fill="url(#pkG2)" stroke="#A94519" stroke-opacity=".5" stroke-width="2"/>
    <ellipse cx="154" cy="96" rx="40" ry="56" fill="url(#pkG2)" stroke="#A94519" stroke-opacity=".5" stroke-width="2"/>
    <ellipse cx="74" cy="96" rx="44" ry="62" fill="url(#pkG)" stroke="#A94519" stroke-opacity=".5" stroke-width="2"/>
    <ellipse cx="126" cy="96" rx="44" ry="62" fill="url(#pkG)" stroke="#A94519" stroke-opacity=".5" stroke-width="2"/>
    <ellipse cx="100" cy="96" rx="36" ry="64" fill="url(#pkG)" stroke="#A94519" stroke-opacity=".45" stroke-width="2"/>
    <ellipse cx="64" cy="64" rx="14" ry="22" fill="#fff" opacity=".16" transform="rotate(-24 64 64)"/>
    <path d="M92 40 C88 24 96 14 110 12 L116 24 C110 27 108 33 110 42 Z" fill="url(#stemG)" stroke="#4F5A24" stroke-width="1.5"/>
    <path d="M114 30 C132 18 150 24 154 38 C140 42 124 40 114 30 Z" fill="url(#leafG)" stroke="#4F7F46" stroke-width="1.5"/>
    <path d="M110 30 C102 22 96 26 98 32 C100 36 105 34 104 30" fill="none" stroke="#6FAE62" stroke-width="2.4" stroke-linecap="round"/>
  </svg>`;
}

/* ───────────── 声音 ───────────── */
function fnv(s) {
  let h = 0x811c9dc5;
  for (const b of new TextEncoder().encode(s)) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
const speechText = t => t.replace(/[‘’]/g, '');
let actx = null;
function ac() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
  if (actx && actx.state === 'suspended') actx.resume();
  return actx;
}
function tone(freqs, dur = 0.12, type = 'sine', vol = 0.18) {
  if (!S.sound) return;
  const c = ac(); if (!c) return;
  const t0 = c.currentTime;
  freqs.forEach((f, i) => {
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0 + i * dur);
    g.gain.setValueAtTime(vol, t0 + i * dur);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + i * dur + dur * 1.8);
    o.connect(g); g.connect(c.destination);
    o.start(t0 + i * dur); o.stop(t0 + i * dur + dur * 1.9);
  });
}
const sfx = {
  pick: () => tone([520], 0.06, 'sine', 0.12),
  ok: () => tone([523, 659, 784], 0.09, 'triangle', 0.2),
  no: () => tone([220, 175], 0.13, 'triangle', 0.16),
  win: () => tone([523, 659, 784, 1047, 1319], 0.11, 'triangle', 0.2),
};
let curAudio = null;
const NOVELTY = /Eddy|Grandma|Grandpa|Flo\b|Reed|Rocko|Sandy|Shelley|Bahh|Bells|Boing|Bubbles|Cellos|Wobble|Zarvox|Trinoids|Whisper|Albert|Fred|Jester|Organ|Superstar|Bad News|Good News|Hysterical|Junior|Kathy|Ralph/i;
function stopSpeak() {
  if (curAudio) { curAudio.pause(); curAudio = null; }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}
function speak(raw) {
  if (!S.sound || !raw) return;
  const text = speechText(raw);
  stopSpeak();
  const key = fnv(text);
  if (window.VOICE_CLIPS && window.VOICE_CLIPS[key]) {
    curAudio = new Audio(`audio/${key}.mp3`);
    curAudio.play().catch(() => {});
    return;
  }
  if (!('speechSynthesis' in window)) return;   // 没有预录音档才退回浏览器朗读
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN'; u.rate = 0.8;
  const v = speechSynthesis.getVoices().find(v => /^zh/i.test(v.lang) && !NOVELTY.test(v.name));
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}

/* ───────────── 状态 ───────────── */
const S = {
  sound: true, pinyin: false, level: 1, items: [], pool: [], round: [],
  harvested: 0, total: 0, stars: 0, review: false, revDone: 0, revTotal: 0,
  firstWrong: [], stats: {}, selected: null, busy: false, pending: 0,
};
const SAY = {
  start1: '看看南瓜上的图，把合适的量词送给它！',
  start2: '读一读句子，选出合适的量词！',
  cheer: ['太棒啦！', '答对了！', '真厉害！', '收割成功！'],
  review: '还有几粒南瓜没有熟，我们再来一次！',
  done1: '小南瓜都收割完啦！',
  done2: '大南瓜也收割完啦，太厉害了！',
};
const cheerAt = () => SAY.cheer[Math.floor(Math.random() * SAY.cheer.length)];

const questionSpeech = it => it.text.replace(GAP, '，什么，');
const fullSpeech = it => it.text.replace(GAP, it.answer);

function voiceLines() {
  const out = new Map();
  const add = t => { const text = speechText(t); out.set(fnv(text), { key: fnv(text), text }); };
  for (const lv of [1, 2]) for (const it of LEVELS[lv].items) { add(questionSpeech(it)); add(fullSpeech(it)); add(it.hint); }
  Object.values(LOOK).forEach(add);
  add(SAY.start1); add(SAY.start2); add(SAY.review); add(SAY.done1); add(SAY.done2);
  SAY.cheer.forEach(add);
  add('再想想哦！');
  return [...out.values()];
}

/* ───────────── 切换画面 ───────────── */
function show(id) {
  $$('.screen').forEach(s => s.classList.toggle('is-active', s.id === id));
  document.body.dataset.screen = id;
  stopSpeak();
}

/* ───────────── 首页 ───────────── */
function renderHome() {
  $('#homeHero').innerHTML = [0, 1, 2].map(i => `<div class="hp hp${i}">${pumpkinSVG()}</div>`).join('');
  $('#guideGrid').innerHTML = GUIDE.map(g => `
    <div class="g-card">
      <div class="g-top"><span class="g-w">${g.w}<small class="py">${PINYIN[g.w]}</small></span><span class="g-art">${g.art.map(c => emoji(c)).join('')}</span></div>
      <p class="g-rule">${g.rule}</p><p class="g-eg">例：${g.eg}</p>
    </div>`).join('');
}

/* ───────────── 开始关卡 ───────────── */
function startLevel(lv) {
  $('#confetti').classList.remove('on'); confettiRun++;
  S.level = lv;
  const cfg = LEVELS[lv];
  S.items = cfg.items.map(it => ({ ...it, wrong: 0, done: false, tried: false }));
  S.pool = shuffle(S.items);              // 乱序：答案不再有规律
  S.total = S.items.length; S.harvested = 0; S.stars = 0;
  S.review = false; S.revDone = 0; S.revTotal = 0; S.firstWrong = [];
  S.selected = null; S.busy = false; S.pending = 0;
  S.stats = Object.fromEntries(QUANTIFIERS.map(q => [q, { total: 0, ok: 0 }]));
  $('#lvBadge').textContent = cfg.name;
  $('#basketCount').textContent = '0';
  renderTray(); updateHud(); show('play');
  setFeedback('');
  nextRound(true);
}

function renderTray() {
  $('#tray').innerHTML = QUANTIFIERS.map(w => `<button class="qcard" data-w="${w}" aria-label="${w}"><span class="qw">${w}</span><span class="py">${PINYIN[w]}</span></button>`).join('');
  $('#stage').classList.remove('armed');
}

function updateHud() {
  const rev = S.review;
  $('#progLabel').textContent = rev ? '回炉重熟' : '收割进度';
  const cur = rev ? S.revDone : S.harvested, tot = rev ? S.revTotal : S.total;
  $('#progText').textContent = `${cur} / ${tot}`;
  $('#progFill').style.width = (tot ? cur / tot * 100 : 0) + '%';
  $('#starCount').textContent = S.stars;
}

function setFeedback(html, kind = '') {
  const f = $('#feedback');
  f.className = 'feedback ' + kind;
  f.innerHTML = html;
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('on'), 1700);
}

/* ───────────── 出题 ───────────── */
async function nextRound(first = false) {
  if (S.pool.length === 0) {
    if (!S.review && S.firstWrong.length) {
      S.review = true;
      S.pool = shuffle(S.firstWrong); S.firstWrong = [];
      S.revTotal = S.pool.length; S.revDone = 0;
      S.pool.forEach(it => { it.done = false; it.wrong = 0; });
      updateHud();
      toast(`🌱 有 ${S.revTotal} 粒南瓜还没熟，再来一次！`);
      speak(SAY.review);
      await sleep(1900);
    } else { return finish(); }
  }
  const per = LEVELS[S.level].perRound;
  S.round = S.pool.splice(0, per);
  renderStage();
  const hint = S.level === 1 ? '点一下南瓜，听听题目；再把量词送给它。' : '读一读句子，把量词送进空格里。';
  setFeedback(hint, 'tip');
  if (first) speak(S.level === 1 ? SAY.start1 : SAY.start2);
  else if (S.level === 2) setTimeout(() => speak(questionSpeech(S.round[0])), 350);
}

function renderStage() {
  const st = $('#stage');
  if (S.level === 1) {
    st.className = 'lv1';
    st.innerHTML = `<div class="patch">${S.round.map((it, i) => `
      <button class="pumpkin" data-drop data-i="${i}" aria-label="${it.text.replace(GAP, '什么')}">
        ${pumpkinSVG()}
        <span class="pk-art">${artHTML(it.art)}</span>
        <span class="pk-tag">${phraseHTML(it)}</span>
      </button>`).join('')}</div>`;
  } else {
    st.className = 'lv2';
    const it = S.round[0];
    const dots = S.items.map(x => `<i class="${x.done ? 'on' : ''}${x === it ? ' cur' : ''}"></i>`).join('');
    st.innerHTML = `
      <div class="dots" aria-hidden="true">${dots}</div>
      <div class="sentence" data-i="0">
        <div class="s-art">${artHTML(it.art)}</div>
        <p class="s-text" data-drop>${phraseHTML(it)}</p>
        <button class="speak" id="btnSpeak" aria-label="读句子">🔊 读句子</button>
      </div>`;
  }
}

/* ───────────── 选择与拖放 ───────────── */
function select(w) {
  S.selected = (S.selected === w) ? null : w;
  $$('.qcard').forEach(c => c.classList.toggle('sel', c.dataset.w === S.selected));
  $('#stage').classList.toggle('armed', !!S.selected);
  if (S.selected) { sfx.pick(); setFeedback(`选了「${S.selected}」，现在点一粒南瓜吧！`.replace('一粒南瓜', S.level === 1 ? '一粒南瓜' : '句子里的空格'), 'tip'); }
}

let drag = null;
function initInput() {
  const tray = $('#tray');
  tray.addEventListener('pointerdown', e => {
    const c = e.target.closest('.qcard');
    if (!c || S.busy) return;
    ac();
    drag = { c, id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, ghost: null };
    c.setPointerCapture(e.pointerId);
  });
  tray.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 10) {
      drag.moved = true;
      const g = drag.c.cloneNode(true);
      g.className = 'qcard ghost';
      document.body.appendChild(g);
      drag.ghost = g;
      drag.c.classList.add('lifted');
      $('#stage').classList.add('armed');
    }
    if (drag.moved) {
      drag.ghost.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -60%) scale(1.15) rotate(-4deg)`;
      const over = dropTargetAt(e.clientX, e.clientY);
      $$('[data-drop].hover').forEach(el => el !== over && el.classList.remove('hover'));
      if (over) over.classList.add('hover');
    }
  });
  const end = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    $$('[data-drop].hover').forEach(el => el.classList.remove('hover'));
    d.c.classList.remove('lifted');
    if (d.moved) {
      d.ghost.remove();
      const target = dropTargetAt(e.clientX, e.clientY);
      $('#stage').classList.toggle('armed', !!S.selected);
      if (target && e.type === 'pointerup') attempt(target, d.c.dataset.w);
    } else if (e.type === 'pointerup') {
      select(d.c.dataset.w);
    }
  };
  tray.addEventListener('pointerup', end);
  tray.addEventListener('pointercancel', end);

  $('#stage').addEventListener('click', e => {
    if (e.target.closest('#btnSpeak')) { speak(questionSpeech(S.round[0])); return; }
    const t = e.target.closest('[data-drop]');
    if (!t || S.busy) return;
    ac();
    if (S.selected) { const w = S.selected; attempt(t, w); }
    else speak(questionSpeech(itemOf(t)));
  });
}
function dropTargetAt(x, y) {
  const el = document.elementFromPoint(x, y);
  const t = el && el.closest('[data-drop]');
  if (!t) return null;
  const it = itemOf(t);
  return it && !it.done ? t : null;
}
function itemOf(el) {
  const holder = el.closest('[data-i]');
  return holder ? S.round[+holder.dataset.i] : null;
}

/* ───────────── 判断 ───────────── */
async function attempt(target, word) {
  const it = itemOf(target);
  if (!it || it.done || S.busy) return;
  const st = S.stats[it.answer];
  if (!it.tried) { it.tried = true; if (!S.review) { st.total++; if (word === it.answer) st.ok++; } }

  if (word === it.answer) {
    S.pending++; if (S.level === 2) S.busy = true;
    it.done = true;
    const pts = S.review ? 1 : it.wrong === 0 ? 3 : it.wrong === 1 ? 2 : 1;
    S.stars += pts;
    if (S.review) S.revDone++; else S.harvested++;
    S.selected = null;
    $$('.qcard').forEach(c => c.classList.remove('sel'));
    $('#stage').classList.remove('armed');
    sfx.ok();
    setFeedback(`${'⭐'.repeat(pts)} ${cheerAt()}　${fullSpeech(it).replace(/，/g, '')}`, 'good');
    await harvest(target, it);
    updateHud();
    speak(fullSpeech(it));
    $('#basketCount').textContent = S.harvested + S.revDone;
    await sleep(S.level === 1 ? 250 : 1700);
    S.busy = false; S.pending--;
    if (S.pending === 0 && S.round.every(x => x.done)) nextRound();
  } else {
    it.wrong++;
    if (it.wrong === 1 && !S.review && !S.firstWrong.includes(it)) S.firstWrong.push(it);
    sfx.no();
    target.classList.remove('shake'); void target.offsetWidth; target.classList.add('shake');
    S.selected = null;
    $$('.qcard').forEach(c => c.classList.remove('sel'));
    $('#stage').classList.remove('armed');
    if (it.wrong === 1) { setFeedback(`💡 再想想哦！${LOOK[it.answer]}`, 'try'); speak(LOOK[it.answer]); }
    else {
      setFeedback(`💡 ${it.hint}`, 'try'); speak(it.hint);
      if (it.wrong >= 3) $$('.qcard').forEach(c => c.classList.toggle('glow', c.dataset.w === it.answer));
    }
    updateHud();
  }
}

async function harvest(target, it) {
  $$('.qcard.glow').forEach(c => c.classList.remove('glow'));
  const tag = target.querySelector('.pk-tag, .s-text');
  if (tag) tag.innerHTML = phraseHTML(it, it.answer);
  target.classList.add('picked');
  await sleep(REDUCED ? 100 : 520);
  if (S.level === 1) {
    const b = $('#basket').getBoundingClientRect(), r = target.getBoundingClientRect();
    if (!REDUCED) {
      const fly = document.createElement('div');
      fly.className = 'fly'; fly.innerHTML = pumpkinSVG();
      fly.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px`;
      document.body.appendChild(fly);
      const dx = b.left + b.width / 2 - (r.left + r.width / 2), dy = b.top + b.height / 2 - (r.top + r.height / 2);
      fly.animate([
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5 - 60}px)) scale(.7)`, opacity: 1, offset: 0.5 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.25)`, opacity: 0.9 },
      ], { duration: 650, easing: 'cubic-bezier(.3,.6,.3,1)' }).finished.then(() => fly.remove());
      target.classList.add('gone');
      await sleep(520);
      $('#basket').classList.remove('pop'); void $('#basket').offsetWidth; $('#basket').classList.add('pop');
    }
    target.disabled = true;
    target.removeAttribute('data-drop');
    target.classList.add('sprout');
    target.innerHTML = `<span class="sp">${emoji('1f331')}<small>已收割</small></span>`;
  } else {
    const dots = $$('.dots i'); const cur = dots.find(d => d.classList.contains('cur'));
    if (cur) cur.classList.add('on');
  }
}

/* ───────────── 结算 ───────────── */
function finish() {
  sfx.win(); confetti(); speak(S.level === 1 ? SAY.done1 : SAY.done2);
  const cfg = LEVELS[S.level];
  const first = Object.values(S.stats).reduce((a, s) => a + s.ok, 0);
  $('#resTitle').textContent = S.level === 1 ? '🎉 小南瓜丰收啦！' : '🏆 大南瓜丰收啦！';
  $('#resMsg').textContent = `一次就答对 ${first} / ${S.total} 题`;
  $('#resStars').textContent = S.stars;
  $('#resBars').innerHTML = QUANTIFIERS.filter(q => S.stats[q].total).map(q => {
    const s = S.stats[q], pct = Math.round(s.ok / s.total * 100);
    return `<div class="bar-row"><b>${q}</b><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div><span>${s.ok}/${s.total}</span></div>`;
  }).join('');
  const weak = QUANTIFIERS.filter(q => S.stats[q].total).map(q => ({ q, miss: S.stats[q].total - S.stats[q].ok })).sort((a, b) => b.miss - a.miss)[0];
  $('#resWeak').textContent = weak && weak.miss > 0 ? `「${weak.q}」还要多练习一下哦！去翻翻量词宝典吧。` : '六个量词都一次答对，太棒了！';
  $('#resultPumpkins').innerHTML = [0, 1, 2].map(i => `<div class="hp hp${i}">${pumpkinSVG()}</div>`).join('');
  const next = $('#resNext');
  if (S.level === 1) { next.innerHTML = '<b>🚀 去关卡二：大南瓜王国</b>'; next.onclick = () => startLevel(2); }
  else { next.innerHTML = '<b>🔄 再收割一遍关卡一</b>'; next.onclick = () => startLevel(1); }
  $('#resAgain').onclick = () => startLevel(S.level);
  $('#resHome').onclick = () => show('home');
  show('result');
}

let confettiRun = 0;
function confetti() {
  if (REDUCED) return;
  const run = ++confettiRun;
  const cv = $('#confetti'), ctx = cv.getContext('2d');
  cv.width = innerWidth; cv.height = innerHeight; cv.classList.add('on');
  const cols = ['#E8803A', '#E3A63C', '#6FAE62', '#9B87C4', '#E8654C'];
  const ps = Array.from({ length: 120 }, () => ({
    x: Math.random() * cv.width, y: -Math.random() * cv.height * 0.6, s: 6 + Math.random() * 8,
    c: cols[Math.floor(Math.random() * cols.length)], vy: 2 + Math.random() * 3, vx: Math.random() * 2 - 1, r: Math.random() * 6,
  }));
  (function loop() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    let alive = false;
    ps.forEach(p => {
      p.y += p.vy; p.x += p.vx; p.r += 0.1;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6); ctx.restore();
      if (p.y < cv.height) alive = true;
    });
    if (alive && run === confettiRun) requestAnimationFrame(loop); else cv.classList.remove('on');
  })();
}

/* ───────────── 杂项按钮 ───────────── */
function setToggle(btn, on) { btn.setAttribute('aria-pressed', on); btn.classList.toggle('off', !on); }
function init() {
  renderHome();
  initInput();
  $$('[data-start]').forEach(b => b.addEventListener('click', () => { ac(); startLevel(+b.dataset.start); }));
  $('#btnHome').onclick = () => show('home');
  const openG = () => { $('#guideModal').hidden = false; };
  const closeG = () => { $('#guideModal').hidden = true; };
  $('#openGuide').onclick = openG; $('#btnGuide').onclick = openG;
  $('#closeGuide').onclick = closeG; $('#closeGuide2').onclick = closeG;
  $('#guideModal').addEventListener('click', e => { if (e.target.id === 'guideModal') closeG(); });
  $('#btnSound').onclick = () => {
    S.sound = !S.sound; $('#btnSound').textContent = S.sound ? '🔊' : '🔇';
    setToggle($('#btnSound'), S.sound); if (!S.sound) stopSpeak();
  };
  $('#btnPinyin').onclick = () => {
    S.pinyin = !S.pinyin; document.body.classList.toggle('show-py', S.pinyin); setToggle($('#btnPinyin'), S.pinyin);
  };
  setToggle($('#btnPinyin'), false);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopSpeak(); });
}
init();

window.__liangci = { S, LEVELS, startLevel, attempt, voiceLines, select, nextRound };
