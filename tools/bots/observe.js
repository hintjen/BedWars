#!/usr/bin/env node
/*
 * One-shot introspection bot for a running BedWars match.
 *
 * Connects as a pre-opped bot, spectates the lobby (to enter the live game world), then prints a
 * snapshot: online players, where every player entity is, and whether each team's bed still exists.
 * Disconnects when done. Read-only — it does not affect the match.
 *
 * Usage:
 *   node observe.js [--lobby BedWars-1] [--name BW_Bot9] [--host localhost] [--port 25565]
 *
 * Note: --name must be one of the bots seeded into ops.json by build.gradle (BW_Host, BW_Bot1..12),
 * otherwise /mg spectate is denied. BW_Bot9 is unused by a default 3-bot swarm.
 */

const mineflayer = require('mineflayer');
const Vec3 = require('vec3');
const { parseArgs } = require('node:util');

const { values: argv } = parseArgs({
  options: {
    lobby: { type: 'string', default: 'BedWars-1' },
    name: { type: 'string', default: 'BW_Bot9' },
    host: { type: 'string', default: 'localhost' },
    port: { type: 'string', default: '25565' },
    version: { type: 'string', default: '1.21.9' },
    wait: { type: 'string', default: '5000' }, // ms to let spectate teleport + chunks load
  },
});

// BedWars bed locations (hard-coded in BedChecker.java); the copied game world keeps these coords.
const BEDS = {
  Red: [0, 67, 66],
  Blue: [-66, 67, 0],
  Yellow: [0, 67, -66],
  Green: [66, 67, 0],
};

const fmt = (p) => (p ? `(${p.x.toFixed(0)}, ${p.y.toFixed(0)}, ${p.z.toFixed(0)})` : 'unknown');

const bot = mineflayer.createBot({
  host: argv.host,
  port: Number(argv.port),
  username: argv.name,
  auth: 'offline',
  version: argv.version === 'false' ? false : argv.version,
});

bot.on('error', (e) => { console.log('error:', e.message); });
bot.on('kicked', (r) => { console.log('kicked:', r); });

bot.once('spawn', () => {
  bot.chat(`/mg spectate ${argv.lobby}`);
  setTimeout(report, Number(argv.wait));
});

function report() {
  console.log('===== BEDWARS LIVE SNAPSHOT =====');
  console.log(`world/dimension: ${bot.game && bot.game.dimension}`);
  console.log(`observer pos:    ${fmt(bot.entity && bot.entity.position)}`);

  const players = Object.values(bot.players).map((p) => `${p.username} (ping ${p.ping}ms)`);
  console.log(`\nonline players (${players.length}):`);
  players.forEach((p) => console.log(`  - ${p}`));

  const playerEntities = Object.values(bot.entities).filter((e) => e.type === 'player');
  console.log(`\nplayer positions in this world (${playerEntities.length} visible):`);
  if (playerEntities.length === 0) {
    console.log('  (none visible — spectate may not have entered the game world, or players are out of range)');
  }
  playerEntities.forEach((e) => console.log(`  - ${e.username || '?'} @ ${fmt(e.position)}`));

  console.log('\nbed status:');
  for (const [team, [x, y, z]] of Object.entries(BEDS)) {
    let label;
    try {
      const block = bot.blockAt(Vec3(x, y, z));
      const name = block ? block.name : 'unloaded';
      const intact = name.includes('bed');
      label = `${intact ? 'INTACT' : 'GONE'} (block: ${name})`;
    } catch (err) {
      label = `unknown (${err.message})`;
    }
    console.log(`  - ${team.padEnd(7)} @ (${x},${y},${z}): ${label}`);
  }

  console.log('\n=================================');
  bot.quit('observation complete');
  setTimeout(() => process.exit(0), 500);
}
