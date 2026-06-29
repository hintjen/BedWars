# Mineflayer support for Minecraft 26.x (investigation)

_Last updated: 2026-06-28. Status: **not working on 26.x yet** — captured findings + options._

## TL;DR

The dev playtest bots (`swarm.js`, `observe.js`) use **mineflayer**, which **cannot connect to a
26.x server today**. Mineflayer/node-minecraft-protocol support **up to 1.21.11** only. The bots
connect and log in, then get **kicked with a packet-decode error** because the packet-ID tables for
the 26.x protocol are missing/incorrect in `minecraft-data`.

For our use case (fill teams so a human can start a match), the **cheapest fix is a server-side
ViaVersion + ViaBackwards proxy** — our existing 1.21 bots connect to the 26.x server unchanged, no
mineflayer/protocol work. Native mineflayer 26.x support is the "proper" fix but is a wait-or-
contribute effort upstream.

## Why it doesn't work

The PrismarineJS stack is **data-driven**:

```
mineflayer  ->  node-minecraft-protocol (mcp)  ->  minecraft-data (+ prismarine-* libs)
```

Version support lives almost entirely in **minecraft-data** (packet definitions, protocol number,
registries). mcp/mineflayer currently whitelist **up to 1.21.11**; 26.x is not enabled.

**The specific 26.x break:** 26.1.x is **protocol 775**, which added ~15 new serverbound packets and
**shifted all subsequent packet IDs**. `minecraft-data`'s tables were stale (≈50 serverbound entries
vs the real 69; ≈135 vs 141 clientbound). So a bot logs in, then sends e.g. `custom_payload` at an ID
the 26.x server now reads as `chat_session_update`, and the server kicks it with
`Failed to decode packet`. **26.2 is a further protocol bump** that needs the same treatment again.

## Upstream status (as of 2026-06-28)

- [mineflayer #3888](https://github.com/PrismarineJS/mineflayer/issues/3888) — "wrong packet ID
  mappings for protocol 775" (opened 2026-04-11): **closed**, work landed toward 26.1.2 mappings.
- [mineflayer #3893](https://github.com/PrismarineJS/mineflayer/issues/3893) — "Add support for
  Minecraft Java Edition 26.1.2": tracking issue; a `pc26_1_2` branch existed.
- PrismarineJS typically adds new versions within weeks of release via community PRs, but **26.2
  specifically still needs its own protocol entry**.

## Options

### Path A — Native mineflayer 26.2 support (proper fix, biggest effort)
1. Add a **26.2 entry to `minecraft-data`**: protocol version number + **corrected packet-ID
   mappings** for handshake/login/config/play states. Mappings are extracted from the **server jar's
   deobfuscated code** (IDs are assigned sequentially by `addPacket()` registration order). This is
   the bulk of the work and is error-prone.
2. Handle any **26.x data/format changes** the prismarine-* libs depend on (registries, network NBT,
   chunk format, new data types).
3. Whitelist the version in mcp/mineflayer; test login → chat → keep-alive.

→ **Contribute upstream or wait.** Must be redone per protocol bump.

### Path B — ViaVersion + ViaBackwards proxy (lowest effort, recommended for our use)
Install **ViaVersion + ViaBackwards** on the 26.x dev server. ViaBackwards "allows older clients
(from 1.9) to connect to newer servers," and **26.2 is listed as supported**. Our existing mineflayer
bots (speaking 1.21.x, fully supported) then connect to the 26.x server **unchanged** — Via
translates the protocol server-side. **Zero mineflayer/protocol work.**

- Plugins: [ViaVersion](https://modrinth.com/plugin/viaversion) +
  [ViaBackwards](https://modrinth.com/plugin/viabackwards) (ViaBackwards depends on ViaVersion).
- **Verify before relying on it:**
  - ViaBackwards' current build bridges a **~1.21.x client → 26.2 server** in one hop.
  - Runs cleanly on a **Java 25 / Paper 26.2** server.
  - Our narrow needs survive translation: login + `/mg` **chat commands** + keep-alive + basic
    movement (anti-AFK).
- Wiring idea: drop both jars into the dev server's `plugins/` (e.g. via the run-paper `pluginJars`
  list alongside MiniGameCore) and keep the bots on the default `swarm.js` version.

### Path C — Minimal custom protocol client (narrow, medium effort)
Our bots only need: handshake, login/encryption, login-acknowledged, keep-alive, and **chat-command**
packets. A bespoke tiny client implementing just those for the 26.x protocol would work — but it
**still needs the correct 26.x packet IDs** (same extraction problem, smaller scope) and is more
maintenance than Via. Only worth it if no server-side plugin is acceptable.

## Recommendation

Use **Path B (ViaVersion + ViaBackwards)** to get the playtest bots working against 26.x quickly — no
changes to mineflayer or our harness, just two server plugins. Pursue **Path A** only if native
mineflayer 26.x is specifically required (e.g., to contribute upstream); there it's mostly a
wait-or-contribute on `minecraft-data`.

## Related project context

- The dev server two-track plan lives in the build: default `1.21.9` (bots work) vs `-Pmc=26.2`
  (Java 25). See `build.gradle` and the bot harness (`swarm.js`, `observe.js`, `../playtest.js`).
- On 26.x today, the bots can't `/op` the human (they can't connect), so the server build supports
  `-PdevOp=<name>` to op a human player directly.

## Sources

- mineflayer: <https://github.com/PrismarineJS/mineflayer> (issues
  [#3888](https://github.com/PrismarineJS/mineflayer/issues/3888),
  [#3893](https://github.com/PrismarineJS/mineflayer/issues/3893))
- node-minecraft-protocol: <https://github.com/PrismarineJS/node-minecraft-protocol>
- minecraft-data: <https://github.com/PrismarineJS/minecraft-data>
- ViaBackwards: <https://github.com/ViaVersion/ViaBackwards> ·
  <https://modrinth.com/plugin/viabackwards>
- ViaVersion: <https://modrinth.com/plugin/viaversion>
