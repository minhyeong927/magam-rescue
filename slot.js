/* 잭팟 슬롯: 릴·전구·코인 연출만 담당합니다. 할 일 선택은 script.js의 기존 엔진이 정합니다. */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, q) => a + (b - a) * q;
  const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  const SANS = '"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",system-ui,sans-serif';
  const SERIF = '"Noto Serif KR","AppleMyungjo","Batang",Georgia,serif';
  // 기계 하나의 설계 좌표: 캐비닛 중심이 x=0, 오른쪽 레버까지 포함해 가로 -290~350.
  const MW = 640, MH = 610, MID = 30;
  const N = 6;           // 릴 한 바퀴의 그림 수
  const CELL = 110;      // 그림 하나의 높이
  const REEL_Y = 342;    // 당첨선 높이
  const TS = .12, STOPS = [.44, .56, .68];

  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function lin(c, x0, y0, x1, y1, stops) {
    const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g;
  }
  function rad(c, x, y, r0, r1, stops) {
    const g = c.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g;
  }
  const brass = (c, x0, y0, x1, y1) => lin(c, x0, y0, x1, y1, [[0, '#63594b'], [.22, '#b6a489'], [.42, '#e8dcc5'], [.62, '#998972'], [1, '#5e5344']]);
  const chrome = (c, x0, y0, x1, y1) => lin(c, x0, y0, x1, y1, [[0, '#5b5b58'], [.2, '#f3f1ea'], [.45, '#9c9a93'], [.7, '#fbfaf4'], [1, '#62615c']]);

  /* ---------- 릴 그림 (직접 그린 오리지널 도안): 체리·레몬·포도·수박·종·7 ---------- */
  const OUT = '#2b1410';
  function outline(c, w, col) { c.strokeStyle = col || OUT; c.lineWidth = w; c.stroke(); }
  function leaf(c, x, y, rx, ry, rot) {
    c.fillStyle = lin(c, x - rx, y, x + rx, y, [[0, '#2f7a3b'], [1, '#5aa854']]); c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); c.fill(); outline(c, 3.5, '#1c4a26');
    c.strokeStyle = '#1c4a2688'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - rx * Math.cos(rot) * .8, y - rx * Math.sin(rot) * .8); c.lineTo(x + rx * Math.cos(rot) * .8, y + rx * Math.sin(rot) * .8); c.stroke();
  }
  const SEVEN = 5;
  const SYMBOLS = [
    c => { // 체리
      c.strokeStyle = '#2f6a3a'; c.lineWidth = 6; c.beginPath(); c.moveTo(-26, 22); c.quadraticCurveTo(-18, -34, 8, -56); c.moveTo(30, 30); c.quadraticCurveTo(24, -26, 8, -56); c.stroke();
      leaf(c, 30, -52, 26, 11, -.35);
      [[-28, 36, 28], [30, 42, 27]].forEach(([x, y, r]) => {
        c.fillStyle = rad(c, x - 9, y - 10, 2, r + 4, [[0, '#f2766a'], [.5, '#c0262e'], [1, '#6d0e18']]); c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
        outline(c, 4, '#4b0911'); c.fillStyle = '#fff3'; c.beginPath(); c.ellipse(x - 9, y - 11, 6, 9, .5, 0, TAU); c.fill();
      });
    },
    c => { // 레몬
      c.save(); c.rotate(-.4);
      c.beginPath(); c.moveTo(-74, 0); c.quadraticCurveTo(-68, -10, -58, -22); c.bezierCurveTo(-34, -54, 34, -54, 58, -22); c.quadraticCurveTo(68, -10, 74, 0);
      c.quadraticCurveTo(68, 10, 58, 22); c.bezierCurveTo(34, 54, -34, 54, -58, 22); c.quadraticCurveTo(-68, 10, -74, 0); c.closePath();
      c.fillStyle = rad(c, -14, -18, 4, 84, [[0, '#fff6a8'], [.45, '#f4c931'], [1, '#b6830f']]); c.fill(); outline(c, 5.5, '#4e3706');
      c.fillStyle = '#fff9'; c.beginPath(); c.ellipse(-16, -24, 22, 7, -.15, 0, TAU); c.fill();
      c.fillStyle = '#b6830f66'; [[-30, 10], [10, 18], [34, -2], [-6, -2], [46, 16], [-48, 2]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 2, 0, TAU); c.fill(); });
      c.restore(); leaf(c, 36, -48, 25, 10, -.5);
    },
    c => { // 포도
      c.strokeStyle = '#5a3a1c'; c.lineWidth = 6; c.beginPath(); c.moveTo(2, -30); c.quadraticCurveTo(0, -52, 14, -64); c.stroke();
      leaf(c, 38, -60, 26, 11, -.3);
      [[-32, -8], [0, -12], [32, -8], [-16, 16], [16, 16], [0, 42]].forEach(([x, y]) => {
        c.fillStyle = rad(c, x - 6, y - 7, 2, 24, [[0, '#d7a8f0'], [.45, '#8a45b8'], [1, '#3d1860']]); c.beginPath(); c.arc(x, y, 20, 0, TAU); c.fill(); outline(c, 3.5, '#2a0f45');
        c.fillStyle = '#fff7'; c.beginPath(); c.ellipse(x - 7, y - 8, 5, 3.5, -.6, 0, TAU); c.fill();
      });
    },
    c => { // 수박
      const cy = -30, R = 74;
      c.beginPath(); c.moveTo(-R, cy); c.arc(0, cy, R, Math.PI, 0, true); c.closePath();
      c.fillStyle = lin(c, 0, cy, 0, cy + R, [[0, '#4aa04b'], [1, '#1f5f2c']]); c.fill(); outline(c, 6, '#173f1f');
      c.beginPath(); c.moveTo(-R + 9, cy); c.arc(0, cy, R - 9, Math.PI, 0, true); c.closePath(); c.fillStyle = '#eef0c8'; c.fill();
      c.beginPath(); c.moveTo(-R + 17, cy); c.arc(0, cy, R - 17, Math.PI, 0, true); c.closePath();
      c.fillStyle = rad(c, 0, cy, 4, R, [[0, '#ff8a7a'], [.55, '#e8344a'], [1, '#b3182f']]); c.fill();
      c.fillStyle = '#20100d'; [[-36, -4, .5], [-12, 14, .2], [14, -6, -.2], [30, 8, -.5], [-8, -16, .1]].forEach(([x, y, r]) => { c.beginPath(); c.ellipse(x, y, 4.5, 8, r, 0, TAU); c.fill(); });
      c.strokeStyle = '#ffffff55'; c.lineWidth = 5; c.beginPath(); c.arc(0, cy, R - 3, Math.PI * .66, Math.PI * .86); c.stroke();
    },
    c => { // 종
      c.beginPath(); c.moveTo(-50, 38); c.bezierCurveTo(-50, -8, -42, -56, 0, -58); c.bezierCurveTo(42, -56, 50, -8, 50, 38);
      c.lineTo(68, 54); c.lineTo(-68, 54); c.closePath();
      c.fillStyle = brass(c, -60, -50, 60, 50); c.fill(); c.strokeStyle = '#3d2a10'; c.lineWidth = 6; c.stroke();
      c.strokeStyle = '#fff3c8aa'; c.lineWidth = 7; c.beginPath(); c.moveTo(-30, 28); c.bezierCurveTo(-30, -8, -26, -36, -8, -44); c.stroke();
      c.fillStyle = '#5a3d14'; c.beginPath(); c.arc(0, 66, 13, 0, TAU); c.fill(); c.strokeStyle = '#3d2a10'; c.lineWidth = 4; c.stroke();
      c.beginPath(); c.arc(0, -66, 8, 0, TAU); c.fillStyle = '#c99c46'; c.fill(); c.stroke();
    },
    c => { // 7
      c.font = `900 188px ${SERIF}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 16; c.strokeStyle = '#2a0b0c'; c.strokeText('7', 0, 10);
      c.fillStyle = lin(c, 0, -70, 0, 84, [[0, '#f1655a'], [.5, '#b81f2b'], [1, '#6d0f19']]); c.fillText('7', 0, 10);
      c.lineWidth = 3; c.strokeStyle = '#ffcfa655'; c.strokeText('7', -2, 7);
    }
  ];
  function drawStar(c) { // 마퀴 장식으로만 쓰는 마감구조대 별
    for (let k = 0; k < 8; k++) {
      c.save(); c.rotate(k * Math.PI / 4);
      c.strokeStyle = '#7d1320'; c.lineWidth = 25; c.beginPath(); c.moveTo(0, -8); c.lineTo(0, -76); c.stroke();
      c.strokeStyle = '#c7303c'; c.lineWidth = 15; c.beginPath(); c.moveTo(0, -10); c.lineTo(0, -70); c.stroke();
      c.strokeStyle = '#ee7a6e'; c.lineWidth = 4; c.beginPath(); c.moveTo(-3, -18); c.lineTo(-3, -62); c.stroke(); c.restore();
    }
    c.fillStyle = brass(c, -22, -22, 22, 22); c.beginPath(); c.arc(0, 0, 20, 0, TAU); c.fill();
    c.strokeStyle = '#4a300c'; c.lineWidth = 4; c.stroke();
    c.fillStyle = '#7d1320'; c.beginPath(); c.arc(0, 0, 8, 0, TAU); c.fill();
  }
  let sprites = null;
  function getSprites() {
    if (sprites) return sprites;
    const make = fn => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 240;
      const c = cv.getContext('2d'); c.translate(120, 120); c.scale(1.4, 1.4); c.lineJoin = 'round'; c.lineCap = 'round'; fn(c); return cv;
    };
    sprites = { reel: SYMBOLS.map(make), star: make(drawStar) };
    return sprites;
  }

  /* ---------- 전구 위치: 둥근 사각 둘레를 따라 일정 간격으로 ---------- */
  function ringPoints(x, y, w, h, r, n) {
    const sw = w - 2 * r, sh = h - 2 * r, arc = Math.PI * r / 2, total = 2 * sw + 2 * sh + 4 * arc, out = [];
    const segs = [
      [sw, d => [x + r + d, y]], [arc, d => { const a = -Math.PI / 2 + d / r; return [x + w - r + Math.cos(a) * r, y + r + Math.sin(a) * r]; }],
      [sh, d => [x + w, y + r + d]], [arc, d => { const a = d / r; return [x + w - r + Math.cos(a) * r, y + h - r + Math.sin(a) * r]; }],
      [sw, d => [x + w - r - d, y + h]], [arc, d => { const a = Math.PI / 2 + d / r; return [x + r + Math.cos(a) * r, y + h - r + Math.sin(a) * r]; }],
      [sh, d => [x, y + h - r - d]], [arc, d => { const a = Math.PI + d / r; return [x + r + Math.cos(a) * r, y + r + Math.sin(a) * r]; }]
    ];
    for (let i = 0; i < n; i++) {
      let d = i / n * total;
      for (const [len, fn] of segs) { if (d <= len) { out.push(fn(d)); break; } d -= len; }
    }
    return out;
  }
  const BULBS = ringPoints(-232, 30, 464, 88, 40, 26);

  function bodyPath(inset) {
    const p = new Path2D(), l = -280 + inset, r = 280 - inset, t = inset, b = 596 - inset;
    p.moveTo(l, b); p.lineTo(l, 78); p.quadraticCurveTo(l, t, l + 80 - inset * .4, t); p.lineTo(r - 80 + inset * .4, t); p.quadraticCurveTo(r, t, r, 78); p.lineTo(r, b); p.closePath();
    return p;
  }

  window.playSlotReveal = function ({ titles, winner, duration = 3500, sound, reduced, onReady }) {
    const dialog = document.getElementById('orbit-dialog');
    const canvas = document.getElementById('orbit-canvas'), c = canvas.getContext('2d');
    const phaseEl = document.getElementById('orbit-phase'), telemetry = document.getElementById('orbit-coordinates');
    const list = (titles && titles.length ? titles : ['지금 할 일']).slice();
    const prize = winner || list[0];
    let lastMeasure = -1, w = 0, h = 0, raf = null, stopped = false, ready = false, audio = null, phase = -1, lastNow = 0, coinTick = 0, ledTile = null;
    const start = performance.now();
    const seed = Math.random() * 1000, rnd = i => { const x = Math.sin(i * 127.1 + seed) * 43758.5453; return x - Math.floor(x); };
    const SP = getSprites().reel;

    const target = Math.floor(rnd(9) * SEVEN); // 이번에 맞출 그림: 7은 제외한 과일·종 중 하나
    const reels = [0, 1, 2].map(k => {
      const p0 = Math.floor(rnd(k + 5) * N), D = N * (3 + k * 1) + ((target - p0 % N + N) % N);
      return { p0, D, ts: TS + k * .012, te: STOPS[k], p: p0, spd: 0, lastIdx: p0, stopped: false };
    });

    /* ----- 소리: 선택 사항, 기본은 꺼짐 ----- */
    if (sound && !reduced) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); audio.resume().catch(() => {}); } catch (_) { audio = null; } }
    function tone(freq, len, vol = .04, type = 'sine', delay = 0, drop = .45) {
      if (!audio || audio.state === 'closed') return;
      try {
        const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime + delay;
        o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * drop), t + len);
        g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + len);
        o.connect(g); g.connect(audio.destination); o.start(t); o.stop(t + len + .02);
      } catch (_) { /* 소리가 없어도 연출은 그대로 재생됩니다. */ }
    }

    const captions = ['레버를 당기는 중', '릴이 돌아가는 중', '마지막 릴이 멈추는 중', '딱 하나, 정해졌어요.'];
    function setPhase(n) {
      if (n === phase) return; phase = n; dialog.dataset.phase = String(n); phaseEl.textContent = captions[n];
      if (n === 0) tone(90, .16, .05, 'triangle');
      if (n === 3) [660, 880].forEach((f, i) => tone(f, .22, .025, 'sine', i * .07, .8));
    }

    function makeLed() {
      const cv = document.createElement('canvas'); cv.width = cv.height = 4; const g = cv.getContext('2d');
      g.fillStyle = 'rgba(8,3,2,.62)'; g.fillRect(3, 0, 1, 4); g.fillRect(0, 3, 4, 1); return c.createPattern(cv, 'repeat');
    }

    function resize() {
      w = canvas.clientWidth; h = canvas.clientHeight;
      const d = Math.min(devicePixelRatio || 1, 1.7); canvas.width = Math.round(w * d); canvas.height = Math.round(h * d);
      if (c) { c.setTransform(d, 0, 0, d, 0, 0); ledTile = makeLed(); }
      measureTicket(); if (ready && stopped === false && raf === null) draw(performance.now());
    }

    /* ----- 릴 위치: 가속 → 등속 → 감속 → 멈춤의 떨림 ----- */
    function reelAt(r, t) {
      if (t <= r.ts) return r.p0;
      const u = clamp((t - r.ts) / (r.te - r.ts)); let g;
      if (u < .12) g = u * u / (2 * .12);
      else if (u < .62) g = .06 + (u - .12);
      else { const v = (u - .62) / .38; g = .56 + .38 * (.5 * v + .5 * Math.sin(Math.PI * v) / Math.PI); }
      let p = r.p0 + r.D * g / .75;
      if (t > r.te) { const e = t - r.te; p += .1 * Math.exp(-e * 46) * Math.sin(e * 125); }
      return p;
    }

    /* ----- 그리기 ----- */
    let ticketH = 330, lastTop = '';
    function measureTicket() { const el = dialog.querySelector('.orbit-result'); if (el && el.offsetHeight) ticketH = el.offsetHeight; }
    function layout(t) {
      if (h < 560 && w >= 700) { // 낮고 넓은 화면: 기계는 왼쪽, 티켓은 오른쪽
        const s0 = Math.min((h - 150) / MH, w * .42 / MW, 1.3), q0 = smooth((t - .76) / .16), cx = lerp(w / 2, w * .27, q0);
        return { s: s0, x: cx - MID * s0, y: Math.max(76, (h - MH * s0) / 2 + 10), q: q0, ticketTop: Math.round(h * .52) };
      }
      const sSpin = Math.min(w * .94 / MW, (h - 220) / MH, 1.3);
      const sWin = Math.max(.2, Math.min(sSpin, (h - 84 - 14 - ticketH - 64) / MH));
      const q = smooth((t - .76) / .16), s = lerp(sSpin, sWin, q);
      const top = lerp(Math.max(84, (h - MH * sSpin) / 2 + 8), 84, q);
      return { s, x: w / 2 - MID * s, y: top, q, ticketTop: Math.round(84 + MH * sWin + 14 + ticketH / 2) };
    }
    function background(t, L, glow) {
      c.fillStyle = '#171315'; c.fillRect(0, 0, w, h);
      const cx = w / 2, cy = L.y + MH * L.s * .42;
      c.fillStyle = rad(c, cx, cy, 0, Math.max(w, h) * .7,
        [[0, '#39252a'], [.5, '#21191d'], [1, '#121113']]);
      c.fillRect(0, 0, w, h);
    }
    function bulb(x, y, on, boost) {
      c.fillStyle = '#1a0d08'; c.beginPath(); c.arc(x, y, 8.5, 0, TAU); c.fill();
      if (on && boost > .1) { c.fillStyle = rad(c, x, y, 0, 24, [[0, `rgba(255,190,80,${.5 + boost * .2})`], [1, 'rgba(255,150,40,0)']]); c.beginPath(); c.arc(x, y, 24, 0, TAU); c.fill(); }
      c.fillStyle = on ? rad(c, x - 1.5, y - 1.5, .5, 7.5, [[0, '#fffbe2'], [.35, '#ffd56a'], [1, '#e08a1c']]) : rad(c, x - 1.5, y - 1.5, .5, 7.5, [[0, '#9b7a54'], [1, '#4a3322']]);
      c.beginPath(); c.arc(x, y, 6.6, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.ellipse(x - 2, y - 2.4, 1.8, 1.1, -.6, 0, TAU); c.fill();
    }
    function fitText(text, maxW, size, min) {
      c.font = `700 ${size}px ${SANS}`;
      while (c.measureText(text).width > maxW && size > min) { size -= 1; c.font = `700 ${size}px ${SANS}`; }
      if (c.measureText(text).width > maxW) { let s = text; while (s.length > 2 && c.measureText(s + '…').width > maxW) s = s.slice(0, -1); return s + '…'; }
      return text;
    }

    function machine(t, time, st) {
      /* 그림자와 본체 */
      c.fillStyle = 'rgba(0,0,0,.5)'; c.beginPath(); c.ellipse(20, 606, 340, 20, 0, 0, TAU); c.fill();
      const body = bodyPath(0);
      c.fillStyle = lin(c, -280, 0, 280, 0, [[0, '#1d0408'], [.12, '#4b0d15'], [.32, '#6c1620'], [.62, '#4a0d15'], [.9, '#2a060b'], [1, '#170306']]); c.fill(body);
      c.fillStyle = lin(c, 0, 0, 0, 600, [[0, 'rgba(255,230,200,.13)'], [.22, 'rgba(255,255,255,0)'], [.78, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.42)']]); c.fill(body);
      c.lineJoin = 'round'; c.lineWidth = 8; c.strokeStyle = brass(c, -280, 0, 280, 600); c.stroke(body);
      c.lineWidth = 1.6; c.strokeStyle = 'rgba(255,238,190,.6)'; c.stroke(bodyPath(8));

      /* 상단 마퀴 */
      rr(c, -254, 16, 508, 118, 50); c.fillStyle = lin(c, 0, 16, 0, 134, [[0, '#2a050a'], [1, '#430c13']]); c.fill();
      c.lineWidth = 3; c.strokeStyle = brass(c, -254, 16, 254, 134); c.stroke();
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `700 36px ${SANS}`;
      if ('letterSpacing' in c) c.letterSpacing = '1px';
      c.fillStyle = 'rgba(0,0,0,.55)'; c.fillText('마감구조대', 2, 78);
      c.fillStyle = lin(c, 0, 52, 0, 100, [[0, '#fff6d6'], [.5, '#f2d687'], [1, '#c99a46']]); c.fillText('마감구조대', 0, 74);
      if ('letterSpacing' in c) c.letterSpacing = '0px';
      BULBS.filter((_, i) => i % 4 === 0).forEach(([x, y]) => bulb(x, y, true, 0));

      /* 미션 표시창: 점으로 이루어진 호박색 LED */
      rr(c, -234, 146, 468, 64, 11); c.fillStyle = brass(c, -234, 146, 234, 210); c.fill();
      rr(c, -226, 154, 452, 48, 6); c.fillStyle = '#0c0504'; c.fill();
      c.save(); rr(c, -226, 154, 452, 48, 6); c.clip();
      if (st.displayOn) {
        c.textAlign = 'center'; c.textBaseline = 'middle';
        const label = fitText(st.text, 420, 27, 15);
        c.shadowColor = '#ff9a1a'; c.shadowBlur = 16; c.fillStyle = '#ffc24e'; c.fillText(label, 0, 179); c.shadowBlur = 0;
      }
      c.fillStyle = ledTile; c.fillRect(-226, 154, 452, 48);
      c.fillStyle = lin(c, -226, 154, -80, 202, [[0, 'rgba(255,255,255,.14)'], [.5, 'rgba(255,255,255,0)']]); c.fillRect(-226, 154, 452, 48);
      c.restore();

      /* 릴 창 */
      rr(c, -238, 220, 476, 244, 16); c.fillStyle = brass(c, -238, 220, 238, 464); c.fill();
      rr(c, -231, 227, 462, 230, 10); c.fillStyle = '#0d0605'; c.fill();
      reels.forEach((r, k) => {
        const rx = -228 + k * 159, W = 142;
        c.save(); c.beginPath(); c.rect(rx, 232, W, 220); c.clip();
        c.fillStyle = lin(c, rx, 0, rx + W, 0, [[0, '#cfc4a6'], [.18, '#f4ecd7'], [.82, '#efe6cf'], [1, '#bdb293']]); c.fillRect(rx, 232, W, 220);
        const blur = clamp((r.spd - 5) / 14), base = Math.floor(r.p);
        for (let i = base - 2; i <= base + 3; i++) {
          const dy = (r.p - i) * CELL; if (Math.abs(dy) > CELL * 1.7) continue;
          const ang = clamp(dy / 150, -1.15, 1.15), yy = REEL_Y + Math.sin(ang) * 150, sy = Math.cos(ang), sz = 96;
          const img = SP[((i % N) + N) % N], cx = rx + W / 2;
          c.save(); c.translate(cx, yy); c.scale(1, Math.max(.2, sy));
          const stretch = 1 + blur * .55;
          if (blur > .05) { c.globalAlpha = .3 * blur; c.drawImage(img, -sz / 2, -sz / 2 - blur * 38, sz, sz * stretch); c.drawImage(img, -sz / 2, -sz / 2 + blur * 38, sz, sz * stretch); }
          c.globalAlpha = 1 - blur * .5; c.drawImage(img, -sz / 2, -sz / 2, sz, sz * stretch);
          c.restore();
        }
        if (blur > .05) { c.fillStyle = lin(c, rx, 0, rx + W, 0, [[0, 'rgba(239,230,207,0)'], [.5, `rgba(239,230,207,${blur * .35})`], [1, 'rgba(239,230,207,0)']]); c.fillRect(rx, 232, W, 220); }
        // 원통의 둥근 면: 위아래로 갈수록 어둡고, 가운데에 빛 띠
        c.fillStyle = lin(c, 0, 232, 0, 452, [[0, 'rgba(18,8,4,.86)'], [.2, 'rgba(18,8,4,.32)'], [.38, 'rgba(18,8,4,0)'], [.62, 'rgba(18,8,4,0)'], [.8, 'rgba(18,8,4,.34)'], [1, 'rgba(18,8,4,.88)']]); c.fillRect(rx, 232, W, 220);
        c.fillStyle = lin(c, rx, 0, rx + W, 0, [[0, 'rgba(0,0,0,.5)'], [.07, 'rgba(0,0,0,0)'], [.93, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.5)']]); c.fillRect(rx, 232, W, 220);
        c.fillStyle = 'rgba(255,255,255,.1)'; c.fillRect(rx + 12, 258, 22, 170);
        c.restore();
      });
      for (let k = 0; k < 2; k++) { const gx = -228 + 142 + k * 159; c.fillStyle = chrome(c, gx, 0, gx + 17, 0); c.fillRect(gx, 232, 17, 220); }
      // 당첨선과 양쪽 표시
      const pay = st.win > 0 ? `rgba(255,${170 + 60 * st.pulse | 0},70,${.75 + .25 * st.pulse})` : 'rgba(214,42,52,.85)';
      c.strokeStyle = pay; c.lineWidth = 2.5; c.shadowColor = pay; c.shadowBlur = st.win > 0 ? 12 : 4; c.beginPath(); c.moveTo(-228, REEL_Y); c.lineTo(228, REEL_Y); c.stroke(); c.shadowBlur = 0;
      c.fillStyle = st.win > 0 ? '#ffd27a' : '#c99a46';
      [[-238, 1], [238, -1]].forEach(([x, d]) => { c.beginPath(); c.moveTo(x, REEL_Y - 13); c.lineTo(x + d * 17, REEL_Y); c.lineTo(x, REEL_Y + 13); c.closePath(); c.fill(); });
      if (st.win > 0) { // One short highlight, then a still result
        c.strokeStyle = `rgba(255,214,120,${.3 + .5 * st.pulse})`; c.lineWidth = 3.5;
        for (let k = 0; k < 3; k++) { rr(c, -228 + k * 159 + 4, REEL_Y - 52, 134, 104, 8); c.stroke(); }
      }
      // 유리 반사
      c.save(); rr(c, -231, 227, 462, 230, 10); c.clip();
      c.fillStyle = 'rgba(255,255,255,.07)'; c.beginPath(); c.moveTo(-231, 227); c.lineTo(-40, 227); c.lineTo(-150, 457); c.lineTo(-231, 457); c.closePath(); c.fill(); c.restore();

      /* 하단 패널: 코인 트레이, 버튼, 스피커 */
      rr(c, -254, 478, 508, 84, 16); c.fillStyle = lin(c, 0, 478, 0, 562, [[0, '#2d070d'], [1, '#1c0408']]); c.fill(); c.lineWidth = 2.5; c.strokeStyle = brass(c, -254, 478, 254, 562); c.stroke();
      rr(c, -122, 498, 244, 56, 24); c.fillStyle = chrome(c, 0, 498, 0, 554); c.fill();
      rr(c, -112, 506, 224, 42, 18); c.fillStyle = lin(c, 0, 506, 0, 548, [[0, '#070302'], [1, '#2b1d10']]); c.fill();
      [['#ffb23e', -208], ['#c83440', -170], ['#2aa392', -132]].forEach(([col, x], i) => {
        c.fillStyle = chrome(c, x - 15, 505, x + 15, 535); c.beginPath(); c.arc(x, 520, 15, 0, TAU); c.fill();
        const lit = st.win > 0 && i === 0 ? 1 : st.spinning ? (i === 1 ? .9 : .4) : .5;
        c.fillStyle = rad(c, x - 3, 516, 1, 12, [[0, '#fff'], [.3, col], [1, '#2a1208']]); c.globalAlpha = .55 + lit * .45; c.beginPath(); c.arc(x, 520, 11, 0, TAU); c.fill(); c.globalAlpha = 1;
      });
      c.strokeStyle = '#0c0504'; c.lineWidth = 4; c.lineCap = 'round';
      for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(150 + i * 14, 503); c.lineTo(150 + i * 14, 546); c.stroke(); }
      c.fillStyle = lin(c, 0, 566, 0, 596, [[0, '#120708'], [1, '#050203']]); rr(c, -266, 566, 532, 30, 4); c.fill();
      c.fillStyle = brass(c, -266, 566, 266, 568); c.fillRect(-266, 566, 532, 3);

      /* 레버 */
      const px = 296, py = 352, L = 176 * (1 - .56 * st.pull), br = 25 * (1 + .18 * st.pull);
      rr(c, 276, py - 28, 40, 56, 8); c.fillStyle = brass(c, 276, py - 28, 316, py + 28); c.fill(); c.lineWidth = 2; c.strokeStyle = '#4a300c'; c.stroke();
      c.fillStyle = '#3a2610'; [[-16], [16]].forEach(([d]) => { c.beginPath(); c.arc(296, py + d, 2.6, 0, TAU); c.fill(); });
      c.fillStyle = chrome(c, px - 8, 0, px + 8, 0); c.beginPath(); c.moveTo(px - 7, py); c.lineTo(px + 7, py); c.lineTo(px + 5, py - L); c.lineTo(px - 5, py - L); c.closePath(); c.fill();
      c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(px, py - L + br * .9, br * .9, br * .45, 0, 0, TAU); c.fill();
      c.fillStyle = rad(c, px - br * .35, py - L - br * .35, 1, br * 1.15, [[0, '#ffb8a8'], [.28, '#d9303a'], [1, '#590a14']]); c.beginPath(); c.arc(px, py - L, br, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.ellipse(px - br * .35, py - L - br * .4, br * .22, br * .13, -.6, 0, TAU); c.fill();
    }

    function draw(now) {
      if (stopped) return;
      const dt = lastNow ? Math.min(.05, (now - lastNow) / 1000) : .016; lastNow = now;
      const raw = (now - start) / duration, t = reduced ? 1 : Math.min(raw, 1.4), time = reduced ? 0 : (now - start) / 1000;
      const n = t < TS ? 0 : t < .56 ? 1 : t < .76 ? 2 : 3; setPhase(n);
      telemetry.textContent = `JACKPOT SLOT / ${String(Math.min(100, Math.floor(t * 100))).padStart(3, '0')}`;

      reels.forEach((r, k) => {
        const p = reduced ? r.p0 + r.D : reelAt(r, t); r.spd = Math.abs(p - r.p) / Math.max(dt, .001); r.p = p;
        const idx = Math.floor(p); if (idx !== r.lastIdx) { if (r.spd > 4 && now - coinTick > 38) { tone(2300 + k * 160, .012, .012, 'square', 0, .9); coinTick = now; } r.lastIdx = idx; }
        if (!r.stopped && t >= r.te) { r.stopped = true; if (!reduced) { tone(150 - k * 12, .12, k === 2 ? .09 : .055, 'triangle'); tone(1700, .025, .025, 'square'); } }
      });
      const winning = t >= STOPS[2];
      if (Math.floor(now / 250) !== lastMeasure) { lastMeasure = Math.floor(now / 250); measureTicket(); }
      const L = layout(t), winSmooth = winning ? smooth((t - STOPS[2]) / .1) : 0;
      const pulse = winning ? Math.max(0, 1 - (t - STOPS[2]) / .16) : 0;
      const pull = reduced ? 0 : t < .02 ? 0 : t < .13 ? smooth((t - .02) / .11) : t < .27 ? 1 - smooth((t - .13) / .14) + Math.max(0, Math.sin((t - .13) * 90)) * .04 * (1 - (t - .13) / .14) : 0;
      const spinning = t >= TS && t < STOPS[2];
      const step = Math.floor(time * (spinning ? 18 : 7));
      const st = {
        win: winSmooth, pulse, pull, spinning,
        bulbOn: i => reduced ? true : winning ? (t < .98 ? (i + Math.floor(time * 9)) % 2 === 0 : true) : (i + step) % 3 === 0,
        displayOn: true,
        text: reduced || t >= STOPS[2] ? prize : t < TS ? '레버를 당겨요' : list[Math.floor(time * 15 + rnd(3) * 9) % list.length]
      };

      const topPx = L.ticketTop + 'px'; if (topPx !== lastTop) { lastTop = topPx; dialog.style.setProperty('--slot-ticket-top', topPx); }
      c.save(); c.clearRect(0, 0, w, h);
      background(t, L, winSmooth);
      const shake = reduced ? 0 : Math.max(...STOPS.map(stop => t >= stop && t < stop + .026 ? (1 - (t - stop) / .026) * (stop === STOPS[2] ? .6 : .2) : 0));
      c.translate(Math.sin(time * 130) * 7 * shake, Math.cos(time * 110) * 6 * shake);
      c.save(); c.translate(L.x, L.y); c.scale(L.s, L.s); machine(t, time, st); c.restore();

      c.restore();

      if ((raw >= 1 || reduced) && !ready) { ready = true; onReady(); }
      if (reduced || t >= 1.4) { raf = null; return; }
      raf = requestAnimationFrame(draw);
    }

    resize();
    const observer = new ResizeObserver(resize); observer.observe(canvas);
    if (!c) { setPhase(3); ready = true; onReady(); } else draw(performance.now());
    return () => {
      stopped = true; if (raf !== null) cancelAnimationFrame(raf); observer.disconnect(); dialog.style.removeProperty('--slot-ticket-top');
      if (c) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, canvas.width, canvas.height); c.restore(); }
      if (audio && audio.state !== 'closed') audio.close().catch(() => {});
    };
  };
})();
