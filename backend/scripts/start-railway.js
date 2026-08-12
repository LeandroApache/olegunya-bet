const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const backendDir = path.resolve(__dirname, '..');
const schemaPath = path.join(backendDir, 'prisma', 'schema.prisma');
const mainPath = path.join(backendDir, 'dist', 'main.js');

function run(label, cmd, args) {
  console.log(`[start-railway] ${label}: ${cmd} ${args.join(' ')}`);
  const res = spawnSync(cmd, args, {
    cwd: backendDir,
    stdio: 'inherit',
    shell: false,
  });

  if (res.error) {
    console.error(`[start-railway] ${label} failed:`, res.error.message);
    process.exit(1);
  }

  if (res.status !== 0) {
    console.error(`[start-railway] ${label} exited with code ${res.status}`);
    process.exit(res.status || 1);
  }
}

console.log('[start-railway] cwd:', process.cwd());
console.log('[start-railway] backendDir:', backendDir);
console.log('[start-railway] schemaPath:', schemaPath);
console.log('[start-railway] mainPath:', mainPath);
console.log('[start-railway] PORT:', process.env.PORT ?? '(not set, app defaults to 3000)');
console.log('[start-railway] DATABASE_URL set:', Boolean(process.env.DATABASE_URL));
console.log('[start-railway] JWT_ACCESS_SECRET set:', Boolean(process.env.JWT_ACCESS_SECRET));

if (!process.env.DATABASE_URL) {
  console.error(
    '[start-railway] DATABASE_URL is missing. In Railway: backend service → Variables → ' +
      'Add Reference to Postgres DATABASE_URL (or paste the connection string).',
  );
  process.exit(1);
}

if (!fs.existsSync(mainPath)) {
  console.error(`[start-railway] ${mainPath} not found. Build step may have failed.`);
  process.exit(1);
}

if (!fs.existsSync(schemaPath)) {
  console.error(`[start-railway] ${schemaPath} not found.`);
  process.exit(1);
}

const prismaBin = path.join(backendDir, 'node_modules', 'prisma', 'build', 'index.js');
if (fs.existsSync(prismaBin)) {
  run('migrate', 'node', [prismaBin, 'migrate', 'deploy', '--schema', schemaPath]);
} else {
  run('migrate', 'npx', ['prisma', 'migrate', 'deploy', '--schema', schemaPath]);
}

run('app', 'node', [mainPath]);
