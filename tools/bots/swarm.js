#!/usr/bin/env node
/*
 * BedWars dev bot swarm.
 *
 * Connects N offline-mode bots to a local Paper server and drives MiniGameCore's `/mg` flow so a
 * single human can play a full multi-team BedWars match:
 *
 *   host bot:    /mg host BedWars        -> creates lobby "BedWars-1", host becomes owner
 *   filler bots: /mg join BedWars-1      -> join the lobby
 *                /mg ready               -> mark ready
 *   host bot:    /mg ready, then once the human has joined: /mg start -> /mg confirm
 *
 * MiniGameCore details this relies on (v2.0.1):
 *  - Lobby ids are sequential ("<Game>-<n>"), so the first lobby on a fresh server is "BedWars-1".
 *    We also parse the join broadcast ("/mg join <id>") to self-correct if that ever differs.
 *  - `/mg start` is owner-only; if not everyone is ready it asks the owner to run `/mg confirm`.
 *  - `mgcore.use` is default-true, so bots need no op.
 *
 * Usage:
 *   node swarm.js --count 3 --host localhost --port 25565 --game BedWars --human <MinecraftName>
 *
 * Flags (all optional):
 *   --count   number of filler bots (default 3 -> 1 human + 3 bots = one per team)
 *   --host    server host (default localhost)
 *   --port    server port (default 25565)
 *   --game    game name registered in MiniGameCore (default BedWars)
 *   --human   the human's Minecraft username; the host bot waits for them before starting.
 *             If omitted, the host force-starts after a timeout.
 *   --version Minecraft protocol version (default 1.21.9; pass "false" to auto-detect)
 */

const mineflayer = require('mineflayer');
const { parseArgs } = require('node:util');

const { values: argv } = parseArgs({
  options: {
    count: { type: 'string', default: '3' },
    host: { type: 'string', default: 'localhost' },
    port: { type: 'string', default: '25565' },
    game: { type: 'string', default: 'BedWars' },
    human: { type: 'string' },
    version: { type: 'string', default: '1.21.9' },
  },
});

const HOST = argv.host;
const PORT = Number(argv.port);
const COUNT = Number(argv.count);
const GAME = argv.game;
const HUMAN = argv.human || null;
const VERSION = argv.version === 'false' ? false : argv.version;
const DEBUG = process.env.BW_DEBUG === '1';

// Filler bots join 2s after they spawn and ready 1.5s after that; bots spawn PER_BOT_MS apart.
// The host must not start until the LAST filler has had time to join + ready, otherwise it starts an
// almost-empty lobby. These offsets mirror fillerFlow() below.
const PER_BOT_MS = 1500;
const FILLER_JOIN_OFFSET_MS = 2000;
const FILLER_READY_OFFSET_MS = 3500;
// Slack covering per-bot connect/spawn latency (each bot takes ~1-2s to actually spawn after being
// created) plus general headroom, so the host never starts before the last filler has joined.
const SETTLE_MARGIN_MS = 5000;
// Time (since swarm start) by which all filler bots should be joined + readied.
const BOTS_READY_AT_MS = COUNT * PER_BOT_MS + FILLER_READY_OFFSET_MS + SETTLE_MARGIN_MS;
// After we first see the human connected, give them this long to type `/mg join` before starting.
const HUMAN_GRACE_MS = 12_000;
// Absolute fallback: start no matter what after this long. When we're waiting for a human, give them
// plenty of time to launch the client / download the right version; otherwise start promptly.
const FORCE_START_AFTER_MS = (process.env.BW_FORCE_START_MS && Number(process.env.BW_FORCE_START_MS))
  || (argv.human ? 600_000 : 90_000);

const T0 = Date.now();
let lobbyId = `${GAME}-1`; // deterministic on a fresh server; corrected from chat if needed
let started = false;
let humanSeenAt = null;
const bots = [];

function log(name, msg) {
  console.log(`[${name}] ${msg}`);
}

