import { apiFetch } from './Uwierzytelnienie.js';
import { pobierzBiezaceZadania } from './Zadania.js';

const state = {
  view: 'month',
  focusDate: new Date(),
  statusFilter: 'all'
};

const container = () => document.querySelector('#kalendarz');
const heading = () => document.querySelector('[data-kalendarz-naglowek]');

const formatDate = (date) => date.toISOString().split('T')[0];

const filterTasks = (tasks, date) => {
  return tasks.filter((task) => {
    if (!task.due_date) return false;
    if (state.statusFilter !== 'all' && task.status !== state.statusFilter) {
      return false;
    }
    const taskDate = formatDate(new Date(task.due_date));
    return taskDate === formatDate(date);
  });
};

const renderTasksForCell = (cell, tasks) => {
  const list = document.createElement('div');
  list.style.display = 'flex';
  list.style.flexDirection = 'column';
  list.style.gap = '0.35rem';

  tasks.forEach((task) => {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = `badge ${task.status}`;
    pill.textContent = task.title;
    pill.draggable = true;
    pill.dataset.taskId = task.id;
    pill.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData('text/plain', task.id);
    });
    list.appendChild(pill);
  });

  cell.appendChild(list);
};

const attachDrop = (cell, date) => {
  cell.addEventListener('dragover', (event) => {
    event.preventDefault();
    cell.classList.add('dragover');
  });
  cell.addEventListener('dragleave', () => cell.classList.remove('dragover'));
  cell.addEventListener('drop', async (event) => {
    event.preventDefault();
    cell.classList.remove('dragover');
    const taskId = event.dataTransfer.getData('text/plain');
    if (!taskId) return;
    try {
      await apiFetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify({ due_date: formatDate(date) })
      });
      document.dispatchEvent(new CustomEvent('taskly:refresh-tasks'));
    } catch (error) {
      console.error('Nie udało się zmienić terminu zadania', error);
      alert('Nie udało się zmienić terminu zadania.');
    }
  });
};

const buildMonthGrid = (tasks) => {
  const root = container();
  if (!root) return;
  root.innerHTML = '';

  const firstDay = new Date(state.focusDate.getFullYear(), state.focusDate.getMonth(), 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // poniedziałek jako początek
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - startOffset);

  const grid = document.createElement('div');
  grid.className = 'kalendarz-grid';
  const daysToRender = 42;

  for (let i = 0; i < daysToRender; i += 1) {
    const current = new Date(gridStart);
    current.setDate(gridStart.getDate() + i);

    const cell = document.createElement('div');
    cell.className = 'kalendarz-komorka';
    if (current.getMonth() !== state.focusDate.getMonth()) {
      cell.style.opacity = '0.5';
    }
    cell.dataset.date = formatDate(current);

    const label = document.createElement('div');
    label.className = 'data';
    label.textContent = current.toLocaleDateString('pl-PL', {
      day: 'numeric',
      month: 'short'
    });
    cell.appendChild(label);

    const dayTasks = filterTasks(tasks, current);
    renderTasksForCell(cell, dayTasks);
    attachDrop(cell, current);
    grid.appendChild(cell);
  }

  root.appendChild(grid);
};

const buildWeekGrid = (tasks) => {
  const root = container();
  if (!root) return;
  root.innerHTML = '';

  const current = new Date(state.focusDate);
  const startOffset = (current.getDay() + 6) % 7;
  const start = new Date(current);
  start.setDate(current.getDate() - startOffset);

  const grid = document.createElement('div');
  grid.className = 'kalendarz-grid';

  for (let i = 0; i < 7; i += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const cell = document.createElement('div');
    cell.className = 'kalendarz-komorka';
    cell.dataset.date = formatDate(day);

    const label = document.createElement('div');
    label.className = 'data';
    label.textContent = day.toLocaleDateString('pl-PL', {
      weekday: 'long',
      day: 'numeric',
      month: 'short'
    });
    cell.appendChild(label);

    const dayTasks = filterTasks(tasks, day);
    renderTasksForCell(cell, dayTasks);
    attachDrop(cell, day);
    grid.appendChild(cell);
  }

  root.appendChild(grid);
};

const render = () => {
  const tasks = pobierzBiezaceZadania();
  const title = heading();
  if (title) {
    title.textContent = state.focusDate.toLocaleDateString('pl-PL', {
      month: 'long',
      year: 'numeric'
    });
  }

  if (state.view === 'week') {
    buildWeekGrid(tasks);
  } else {
    buildMonthGrid(tasks);
  }
};

const initControls = () => {
  const prev = document.querySelector('[data-kalendarz-prev]');
  const next = document.querySelector('[data-kalendarz-next]');
  const toggle = document.querySelector('#tryb-kalendarza');
  const statusFilter = document.querySelector('#filter-status-kalendarz');

  prev?.addEventListener('click', () => {
    if (state.view === 'week') {
      state.focusDate.setDate(state.focusDate.getDate() - 7);
    } else {
      state.focusDate.setMonth(state.focusDate.getMonth() - 1);
    }
    render();
  });

  next?.addEventListener('click', () => {
    if (state.view === 'week') {
      state.focusDate.setDate(state.focusDate.getDate() + 7);
    } else {
      state.focusDate.setMonth(state.focusDate.getMonth() + 1);
    }
    render();
  });

  toggle?.addEventListener('change', (event) => {
    state.view = event.target.value;
    render();
  });

  statusFilter?.addEventListener('change', (event) => {
    state.statusFilter = event.target.value;
    render();
  });
};

const listenForUpdates = () => {
  document.addEventListener('taskly:tasks-updated', render);
  document.addEventListener('taskly:refresh-tasks', () => {
    // odświeżenie listy zadań zainicjuje moduł zadań
    const event = new CustomEvent('taskly:reload-tasks');
    document.dispatchEvent(event);
  });
};

export const initKalendarz = () => {
  initControls();
  listenForUpdates();
  render();
};
