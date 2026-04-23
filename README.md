# Практика 22: балансировка нагрузки

Демонстрационное приложение для ТЗ из файла `№22 Практические занятия...pdf`.

Что реализовано:

- 3 backend-сервера на Node.js (`backend1`, `backend2`, `backend3`);
- `Nginx` как основной балансировщик нагрузки;
- `HAProxy` как альтернативный балансировщик;
- резервный backend через `backup`;
- отказоустойчивость в `Nginx` через `max_fails` и `fail_timeout`;
- health checks в `HAProxy`;
- простая веб-страница для проверки распределения запросов.

## Запуск

```bash
docker compose up --build
```

## Адреса

- `http://localhost:8080` — демо-страница через `Nginx`
- `http://localhost:8081` — запросы через `HAProxy`
- `http://localhost:8404/stats` — статистика `HAProxy`
- `http://localhost:3000` — `backend1`
- `http://localhost:3001` — `backend2`
- `http://localhost:3002` — `backend3` (резервный)

## Как проверить балансировку

1. Откройте `http://localhost:8080`.
2. Нажмите `12 запросов через Nginx`.
3. В ответах будут чередоваться `backend-1` и `backend-2`.
4. Для проверки резервного узла остановите основные серверы:

```bash
docker compose stop backend1 backend2
```

5. После этого запросы через `Nginx` и `HAProxy` начнет обслуживать `backend-3`.

## Как остановить

```bash
docker compose down
```
