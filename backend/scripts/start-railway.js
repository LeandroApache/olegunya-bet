const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const backendDir = path.resolve(__dirname, '..');
const schemaPath = path.join(backendDir, 'prisma', 'schema.prisma');
const mainPath = path.join(backendDir, 'dist', 'main.js');

function redactDatabaseUrl(raw) {
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.username ? '***:***@' : ''}${u.host}${u.pathname}${u.search}`;
  } catch {
    return '(unparseable DATABASE_URL)';
  }
}

function normalizeDatabaseUrl(raw) {
  try {
    const u = new URL(raw);
    if (!u.searchParams.has('connect_timeout')) {
      u.searchParams.set('connect_timeout', '15');
    }
    // Public Railway proxy (*.proxy.rlwy.net) обычно требует SSL.
    const host = u.hostname.toLowerCase();
    if (
      (host.endsWith('.rlwy.net') || host.endsWith('.railway.app')) &&
      !u.searchParams.has('sslmode')
    ) {
      u.searchParams.set('sslmode', 'require');
    }
    return u.toString();
  } catch {
    return raw;
  }
}

function run(label, cmd, args, env = process.env) {
  console.log(`[start-railway] ${label}: ${cmd} ${args.join(' ')}`);
  const res = spawnSync(cmd, args, {
    cwd: backendDir,
    env,
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
console.log('[start-railway] PORT:', process.env.PORT ?? '(not set → app uses 3000)');
console.log('[start-railway] JWT_ACCESS_SECRET set:', Boolean(process.env.JWT_ACCESS_SECRET));

if (!process.env.DATABASE_URL) {
  console.error(
    '[start-railway] DATABASE_URL is missing.\n' +
      'Railway → backend service → Variables → Add Variable → ' +
      'Add Reference → Postgres → DATABASE_URL',
  );
  process.exit(1);
}

const databaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL);
process.env.DATABASE_URL = databaseUrl;
console.log('[start-railway] DATABASE_URL:', redactDatabaseUrl(databaseUrl));

if (!fs.existsSync(mainPath)) {
  console.error(`[start-railway] ${mainPath} not found. Build may have failed.`);
  process.exit(1);
}

if (!fs.existsSync(schemaPath)) {
  console.error(`[start-railway] ${schemaPath} not found.`);
  process.exit(1);
}

const prismaCli = path.join(backendDir, 'node_modules', 'prisma', 'build', 'index.js');
if (!fs.existsSync(prismaCli)) {
  console.error(`[start-railway] prisma CLI not found at ${prismaCli}`);
  process.exit(1);
}

run('migrate', 'node', [prismaCli, 'migrate', 'deploy', '--schema', schemaPath], {
  ...process.env,
  DATABASE_URL: databaseUrl,
});

console.log('[start-railway] migrations OK, starting Nest...');
run('app', 'node', [mainPath], process.env);
