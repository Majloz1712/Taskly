import { apiFetch, zabezpieczStrone } from './Uwierzytelnienie.js';

const initToggle = async () => {
  const checkbox = document.querySelector('#toggle-powiadomienia');
  const status = document.querySelector('[data-status-powiadomien]');
  if (!checkbox) return;
  const setStatus = (message) => {
    if (status) {
      status.textContent = message;
    }
  };

  try {
    const profile = await apiFetch('/api/auth/profile');
    if (typeof profile.notifications_enabled === 'boolean') {
      checkbox.checked = profile.notifications_enabled;
      setStatus(profile.notifications_enabled ? 'Powiadomienia włączone' : 'Powiadomienia wyłączone');
    }
  } catch (error) {
    console.warn('Nie udało się pobrać ustawień powiadomień', error);
    setStatus('Nie udało się pobrać ustawień.');
  }

  checkbox.addEventListener('change', async (event) => {
    const enabled = event.target.checked;
    setStatus('Zapisywanie...');
    try {
      await apiFetch('/api/auth/preferences/notifications', {
        method: 'PUT',
        body: JSON.stringify({ enabled })
      });
      setStatus(enabled ? 'Powiadomienia włączone' : 'Powiadomienia wyłączone');
    } catch (error) {
      setStatus('Nie udało się zapisać ustawień');
      checkbox.checked = !enabled;
      alert(error.message || 'Nie udało się zapisać ustawień powiadomień');
    }
  });
};

export const initPowiadomienia = async () => {
  await zabezpieczStrone();
  await initToggle();
};
