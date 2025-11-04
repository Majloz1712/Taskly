export const getSupabaseConfig = () => {
  const { SUPABASE_URL, SUPABASE_ANON_KEY, API_BASE_URL } = window.__TASKLY_ENV || {};
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('Nie znaleziono konfiguracji Supabase. Sprawdź /konfiguracja.js.');
  }
  return {
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY,
    apiBaseUrl: API_BASE_URL || window.location.origin
  };
};
