/* A self-contained, local-only cinematic renderer. Task selection stays in script.js. */
(function () {
  'use strict';
  window.playOrbitalReveal = function ({ titles, winner, duration, sound, reduced, onReady }) {
    const canvas = document.getElementById('orbit-canvas'), ctx = canvas.getContext('2d');
    const dialog = document.getElementById('orbit-dialog');
    const phase = document.getElementById('orbit-phase'), coordinates = document.getElementById('orbit-coordinates');
    let width = 0, height = 0, frame = null, stopped = false, ready = false, audio = null;
    let previousPhase = -1;
    const started = performance.now();
    const stars = Array.from({ length: 180 }, (_, i) => ({
      x: ((i * 137.508) % 1000) / 1000, y: ((i * 239.71 + 173) % 1000) / 1000,
      z: .25 + ((i * 53.31) % 100) / 100, twinkle: i * 2.7
    }));
    const fragments = Array.from({ length: 64 }, (_, i) => ({ angle: i * 2.39996, speed: .4 + (i % 9) / 9, size: 1 + i % 3 }));
    function resize() {
      width = canvas.clientWidth; height = canvas.clientHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.7);
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      if (ctx) ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }
    resize();
    const observer = new ResizeObserver(resize); observer.observe(canvas);
    if (sound && !reduced) {
      try { const Audio = window.AudioContext || window.webkitAudioContext; audio = new Audio(); audio.resume().catch(() => {}); } catch (_) { audio = null; }
    }
    function tone(frequency, delay, length, type = 'sine', gain = .035) {
      if (!audio || audio.state === 'closed') return;
      try {
        const oscillator = audio.createOscillator(), envelope = audio.createGain(), time = audio.currentTime + delay;
        oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, time);
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, frequency * .45), time + length);
        envelope.gain.setValueAtTime(0, time); envelope.gain.linearRampToValueAtTime(gain, time + .015);
        envelope.gain.exponentialRampToValueAtTime(.0001, time + length);
        oscillator.connect(envelope); envelope.connect(audio.destination); oscillator.start(time); oscillator.stop(time + length + .03);
      } catch (_) { /* Visual playback remains available without audio. */ }
    }
    function changePhase(next) {
      if (previousPhase === next) return; previousPhase = next;
      dialog.dataset.phase = String(next);
      phase.textContent = ['궤도에 진입하는 중', '오늘의 임무를 포착하는 중', '목표 확인. 강하 시작.', '오늘의 임무, 착륙 완료.'][next];
      if (next === 0) tone(180, 0, .4);
      if (next === 1) { tone(720, 0, .09); tone(900, .12, .09); tone(1100, .24, .12); }
      if (next === 2) tone(240, 0, .45, 'triangle', .055);
      if (next === 3) { tone(90, 0, .65, 'sine', .12); tone(520, .05, .5, 'sine', .025); }
    }
    const clamp = n => Math.max(0, Math.min(1, n));
    function line(x1, y1, x2, y2, color, lineWidth = 1) {
      ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    function ring(x, y, radius, color, lineWidth = 1, rotation = 0, arc = Math.PI * 2) {
      ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.ellipse(x, y, radius, radius, rotation, rotation, rotation + arc); ctx.stroke();
    }
    function draw(now) {
      if (stopped) return;
      const raw = (now - started) / duration, t = reduced ? 3 : raw * 3;
      const time = reduced ? 0 : (now - started) / 1000;
      changePhase(t < .5 ? 0 : t < 1.6 ? 1 : t < 2.32 ? 2 : 3);
      coordinates.textContent = `SYNC ${(reduced ? 100 : Math.min(100, raw * 100)).toFixed(2)} / 100`;
      const cx = width / 2, cy = height * .44, radius = Math.min(width * .32, height * .255, 235);
      if (ctx) {
        ctx.clearRect(0, 0, width, height);
        const bg = ctx.createRadialGradient(cx, cy, 10, cx, cy, height * .9);
        bg.addColorStop(0, '#142434'); bg.addColorStop(.4, '#0b1425'); bg.addColorStop(1, '#040710'); ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
        const nebula = ctx.createRadialGradient(width * .8, height * .27, 0, width * .8, height * .27, width * .8);
        nebula.addColorStop(0, '#4a247627'); nebula.addColorStop(1, '#4a247600'); ctx.fillStyle = nebula; ctx.fillRect(0, 0, width, height);
        // Two depths of stars; during descent they stretch toward the viewer.
        const warp = t > 1.6 && t < 2.32 ? Math.sin((t - 1.6) / .72 * Math.PI) : 0;
        for (const star of stars) {
          const x = star.x * width, y = (star.y * height + time * 3 * star.z) % height;
          const opacity = .2 + .5 * star.z + .15 * Math.sin(time + star.twinkle);
          if (warp > .05) line(x, y, x + (x - cx) * warp * .25, y + (y - cy) * warp * .25, `rgba(192,224,255,${opacity * .7})`, star.z);
          ctx.fillStyle = `rgba(215,235,255,${opacity})`; ctx.fillRect(x, y, star.z * 1.7, star.z * 1.7);
        }
        // A large, softly lit planet and perspective grid anchor the scene.
        const py = height * 1.16, pr = height * .39;
        ctx.save(); ctx.shadowColor = '#63cae8'; ctx.shadowBlur = 30;
        const planet = ctx.createRadialGradient(cx, py - pr, 0, cx, py, pr);
        planet.addColorStop(0, '#254d60'); planet.addColorStop(.22, '#0d2439'); planet.addColorStop(1, '#030812');
        ctx.beginPath(); ctx.arc(cx, py, pr, 0, Math.PI * 2); ctx.fillStyle = planet; ctx.fill(); ctx.strokeStyle = '#73d7ec66'; ctx.lineWidth = 1.3; ctx.stroke(); ctx.restore();
        ctx.save(); ctx.globalAlpha = .15; for (let i = -6; i <= 6; i++) line(cx + i * width * .035, height * .81, cx + i * width * .3, height, '#70c9df');
        for (let i = 0; i < 6; i++) line(0, height * (.81 + i * i * .006), width, height * (.81 + i * i * .006), '#70c9df'); ctx.restore();
        const reveal = clamp((t - 2.32) / .45);
        const radarOpacity = t < 1.6 ? clamp(t * 3) : t < 2.32 ? 1 - clamp((t - 1.6) / .4) : 0;
        ctx.save(); ctx.globalAlpha = radarOpacity;
        ring(cx, cy, radius, '#91bdd24d'); ring(cx, cy, radius * .75, '#90bed02c'); ring(cx, cy, radius * .43, '#90bed030');
        for (let i = 0; i < 72; i++) {
          const a = i / 72 * Math.PI * 2, outer = radius + (i % 6 === 0 ? 12 : 5);
          line(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, cx + Math.cos(a) * outer, cy + Math.sin(a) * outer, i % 6 === 0 ? '#c8f7869c' : '#81a8b044');
        }
        const sweep = t * 5;
        const gradient = ctx.createConicGradient(sweep - 1.1, cx, cy); gradient.addColorStop(0, '#b9fa6900'); gradient.addColorStop(.15, '#b9fa6925'); gradient.addColorStop(.18, '#b9fa6900'); gradient.addColorStop(1, '#b9fa6900');
        ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
        line(cx, cy, cx + Math.cos(sweep) * radius, cy + Math.sin(sweep) * radius, '#c8f7869c');
        const count = Math.min(titles.length, 5);
        for (let i = 0; i < count; i++) {
          const a = i / count * Math.PI * 2 + t * .8 - Math.PI / 2;
          const x = cx + Math.cos(a) * radius * .76, y = cy + Math.sin(a) * radius * .76;
          ctx.fillStyle = '#cbf98c'; ctx.shadowColor = '#b7f877'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
          ctx.font = `${width < 600 ? 10 : 12}px sans-serif`; ctx.textAlign = 'center';
          const label = titles[i].length > 13 ? titles[i].slice(0, 12) + '…' : titles[i]; ctx.fillStyle = '#dbe9ee'; ctx.fillText(label, x, y + 19);
        }
        if (t > 1.05) for (let i = 0; i < 3; i++) ring(cx, cy, Math.max(15, radius * (1.2 - clamp((t - 1.05 - i * .07) * 2) * .8)), '#c4ff8c', 1.3, -t * 2 + i, 4.5);
        ctx.restore();
        // The descent is a luminous core with a tapered wake, followed by a single impact.
        if (t >= 1.6 && t < 2.48) {
          const fall = clamp((t - 1.6) / .72), x = cx + (1 - fall) * width * .45, y = cy - (1 - fall) * height * .48;
          ctx.save(); ctx.shadowBlur = 35; ctx.shadowColor = '#cdf7a0';
          line(x, y, x + width * .35 * (1 - fall), y - height * .4 * (1 - fall), '#c1fb8c99', 2 + fall * 4);
          const glow = ctx.createRadialGradient(x, y, 0, x, y, 8 + fall * 34); glow.addColorStop(0, '#f7ffdf'); glow.addColorStop(.12, '#d6ff9e'); glow.addColorStop(.4, '#aff87488'); glow.addColorStop(1, '#aff87400'); ctx.fillStyle = glow; ctx.fillRect(x - 50, y - 50, 100, 100); ctx.restore();
        }
        if (t >= 2.32) {
          const impact = t - 2.32;
          if (impact < 1.2 && !reduced) {
            for (let i = 0; i < 3; i++) {
              const age = Math.max(0, impact - i * .08), r = age * Math.max(width, height) * .8;
              ring(cx, cy, Math.max(1, r), `rgba(200,255,157,${Math.max(0, .65 - age)})`, 2 - i * .4);
            }
            for (const particle of fragments) {
              const distance = Math.pow(impact, .65) * radius * 2.5 * particle.speed;
              const x = cx + Math.cos(particle.angle) * distance, y = cy + Math.sin(particle.angle) * distance;
              ctx.fillStyle = `rgba(${particle.size === 1 ? '255,185,92' : '199,255,158'},${Math.max(0, 1 - impact)})`;
              ctx.fillRect(x, y, particle.size, particle.size * 2);
            }
          }
          // A calm halo remains around the final mission, with a slow satellite.
          ctx.save(); ctx.globalAlpha = reveal * .55;
          const halo = ctx.createRadialGradient(cx, cy, radius * .7, cx, cy, radius * 1.6); halo.addColorStop(0, '#b9fa6900'); halo.addColorStop(.4, '#b9fa6915'); halo.addColorStop(1, '#b9fa6900'); ctx.fillStyle = halo; ctx.fillRect(0, 0, width, height);
          ring(cx, cy, radius * 1.28, '#b7e99522'); ring(cx, cy, radius * 1.33, '#84b3c522', 1, time * .08, 4.7);
          const a = time * .2; ctx.fillStyle = '#c5f592'; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * radius * 1.28, cy + Math.sin(a) * radius * 1.28, 2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }
      }
      if ((raw >= 1 || reduced) && !ready) { ready = true; onReady(); }
      if (!stopped && !reduced) frame = requestAnimationFrame(draw);
    }
    if (!ctx) { changePhase(3); ready = true; onReady(); } else frame = requestAnimationFrame(draw);
    return () => {
      stopped = true; if (frame !== null) cancelAnimationFrame(frame); observer.disconnect();
      if (audio && audio.state !== 'closed') audio.close().catch(() => {});
    };
  };
})();
