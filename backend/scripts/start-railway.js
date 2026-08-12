const { spawnSync } = require('node:child_process');
const path = require('node:path');

// Railway может запускать команду из другой рабочей директории,
// поэтому пути строим относительно этой папки.
const backendDir = path.resolve(__dirname, '..');
const schemaPath = path.join(backendDir, 'prisma', 'schema.prisma');
const mainPath = path.join(backendDir, 'dist', 'main.js');

function run(cmd, args) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: false });
  if (res.status !== 0) process.exit(res.status || 1);
}

console.log('[start-railway] cwd:', process.cwd());
console.log('[start-railway] backendDir:', backendDir);
console.log('[start-railway] schemaPath:', schemaPath);
console.log('[start-railway] mainPath:', mainPath);
console.log('[start-railway] DATABASE_URL set:', Boolean(process.env.DATABASE_URL));

// 1) Применяем миграции при каждом старте контейнера
// Сначала пробуем запускать prisma из node_modules/.bin (быстрее и меньше зависимостей от PATH).
const prismaBin = path.join(backendDir, 'node_modules', '.bin', 'prisma');
if (require('node:fs').existsSync(prismaBin)) {
  run(prismaBin, ['migrate', 'deploy', '--schema', schemaPath]);
} else {
  // fallback на npx
  run('npx', ['prisma', 'migrate', 'deploy', '--schema', schemaPath]);
}

// 2) Запускаем приложение
run('node', [mainPath]);

