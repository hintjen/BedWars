# Building BedWars on Windows

This guide covers building the BedWars plugin from source on Windows, plus (optionally) running
a local test server with filler bots. macOS/Linux users: the same Gradle commands apply, just use
`./gradlew` instead of `.\gradlew.bat`.

> All commands below are written for **PowerShell** (the default terminal in Windows 10/11). In the
> classic Command Prompt (`cmd.exe`), drop the leading `.\` — e.g. type `gradlew.bat build`.

---

## 1. Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| **JDK** | **21** | Needed to launch Gradle and build the default (1.21.x) target. [Eclipse Temurin 21](https://adoptium.net/temurin/releases/?version=21) recommended; enable "Set JAVA_HOME" and "Add to PATH". For the **26.x** target, Gradle **auto-downloads Java 25** — no manual install (see §6). |
| **Git** | any | [git-scm.com](https://git-scm.com/download/win) (or download the repo as a ZIP). |
| **Node.js** | 18+ | *Only* needed for the optional test bots. [nodejs.org](https://nodejs.org). |
| **Minecraft: Java Edition** | **1.21.9** | *Only* needed if you want to play/test locally. Must match the server version (see note below). |

Verify your JDK after installing — open a **new** PowerShell window and run:

```powershell
java -version
```

You should see version `21.x`. If it shows an older version (e.g. 17), install JDK 21 and make sure
its `bin` folder is first on your `PATH`, or set `JAVA_HOME` to the JDK 21 folder.

> **Internet access is required for the first build** — Gradle downloads the Gradle distribution and
> the Paper API, and (for the test server) Paper itself.

---

## 2. Get the code

```powershell
git clone -b bedwars-winfix-and-playtest-workflow https://github.com/hintjen/BedWars.git
cd BedWars
```

> The build tooling and this guide currently live on the **`bedwars-winfix-and-playtest-workflow`**
> branch (the `-b` flag checks it out). Once that branch is merged into `main`, a plain
> `git clone https://github.com/hintjen/BedWars.git` will work too.

(If you downloaded a ZIP instead, make sure you grabbed the correct branch, then `cd` into the folder.)

The required MiniGameCore dependency is **already vendored** in `libs\MiniGameCore-2.0.1.jar`, so you
do not need to download anything else to build.

---

## 3. Build the plugin

```powershell
.\gradlew.bat build
```

This compiles the plugin, runs the unit tests, and produces the jar at:

```
build\libs\BedWars-1.0.jar
```

Useful variants:

```powershell
.\gradlew.bat test          # run only the unit tests
.\gradlew.bat clean build   # rebuild from scratch
```

---

## 4. Install on your own server

1. Build the jar (step 3), or download a release.
2. Copy **both** jars into your server's `plugins\` folder:
   - `build\libs\BedWars-1.0.jar`
   - `libs\MiniGameCore-2.0.1.jar` (or the latest MiniGameCore from Modrinth)
3. Your server must be **Paper/Spigot 1.21.6 or newer** (MiniGameCore 2.0.1 uses a game rule that
   only exists from 1.21.6 — older versions crash on `/mg host`).
4. Start the server once. BedWars sets itself up automatically (copies its map and registers with
   MiniGameCore).

---

## 5. (Optional) Run a local test server with bots

The repo can spin up a throwaway Paper server with both plugins, plus a swarm of bots that fill the
teams so you can start a real match by yourself.

### 5a. One command (recommended)

A cross-platform Node orchestrator (`tools\playtest.js`) does everything: builds + starts the server,
waits until it's ready, installs the bot dependencies if needed, starts the bots, prints connect
instructions, and shuts everything down cleanly on Ctrl+C.

```powershell
node tools\playtest.js --human <YourMinecraftName>
```

Replace `<YourMinecraftName>` with your in-game name so the host bot waits for you (and grants you
permission to join). Leave this window open while you play. Useful flags:

```powershell
node tools\playtest.js --human Steve --count 3   # 3 filler bots (default)
node tools\playtest.js --no-bots                 # just the server; bring your own players
```

When you see `SERVER READY — connect now`, jump to **5c**.

> The first run downloads Paper **1.21.9** (this can take a minute). The server is configured
> automatically: MiniGameCore added, EULA accepted, offline mode on (so bots can join), and the bot
> accounts pre-opped.

