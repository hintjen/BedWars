package wueffi.BedWars.generic;

import org.bukkit.entity.Player;
import org.bukkit.plugin.Plugin;
import org.bukkit.scheduler.BukkitRunnable;
import wueffi.BedWars.utils.BedChecker;
import wueffi.MiniGameCore.api.MiniGameCoreAPI;
import wueffi.MiniGameCore.utils.Lobby;
import wueffi.MiniGameCore.utils.Team;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public class checkWins {
    private final Plugin plugin;
    private BukkitRunnable checkTask;
    private final Lobby lobby;
    private final BedChecker bedChecker;
    private final EliminationTracker eliminationTracker;

    public checkWins(Plugin plugin, Lobby lobby, BedChecker bedChecker, EliminationTracker eliminationTracker) {
        this.plugin = plugin;
        this.lobby = lobby;
        this.bedChecker = bedChecker;
        this.eliminationTracker = eliminationTracker;
    }

    public void startChecking() {
        checkTask = new BukkitRunnable() {
            @Override
            public void run() {
                playerUnderYZero(lobby);

                List<WinEvaluator.TeamView<Team>> views = new ArrayList<>();
                for (Team team : lobby.getTeamList()) {
                    boolean bedIntact = bedChecker.getBedStatus().getOrDefault(team.getColor(), false);
                    List<UUID> memberIds = new ArrayList<>();
                    for (Player member : team.getPlayers()) {
                        memberIds.add(member.getUniqueId());
                    }
                    views.add(new WinEvaluator.TeamView<Team>() {
                        @Override
                        public Team team() {
                            return team;
                        }

                        @Override
                        public Collection<UUID> memberIds() {
                            return memberIds;
                        }

                        @Override
                        public boolean bedIntact() {
                            return bedIntact;
                        }
                    });
                }

                Team winner = WinEvaluator.findWinner(views, eliminationTracker.eliminated());
                if (winner != null) {
                    MiniGameCoreAPI.winTeam(lobby, winner);
                    stopChecking();
                }
            }
        };
        checkTask.runTaskTimer(plugin, 0L, 1L);
    }

    public void stopChecking() {
        if (checkTask != null) {
            checkTask.cancel();
        }
    }

    public void playerUnderYZero(Lobby lobby) {
        for (Player player : lobby.getPlayers()) {
            if (player.getWorld().getName().equals(lobby.getWorldFolder().getName())) {
                if (player.getLocation().y() <=0) {
                    player.setHealth(0);
                }
            }
        }
    }
}