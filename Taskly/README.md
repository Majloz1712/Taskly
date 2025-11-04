# Taskly

Taskly to aplikacja webowa do planowania i zarządzania zadaniami z wykorzystaniem Supabase (PostgreSQL + Auth). Projekt składa się z frontendu HTML/CSS/JS w ciemnym motywie oraz backendu Node.js/Express.

## Wymagania wstępne
- Node.js 18+
- Konto w [Supabase](https://supabase.com)
- Konto e-mail SMTP do wysyłki powiadomień

## Struktura katalogów
```
Taskly/
├── Backend/
├── Html/
├── Konfiguracja/
├── Skrypt/
├── Styl/
├── Testy/
├── README.md
└── package.json
```

## Konfiguracja Supabase
1. Utwórz nowy projekt w Supabase.
2. W zakładce **Table Editor** utwórz tabelę `profiles`:
   ```sql
   create table public.profiles (
     id uuid primary key default uuid_generate_v4(),
     user_id uuid references auth.users(id) on delete cascade,
     username text not null,
     notifications_enabled boolean default true,
     created_at timestamptz default timezone('utc', now())
   );
   ```
3. Utwórz tabelę `tasks`:
   ```sql
   create type task_status as enum ('todo', 'in_progress', 'done');

   create table public.tasks (
     id uuid primary key default uuid_generate_v4(),
     user_id uuid references auth.users(id) on delete cascade,
     title text not null,
     description text,
     due_date timestamptz,
     created_at timestamptz default timezone('utc', now()),
     updated_at timestamptz default timezone('utc', now()),
     status task_status default 'todo',
     duration interval
   );

   create index tasks_user_due_idx on public.tasks (user_id, due_date);
   create index tasks_user_status_idx on public.tasks (user_id, status);
   ```
4. Włącz **Row Level Security (RLS)** i dodaj polityki:
   ```sql
   alter table public.profiles enable row level security;
   alter table public.tasks enable row level security;

   create policy "Profiles są widoczne tylko dla właściciela" on public.profiles
     using (auth.uid() = user_id);

   create policy "Profile insert" on public.profiles for insert
     with check (auth.uid() = user_id);

  create policy "Profile update" on public.profiles for update
     using (auth.uid() = user_id)
     with check (auth.uid() = user_id);

   create policy "Zadania tylko właściciel" on public.tasks
     using (auth.uid() = user_id);

   create policy "Zadania insert" on public.tasks for insert
     with check (auth.uid() = user_id);

   create policy "Zadania update" on public.tasks for update
     using (auth.uid() = user_id)
     with check (auth.uid() = user_id);

   create policy "Zadania delete" on public.tasks for delete
     using (auth.uid() = user_id);
   ```
5. W zakładce **Authentication** ustaw redirect URL na `http://localhost:3000` (lub port Twojego frontendu) oraz włącz potwierdzenia e-mail jeśli potrzebne.

## Zmienne środowiskowe
Skopiuj `Taskly/Backend/.env.example` do `Taskly/Backend/.env` i uzupełnij wartości:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- `APP_BASE_URL` (np. `http://localhost:3000`)
- `PORT` (port backendu, domyślnie 3000)
- `CRON_SCHEDULE` (np. `*/15 * * * *`)

## Instalacja
```bash
npm install
```

## Uruchomienie w trybie deweloperskim
```bash
npm run dev
```
Backend udostępnia statycznie pliki frontendu z katalogu `Taskly/Html`, `Taskly/Skrypt` oraz `Taskly/Styl`.

## Testy
```bash
npm test
```

## Troubleshooting
- Sprawdź, czy plik `.env` został poprawnie uzupełniony i znajduje się w katalogu `Taskly/Backend`.
- Jeśli scheduler nie wysyła e-maili, upewnij się, że dane SMTP są prawidłowe i dostęp z konta nie jest blokowany.
- W razie problemów z RLS sprawdź logi w Supabase oraz czy token przekazywany do backendu zawiera nagłówek `Authorization: Bearer`.
- Jeżeli frontend nie może załadować konfiguracji Supabase, upewnij się, że endpoint `/konfiguracja.js` zwraca poprawne dane.

## Licencja
Projekt edukacyjny - dostosuj według potrzeb.
