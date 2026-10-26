/* Starter Pack — tactile foil carousel. Task selection stays in RescueEngine. */
(function () {
  'use strict';
  const variants = [
    { name: '실버', color: 'silver', code: 'SILVER', ink: '#202a39' },
    { name: '코발트', color: 'cobalt', code: 'COBALT', ink: '#214cf2' },
    { name: '코퍼', color: 'copper', code: 'COPPER', ink: '#8c4028' }
  ];
  const arrow = direction => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M${direction < 0 ? '15 5 8 12 15 19' : '9 5 16 12 9 19'}"/></svg>`;
  const mark = '<svg viewBox="0 0 120 120" aria-hidden="true"><path d="M60 7 73 47 113 60 73 73 60 113 47 73 7 60 47 47Z" fill="currentColor"/><path d="m60 36 6 18 18 6-18 6-6 18-6-18-18-6 18-6Z" fill="#e8ebee"/></svg>';
  function foil(v) {
    return `<span class="pack-foil" data-metal="${v.color}"><span class="pack-sleeve"><span class="pack-print"><span class="pack-maker">MAGAM RESCUE®</span><strong class="pack-wordmark">JUST<br>START.</strong><span class="pack-emblem">${mark}</span><span class="pack-edition">${v.code} EDITION</span><span class="pack-bottomline"><b>ONE TASK INSIDE</b><span>5 MIN<br>TO BEGIN</span></span></span><span class="pack-seal pack-seal-bottom"></span></span><span class="pack-tear"><span class="pack-seal"></span><span class="pack-tear-copy">PULL TO START <span>↗</span></span></span><span class="pack-cut"></span><span class="pack-reflection"></span></span>`;
  }
  document.querySelectorAll('[data-pack-art]').forEach(el => {
    el.innerHTML = variants.map(v => `<span class="pack-mini">${foil(v)}</span>`).join('');
  });

  window.playPackReveal = function ({ winner, duration = 3000, sound = false, reduced = false, onReady = () => {} }) {
    const dialog = document.getElementById('orbit-dialog');
    const result = dialog.querySelector('.orbit-result');
    const announcement = document.getElementById('orbit-announcement');
    const canvas = document.getElementById('orbit-canvas');
    const timers = new Set(), listeners = new AbortController();
    let active = 0, mode = 'choose', stopped = false, raf = 0, audio = null, drag = null, suppressClick = false;
    const speed = duration === 1000 ? .42 : 1;
    const scene = document.createElement('section');
    scene.className = 'pack-scene';
    scene.innerHTML = `<div class="pack-prompt"><h2 id="pack-heading">시작을 뜯어볼까?</h2><p>끌어서 고르고, 마음에 드는 팩을 눌러요.</p></div><div class="pack-carousel" role="group" aria-label="팩 선택"><div class="pack-ground" aria-hidden="true"></div><div class="pack-deck">${variants.map((v, i) => `<button type="button" class="pack-item" data-index="${i}" aria-label="${v.name} 팩 선택">${foil(v)}</button>`).join('')}</div><button type="button" class="pack-nav pack-prev" aria-label="이전 팩">${arrow(-1)}</button><button type="button" class="pack-nav pack-next" aria-label="다음 팩">${arrow(1)}</button></div><div class="pack-controls"><div class="pack-position" aria-live="polite"><span class="pack-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="pack-position-name">실버 팩</span></div><button type="button" class="pack-open">이 팩 뜯기 ${arrow(1)}</button><p>어떤 팩이든, 필요한 일 하나가 담겨 있어요.</p></div><div class="pack-flash" aria-hidden="true"></div>`;
    dialog.append(scene);
    dialog.dataset.packState = 'choose';
    dialog.dataset.packMetal = variants[active].color;
    dialog.dataset.phase = '0';
    dialog.setAttribute('aria-labelledby', 'pack-heading');
    if (reduced) dialog.classList.add('pack-reduced');
    const items = [...scene.querySelectorAll('.pack-item')];
    const deck = scene.querySelector('.pack-deck');
    const openButton = scene.querySelector('.pack-open');
    const cardTop = document.createElement('div');
    cardTop.className = 'pack-card-top'; cardTop.setAttribute('aria-hidden', 'true');
    cardTop.innerHTML = `<span>MAGAM RESCUE</span><span>STARTER CARD</span>`;
    const cardArt = document.createElement('div');
    cardArt.className = 'pack-card-art'; cardArt.setAttribute('aria-hidden', 'true');
    cardArt.innerHTML = `<div class="pack-card-medal">${mark}</div><span>YOUR NEXT MOVE</span><b>START.</b>`;
    result.prepend(cardTop, cardArt);
    const cardBack = document.createElement('div');
    cardBack.className = 'pack-card-back'; cardBack.setAttribute('aria-hidden', 'true');
    cardBack.innerHTML = `<span>MAGAM RESCUE</span>${mark}<strong>ONE<br>MORE<br>START.</strong><small>지금의 한 장</small>`;
    dialog.append(cardBack);
    const measureCard = () => { cardBack.style.height = result.offsetHeight + 'px'; };
    const observer = new ResizeObserver(measureCard); observer.observe(result); measureCard();
    function later(fn, ms) {
      const id = setTimeout(() => { timers.delete(id); if (!stopped) fn(); }, ms);
      timers.add(id); return id;
    }
    function listen(el, event, fn, opts = {}) { el.addEventListener(event, fn, { ...opts, signal: listeners.signal }); }
    function soundContext() {
      if (!sound || reduced || audio) return;
      try { audio = new (window.AudioContext || window.webkitAudioContext)(); audio.resume().catch(() => {}); } catch (_) { audio = null; }
    }
    function tone(hz, length = .06, volume = .025, type = 'triangle') {
      if (!audio) return;
      const t = audio.currentTime, o = audio.createOscillator(), g = audio.createGain();
      o.type = type; o.frequency.setValueAtTime(hz, t); o.frequency.exponentialRampToValueAtTime(Math.max(45, hz * .35), t + length);
      g.gain.setValueAtTime(volume, t); g.gain.exponentialRampToValueAtTime(.0001, t + length);
      o.connect(g); g.connect(audio.destination); o.start(); o.stop(t + length + .01);
    }
    function rip() {
      if (!audio) return;
      const len = .38 * speed, buffer = audio.createBuffer(1, Math.floor(audio.sampleRate * len), audio.sampleRate);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < channel.length; i++) channel[i] = (Math.random() * 2 - 1) * (1 - i / channel.length) * (.4 + .6 * Math.abs(Math.sin(i * .003)));
      const source = audio.createBufferSource(), filter = audio.createBiquadFilter(), gain = audio.createGain();
      source.buffer = buffer; filter.type = 'bandpass'; filter.frequency.value = 1900; filter.Q.value = .6; gain.gain.value = .14;
      source.connect(filter); filter.connect(gain); gain.connect(audio.destination); source.start();
    }
    function select(index, feedback = true) {
      if (mode !== 'choose') return;
      active = (index + variants.length) % variants.length;
      dialog.dataset.packMetal = variants[active].color;
      items.forEach((item, i) => {
        const diff = (i - active + 3) % 3;
        item.dataset.position = diff === 0 ? 'center' : diff === 1 ? 'right' : 'left';
        item.setAttribute('aria-label', variants[i].name + (diff === 0 ? ' 팩 뜯기' : ' 팩 선택'));
        item.setAttribute('aria-pressed', String(i === active));
        item.style.setProperty('--tilt-x', '0deg'); item.style.setProperty('--tilt-y', '0deg');
      });
      scene.querySelectorAll('.pack-dots i').forEach((dot, i) => dot.classList.toggle('selected', i === active));
      scene.querySelector('.pack-position-name').textContent = variants[active].name + ' 팩';
      if (feedback) { soundContext(); tone(330, .045, .018); }
    }
    function burst() {
      if (reduced || stopped) return;
      const c = canvas.getContext('2d'); if (!c) return;
      const w = dialog.clientWidth, h = dialog.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = w * dpr; canvas.height = h * dpr; c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const start = performance.now(), ox = w * .5, oy = h * .44;
      const colors = ['#f3f4ed', '#b9c9d9', '#6482ff', '#d8dfb8', '#879bb3'];
      const sparks = Array.from({ length: 76 }, (_, i) => {
        const angle = Math.random() * Math.PI * 2, velocity = (180 + Math.random() * 650) * Math.min(1, w / 800);
        return { vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity - 140, size: 2 + Math.random() * 7, angle, spin: (Math.random() - .5) * 13, color: colors[i % colors.length], line: i % 4 === 0 };
      });
      function frame(now) {
        if (stopped) return;
        const t = (now - start) / 1000, fade = Math.max(0, 1 - t / 1.65);
        c.clearRect(0, 0, w, h);
        if (t < .5) {
          c.save(); c.translate(ox, oy); c.scale(1, .65); c.globalAlpha = (1 - t / .5) * .65;
          c.strokeStyle = '#d2e3f8'; c.lineWidth = 3 * (1 - t / .5);
          c.beginPath(); c.arc(0, 0, 50 + t * 920, 0, Math.PI * 2); c.stroke(); c.restore();
        }
        sparks.forEach(p => {
          const x = ox + p.vx * t, y = oy + p.vy * t + 220 * t * t;
          c.save(); c.translate(x, y); c.rotate(p.angle + t * p.spin); c.globalAlpha = fade * .85;
          if (p.line) { c.strokeStyle = p.color; c.lineWidth = 1.4; c.beginPath(); c.moveTo(0, 0); c.lineTo(-35 * fade, 0); c.stroke(); }
          else { c.scale(Math.cos(t * 10 + p.angle), 1); c.fillStyle = p.color; c.beginPath(); c.moveTo(-p.size, -p.size); c.lineTo(p.size * 1.3, -p.size * .5); c.lineTo(p.size * .3, p.size); c.closePath(); c.fill(); }
          c.restore();
        });
        if (t < 1.65) raf = requestAnimationFrame(frame); else { raf = 0; c.clearRect(0, 0, w, h); }
      }
      raf = requestAnimationFrame(frame);
    }
    function finish() {
      if (stopped || mode === 'ready') return;
      mode = 'ready'; dialog.dataset.packState = 'ready'; dialog.dataset.phase = '3';
      dialog.setAttribute('aria-labelledby', 'orbit-title');
      scene.setAttribute('aria-hidden', 'true'); scene.inert = true;
      onReady();
      const target = document.getElementById('orbit-start');
      (target.hidden ? document.getElementById('orbit-reroll') : target).focus({ preventScroll: true });
    }
    function open() {
      if (mode !== 'choose' || stopped) return;
      soundContext(); mode = 'opening';
      dialog.dataset.packState = 'opening';
      dialog.style.setProperty('--pack-speed', String(speed));
      dialog.style.setProperty('--pack-time', `${speed}s`);
      items.forEach(item => { item.disabled = true; });
      scene.querySelectorAll('.pack-nav, .pack-open').forEach(button => { button.disabled = true; });
      announcement.textContent = variants[active].name + ' 팩을 뜯고 있어요.';
      if (reduced) { finish(); return; }
      tone(110, .12, .05);
      later(rip, 360 * speed);
      later(() => {
        dialog.dataset.packState = 'reveal';
        burst(); tone(65, .35, .1, 'sine'); tone(660, .35, .025); later(() => tone(990, .4, .02), 90);
      }, 860 * speed);
      later(finish, 2680 * speed);
    }
    listen(scene.querySelector('.pack-prev'), 'click', () => select(active - 1));
    listen(scene.querySelector('.pack-next'), 'click', () => select(active + 1));
    listen(openButton, 'click', open);
    items.forEach((item, i) => listen(item, 'click', () => {
      if (suppressClick) { suppressClick = false; return; }
      if (active === i) open(); else select(i);
    }));
    listen(dialog, 'keydown', event => {
      if (mode !== 'choose' || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault(); select(active + (event.key === 'ArrowLeft' ? -1 : 1));
      items[active].focus({ preventScroll: true });
    });
    listen(deck, 'pointerdown', event => {
      if (mode !== 'choose' || event.button > 0) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
      suppressClick = false;
    });
    listen(deck, 'pointermove', event => {
      if (mode !== 'choose') return;
      if (drag && drag.id === event.pointerId) {
        const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
          drag.moved = true;
          if (!deck.hasPointerCapture(event.pointerId)) deck.setPointerCapture(event.pointerId);
          event.preventDefault();
          deck.style.setProperty('--drag', `${Math.max(-65, Math.min(65, dx * .35))}px`);
        }
      } else if (!reduced && event.pointerType === 'mouse') {
        const box = deck.getBoundingClientRect(), x = (event.clientX - box.left) / box.width - .5, y = (event.clientY - box.top) / box.height - .5;
        items[active].style.setProperty('--tilt-y', `${x * 14}deg`);
        items[active].style.setProperty('--tilt-x', `${-y * 8}deg`);
        items[active].style.setProperty('--shine', `${50 + x * 40}%`);
      }
    }, { passive: false });
    function release(event) {
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x;
      if (drag.moved) {
        suppressClick = true;
        later(() => { suppressClick = false; }, 180);
        if (Math.abs(dx) > 38) select(active + (dx < 0 ? 1 : -1));
      }
      if (deck.hasPointerCapture(event.pointerId)) deck.releasePointerCapture(event.pointerId);
      drag = null; deck.style.setProperty('--drag', '0px');
    }
    listen(deck, 'pointerup', release);
    listen(deck, 'pointercancel', () => { drag = null; deck.style.setProperty('--drag', '0px'); });
    listen(deck, 'pointerleave', () => { if (!drag) { items[active].style.setProperty('--tilt-x', '0deg'); items[active].style.setProperty('--tilt-y', '0deg'); } });
    select(0, false);
    openButton.focus({ preventScroll: true });
    const stop = () => {
      stopped = true; listeners.abort(); timers.forEach(clearTimeout); timers.clear();
      if (raf) cancelAnimationFrame(raf);
      canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
      observer.disconnect(); scene.remove(); cardTop.remove(); cardArt.remove(); cardBack.remove();
      delete dialog.dataset.packState; delete dialog.dataset.packMetal;
      dialog.style.removeProperty('--pack-speed'); dialog.style.removeProperty('--pack-time');
      dialog.classList.remove('pack-reduced'); dialog.setAttribute('aria-labelledby', 'orbit-title');
      if (audio && audio.state !== 'closed') audio.close().catch(() => {});
    };
    return stop;
  };
})();