### 5b. Manual alternative (two terminals)

If you prefer to run the pieces yourself:

```powershell
# Terminal 1 — the server (wait for "Done (...)! For help, type \"help\"")
.\gradlew.bat runServer

# Terminal 2 — the bots
cd tools\bots
npm install                                    # first time only
node swarm.js --count 3 --human <YourMinecraftName>
```

### 5c. Connect and play

1. Launch **Minecraft Java Edition 1.21.9** (pick this version in the launcher if needed).
2. **Multiplayer → Direct Connect →** `localhost:25565` → **Join Server**.
3. In chat, type: `/mg join BedWars-1`

After a short countdown the match starts — you'll be on a team with the bots on the others.

### 5d. Stop everything

- One-command mode: press **Ctrl+C** in the `playtest.js` window — it stops the bots and shuts the
  server down cleanly (saving the world).
- Manual mode: **Ctrl+C** in each terminal (or close the windows).

The throwaway server files live in the `run\` folder (git-ignored); delete it to start completely
fresh.

---

## 6. Targeting Minecraft 26.x (e.g. 26.2)

Everything above uses the default **1.21.9 / Java 21** profile. To target the latest Minecraft, add
`-Pmc=26.2` to any Gradle command. Gradle then **auto-downloads Java 25** (Minecraft 26.x requires it)
— you do **not** need to install JDK 25 yourself.

```powershell
.\gradlew.bat build -Pmc=26.2                       # build against the 26.2 API on Java 25
.\gradlew.bat runServer -Pmc=26.2 -PdevOp=<YourName> # boot a Paper 26.2 dev server, op yourself
```

Then connect with a **Minecraft Java Edition 26.2** client to `localhost:25565` and `/mg host BedWars`.

Notes / limitations:
- **The bots can't fill teams on 26.x yet** — mineflayer doesn't speak the 26.x protocol, so
  `playtest.js` / `swarm.js` are **1.21.x only**. On 26.x you test manually (bring real players, or see
  the ViaVersion option in [tools\bots\MINEFLAYER-26X.md](tools/bots/MINEFLAYER-26X.md)). `-PdevOp`
  exists because the bots normally `/op` you and can't here.
- A 26.x jar (Java 25) **won't run on a 1.21.x/Java 21 server**, and vice-versa — build for your target.
- `paper-api` for 26.2 is alpha; 26.2 is bleeding edge. Current verification status (26.2 **builds,
  loads and enables**; live gameplay not yet confirmed) is tracked in [STATUS.md](STATUS.md).
- Switching `-Pmc` versions may trigger a one-time Paper world migration in `run\`; delete `run\` to
  start fresh.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `'gradlew.bat' is not recognized` | Make sure you're in the project root (the folder containing `gradlew.bat`) and prefix with `.\` in PowerShell. |
| Build fails mentioning Java 17/version | Install JDK 21 and set `JAVA_HOME` to it (open a new terminal afterward). |
| `NoSuchFieldError ... LOCATOR_BAR` on `/mg host` | Your server/client is older than 1.21.6. The test server is pinned to 1.21.9; for your own server, use 1.21.6+. |
| Bots say "You don't have permission" | `runServer` pre-ops the bots automatically. If you point the bots at your *own* server instead, op them (`/op BW_Host`, `/op BW_Bot1` …) or give them `mgcore.admin`. |
| Can't connect / "Failed to connect" | Confirm the server window shows `Done (...)`, your client is exactly **1.21.9**, and you used `localhost:25565`. Allow Java through the Windows Firewall (Private networks) if prompted. |
| Bots fail to connect after a Minecraft update | Update mineflayer: in `tools\bots` run `npm install mineflayer@latest`, or pass `--version false` to auto-detect. |
| First `-Pmc=26.2` build is slow or seems stuck | Normal on first run — Gradle is downloading JDK 25 and the Paper 26.2 server. Give it a minute; needs internet. |
| Bots won't join a **26.x** server | Expected — mineflayer has no 26.x protocol support. Use the 1.21.x profile for bots, or test 26.x manually. See [tools\bots\MINEFLAYER-26X.md](tools/bots/MINEFLAYER-26X.md). |
