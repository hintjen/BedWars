# Work in progress: bed-respawn bug + multi-game isolation

_Started: 2026-07-07. Status: **investigation ongoing, one fix landed and pending deploy/verification**._

This tracks a live debugging session, not a finished feature. See [STATUS.md](STATUS.md) for the
project's general proven/assumed verification matrix once these threads resolve.

## The original report

> "i still respawned after my bed was broken" — player died after their bed was broken and was
> shown the respawn countdown instead of being eliminated.

Expected behavior (per `PlayerDeathEvent.onPlayerDeath`): if `BedChecker`'s `bedStatus` map shows the
player's team bed as broken, the player should be eliminated (`EliminationTracker.eliminate`), not
respawned. The code path for this looks correct on inspection — the bug has **not yet been isolated**.

## What happened during this session (likely red herring, now ruled out as *the* cause)

The dev server had accumulated serious lobby chaos from manual testing:
- `shoraibit` typed `/mg join Bedwars-1` (lowercase "w") — silently failed, lobby IDs are case-sensitive.
- Out of frustration, `shoraibit` then ran `/mg host BedWars` themselves, creating a **second**,
  overlapping lobby (`BedWars-2`) while the bot-hosted `BedWars-1` kept running independently.
- A third overlapping host attempt caused MiniGameCore itself to log
  `Failed to add player to Team!` for two bots.

With multiple simultaneous games and broken team assignments, bed-tracking/respawn logic can't be
trusted to behave — so the first reproduction is suspect. **Action taken:** restarted the server clean
and ran exactly one game, instructing both players to only use `/mg join BedWars-1`. A clean single
match started successfully at 21:32:40 and is (as of this writing) live, with real PVP working
correctly (players confirmed on separate teams). Watching this match for a genuine bed-break + death
to see if the bug reproduces without the lobby chaos as a confound.

## Real bug found and fixed (code review while investigating): multi-game state leakage

Independent of the above, the user asked that **the plugin support multiple simultaneous games**.
Code review found it did not, safely:

- `ShopListener` declared `villagerColors`, `teamShops`, `currentSharpnessLevel`,
  `currentProtectionLevel`, `currentForgeLevel` as **`static`** fields, even though `GameListener`
  already creates one `ShopListener` instance per lobby. The `static` keyword silently defeated that
  intended per-lobby isolation — team upgrade state was actually shared/leaking across every
  concurrently running game.
- `ShopKeeper.shopKeepers` (villager registry) was also `static final`, globally shared. Its
  `removeAll()` method — had it ever been called — would have despawned **every running game's**
  shop villagers, not just the ending one. It was never actually wired into `GameListener.onGameEnd`,
  so villagers also never got cleaned up when a game ended (a separate leak).

**Fix applied** (commit pending): removed `static` from all the above in `ShopListener.java`; made
`ShopKeeper` fully instance-based and instantiated per lobby in `GameListener`; wired
`ShopKeeper.removeAll()` into `GameListener.onGameEnd` so a game's shop villagers now despawn when
that game ends, without touching other concurrent games. `PlayerDeathEvent` was updated to call the
new `shopListener.hasTeamLevels(team)` / `getSharpnessLevel(team)` instance methods instead of a
static import. Compiles clean (`./gradlew.bat compileJava`).

**Not yet done:**
- Not yet deployed to the running dev server (would require a restart, which would interrupt the
  in-progress bed-break observation above — deliberately deferred).
- Not yet verified live with two actual concurrent games running side by side.
- Not committed to git yet.

## Next steps

1. Watch the current live match for a real bed-break event; confirm whether the respawn bug
   reproduces in a clean single-lobby run.
2. If it reproduces cleanly: instrument/log `BedChecker.checkBeds()` state transitions, and verify the
   hardcoded bed coordinates (`BedChecker.java` / `BedBreakListener.java`, one fixed x/y/z per team)
   actually line up with the bundled map's real bed placement — suspected next culprit given zero
   "Bed has been broken" broadcasts logged across three earlier match attempts this session, despite
   bed(s) allegedly being broken.
3. Restart the server to deploy the multi-game isolation fix, then run two lobbies concurrently to
   confirm shop/team-upgrade state no longer bleeds between them.
4. Commit the multi-game fix once verified.
