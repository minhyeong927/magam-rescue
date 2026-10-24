/* 마감구조대의 선택·시간 배정 규칙. 서버나 AI 호출 없이 동작합니다. */
(function (root) {
  'use strict';
  const importance = { high: 0, normal: 1, low: 2 };
  function localDate(date = new Date()) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }
  function eligible(tasks, today = localDate()) {
    return tasks.filter(task => !task.doneAt && task.deferredOn !== today && task.pausedOn !== today);
  }
  function waitingDays(task, today = localDate()) {
    const last = task.lastWorkedAt || task.createdAt;
    return Math.min(30, Math.max(0, dayDifference(today, localDate(new Date(last)))));
  }
  function score(task, today = localDate()) {
    return ({ high: 40, normal: 20, low: 0 }[task.importance] ?? 20) + waitingDays(task, today) * 2;
  }
  function compare(a, b, today = localDate()) {
    const daysA = dayDifference(a.due, today), daysB = dayDifference(b.due, today);
    const urgentA = daysA !== null && daysA <= 3, urgentB = daysB !== null && daysB <= 3;
    if (urgentA !== urgentB) return urgentA ? -1 : 1;
    if (urgentA) return daysA - daysB || ((importance[a.importance] ?? 1) - (importance[b.importance] ?? 1));
    return score(b, today) - score(a, today);
  }
  function rank(tasks, today = localDate()) {
    return eligible(tasks, today).slice().sort((a, b) => compare(a, b, today) || a.createdAt - b.createdAt);
  }
  function pick(tasks, today = localDate(), random = Math.random) {
    const ordered = rank(tasks, today);
    if (!ordered.length) return null;
    const tied = ordered.filter(task => compare(task, ordered[0], today) === 0);
    const index = Math.min(tied.length - 1, Math.max(0, Math.floor(random() * tied.length)));
    return { task: tied[index], tied: tied.length };
  }
  function dayDifference(due, today = localDate()) {
    if (!due) return null;
    const parse = value => {
      const [y, m, d] = value.split('-').map(Number);
      return Date.UTC(y, m - 1, d);
    };
    return Math.round((parse(due) - parse(today)) / 86400000);
  }
  function dueLabel(task, today = localDate()) {
    const days = dayDifference(task.due, today);
    if (days === null) return '마감 없음';
    if (days < 0) return `마감 ${Math.abs(days)}일 지남`;
    if (days === 0) return '오늘 마감';
    if (days === 1) return '내일 마감';
    return `D-${days}`;
  }
  function reason(task, tasks, today = localDate(), tieCount) {
    const active = eligible(tasks, today);
    if (active.some(other => compare(other, task, today) < 0)) {
      return '앞서 정한 일이에요. 다음 선택에서 바뀐 우선순위를 반영해요. 지금은 이 일에 5분만 집중해봐요.';
    }
    const days = dayDifference(task.due, today);
    let text;
    if (days !== null && days < 0) text = '마감이 지난 일이에요. 늦어진 일부터 챙겨봐요.';
    else if (days === 0) text = '오늘 마감이에요. 가장 먼저 챙겨야 할 일이에요.';
    else if (days !== null && days <= 3) text = `${days}일 뒤 마감이에요. 3일 안에 마감인 일을 먼저 챙겨요.`;
    else {
      const waiting = waitingDays(task, today);
      text = `임박한 마감이 없어 중요도와 손대지 않은 기간을 함께 반영했어요. 중요도는 ${{high:'높음',normal:'보통',low:'낮음'}[task.importance] || '보통'}이에요.`;
      if (waiting > 0) text += ` ${waiting === 30 ? '30일 이상' : waiting + '일'} 동안 손대지 않아 우선순위를 높였어요.`;
    }
    const count = tieCount ?? active.filter(other => compare(task, other, today) === 0).length;
    if (count > 1) text += ` 같은 우선순위 ${count}개 중 추첨했어요.`;
    return text;
  }
  function freshFocus() {
    return { version: 2, elapsedMs: 0, duration: 300, running: false, accountedAt: null, milestoneNotified: false, dayMs: {}, countedDays: [] };
  }
  function restoreFocus(saved, now = Date.now()) {
    const next = freshFocus();
    if (!saved || typeof saved !== 'object') return next;
    next.dayMs = saved.dayMs || {};
    next.countedDays = Array.isArray(saved.countedDays) ? saved.countedDays : [];
    if (saved.version === 2 && Number.isFinite(saved.elapsedMs) && saved.elapsedMs >= 0) {
      next.elapsedMs = saved.elapsedMs;
      next.running = saved.running === true;
      next.accountedAt = next.running && Number.isFinite(saved.accountedAt) ? saved.accountedAt : next.running ? now : null;
      next.milestoneNotified = Boolean(saved.milestoneNotified);
    } else if (Number.isFinite(saved.remaining) && Number.isFinite(saved.duration) && saved.duration > 0) {
      // 이전 버전은 5분에서 멈췄으므로, 업데이트 이전의 초과 시간을 소급하지 않습니다.
      next.elapsedMs = Math.max(0, Math.min(300, saved.duration - saved.remaining)) * 1000;
      if (Number.isFinite(saved.endAt)) {
        const boundary = Math.min(now, saved.endAt);
        const last = Number.isFinite(saved.accountedAt) ? saved.accountedAt : saved.endAt - saved.remaining * 1000;
        next.elapsedMs = Math.min(300000, next.elapsedMs + Math.max(0, boundary - last));
        next.running = saved.endAt > now;
        // 아직 집계되지 않은 구버전 시간은 다음 accrue에서 한 번만 기록합니다.
        next.legacyUntil = boundary;
        next.legacyAccountedAt = last;
        next.accountedAt = next.running ? now : null;
      }
      next.milestoneNotified = next.elapsedMs >= 300000;
    }
    return next;
  }
  function focusView(focus, now = Date.now()) {
    const elapsedMs = focus.elapsedMs + (focus.running && Number.isFinite(focus.accountedAt) ? Math.max(0, now - focus.accountedAt) : 0);
    const overtime = elapsedMs >= focus.duration * 1000;
    return { elapsedMs, overtime, seconds: overtime ? Math.floor((elapsedMs - focus.duration * 1000) / 1000) : Math.ceil((focus.duration * 1000 - elapsedMs) / 1000) };
  }
  // 실행 시간만 기록하며, 5분 이후에도 같은 세션을 계속 집계합니다.
  function accrue(activity, focus, now = Date.now()) {
    const next = { ...focus, dayMs: { ...(focus.dayMs || {}) }, countedDays: [...(focus.countedDays || [])] };
    const days = Object.fromEntries(Object.entries(activity).map(([key, value]) => [key, { ...value }]));
    let lastAt = null;
    function record(start, end) {
      if (end > start) lastAt = end;
      let cursor = start;
      while (cursor < end) {
        const date = new Date(cursor), key = localDate(date);
        const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
        const length = Math.min(end, midnight) - cursor;
        days[key] ||= { milliseconds: 0, starts: 0 };
        days[key].milliseconds += length;
        next.dayMs[key] = (next.dayMs[key] || 0) + length;
        if (next.dayMs[key] >= 1000 && !next.countedDays.includes(key)) {
          days[key].starts += 1; next.countedDays.push(key);
        }
        cursor += length;
      }
    }
    let elapsed = 0;
    if (Number.isFinite(next.legacyUntil) && Number.isFinite(next.legacyAccountedAt)) {
      const end = Math.max(next.legacyAccountedAt, next.legacyUntil);
      record(next.legacyAccountedAt, end); elapsed += end - next.legacyAccountedAt;
      delete next.legacyUntil; delete next.legacyAccountedAt;
    }
    if (next.running && Number.isFinite(next.accountedAt)) {
      const end = Math.max(next.accountedAt, now);
      const delta = end - next.accountedAt;
      record(next.accountedAt, end); elapsed += delta;
      next.elapsedMs += delta; next.accountedAt = end;
    }
    return { activity: days, focus: next, elapsed, lastAt };
  }
  function bigThree(tasks, selectedId, today = localDate()) {
    const ordered = rank(tasks, today);
    const current = ordered.find(task => task.id === selectedId);
    return (current ? [current, ...ordered.filter(task => task.id !== selectedId)] : ordered).slice(0, 3);
  }
  function timeValue(value) {
    if (!/^\d{2}:\d{2}$/.test(value)) return NaN;
    const [hour, minute] = value.split(':').map(Number);
    return hour < 24 && minute < 60 ? hour * 60 + minute : NaN;
  }
  function formatTime(minutes) {
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  }
  function plan(tasks, startValue, endValue) {
    const start = timeValue(startValue), end = timeValue(endValue);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return { error: '종료 시간을 시작 시간보다 늦게 정해 주세요. 하루 안의 시간만 배정해요.' };
    }
    let cursor = start;
    const blocks = [];
    let unallocated = 0;
    for (const [index, task] of tasks.entries()) {
      const requested = Number(task.effort) || 25;
      if (index > 0 && cursor < end) {
        if (end - cursor <= 5) { unallocated += requested; continue; }
        blocks.push({ type: 'break', start: cursor, end: cursor + 5 });
        cursor += 5;
      }
      const length = Math.min(requested, end - cursor);
      if (length > 0) {
        blocks.push({ type: 'task', task, start: cursor, end: cursor + length, partial: length < requested });
        cursor += length;
      }
      unallocated += requested - Math.max(length, 0);
    }
    return { blocks, unallocated, unused: end - cursor };
  }
  const engine = Object.freeze({ freshFocus, restoreFocus, focusView, accrue, waitingDays, score, localDate, eligible, compare, rank, pick, dayDifference, dueLabel, reason, bigThree, plan, formatTime });
  root.RescueEngine = engine;
  if (typeof module !== 'undefined' && module.exports) module.exports = engine;
})(globalThis);
