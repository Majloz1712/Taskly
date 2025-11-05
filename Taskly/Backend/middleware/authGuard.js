import { supabaseClient } from '../services/supabaseClient.js';

export const authGuard = async (req, res, next) => {
  if (!supabaseClient) {
    return res.status(500).json({ message: 'Brak konfiguracji Supabase.' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Brak tokenu uwierzytelniającego.' });
  }

  const token = authHeader.substring(7);

  try {
    const { data, error } = await supabaseClient.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ message: 'Nieprawidłowy token.' });
    }

    req.user = {
      id: data.user.id,
      email: data.user.email,
      metadata: data.user.user_metadata
    };

    next();
  } catch (err) {
    console.error('Błąd weryfikacji tokenu', err);
    res.status(401).json({ message: 'Nie udało się uwierzytelnić użytkownika.' });
  }
};
