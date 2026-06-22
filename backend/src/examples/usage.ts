/**
 * Runnable demo: `npm run engine:demo`
 *
 * Generates a full 4-week glute-hypertrophy mesocycle and prints it, then shows
 * the validation report and the anti-repeat signatures.
 */
import { LBMethodEngine } from "../engine/services/LBMethodEngine";
import { EXERCISE_LIBRARY } from "../data/exerciseLibrary";
import type { UserProfile } from "../types";

function printProgram() {
  const engine = new LBMethodEngine();

  const client: UserProfile = {
    name: "Demo Client",
    goal: "glute_hypertrophy",
    experienceLevel: "intermediate",
    daysPerWeek: 5,
  };

  const program = engine.generateProgram(client, EXERCISE_LIBRARY, 4, { seed: 12345 });

  console.log("=".repeat(70));
  console.log(`LB METHOD PROGRAM — ${client.goal} / ${client.experienceLevel} / ${client.daysPerWeek} days`);
  console.log("=".repeat(70));

  for (const week of program.weeks) {
    console.log(
      `\n## WEEK ${week.weekNumber}  RIR ${week.rir}${week.deload ? "  (DELOAD -20%)" : ""}  ` +
        `| glute sets ${week.volume.weeklyGluteSets} | lower ${(week.volume.lowerVolumePct * 100).toFixed(0)}% / upper ${(week.volume.upperVolumePct * 100).toFixed(0)}% ` +
        `| glute freq ${week.volume.gluteFrequency}x`,
    );

    for (const day of week.days) {
      console.log(`\n  Day ${day.dayIndex + 1} — ${day.focus}  (fatigue ${day.sessionFatigue}/12, ${day.totalSets} sets)`);
      for (const s of day.selections) {
        console.log(
          `    [${s.role.padEnd(10)}] ${s.exercise.name.padEnd(28)} ${s.sets}x${s.repsMin}-${s.repsMax}  @RIR ${s.rir}`,
        );
      }
    }

    const report = engine.validate(week);
    console.log(`\n  validation: ${report.valid ? "VALID ✅" : "INVALID ❌"}` + (report.issues.length ? ` (${report.issues.length} notes)` : ""));
    report.issues.forEach((i) => console.log(`    - [${i.severity}] ${i.code}: ${i.message}`));
  }

  // Prove combinations differ week-to-week.
  console.log("\nWeekly signatures (all unique → no repeated weekly combination):");
  console.log("  " + program.weeks.map((w) => w.signature).join("  "));
}

if (require.main === module) {
  printProgram();
}

export { printProgram };
