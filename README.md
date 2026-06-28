![Static Badge](https://img.shields.io/badge/Version-1.0_SNAPSHOT-blue)
# BedWars

**BedWars** is a plugin for you to play BedWars using MiniGameCore and it's API!

---

## 🔧 Installation

1. Download the latest BedWars `.jar` from [Modrinth](https://modrinth.com/plugin/mgcbedwars) or Releases.
2. Download the latest MiniGameCore `.jar` from [Modrinth](https://modrinth.com/plugin/minigamecore).
2. Place both files in the `plugins/` folder of your Minecraft server.
3. For permission-management, you can optionally use a plugin like [LuckPerms](https://luckperms.net/).
4. Restart the server once.

---

## ✅ Prerequisites

| Tool | Version | Needed for |
|------|---------|-----------|
| **Java (JDK)** | **21** | building the plugin, and running a Minecraft server |
| **Git** | any | cloning the repo (or just download the ZIP) |
| **Node.js** | **18+** | local playtesting only (the bots + `playtest.js` orchestrator) |
| **Minecraft: Java Edition** | **1.21.9** | connecting to the local dev server to play |
| **Paper/Spigot server** | **1.21.6+** | deploying the plugin (MiniGameCore 2.0.1 needs ≥ 1.21.6) |

Notes:
- **Gradle is not required** — the included wrapper (`gradlew` / `gradlew.bat`) downloads the right
  version automatically.
- **The JDK is auto-provisioned per build profile** — you need *a* JDK installed to launch Gradle, but
  Gradle's toolchain (via the foojay resolver) downloads the exact JDK each profile needs: **Java 21**
  for the default 1.21.x build, **Java 25** for the `-Pmc=26.x` build (Minecraft 26.x requires Java 25).
- **MiniGameCore is vendored** in `libs/`, so no extra downloads are needed to build.
- **Internet access** is needed on the first build/run (Gradle, the Paper API, Paper itself, and—for
  playtesting—the npm bot deps).

<details>
<summary>Quick install per OS</summary>

```bash
# macOS (Homebrew)
brew install --cask temurin@21
brew install git node

# Linux (Debian/Ubuntu) — git from apt; Java 21 via SDKMAN, Node via nvm
sudo apt update && sudo apt install -y git
curl -s "https://get.sdkman.io" | bash && source "$HOME/.sdkman/bin/sdkman-init.sh" && sdk install java 21-tem
# Node 18+: install nvm, then:  nvm install --lts

# Windows (winget) — details in BUILDING-Windows.md
winget install EclipseAdoptium.Temurin.21.JDK Git.Git OpenJS.NodeJS
```

Verify with `java -version` (should show 21.x) and, for playtesting, `node -version` (18+).
</details>

---

## 🛠️ Building from source

```bash
./gradlew build                 # default: Minecraft 1.21.9 / Java 21  -> build/libs/BedWars-1.0.jar
./gradlew build -Pmc=26.2       # modern target: Minecraft 26.2 / Java 25 (auto-downloaded)
.\gradlew.bat build             # Windows (same flags apply)
```

The `-Pmc` flag selects the build profile (default `1.21.9`). The 1.21.x profile keeps the
mineflayer bot dev-loop working; the 26.x profile builds against the latest Paper API on Java 25.
A 26.x jar (Java 25) won't run on a 1.21.x/Java 21 server — they're separate builds.

- **Windows users:** see **[BUILDING-Windows.md](BUILDING-Windows.md)** for step-by-step setup.
- **Local playtesting (any OS):** `node tools/playtest.js --human <YourMinecraftName>` builds, starts
  a dev server, and fills the teams with bots so you can start a match solo. Then connect a
  Minecraft **Java 1.21.9** client to `localhost:25565` and type `/mg join BedWars-1`.
