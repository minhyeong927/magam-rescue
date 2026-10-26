/* Motion 14.6.0, vendored locally so file:// and offline submissions also work. */
(() => {
  'use strict';
  const stage = document.getElementById('machine');
  const result = document.getElementById('decision-result');
  const back = stage.querySelector('.paper-under-back');
  const front = stage.querySelector('.paper-under-front');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let controls = [], pending = false, generation = 0;
  const animated = [result, back, front, ...result.querySelectorAll('.paper-brand, h4, .paper-meta, .paper-summary')];
  function clear() {
    generation++;
    for (const control of controls) control.cancel();
    controls = [];
    for (const element of animated) element.removeAttribute('style');
  }
  function flush() {
    if (!pending || result.hidden || document.hidden || !result.getClientRects().length || document.querySelector('dialog[open]')) return;
    pending = false; clear();
    if (!window.Motion?.animate || document.getElementById('skip-animation').checked) return;
    const current = generation;
    const { animate } = window.Motion;
    try {
      if (reduced.matches) {
        controls.push(animate(result, { opacity: [.7, 1] }, { duration: .12 }));
      } else {
        // One sheet comes forward from the pile, catches the air, then settles.
        controls.push(animate(result, {
          transform: ['translateY(22px) rotateX(9deg) rotateZ(-3deg) scale(.96)', 'translateY(-7px) rotateX(-2deg) rotateZ(.7deg) scale(1.01)', 'translateY(0px) rotateX(0deg) rotateZ(0deg) scale(1)'],
          boxShadow: ['0 3px 8px -3px #453b2838, 0 2px 5px #453b2814', '0 24px 34px -10px #453b2852, 0 2px 5px #453b2814', '0 12px 24px -12px #453b2859, 0 2px 5px #453b2814'],
        }, { duration: .74, times: [0, .55, 1], ease: [0.16, 1, .3, 1] }));
        controls.push(animate(back, { transform: ['translate(0px,3px) rotate(-7deg)', 'translate(3px,9px) rotate(-3deg)'] }, { duration:.62, ease:[.16,1,.3,1] }));
        controls.push(animate(front, { transform: ['translate(0px,2px) rotate(6deg)', 'translate(-3px,5px) rotate(2deg)'] }, { duration:.68, ease:[.16,1,.3,1] }));
        controls.push(animate(result.querySelectorAll('h4,.paper-meta,.paper-summary'), { opacity:[.55,1], filter:['blur(1px)','blur(0px)'] }, { duration:.32, delay:.14, ease:'easeOut' }));
      }
      const completion = controls[0];
      Promise.resolve(completion).then(() => { if (current === generation) clear(); });
    } catch (_) { clear(); } // Content and actions always remain usable if motion is unavailable.
  }
  window.RescuePaper = {
    render(state, reveal = false) {
      clear(); stage.dataset.paperState = state;
      if (state !== 'result') pending = false;
      else if (reveal) pending = true;
      flush();
    },
    flush,
    cancel() { pending = false; clear(); }
  };
  reduced.addEventListener('change', () => { clear(); flush(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); else flush(); });
  window.addEventListener('hashchange', clear);
})();
