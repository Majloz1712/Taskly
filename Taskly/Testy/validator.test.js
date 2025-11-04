import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTaskPayload } from '../Backend/utils/validator.js';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-key';
process.env.APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';

const lazyServer = async () => {
  if (!global.__TASKLY_SERVER__) {
    const { default: server } = await import('../Backend/server.js');
    global.__TASKLY_SERVER__ = server;
  }
  return global.__TASKLY_SERVER__;
};

test('validateTaskPayload zwraca błąd dla pustego tytułu', () => {
  const { valid, errors } = validateTaskPayload({ title: '', status: 'todo' });
  assert.equal(valid, false);
  assert.ok(errors.includes('Tytuł jest wymagany.'));
});

test('validateTaskPayload akceptuje poprawne dane', () => {
  const result = validateTaskPayload({ title: 'Raport', status: 'todo', due_date: '2030-01-01' });
  assert.equal(result.valid, true);
  assert.equal(result.data.title, 'Raport');
});

test('GET /api/tasks wymaga nagłówka Authorization', async (t) => {
  try {
    await import('express');
  } catch (error) {
    t.skip('Środowisko testowe nie posiada zależności Express.');
    return;
  }
  const server = await lazyServer();
  t.after(() => server.close());
  const response = await fetch(`http://localhost:${process.env.PORT || 3000}/api/tasks`);
  const body = await response.json();
  assert.equal(response.status, 401);
  assert.equal(body.message, 'Brak tokenu uwierzytelniającego.');
});
