package wueffi.BedWars.generic;

import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests for {@link WinEvaluator}, including a regression test for the bug where a player who had
 * respawned (and therefore had MiniGameCore's alive-counter zeroed) was wrongly treated as dead once
 * their bed was destroyed, causing a premature/incorrect win.
 */
class WinEvaluatorTest {

    /** Minimal {@link WinEvaluator.TeamView} for tests, keyed by a String team name. */
    private static final class TestTeam implements WinEvaluator.TeamView<String> {
        private final String name;
        private final List<UUID> members;
        private final boolean bedIntact;

        TestTeam(String name, boolean bedIntact, UUID... members) {
            this.name = name;
            this.bedIntact = bedIntact;
            this.members = Arrays.asList(members);
        }

        @Override
        public String team() {
            return name;
        }

        @Override
        public Collection<UUID> memberIds() {
            return members;
        }

        @Override
        public boolean bedIntact() {
            return bedIntact;
        }
    }

    @Test
    void respawnedPlayerWithBrokenBedStillCountsAsAlive() {
        // Reproduces the reported scenario (4 solo teams):
        //   - Red:    bed intact, player alive            -> alive (eventual winner candidate)
        //   - Blue:   bed broken, player STILL ALIVE      -> must count as alive
        //   - Yellow: bed broken, player eliminated       -> dead
        //   - Green:  bed broken, player eliminated       -> dead
        // Blue's player had respawned earlier, so MiniGameCore's getAlivePlayers() would report 0
        // for Blue. The old logic therefore saw only Red alive and declared Red the winner while
        // Blue was still playing. The fix keys off real eliminations instead.
        UUID red = UUID.randomUUID();
        UUID blue = UUID.randomUUID();
        UUID yellow = UUID.randomUUID();
        UUID green = UUID.randomUUID();

        List<TestTeam> teams = Arrays.asList(
                new TestTeam("Red", true, red),
                new TestTeam("Blue", false, blue),
                new TestTeam("Yellow", false, yellow),
                new TestTeam("Green", false, green)
        );

        EliminationTracker tracker = new EliminationTracker();
        tracker.eliminate(yellow);
        tracker.eliminate(green);
        // Blue is NOT eliminated: their player is still alive despite the broken bed.

        // Two teams are still alive (Red via bed, Blue via its living player) -> no winner yet.
        assertNull(WinEvaluator.findWinner(teams, tracker.eliminated()),
                "Game must continue while Blue's player is still alive");

        // Sanity: Blue is alive purely because of its non-eliminated member.
        assertTrue(WinEvaluator.isTeamAlive(teams.get(1), tracker.eliminated()));
    }

    @Test
    void declaresWinnerWhenOnlyOneTeamRemains() {
        UUID red = UUID.randomUUID();
        UUID blue = UUID.randomUUID();

        List<TestTeam> teams = Arrays.asList(
                new TestTeam("Red", false, red),   // alive: player not eliminated
                new TestTeam("Blue", false, blue)  // dead: bed broken + player eliminated
        );

        EliminationTracker tracker = new EliminationTracker();
        tracker.eliminate(blue);

        assertEquals("Red", WinEvaluator.findWinner(teams, tracker.eliminated()));
    }

    @Test
    void teamWithIntactBedStaysAliveEvenIfAllMembersEliminated() {
        UUID a = UUID.randomUUID();
        TestTeam team = new TestTeam("Red", true, a);

        EliminationTracker tracker = new EliminationTracker();
        tracker.eliminate(a);

        assertTrue(WinEvaluator.isTeamAlive(team, tracker.eliminated()),
                "An intact bed keeps a team in the game");
    }

    @Test
    void teamIsDeadWhenBedBrokenAndAllMembersEliminated() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        TestTeam team = new TestTeam("Red", false, a, b);

        EliminationTracker tracker = new EliminationTracker();
        tracker.eliminate(a);
        tracker.eliminate(b);

        assertFalse(WinEvaluator.isTeamAlive(team, tracker.eliminated()));
    }

    @Test
    void noWinnerWhenZeroTeamsAlive() {
        UUID red = UUID.randomUUID();
        UUID blue = UUID.randomUUID();

        List<TestTeam> teams = Arrays.asList(
                new TestTeam("Red", false, red),
                new TestTeam("Blue", false, blue)
        );

        EliminationTracker tracker = new EliminationTracker();
        tracker.eliminate(red);
        tracker.eliminate(blue);

        // Mirrors the original guard: a win requires exactly one surviving team, never zero.
        assertNull(WinEvaluator.findWinner(teams, tracker.eliminated()));
    }
}
