(function () {
  'use strict';
  const E = window.RescueEngine;
  const $ = id => document.getElementById(id);
  const STORAGE_KEY = 'magam-rescue-v1';
  const categoryNames = { assignment: '과제·발표', study: '시험·공부', life: '일상·정리', other: '그 밖의 일' };
  const importanceNames = { high: '중요도 높음', normal: '중요도 보통', low: '중요도 낮음' };
  let state = { tasks: [], sample: true, selectedId: null, focus: null, activity: {} };
  let editingId = null, choosing = false, timerInterval = null, reelInterval = null, pickTimeout = null;
  let toastTimeout = null, pendingConfirmation = null, storageAvailable = true, planShown = false;
  let currentDay = E.localDate();
  const freshFocus = () => ({ remaining: 300, duration: 300, endAt: null, accountedAt: null, dayMs: {}, countedDays: [] });
  let focus = freshFocus(), lastSavedAt = 0;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function uid() { return window.crypto?.randomUUID ? window.crypto.randomUUID() : `task-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
  function dateOffset(days) { const date = new Date(); date.setDate(date.getDate() + days); return E.localDate(date); }
  function samples() {
    return [
      { id: uid(), title: '홈페이지 첫 화면 만들기', category: 'assignment', due: dateOffset(1), importance: 'high', effort: 25, first: '작업 파일을 열고, 첫 화면에 들어갈 제목 한 줄을 적어요.' },
      { id: uid(), title: '영어 3단원 시험 공부', category: 'study', due: dateOffset(2), importance: 'normal', effort: 45, first: '교재 3단원을 펴고, 첫 번째 문제에 표시해요.' },
      { id: uid(), title: '책상 위 정리하기', category: 'life', due: '', importance: 'low', effort: 15, first: '책상 위 쓰레기 하나만 집어서 버려요.' }
    ].map((task, index) => ({ ...task, createdAt: Date.now() + index, doneAt: null, deferredOn: null, deferReason: '' }));
  }
  function isTask(task) {
    return task && typeof task.id === 'string' && typeof task.title === 'string' && task.title.trim().length > 0 && task.title.length <= 60
      && Object.hasOwn(categoryNames, task.category) && Object.hasOwn(importanceNames, task.importance)
      && Number.isFinite(task.createdAt) && [15, 25, 45, 60].includes(task.effort)
      && typeof task.first === 'string' && task.first.length <= 100
      && typeof task.due === 'string' && (!task.due || /^\d{4}-\d{2}-\d{2}$/.test(task.due))
      && (!task.doneAt || Number.isFinite(task.doneAt));
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) { state.tasks = samples(); return; }
      const saved = JSON.parse(raw);
      if (!Array.isArray(saved.tasks) || !saved.tasks.every(isTask)) throw new Error('invalid saved tasks');
      state = { tasks: saved.tasks.slice(0, 100), sample: Boolean(saved.sample), selectedId: saved.selectedId || null, focus: saved.focus || null, activity: Object.fromEntries(Object.entries(saved.activity || {}).filter(([key, value]) => /^\d{4}-\d{2}-\d{2}$/.test(key) && value && Number.isFinite(value.milliseconds) && value.milliseconds >= 0 && Number.isFinite(value.starts) && value.starts >= 0)) };
      const selected = selectedTask();
      if (!selected || selected.doneAt || selected.deferredOn === currentDay || selected.pausedOn === currentDay) { state.selectedId = null; state.focus = null; }
      if (state.selectedId && state.focus && Number.isFinite(state.focus.remaining) && state.focus.remaining >= 0 && Number.isFinite(state.focus.duration) && state.focus.duration > 0 && state.focus.duration <= 3600) {
        const savedFocus = state.focus;
        focus = { ...freshFocus(), remaining: Math.min(savedFocus.remaining, 3600), duration: savedFocus.duration,
          endAt: Number.isFinite(savedFocus.endAt) ? savedFocus.endAt : null,
          accountedAt: Number.isFinite(savedFocus.accountedAt) ? savedFocus.accountedAt : savedFocus.endAt ? savedFocus.endAt - savedFocus.remaining * 1000 : null,
          dayMs: savedFocus.dayMs || {}, countedDays: Array.isArray(savedFocus.countedDays) ? savedFocus.countedDays : [] };

      }
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
      if (deferred) {
        const reason = node('div', 'defer-reason'); reason.append(node('span', '', paused ? '오늘은 여기까지 · 일은 계속 남아 있어요' : `잠시 제외 · ${task.deferReason || '지금은 어려워요'}`), actionButton('다시 포함', 'restore-task', task.id)); item.append(reason);
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
    $('reel').hidden = true;
    $('defer-button').hidden = !selected;
    if (selected) {
      $('result-title').textContent = selected.title;
      $('result-reason').textContent = E.reason(selected, state.tasks, E.localDate(), tieCount);
      $('result-action').textContent = selected.first || E.firstSteps[selected.category];
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
      $('decision-rest').querySelector('.machine-small').textContent = pending.length && !possible.length ? '다시 가능한 일은 목록에서 ‘다시 포함’을 눌러요.' : !pending.length && hasDone ? '작은 시작이 모여 여기까지. 잘 마무리했어요.' : '버튼 한 번이면, 지금 할 일 하나.';
      $('pick-button').textContent = '지금 할 일 정해줘 ✳';
      $('timer-caption').textContent = '할 일이 정해지면 5분만 같이 해봐요.';
    }
    updateLock(); renderTimer();
  }
  function updateLock() {
    const selected = Boolean(selectedTask());
    $('pick-button').disabled = choosing || (!selected && !E.eligible(state.tasks).length);
    $('defer-button').disabled = choosing;
    for (const el of document.querySelectorAll('.task-menu button, .restore-task, .undo-task, #add-task, #add-task-bottom, #sample-button, #clear-button')) el.disabled = choosing;
    $('skip-animation').disabled = choosing;
    $('complete-button').disabled = choosing || !selected;
    $('timer-button').disabled = choosing || !selected;
    $('pause-today-button').disabled = choosing || !selected;
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
    if (task && result.elapsed > 0) task.lastWorkedAt = focus.accountedAt;
    renderStats();
  }
  function resetFocus() {
    accountFocus(); clearInterval(timerInterval); timerInterval = null; focus = freshFocus();
    renderTimer();
  }
  function renderTimer() {
    const remaining = Math.ceil(focus.endAt ? Math.max(0, (focus.endAt - Date.now()) / 1000) : focus.remaining);
    const running = Boolean(focus.endAt) && remaining > 0;
    const finished = remaining === 0;
    $('timer-display').textContent = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
    $('timer-progress').style.strokeDashoffset = `${552.92 * (1 - Math.min(1, remaining / focus.duration))}`;
    $('timer-face').classList.toggle('running', running); $('timer-face').classList.toggle('finished', finished);
    $('timer-state').textContent = finished ? '시작해낸 5분, 수고했어요' : running ? '지금은 이것 하나에만' : remaining < focus.duration ? '잠깐 쉬는 중' : '작은 시작, 충분한 5분';
    $('timer-button').textContent = running ? '잠깐 멈추기 Ⅱ' : finished ? '5분 더 하기 ▶' : remaining < focus.duration ? '이어서 시작하기 ▶' : '5분 시작하기 ▶';
    if (selectedTask()) $('pick-button').textContent = running ? '집중 화면 보기 ↓' : finished ? '이 일로 5분 더 하기 ▶' : remaining < focus.duration ? '이 일 이어서 시작하기 ▶' : '이 일로 5분 시작하기 ▶';
  }
  function tick() {
    accountFocus();
    if (focus.endAt && focus.remaining <= 0) {
      focus.endAt = null; clearInterval(timerInterval); timerInterval = null; save();
      announce('5분이 지났어요. 더 이어가거나 오늘은 여기까지를 눌러요. 일 전체 완료는 따로 선택해요.');
      toast('5분을 시작해냈어요. 더 이어가도, 오늘은 여기까지 해도 좋아요.');
    } else if (focus.endAt && Date.now() - lastSavedAt >= 15000) save();
    renderTimer();
  }
  function timerToggle() {
    if (!selectedTask() || choosing) return;
    accountFocus();
    if (focus.endAt && focus.remaining > 0) {
      focus.endAt = null; focus.accountedAt = null;
      clearInterval(timerInterval); timerInterval = null; announce('타이머를 잠시 멈췄어요.');
    } else {
      if (focus.remaining <= 0) focus = freshFocus();
      focus.accountedAt = Date.now(); focus.endAt = focus.accountedAt + focus.remaining * 1000;
      clearInterval(timerInterval); timerInterval = setInterval(tick, 250);
      announce(`${selectedTask().title}, 타이머를 시작했어요.`);
    }
    save(); renderTimer();
  }
  function startFromResult() {
    if (!selectedTask()) { choose(); return; }
    if (!focus.endAt || focus.endAt <= Date.now()) timerToggle();
    document.querySelector('.focus-panel').scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'center' });
    $('timer-button').focus({ preventScroll: true });
  }
  function pauseToday() {
    const task = selectedTask(); if (!task || choosing) return;
    accountFocus(); task.pausedOn = E.localDate();
    resetFocus(); state.selectedId = null; save(); renderTasks(); renderDecision(); renderPlan();
    toast('오늘의 진행을 남겼어요. 일은 남아 있고 내일 다시 선택돼요.');
    if (E.eligible(state.tasks).length) choose();
  }
  function choose() {
    if (choosing || selectedTask()) return;
    const selection = E.pick(state.tasks);
    if (!selection) { renderDecision(); toast('할 일을 추가하거나, 잠시 제외한 일을 다시 포함해 주세요.'); return; }
    choosing = true; updateLock(); resetFocus();
    $('decision-rest').hidden = true; $('decision-result').hidden = true; $('reel').hidden = false;
    $('pick-button').textContent = '지금 할 일을 정하고 있어요…';
    announce('지금 할 일을 정하고 있어요.');
    const pool = E.eligible(state.tasks);
    let reelIndex = 0;
    function showReel() {
      const item = node('div', 'reel-item', pool[reelIndex++ % pool.length].title);
      $('reel-window').replaceChildren(item);
    }
    showReel();
    const skip = $('skip-animation').checked || reducedMotion.matches;
    if (!skip) reelInterval = setInterval(showReel, 110);
    pickTimeout = setTimeout(() => {
      clearInterval(reelInterval); reelInterval = null; pickTimeout = null;
      state.selectedId = selection.task.id; choosing = false;
      save(); renderTasks(); renderDecision(selection.tied); renderPlan();
      document.querySelector('.decision-panel').scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
      announce(`지금 할 일은 ${selection.task.title}. ${E.reason(selection.task, state.tasks, E.localDate(), selection.tied)} 첫 행동: ${selection.task.first || E.firstSteps[selection.task.category]}`);
    }, skip ? 0 : 1650);
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
    $('task-first').value = task?.first || '';
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
      effort: Number($('task-effort').value), first: $('task-first').value.trim()
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

  $('add-task').addEventListener('click', () => openTask());
  $('add-task-bottom').addEventListener('click', () => openTask());
  $('task-form').addEventListener('submit', saveTask);
  $('task-name').addEventListener('input', () => $('task-name').setCustomValidity(''));
  $('pick-button').addEventListener('click', startFromResult);
  $('pause-today-button').addEventListener('click', pauseToday);
  function syncDeadline() {
    $('task-due').disabled = $('task-no-due').checked;
    $('task-due').required = !$('task-no-due').checked;
  }
  $('task-no-due').addEventListener('change', syncDeadline);
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
  load(); updateDate(); renderTasks(); renderDecision(); renderPlan(); save();
  $('skip-animation').checked = reducedMotion.matches;
  if (focus.endAt) { tick(); if (focus.endAt) timerInterval = setInterval(tick, 250); }
  setInterval(rollover, 60000);
})();
