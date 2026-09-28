/**
 * 习惯打卡小工具
 * 纯静态实现：数据存在浏览器 localStorage，换日以本地零点为准。
 */
(() => {
  'use strict';

  const STORAGE_KEY = 'habit-tracker.v1';
  const MAX_NAME_LENGTH = 20;
  const WEEK_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

  const CHECK_ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M20 6 9 17l-5-5" fill="none" stroke="currentColor" stroke-width="2.6" ' +
    'stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const EDIT_ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M4 20h4L18 10a2.83 2.83 0 0 0-4-4L4 16v4Z" fill="none" stroke="currentColor" ' +
    'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M13.5 6.5 17.5 10.5" fill="none" stroke="currentColor" stroke-width="1.9" ' +
    'stroke-linecap="round"/></svg>';

  const TRASH_ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M4.5 7h15M9.5 7V4.8h5V7M6.8 7l.9 12.2h8.6L17.2 7M10.4 10.8v5.2M13.6 10.8v5.2" ' +
    'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" ' +
    'stroke-linejoin="round"/></svg>';

  const els = {
    heroCard: document.getElementById('heroCard'),
    todayLabel: document.getElementById('todayLabel'),
    doneCount: document.getElementById('doneCount'),
    totalCount: document.getElementById('totalCount'),
    progressBar: document.getElementById('progressBar'),
    progressFill: document.getElementById('progressFill'),
    cheerText: document.getElementById('cheerText'),
    addForm: document.getElementById('addForm'),
    habitInput: document.getElementById('habitInput'),
    habitList: document.getElementById('habitList'),
    emptyState: document.getElementById('emptyState'),
    weekCard: document.getElementById('weekCard'),
    weekProgressRow: document.getElementById('weekProgressRow'),
    weekProgress: document.getElementById('weekProgress'),
    weekProgressFill: document.getElementById('weekProgressFill'),
    weekBars: document.getElementById('weekBars'),
    weekRate: document.getElementById('weekRate'),
    weekMeta: document.getElementById('weekMeta'),
    weekHint: document.getElementById('weekHint'),
    weekChart: document.getElementById('weekChart'),
    historyHint: document.getElementById('historyHint'),
    toast: document.getElementById('toast')
  };

  let state = loadState();
  let todayKey = '';
  let toastTimer = null;

  /* ---------------- 日期工具 ---------------- */

  const pad2 = (value) => String(value).padStart(2, '0');

  function formatDayKey(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function startOfToday() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function shiftDay(date, delta) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + delta);
  }

  /** 一周从周一开始，返回本周周一的零点。 */
  function startOfWeek(date) {
    const offset = (date.getDay() + 6) % 7;
    return shiftDay(date, -offset);
  }

  /** 今天是本周第几天（周一 = 1）。 */
  function weekDayIndex(date) {
    return ((date.getDay() + 6) % 7) + 1;
  }

  function createId() {
    const stamp = Date.now().toString(36);
    const salt = Math.random().toString(36).slice(2, 6);
    return `h_${stamp}_${salt}`;
  }

  todayKey = formatDayKey(new Date());

  /* ---------------- 提示条 ---------------- */

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('is-visible'), 2400);
  }

  /* ---------------- 数据读写 ---------------- */

  function createEmptyState() {
    return { habits: [], checkins: {} };
  }

  function sanitizeState(raw) {
    if (!raw || typeof raw !== 'object') {
      console.warn('[习惯打卡] 本地数据结构异常，已按空数据启动。');
      return createEmptyState();
    }

    const habits = Array.isArray(raw.habits)
      ? raw.habits
          .filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string')
          .map((item) => ({
            id: item.id,
            name: item.name.trim().slice(0, MAX_NAME_LENGTH),
            createdAt: typeof item.createdAt === 'string' ? item.createdAt : ''
          }))
          .filter((item) => item.name !== '')
      : [];

    const habitIds = new Set(habits.map((habit) => habit.id));
    const checkins = {};

    if (raw.checkins && typeof raw.checkins === 'object') {
      Object.keys(raw.checkins).forEach((key) => {
        const value = raw.checkins[key];
        if (!DAY_KEY_PATTERN.test(key) || !Array.isArray(value)) return;
        const validIds = value.filter((id) => typeof id === 'string' && habitIds.has(id));
        const uniqueIds = Array.from(new Set(validIds));
        if (uniqueIds.length > 0) checkins[key] = uniqueIds;
      });
    }

    return { habits, checkins };
  }

  function loadState() {
    let rawText = null;

    try {
      rawText = localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      console.warn('[习惯打卡] 无法读取本地存储：', error);
      return createEmptyState();
    }

    if (!rawText) return createEmptyState();

    try {
      return sanitizeState(JSON.parse(rawText));
    } catch (error) {
      console.warn('[习惯打卡] 本地数据解析失败，已按空数据启动：', error);
      return createEmptyState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      console.warn('[习惯打卡] 无法保存到本地存储：', error);
      showToast('记录未能保存到浏览器');
      return false;
    }
  }

  /* ---------------- 查询 ---------------- */

  function checkedIdsOf(dayKey) {
    return state.checkins[dayKey] || [];
  }

  function isChecked(dayKey, habitId) {
    return checkedIdsOf(dayKey).includes(habitId);
  }

  function countForDay(dayKey) {
    const habitIds = new Set(state.habits.map((habit) => habit.id));
    return checkedIdsOf(dayKey).filter((id) => habitIds.has(id)).length;
  }

  function findHabit(habitId) {
    return state.habits.find((habit) => habit.id === habitId) || null;
  }

  /** 连续打卡天数：今天未打卡时从昨天往前算，当天没打卡不会立刻清零。 */
  function streakOf(habitId) {
    const checkedToday = isChecked(todayKey, habitId);
    let cursor = checkedToday ? startOfToday() : shiftDay(startOfToday(), -1);
    let count = 0;

    while (isChecked(formatDayKey(cursor), habitId)) {
      count += 1;
      cursor = shiftDay(cursor, -1);
    }

    return { count, checkedToday };
  }

  /* ---------------- 渲染 ---------------- */

  function render() {
    renderHeader();
    renderHabitList();
    renderWeekSummary();
    renderWeekChart();
  }

  function renderHeader() {
    const today = startOfToday();
    els.todayLabel.textContent = `${today.getMonth() + 1}月${today.getDate()}日 ${WEEK_LABELS[today.getDay()]}`;

    const total = state.habits.length;
    const done = countForDay(todayKey);
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);
    const allDone = total > 0 && done === total;

    els.doneCount.textContent = String(done);
    els.totalCount.textContent = String(total);
    els.progressFill.style.width = `${percent}%`;
    els.progressBar.setAttribute('aria-valuenow', String(percent));
    els.progressBar.classList.toggle('is-complete', allDone);
    els.heroCard.classList.toggle('is-complete', allDone);

    els.cheerText.hidden = !allDone;
    els.cheerText.textContent = allDone ? `今天 ${total} 项全部完成，太棒了！` : '';
  }

  function buildIconButton(action, label, icon) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'icon-btn';
    button.dataset.action = action;
    button.setAttribute('aria-label', label);
    button.innerHTML = icon;
    return button;
  }

  function buildHabitRow(habit) {
    const checked = isChecked(todayKey, habit.id);
    const row = document.createElement('li');
    row.className = checked ? 'habit is-checked' : 'habit';
    row.dataset.id = habit.id;

    const check = document.createElement('button');
    check.type = 'button';
    check.className = 'check';
    check.dataset.action = 'toggle';
    check.setAttribute('role', 'checkbox');
    check.setAttribute('aria-checked', String(checked));
    check.setAttribute('aria-label', `${checked ? '取消打卡' : '打卡'}：${habit.name}`);
    check.innerHTML = CHECK_ICON;

    const main = document.createElement('div');
    main.className = 'habit__main';

    const name = document.createElement('span');
    name.className = 'habit__name';
    name.textContent = habit.name;
    main.appendChild(name);

    const streak = streakOf(habit.id);
    if (streak.count > 0) {
      const chip = document.createElement('span');
      chip.className = streak.checkedToday ? 'habit__streak' : 'habit__streak habit__streak--pending';
      chip.textContent = streak.checkedToday
        ? `连续 ${streak.count} 天`
        : `已连续 ${streak.count} 天，今天待打卡`;
      main.appendChild(chip);
    }

    const actions = document.createElement('div');
    actions.className = 'habit__actions';
    actions.appendChild(buildIconButton('edit', `修改「${habit.name}」的名称`, EDIT_ICON));
    actions.appendChild(buildIconButton('delete', `删除「${habit.name}」`, TRASH_ICON));

    row.append(check, main, actions);
    return row;
  }

  function renderHabitList() {
    const hasHabits = state.habits.length > 0;
    els.emptyState.hidden = hasHabits;
    els.habitList.hidden = !hasHabits;
    els.habitList.textContent = '';

    state.habits.forEach((habit) => {
      els.habitList.appendChild(buildHabitRow(habit));
    });
  }

  function levelOf(ratio) {
    if (ratio <= 0) return 0;
    if (ratio <= 0.34) return 1;
    if (ratio <= 0.67) return 2;
    if (ratio < 1) return 3;
    return 4;
  }

  /** 顶部「本周完成情况」：周一至周日每天的完成度，未来的日期不计入统计。 */
  function renderWeekSummary() {
    const total = state.habits.length;
    const today = startOfToday();
    const weekStart = startOfWeek(today);
    const elapsedDays = weekDayIndex(today);
    const goalTotal = total * elapsedDays;

    els.weekBars.textContent = '';
    els.weekBars.hidden = total === 0;
    els.weekProgressRow.hidden = total === 0;
    els.weekHint.hidden = total > 0;
    els.weekMeta.hidden = total === 0;

    if (total === 0) {
      els.weekRate.textContent = '—';
      els.weekRate.classList.remove('is-complete');
      els.weekProgressFill.style.width = '0%';
      els.weekProgress.setAttribute('aria-valuenow', '0');
      els.weekProgress.classList.remove('is-complete');
      els.weekMeta.textContent = '';
      return;
    }

    let doneInWeek = 0;

    for (let offset = 0; offset < 7; offset += 1) {
      const date = shiftDay(weekStart, offset);
      const dayKey = formatDayKey(date);
      const isToday = offset === elapsedDays - 1;
      const isFuture = offset >= elapsedDays;
      const done = isFuture ? 0 : countForDay(dayKey);
      const ratio = done / total;

      if (!isFuture) doneInWeek += done;

      const cell = document.createElement('li');
      cell.className =
        'week-bar' + (isToday ? ' is-today' : '') + (isFuture ? ' is-future' : '');
      cell.title = isFuture
        ? `${date.getMonth() + 1}月${date.getDate()}日 · 还没到`
        : `${date.getMonth() + 1}月${date.getDate()}日 · 完成 ${done}/${total}`;

      const track = document.createElement('span');
      track.className = 'week-bar__track';

      const fill = document.createElement('span');
      fill.className = 'week-bar__fill';
      fill.style.height = done > 0 ? `${Math.max(12, Math.round(ratio * 100))}%` : '0';
      track.appendChild(fill);

      const label = document.createElement('span');
      label.className = 'week-bar__label';
      label.textContent = WEEK_LABELS[date.getDay()].slice(1);

      cell.append(track, label);
      els.weekBars.appendChild(cell);
    }

    const percent = Math.round((doneInWeek / goalTotal) * 100);
    els.weekRate.textContent = `${percent}%`;
    els.weekProgressFill.style.width = `${percent}%`;
    els.weekProgress.setAttribute('aria-valuenow', String(percent));
    els.weekProgress.classList.toggle('is-complete', doneInWeek === goalTotal);
    els.weekRate.classList.toggle('is-complete', doneInWeek === goalTotal);
    els.weekMeta.textContent =
      `本周已过 ${elapsedDays} 天 · 已完成 ${doneInWeek}/${goalTotal} 次`;
  }

  function renderWeekChart() {
    const total = state.habits.length;
    els.weekChart.textContent = '';
    els.weekChart.hidden = total === 0;
    els.historyHint.hidden = total > 0;

    if (total === 0) return;

    const today = startOfToday();

    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = shiftDay(today, -offset);
      const dayKey = formatDayKey(date);
      const done = countForDay(dayKey);
      const cell = document.createElement('li');
      const isToday = offset === 0;

      cell.className = `week__cell level-${levelOf(done / total)}${isToday ? ' is-today' : ''}`;
      cell.title = `${date.getMonth() + 1}月${date.getDate()}日 ${done}/${total}`;

      const day = document.createElement('span');
      day.className = 'week__day';
      day.textContent = isToday ? '今天' : WEEK_LABELS[date.getDay()].slice(1);

      const num = document.createElement('span');
      num.className = 'week__num';
      num.textContent = String(date.getDate());

      cell.append(day, num);
      els.weekChart.appendChild(cell);
    }
  }

  /* ---------------- 操作 ---------------- */

  function addHabit(name) {
    state.habits.push({
      id: createId(),
      name: name.slice(0, MAX_NAME_LENGTH),
      createdAt: todayKey
    });
    saveState();
    render();
  }

  function toggleHabit(habit) {
    const ids = checkedIdsOf(todayKey).slice();
    const index = ids.indexOf(habit.id);

    if (index === -1) {
      ids.push(habit.id);
    } else {
      ids.splice(index, 1);
    }

    if (ids.length > 0) {
      state.checkins[todayKey] = ids;
    } else {
      delete state.checkins[todayKey];
    }

    saveState();
    render();
  }

  function deleteHabit(habit) {
    const confirmed = window.confirm(`确定删除「${habit.name}」吗？它的打卡记录也会一并清除。`);
    if (!confirmed) return;

    state.habits = state.habits.filter((item) => item.id !== habit.id);
    Object.keys(state.checkins).forEach((dayKey) => {
      const remaining = state.checkins[dayKey].filter((id) => id !== habit.id);
      if (remaining.length > 0) {
        state.checkins[dayKey] = remaining;
      } else {
        delete state.checkins[dayKey];
      }
    });

    saveState();
    render();
    showToast(`已删除「${habit.name}」`);
  }

  function beginRename(row, habit) {
    if (row.classList.contains('is-editing')) return;

    const main = row.querySelector('.habit__main');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'habit__edit';
    input.maxLength = MAX_NAME_LENGTH;
    input.value = habit.name;
    input.setAttribute('aria-label', `修改「${habit.name}」的名称`);

    let finished = false;
    const finish = (shouldSave) => {
      if (finished) return;
      finished = true;

      const nextName = input.value.trim();
      if (shouldSave && nextName !== '' && nextName !== habit.name) {
        habit.name = nextName.slice(0, MAX_NAME_LENGTH);
        saveState();
      }
      renderHabitList();
    };

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        finish(true);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        finish(false);
      }
    });
    input.addEventListener('blur', () => finish(true));

    row.classList.add('is-editing');
    main.textContent = '';
    main.appendChild(input);
    input.focus();
    input.select();
  }

  /* ---------------- 事件绑定 ---------------- */

  els.addForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = els.habitInput.value.trim();

    if (name === '') {
      els.habitInput.classList.add('is-invalid');
      setTimeout(() => els.habitInput.classList.remove('is-invalid'), 600);
      showToast('先输入一个习惯名称');
      els.habitInput.focus();
      return;
    }

    addHabit(name);
    els.habitInput.value = '';
    els.habitInput.focus();
  });

  els.habitList.addEventListener('click', (event) => {
    const row = event.target.closest('.habit');
    const actionEl = event.target.closest('[data-action]');
    if (!row || !actionEl) return;

    const habit = findHabit(row.dataset.id);
    if (!habit) return;

    if (actionEl.dataset.action === 'toggle') {
      toggleHabit(habit);
    } else if (actionEl.dataset.action === 'edit') {
      beginRename(row, habit);
    } else if (actionEl.dataset.action === 'delete') {
      deleteHabit(habit);
    }
  });

  /* ---------------- 跨天检查 ---------------- */

  function checkDayChange() {
    const currentKey = formatDayKey(new Date());
    if (currentKey === todayKey) return;

    todayKey = currentKey;
    render();
    showToast('新的一天开始啦，继续加油！');
  }

  window.setInterval(checkDayChange, 30000);
  window.addEventListener('focus', checkDayChange);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkDayChange();
  });

  render();
})();
