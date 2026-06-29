# Testing & validation

How to validate BedWars with **assertions, not guessing**, across versions. The strategy is a layered
pyramid: cheap deterministic checks at the bottom, a real-server check in the middle, and a small
manual/client check at the top. See [STATUS.md](STATUS.md) for current verification state.

## Quick commands

```bash
./gradlew test                  # unit tests (default profile, Java 21)
./gradlew test -Pmc=26.2        # unit tests on the 26.x / Java 25 toolchain
./gradlew build                 # build the 1.21.x jar
./gradlew build -Pmc=26.2       # build the 26.x jar (Java 25)
./gradlew runServer -Pmc=26.2 -PdevOp=<YourName>   # boot a 26.2 dev server, op a human
node tools/playtest.js --human <YourName>          # 1.21.x: server + bots, one command
```

## The validation pyramid

### Layer 1 — Logic (deterministic, no server) ✅ in place
Pure, Bukkit-free logic tested in JUnit. Currently `WinEvaluatorTest` covers win/elimination:
respawned-player-with-broken-bed stays alive, single-survivor wins, bed-only survival, fully-eliminated
team, zero-alive guard. Runs in milliseconds on any Java; version-independent.
**Extend here first** when adding logic (generator timing/amounts, bed tracking, shop pricing) by
keeping the rule in a pure function. Does **not** prove Bukkit-API compatibility.

### Layer 2 — Simulated Bukkit API (no real server) — _not set up_
[MockBukkit](https://github.com/MockBukkit/MockBukkit) can register the plugin, fire events, run the
scheduler, and simulate players in JUnit. Catches event-wiring/command-flow bugs deterministically.
Caveat: it's a mock pinned to an API version — it won't catch a real 26.x API removal/behavior change,
and may not have a 26.x build yet.

### Layer 3 — Real-server test driver — _proposed, not built_
The only thing that proves "works on 26.2" **without a network client**: a guarded command/harness
(e.g. `/bwtest`, or a small separate test plugin) that, on the live server, scripts a match through the
**real** API — assign teams, trigger a bed break, kill players, drive to one survivor — and logs
explicit `PASS/FAIL` per assertion. Because it runs inside the real 26.2 server, it exercises the real
API (would actually catch a removed `GameRule`) and needs no client. Reusable across versions.

### Layer 4 — Real client (end-to-end)
- **1.21.x:** automated via the bot swarm — `node tools/playtest.js --human <name>` (bots start a real
  match; you observe).
- **26.x:** no headless client yet (mineflayer can't speak 26.x — see
  [tools/bots/MINEFLAYER-26X.md](tools/bots/MINEFLAYER-26X.md)). Until then, use the **manual
  acceptance checklist** below, or enable bots on 26.x via ViaVersion+ViaBackwards.

## Manual acceptance checklist (gameplay)

Run on a booted dev server. On 26.2: `./gradlew runServer -Pmc=26.2 -PdevOp=<YourName>`, connect with a
matching client, `/mg host BedWars`, ready/start (bring players or use the 1.21.x bot path). Record
PASS/FAIL — these are objective criteria, not vibes.

- [ ] **Join & lobby** — `/mg host BedWars` creates `BedWars-1`; players can `/mg join BedWars-1`.
- [ ] **Start** — ready + `/mg start`/`/mg confirm` → 10s countdown → `Game Started!`.
- [ ] **Spawn** — each player spawns on their colored team island with leather armor (team color).
- [ ] **Bed present** — each team's bed exists at its spawn.
- [ ] **Generators** — iron/gold spawn at team generators; diamond/emerald at the map generators.
- [ ] **Shop** — right-click a shop villager opens the shop; a purchase deducts resources and grants the item.
- [ ] **Respawn (bed intact)** — die with your bed intact → 5s respawn countdown → respawn at team spawn.
- [ ] **Bed break** — break an enemy bed → broadcast/notification; that team's `bedStatus` flips.
- [ ] **Elimination** — a player from a bed-broken team dies → eliminated (no respawn).
- [ ] **Win** — reduce to one surviving team → that team is declared winner.
- [ ] **Cleanup** — on game end, players are returned to the main world; tasks/listeners are torn down
      (no errors in the server log afterward).
- [ ] **No exceptions** — server log shows no stack traces during the match.

## What "verified" means here

A claim is only "verified" if a test or an observed run backs it. The current matrix lives in
[STATUS.md](STATUS.md#verification-status-proven-vs-assumed). The notable open item is **live gameplay
on 26.2** (Layer 4), which is blocked on a 26.x-capable client or the server-side test driver (Layer 3).
