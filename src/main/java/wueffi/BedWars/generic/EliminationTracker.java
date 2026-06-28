package wueffi.BedWars.generic;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * Tracks players that have been permanently eliminated from a BedWars game.
 *
 * <p>A player is eliminated only when they die while their team's bed is already broken. This is the
 * authoritative source of "who is still in the game" for win detection, replacing MiniGameCore's
 * unreliable per-team alive counter which is not restored after a respawn.
 *
 * <p>One instance is created per lobby and shared between the death listener (which records
 * eliminations) and the win checker (which reads them). All access happens on the server main
 * thread, so no external synchronization is required.
 */
public class EliminationTracker {

    private final Set<UUID> eliminated = new HashSet<>();

    /** Marks the given player as permanently out of the game. */
    public void eliminate(UUID playerId) {
        eliminated.add(playerId);
    }

    /** Whether the given player has been eliminated. */
    public boolean isEliminated(UUID playerId) {
        return eliminated.contains(playerId);
    }

    /** The live set of eliminated player UUIDs (used directly by {@link WinEvaluator}). */
    public Set<UUID> eliminated() {
        return eliminated;
    }
}
