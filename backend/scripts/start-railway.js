const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const { Client } = require('pg');

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

function needsRailwaySsl(connectionString) {
  try {
    const host = new URL(connectionString).hostname.toLowerCase();
    return host.endsWith('.rlwy.net') || host.endsWith('.railway.app');
  } catch {
    return String(connectionString).includes('rlwy.net');
  }
}

function normalizeDatabaseUrl(raw) {
  try {
    const u = new URL(raw);
    if (!u.searchParams.has('connect_timeout')) {
      u.searchParams.set('connect_timeout', '15');
    }
    if (needsRailwaySsl(raw) && !u.searchParams.has('sslmode')) {
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

async function probeDatabase(connectionString) {
  console.log('[start-railway] probing database connection...');
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 15000,
    ssl: needsRailwaySsl(connectionString)
      ? { rejectUnauthorized: false }
      : undefined,
  });

  try {
    await client.connect();
    const result = await client.query('select 1 as ok');
    console.log('[start-railway] database probe OK:', result.rows[0]);
  } catch (err) {
    console.error('[start-railway] database probe FAILED');
    console.error('[start-railway] error code:', err && err.code);
    console.error('[start-railway] error message:', err && err.message);
    process.exit(1);
  } finally {
    try {
      await client.end();
    } catch {
      // ignore
    }
  }
}

async function main() {
  console.log('[start-railway] cwd:', process.cwd());
  console.log('[start-railway] backendDir:', backendDir);
  console.log('[start-railway] schemaPath:', schemaPath);
  console.log('[start-railway] mainPath:', mainPath);
  console.log('[start-railway] PORT:', process.env.PORT ?? '(not set → app uses 3000)');
  console.log(
    '[start-railway] JWT_ACCESS_SECRET set:',
    Boolean(process.env.JWT_ACCESS_SECRET),
  );
  console.log(
    '[start-railway] DATABASE_URL raw set:',
    Boolean(process.env.DATABASE_URL),
  );

  if (!process.env.DATABASE_URL) {
    console.error(
      '[start-railway] DATABASE_URL is missing on the backend service.\n' +
        'Even with Shared Variables, open backend → Variables and confirm DATABASE_URL is listed there.',
    );
    process.exit(1);
  }

  if (!process.env.JWT_ACCESS_SECRET) {
    console.error(
      '[start-railway] JWT_ACCESS_SECRET is missing. Nest will crash on auth module init.',
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

  await probeDatabase(databaseUrl);

  const prismaCli = path.join(
    backendDir,
    'node_modules',
    'prisma',
    'build',
    'index.js',
  );
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
}

main().catch((err) => {
  console.error('[start-railway] unexpected failure:', err);
  process.exit(1);
});
