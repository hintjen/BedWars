package wueffi.BedWars;

import org.bukkit.Bukkit;
import org.bukkit.plugin.java.JavaPlugin;
import wueffi.BedWars.generic.CopyWorldAndConfig;
import wueffi.BedWars.utils.GameListener;
import wueffi.MiniGameCore.managers.LobbyManager;

public final class BedWarsMain extends JavaPlugin {
    public LobbyManager lobbyManager;

    @Override
    public void onLoad() {
        // Register BedWars in MiniGameCore's config during the LOAD phase, which runs before any
        // plugin's onEnable. MiniGameCore (load: STARTUP) reads and caches its "available-games" list
        // in its onEnable; if we registered in our own onEnable (which runs after it) a freshly-set-up
        // server would lose its first game to a stale, empty cache ("game is not available").
        CopyWorldAndConfig.registerGame(this);
    }

    @Override
    public void onEnable() {
        getLogger().info("Starting up BedWars Plugin...");

        Bukkit.getPluginManager().registerEvents(new GameListener(this), this);
        getLogger().info("Registered Events!");

        CopyWorldAndConfig.setup(this);
    }

    @Override
    public void onDisable() {
    }
}
