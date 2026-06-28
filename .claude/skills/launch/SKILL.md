---
name: launch
description: Build the BedWars plugin and launch a local Paper 1.21 dev server with filler bots so a single human can play a full BedWars match on localhost. Use when the user asks to run, launch, start, play, or "make a change and launch/test it" for BedWars.
---

# Launch BedWars locally (for playtesting)

This is the canonical "launch Minecraft" procedure for this project. The user is a non-developer:
they describe a change, you implement it, then run this skill so they can join and see it. Follow the
steps in order. Keep the user informed with short status messages; the only thing they do is connect
their Minecraft client and type one command.

## Background

- `./gradlew runServer` builds the BedWars jar and starts a Paper 1.21 server in `run/`. The build
  config (`build.gradle`) already injects `libs/MiniGameCore-2.0.1.jar`, accepts the EULA, and sets
  `online-mode=false` (so offline bots can join). No unit tests run as part of this.
- BedWars has no commands. A match is created and started through MiniGameCore's `/mg` flow, and the
  map needs 4 teams. `tools/bots/swarm.js` (mineflayer) fills the empty teams and starts the match.
- The human connects with **Minecraft Java Edition 1.21.9** to **localhost:25565** (the version must
  match `minecraftVersion` in `build.gradle`; MiniGameCore 2.0.1 requires >= 1.21.6).

## Prerequisite (first time only)

You need the user's **Minecraft username** so the host bot waits for them (and so you can `op` them if
needed). If `CLAUDE.md` doesn't record it, ask once and add it to the "Local play / launch" section of
`CLAUDE.md`. If still unknown, launch without `--human`; the host bot force-starts after ~60s.

## Procedure

> **Working directory:** run everything from the repository root. Backgrounded Bash tasks can start
> in a *different* working directory, so for any command you run with `run_in_background: true`,
> prefix it with `cd <absolute repo root> &&` (e.g. `cd /Users/masterelon/src/BedWars && ...`).
> Gradle alternatively accepts `gradlew -p <repo root> ...`.

1. **Stop any previous run** (clean iteration):
   ```bash
   pkill -TERM -f runServer 2>/dev/null; pkill -f "tools/bots/swarm.js" 2>/dev/null; sleep 2
   ```
   Paper saves worlds on SIGTERM, so this is a clean shutdown.

2. **Build + launch the server in the background** (use the Bash tool with `run_in_background: true`):
   ```bash
   ./gradlew runServer --console=plain > /tmp/bw-server.log 2>&1
   ```
   `runServer` rebuilds the plugin automatically; tests are not in its task graph.

3. **Wait for the server to be ready** by polling `/tmp/bw-server.log` until you see `Done (` and
   `For help, type "help"`. Then confirm plugin health in the same log:
   - `Enabling MiniGameCore`
   - `Starting up BedWars Plugin...`
   - `BedWars world and config setup!`
   - (first run only) `Added BedWars to MiniGameCore config.yml`

   **Abort and report** if any of these appear: `UnknownDependencyException`,
   `ClassNotFoundException`, `Could not load 'plugins/`, `Error setting up BedWars`, or a Java stack
   trace. Do not continue to bots if the server didn't come up healthy.

4. **Install bot deps if missing:**
   ```bash
   [ -d tools/bots/node_modules ] || npm install --prefix tools/bots
   ```

5. **Spawn the bots in the background** (use `run_in_background: true`). Pass `--human` if you know the
   username:
   ```bash
   node tools/bots/swarm.js --count 3 --host localhost --port 25565 --human <MCNAME> > /tmp/bw-bots.log 2>&1
   ```
   Default `--count 3` makes a full 4-team game (1 human + 3 bots). If `/tmp/bw-bots.log` shows
   `Not enough players (required: N)`, relaunch the bots with `--count <N-1>`.

6. **Tell the user to connect** with a clear, short message:
   > Server ready — connect now. Open Minecraft **Java Edition 1.21.9** → Multiplayer → Direct Connect →
   > `localhost:25565`. Once in, type `/mg join BedWars-1` in chat (or click the "join the fun"
   > message). The bots will start the match automatically.

7. **Confirm the match started**: grep the **server** log (authoritative) for the start broadcast:
   ```bash
   grep -E 'Game Started!|Game starting in' /tmp/bw-server.log
   ```
   MiniGameCore sends "Game Started!" as a title, so it appears in the server log but NOT in
   `/tmp/bw-bots.log` — don't rely on the bot log for this. Also surface anything odd in either log
   (`kicked:`, `error:`, `Not enough players`, `permission`, any `Exception`).

## Verifying a specific change

After the match starts, check `/tmp/bw-server.log` for the behavior the change should produce and for
the absence of new exceptions during play. For visual changes, tell the user what to look for in-game.

## Shutting down / relaunching

To stop between iterations, run the `pkill` line from step 1. To relaunch after another code change,
just run this whole procedure again — starting fresh keeps the lobby id at `BedWars-1` so the user's
`/mg join BedWars-1` stays valid.

## Optional: op the human (only if admin/`/mg admin` commands are needed)

`/mg` works without op (`mgcore.use` is default-true), so usually skip this. If needed, start the
server with a console FIFO so you can send commands into it across Bash calls:
```bash
mkfifo /tmp/bw-console 2>/dev/null
# launch (background): ./gradlew runServer --console=plain < /tmp/bw-console > /tmp/bw-server.log 2>&1
# keep stdin open (background): sleep infinity > /tmp/bw-console
echo "op <MCNAME>" > /tmp/bw-console   # after the player has joined
echo "stop" > /tmp/bw-console          # clean shutdown
```
A file descriptor cannot be kept open across separate Bash calls, so the FIFO + holder process is
required for this path.
