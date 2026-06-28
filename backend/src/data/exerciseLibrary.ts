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
  ex("barbell-hip-thrust", "Hip Thrust con Barra", "glutes", "hip_thrust", "compound", "barbell", "intermediate", 9.5, 4, 4, false, "glutes", ["hamstrings"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/barbell-hip-thrust.gif",
    "https://www.youtube.com/embed/SEdqd1n0cvg"),
  ex("smith-hip-thrust", "Hip Thrust en Máquina Smith", "glutes", "hip_thrust", "compound", "smith", "beginner", 9.2, 4, 3, false, "glutes", ["hamstrings"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/smith-hip-thrust.gif"),
  ex("machine-glute-bridge", "Máquina de Glúteos (Glute Drive)", "glutes", "hip_thrust", "compound", "machine", "beginner", 9.0, 3, 2, false, "glutes", ["hamstrings"]),
  ex("db-glute-bridge", "Puente de Glúteos con Mancuerna", "glutes", "hip_thrust", "compound", "dumbbell", "beginner", 8.4, 3, 2, false, "glutes", ["hamstrings"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/db-glute-bridge.gif"),
  ex("single-leg-hip-thrust", "Hip Thrust en Una Pierna", "glutes", "unilateral", "unilateral", "bodyweight", "intermediate", 8.6, 3, 4, true, "glutes", ["hamstrings"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/single-leg-hip-thrust.gif"),

  // ---- Glutes: HIP HINGE pattern ------------------------------------------
  ex("romanian-deadlift", "Peso Muerto Rumano con Barra", "glutes", "hip_hinge", "compound", "barbell", "intermediate", 9.0, 4, 4, false, "glutes", ["hamstrings", "back"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/romanian-deadlift.gif",
    "https://www.youtube.com/embed/JCXUYuzwNrM"),
  ex("db-romanian-deadlift", "Peso Muerto Rumano con Mancuernas", "glutes", "hip_hinge", "compound", "dumbbell", "beginner", 8.6, 4, 3, false, "glutes", ["hamstrings"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/db-rdl.gif"),
  ex("sumo-deadlift", "Peso Muerto Sumo", "glutes", "hip_hinge", "compound", "barbell", "advanced", 8.8, 5, 4, false, "glutes", ["hamstrings", "quadriceps"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/sumo-deadlift.gif"),
  ex("cable-pull-through", "Jalón de Cadera en Polea", "glutes", "hip_hinge", "accessory", "cable", "beginner", 8.0, 2, 2, false, "glutes", ["hamstrings"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/cable-pull-through.gif"),
  ex("kettlebell-swing", "Swing con Pesa Rusa", "glutes", "hip_hinge", "accessory", "kettlebell", "intermediate", 7.5, 3, 3, false, "glutes", ["hamstrings"]),
  ex("good-morning", "Buenos Días con Barra", "glutes", "hip_hinge", "compound", "barbell", "advanced", 8.2, 4, 4, false, "glutes", ["hamstrings"]),

  // ---- Glutes: KNEE DOMINANT pattern --------------------------------------
  ex("barbell-back-squat", "Sentadilla con Barra", "quadriceps", "knee_dominant", "compound", "barbell", "intermediate", 8.5, 5, 4, false, "quadriceps", ["glutes"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/barbell-squat.gif",
    "https://www.youtube.com/embed/ultWZbUMPL8"),
  ex("hack-squat", "Hack Squat en Máquina", "quadriceps", "knee_dominant", "compound", "machine", "intermediate", 8.6, 4, 2, false, "quadriceps", ["glutes"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/hack-squat.gif"),
  ex("leg-press", "Prensa de Piernas", "quadriceps", "knee_dominant", "compound", "machine", "beginner", 8.2, 4, 2, false, "quadriceps", ["glutes"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/leg-press.gif"),
  ex("glute-focus-leg-press", "Prensa con Pie Alto (enfoque glúteo)", "glutes", "knee_dominant", "compound", "machine", "beginner", 8.4, 4, 2, false, "glutes", ["hamstrings"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/high-foot-leg-press.gif"),
  ex("goblet-squat", "Sentadilla Goblet con Mancuerna", "quadriceps", "knee_dominant", "compound", "dumbbell", "beginner", 7.8, 3, 3, false, "quadriceps", ["glutes"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/goblet-squat.gif"),
  ex("front-squat", "Sentadilla Frontal", "quadriceps", "knee_dominant", "compound", "barbell", "advanced", 8.3, 5, 4, false, "quadriceps", ["glutes"]),

  // ---- Glutes: UNILATERAL pattern -----------------------------------------
  ex("bulgarian-split-squat", "Sentadilla Búlgara", "glutes", "unilateral", "unilateral", "dumbbell", "intermediate", 9.0, 4, 5, true, "glutes", ["quadriceps"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/bulgarian-split-squat.gif",
    "https://www.youtube.com/embed/2C-uNgKwPLE"),
  ex("walking-lunge", "Desplante Caminando", "glutes", "unilateral", "unilateral", "dumbbell", "intermediate", 8.4, 4, 4, true, "glutes", ["quadriceps", "hamstrings"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/walking-lunge.gif"),
  ex("reverse-lunge", "Desplante Inverso", "glutes", "unilateral", "unilateral", "dumbbell", "beginner", 8.2, 3, 4, true, "glutes", ["quadriceps"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/reverse-lunge.gif"),
  ex("step-up", "Escalón con Mancuernas", "glutes", "unilateral", "unilateral", "dumbbell", "beginner", 8.0, 3, 4, true, "glutes", ["quadriceps"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/step-up.gif"),
  ex("curtsy-lunge", "Desplante Cruzado", "glutes", "unilateral", "unilateral", "dumbbell", "intermediate", 8.1, 3, 4, true, "glutes", ["quadriceps"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/curtsy-lunge.gif"),
  ex("b-stance-rdl", "Peso Muerto Rumano Semiunilateral", "glutes", "unilateral", "unilateral", "dumbbell", "intermediate", 8.5, 3, 3, true, "glutes", ["hamstrings"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/b-stance-rdl.gif"),

  // ---- Glutes: ABDUCTION / isolation pattern ------------------------------
  ex("hip-abduction-machine", "Máquina de Abducción de Cadera", "glutes", "abduction", "isolation", "machine", "beginner", 8.0, 1, 1, false, "glutes", [],
    "https://storage.googleapis.com/lbmethod-assets/exercises/hip-abduction-machine.gif"),
  ex("cable-glute-kickback", "Patada de Glúteo en Polea", "glutes", "abduction", "isolation", "cable", "beginner", 7.8, 1, 2, true, "glutes", [],
    "https://storage.googleapis.com/lbmethod-assets/exercises/cable-glute-kickback.gif"),
  ex("banded-lateral-walk", "Caminata Lateral con Banda", "glutes", "abduction", "isolation", "band", "beginner", 7.0, 1, 2, false, "glutes", [],
    "https://storage.googleapis.com/lbmethod-assets/exercises/banded-lateral-walk.gif"),
  ex("seated-band-abduction", "Abducción con Banda Sentada", "glutes", "abduction", "isolation", "band", "beginner", 6.8, 1, 1, false, "glutes", []),
  ex("frog-pump", "Frog Pump (Puente de Rana)", "glutes", "abduction", "isolation", "bodyweight", "beginner", 7.2, 1, 1, false, "glutes", [],
    "https://storage.googleapis.com/lbmethod-assets/exercises/frog-pump.gif"),
  ex("standing-cable-abduction", "Abducción de Pie en Polea", "glutes", "abduction", "isolation", "cable", "beginner", 7.6, 1, 2, true, "glutes", [],
    "https://storage.googleapis.com/lbmethod-assets/exercises/standing-cable-abduction.gif"),
  ex("hyperextension-glute", "Hiperextensión con Enfoque en Glúteos", "glutes", "hip_hinge", "isolation", "bodyweight", "beginner", 8.0, 2, 2, false, "glutes", ["hamstrings"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/hyperextension.gif"),

  // ---- Glutes: BANDA / peso corporal (home extras) -------------------------
  ex("band-hip-thrust", "Hip Thrust con Banda Elástica", "glutes", "hip_thrust", "compound", "band", "beginner", 8.0, 2, 2, false, "glutes", ["hamstrings"]),
  ex("kb-deadlift", "Peso Muerto con Pesa Rusa", "glutes", "hip_hinge", "compound", "kettlebell", "beginner", 8.2, 3, 3, false, "glutes", ["hamstrings", "back"]),
  ex("kb-rdl", "Peso Muerto Rumano con Pesa Rusa", "glutes", "hip_hinge", "compound", "kettlebell", "beginner", 8.0, 3, 3, false, "glutes", ["hamstrings"]),
  ex("db-sumo-squat", "Sentadilla Sumo con Mancuerna", "glutes", "knee_dominant", "compound", "dumbbell", "beginner", 7.8, 3, 3, false, "glutes", ["quadriceps"]),
  ex("db-hip-thrust", "Hip Thrust con Mancuerna", "glutes", "hip_thrust", "compound", "dumbbell", "beginner", 8.3, 3, 2, false, "glutes", ["hamstrings"]),

  // ---- Hamstrings ----------------------------------------------------------
  ex("lying-leg-curl", "Curl de Femorales Acostada", "hamstrings", "knee_dominant", "isolation", "machine", "beginner", 8.2, 2, 1, false, "hamstrings", [],
    "https://storage.googleapis.com/lbmethod-assets/exercises/lying-leg-curl.gif"),
  ex("seated-leg-curl", "Curl de Femorales Sentada", "hamstrings", "knee_dominant", "isolation", "machine", "beginner", 8.4, 2, 1, false, "hamstrings", [],
    "https://storage.googleapis.com/lbmethod-assets/exercises/seated-leg-curl.gif"),
  ex("nordic-curl", "Curl Nórdico de Femorales", "hamstrings", "knee_dominant", "accessory", "bodyweight", "advanced", 8.8, 3, 4, false, "hamstrings", [],
    "https://storage.googleapis.com/lbmethod-assets/exercises/nordic-curl.gif"),

  // ---- Hamstrings: peso corporal -------------------------------------------
  ex("glute-bridge-hamstring", "Puente de Glúteos en Una Pierna", "hamstrings", "hip_hinge", "isolation", "bodyweight", "beginner", 7.8, 2, 3, true, "hamstrings", ["glutes"]),

  // ---- Quadriceps ----------------------------------------------------------
  ex("leg-extension", "Extensión de Cuádriceps", "quadriceps", "knee_dominant", "isolation", "machine", "beginner", 8.0, 2, 1, false, "quadriceps", [],
    "https://storage.googleapis.com/lbmethod-assets/exercises/leg-extension.gif"),
  ex("sissy-squat", "Sentadilla Sissy", "quadriceps", "knee_dominant", "accessory", "bodyweight", "advanced", 7.6, 2, 3, false, "quadriceps", []),

  // ---- Quadriceps: peso corporal / mancuernas (home) ----------------------
  ex("jump-squat", "Sentadilla con Salto", "quadriceps", "knee_dominant", "accessory", "bodyweight", "intermediate", 7.6, 3, 3, false, "quadriceps", ["glutes"]),
  ex("db-split-squat", "Sentadilla Dividida con Mancuernas", "quadriceps", "knee_dominant", "compound", "dumbbell", "beginner", 8.0, 3, 4, true, "quadriceps", ["glutes"]),

  // ---- Calves --------------------------------------------------------------
  ex("standing-calf-raise", "Elevación de Talones de Pie", "calves", "knee_dominant", "isolation", "machine", "beginner", 7.5, 1, 1, false, "calves", [],
    "https://storage.googleapis.com/lbmethod-assets/exercises/calf-raise.gif"),
  ex("seated-calf-raise", "Elevación de Talones Sentada", "calves", "knee_dominant", "isolation", "machine", "beginner", 7.8, 1, 1, false, "calves", []),
  ex("bodyweight-calf-raise", "Elevación de Talones con Peso Corporal", "calves", "knee_dominant", "isolation", "bodyweight", "beginner", 6.8, 1, 1, false, "calves", []),
  ex("single-leg-calf-raise", "Elevación de Talones en Una Pierna", "calves", "knee_dominant", "accessory", "bodyweight", "intermediate", 7.4, 1, 2, true, "calves", []),

  // ---- Upper body: back (home) ---------------------------------------------
  ex("pull-up", "Dominadas", "back", "vertical_pull", "compound", "bodyweight", "advanced", 8.8, 4, 4, false, "back", ["biceps"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/pull-up.gif"),
  ex("chin-up", "Jalón al Mentón (Chin-Up)", "back", "vertical_pull", "compound", "bodyweight", "advanced", 8.5, 3, 4, false, "biceps", ["back"]),
  ex("band-row", "Remo con Banda Elástica", "back", "horizontal_pull", "compound", "band", "beginner", 7.2, 2, 2, false, "back", ["biceps"]),
  ex("band-pull-apart", "Apertura de Banda para Hombros", "shoulders", "horizontal_pull", "isolation", "band", "beginner", 6.8, 1, 1, false, "shoulders", ["back"]),
  ex("inverted-row", "Remo Invertido", "back", "horizontal_pull", "compound", "bodyweight", "intermediate", 8.0, 3, 3, false, "back", ["biceps"]),

  // ---- Upper body: back (gym) ----------------------------------------------
  ex("lat-pulldown", "Jalón al Pecho en Polea", "back", "vertical_pull", "compound", "cable", "beginner", 8.2, 3, 2, false, "back", ["biceps"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/lat-pulldown.gif"),
  ex("seated-cable-row", "Remo en Polea Sentada", "back", "horizontal_pull", "compound", "cable", "beginner", 8.2, 3, 2, false, "back", ["biceps"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/cable-row.gif"),
  ex("db-row", "Remo con Mancuerna", "back", "horizontal_pull", "compound", "dumbbell", "beginner", 8.0, 3, 3, true, "back", ["biceps"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/db-row.gif"),
  ex("assisted-pullup", "Dominadas Asistidas en Máquina", "back", "vertical_pull", "compound", "machine", "intermediate", 8.4, 3, 3, false, "back", ["biceps"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/assisted-pullup.gif"),
  ex("straight-arm-pulldown", "Jalón con Brazos Extendidos", "back", "vertical_pull", "isolation", "cable", "beginner", 7.4, 2, 1, false, "back", []),

  // ---- Upper body: chest (home) --------------------------------------------
  ex("push-up", "Lagartija", "chest", "horizontal_push", "compound", "bodyweight", "beginner", 7.5, 3, 3, false, "chest", ["shoulders", "triceps"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/push-up.gif"),
  ex("incline-push-up", "Lagartija Inclinada", "chest", "horizontal_push", "compound", "bodyweight", "beginner", 6.8, 2, 2, false, "chest", ["shoulders", "triceps"]),
  ex("band-chest-press", "Press de Pecho con Banda", "chest", "horizontal_push", "compound", "band", "beginner", 7.0, 2, 2, false, "chest", ["triceps"]),
  ex("db-floor-press", "Press de Pecho en el Suelo con Mancuernas", "chest", "horizontal_push", "compound", "dumbbell", "beginner", 7.6, 3, 2, false, "chest", ["triceps"]),

  // ---- Upper body: chest (gym) ---------------------------------------------
  ex("db-bench-press", "Press de Banca con Mancuernas", "chest", "horizontal_push", "compound", "dumbbell", "beginner", 8.0, 3, 3, false, "chest", ["shoulders", "triceps"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/db-bench-press.gif"),
  ex("machine-chest-press", "Press de Pecho en Máquina", "chest", "horizontal_push", "compound", "machine", "beginner", 7.8, 3, 2, false, "chest", ["triceps"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/machine-chest-press.gif"),
  ex("cable-fly", "Aperturas en Polea", "chest", "horizontal_push", "isolation", "cable", "beginner", 7.4, 2, 2, false, "chest", [],
    "https://storage.googleapis.com/lbmethod-assets/exercises/cable-fly.gif"),

  // ---- Upper body: shoulders (home) ----------------------------------------
  ex("pike-push-up", "Lagartija en Pica", "shoulders", "vertical_push", "compound", "bodyweight", "intermediate", 7.4, 3, 3, false, "shoulders", ["triceps"]),
  ex("band-shoulder-press", "Press de Hombros con Banda", "shoulders", "vertical_push", "compound", "band", "beginner", 7.0, 2, 2, false, "shoulders", ["triceps"]),
  ex("band-lateral-raise", "Elevación Lateral con Banda", "shoulders", "vertical_push", "isolation", "band", "beginner", 6.8, 1, 1, false, "shoulders", []),

  // ---- Upper body: shoulders (gym) -----------------------------------------
  ex("db-shoulder-press", "Press Militar con Mancuernas", "shoulders", "vertical_push", "compound", "dumbbell", "beginner", 8.0, 3, 3, false, "shoulders", ["triceps"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/db-shoulder-press.gif"),
  ex("lateral-raise", "Elevación Lateral con Mancuernas", "shoulders", "vertical_push", "isolation", "dumbbell", "beginner", 7.6, 1, 2, false, "shoulders", [],
    "https://storage.googleapis.com/lbmethod-assets/exercises/lateral-raise.gif"),
  ex("face-pull", "Jalón a la Cara en Polea", "shoulders", "horizontal_pull", "isolation", "cable", "beginner", 7.4, 1, 2, false, "shoulders", ["back"],
    "https://storage.googleapis.com/lbmethod-assets/exercises/face-pull.gif"),

  // ---- Upper body: arms (home) ---------------------------------------------
  ex("dips", "Fondos de Tríceps", "triceps", "horizontal_push", "isolation", "bodyweight", "intermediate", 7.8, 3, 3, false, "triceps", ["chest", "shoulders"]),
  ex("close-grip-push-up", "Lagartija con Agarre Cerrado", "triceps", "horizontal_push", "isolation", "bodyweight", "intermediate", 7.2, 2, 3, false, "triceps", ["chest"]),
  ex("db-triceps-extension", "Extensión de Tríceps con Mancuerna", "triceps", "horizontal_push", "isolation", "dumbbell", "beginner", 7.4, 2, 2, false, "triceps", []),
  ex("band-biceps-curl", "Curl de Bíceps con Banda", "biceps", "vertical_pull", "isolation", "band", "beginner", 7.0, 1, 1, false, "biceps", []),
  ex("band-triceps-extension", "Extensión de Tríceps con Banda", "triceps", "horizontal_push", "isolation", "band", "beginner", 7.0, 1, 1, false, "triceps", []),
  ex("db-hammer-curl", "Curl Martillo con Mancuernas", "biceps", "vertical_pull", "isolation", "dumbbell", "beginner", 7.4, 1, 1, false, "biceps", []),

  // ---- Upper body: arms (gym) ----------------------------------------------
  ex("db-biceps-curl", "Curl de Bíceps con Mancuernas", "biceps", "vertical_pull", "isolation", "dumbbell", "beginner", 7.6, 1, 1, false, "biceps", [],
    "https://storage.googleapis.com/lbmethod-assets/exercises/biceps-curl.gif"),
  ex("triceps-pushdown", "Jalón de Tríceps en Polea", "triceps", "horizontal_push", "isolation", "cable", "beginner", 7.6, 1, 1, false, "triceps", [],
    "https://storage.googleapis.com/lbmethod-assets/exercises/triceps-pushdown.gif"),

  // ---- Core (home) ---------------------------------------------------------
  ex("plank", "Plancha", "core", "core", "isolation", "bodyweight", "beginner", 7.4, 2, 3, false, "core", []),
  ex("dead-bug", "Bicho Muerto", "core", "core", "isolation", "bodyweight", "beginner", 7.2, 2, 3, false, "core", []),
  ex("bicycle-crunch", "Abdominal Bicicleta", "core", "core", "isolation", "bodyweight", "beginner", 7.4, 2, 2, false, "core", []),
  ex("reverse-crunch", "Crunch Inverso", "core", "core", "isolation", "bodyweight", "beginner", 7.0, 2, 2, false, "core", []),
  ex("mountain-climber", "Escalador (Mountain Climber)", "core", "core", "accessory", "bodyweight", "beginner", 7.2, 3, 3, false, "core", []),
  ex("db-russian-twist", "Giro Ruso con Mancuerna", "core", "core", "isolation", "dumbbell", "beginner", 7.0, 2, 2, false, "core", []),

  // ---- Core (gym) ----------------------------------------------------------
  ex("hanging-leg-raise", "Elevación de Piernas Colgada", "core", "core", "isolation", "bodyweight", "intermediate", 7.8, 2, 3, false, "core", [],
    "https://storage.googleapis.com/lbmethod-assets/exercises/hanging-leg-raise.gif"),
  ex("cable-crunch", "Crunch en Polea", "core", "core", "isolation", "cable", "beginner", 7.6, 1, 1, false, "core", [],
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
