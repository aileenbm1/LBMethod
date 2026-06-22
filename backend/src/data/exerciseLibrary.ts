/**
 * Curated LB Method exercise library.
 *
 * IDs are stable slugs so generated routines and stored signatures stay
 * consistent across DB reseeds. activationScore/fatigueScore/stability are
 * coach-tuned for female glute development.
 */
import type { Exercise } from "../types";

export const EXERCISE_LIBRARY: Exercise[] = [
  // ---- Glutes: HIP THRUST pattern -----------------------------------------
  ex("barbell-hip-thrust", "Barbell Hip Thrust", "glutes", "hip_thrust", "compound", "barbell", "intermediate", 9.5, 4, 4, false, "glutes", ["hamstrings"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/barbell-hip-thrust.gif",
    "https://www.youtube.com/embed/SEdqd1n0cvg"),
  ex("smith-hip-thrust", "Smith Machine Hip Thrust", "glutes", "hip_thrust", "compound", "smith", "beginner", 9.2, 4, 3, false, "glutes", ["hamstrings"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/smith-hip-thrust.gif"),
  ex("machine-glute-bridge", "Glute Drive Machine", "glutes", "hip_thrust", "compound", "machine", "beginner", 9.0, 3, 2, false, "glutes", ["hamstrings"]),
  ex("db-glute-bridge", "Dumbbell Glute Bridge", "glutes", "hip_thrust", "compound", "dumbbell", "beginner", 8.4, 3, 2, false, "glutes", ["hamstrings"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/db-glute-bridge.gif"),
  ex("single-leg-hip-thrust", "Single-Leg Hip Thrust", "glutes", "unilateral", "unilateral", "bodyweight", "intermediate", 8.6, 3, 4, true, "glutes", ["hamstrings"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/single-leg-hip-thrust.gif"),

  // ---- Glutes: HIP HINGE pattern ------------------------------------------
  ex("romanian-deadlift", "Romanian Deadlift", "glutes", "hip_hinge", "compound", "barbell", "intermediate", 9.0, 4, 4, false, "glutes", ["hamstrings", "back"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/romanian-deadlift.gif",
    "https://www.youtube.com/embed/JCXUYuzwNrM"),
  ex("db-romanian-deadlift", "Dumbbell RDL", "glutes", "hip_hinge", "compound", "dumbbell", "beginner", 8.6, 4, 3, false, "glutes", ["hamstrings"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/db-rdl.gif"),
  ex("sumo-deadlift", "Sumo Deadlift", "glutes", "hip_hinge", "compound", "barbell", "advanced", 8.8, 5, 4, false, "glutes", ["hamstrings", "quadriceps"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/sumo-deadlift.gif"),
  ex("cable-pull-through", "Cable Pull-Through", "glutes", "hip_hinge", "accessory", "cable", "beginner", 8.0, 2, 2, false, "glutes", ["hamstrings"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/cable-pull-through.gif"),
  ex("kettlebell-swing", "Kettlebell Swing", "glutes", "hip_hinge", "accessory", "kettlebell", "intermediate", 7.5, 3, 3, false, "glutes", ["hamstrings"]),
  ex("good-morning", "Good Morning", "glutes", "hip_hinge", "compound", "barbell", "advanced", 8.2, 4, 4, false, "glutes", ["hamstrings"]),

  // ---- Glutes: KNEE DOMINANT pattern --------------------------------------
  ex("barbell-back-squat", "Barbell Back Squat", "quadriceps", "knee_dominant", "compound", "barbell", "intermediate", 8.5, 5, 4, false, "quadriceps", ["glutes"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/barbell-squat.gif",
    "https://www.youtube.com/embed/ultWZbUMPL8"),
  ex("hack-squat", "Hack Squat", "quadriceps", "knee_dominant", "compound", "machine", "intermediate", 8.6, 4, 2, false, "quadriceps", ["glutes"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/hack-squat.gif"),
  ex("leg-press", "Leg Press", "quadriceps", "knee_dominant", "compound", "machine", "beginner", 8.2, 4, 2, false, "quadriceps", ["glutes"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/leg-press.gif"),
  ex("glute-focus-leg-press", "High-Foot Leg Press", "glutes", "knee_dominant", "compound", "machine", "beginner", 8.4, 4, 2, false, "glutes", ["hamstrings"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/high-foot-leg-press.gif"),
  ex("goblet-squat", "Goblet Squat", "quadriceps", "knee_dominant", "compound", "dumbbell", "beginner", 7.8, 3, 3, false, "quadriceps", ["glutes"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/goblet-squat.gif"),
  ex("front-squat", "Front Squat", "quadriceps", "knee_dominant", "compound", "barbell", "advanced", 8.3, 5, 4, false, "quadriceps", ["glutes"]),

  // ---- Glutes: UNILATERAL pattern -----------------------------------------
  ex("bulgarian-split-squat", "Bulgarian Split Squat", "glutes", "unilateral", "unilateral", "dumbbell", "intermediate", 9.0, 4, 5, true, "glutes", ["quadriceps"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/bulgarian-split-squat.gif",
    "https://www.youtube.com/embed/2C-uNgKwPLE"),
  ex("walking-lunge", "Walking Lunge", "glutes", "unilateral", "unilateral", "dumbbell", "intermediate", 8.4, 4, 4, true, "glutes", ["quadriceps", "hamstrings"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/walking-lunge.gif"),
  ex("reverse-lunge", "Reverse Lunge", "glutes", "unilateral", "unilateral", "dumbbell", "beginner", 8.2, 3, 4, true, "glutes", ["quadriceps"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/reverse-lunge.gif"),
  ex("step-up", "Dumbbell Step-Up", "glutes", "unilateral", "unilateral", "dumbbell", "beginner", 8.0, 3, 4, true, "glutes", ["quadriceps"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/step-up.gif"),
  ex("curtsy-lunge", "Curtsy Lunge", "glutes", "unilateral", "unilateral", "dumbbell", "intermediate", 8.1, 3, 4, true, "glutes", ["quadriceps"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/curtsy-lunge.gif"),
  ex("b-stance-rdl", "B-Stance RDL", "glutes", "unilateral", "unilateral", "dumbbell", "intermediate", 8.5, 3, 3, true, "glutes", ["hamstrings"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/b-stance-rdl.gif"),

  // ---- Glutes: ABDUCTION / isolation pattern ------------------------------
  ex("hip-abduction-machine", "Hip Abduction Machine", "glutes", "abduction", "isolation", "machine", "beginner", 8.0, 1, 1, false, "glutes", [],
    "https://storage.googleapis.com/lbmethod-assets/exercises/hip-abduction-machine.gif"),
  ex("cable-glute-kickback", "Cable Glute Kickback", "glutes", "abduction", "isolation", "cable", "beginner", 7.8, 1, 2, true, "glutes", [],
    "https://storage.googleapis.com/lbmethod-assets/exercises/cable-glute-kickback.gif"),
  ex("banded-lateral-walk", "Banded Lateral Walk", "glutes", "abduction", "isolation", "band", "beginner", 7.0, 1, 2, false, "glutes", [],
    "https://storage.googleapis.com/lbmethod-assets/exercises/banded-lateral-walk.gif"),
  ex("seated-band-abduction", "Seated Band Abduction", "glutes", "abduction", "isolation", "band", "beginner", 6.8, 1, 1, false, "glutes", []),
  ex("frog-pump", "Frog Pump", "glutes", "abduction", "isolation", "bodyweight", "beginner", 7.2, 1, 1, false, "glutes", [],
    "https://storage.googleapis.com/lbmethod-assets/exercises/frog-pump.gif"),
  ex("standing-cable-abduction", "Standing Cable Abduction", "glutes", "abduction", "isolation", "cable", "beginner", 7.6, 1, 2, true, "glutes", [],
    "https://storage.googleapis.com/lbmethod-assets/exercises/standing-cable-abduction.gif"),
  ex("hyperextension-glute", "Glute-Focused Hyperextension", "glutes", "hip_hinge", "isolation", "bodyweight", "beginner", 8.0, 2, 2, false, "glutes", ["hamstrings"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/hyperextension.gif"),

  // ---- Glutes: BANDA / peso corporal (home extras) -------------------------
  ex("band-hip-thrust", "Band Hip Thrust", "glutes", "hip_thrust", "compound", "band", "beginner", 8.0, 2, 2, false, "glutes", ["hamstrings"]),
  ex("kb-deadlift", "Kettlebell Deadlift", "glutes", "hip_hinge", "compound", "kettlebell", "beginner", 8.2, 3, 3, false, "glutes", ["hamstrings", "back"]),
  ex("kb-rdl", "Kettlebell RDL", "glutes", "hip_hinge", "compound", "kettlebell", "beginner", 8.0, 3, 3, false, "glutes", ["hamstrings"]),
  ex("db-sumo-squat", "Dumbbell Sumo Squat", "glutes", "knee_dominant", "compound", "dumbbell", "beginner", 7.8, 3, 3, false, "glutes", ["quadriceps"]),
  ex("db-hip-thrust", "Dumbbell Hip Thrust", "glutes", "hip_thrust", "compound", "dumbbell", "beginner", 8.3, 3, 2, false, "glutes", ["hamstrings"]),

  // ---- Hamstrings ----------------------------------------------------------
  ex("lying-leg-curl", "Lying Leg Curl", "hamstrings", "knee_dominant", "isolation", "machine", "beginner", 8.2, 2, 1, false, "hamstrings", [],
    "https://storage.googleapis.com/lbmethod-assets/exercises/lying-leg-curl.gif"),
  ex("seated-leg-curl", "Seated Leg Curl", "hamstrings", "knee_dominant", "isolation", "machine", "beginner", 8.4, 2, 1, false, "hamstrings", [],
    "https://storage.googleapis.com/lbmethod-assets/exercises/seated-leg-curl.gif"),
  ex("nordic-curl", "Nordic Hamstring Curl", "hamstrings", "knee_dominant", "accessory", "bodyweight", "advanced", 8.8, 3, 4, false, "hamstrings", [],
    "https://storage.googleapis.com/lbmethod-assets/exercises/nordic-curl.gif"),

  // ---- Hamstrings: peso corporal -------------------------------------------
  ex("glute-bridge-hamstring", "Single-Leg Glute Bridge", "hamstrings", "hip_hinge", "isolation", "bodyweight", "beginner", 7.8, 2, 3, true, "hamstrings", ["glutes"]),

  // ---- Quadriceps ----------------------------------------------------------
  ex("leg-extension", "Leg Extension", "quadriceps", "knee_dominant", "isolation", "machine", "beginner", 8.0, 2, 1, false, "quadriceps", [],
    "https://storage.googleapis.com/lbmethod-assets/exercises/leg-extension.gif"),
  ex("sissy-squat", "Sissy Squat", "quadriceps", "knee_dominant", "accessory", "bodyweight", "advanced", 7.6, 2, 3, false, "quadriceps", []),

  // ---- Quadriceps: peso corporal / mancuernas (home) ----------------------
  ex("jump-squat", "Jump Squat", "quadriceps", "knee_dominant", "accessory", "bodyweight", "intermediate", 7.6, 3, 3, false, "quadriceps", ["glutes"]),
  ex("db-split-squat", "Dumbbell Split Squat", "quadriceps", "knee_dominant", "compound", "dumbbell", "beginner", 8.0, 3, 4, true, "quadriceps", ["glutes"]),

  // ---- Calves --------------------------------------------------------------
  ex("standing-calf-raise", "Standing Calf Raise", "calves", "knee_dominant", "isolation", "machine", "beginner", 7.5, 1, 1, false, "calves", [],
    "https://storage.googleapis.com/lbmethod-assets/exercises/calf-raise.gif"),

  // ---- Upper body: back (home) ---------------------------------------------
  ex("pull-up", "Pull-Up", "back", "vertical_pull", "compound", "bodyweight", "advanced", 8.8, 4, 4, false, "back", ["biceps"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/pull-up.gif"),
  ex("chin-up", "Chin-Up", "back", "vertical_pull", "compound", "bodyweight", "advanced", 8.5, 3, 4, false, "biceps", ["back"]),
  ex("band-row", "Resistance Band Row", "back", "horizontal_pull", "compound", "band", "beginner", 7.2, 2, 2, false, "back", ["biceps"]),
  ex("band-pull-apart", "Band Pull-Apart", "shoulders", "horizontal_pull", "isolation", "band", "beginner", 6.8, 1, 1, false, "shoulders", ["back"]),
  ex("inverted-row", "Inverted Row", "back", "horizontal_pull", "compound", "bodyweight", "intermediate", 8.0, 3, 3, false, "back", ["biceps"]),

  // ---- Upper body: back (gym) ----------------------------------------------
  ex("lat-pulldown", "Lat Pulldown", "back", "vertical_pull", "compound", "cable", "beginner", 8.2, 3, 2, false, "back", ["biceps"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/lat-pulldown.gif"),
  ex("seated-cable-row", "Seated Cable Row", "back", "horizontal_pull", "compound", "cable", "beginner", 8.2, 3, 2, false, "back", ["biceps"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/cable-row.gif"),
  ex("db-row", "Dumbbell Row", "back", "horizontal_pull", "compound", "dumbbell", "beginner", 8.0, 3, 3, true, "back", ["biceps"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/db-row.gif"),
  ex("assisted-pullup", "Assisted Pull-Up", "back", "vertical_pull", "compound", "machine", "intermediate", 8.4, 3, 3, false, "back", ["biceps"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/assisted-pullup.gif"),
  ex("straight-arm-pulldown", "Straight-Arm Pulldown", "back", "vertical_pull", "isolation", "cable", "beginner", 7.4, 2, 1, false, "back", []),

  // ---- Upper body: chest (home) --------------------------------------------
  ex("push-up", "Push-Up", "chest", "horizontal_push", "compound", "bodyweight", "beginner", 7.5, 3, 3, false, "chest", ["shoulders", "triceps"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/push-up.gif"),
  ex("incline-push-up", "Incline Push-Up", "chest", "horizontal_push", "compound", "bodyweight", "beginner", 6.8, 2, 2, false, "chest", ["shoulders", "triceps"]),
  ex("band-chest-press", "Band Chest Press", "chest", "horizontal_push", "compound", "band", "beginner", 7.0, 2, 2, false, "chest", ["triceps"]),
  ex("db-floor-press", "Dumbbell Floor Press", "chest", "horizontal_push", "compound", "dumbbell", "beginner", 7.6, 3, 2, false, "chest", ["triceps"]),

  // ---- Upper body: chest (gym) ---------------------------------------------
  ex("db-bench-press", "Dumbbell Bench Press", "chest", "horizontal_push", "compound", "dumbbell", "beginner", 8.0, 3, 3, false, "chest", ["shoulders", "triceps"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/db-bench-press.gif"),
  ex("machine-chest-press", "Machine Chest Press", "chest", "horizontal_push", "compound", "machine", "beginner", 7.8, 3, 2, false, "chest", ["triceps"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/machine-chest-press.gif"),
  ex("cable-fly", "Cable Fly", "chest", "horizontal_push", "isolation", "cable", "beginner", 7.4, 2, 2, false, "chest", [],
    "https://storage.googleapis.com/lbmethod-assets/exercises/cable-fly.gif"),

  // ---- Upper body: shoulders (home) ----------------------------------------
  ex("pike-push-up", "Pike Push-Up", "shoulders", "vertical_push", "compound", "bodyweight", "intermediate", 7.4, 3, 3, false, "shoulders", ["triceps"]),
  ex("band-shoulder-press", "Band Shoulder Press", "shoulders", "vertical_push", "compound", "band", "beginner", 7.0, 2, 2, false, "shoulders", ["triceps"]),
  ex("band-lateral-raise", "Band Lateral Raise", "shoulders", "vertical_push", "isolation", "band", "beginner", 6.8, 1, 1, false, "shoulders", []),

  // ---- Upper body: shoulders (gym) -----------------------------------------
  ex("db-shoulder-press", "Dumbbell Shoulder Press", "shoulders", "vertical_push", "compound", "dumbbell", "beginner", 8.0, 3, 3, false, "shoulders", ["triceps"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/db-shoulder-press.gif"),
  ex("lateral-raise", "Lateral Raise", "shoulders", "vertical_push", "isolation", "dumbbell", "beginner", 7.6, 1, 2, false, "shoulders", [],
    "https://storage.googleapis.com/lbmethod-assets/exercises/lateral-raise.gif"),
  ex("face-pull", "Face Pull", "shoulders", "horizontal_pull", "isolation", "cable", "beginner", 7.4, 1, 2, false, "shoulders", ["back"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/face-pull.gif"),

  // ---- Upper body: arms (home) ---------------------------------------------
  ex("dips", "Triceps Dips", "triceps", "horizontal_push", "isolation", "bodyweight", "intermediate", 7.8, 3, 3, false, "triceps", ["chest", "shoulders"]),
  ex("close-grip-push-up", "Close-Grip Push-Up", "triceps", "horizontal_push", "isolation", "bodyweight", "intermediate", 7.2, 2, 3, false, "triceps", ["chest"]),
  ex("db-triceps-extension", "Dumbbell Triceps Extension", "triceps", "horizontal_push", "isolation", "dumbbell", "beginner", 7.4, 2, 2, false, "triceps", []),
  ex("band-biceps-curl", "Band Biceps Curl", "biceps", "vertical_pull", "isolation", "band", "beginner", 7.0, 1, 1, false, "biceps", []),
  ex("band-triceps-extension", "Band Triceps Extension", "triceps", "horizontal_push", "isolation", "band", "beginner", 7.0, 1, 1, false, "triceps", []),
  ex("db-hammer-curl", "Dumbbell Hammer Curl", "biceps", "vertical_pull", "isolation", "dumbbell", "beginner", 7.4, 1, 1, false, "biceps", []),

  // ---- Upper body: arms (gym) ----------------------------------------------
  ex("db-biceps-curl", "Dumbbell Biceps Curl", "biceps", "vertical_pull", "isolation", "dumbbell", "beginner", 7.6, 1, 1, false, "biceps", [],
    "https://storage.googleapis.com/lbmethod-assets/exercises/biceps-curl.gif"),
  ex("triceps-pushdown", "Triceps Pushdown", "triceps", "horizontal_push", "isolation", "cable", "beginner", 7.6, 1, 1, false, "triceps", [],
    "https://storage.googleapis.com/lbmethod-assets/exercises/triceps-pushdown.gif"),

  // ---- Core (home) ---------------------------------------------------------
  ex("plank", "Plank", "core", "core", "isolation", "bodyweight", "beginner", 7.4, 2, 3, false, "core", []),
  ex("dead-bug", "Dead Bug", "core", "core", "isolation", "bodyweight", "beginner", 7.2, 2, 3, false, "core", []),
  ex("bicycle-crunch", "Bicycle Crunch", "core", "core", "isolation", "bodyweight", "beginner", 7.4, 2, 2, false, "core", []),
  ex("reverse-crunch", "Reverse Crunch", "core", "core", "isolation", "bodyweight", "beginner", 7.0, 2, 2, false, "core", []),
  ex("mountain-climber", "Mountain Climber", "core", "core", "accessory", "bodyweight", "beginner", 7.2, 3, 3, false, "core", []),
  ex("db-russian-twist", "Dumbbell Russian Twist", "core", "core", "isolation", "dumbbell", "beginner", 7.0, 2, 2, false, "core", []),

  // ---- Core (gym) ----------------------------------------------------------
  ex("hanging-leg-raise", "Hanging Leg Raise", "core", "core", "isolation", "bodyweight", "intermediate", 7.8, 2, 3, false, "core", [],
    "https://storage.googleapis.com/lbmethod-assets/exercises/hanging-leg-raise.gif"),
  ex("cable-crunch", "Cable Crunch", "core", "core", "isolation", "cable", "beginner", 7.6, 1, 1, false, "core", [],
    "https://storage.googleapis.com/lbmethod-assets/exercises/cable-crunch.gif"),
];

function ex(
  id: string,
  name: string,
  muscleGroup: string,
  movementPattern: Exercise["movementPattern"],
  category: Exercise["category"],
  equipment: Exercise["equipment"],
  difficulty: Exercise["difficulty"],
  activationScore: number,
  fatigueScore: number,
  stabilityRequirement: number,
  unilateral: boolean,
  primaryMuscle: string,
  secondaryMuscles: string[],
  imageUrl?: string,
  videoUrl?: string,
): Exercise {
  return {
    id,
    name,
    muscleGroup,
    movementPattern,
    category,
    equipment,
    difficulty,
    activationScore,
    fatigueScore,
    stabilityRequirement,
    unilateral,
    primaryMuscle,
    secondaryMuscles,
    imageUrl,
    videoUrl,
  };
}
