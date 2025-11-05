import cron from 'node-cron';
import { supabaseAdmin } from './supabaseClient.js';
import { buildReminderHtml, sendEmail } from './email.js';

const HOURS_WINDOW = 24;

const fetchUpcomingTasks = async () => {
  if (!supabaseAdmin) {
    console.warn('Brak klienta Supabase (service role) - scheduler nieaktywny.');
    return [];
  }

  const now = new Date();
  const future = new Date(now.getTime() + HOURS_WINDOW * 60 * 60 * 1000);

  const { data, error } = await supabaseAdmin
    .from('tasks')
    .select('id,title,due_date,status,user_id')
    .neq('status', 'done')
    .gte('due_date', now.toISOString())
    .lte('due_date', future.toISOString());

  if (error) {
    console.error('Błąd pobierania zadań do przypomnienia', error);
    return [];
  }

  return data ?? [];
};

const fetchUserDetails = async (userId) => {
  try {
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('username, notifications_enabled')
      .eq('user_id', userId)
      .single();

    if (profileError) {
      console.warn('Nie udało się pobrać profilu', profileError.message);
    }

    if (profileData && profileData.notifications_enabled === false) {
      return null;
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (userError) {
      console.warn('Nie udało się pobrać użytkownika', userError.message);
      return null;
    }

    return {
      email: userData.user.email,
      username: profileData?.username ?? userData.user.email?.split('@')[0] ?? 'Użytkowniku'
    };
  } catch (err) {
    console.error('Błąd pobierania danych użytkownika', err);
    return null;
  }
};

const runJob = async () => {
  const tasks = await fetchUpcomingTasks();
  if (!tasks.length) {
    return;
  }

  const grouped = tasks.reduce((acc, task) => {
    const list = acc.get(task.user_id) ?? [];
    list.push(task);
    acc.set(task.user_id, list);
    return acc;
  }, new Map());

  for (const [userId, userTasks] of grouped.entries()) {
    const details = await fetchUserDetails(userId);
    if (!details?.email) {
      continue;
    }

    const html = buildReminderHtml({ username: details.username, tasks: userTasks });
    try {
      await sendEmail({
        to: details.email,
        subject: 'Taskly – przypomnienie o nadchodzących zadaniach',
        html
      });
    } catch (error) {
      console.error('Błąd wysyłki e-maila', error);
    }
  }
};

export const initScheduler = () => {
  const schedule = process.env.CRON_SCHEDULE || '0 * * * *';
  if (!supabaseAdmin) {
    console.warn('Scheduler pominięty (brak service role key).');
    return null;
  }

  const job = cron.schedule(schedule, () => {
    runJob().catch((err) => console.error('Błąd zadania cron', err));
  });

  console.log(`Scheduler Taskly aktywny z harmonogramem: ${schedule}`);
  runJob().catch((err) => console.error('Błąd początkowego sprawdzenia zadań', err));

  return job;
};