function makeBot(name, role) {
  const bot = mineflayer.createBot({
    host: HOST,
    port: PORT,
    username: name,
    auth: 'offline',
    version: VERSION,
  });
  bot.role = role;

  bot.on('messagestr', (msg) => {
    if (DEBUG) log(name, `chat: ${msg}`);
    const m = msg.match(/\/mg join (\S+)/i);
    if (m) lobbyId = m[1];
    if (/not enough players/i.test(msg)) log(name, `SERVER: ${msg}`);
    // The owner gets told to confirm when not everyone is ready — respond immediately.
    if (role === 'host' && /\/mg confirm/i.test(msg) && !started) {
      bot.chat('/mg confirm');
    }
    if (/game started/i.test(msg) && !started) {
      started = true;
      console.log('GAME STARTED');
    }
  });

  bot.once('spawn', () => {
    log(name, 'spawned');
    antiAfk(bot);
    if (role === 'host') hostFlow(bot);
    else fillerFlow(bot);
  });

  bot.on('kicked', (reason) => log(name, `kicked: ${reason}`));
  bot.on('error', (err) => log(name, `error: ${err.message}`));
  bot.on('end', (reason) => log(name, `disconnected: ${reason}`));

  bots.push(bot);
  return bot;
}

// Paper does not AFK-kick by default; this is cheap insurance and keeps bots chunk-loaded.
function antiAfk(bot) {
  bot._afk = setInterval(() => {
    if (!bot.entity) return;
    bot.look(Math.random() * Math.PI * 2, 0, false);
    bot.setControlState('jump', true);
    setTimeout(() => bot.setControlState('jump', false), 250);
  }, 20_000);
}

function fillerFlow(bot) {
  setTimeout(() => bot.chat(`/mg join ${lobbyId}`), 2000);
  setTimeout(() => bot.chat('/mg ready'), 3500);
}

function hostFlow(bot) {
  // The host bot is op (seeded into ops.json by build.gradle). Op the human so they too can run
  // MiniGameCore's op-only /mg subcommands (e.g. /mg join). Harmless if they connect later.
  if (HUMAN) setTimeout(() => bot.chat(`/op ${HUMAN}`), 2500);
  setTimeout(() => bot.chat(`/mg host ${GAME}`), 3000);
  setTimeout(() => bot.chat('/mg ready'), 5000);

  // Start only once (a) the filler bots have had time to join + ready, and (b) if we're waiting on a
  // human, they've connected and had a grace period to run `/mg join`. We deliberately gate on time
  // rather than the server player count, because connecting != being in the lobby.
  const poll = setInterval(() => {
    if (started || !bot.entity) return;
    const elapsed = Date.now() - T0;

    if (HUMAN) {
      if (bot.players[HUMAN] && humanSeenAt === null) {
        humanSeenAt = Date.now();
        log('host', `human "${HUMAN}" connected; waiting ${HUMAN_GRACE_MS / 1000}s for them to /mg join`);
      }
    }

    const botsReady = elapsed >= BOTS_READY_AT_MS;
    const humanReady = !HUMAN || (humanSeenAt !== null && Date.now() - humanSeenAt >= HUMAN_GRACE_MS);

    if (botsReady && humanReady) {
      clearInterval(poll);
      startMatch(bot, HUMAN ? 'bots ready + human grace elapsed' : 'bots ready');
    }
  }, 1000);

  // Absolute fallback: start anyway (e.g. human never joins / wrong name).
  setTimeout(() => {
    if (started) return;
    clearInterval(poll);
    startMatch(bot, 'timeout fallback');
  }, FORCE_START_AFTER_MS);
}

function startMatch(bot, why) {
  log('host', `issued start+confirm (${why})`);
  bot.chat('/mg start');
  setTimeout(() => bot.chat('/mg confirm'), 1500);
}

function shutdown() {
  for (const bot of bots) {
    try {
      if (bot._afk) clearInterval(bot._afk);
      bot.quit('swarm shutting down');
    } catch (_) { /* ignore */ }
  }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log(
  `Starting swarm: host + ${COUNT} filler bot(s) -> ${HOST}:${PORT}, game ${GAME}` +
  (HUMAN ? `, waiting for human "${HUMAN}"` : ', no human (force-start fallback)'),
);
makeBot('BW_Host', 'host');
for (let i = 1; i <= COUNT; i++) {
  setTimeout(() => makeBot(`BW_Bot${i}`, 'filler'), i * 1500);
}
