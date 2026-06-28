package wueffi.BedWars.generic;

import java.util.Collection;
import java.util.Set;
import java.util.UUID;

/**
 * Pure, Bukkit-free win evaluation logic for BedWars.
 *
 * <p>The previous implementation relied on MiniGameCore's {@code Team.getAlivePlayers()} counter.
 * That counter is decremented on <em>every</em> player death (even deaths the player respawns from
 * while their bed is intact) and is never restored, so a player who had respawned at least once was
 * silently counted as dead. Once their bed was destroyed their team was treated as eliminated even
 * though the player was still alive, which could declare the wrong winner.
 *
 * <p>This class instead derives team aliveness from BedWars' own knowledge: a player is only
 * "eliminated" when they die with a broken bed (see {@link EliminationTracker}).
 */
public final class WinEvaluator {

    private WinEvaluator() {
    }

    /**
     * A read-only view of a team needed to decide whether it is still alive.
     *
     * @param <T> the underlying team type (e.g. MiniGameCore's {@code Team})
     */
    public interface TeamView<T> {
        /** The underlying team, returned as the winner when this team is the last one standing. */
        T team();

        /** UUIDs of every player that belongs to this team. */
        Collection<UUID> memberIds();

        /** Whether this team's bed is still intact. */
        boolean bedIntact();
    }

    /**
     * A team is alive if its bed is intact, or it has at least one member that has not been
     * eliminated.
     */
    public static <T> boolean isTeamAlive(TeamView<T> team, Set<UUID> eliminated) {
        if (team.bedIntact()) {
            return true;
        }
        for (UUID id : team.memberIds()) {
            if (!eliminated.contains(id)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Returns the sole surviving team, or {@code null} if the game should continue (zero or more
     * than one team still alive).
     */
    public static <T> T findWinner(Collection<? extends TeamView<T>> teams, Set<UUID> eliminated) {
        int aliveTeams = 0;
        T lastAlive = null;
        for (TeamView<T> team : teams) {
            if (isTeamAlive(team, eliminated)) {
                aliveTeams++;
                lastAlive = team.team();
            }
        }
        return aliveTeams == 1 ? lastAlive : null;
    }
}
