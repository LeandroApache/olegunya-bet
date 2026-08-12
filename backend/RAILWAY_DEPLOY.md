# Railway Deployment Guide

## Build vs runtime logs

| Вкладка | Что показывает |
|--------|----------------|
| **Build Logs** | `npm install`, `npm run build` — только сборка |
| **Deploy Logs** / **Logs** (после "Starting Container") | `npm run start:railway`, миграции, старт Nest |

Если Build Logs без ошибок, но сайт даёт **502** или CORS — смотри **runtime logs**, не build.

### Где открыть runtime logs

1. Railway → проект → сервис **backend** (не Postgres).
2. Вкладка **Deployments** → последний деплой → **View logs**.
3. Или вкладка **Logs** → выбери сервис backend → прокрути к **Starting Container**.
4. Ищи строки `[start-railway]` и `[bootstrap] listening on 0.0.0.0:...`.

Если контейнер падает до старта Node, в логах будет `exited with code` или ошибка Prisma (`P1001`, `P1012`, …).

## Service settings

| Поле | Значение |
|------|----------|
| **Root Directory** | `backend` |
| **Build Command** | `npm run build` (или авто) |
| **Start Command** | `npm run start:railway` |

## Environment variables (backend service)

| Variable | Required | How to set |
|----------|----------|------------|
| `DATABASE_URL` | Yes | Variables → **Add Variable** → **Add Reference** → Postgres → `DATABASE_URL` |
| `JWT_ACCESS_SECRET` | Yes | любая длинная случайная строка |
| `PORT` | Auto | Railway задаёт сам, не перезаписывать |
| `CORS_ORIGIN` | Optional | `https://olegunya-bet.vercel.app` |

Без `DATABASE_URL` скрипт `start-railway` завершится с явной ошибкой в логах.

### Типичная ошибка: Network `connection refused` + HTTP 502

Это **не CORS**. Значит Nest **не слушает порт**, потому что контейнер упал или завис **до** `node dist/main`.

Чаще всего: `prisma migrate deploy` не может достучаться до Postgres.

Проверь:
1. В сервисе **backend** (не Postgres) есть `DATABASE_URL` через **Reference** на Postgres.
2. В runtime logs есть `[start-railway] DATABASE_URL: postgresql://***:***@....railway.../...`
3. После миграций есть `migrations OK, starting Nest...` и `[bootstrap] listening on 0.0.0.0:...`

Если после `Prisma schema loaded...` тишина / crash — почти всегда неверный или недоступный `DATABASE_URL`.

## Build process

1. `prisma generate` → `generated/prisma/`
2. `nest build` → `dist/`
3. `copy:prisma` → `dist/generated/`

## Start process (`start:railway`)

1. `prisma migrate deploy`
2. `node dist/main.js` (listen on `0.0.0.0:$PORT`)

## Quick checks after deploy

```bash
curl -i https://olegunya-bet-production.up.railway.app/graphql
```

Ожидается **не 502** (например 400 или HTML playground). Если 502 — backend не слушает порт или контейнер упал.
