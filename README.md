# Users API на Express и Supabase

Практическое занятие 19: простое приложение для управления пользователями через API и PostgreSQL. В качестве PostgreSQL можно использовать Supabase.

## Что реализовано

- `POST /api/users` - создание пользователя.
- `GET /api/users` - список пользователей, поддерживает `?search=`.
- `GET /api/users/:id` - получение пользователя по `id`.
- `PATCH /api/users/:id` - обновление пользователя.
- `DELETE /api/users/:id` - удаление пользователя.
- Таблица `users` с полями `id`, `first_name`, `last_name`, `age`, `created_at`, `updated_at`.
- Веб-интерфейс для проверки CRUD-операций.

## Настройка Supabase

1. Создайте проект в Supabase.
2. Нажмите `Connect` в Supabase Dashboard.
3. Для Codespaces и IPv4-сетей скопируйте строку `Session pooler`, а не `Direct connection`.
   Direct connection вида `db.[ref].supabase.co:5432` может быть IPv6-only и давать ошибку `ENETUNREACH`.
4. Создайте файл `.env` на основе `.env.example`.
5. Вставьте строку подключения в `DATABASE_URL`.

Приложение создает таблицу автоматически при запуске. Если нужно создать ее вручную, выполните SQL из `schema.sql` в Supabase SQL Editor.

## Запуск

```bash
npm install
npm start
```

После запуска откройте:

```text
http://localhost:3000
```

Проверка API:

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/users
```
