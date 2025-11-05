const STATUS_OPTIONS = ['todo', 'in_progress', 'done'];

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

export const validateTaskPayload = (payload, { partial = false } = {}) => {
  const errors = [];
  const data = {};

  if (!partial || Object.hasOwn(payload, 'title')) {
    if (!isNonEmptyString(payload.title)) {
      errors.push('Tytuł jest wymagany.');
    } else {
      data.title = payload.title.trim();
    }
  }

  if (Object.hasOwn(payload, 'description')) {
    data.description = typeof payload.description === 'string' ? payload.description.trim() : '';
  }

  if (!partial || Object.hasOwn(payload, 'status')) {
    if (!STATUS_OPTIONS.includes(payload.status)) {
      errors.push('Nieprawidłowy status zadania.');
    } else {
      data.status = payload.status;
    }
  }

  if (Object.hasOwn(payload, 'due_date')) {
    const due = new Date(payload.due_date);
    if (Number.isNaN(due.getTime())) {
      errors.push('Nieprawidłowa data terminu.');
    } else {
      data.due_date = due.toISOString();
    }
  }

  if (Object.hasOwn(payload, 'duration')) {
    const duration = Number(payload.duration);
    if (Number.isNaN(duration) || duration < 0) {
      errors.push('Czas trwania musi być liczbą nieujemną (w minutach).');
    } else {
      data.duration = `${duration} minutes`;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    data
  };
};

export const buildPagination = ({ page = 1, limit = 10 }) => {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const from = (safePage - 1) * safeLimit;
  const to = from + safeLimit - 1;
  return { page: safePage, limit: safeLimit, from, to };
};

export const sanitizeSort = ({ sortBy = 'due_date', sortOrder = 'asc' }) => {
  const allowedFields = ['due_date', 'status', 'created_at', 'title'];
  const field = allowedFields.includes(sortBy) ? sortBy : 'due_date';
  const order = sortOrder === 'desc' ? 'desc' : 'asc';
  return { field, order };
};
