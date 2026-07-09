package wueffi.BedWars.generic;

import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.plugin.Plugin;

import java.io.*;
import java.util.List;
import java.util.logging.Level;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

public class CopyWorldAndConfig {

    /**
     * Registers BedWars in MiniGameCore's {@code available-games} config. Call this from
     * {@code onLoad()} so it runs before MiniGameCore's {@code onEnable} reads & caches that list.
     */
    public static void registerGame(Plugin plugin) {
        try {
            // Ensure MiniGameCore's own default config exists first (its plugin instance is loaded
            // before ours via `depend`), so we merge into a complete config rather than creating a
            // partial one that would omit MiniGameCore's other defaults.
            Plugin miniGameCore = plugin.getServer().getPluginManager().getPlugin("MiniGameCore");
            if (miniGameCore != null) {
                miniGameCore.saveDefaultConfig();
            }
            updateMiniGameCoreConfig(plugin);
        } catch (Exception e) {
            plugin.getLogger().log(Level.SEVERE, "Error registering BedWars with MiniGameCore", e);
        }
    }

    public static void setup(Plugin plugin) {
        try {
            copyWorldFromResources(plugin);
            plugin.getLogger().info("BedWars world setup!");
        } catch (Exception e) {
            plugin.getLogger().log(Level.SEVERE, "Error setting up BedWars world", e);
        }
    }

    private static void copyWorldFromResources(Plugin plugin) throws IOException {
        File serverRoot = plugin.getServer().getWorldContainer().getAbsoluteFile().getParentFile();
        File miniGamesDir = new File(serverRoot, "plugins/MiniGameCore/MiniGames");
        File targetWorldDir = new File(miniGamesDir, "BedWars_world");

        if (!miniGamesDir.exists()) {
            miniGamesDir.mkdirs();
        }

        if (targetWorldDir.exists()) {
            plugin.getLogger().info("BedWars_world already exists, skipping copy.");
            return;
        }

        targetWorldDir.mkdirs();

        InputStream zipStream = plugin.getResource("BedWars_world.zip");
        if (zipStream == null) {
            throw new IOException("BedWars_world.zip not found in plugin resources");
        }

        unzip(zipStream, targetWorldDir);
        zipStream.close();

        plugin.getLogger().info("Copied BedWars_world to " + targetWorldDir.getAbsolutePath());
    }

    private static void unzip(InputStream zipStream, File destDir) throws IOException {
        byte[] buffer = new byte[1024];
        ZipInputStream zis = new ZipInputStream(zipStream);
        ZipEntry zipEntry = zis.getNextEntry();

        while (zipEntry != null) {
            File newFile = newFile(destDir, zipEntry);

            if (zipEntry.isDirectory()) {
                if (!newFile.isDirectory() && !newFile.mkdirs()) {
                    throw new IOException("Failed to create directory " + newFile);
                }
            } else {
                File parent = newFile.getParentFile();
                if (!parent.isDirectory() && !parent.mkdirs()) {
                    throw new IOException("Failed to create directory " + parent);
                }

                FileOutputStream fos = new FileOutputStream(newFile);
                int len;
                while ((len = zis.read(buffer)) > 0) {
                    fos.write(buffer, 0, len);
                }
                fos.close();
            }

            zipEntry = zis.getNextEntry();
        }

        zis.closeEntry();
        zis.close();
    }

    private static File newFile(File destinationDir, ZipEntry zipEntry) throws IOException {
        File destFile = new File(destinationDir, zipEntry.getName());

        String destDirPath = destinationDir.getCanonicalPath();
        String destFilePath = destFile.getCanonicalPath();

        if (!destFilePath.startsWith(destDirPath + File.separator)) {
            throw new IOException("Entry is outside of the target directory: " + zipEntry.getName());
        }

        return destFile;
    }

    private static void updateMiniGameCoreConfig(Plugin plugin) throws IOException {
        File serverRoot = plugin.getServer().getWorldContainer().getAbsoluteFile().getParentFile();
        File configFile = new File(serverRoot, "plugins/MiniGameCore/config.yml");

        if (!configFile.getParentFile().exists()) {
            configFile.getParentFile().mkdirs();
        }

        FileConfiguration config;
        if (configFile.exists()) {
            config = YamlConfiguration.loadConfiguration(configFile);
        } else {
            config = new YamlConfiguration();
        }

        List<String> availableGames = config.getStringList("available-games");

        if (!availableGames.contains("BedWars")) {
            availableGames.add("BedWars");
            config.set("available-games", availableGames);
            config.save(configFile);
            plugin.getLogger().info("Added BedWars to MiniGameCore config.yml");
        } else {
            plugin.getLogger().info("BedWars already exists in MiniGameCore config.yml");
        }
    }
}