# Users API на Express и MongoDB

Практическое занятие 20: простое приложение для управления пользователями через API и документоориентированную NoSQL базу MongoDB.

## Что реализовано

- `POST /api/users` - создание пользователя.
- `GET /api/users` - список пользователей, поддерживает `?search=`.
- `GET /api/users/:id` - получение пользователя по числовому `id`.
- `PATCH /api/users/:id` - обновление пользователя.
- `DELETE /api/users/:id` - удаление пользователя.
- Коллекция `users` с полями `id`, `first_name`, `last_name`, `age`, `created_at`, `updated_at`.
- `created_at` и `updated_at` сохраняются в Unix-времени.
- Веб-интерфейс для проверки CRUD-операций.

## Настройка MongoDB

Можно использовать локальную MongoDB или MongoDB Atlas.

1. Создайте файл `.env` на основе `.env.example`.
2. Укажите строку подключения в `MONGODB_URI`.
3. Если переменная не задана, приложение попробует подключиться к локальной базе:

```text
mongodb://127.0.0.1:27017/practice20
```

В проект также добавлен `docker-compose.yml`, поэтому локальную MongoDB можно поднять без ручной установки:

```bash
docker compose up -d mongodb
```

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

Пример создания пользователя:

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Михаил","last_name":"Алехин","age":20}'
```
