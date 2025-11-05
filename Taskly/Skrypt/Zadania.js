import { apiFetch, zabezpieczStrone } from './Uwierzytelnienie.js';

const state = {
  tasks: [],
  selected: new Set(),
  pagination: { page: 1, limit: 10, total: 0 },
  filters: {
    status: '',
    search: '',
    sortBy: 'due_date',
    sortOrder: 'asc'
  }
};

const statusMap = {
  todo: 'Do zrobienia',
  in_progress: 'W trakcie',
  done: 'Zakończone'
};

const container = () => document.querySelector('#lista-zadan');
const counter = () => document.querySelector('[data-licznik-zadan]');
const feedback = () => document.querySelector('[data-komunikat-zadania]');
const isFullList = () => document.body.dataset.trybLista === 'true';

const showFeedback = (type, message) => {
  const box = feedback();
  if (!box) return;
  box.textContent = message;
  box.className = `alert ${type}`;
  setTimeout(() => {
    box.textContent = '';
    box.className = 'alert';
  }, 4000);
};

const buildQuery = () => {
  const params = new URLSearchParams();
  params.set('page', state.pagination.page);
  params.set('limit', state.pagination.limit);
  if (state.filters.status) params.set('status', state.filters.status);
  if (state.filters.search) params.set('search', state.filters.search);
  if (state.filters.from) params.set('from', state.filters.from);
  if (state.filters.to) params.set('to', state.filters.to);
  params.set('sortBy', state.filters.sortBy);
  params.set('sortOrder', state.filters.sortOrder);
  return `?${params.toString()}`;
};

const formatDuration = (minutes) => {
  if (typeof minutes === 'string') {
    const numeric = parseInt(minutes, 10);
    if (!Number.isNaN(numeric)) {
      minutes = numeric;
    }
  }
  if (minutes === null || minutes === undefined) return '—';
  const value = Number(minutes);
  if (Number.isNaN(value)) return '—';
  const hours = Math.floor(value / 60);
  const rest = Math.round(value % 60);
  if (!hours) return `${rest} min`;
  if (!rest) return `${hours} h`;
  return `${hours} h ${rest} min`;
};

const renderTasks = () => {
  const list = container();
  if (!list) return;
  list.innerHTML = '';
  if (!state.tasks.length) {
    list.innerHTML = '<p>Brak zadań spełniających kryteria.</p>';
    return;
  }

  const validIds = new Set(state.tasks.map((task) => task.id));
  for (const id of Array.from(state.selected)) {
    if (!validIds.has(id)) {
      state.selected.delete(id);
    }
  }

  state.tasks.forEach((task) => {
    const element = document.createElement('article');
    element.className = 'task-item';
    element.setAttribute('tabindex', '0');
    element.dataset.taskId = task.id;
    const selectMarkup = isFullList()
      ? `<label class="status-toggle"><input type="checkbox" data-select-task ${state.selected.has(task.id) ? 'checked' : ''}/> Zaznacz</label>`
      : '';
    element.innerHTML = `
      <header style="display:flex;justify-content:space-between;align-items:center;gap:1rem;">
        <h3>${task.title}</h3>
        <span class="badge ${task.status}">${statusMap[task.status]}</span>
      </header>
      <p>${task.description || 'Brak opisu'}</p>
      <footer style="display:flex;flex-wrap:wrap;gap:1rem;align-items:center;">
        <span>Termin: ${task.due_date ? new Date(task.due_date).toLocaleString('pl-PL') : 'brak'}</span>
        <span>Czas: ${formatDuration(task.duration)}</span>
        <label class="status-toggle">
          Status:
          <select data-zmiana-statusu>
            ${Object.entries(statusMap)
              .map(([value, label]) => `<option value="${value}" ${task.status === value ? 'selected' : ''}>${label}</option>`)
              .join('')}
          </select>
        </label>
        ${selectMarkup}
        <button class="secondary" data-edycja>Edytuj</button>
        <button class="secondary" data-usun>Usuń</button>
      </footer>
    `;
    list.appendChild(element);
  });

  const licznik = counter();
  if (licznik) {
    licznik.textContent = `${state.pagination.total} zadań`;
  }

  const paginacja = document.querySelector('.paginacja');
  if (paginacja) {
    const totalPages = Math.max(1, Math.ceil((state.pagination.total || 0) / state.pagination.limit));
    const info = paginacja.querySelector('[data-paginacja-info]');
    if (info) {
      info.textContent = `Strona ${state.pagination.page} z ${totalPages}`;
    }
    const setPage = (selector, value) => {
      const btn = paginacja.querySelector(selector);
      if (btn) {
        btn.dataset.page = String(value);
        btn.disabled = value < 1 || value > totalPages;
      }
    };
    setPage('[data-strona="first"]', 1);
    setPage('[data-strona="prev"]', state.pagination.page - 1);
    setPage('[data-strona="next"]', state.pagination.page + 1);
    setPage('[data-strona="last"]', totalPages);
  }

  document.dispatchEvent(
    new CustomEvent('taskly:tasks-updated', { detail: { tasks: state.tasks.slice() } })
  );
};

