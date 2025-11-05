import { Router } from 'express';
import { authGuard } from '../middleware/authGuard.js';
import { supabaseAdmin } from '../services/supabaseClient.js';

const router = Router();

const ensureAdmin = (res) => {
  if (!supabaseAdmin) {
    res.status(500).json({ message: 'Brak konfiguracji Supabase (service role).' });
    return false;
  }
  return true;
};

const ensureProfile = async (userId, email) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, username, notifications_enabled')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return data;
  }

  const username = email?.split('@')[0] ?? 'Nowy użytkownik';
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('profiles')
    .insert({ user_id: userId, username })
    .select('id, username, notifications_enabled')
    .single();

  if (insertError) {
    throw insertError;
  }

  return inserted;
};

router.get('/session', authGuard, async (req, res) => {
  if (!ensureAdmin(res)) return;

  try {
    const profile = await ensureProfile(req.user.id, req.user.email);
    res.json({ user: req.user, profile });
  } catch (error) {
    console.error('Nie udało się pobrać profilu', error);
    res.status(500).json({ message: 'Nie udało się pobrać profilu.' });
  }
});

router.get('/profile', authGuard, async (req, res) => {
  if (!ensureAdmin(res)) return;
  try {
    const profile = await ensureProfile(req.user.id, req.user.email);
    res.json(profile);
  } catch (error) {
    res.status(500).json({ message: 'Nie udało się pobrać profilu.' });
  }
});

router.post('/profile', authGuard, async (req, res) => {
  if (!ensureAdmin(res)) return;

  const { username } = req.body;
  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    return res.status(400).json({ message: 'Nazwa użytkownika jest wymagana i musi mieć co najmniej 3 znaki.' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .upsert({ user_id: req.user.id, username: username.trim() }, { onConflict: 'user_id' })
      .select('username, notifications_enabled')
      .single();

    if (error) {
      throw error;
    }

    res.json({ message: 'Profil zaktualizowany pomyślnie.', profile: data });
  } catch (error) {
    console.error('Błąd aktualizacji profilu', error);
    res.status(500).json({ message: 'Nie udało się zaktualizować profilu.' });
  }
});

router.put('/preferences/notifications', authGuard, async (req, res) => {
  if (!ensureAdmin(res)) return;
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ message: 'Wartość włączenia powiadomień musi być typu boolean.' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .upsert({ user_id: req.user.id, notifications_enabled: enabled }, { onConflict: 'user_id' })
      .select('username, notifications_enabled')
      .single();

    if (error) {
      throw error;
    }

    res.json({ message: 'Ustawienia powiadomień zapisane.', profile: data });
  } catch (error) {
    console.error('Błąd zapisu powiadomień', error);
    res.status(500).json({ message: 'Nie udało się zapisać ustawień powiadomień.' });
  }
});

router.delete('/account', authGuard, async (req, res) => {
  if (!ensureAdmin(res)) return;

  try {
    await supabaseAdmin.from('tasks').delete().eq('user_id', req.user.id);
    await supabaseAdmin.from('profiles').delete().eq('user_id', req.user.id);

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(req.user.id);
    if (deleteError) {
      throw deleteError;
    }

    res.json({ message: 'Konto zostało usunięte.' });
  } catch (error) {
    console.error('Błąd usuwania konta', error);
    res.status(500).json({ message: 'Nie udało się usunąć konta.' });
  }
});

export default router;
