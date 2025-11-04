import { Router } from 'express';
import { authGuard } from '../middleware/authGuard.js';
import { supabaseAdmin } from '../services/supabaseClient.js';
import { buildPagination, sanitizeSort, validateTaskPayload } from '../utils/validator.js';

const router = Router();

const normalizeDuration = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    if (value.startsWith('P')) {
      const match = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
      if (match) {
        const hours = Number(match[1] || 0);
        const minutes = Number(match[2] || 0);
        return hours * 60 + minutes;
      }
    }
    if (value.includes(':')) {
      const [hours, minutes] = value.split(':');
      return Number(hours) * 60 + Number(minutes || 0);
    }
    const numeric = parseInt(value, 10);
    if (!Number.isNaN(numeric)) {
      return numeric;
    }
    const matchText = value.match(/(\d+)/);
    if (matchText) {
      return Number(matchText[1]);
    }
  }
  return null;
};

const formatTask = (task) => ({
  ...task,
  duration: normalizeDuration(task.duration)
});

const ensureAdmin = (res) => {
  if (!supabaseAdmin) {
    res.status(500).json({ message: 'Brak konfiguracji bazy danych.' });
    return false;
  }
  return true;
};

router.use(authGuard);

router.get('/', async (req, res) => {
  if (!ensureAdmin(res)) return;
  const { status, search, from, to } = req.query;
  const pagination = buildPagination(req.query);
  const sort = sanitizeSort(req.query);

  let query = supabaseAdmin
    .from('tasks')
    .select('*', { count: 'exact' })
    .eq('user_id', req.user.id);

  if (status) {
    query = query.eq('status', status);
  }

  if (search) {
    query = query.ilike('title', `%${search}%`);
  }

  if (from) {
    query = query.gte('due_date', new Date(from).toISOString());
  }

  if (to) {
    query = query.lte('due_date', new Date(to).toISOString());
  }

  query = query.order(sort.field, { ascending: sort.order === 'asc' }).range(pagination.from, pagination.to);

  const { data, error, count } = await query;

  if (error) {
    console.error('Błąd pobierania zadań', error);
    return res.status(500).json({ message: 'Nie udało się pobrać zadań.' });
  }

  res.json({
    data: (data ?? []).map(formatTask),
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: count ?? data.length,
      hasMore: (pagination.page * pagination.limit) < (count ?? 0)
    }
  });
});

router.post('/', async (req, res) => {
  if (!ensureAdmin(res)) return;

  const validation = validateTaskPayload(req.body);
  if (!validation.valid) {
    return res.status(400).json({ message: 'Nieprawidłowe dane wejściowe.', errors: validation.errors });
  }

  const payload = {
    ...validation.data,
    user_id: req.user.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabaseAdmin
    .from('tasks')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    console.error('Błąd tworzenia zadania', error);
    return res.status(500).json({ message: 'Nie udało się utworzyć zadania.' });
  }

  res.status(201).json({ message: 'Zadanie utworzone pomyślnie.', task: formatTask(data) });
});

router.put('/:id', async (req, res) => {
  if (!ensureAdmin(res)) return;
  const { id } = req.params;

  const { data: existingTask, error: existingError } = await supabaseAdmin
    .from('tasks')
    .select('*')
    .eq('id', id)
    .eq('user_id', req.user.id)
    .single();

  if (existingError) {
    console.error('Błąd sprawdzania zadania', existingError);
    return res.status(404).json({ message: 'Zadanie nie istnieje.' });
  }

  const validation = validateTaskPayload(req.body, { partial: true });
  if (!validation.valid) {
    return res.status(400).json({ message: 'Nieprawidłowe dane wejściowe.', errors: validation.errors });
  }

  const payload = {
    ...validation.data,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabaseAdmin
    .from('tasks')
    .update(payload)
    .eq('id', existingTask.id)
    .eq('user_id', req.user.id)
    .select('*')
    .single();

  if (error) {
    console.error('Błąd aktualizacji zadania', error);
    return res.status(500).json({ message: 'Nie udało się zaktualizować zadania.' });
  }

  res.json({ message: 'Zadanie zaktualizowane.', task: formatTask(data) });
});

router.delete('/:id', async (req, res) => {
  if (!ensureAdmin(res)) return;
  const { id } = req.params;

  const { error } = await supabaseAdmin
    .from('tasks')
    .delete()
    .eq('id', id)
    .eq('user_id', req.user.id);

  if (error) {
    console.error('Błąd usuwania zadania', error);
    return res.status(500).json({ message: 'Nie udało się usunąć zadania.' });
  }

  res.json({ message: 'Zadanie usunięte.' });
});

export default router;
