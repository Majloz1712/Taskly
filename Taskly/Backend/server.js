import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import taskRoutes from './routes/tasks.js';
import { initScheduler } from './services/scheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();

const allowedOrigin = process.env.APP_BASE_URL || 'http://localhost:3000';
app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(helmet());
app.use(express.json());
app.use(morgan('dev'));

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);

const publicRoot = path.join(__dirname, '..');
app.use('/Skrypt', express.static(path.join(publicRoot, 'Skrypt')));
app.use('/Styl', express.static(path.join(publicRoot, 'Styl')));
app.use('/Html', express.static(path.join(publicRoot, 'Html')));

app.get('/konfiguracja.js', (req, res) => {
  res.type('application/javascript');
  res.send(`window.__TASKLY_ENV = ${JSON.stringify({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    API_BASE_URL: process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`
  })};`);
});

app.get('/', (req, res) => {
  res.redirect('/Html/logowanie.html');
});

app.use((req, res) => {
  res.status(404).json({ message: 'Nie znaleziono zasobu.' });
});

app.use((err, req, res, next) => {
  console.error('Błąd aplikacji', err);
  res.status(500).json({ message: 'Wewnętrzny błąd serwera.' });
});

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`Taskly backend działa na porcie ${port}`);
});

initScheduler();

export default server;
