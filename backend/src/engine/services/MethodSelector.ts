/**
 * MethodSelector — strategic selection of training intensity techniques.
 *
 * Rules (from evidence-based research):
 *  - Week 1 / deload: always straight sets (baseline establishment / recovery).
 *  - Beginners: straight only; tempo added conservatively in week 3.
 *  - Intermediate/Advanced: intensity techniques introduced from week 2,
 *    peaking in week 3 (intensification), then back to straight on deload.
 *  - Each role has its own candidate pool reflecting biomechanical fit:
 *      main compound → pause_reps, rest_pause, cluster, pyramids
 *      unilateral    → tempo, rest_pause, pause_reps
 *      isolation     → drop_set, myo_reps, tempo, mechanical_drop
 *      accessory     → drop_set, myo_reps, giant_set
 *  - Goal modulates which techniques get extra weight:
 *      hypertrophy  → drop_set, myo_reps, tempo, rest_pause
 *      strength     → cluster_set, pyramid_descending, pyramid_ascending
 *      fat_loss     → giant_set, myo_reps (time-efficient)
 *      recomp       → balanced mix
 *  - The seeded RNG guarantees reproducibility: same inputs = same method.
 *    Different seeds (different weeks) yield variety without being random.
 */
import type { ExperienceLevel, Goal, SelectionRole, TrainingMethod, TrainingMethodConfig } from "../../types";
import {
  METHOD_CONFIGS,
  METHOD_TECHNIQUE_PROBABILITY,
  ROLE_METHOD_CANDIDATES,
} from "../rules/businessRules";
import type { Rng } from "../rules/rng";

/** Goal → extra weight for specific techniques (multiplicative bonus). */
const GOAL_METHOD_BOOST: Partial<Record<Goal, Partial<Record<TrainingMethod, number>>>> = {
  glute_hypertrophy: { drop_set: 1.8, myo_reps: 1.6, tempo: 1.4, rest_pause: 1.4, pause_reps: 1.5 },
  glute_growth:      { drop_set: 1.8, myo_reps: 1.6, tempo: 1.3, rest_pause: 1.3 },
  lower_body_focus:  { tempo: 1.5, pause_reps: 1.5, cluster_set: 1.4 },
  fat_loss:          { giant_set: 2.0, myo_reps: 1.6, drop_set: 1.3 },
  body_recomposition:{ drop_set: 1.3, myo_reps: 1.3, tempo: 1.3, pyramid_ascending: 1.3 },
  muscle_gain:       { cluster_set: 1.6, pyramid_descending: 1.5, pyramid_ascending: 1.4, rest_pause: 1.3 },
};

export class MethodSelector {
  /**
   * Selects the training method for a single exercise selection.
   *
   * @param role          Role of the exercise in the session (main/unilateral/isolation/accessory)
   * @param level         Client's experience level
   * @param goal          Client's training goal
   * @param weekNumber    Current week in the mesocycle (1-4)
   * @param deload        Whether this is a deload week
   * @param rng           Seeded RNG for reproducibility
   */
  select(
    role: SelectionRole,
    level: ExperienceLevel,
    goal: Goal,
    weekNumber: number,
    deload: boolean,
    rng: Rng,
  ): { method: TrainingMethod; config: TrainingMethodConfig } {
    const straight = { method: "straight" as TrainingMethod, config: METHOD_CONFIGS.straight };

    // Week 1 and deload always use straight sets.
    if (weekNumber <= 1 || deload) return straight;

    // Probability of applying an intensity technique this exercise.
    const probTable = METHOD_TECHNIQUE_PROBABILITY[level];
    const prob = probTable[weekNumber] ?? 0;
    if (!rng.prob(prob)) return straight;

    // Build candidate pool from role + week.
    const pool = weekNumber >= 3
      ? [...ROLE_METHOD_CANDIDATES[role].week2, ...ROLE_METHOD_CANDIDATES[role].week3]
      : [...ROLE_METHOD_CANDIDATES[role].week2];

    if (pool.length === 0) return straight;

    // Weight each candidate: base weight 1.0, boosted by goal affinity.
    const goalBoosts = GOAL_METHOD_BOOST[goal] ?? {};
    const weighted = pool.map((method) => ({
      item: method,
      weight: 1.0 * (goalBoosts[method] ?? 1.0),
    }));

    const chosen = rng.weightedPick(weighted);
    return { method: chosen, config: METHOD_CONFIGS[chosen] };
  }
}
