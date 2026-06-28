# BedWars — project notes for Claude

BedWars is a Paper 1.21 Minecraft plugin (Java 21, Gradle). It runs on top of **MiniGameCore**, a
separate plugin that handles lobbies, teams, and the `/mg` command. BedWars itself registers no
commands — it reacts to MiniGameCore's `GameStartEvent`/`GameOverEvent`.

## Building

- `./gradlew build` — compiles, runs unit tests, produces `build/libs/BedWars-1.0.jar`.
- `./gradlew test` — runs the unit tests (currently the win/elimination logic in `WinEvaluatorTest`).
- MiniGameCore is vendored at `libs/MiniGameCore-2.0.1.jar` (its JitPack snapshot doesn't publish a
  resolvable jar), wired as `compileOnly`. To upgrade it, drop the new jar in `libs/` and update the
  filename in `build.gradle`.

## Local play / launch

The user is a non-developer. The loop is: they ask for a change → implement it → run the **`launch`
skill** (`.claude/skills/launch/SKILL.md`), which builds the plugin, starts a self-contained dev
server in the background, and spawns filler bots so a full match can start with one human.

- **Connect with:** Minecraft **Java Edition 1.21.9** → Direct Connect → `localhost:25565`. The client
  version must match `minecraftVersion` in `build.gradle` (MiniGameCore 2.0.1 needs >= 1.21.6).
- **One manual step in-game:** type `/mg join BedWars-1` (or click the broadcast). Bots auto-ready and
  start the match.
- **Minecraft username:** `HomerunDesktop` — always pass this to the bots as `--human HomerunDesktop`
  so the host bot waits for the real player and ops them before starting.
- **Bots:** `tools/bots/swarm.js` (mineflayer). `node tools/bots/swarm.js --count 3 --human <name>`.
  Default 3 bots + 1 human = one per team. The server runs `online-mode=false` to allow them.

## How a match works (for debugging)

- `BedWarsMain` registers `GameListener` and runs `CopyWorldAndConfig` on enable (unzips the bundled
  map to `plugins/MiniGameCore/MiniGames/BedWars_world/` and adds `BedWars` to MiniGameCore's
  `available-games`).
- On `GameStartEvent`, `GameListener` wires up the per-lobby listeners/tasks: beds, generators, shops,
  death handling, and win checking.
- Win detection lives in `generic/checkWins.java` + `generic/WinEvaluator.java`, using
  `generic/EliminationTracker.java` (a player is "out" only when they die with a broken bed). This
  deliberately does **not** rely on MiniGameCore's `getAlivePlayers()` counter, which is unreliable
  after respawns.
