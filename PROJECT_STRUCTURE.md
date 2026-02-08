# Структура проекта olegunya-bet

## Общая структура

```
olegunya-bet/
├── backend/          # NestJS бэкенд приложение
├── frontend/         # Фронтенд (пока пусто)
└── docker-compose.yml # Конфигурация Docker для PostgreSQL
```

## Backend (`/backend`)

### Основные директории

- **`src/`** - Исходный код приложения
  - `app.module.ts` - Главный модуль приложения (NestJS)
  - `main.ts` - Точка входа приложения
  - `auth/` - Модуль аутентификации
    - `auth.module.ts` - Модуль аутентификации
    - `auth.resolver.ts` - GraphQL резолверы
    - `auth.service.ts` - Бизнес-логика аутентификации
    - `dto/` - Data Transfer Objects (типы и входные данные)
    - `guards/` - Guard'ы для защиты маршрутов (gql-auth.guard.ts)
    - `decorators/` - Кастомные декораторы (current-user.decorator.ts)
    - `strategies/` - Стратегии аутентификации (JWT)

- **`prisma/`** - Prisma ORM
  - `schema.prisma` - Схема базы данных

- **`generated/prisma/`** - Автогенерированные типы Prisma
  - `models/` - TypeScript типы для моделей БД
  - `client.ts` - Prisma Client

- **`test/`** - E2E тесты

### Конфигурационные файлы

- `package.json` - Зависимости и скрипты
- `tsconfig.json` - Конфигурация TypeScript
- `nest-cli.json` - Конфигурация NestJS CLI
- `eslint.config.mjs` - Конфигурация ESLint
- `prisma.config.ts` - Конфигурация Prisma

## Технологический стек

- **Backend**: NestJS + GraphQL (Apollo)
- **База данных**: PostgreSQL (через Docker)
- **ORM**: Prisma
- **Аутентификация**: JWT + bcrypt

## Docker

- PostgreSQL 15 контейнер на порту 5432
- База данных: `betting`
- Пользователь: `oleg`
