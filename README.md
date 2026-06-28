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

## 🛠️ Building from source

Requires **JDK 21**. The MiniGameCore dependency is vendored in `libs/`, so no extra downloads are
needed to build.

```bash
./gradlew build          # macOS/Linux  -> build/libs/BedWars-1.0.jar
.\gradlew.bat build      # Windows
```

- **Windows users:** see **[BUILDING-Windows.md](BUILDING-Windows.md)** for step-by-step setup.
- **Local playtesting (any OS):** `node tools/playtest.js --human <YourMinecraftName>` builds, starts
  a dev server, and fills the teams with bots so you can start a match solo. Then connect a
  Minecraft **Java 1.21.9** client to `localhost:25565` and type `/mg join BedWars-1`.