const loadTasks = async () => {
  try {
    const response = await apiFetch(`/api/tasks${buildQuery()}`);
    state.tasks = response.data;
    state.pagination = { ...state.pagination, ...response.pagination };
    renderTasks();
  } catch (error) {
    console.error(error);
    showFeedback('error', error.message || 'Nie udało się pobrać zadań.');
  }
};

const createTask = async (form) => {
  const payload = Object.fromEntries(new FormData(form).entries());
  if (!payload.title) {
    showFeedback('error', 'Tytuł jest wymagany.');
    return;
  }
  try {
    payload.duration = payload.duration ? Number(payload.duration) : undefined;
    await apiFetch('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    form.reset();
    showFeedback('success', 'Zadanie utworzone pomyślnie.');
    await loadTasks();
  } catch (error) {
    showFeedback('error', error.message || 'Nie udało się zapisać zadania.');
  }
};

const updateTask = async (id, data) => {
  try {
    await apiFetch(`/api/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    await loadTasks();
    showFeedback('success', 'Zadanie zaktualizowane.');
  } catch (error) {
    showFeedback('error', error.message || 'Nie udało się zaktualizować zadania.');
  }
};

const deleteTask = async (id) => {
  if (!confirm('Czy na pewno chcesz usunąć to zadanie?')) return;
  try {
    await apiFetch(`/api/tasks/${id}`, { method: 'DELETE' });
    showFeedback('success', 'Zadanie usunięte.');
    await loadTasks();
  } catch (error) {
    showFeedback('error', error.message || 'Nie udało się usunąć zadania.');
  }
};

const getSelectedTaskIds = () => Array.from(state.selected);

const bulkUpdateTasks = async (ids, data, komunikat) => {
  if (!ids.length) {
    alert('Wybierz zadania do aktualizacji.');
    return;
  }
  try {
    await Promise.all(ids.map((id) => apiFetch(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) })));
    state.selected.clear();
    await loadTasks();
    showFeedback('success', komunikat);
  } catch (error) {
    showFeedback('error', error.message || 'Nie udało się wykonać operacji.');
  }
};

const bulkDeleteTasks = async (ids) => {
  if (!ids.length) {
    alert('Wybierz zadania do usunięcia.');
    return;
  }
  if (!confirm(`Usunąć ${ids.length} zadań?`)) return;
  try {
    await Promise.all(ids.map((id) => apiFetch(`/api/tasks/${id}`, { method: 'DELETE' })));
    state.selected.clear();
    await loadTasks();
    showFeedback('success', 'Wybrane zadania zostały usunięte.');
  } catch (error) {
    showFeedback('error', error.message || 'Nie udało się usunąć zadań.');
  }
};

const initForms = () => {
  const form = document.querySelector('#formularz-zadanie');
  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      await createTask(form);
    });
  }

  const filtrStatus = document.querySelector('#filter-status');
  if (filtrStatus) {
    filtrStatus.addEventListener('change', (event) => {
      state.filters.status = event.target.value;
      state.pagination.page = 1;
      loadTasks();
    });
  }

  const sortowanie = document.querySelector('#sortowanie');
  if (sortowanie) {
    sortowanie.addEventListener('change', (event) => {
      const [sortBy, sortOrder] = event.target.value.split(':');
      state.filters.sortBy = sortBy;
      state.filters.sortOrder = sortOrder;
      loadTasks();
    });
  }

  const wyszukiwarka = document.querySelector('#wyszukiwarka');
  if (wyszukiwarka) {
    wyszukiwarka.addEventListener('input', (event) => {
      state.filters.search = event.target.value.trim();
      state.pagination.page = 1;
      loadTasks();
    });
  }

  const dataOd = document.querySelector('#filter-od');
  const dataDo = document.querySelector('#filter-do');
  if (dataOd) {
    dataOd.addEventListener('change', (event) => {
      state.filters.from = event.target.value;
      loadTasks();
    });
  }
  if (dataDo) {
    dataDo.addEventListener('change', (event) => {
      state.filters.to = event.target.value;
      loadTasks();
    });
  }

  const masowe = document.querySelector('[data-masowe-akcje]');
  if (masowe) {
    masowe.addEventListener('click', async (event) => {
      const btn = event.target.closest('button[data-akcja-masowa]');
      if (!btn) return;
      const ids = getSelectedTaskIds();
      switch (btn.dataset.akcjaMasowa) {
        case 'done':
          await bulkUpdateTasks(ids, { status: 'done' }, 'Zadania oznaczone jako zakończone.');
          break;
        case 'in_progress':
          await bulkUpdateTasks(ids, { status: 'in_progress' }, 'Zadania oznaczone jako w trakcie.');
          break;
        case 'todo':
          await bulkUpdateTasks(ids, { status: 'todo' }, 'Zadania przeniesione do listy do zrobienia.');
          break;
        case 'delete':
          await bulkDeleteTasks(ids);
          break;
        case 'clear':
          state.selected.clear();
          renderTasks();
          break;
        default:
          break;
      }
    });
  }

  const paginacja = document.querySelector('.paginacja');
  if (paginacja) {
    paginacja.addEventListener('click', (event) => {
      const btn = event.target.closest('button[data-strona]');
      if (!btn) return;
      const page = Number(btn.dataset.page ?? btn.dataset.strona);
      if (!Number.isFinite(page) || page < 1) return;
      state.pagination.page = page;
      loadTasks();
    });
  }
};

const initListeners = () => {
  const list = container();
  if (!list) return;

  list.addEventListener('change', async (event) => {
    if (event.target.matches('[data-zmiana-statusu]')) {
      const id = event.target.closest('.task-item')?.dataset.taskId;
      const status = event.target.value;
      await updateTask(id, { status });
    }
    if (event.target.matches('[data-select-task]')) {
      const id = event.target.closest('.task-item')?.dataset.taskId;
      if (!id) return;
      if (event.target.checked) {
        state.selected.add(id);
      } else {
        state.selected.delete(id);
      }
    }
  });

  list.addEventListener('click', async (event) => {
    const row = event.target.closest('.task-item');
    if (!row) return;
    const id = row.dataset.taskId;

    if (event.target.matches('[data-usun]')) {
      await deleteTask(id);
    }

    if (event.target.matches('[data-edycja]')) {
      const title = prompt('Nowy tytuł', row.querySelector('h3').textContent);
      if (!title) return;
      const description = prompt('Opis', row.querySelector('p').textContent);
      await updateTask(id, { title, description });
    }
  });
};

export const initZadania = async () => {
  await zabezpieczStrone();
  initForms();
  initListeners();
  document.addEventListener('taskly:reload-tasks', loadTasks);
  await loadTasks();
};

export const pobierzBiezaceZadania = () => state.tasks.slice();
