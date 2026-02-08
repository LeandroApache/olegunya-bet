# Структура Backend

```
backend/
├── src/                          # Исходный код приложения
│   ├── main.ts                   # Точка входа приложения
│   ├── app.module.ts             # Главный модуль NestJS
│   ├── app.controller.ts         # REST контроллер
│   ├── app.service.ts            # Сервис приложения
│   ├── app.controller.spec.ts    # Тесты контроллера
│   │
│   ├── auth/                     # Модуль аутентификации
│   │   ├── auth.module.ts        # Модуль аутентификации
│   │   ├── auth.resolver.ts      # GraphQL резолверы
│   │   ├── auth.service.ts       # Бизнес-логика аутентификации
│   │   ├── decorators/
│   │   │   └── current-user.decorator.ts  # Декоратор для получения текущего пользователя
│   │   ├── dto/
│   │   │   ├── auth.inputs.ts    # GraphQL входные данные
│   │   │   └── auth.types.ts    # GraphQL типы
│   │   ├── guards/
│   │   │   └── gql-auth.guard.ts # Guard для защиты GraphQL запросов
│   │   └── strategies/
│   │       └── jwt.strategy.ts   # JWT стратегия Passport
│   │
│   └── prisma/                   # Модуль Prisma
│       ├── prisma.module.ts      # Модуль Prisma (глобальный)
│       └── prisma.service.ts     # Сервис Prisma Client
│
├── prisma/                       # Конфигурация Prisma ORM
│   ├── schema.prisma             # Схема базы данных
│   └── migrations/               # Миграции БД
│       ├── 20260131113346_init/
│       │   └── migration.sql
│       └── migration_lock.toml
│
├── generated/                    # Автогенерированные файлы Prisma
│   └── prisma/                  # Prisma Client
│       ├── index.js             # Главный экспорт Prisma Client
│       ├── client.js             # Обертка клиента
│       ├── runtime/              # Runtime библиотеки
│       └── ...                   # Другие сгенерированные файлы
│
├── dist/                         # Скомпилированный код (генерируется)
│   ├── src/                     # Скомпилированные TypeScript файлы
│   └── generated/                # Скопированные generated файлы
│
├── test/                         # E2E тесты
│   ├── app.e2e-spec.ts
│   └── jest-e2e.json
│
├── node_modules/                 # Зависимости npm
│
├── package.json                  # Зависимости и скрипты
├── package-lock.json             # Lock файл зависимостей
├── tsconfig.json                 # Конфигурация TypeScript
├── tsconfig.build.json           # Конфигурация TypeScript для сборки
├── nest-cli.json                 # Конфигурация NestJS CLI
├── eslint.config.mjs             # Конфигурация ESLint
├── prisma.config.ts              # Конфигурация Prisma
└── README.md                     # Документация
```

## Основные директории

### `src/` - Исходный код
- **`main.ts`** - точка входа, создает и запускает NestJS приложение
- **`app.module.ts`** - корневой модуль, импортирует все остальные модули
- **`auth/`** - модуль аутентификации с GraphQL резолверами, JWT стратегией и guards
- **`prisma/`** - модуль для работы с базой данных через Prisma

### `prisma/` - Конфигурация БД
- **`schema.prisma`** - схема базы данных (модели, связи)
- **`migrations/`** - история миграций базы данных

### `generated/` - Автогенерированные файлы
- **`prisma/`** - Prisma Client, сгенерированный из schema.prisma
- Не редактируется вручную, генерируется командой `prisma generate`

### `dist/` - Скомпилированный код
- Генерируется при сборке (`npm run build`)
- Содержит JavaScript файлы, готовые к запуску

## Технологии

- **NestJS** - фреймворк для Node.js
- **GraphQL** (Apollo) - API
- **Prisma** - ORM для работы с БД
- **PostgreSQL** - база данных
- **JWT** - аутентификация
- **TypeScript** - язык программирования
