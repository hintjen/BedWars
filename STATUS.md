# Project status, verification & known limitations

_Last updated: 2026-07-07. Scope: `main` (the `bedwars-winfix-and-playtest-workflow` branch has been
merged — it is the same commit as `main`)._

A snapshot of what's been changed, **what's actually verified vs assumed**, current limitations, and
future work. Companion docs: [TESTING.md](TESTING.md), [BUILDING-Windows.md](BUILDING-Windows.md),
[tools/bots/MINEFLAYER-26X.md](tools/bots/MINEFLAYER-26X.md).

## What changed on this branch

- **Win-condition bug fix** — games no longer declare the wrong winner when a respawned player's team
  loses its bed. New `WinEvaluator` (pure logic) + `EliminationTracker`, wired into `checkWins` /
  `PlayerDeathEvent` / `GameListener`; no longer trusts MiniGameCore's `getAlivePlayers()`.
- **Self-contained build** — MiniGameCore vendored at `libs/MiniGameCore-2.0.1.jar`; JUnit added.
- **Playtest workflow** — self-contained `runServer` (EULA, offline-mode, `ops.json`), mineflayer bot
  swarm (`tools/bots/swarm.js`), introspection bot (`observe.js`), cross-platform orchestrator
  (`tools/playtest.js`), and a Unix `launch` skill.
- **26.x toolchain** — switchable `-Pmc` profile (default `1.21.9`/Java 21, `-Pmc=26.2`/Java 25),
  Java toolchain auto-provisioned via foojay, run-paper 3.x + Gradle 8.14.3.

## Verification status (proven vs assumed)

| Item | Status | How |
|------|--------|-----|
| Win/elimination logic | ✅ Verified | 5 unit tests (`WinEvaluatorTest`), pass on Java 21 and Java 25 |
| Default build `1.21.9` / Java 21 | ✅ Verified | `./gradlew build` green |
| Default build on **Windows 11** | ✅ Verified | `.\gradlew.bat build` green on a clean checkout (2026-07-07); JDK 21.0.7, Node 25.6, Git 2.52 — see [BUILDING-Windows.md](BUILDING-Windows.md) |
| Modern build `26.2` / Java 25 | ✅ Verified | `./gradlew build -Pmc=26.2` compiles + tests pass (bytecode = Java 25) |
| Plugin loads/enables on **1.21.x** | ✅ Verified | dev server boots both plugins, 0 errors |
| Plugin loads/enables on **26.2** | ✅ Verified | `runServer -Pmc=26.2` boots both plugins on Java 25, 0 errors |
| Original **1.21-built jar runs on 26.2** unmodified | ✅ Verified | loaded the Java-21 jar on a Paper 26.2 server; enabled cleanly (no rebuild needed) |
| Full match starts end-to-end on **1.21.x** | ✅ Verified | human + 3 bots → countdown → `Game Started!` |
| Full **in-game gameplay on 26.2** (bed-break, generators, win, shop) | ❌ **Not verified** | no client/bots can play a 26.2 match yet (see limitations) |
| Bots connect to **26.x** | ❌ Does not work | mineflayer has no 26.x protocol support |

> Bottom line: everything **builds, loads, and enables** on both 1.21.x and 26.2, and the win logic is
> unit-tested. The **one unproven area is live gameplay on 26.2** — very likely fine (stable API only),
> but observe it with a real client before claiming it.

## Known limitations

- **Bots only fill teams and idle** — they join, ready, and start a match, then stand at spawn (with a
  small anti-AFK twitch). They do not gather, shop, fight, or break beds. Good for win/elimination
  testing; not a real opponent.
- **No bots on 26.x** — mineflayer/node-minecraft-protocol top out at 1.21.11; the 26.x packet IDs
  aren't in `minecraft-data`. So the auto-bot playtest loop only works on the 1.21.x profile. Options
  in [tools/bots/MINEFLAYER-26X.md](tools/bots/MINEFLAYER-26X.md) (ViaVersion+ViaBackwards recommended).
- **Two separate build profiles** — a `26.x`/Java 25 jar cannot run on a `1.21.x`/Java 21 server, and
  vice-versa. Build the artifact for the server you're deploying to.
- **Deprecated API on 26.x** — `GameRule.ANNOUNCE_ADVANCEMENTS` and `GameRule.DO_FIRE_TICK`
  (`GameListener`) are deprecated-for-removal in 26.x. They still work on 26.2 but will break on a
  future version that removes them — see Future work.
- **`api-version: '1.21'`** is still declared in `plugin.yml`; accepted by the 26.2 server but not
  revisited for the 26.x scheme.
- **Switching `-Pmc` migrates `run/`** — the dev world is created by one MC version; booting a
  different version triggers a Paper world-storage migration (30s prompt). Delete `run/` to start fresh.
- **paper-api for 26.2 is alpha-only** (`26.2.build.+`); 26.2 is bleeding edge. 26.1.2 has stable
  paper-api/builds if a steadier base is preferred.
- **MiniGameCore is vendored**, not pulled from a working repo — upgrade by dropping a new jar in
  `libs/` and updating the filename in `build.gradle`.
- **Solo match start** on a no-bots server depends on MiniGameCore's minimum-player setting (unverified).

## Future work

- [ ] Migrate the two deprecated `GameRule` calls before a future version removes them.
- [ ] Enable bots on 26.x — try **ViaVersion + ViaBackwards** so the existing 1.21 bots reach a 26.x
      server (see [tools/bots/MINEFLAYER-26X.md](tools/bots/MINEFLAYER-26X.md)).
- [ ] Add a **server-side test driver** to validate live gameplay on 26.2 without a network client
      (see [TESTING.md](TESTING.md)).
- [ ] Manually verify a full 26.2 match against the acceptance checklist in [TESTING.md](TESTING.md).
- [ ] Revisit `api-version` for the 26.x versioning scheme.
- [ ] Optional: give bots real behavior (gather/shop/combat) for realistic playtests.
