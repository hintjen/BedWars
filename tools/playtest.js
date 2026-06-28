#!/usr/bin/env node
/*
 * Cross-platform playtest orchestrator for BedWars (works on Windows, macOS, and Linux).
 *
 * One command does the whole loop:
 *   1. builds + starts the dev Paper server (./gradlew runServer or gradlew.bat runServer)
 *   2. waits until the server is ready (and aborts on startup errors)
 *   3. installs bot deps if needed, then starts the filler-bot swarm
 *   4. prints connect instructions
 *   5. on Ctrl+C, shuts the server down cleanly (sends "stop" to its console) and stops the bots
 *
 * This is the portable equivalent of .claude/skills/launch/SKILL.md (which uses Unix-only tools).
 *
 * Usage:
 *   node tools/playtest.js --human <YourMinecraftName>
 *   node tools/playtest.js --human Steve --count 3
 *   node tools/playtest.js --no-bots            # just the server
 *
 * Flags:
 *   --human <name>   your Minecraft username (host bot waits for you and ops you). Optional.
 *   --count <n>      number of filler bots (default 3 -> 1 human + 3 bots = one per team)
 *   --version <v>    Minecraft version the bots speak (default 1.21.9; must match build.gradle)
 *   --host <h>       server host the bots connect to (default localhost)
 *   --port <p>       server port (default 25565)
 *   --no-bots        start only the server (you bring your own players)
 */

const { spawn, spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');

const ROOT = path.resolve(__dirname, '..');
const BOTS_DIR = path.join(ROOT, 'tools', 'bots');
const IS_WIN = process.platform === 'win32';
const GRADLEW = IS_WIN ? 'gradlew.bat' : './gradlew';

const READY_RE = /Done \(/;
const ERROR_RE = /UnknownDependencyException|ClassNotFoundException|Could not load 'plugins|Error setting up BedWars/;
const READY_TIMEOUT_MS = 240_000; // first run downloads Paper, so allow generous time

const { values: argv } = parseArgs({
  options: {
    human: { type: 'string' },
    count: { type: 'string', default: '3' },
    version: { type: 'string', default: '1.21.9' },
    host: { type: 'string', default: 'localhost' },
    port: { type: 'string', default: '25565' },
    'no-bots': { type: 'boolean', default: false },
  },
});

let server = null;
let bots = null;
let serverReady = false;
let shuttingDown = false;

function tag(prefix, chunk) {
  const text = chunk.toString();
  for (const line of text.split(/\r?\n/)) {
    if (line.length) console.log(`[${prefix}] ${line}`);
  }
}

function startServer() {
  console.log(`[playtest] starting dev server via ${GRADLEW} runServer ...`);
  // shell:true so the .bat / ./gradlew wrapper resolves on every OS.
  server = spawn(GRADLEW, ['runServer', '--console=plain'], {
    cwd: ROOT,
    shell: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const onData = (chunk) => {
    tag('server', chunk);
    const text = chunk.toString();
    if (!serverReady && READY_RE.test(text)) {
      serverReady = true;
      onServerReady();
    }
    if (ERROR_RE.test(text)) {
      console.error('[playtest] server reported a startup error — aborting.');
      shutdown(1);
    }
  };
  server.stdout.on('data', onData);
  server.stderr.on('data', onData);

  server.on('exit', (code) => {
    if (shuttingDown) return;
    console.error(`[playtest] server exited unexpectedly (code ${code}).`);
    shutdown(code || 1);
  });

  setTimeout(() => {
    if (!serverReady && !shuttingDown) {
      console.error('[playtest] server did not become ready in time — aborting.');
      shutdown(1);
    }
  }, READY_TIMEOUT_MS);
}

function ensureBotDeps() {
  if (existsSync(path.join(BOTS_DIR, 'node_modules'))) return true;
  console.log('[playtest] installing bot dependencies (npm install) ...');
  const res = spawnSync('npm', ['install'], { cwd: BOTS_DIR, shell: true, stdio: 'inherit' });
  if (res.status !== 0) {
    console.error('[playtest] npm install failed — cannot start bots.');
    return false;
  }
  return true;
}

function startBots() {
  if (!ensureBotDeps()) return;
  const args = [
    path.join('tools', 'bots', 'swarm.js'),
    '--count', argv.count,
    '--host', argv.host,
    '--port', argv.port,
    '--version', argv.version,
  ];
  if (argv.human) args.push('--human', argv.human);
  console.log(`[playtest] starting bots: node ${args.join(' ')}`);
  bots = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  bots.stdout.on('data', (c) => tag('bots', c));
  bots.stderr.on('data', (c) => tag('bots', c));
  bots.on('exit', (code) => {
    if (!shuttingDown) console.log(`[playtest] bots exited (code ${code}).`);
  });
}

function onServerReady() {
  console.log('\n========================================================');
  console.log(' SERVER READY — connect now');
  console.log(` 1. Open Minecraft Java Edition ${argv.version}`);
  console.log(' 2. Multiplayer -> Direct Connect -> ' + `${argv.host}:${argv.port}`);
  console.log(' 3. In chat, type:  /mg join BedWars-1');
  console.log('========================================================\n');

  if (argv['no-bots']) {
    console.log('[playtest] --no-bots set; bring your own players. Ctrl+C to stop.');
  } else {
    startBots();
  }
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\n[playtest] shutting down ...');

  if (bots && !bots.killed) {
    try { bots.kill(); } catch (_) { /* ignore */ }
  }

  if (server && !server.killed) {
    // Ask Paper to stop cleanly via its console (works cross-platform; saves the world).
    try { server.stdin.write('stop\n'); } catch (_) { /* ignore */ }
    const force = setTimeout(() => {
      try {
        if (IS_WIN) spawnSync('taskkill', ['/pid', String(server.pid), '/t', '/f']);
        else server.kill('SIGKILL');
      } catch (_) { /* ignore */ }
      process.exit(code);
    }, 20_000);
    server.on('exit', () => { clearTimeout(force); process.exit(code); });
  } else {
    process.exit(code);
  }
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

startServer();
