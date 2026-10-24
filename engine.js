/* 마감구조대의 선택·시간 배정 규칙. 서버나 AI 호출 없이 동작합니다. */
(function (root) {
  'use strict';
  const importance = { high: 0, normal: 1, low: 2 };
  const firstSteps = {
    assignment: '과제 안내를 열고, 오늘 만들 부분의 제목 한 줄을 적어요.',
    study: '교재나 강의 자료를 펴고, 오늘 볼 첫 페이지를 찾아요.',
    life: '필요한 물건 하나를 손에 들고, 눈앞의 작은 부분부터 시작해요.',
    other: '이 일에 필요한 자료나 도구 하나를 꺼내요. 준비부터 시작이에요.'
  };
  function localDate(date = new Date()) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }
  function eligible(tasks, today = localDate()) {
    return tasks.filter(task => !task.doneAt && task.deferredOn !== today);
  }
  function compare(a, b) {
    const deadline = (a.due || '9999-12-31').localeCompare(b.due || '9999-12-31');
    return deadline || ((importance[a.importance] ?? 1) - (importance[b.importance] ?? 1));
  }
  function rank(tasks, today = localDate()) {
    return eligible(tasks, today).slice().sort((a, b) => compare(a, b) || a.createdAt - b.createdAt);
  }
  function pick(tasks, today = localDate(), random = Math.random) {
    const ordered = rank(tasks, today);
    if (!ordered.length) return null;
    const tied = ordered.filter(task => compare(task, ordered[0]) === 0);
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
    if (active.some(other => compare(other, task) < 0)) {
      return '앞서 정한 일이에요. 다음 선택에서 바뀐 우선순위를 반영해요. 지금은 이 일의 첫 행동부터 해봐요.';
    }
    const days = dayDifference(task.due, today);
    let text;
    if (days !== null && days < 0) text = '마감이 지난 일이에요. 늦어진 일부터 챙겨봐요.';
    else if (days === 0) text = '오늘 마감이에요. 가장 먼저 챙겨야 할 일이에요.';
    else if (days === 1) text = '내일 마감이에요. 미리 손대두면 마음이 가벼워져요.';
    else if (days !== null) text = `${days}일 뒤 마감이에요. 남은 일 중 마감이 가장 가까워요.`;
    else if (active.length === 1) text = '지금 할 수 있는 일이 하나 있어요. 이 일부터 시작해요.';
    else text = '마감이 없는 일 중 중요도를 먼저 반영해 골랐어요.';
    if (task.importance === 'high') text += ' 중요도도 높아요.';
    const count = tieCount ?? active.filter(other => compare(task, other) === 0).length;
    if (count > 1) text += ` 같은 우선순위 ${count}개 중 추첨했어요.`;
    return text;
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
  const engine = Object.freeze({ localDate, eligible, compare, rank, pick, dayDifference, dueLabel, reason, bigThree, firstSteps, plan, formatTime });
  root.RescueEngine = engine;
  if (typeof module !== 'undefined' && module.exports) module.exports = engine;
})(globalThis);
