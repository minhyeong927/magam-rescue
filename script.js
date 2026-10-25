(function () {
  'use strict';
  const E = window.RescueEngine;
  const $ = id => document.getElementById(id);
  const STORAGE_KEY = 'magam-rescue-v1';
  const categoryNames = { assignment: '과제·발표', study: '시험·공부', life: '일상·정리', other: '그 밖의 일' };
  const importanceNames = { high: '중요도 높음', normal: '중요도 보통', low: '중요도 낮음' };
  let state = { tasks: [], sample: true, selectedId: null, focus: null, activity: {} };
  let pendingNoteId = null;
  let stopDispatch = null, stopPreview = null, finishPick = null;
  let stopOrbit = null, orbitPreview = false, previewTheme = 'orbit';
  const impactThemes = ['breakout', 'overdrive', 'capsule', 'comic'];
  const effectNames = {basic:'기본 룰렛', dispatch:'구조대 출동', orbit:'궤도 강하', breakout:'고민을 깨부숴', overdrive:'오버드라이브', capsule:'캡슐 드롭', comic:'코믹 임팩트'};
  let editingId = null, choosing = false, timerInterval = null, reelInterval = null, pickTimeout = null;
  let toastTimeout = null, pendingConfirmation = null, storageAvailable = true, planShown = false;
  let currentDay = E.localDate();
  const freshFocus = E.freshFocus;
  let focus = freshFocus(), lastSavedAt = 0;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function uid() { return window.crypto?.randomUUID ? window.crypto.randomUUID() : `task-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
  function dateOffset(days) { const date = new Date(); date.setDate(date.getDate() + days); return E.localDate(date); }
  function samples() {
    return [
      { id: uid(), title: '홈페이지 첫 화면 만들기', category: 'assignment', due: dateOffset(1), importance: 'high', effort: 25 },
      { id: uid(), title: '영어 3단원 시험 공부', category: 'study', due: dateOffset(2), importance: 'normal', effort: 45 },
      { id: uid(), title: '책상 위 정리하기', category: 'life', due: '', importance: 'low', effort: 15 }
    ].map((task, index) => ({ ...task, createdAt: Date.now() + index, doneAt: null, deferredOn: null, deferReason: '' }));
  }
  function isTask(task) {
    return task && typeof task.id === 'string' && typeof task.title === 'string' && task.title.trim().length > 0 && task.title.length <= 60
      && Object.hasOwn(categoryNames, task.category) && Object.hasOwn(importanceNames, task.importance)
      && Number.isFinite(task.createdAt) && [15, 25, 45, 60].includes(task.effort)
      && typeof task.due === 'string' && (!task.due || /^\d{4}-\d{2}-\d{2}$/.test(task.due))
      && (!task.doneAt || Number.isFinite(task.doneAt));
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) { state.tasks = samples(); return; }
      const saved = JSON.parse(raw);
      if (!Array.isArray(saved.tasks) || !saved.tasks.every(isTask)) throw new Error('invalid saved tasks');
      state = { effect: ['dispatch', 'orbit', ...impactThemes].includes(saved.effect) ? saved.effect : 'basic', orbitLength: saved.orbitLength === 1000 ? 1000 : 3000, orbitSound: saved.orbitSound === true, tasks: saved.tasks.slice(0, 100).map(task => ({ ...task, progressNote: typeof task.progressNote === 'string' ? task.progressNote.slice(0, 300) : '' })), sample: Boolean(saved.sample), selectedId: saved.selectedId || null, selectionExcludedId: saved.selectionExcludedId || null, focus: saved.focus || null, activity: Object.fromEntries(Object.entries(saved.activity || {}).filter(([key, value]) => /^\d{4}-\d{2}-\d{2}$/.test(key) && value && Number.isFinite(value.milliseconds) && value.milliseconds >= 0 && Number.isFinite(value.starts) && value.starts >= 0)) };
      const selected = selectedTask();
      if (!selected || selected.doneAt || selected.deferredOn === currentDay || selected.pausedOn === currentDay) { state.selectedId = null; state.focus = null; }
      if (state.selectedId && state.focus) focus = E.restoreFocus(state.focus);

    } catch (error) {
      storageAvailable = false;
      state = { tasks: samples(), sample: true, selectedId: null, focus: null, activity: {} };
    }
  }
  function save() {
    accountFocus(); lastSavedAt = Date.now();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, focus })); }
    catch (error) { storageAvailable = false; }
    $('storage-note').textContent = storageAvailable
      ? '입력한 내용은 이 브라우저에만 저장돼요. 다른 사람에게 파일을 보내도 내 할 일은 전달되지 않아요.'
      : '현재 브라우저에서 저장을 사용할 수 없어 이 창을 닫으면 내용이 사라져요. 열린 동안에는 모든 기능을 사용할 수 있어요.';
  }
  function selectedTask() { return state.tasks.find(task => task.id === state.selectedId); }
  function announce(text) { $('announcement').textContent = text; }
  function toast(text) {
    clearTimeout(toastTimeout); $('toast').textContent = text; $('toast').classList.add('visible');
    toastTimeout = setTimeout(() => $('toast').classList.remove('visible'), 3500);
  }
  function node(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function actionButton(text, className, id, label) {
    const button = node('button', className, text); button.type = 'button'; button.dataset.id = id;
    if (label) button.setAttribute('aria-label', label);
    return button;
  }
  function renderTasks() {
    const list = $('task-list'), completed = $('completed-list'); list.replaceChildren(); completed.replaceChildren();
    const active = state.tasks.filter(task => !task.doneAt);
    $('task-count').textContent = active.length;
    if (!active.length) {
      const item = node('li', 'empty-list'); item.append(node('span', '', '↗'), node('p', '', '머릿속 할 일을 꺼내볼까요?'), node('p', '', '아래 버튼으로 하나만 적어봐요.')); list.append(item);
    }
    for (const task of active) {
      const paused = task.pausedOn === E.localDate();
      const deferred = paused || task.deferredOn === E.localDate();
      const item = node('li', `task-item${task.id === state.selectedId ? ' selected' : ''}${deferred ? ' deferred' : ''}`);
      const top = node('div', 'task-item-top'); top.append(node('span', 'task-item-name', task.title));
      const menu = node('div', 'task-menu');
      menu.append(actionButton('수정', 'edit-task', task.id, `${task.title} 수정`), actionButton('×', 'delete-task', task.id, `${task.title} 삭제`));
      top.append(menu); item.append(top);
      const tags = node('div', 'task-tags');
      const urgent = task.due && E.dayDifference(task.due) <= 1;
      tags.append(node('span', `due-tag${urgent ? ' urgent' : ''}`, E.dueLabel(task)), node('span', '', `${task.effort}분`));
      if (task.importance === 'high') tags.append(node('span', 'high-tag', '중요'));
      item.append(tags);
      if (task.progressNote) item.append(node('p', 'task-progress-note', `지난 메모 · ${task.progressNote}`));
      if (deferred) {
        const reason = node('div', 'defer-reason'); reason.append(node('span', '', paused ? '오늘은 여기까지 · 일은 계속 남아 있어요' : `잠시 제외 · ${task.deferReason || '지금은 어려워요'}`), actionButton('오늘 다시 하기', 'restore-task', task.id)); item.append(reason);
      }
      list.append(item);
    }
    const done = state.tasks.filter(task => task.doneAt).sort((a, b) => b.doneAt - a.doneAt);
    $('done-count').textContent = done.length;
    for (const task of done) { const item = node('li'); item.append(node('span', '', task.title), actionButton('되돌리기', 'undo-task', task.id, `${task.title} 완료 취소`)); completed.append(item); }
    if (!done.length) completed.append(node('li', '', '아직 없어도 괜찮아요. 하나씩 시작해요.'));
    const todayDone = done.filter(task => E.localDate(new Date(task.doneAt)) === E.localDate()).length;
    $('today-done').textContent = `${todayDone}개`;
    renderStats();
    $('data-hint').textContent = state.sample ? '예시 할 일이 담겨 있어요. 내 할 일로 바꿔보세요.' : '머릿속 목록을 여기 내려놓고, 다음 선택은 맡겨요.';
    updateLock();
  }
  function renderDecision(tieCount) {
    const selected = selectedTask();
    $('decision-rest').hidden = Boolean(selected);
    $('decision-result').hidden = !selected;
    $('reel').hidden = true; $('dispatch-stage').hidden = true; $('skip-current-effect').hidden = true;
    $('defer-button').hidden = !selected;
    $('reroll-button').hidden = !selected;
    $('quick-start').hidden = Boolean(selected);
    if (selected) {
      $('result-title').textContent = selected.title;
      const candidates = state.tasks.filter(task => task.id !== state.selectionExcludedId);
      $('result-reason').textContent = (state.selectionExcludedId ? '방금 나온 일을 빼고 남은 우선순위에서 골랐어요. ' : '') + E.reason(selected, candidates, E.localDate(), tieCount);
      $('resume-note').hidden = !selected.progressNote;
      $('resume-note-text').textContent = selected.progressNote || '';
      document.querySelector('.workbench').classList.add('has-selection');
      $('timer-caption').textContent = selected.title;
    } else {
      document.querySelector('.workbench').classList.remove('has-selection');
      const pending = state.tasks.filter(task => !task.doneAt);
      const possible = E.eligible(state.tasks);
      const hasDone = state.tasks.some(task => task.doneAt);
      $('decision-rest').querySelector('.machine-kicker').textContent = !pending.length && hasDone ? '하나씩, 여기까지 왔네요' : possible.length ? '고민은 잠깐 내려놓고' : pending.length ? '지금 할 수 있는 일이 없네요' : '먼저 목록에 내려놓아요';
      const title = $('decision-rest').querySelector('h4');
      title.replaceChildren();
      title.append(document.createTextNode(!pending.length && hasDone ? '오늘 목록을' : possible.length ? '이번엔' : pending.length ? '잠시 쉬어도' : '할 일을'), document.createElement('br'), document.createTextNode(!pending.length && hasDone ? '모두 끝냈어요!' : possible.length ? '우리가 고를게요.' : pending.length ? '괜찮아요.' : '하나 적어봐요.'));
      $('decision-rest').querySelector('.machine-small').textContent = pending.length && !possible.length ? '다시 가능한 일은 목록에서 ‘오늘 다시 하기’를 눌러요.' : !pending.length && hasDone ? '작은 시작이 모여 여기까지. 잘 마무리했어요.' : '버튼 한 번이면, 지금 할 일 하나.';
      $('pick-button').textContent = '지금 할 일 정해줘 ✳';
      $('timer-caption').textContent = '할 일이 정해지면 5분만 같이 해봐요.';
    }
    updateLock(); renderTimer();
  }
  function updateLock() {
    const selected = Boolean(selectedTask());
    $('pick-button').disabled = choosing || (!selected && !E.eligible(state.tasks).length);
    $('defer-button').disabled = choosing;
    $('reroll-button').disabled = choosing;
    $('quick-start').disabled = choosing || !E.eligible(state.tasks).length;
    for (const el of document.querySelectorAll('.task-menu button, .restore-task, .undo-task, #add-task, #add-task-bottom, #sample-button, #clear-button')) el.disabled = choosing;
    $('skip-animation').disabled = choosing;
    $('open-effects').disabled = choosing;
    $('orbit-reroll').disabled = choosing;
    $('complete-button').disabled = choosing || !selected;
    $('timer-button').disabled = choosing || !selected;
    $('pause-today-button').disabled = choosing || !selected;
    $('open-focus').disabled = choosing || !selected;
  }
  function renderStats() {
    const today = state.activity[E.localDate()] || { milliseconds: 0, starts: 0 };
    const seconds = Math.floor(today.milliseconds / 1000);
    $('today-starts').textContent = `${today.starts}번`;
    $('today-focus').textContent = `${Math.floor(seconds / 60)}분 ${seconds % 60}초`;
  }
  function accountFocus() {
    const result = E.accrue(state.activity, focus);
    state.activity = result.activity; focus = result.focus;
    const task = selectedTask();
    if (task && result.elapsed > 0) task.lastWorkedAt = result.lastAt;
    renderStats();
  }
  function resetFocus() {
    accountFocus(); clearInterval(timerInterval); timerInterval = null; focus = freshFocus();
    renderTimer();
  }
  function renderTimer() {
    const view = E.focusView(focus), running = focus.running;
    const started = view.elapsedMs > 0;
    const clock = `${String(Math.floor(view.seconds / 60)).padStart(2, '0')}:${String(view.seconds % 60).padStart(2, '0')}`;
    const total = Math.floor(view.elapsedMs / 1000);
    const totalText = `총 집중 ${Math.floor(total / 60)}분 ${String(total % 60).padStart(2, '0')}초`;
    $('timer-display').textContent = clock;
    $('timer-phase').textContent = view.overtime ? '추가 집중' : '처음 5분';
    $('timer-progress').style.strokeDashoffset = view.overtime ? '0' : `${552.92 * Math.min(1, view.elapsedMs / (focus.duration * 1000))}`;
    $('timer-face').classList.toggle('running', running); $('timer-face').classList.toggle('finished', view.overtime);
    $('timer-face').classList.toggle('long-time', clock.length > 5);
    $('timer-state').textContent = !running && started ? '잠깐 쉬는 중' : view.overtime ? '5분 시작 성공! 네 페이스로 이어가요.' : running ? '지금은 이것 하나에만' : '작은 시작, 충분한 5분';
    $('timer-button').textContent = running ? '잠깐 멈추기 Ⅱ' : started ? '이어서 집중하기 ▶' : '5분 시작하기 ▶';
    $('session-total').textContent = totalText;
    $('focus-mode-time').textContent = clock;
    $('focus-mode-time').classList.toggle('long-time', clock.length > 5);
    const orbital = state.effect === 'orbit';
    $('focus-mode-phase').textContent = orbital && view.overtime ? '추가 탐사 중' : $('timer-phase').textContent;
    $('focus-dialog').classList.toggle('orbit-overtime', view.overtime);
    $('focus-dialog').classList.toggle('orbit-paused', !running);
    $('focus-orbit-progress').style.strokeDashoffset = String(1030.44 * (1 - Math.min(1, view.elapsedMs / (focus.duration * 1000))));
    $('focus-mode-state').textContent = orbital && running ? view.overtime ? '시작을 넘어, 내 페이스로 탐사해요.' : '지금은 이 임무 하나에만' : $('timer-state').textContent;
    $('focus-mode-total').textContent = totalText;
    $('focus-mode-clock').setAttribute('aria-label', view.overtime ? '추가 집중 시간' : '처음 5분 남은 시간');
    $('focus-mode-toggle').textContent = $('timer-button').textContent;
    if (selectedTask()) $('pick-button').textContent = running ? '집중 화면 보기 ↗' : started ? '이 일 이어서 시작하기 ▶' : '▶ 바로 5분 시작';
  }
  function tick() {
    accountFocus();
    if (focus.elapsedMs >= focus.duration * 1000 && !focus.milestoneNotified) {
      focus.milestoneNotified = true;
      announce('5분 시작 성공! 이제 네 페이스로 이어가요. 추가 집중 시간을 계속 기록해요.');
      toast('5분 시작 성공! 이제 네 페이스로 이어가요.');
      save();
    } else if (focus.running && Date.now() - lastSavedAt >= 15000) save();
    renderTimer();
  }
  function timerToggle() {
    if (!selectedTask() || choosing) return;
    accountFocus();
    if (focus.running) {
      focus.running = false; focus.accountedAt = null;
      clearInterval(timerInterval); timerInterval = null; announce('타이머를 잠시 멈췄어요.');
    } else {
      focus.accountedAt = Date.now(); focus.running = true;
      clearInterval(timerInterval); timerInterval = setInterval(tick, 250);
      announce(`${selectedTask().title}, 타이머를 시작했어요.`);
    }
    save(); renderTimer();
  }
  function startFromResult() {
    if (choosing) return;
    if (!selectedTask()) { choose({ autoStart: true }); return; }
    if (!focus.running) timerToggle();
    openFocusMode();
  }
  function openFocusMode() {
    const task = selectedTask(); if (!task || choosing) return;
    $('focus-mode-task').textContent = task.title;
    $('focus-mode-context').hidden = !task.progressNote;
    $('focus-mode-note').hidden = !task.progressNote;
    $('focus-mode-note-text').textContent = task.progressNote || '';
    renderFocusTheme(); renderTimer();
    if (!$('focus-dialog').open) $('focus-dialog').showModal();
    document.body.classList.add('focus-mode-open');
    $('focus-mode-toggle').focus();
  }
  function closeFocusMode() { $('focus-dialog').close(); }
  function openProgressNote() {
    const task = selectedTask(); if (!task || choosing) return;
    accountFocus();
    if (focus.running) { focus.running = false; focus.accountedAt = null; clearInterval(timerInterval); timerInterval = null; }
    save(); renderTimer(); pendingNoteId = task.id;
    $('progress-task-title').textContent = task.title;
    $('progress-note').value = '';
    $('progress-dialog').showModal(); $('progress-note').focus();
  }
  function pauseToday(note = '') {
    const task = selectedTask(); if (!task || choosing || task.id !== pendingNoteId) return;
    if (note.trim()) task.progressNote = note.trim().slice(0, 300);
    $('progress-dialog').close();
    accountFocus(); task.pausedOn = E.localDate();
    resetFocus(); state.selectedId = null; save(); renderTasks(); renderDecision(); renderPlan();
    toast('오늘의 진행을 남겼어요. 일은 남아 있고 내일 다시 선택돼요.');
    if (E.eligible(state.tasks).length) choose();
  }
  function choose({ excludeId = null, autoStart = false } = {}) {
    if (choosing || (selectedTask() && !excludeId)) return;
    const candidates = state.tasks.filter(task => task.id !== excludeId);
    const selection = E.pick(candidates);
    if (!selection) {
      const message = excludeId ? '지금 할 수 있는 다른 일이 없어요.' : '할 일을 추가하거나, 잠시 제외한 일을 다시 포함해 주세요.';
      toast(message); announce(message); return;
    }
    choosing = true; updateLock(); resetFocus();
    state.selectedId = null; state.selectionExcludedId = excludeId;
    $('decision-rest').hidden = true; $('decision-result').hidden = true; $('reel').hidden = false;
    $('pick-button').textContent = '지금 할 일을 정하고 있어요…';
    announce('지금 할 일을 정하고 있어요.');
    const pool = E.eligible(candidates);
    let reelIndex = 0;
    function showReel() {
      const item = node('div', 'reel-item', pool[reelIndex++ % pool.length].title);
      $('reel-window').replaceChildren(item);
    }
    const skip = autoStart || $('skip-animation').checked || reducedMotion.matches;
    const dispatch = state.effect === 'dispatch' && !skip;
    const orbit = (state.effect === 'orbit' || impactThemes.includes(state.effect)) && !skip;
    let finished = false;
    finishPick = () => {
      if (finished) return; finished = true;
      clearInterval(reelInterval); clearTimeout(pickTimeout);
      reelInterval = null; pickTimeout = null;
      if (stopDispatch) { stopDispatch(); stopDispatch = null; }
      finishPick = null;
      state.selectedId = selection.task.id; choosing = false;
      if ($('orbit-dialog').open && !orbitPreview) $('orbit-title').textContent = selection.task.title;
      save(); renderTasks(); renderDecision(selection.tied); renderPlan();
      document.querySelector('.decision-panel').scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
      announce(`지금 할 일은 ${selection.task.title}. ${E.reason(selection.task, candidates, E.localDate(), selection.tied)}${selection.task.progressNote ? ' 지난 메모: ' + selection.task.progressNote : ''}`);
      if (autoStart) startFromResult();
    };
    $('skip-current-effect').hidden = skip;
    if (orbit) {
      $('reel').hidden = true;
      openOrbit(pool.map(task => task.title), selection.task.title, false);
    } else if (dispatch) {
      $('reel').hidden = true; $('dispatch-stage').hidden = false;
      stopDispatch = playDispatch($('dispatch-stage'), pool.map(task => task.title), selection.task.title);
    } else {
      showReel();
      if (!skip) reelInterval = setInterval(showReel, 110);
    }
    if (!orbit) pickTimeout = setTimeout(finishPick, skip ? 0 : dispatch ? 2350 : 1650);
  }
  // Both previews and real selections use the same visual; only choose() changes tasks.
  function playDispatch(stage, titles, winner, onFinish = () => {}) {
    stage.replaceChildren(); stage.classList.remove('dispatch-landed', 'dispatch-confirmed');
    const heading = node('p', 'dispatch-heading mono', 'RESCUE DISPATCH / 001');
    const deck = node('div', 'dispatch-deck');
    const card = node('div', 'dispatch-card');
    const label = node('span', 'dispatch-card-label mono', 'YOUR NEXT MISSION');
    const title = node('strong', 'dispatch-title', titles[0]);
    const stamp = node('span', 'dispatch-stamp', '출동 확정');
    card.append(label, title, stamp); deck.append(card);
    const caption = node('p', 'dispatch-caption', '출동할 임무 확인 중…');
    stage.append(heading, deck, caption);
    let index = 0;
    const cycle = setInterval(() => {
      title.textContent = titles[++index % titles.length];
      card.classList.remove('card-flip'); void card.offsetWidth; card.classList.add('card-flip');
    }, 125);
    const land = setTimeout(() => {
      clearInterval(cycle); card.classList.remove('card-flip'); title.textContent = winner;
      stage.classList.add('dispatch-landed'); caption.textContent = '고민은 여기까지. 일단 5분만.';
    }, 1200);
    const confirm = setTimeout(() => stage.classList.add('dispatch-confirmed'), 1480);
    const end = setTimeout(onFinish, 2350);
    return () => { clearInterval(cycle); clearTimeout(land); clearTimeout(confirm); clearTimeout(end); };
  }
  function renderEffects() {
    const effect = ['dispatch', 'orbit', ...impactThemes].includes(state.effect) ? state.effect : 'basic';
    $('effect-current').textContent = effectNames[effect];
    $('orbit-length').value = String(state.orbitLength === 1000 ? 1000 : 3000);
    $('orbit-sound').checked = state.orbitSound === true;
    renderFocusTheme(); renderTimer();
    document.querySelectorAll('.effect-apply').forEach(button => {
      const active = button.dataset.effect === effect;
      button.disabled = active; button.textContent = active ? '사용 중 ✓' : button.dataset.effect !== 'basic' ? '체험 적용' : '적용하기';
      button.closest('.effect-card').classList.toggle('effect-selected', active);
    });
  }
  function renderFocusTheme() {
    const orbital = state.effect === 'orbit';
    $('focus-dialog').classList.toggle('orbit-focus', orbital || impactThemes.includes(state.effect));
    $('focus-dialog').dataset.theme = state.effect;
    $('focus-dialog').querySelector('.focus-mode-header .eyebrow').textContent = orbital ? '✳ MAGAM RESCUE / DEEP FOCUS' : '✳ ONE THING AT A TIME.';
    $('focus-mode-kicker').textContent = orbital ? 'ORBITAL FOCUS / 002' : '지금은 이것 하나만.';
    $('focus-mode-title').textContent = orbital ? '현재 임무' : '시작은 작게';
    if (impactThemes.includes(state.effect)) {
      $('focus-dialog').querySelector('.focus-mode-header .eyebrow').textContent = '✳ MAGAM RESCUE / FOCUS';
      $('focus-mode-kicker').textContent = effectNames[state.effect];
      $('focus-mode-title').textContent = {breakout:'시작의 벽을 넘어서',overdrive:'집중 에너지 충전 중',capsule:'오늘의 작은 한 걸음',comic:'지금, 나의 장면'}[state.effect];
    }
  }
  function closePreview() {
    if (stopPreview) { stopPreview(); stopPreview = null; }
    $('effect-preview').hidden = true; $('preview-dispatch').disabled = false;
  }
  function previewDispatch() {
    closePreview(); $('effect-preview').hidden = false; $('preview-dispatch').disabled = true;
    $('preview-status').textContent = '예시 연출을 재생하고 있어요.';
    if (reducedMotion.matches) {
      $('preview-stage').replaceChildren(node('p', 'dispatch-caption', '구조대 출동 · 출동 확정'), node('strong', 'dispatch-title', '발표 자료 첫 장 만들기'));
      $('preview-status').textContent = '동작 줄이기 설정에 따라 정지 화면으로 보여드려요.';
      $('preview-dispatch').disabled = false;
    } else stopPreview = playDispatch($('preview-stage'), ['발표 자료 첫 장 만들기', '영어 단어 복습하기', '책상 위 정리하기'], '발표 자료 첫 장 만들기', () => {
      stopPreview = null; $('preview-status').textContent = '미리 보기 완료 · 내 할 일과 타이머는 그대로예요.';
      $('preview-dispatch').disabled = false;
    });
    $('effect-preview').scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'nearest' });
  }

  function openOrbit(titles, winner, preview, theme = state.effect) {
    if (stopOrbit) stopOrbit();
    orbitPreview = preview; previewTheme = theme;
    const dialog = $('orbit-dialog');
    dialog.dataset.theme = theme;
    dialog.querySelector('.orbit-brand small').textContent = {orbit:'ORBITAL DROP / 002',breakout:'BREAK OUT / 003',overdrive:'OVERDRIVE / 004',capsule:'CAPSULE DROP / 005',comic:'COMIC IMPACT / 006'}[theme];
    dialog.querySelector('.orbit-result-kicker').textContent = {orbit:'✦ MISSION LOCKED',breakout:'✹ 고민을 깨부숴',overdrive:'⚡ CHARGE COMPLETE',capsule:'오늘의 작은 시작',comic:'쾅! 지금은 이거다.'}[theme];
    dialog.querySelector('.orbit-result-copy').textContent = {orbit:'수많은 할 일 중, 지금은 이것 하나.',breakout:'시작의 벽을 깼어. 이제 한 걸음만.',overdrive:'준비 완료. 이 에너지를 시작으로.',capsule:'고민은 보관하고, 지금은 이것 하나.',comic:'다음 장면은, 너의 작은 시작.'}[theme];
    dialog.classList.remove('orbit-ready'); dialog.dataset.phase = '0';
    $('orbit-announcement').textContent = '';
    $('orbit-title').textContent = winner;
    $('orbit-start').hidden = preview; $('orbit-start').disabled = true;
    $('orbit-reroll').hidden = false; $('orbit-reroll').disabled = true;
    $('orbit-replay').hidden = true; $('orbit-replay').disabled = true;
    $('orbit-close').textContent = '건너뛰기 ↗';
    $('orbit-purpose').textContent = preview ? 'PREVIEW / 예시 할 일' : 'YOUR NEXT MOVE, CONFIRMED.';
    $('orbit-result-note').textContent = preview ? effectNames[theme] + ' · 예시 할 일로 체험 중' : '고민은 여기까지. 일단 5분만.';
    document.body.classList.add('orbit-open');
    if (!dialog.open) dialog.showModal();
    stopOrbit = (theme === 'capsule' ? window.playCapsuleReveal : impactThemes.includes(theme) ? window.playImpactReveal : window.playOrbitalReveal)({
      theme,
      titles, winner, duration: state.orbitLength === 1000 ? 1000 : theme === 'capsule' ? 3500 : 3000,
      sound: state.orbitSound === true, reduced: reducedMotion.matches,
      onReady() {
        if (!preview && finishPick) finishPick();
        dialog.classList.add('orbit-ready');
        $('orbit-start').disabled = false; $('orbit-replay').disabled = false; $('orbit-reroll').disabled = false;
        $('orbit-close').textContent = preview ? '연출 선택으로 ↙' : '목록으로 ↙';
        $('orbit-announcement').textContent = preview ? `미리 보기 완료. 예시 임무: ${winner}` : `오늘의 임무: ${winner}. 5분 시작 버튼을 눌러 시작하세요.`;
      }
    });
  }
  function endOrbit() {
    if (stopOrbit) { stopOrbit(); stopOrbit = null; }
    if (!orbitPreview && finishPick) finishPick();
    document.body.classList.remove('orbit-open');
  }
  function previewOrbit(theme = 'orbit', excludeTitle = null) {
    closePreview();
    const titles = ['발표 자료 첫 장 만들기', '영어 단어 복습하기', '책상 위 정리하기', 'AI 활용 공부하기'];
    const candidates = titles.filter(title => title !== excludeTitle);
    const winner = excludeTitle ? candidates[Math.floor(Math.random() * candidates.length)] : titles[0];
    openOrbit(titles, winner, true, theme);
  }

  function openTask(id) {
    if (choosing) return;
    if (state.tasks.length >= 100 && !id) { toast('목록에는 최대 100개까지 담을 수 있어요. 끝낸 일을 정리해 주세요.'); return; }
    editingId = id || null;
    const task = state.tasks.find(item => item.id === id);
    $('task-form').reset();
    $('task-dialog').querySelector('.extra-fields').open = false;
    $('task-dialog-title').textContent = task ? '할 일 조금 다듬기' : '할 일 하나 꺼내놓기';
    $('save-task').textContent = task ? '수정한 내용 저장하기 ↗' : '목록에 내려놓기 ＋';
    $('task-name').value = task?.title || '';
    $('task-category').value = task?.category || 'assignment';
    $('task-due').value = task?.due || '';
    $('task-no-due').checked = !task?.due; syncDeadline();
    $('task-importance').value = task?.importance || 'normal';
    $('task-effort').value = task?.effort || '25';
    $('task-dialog').showModal(); $('task-name').focus();
  }
  function saveTask(event) {
    event.preventDefault();
    const title = $('task-name').value.trim();
    if (!title) { $('task-name').setCustomValidity('할 일 이름을 한 글자 이상 적어 주세요.'); $('task-name').reportValidity(); return; }
    $('task-name').setCustomValidity('');
    const existing = state.tasks.find(task => task.id === editingId);
    const task = {
      ...(existing || { id: uid(), createdAt: Date.now(), doneAt: null, deferredOn: null, deferReason: '' }),
      title, category: $('task-category').value, due: $('task-no-due').checked ? '' : $('task-due').value, importance: $('task-importance').value,
      effort: Number($('task-effort').value)
    };
    if (existing) state.tasks[state.tasks.indexOf(existing)] = task;
    else state.tasks.push(task);
    state.sample = false;
    $('task-dialog').close(); save(); renderTasks(); renderDecision(); renderPlan();
    toast(existing ? '할 일을 수정했어요.' : '머릿속 할 일 하나를 내려놓았어요.');
  }
  function confirmChange(title, description, button, callback) {
    pendingConfirmation = callback; $('confirm-title').textContent = title; $('confirm-description').textContent = description;
    $('confirm-action').textContent = button; $('confirm-dialog').showModal();
  }
  function replaceTasks(useSamples) {
    confirmChange(useSamples ? '예시로 다시 살펴볼까요?' : '목록을 비우고 시작할까요?', '기존 할 일과 완료 기록, 진행 중인 타이머가 지워져요.', useSamples ? '예시 불러오기' : '목록 비우기', () => {
      resetFocus(); state.activity = {}; state.tasks = useSamples ? samples() : []; state.sample = useSamples; state.selectedId = null;
      save(); renderTasks(); renderDecision(); renderPlan(); toast(useSamples ? '예시 할 일을 불러왔어요.' : '비웠어요. 지금 떠오르는 일 하나부터 적어봐요.');
    });
  }
  function completeTask() {
    const task = selectedTask(); if (!task || choosing) return;
    accountFocus(); task.doneAt = Date.now(); resetFocus(); state.selectedId = null; save(); renderTasks(); renderDecision(); renderPlan();
    toast(`‘${task.title}’ 완료! 다음 할 일도 정해줄게요.`);
    if (E.eligible(state.tasks).length) choose(); else announce('지금 할 수 있는 일을 모두 끝냈어요.');
  }
  function deferTask(reason) {
    const task = selectedTask(); if (!task || choosing) return;
    accountFocus(); task.deferredOn = E.localDate(); task.deferReason = reason;
    $('defer-dialog').close(); resetFocus(); state.selectedId = null; save(); renderTasks(); renderDecision(); renderPlan();
    toast('이 일은 오늘 잠시 제외했어요. 다시 가능한 때 목록에서 포함해 주세요.');
    if (E.eligible(state.tasks).length) choose();
  }
  function renderPlan() {
    const tasks = E.bigThree(state.tasks, state.selectedId);
    $('big3-list').replaceChildren();
    for (const [index, task] of tasks.entries()) {
      const item = node('li'); const copy = node('span', '', task.title);
      copy.append(node('small', '', `${E.dueLabel(task)} · 오늘 ${task.effort}분`));
      item.append(node('span', '', String(index + 1).padStart(2, '0')), copy); $('big3-list').append(item);
    }
    if (!tasks.length) $('big3-list').append(node('li', '', '지금 가능한 할 일을 추가하면 여기에 보여드려요.'));
    if (planShown) generatePlan();
  }
  function generatePlan(event) {
    if (event) event.preventDefault();
    planShown = true;
    const tasks = E.bigThree(state.tasks, state.selectedId);
    const output = E.plan(tasks, $('plan-start').value, $('plan-end').value);
    $('timeline').replaceChildren();
    if (output.error) { $('plan-message').textContent = output.error; return; }
    if (!tasks.length) { $('plan-message').textContent = '배정할 할 일이 없어요. 목록에 지금 가능한 일을 추가해 주세요.'; return; }
    const otherCount = E.eligible(state.tasks).length - tasks.length;
    $('plan-message').textContent = (output.unallocated ? `선택한 시간에 ${output.unallocated}분을 배정하지 못했어요. 남은 분량은 다른 시간에 계획해 주세요.` : '오늘 집중할 시간이에요. 끝내야 하는 시각이 아니라, 집중을 멈추고 확인할 시각이에요.') + (otherCount > 0 ? ` 그 밖의 ${otherCount}개는 다음 우선순위로 남겨뒀어요.` : '');
    for (const block of output.blocks) {
      const item = node('li', block.type === 'break' ? 'break-item' : '');
      const time = node('time', '', `${E.formatTime(block.start)} — ${E.formatTime(block.end)}`);
      item.append(time, document.createTextNode(block.type === 'break' ? '잠깐 쉬기 · 5분' : `${block.task.title}${block.partial ? ' · 일부 시간만 배정' : ''}`));
      $('timeline').append(item);
    }
  }
  function rollover() {
    const nextDay = E.localDate(); if (nextDay === currentDay) return;
    currentDay = nextDay; updateDate();
    renderTasks(); renderPlan();
    if (!choosing) renderDecision();
  }
  function updateDate() { $('today-label').textContent = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date()); $('today-label').dateTime = E.localDate(); }

  $('preview-orbit').addEventListener('click', () => previewOrbit('orbit'));
  $('orbit-length').addEventListener('change', () => { state.orbitLength = Number($('orbit-length').value); save(); });
  $('orbit-sound').addEventListener('change', () => { state.orbitSound = $('orbit-sound').checked; save(); });
  $('orbit-close').addEventListener('click', () => $('orbit-dialog').close());
  $('orbit-dialog').addEventListener('close', endOrbit);
  $('orbit-dialog').addEventListener('cancel', endOrbit);
  $('orbit-replay').addEventListener('click', () => previewOrbit(previewTheme));
  document.querySelectorAll('.impact-preview').forEach(button => button.addEventListener('click', () => previewOrbit(button.dataset.theme)));
  $('orbit-reroll').addEventListener('click', () => {
    if (orbitPreview) {
      if ($('orbit-reroll').disabled) return;
      previewOrbit(previewTheme, $('orbit-title').textContent); return;
    }
    const task = selectedTask(); if (!task || choosing || orbitPreview) return;
    if (!E.eligible(state.tasks.filter(item => item.id !== task.id)).length) {
      $('orbit-result-note').textContent = '지금 할 수 있는 다른 일이 없어요. 이 임무로 시작해 볼까요?';
      $('orbit-announcement').textContent = '지금 할 수 있는 다른 일이 없어요. 현재 임무를 유지해요.';
      return;
    }
    choose({ excludeId: task.id });
  });
  $('orbit-start').addEventListener('click', () => { $('orbit-dialog').close(); endOrbit(); startFromResult(); });
  $('open-effects').addEventListener('click', () => { renderEffects(); $('effects-dialog').showModal(); });
  $('preview-dispatch').addEventListener('click', previewDispatch);
  $('close-effect-preview').addEventListener('click', closePreview);
  $('effects-dialog').addEventListener('close', closePreview);
  document.querySelectorAll('.effect-apply').forEach(button => button.addEventListener('click', () => {
    state.effect = button.dataset.effect; save(); renderEffects(); $('effects-dialog').close();
    toast(effectNames[state.effect] + (state.effect === 'basic' ? '을 적용했어요.' : ' 테마를 체험 적용했어요.'));
  }));
  $('skip-current-effect').addEventListener('click', () => { if (finishPick) finishPick(); });
  $('add-task').addEventListener('click', () => openTask());
  $('add-task-bottom').addEventListener('click', () => openTask());
  $('task-form').addEventListener('submit', saveTask);
  $('task-name').addEventListener('input', () => $('task-name').setCustomValidity(''));
  $('pick-button').addEventListener('click', () => { if (selectedTask()) startFromResult(); else choose(); });
  $('quick-start').addEventListener('click', startFromResult);
  $('reroll-button').addEventListener('click', () => { const task = selectedTask(); if (task) choose({ excludeId: task.id }); });
  $('pause-today-button').addEventListener('click', openProgressNote);
  $('open-focus').addEventListener('click', openFocusMode);
  $('close-focus').addEventListener('click', closeFocusMode);
  $('focus-dialog').addEventListener('close', () => document.body.classList.remove('focus-mode-open'));
  $('focus-mode-toggle').addEventListener('click', timerToggle);
  $('focus-mode-pause').addEventListener('click', () => { closeFocusMode(); openProgressNote(); });
  $('focus-mode-complete').addEventListener('click', () => { closeFocusMode(); completeTask(); });
  $('progress-form').addEventListener('submit', event => { event.preventDefault(); pauseToday($('progress-note').value); });
  $('progress-skip').addEventListener('click', () => pauseToday());
  $('progress-dialog').addEventListener('close', () => { pendingNoteId = null; });
  function syncDeadline() {
    // 날짜는 항상 직접 선택할 수 있고, 선택 여부에 따라 마감 없음을 맞춥니다.
    $('task-due').required = !$('task-no-due').checked;
  }
  $('task-no-due').addEventListener('change', () => {
    if ($('task-no-due').checked) $('task-due').value = '';
    syncDeadline();
  });
  function syncSelectedDate() {
    $('task-no-due').checked = !$('task-due').value;
    syncDeadline();
  }
  $('task-due').addEventListener('input', syncSelectedDate);
  $('task-due').addEventListener('change', syncSelectedDate);
  $('task-due').addEventListener('click', () => {
    // 지원하는 브라우저에서는 아이콘뿐 아니라 날짜 칸 전체로 달력을 엽니다.
    try { $('task-due').showPicker?.(); } catch (error) { /* 기본 날짜 입력으로 계속합니다. */ }
  });
  $('timer-button').addEventListener('click', timerToggle);
  $('complete-button').addEventListener('click', completeTask);
  $('defer-button').addEventListener('click', () => $('defer-dialog').showModal());
  $('sample-button').addEventListener('click', () => replaceTasks(true));
  $('clear-button').addEventListener('click', () => replaceTasks(false));
  $('plan-form').addEventListener('submit', generatePlan);
  $('plan-start').addEventListener('change', () => { if (planShown) generatePlan(); });
  $('plan-end').addEventListener('change', () => { if (planShown) generatePlan(); });
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  document.querySelectorAll('[data-defer]').forEach(button => button.addEventListener('click', () => deferTask(button.dataset.defer)));
  $('confirm-action').addEventListener('click', () => { const action = pendingConfirmation; pendingConfirmation = null; $('confirm-dialog').close(); if (action) action(); });
  $('confirm-dialog').addEventListener('close', () => { pendingConfirmation = null; });
  for (const id of ['task-list', 'completed-list']) $(id).addEventListener('click', event => {
    const button = event.target.closest('button[data-id]'); if (!button || choosing) return;
    const task = state.tasks.find(item => item.id === button.dataset.id); if (!task) return;
    if (button.classList.contains('edit-task')) { openTask(task.id); return; }
    if (button.classList.contains('delete-task')) {
      confirmChange('이 할 일을 지울까요?', task.title, '삭제하기', () => {
        if (state.selectedId === task.id) { resetFocus(); state.selectedId = null; }
        state.tasks = state.tasks.filter(item => item.id !== task.id); state.sample = false;
        save(); renderTasks(); renderDecision(); renderPlan(); toast('할 일을 삭제했어요.');
      }); return;
    }
    if (button.classList.contains('restore-task')) { task.pausedOn = null; task.deferredOn = null; task.deferReason = ''; }
    if (button.classList.contains('undo-task')) { task.doneAt = null; task.pausedOn = null; task.deferredOn = null; }
    save(); renderTasks(); renderDecision(); renderPlan();
  });
  document.addEventListener('visibilitychange', () => { rollover(); if (!document.hidden) tick(); });
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  load(); renderEffects(); updateDate(); renderTasks(); renderDecision(); renderPlan(); save();
  $('skip-animation').checked = reducedMotion.matches;
  if (focus.running) { tick(); timerInterval = setInterval(tick, 250); }
  setInterval(rollover, 60000);
})();
