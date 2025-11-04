import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getSupabaseConfig } from './Konfiguracja.js';

let supabase;

export const initSupabase = () => {
  if (!supabase) {
    const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Brak konfiguracji Supabase. Upewnij się, że /konfiguracja.js zwraca poprawne dane.');
    }
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }
  return supabase;
};

export const getSession = async () => {
  const client = initSupabase();
  const { data } = await client.auth.getSession();
  return data.session ?? null;
};

export const getAccessToken = async () => {
  const session = await getSession();
  return session?.access_token ?? null;
};

export const requireAuth = async () => {
  const session = await getSession();
  if (!session) {
    window.location.href = '/Html/logowanie.html';
    return null;
  }
  return session;
};

const apiFetch = async (url, options = {}) => {
  const { apiBaseUrl } = getSupabaseConfig();
  const token = await getAccessToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${apiBaseUrl}${url}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: 'Nieznany błąd.' }));
    throw new Error(body.message || 'Wystąpił błąd API.');
  }

  return response.json();
};

export const synchronizeProfile = async () => {
  try {
    return await apiFetch('/api/auth/session');
  } catch (error) {
    console.warn('Nie udało się zsynchronizować profilu', error);
    return null;
  }
};

export const handleLoginForm = () => {
  const form = document.querySelector('#formularz-logowanie');
  const komunikat = document.querySelector('#komunikat-logowanie');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    komunikat.textContent = 'Logowanie...';
    komunikat.className = 'alert';

    let client;
    try {
      client = initSupabase();
    } catch (error) {
      komunikat.textContent = error.message;
      komunikat.classList.add('error');
      return;
    }

    const email = form.email.value.trim();
    const password = form.password.value.trim();

    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      komunikat.textContent = error.message || 'Nie udało się zalogować.';
      komunikat.classList.add('error');
      return;
    }

    komunikat.textContent = 'Logowanie udane, przekierowuję...';
    komunikat.classList.add('success');
    setTimeout(() => {
      window.location.href = '/Html/index.html';
    }, 800);
  });
};

export const handleRegisterForm = () => {
  const form = document.querySelector('#formularz-rejestracja');
  const komunikat = document.querySelector('#komunikat-rejestracja');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    komunikat.textContent = 'Tworzę konto...';
    komunikat.className = 'alert';

    let client;
    try {
      client = initSupabase();
    } catch (error) {
      komunikat.textContent = error.message;
      komunikat.classList.add('error');
      return;
    }

    const email = form.email.value.trim();
    const password = form.password.value.trim();
    const username = form.username.value.trim();

    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: { username }
      }
    });

    if (error) {
      komunikat.textContent = error.message || 'Nie udało się utworzyć konta.';
      komunikat.classList.add('error');
      return;
    }

    if (data.session) {
      try {
        await apiFetch('/api/auth/profile', {
          method: 'POST',
          body: JSON.stringify({ username })
        });
      } catch (err) {
        console.warn('Nie udało się zapisać profilu po rejestracji', err);
      }

      komunikat.textContent = 'Konto utworzone! Przekierowuję do panelu...';
      komunikat.classList.add('success');
      setTimeout(() => (window.location.href = '/Html/index.html'), 900);
    } else {
      komunikat.textContent = 'Sprawdź e-mail i potwierdź konto.';
      komunikat.classList.add('success');
    }
  });
};

export const handleLogout = () => {
  const przycisk = document.querySelector('[data-akcja="wyloguj"]');
  if (!przycisk) return;

  przycisk.addEventListener('click', async () => {
    try {
      const client = initSupabase();
      await client.auth.signOut();
    } catch (error) {
      console.error('Nie udało się wylogować', error);
    } finally {
      window.location.href = '/Html/logowanie.html';
    }
  });
};

export const zabezpieczStrone = async () => {
  const session = await requireAuth();
  if (!session) return;
  await synchronizeProfile();
};

export { apiFetch };
