import { useEffect, useMemo, useRef, useState } from "react";
import lbMethodLogo from "./src/assets/lbmethod-logo.jpg";
import jsPDF from "jspdf";
import { fetchExerciseGif, preloadExerciseGifs } from "./src/exerciseGifs";

/* ===================================================================
   TYPES
   =================================================================== */
type Goal = "glute_hypertrophy"|"glute_growth"|"lower_body_focus"|"fat_loss"|"body_recomposition"|"muscle_gain";
type Level = "beginner"|"intermediate"|"advanced";
type Tab = "coach"|"clients"|"portal";
type AuthRole = "coach"|"client";
type CoachStep = 1|2|3|4;
type PortalTab = "rutina"|"registrar"|"chat"|"historial";

interface AuthSession { role: AuthRole; clientId?: string; name: string; token: string; }

interface SetLog { setNumber: number; reps: number; weightKg: number; completed: boolean; }

interface ExerciseLogRecord {
  id: string; weekNumber: number; dayIndex: number;
  exerciseName: string; setsData: SetLog[]; notes?: string; loggedAt: string;
}

interface ChatMessage {
  id: string; senderRole: "coach"|"client"; content: string|null;
  mediaUrl: string|null; mediaType: string|null; mediaFilename: string|null; createdAt: string;
}

type TrainingMethod =
  | "straight"|"drop_set"|"rest_pause"|"myo_reps"|"tempo"
  | "pre_exhaust"|"pyramid_ascending"|"pyramid_descending"
  | "cluster_set"|"pause_reps"|"mechanical_drop"|"giant_set";

type MovementPattern = "hip_thrust"|"hip_hinge"|"knee_dominant"|"abduction"|"unilateral"|"horizontal_push"|"vertical_push"|"horizontal_pull"|"vertical_pull"|"core";
type LimitationSeverity = "mild"|"moderate"|"severe";
type TrainingLocation = "gym"|"home";
type Gender = "female"|"male"|"unspecified";
type SessionDuration = 45|60|75|90;
interface WeakPoint { muscleGroup: string; priority: 1|2|3; }
interface Limitation { description: string; affectedPatterns: MovementPattern[]; severity: LimitationSeverity; }

interface MethodConfig {
  method: TrainingMethod;
  labelEs: string;
  prescriptionNote: string;
  restNote: string;
  isIntensityTechnique: boolean;
}

interface Selection {
  exercise: { id?: string; name: string; imageUrl?: string; videoUrl?: string };
  role: string; sets: number; repsMin: number; repsMax: number; rir: number;
  method?: TrainingMethod;
  methodConfig?: MethodConfig;
}

interface LibraryExercise {
  id: string; name: string; muscleGroup: string;
  primaryMuscle: string; category: string; equipment: string;
}

interface DayExerciseEdit {
  uid: string;        // key único para React
  exerciseId: string;
  exerciseName: string;
  role: "main"|"unilateral"|"isolation"|"accessory";
  sets: number; repsMin: number; repsMax: number; rir: number;
}

interface DayEditState {
  exercises: DayExerciseEdit[];
  isDirty: boolean;
}
interface Day { dayIndex: number; focus: string; sessionFatigue: number; totalSets: number; selections: Selection[]; }
interface Week { weekNumber: number; rir: number; deload: boolean; volume: { weeklyGluteSets: number; lowerVolumePct: number; upperVolumePct: number; gluteFrequency: number; }; days: Day[]; }
interface Program { goal: Goal; level: Level; daysPerWeek: number; weeks: Week[]; }
interface WeeklyProgress { weekNumber: number; completedSessions: number; notes: string; updatedAt: string; }
interface Client { id: string; name: string; goal: Goal; experienceLevel: Level; daysPerWeek: number; gender: Gender; sessionDuration: SessionDuration; trainingLocation: TrainingLocation; routineId: string|null; program: Program|null; progress: WeeklyProgress[]; pin?: string; weakPoints?: WeakPoint[]; limitations?: Limitation[]; }
interface ApiClientDashboard { client: { id: string; name?: string; email?: string; goal: Goal; experienceLevel: Level; daysPerWeek: number; gender?: Gender; sessionDuration?: number; trainingLocation?: TrainingLocation; pin?: string; weakPoints?: WeakPoint[]; limitations?: Limitation[]; }; routineId: string|null; program: Program|null; progress: WeeklyProgress[]; }

/* ===================================================================
   CONSTANTS
   =================================================================== */
const GOAL_LABELS: Record<Goal, string> = {
  glute_hypertrophy:"Hipertrofia de glúteo", glute_growth:"Crecimiento de glúteo",
  lower_body_focus:"Enfoque tren inferior", fat_loss:"Pérdida de grasa",
  body_recomposition:"Recomposición corporal", muscle_gain:"Ganancia muscular",
};
const LEVEL_LABELS: Record<Level,string> = { beginner:"Principiante", intermediate:"Intermedio", advanced:"Avanzado" };
const GENDER_LABELS: Record<Gender,string> = { female:"Mujer", male:"Hombre", unspecified:"No especificar" };
const GOALS_BY_GENDER: Record<Gender, Goal[]> = {
  female: ["glute_hypertrophy","glute_growth","lower_body_focus","fat_loss","body_recomposition","muscle_gain"],
  male:   ["muscle_gain","fat_loss","body_recomposition","lower_body_focus"],
  unspecified: ["glute_hypertrophy","glute_growth","lower_body_focus","fat_loss","body_recomposition","muscle_gain"],
};
type FocusMuscleKey = "glutes"|"glute_medius"|"hamstrings"|"quadriceps"|"core"|"chest"|"back"|"shoulders"|"biceps"|"triceps"|"upper_body";
interface FocusOption { key: FocusMuscleKey; label: string; desc: string; suggestGoal: Goal; }
const ALL_FOCUS_OPTIONS: FocusOption[] = [
  {key:"glutes",      label:"Glúteo Mayor",    desc:"Masa y forma del glúteo mayor. Hip thrust, bisagra y alta frecuencia.",             suggestGoal:"glute_hypertrophy"},
  {key:"glute_medius",label:"Glúteo Medio",    desc:"Anchura y estabilidad de cadera. Abducción y ejercicios unilaterales.",             suggestGoal:"glute_hypertrophy"},
  {key:"hamstrings",  label:"Isquiotibiales",  desc:"Fuerza y definición posterior de pierna. Peso muerto y curl femoral.",              suggestGoal:"lower_body_focus"},
  {key:"quadriceps",  label:"Cuádriceps",      desc:"Volumen frontal de pierna. Sentadillas, prensa y hack squat.",                      suggestGoal:"lower_body_focus"},
  {key:"chest",       label:"Pecho",           desc:"Hipertrofia pectoral. Press de pecho, inclinado y aperturas.",                      suggestGoal:"muscle_gain"},
  {key:"back",        label:"Espalda",         desc:"Anchura y grosor dorsal. Jalones, remos y pull-ups.",                               suggestGoal:"muscle_gain"},
  {key:"shoulders",   label:"Hombros",         desc:"Tamaño y definición del deltoides. Press de hombros y elevaciones.",                suggestGoal:"muscle_gain"},
  {key:"biceps",      label:"Bíceps",          desc:"Masa y definición de bíceps. Curls y jalones supinos como accesorios.",             suggestGoal:"muscle_gain"},
  {key:"triceps",     label:"Tríceps",         desc:"Volumen de tríceps. Extensiones y fondos como accesorios.",                        suggestGoal:"muscle_gain"},
  {key:"upper_body",  label:"Tren Superior",   desc:"Pecho, espalda y hombros como conjunto. Equilibrio y desarrollo global del tren superior.", suggestGoal:"muscle_gain"},
  {key:"core",        label:"Core / Abdomen",  desc:"Estabilidad central y definición abdominal. Core como accesorio en cada sesión.",   suggestGoal:"body_recomposition"},
];
const GOAL_DESCRIPTIONS: Partial<Record<Goal,string>> = {
  glute_hypertrophy:"Máximo desarrollo del glúteo. Splits especializados y alta frecuencia.",
  glute_growth:"Crecimiento progresivo del glúteo con variedad de estímulos.",
  lower_body_focus:"Tren inferior completo: glúteo, cuádriceps e isquiotibiales.",
  fat_loss:"Pérdida de grasa conservando músculo. Sesiones de alta densidad.",
  body_recomposition:"Reducir grasa y ganar músculo simultáneamente.",
  muscle_gain:"Hipertrofia general. Splits Push/Pull/Legs para desarrollo completo.",
};
const SESSION_DURATION_OPTIONS: {v:SessionDuration;l:string}[] = [{v:45,l:"45 min"},{v:60,l:"60 min"},{v:75,l:"75 min"},{v:90,l:"90 min"}];
const PATTERN_LABELS: Record<MovementPattern,string> = {
  hip_thrust:"Hip Thrust", hip_hinge:"Hip Hinge / Bisagra", knee_dominant:"Dominante de rodilla",
  abduction:"Abducción", unilateral:"Unilateral / Desplantes", horizontal_push:"Empuje horizontal",
  vertical_push:"Empuje vertical", horizontal_pull:"Jalón horizontal", vertical_pull:"Jalón vertical", core:"Core",
};
const SEVERITY_LABELS: Record<LimitationSeverity,string> = { mild:"Leve", moderate:"Moderada", severe:"Severa" };
const STEP_LABELS: Record<CoachStep,string> = { 1:"Agregar cliente", 2:"Generar rutina", 3:"Descargar rutina", 4:"Acceso cliente" };
const FOCUS_LABELS: Record<string,string> = {
  glute_hamstring:"Glúteo · Isquiotibiales", glute_quad:"Glúteo · Cuádriceps",
  glute_specialization:"Especialización glúteo", glute_heavy:"Glúteo pesado",
  glute_metabolic:"Glúteo metabólico", upper_body:"Tren superior",
  back_shoulder:"Espalda · Hombros", back_biceps:"Espalda · Bíceps",
  shoulder_triceps:"Hombros · Tríceps", chest_triceps:"Pecho · Tríceps",
  full_leg:"Pierna completa", legs_push:"Cuádriceps · Pierna",
};
const PORTAL_TABS: {id: PortalTab; label: string}[] = [
  {id:"rutina", label:"Mi rutina"}, {id:"registrar", label:"Registrar sesión"},
  {id:"chat", label:"Chat coach"}, {id:"historial", label:"Historial"},
];

const EX: Record<string,string> = {
  "Barbell Hip Thrust":"Hip Thrust con Barra","Smith Machine Hip Thrust":"Hip Thrust en Smith",
  "Glute Drive Machine":"Máquina Glute Drive","Dumbbell Glute Bridge":"Puente de Glúteo con Mancuerna",
  "Single-Leg Hip Thrust":"Hip Thrust Unilateral","Romanian Deadlift":"Peso Muerto Rumano",
  "Dumbbell RDL":"Peso Muerto Rumano con Mancuernas","Sumo Deadlift":"Peso Muerto Sumo",
  "Cable Pull-Through":"Pull-Through en Polea","Barbell Back Squat":"Sentadilla Trasera con Barra",
  "Hack Squat":"Sentadilla Hack","Leg Press":"Prensa de Pierna","High-Foot Leg Press":"Prensa Pies Altos",
  "Bulgarian Split Squat":"Sentadilla Búlgara","Walking Lunge":"Desplante Caminando",
  "Reverse Lunge":"Desplante Reverso","Curtsy Lunge":"Desplante Cruzado","Dumbbell Step-Up":"Step-Up con Mancuernas",
  "Hip Abduction Machine":"Abducción en Máquina","Cable Glute Kickback":"Patada de Glúteo en Polea",
  "Seated Leg Curl":"Curl Femoral Sentado","Lying Leg Curl":"Curl Femoral Acostado",
  "Leg Extension":"Extensión de Cuádriceps","Lat Pulldown":"Jalón al Pecho",
  "Seated Cable Row":"Remo en Polea Sentado","Dumbbell Bench Press":"Press de Pecho con Mancuernas",
  "Dumbbell Shoulder Press":"Press de Hombro con Mancuernas","Lateral Raise":"Elevaciones Laterales","Face Pull":"Face Pull",
  "Band Hip Thrust":"Hip Thrust con Banda","Kettlebell Deadlift":"Peso Muerto con Kettlebell",
  "Kettlebell RDL":"RDL con Kettlebell","Dumbbell Sumo Squat":"Sentadilla Sumo con Mancuerna",
  "Dumbbell Hip Thrust":"Hip Thrust con Mancuerna","Single-Leg Glute Bridge":"Puente de Glúteo Unilateral",
  "Jump Squat":"Sentadilla Saltada","Dumbbell Split Squat":"Sentadilla Dividida con Mancuernas",
  "Pull-Up":"Dominadas","Chin-Up":"Jalones Supinos",
  "Resistance Band Row":"Remo con Banda","Band Pull-Apart":"Apertura con Banda","Inverted Row":"Remo Invertido",
  "Push-Up":"Lagartijas","Incline Push-Up":"Lagartijas Inclinadas",
  "Band Chest Press":"Press de Pecho con Banda","Dumbbell Floor Press":"Press de Suelo con Mancuernas",
  "Pike Push-Up":"Lagartija Pica","Band Shoulder Press":"Press de Hombros con Banda",
  "Band Lateral Raise":"Elevaciones Laterales con Banda",
  "Triceps Dips":"Fondos de Tríceps","Close-Grip Push-Up":"Lagartija Diamante",
  "Dumbbell Triceps Extension":"Extensión de Tríceps con Mancuerna",
  "Band Biceps Curl":"Curl de Bíceps con Banda","Band Triceps Extension":"Extensión de Tríceps con Banda",
  "Dumbbell Hammer Curl":"Curl Martillo con Mancuerna",
  "Plank":"Plancha","Dead Bug":"Dead Bug","Bicycle Crunch":"Crunch Bicicleta",
  "Reverse Crunch":"Crunch Inverso","Mountain Climber":"Escalador",
  "Dumbbell Russian Twist":"Russian Twist con Mancuerna",
};
const tx = (n:string) => EX[n]??n;

const ROLE_TAG: Record<string,{label:string;cls:string}> = {
  main:{label:"Principal",cls:"bg-[#ece2cf] text-[#8f6a3c]"},
  compound:{label:"Compuesto",cls:"bg-[#e3e7e0] text-[#5a6152]"},
  unilateral:{label:"Unilateral",cls:"bg-[#e9e5dd] text-[#6b6358]"},
  isolation:{label:"Aislamiento",cls:"bg-[#e2e8e8] text-[#566060]"},
  accessory:{label:"Accesorio",cls:"bg-[#efece5] text-[#8c8377]"},
};

const METHOD_TAG: Record<TrainingMethod, { emoji: string; cls: string }> = {
  straight:           { emoji: "—",  cls: "bg-[#f0ede8] text-[#8c8377]" },
  drop_set:           { emoji: "↓",  cls: "bg-[#fde8d8] text-[#b84d00]" },
  rest_pause:         { emoji: "⏸",  cls: "bg-[#e8eefb] text-[#2d5fa6]" },
  myo_reps:           { emoji: "∞",  cls: "bg-[#e8f5e9] text-[#1b6b35]" },
  tempo:              { emoji: "⏱",  cls: "bg-[#fef3e2] text-[#8a5c00]" },
  pre_exhaust:        { emoji: "⚡",  cls: "bg-[#f3e8ff] text-[#6a1fa6]" },
  pyramid_ascending:  { emoji: "△",  cls: "bg-[#e8f4fd] text-[#1a5f8a]" },
  pyramid_descending: { emoji: "▽",  cls: "bg-[#e8f4fd] text-[#1a5f8a]" },
  cluster_set:        { emoji: "⬡",  cls: "bg-[#fde8e8] text-[#a62020]" },
  pause_reps:         { emoji: "✋",  cls: "bg-[#f0fde8] text-[#3d6b1a]" },
  mechanical_drop:    { emoji: "⇩",  cls: "bg-[#fff0e8] text-[#8a4a00]" },
  giant_set:          { emoji: "🔥", cls: "bg-[#fde8ef] text-[#a6203a]" },
};

const API = import.meta.env.VITE_API_URL??"/api";
const SESSION_KEY = "lbmethod_session_v1";

/* ===================================================================
   HELPERS
   =================================================================== */
const inputCls = "w-full rounded-xl border border-[#e0d9cc] bg-white p-3 text-[#17120d] placeholder-[#b3aa9b] focus:border-[#a87d49] focus:outline-none focus:ring-2 focus:ring-[#a87d49]/15";
const labelCls = "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8c8377]";
const primaryBtn = "rounded-xl bg-[#a87d49] font-semibold text-white transition hover:bg-[#946b3b] disabled:cursor-not-allowed disabled:opacity-50";
const darkBtn = "rounded-xl bg-[#17120d] font-semibold text-white transition hover:bg-[#2a2118] disabled:cursor-not-allowed disabled:opacity-50";
const ghostBtn = "rounded-xl border border-[#e0d9cc] font-semibold text-[#8c8377] transition hover:border-[#c2b9aa] hover:text-[#17120d]";

function initials(n:string){return n.split(" ").map(p=>p[0]).filter(Boolean).slice(0,2).join("").toUpperCase();}
function fdt(iso:string){const d=new Date(iso);if(isNaN(d.getTime()))return"N/A";return new Intl.DateTimeFormat("es-MX",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(d);}
function mapApiClient(p:ApiClientDashboard):Client{return{id:p.client.id,name:p.client.name?.trim()||p.client.email||"Cliente",goal:p.client.goal,experienceLevel:p.client.experienceLevel,daysPerWeek:p.client.daysPerWeek,gender:(p.client.gender??"unspecified") as Gender,sessionDuration:([45,60,75,90].includes(p.client.sessionDuration??0)?p.client.sessionDuration:60) as SessionDuration,trainingLocation:p.client.trainingLocation??"gym",pin:p.client.pin,routineId:p.routineId,program:p.program,progress:p.progress??[],weakPoints:p.client.weakPoints??[],limitations:p.client.limitations??[]};}
function adherence(c:Client){const w=c.program?.weeks??[];if(!w.length)return 0;const mx=w.length*c.daysPerWeek;const done=c.progress.reduce((s,i)=>s+i.completedSessions,0);return Math.min(100,Math.round(done/mx*100));}

/* ───────────────────────────────────────────────────────────────────
   Generación de PDF con jsPDF
   ─────────────────────────────────────────────────────────────────── */
const R = { // colores RGB reutilizables
  dark:  [23,  18,  13]  as [number,number,number],
  gold:  [168, 125, 73]  as [number,number,number],
  white: [255, 255, 255] as [number,number,number],
  sand:  [250, 248, 244] as [number,number,number],
  mid:   [140, 131, 119] as [number,number,number],
  light: [231, 225, 214] as [number,number,number],
  green: [76,  175, 80]  as [number,number,number],
};

const ROLE_ES: Record<string,string> = {
  main:"Principal", unilateral:"Unilateral", isolation:"Aislamiento", accessory:"Accesorio"
};

function downloadPdf(client:Client, program:Program) {
  const allSame=program.weeks.length>1&&program.weeks.slice(1).every(w=>weekEq(w,program.weeks[0]));
  const weeksToRender=allSame?[program.weeks[0]]:program.weeks;

  const doc = new jsPDF({ orientation:"p", unit:"mm", format:"a4" });
  const PW = 210; // page width
  const PH = 297; // page height
  const ML = 14;  // left margin
  const MR = 14;  // right margin
  const CW = PW - ML - MR; // content width

  let y = 0;
  let pageNum = 1;

  function addFooter() {
    doc.setFontSize(7);
    doc.setFont("helvetica","normal");
    doc.setTextColor(...R.mid);
    doc.text("Generado con LB Method Coaching Studio", ML, PH - 7);
    doc.text(`Página ${pageNum}`, PW - MR, PH - 7, {align:"right"});
  }

  function checkPage(needed = 20) {
    if (y + needed > PH - 14) {
      addFooter();
      doc.addPage();
      pageNum++;
      y = 14;
    }
  }

  // ── Encabezado oscuro ──
  doc.setFillColor(...R.dark);
  doc.rect(0, 0, PW, 44, "F");

  // Franja dorada fina
  doc.setFillColor(...R.gold);
  doc.rect(0, 44, PW, 1.5, "F");

  doc.setTextColor(...R.white);
  doc.setFont("helvetica","bold");
  doc.setFontSize(22);
  doc.text("LB METHOD", ML, 18);

  doc.setFont("helvetica","normal");
  doc.setFontSize(10);
  doc.setTextColor(183, 173, 157); // #b7ad9d
  doc.text("PROGRAMA DE ENTRENAMIENTO", ML, 27);

  doc.setFontSize(8);
  doc.setTextColor(154, 145, 134);
  doc.text(new Date().toLocaleDateString("es-MX",{day:"2-digit",month:"long",year:"numeric"}), ML, 36);

  y = 54;

  // ── Info del cliente ──
  doc.setFillColor(...R.sand);
  doc.roundedRect(ML, y, CW, 26, 3, 3, "F");
  doc.setDrawColor(...R.light);
  doc.roundedRect(ML, y, CW, 26, 3, 3, "S");

  doc.setTextColor(...R.dark);
  doc.setFont("helvetica","bold");
  doc.setFontSize(16);
  doc.text(client.name, ML + 5, y + 10);

  doc.setFont("helvetica","normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...R.mid);
  const meta = `${GOAL_LABELS[client.goal]}  ·  ${LEVEL_LABELS[client.experienceLevel]}  ·  ${client.daysPerWeek} días/semana  ·  ${allSame?`${program.weeks.length} semanas (estructura idéntica)`:program.weeks.length+" semanas"}`;
  doc.text(meta, ML + 5, y + 19);

  y += 34;

  // ── Semanas ──
  for (const week of weeksToRender) {
    checkPage(40);

    // Cabecera de semana
    doc.setFillColor(...R.dark);
    doc.roundedRect(ML, y, CW, 9, 2, 2, "F");
    doc.setTextColor(...R.gold);
    doc.setFont("helvetica","bold");
    doc.setFontSize(10);
    doc.text(allSame ? `MES 1  ·  ${program.weeks.length} SEMANAS` : `SEMANA ${week.weekNumber}${week.deload ? "  · DELOAD" : ""}`, ML + 4, y + 6);

    const rirText = allSame ? `RIR progresivo sem 1–${program.weeks.length}` : week.deload ? "Semana de descarga" : `RIR objetivo: ${week.rir}`;
    doc.setFont("helvetica","normal");
    doc.setFontSize(8);
    doc.setTextColor(183, 173, 157);
    doc.text(rirText, ML + CW - 3, y + 6, {align:"right"});

    y += 11;

    // Estadísticas de volumen
    doc.setTextColor(...R.mid);
    doc.setFontSize(7.5);
    doc.setFont("helvetica","normal");
    doc.text(
      `Series glúteo: ${week.volume.weeklyGluteSets}   ·   Frecuencia glúteo: ${week.volume.gluteFrequency}×/sem   ·   Tren inferior: ${Math.round(week.volume.lowerVolumePct*100)}%`,
      ML, y
    );
    y += 6;

    // ── Días ──
    for (const day of week.days) {
      checkPage(30);

      // Cabecera del día
      doc.setFillColor(237, 232, 222); // light sand
      doc.rect(ML, y, CW, 8, "F");
      doc.setTextColor(...R.dark);
      doc.setFont("helvetica","bold");
      doc.setFontSize(9);
      const dayTitle = `Día ${day.dayIndex+1}  —  ${FOCUS_LABELS[day.focus]??day.focus.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase())}`;
      doc.text(dayTitle, ML + 3, y + 5.5);
      doc.setFont("helvetica","normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...R.mid);
      doc.text(`${day.totalSets} series  ·  fatiga ${day.sessionFatigue.toFixed(1)}/12`, ML + CW - 3, y + 5.5, {align:"right"});

      y += 10;

      // ── Ejercicios ──
      for (const sel of day.selections) {
        checkPage(14);

        const hasMethod = sel.methodConfig?.isIntensityTechnique;
        const rowH = hasMethod ? 13 : 8;

        // Fondo alternado suave
        doc.setFillColor(252, 250, 247);
        doc.rect(ML + 1, y - 1, CW - 2, rowH, "F");

        // Rol badge
        const roleLabel = ROLE_ES[sel.role] ?? sel.role;
        doc.setFillColor(...R.gold);
        doc.roundedRect(ML + 2, y, 22, 5, 1, 1, "F");
        doc.setTextColor(...R.white);
        doc.setFont("helvetica","bold");
        doc.setFontSize(6.5);
        doc.text(roleLabel.toUpperCase(), ML + 13, y + 3.5, {align:"center"});

        // Nombre del ejercicio
        doc.setTextColor(...R.dark);
        doc.setFont("helvetica","normal");
        doc.setFontSize(8.5);
        doc.text(tx(sel.exercise.name), ML + 26, y + 3.5);

        // Prescripción
        const presc = `${sel.sets}×${sel.repsMin}–${sel.repsMax}  RIR ${sel.rir}`;
        doc.setTextColor(...R.mid);
        doc.setFontSize(8);
        doc.text(presc, ML + CW - 3, y + 3.5, {align:"right"});

        y += 6.5;

        // Nota del método de entrenamiento
        if (hasMethod && sel.methodConfig) {
          const methodTag = `${sel.methodConfig.labelEs}: `;
          const methodNote = sel.methodConfig.prescriptionNote.slice(0, 90);

          doc.setFillColor(254, 243, 226); // warm amber light
          doc.rect(ML + 26, y - 1.5, CW - 27, 5.5, "F");

          doc.setTextColor(...R.gold);
          doc.setFont("helvetica","bold");
          doc.setFontSize(7);
          doc.text(methodTag, ML + 27, y + 2.5);

          const tagW = doc.getTextWidth(methodTag);
          doc.setTextColor(122, 106, 82);
          doc.setFont("helvetica","normal");
          doc.setFontSize(7);
          // Truncar si no cabe
          const maxW = CW - 27 - tagW - 3;
          let note = methodNote;
          while (doc.getTextWidth(note) > maxW && note.length > 10) note = note.slice(0, -4) + "…";
          doc.text(note, ML + 27 + tagW, y + 2.5);

          y += 5;
        }

        y += 1.5;
      }
      y += 4;
    }
    y += 6;
  }

  // Footer última página
  addFooter();

  doc.save(`rutina-${client.name.toLowerCase().replace(/\s+/g,"-")}.pdf`);
}

/* ===================================================================
   MAIN COMPONENT
   =================================================================== */
export default function RoutineGenerator() {
  /* --- Auth --- */
  const [authRole, setAuthRole] = useState<AuthRole>("coach");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPin, setLoginPin] = useState("");
  /* --- 2FA / Rate limiting --- */
  const [twoFactorPending, setTwoFactorPending] = useState(false);
  const [twoFactorMaskedEmail, setTwoFactorMaskedEmail] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [loginLockedUntil, setLoginLockedUntil] = useState<number|null>(null);
  const [authSession, setAuthSession] = useState<AuthSession|null>(()=>{
    try{const r=sessionStorage.getItem(SESSION_KEY);if(!r)return null;const p=JSON.parse(r) as Partial<AuthSession>;if(p.role!=="coach"&&p.role!=="client")return null;if(typeof p.name!=="string"||!p.name.trim())return null;if(typeof p.token!=="string"||!p.token.trim())return null;return{role:p.role,name:p.name,token:p.token,clientId:typeof p.clientId==="string"?p.clientId:undefined};}catch{return null;}
  });

  /* --- Coach wizard --- */
  const [coachStep, setCoachStep] = useState<CoachStep>(1);
  const [flowClient, setFlowClient] = useState<Client|null>(null);
  const [flowProgram, setFlowProgram] = useState<Program|null>(null);
  const [useExisting, setUseExisting] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [goal, setGoal] = useState<Goal>("glute_hypertrophy");
  const [experienceLevel, setLevel] = useState<Level>("intermediate");
  const [daysPerWeek, setDays] = useState(4);
  const [clientPin, setClientPin] = useState("");
  const [generatedPin, setGeneratedPin] = useState("");
  const [pinSaved, setPinSaved] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  /* --- Personalización Step 1/2 --- */
  const [wizGoal, setWizGoal] = useState<Goal>("glute_hypertrophy");
  const [wizFocusMuscle, setWizFocusMuscle] = useState<FocusMuscleKey|null>(null);
  const [wizGender, setWizGender] = useState<Gender>("unspecified");
  const [wizSessionDuration, setWizSessionDuration] = useState<SessionDuration>(60);
  const [wizTrainingLocation, setWizTrainingLocation] = useState<TrainingLocation>("gym");
  const [wizWeak, setWizWeak] = useState<WeakPoint[]>([]);
  const [wizPatterns, setWizPatterns] = useState<MovementPattern[]>([]);
  const [wizSeverity, setWizSeverity] = useState<LimitationSeverity>("mild");
  const [wizLimitDesc, setWizLimitDesc] = useState("");

  /* --- Clients --- */
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("coach");
  const [progressWeek, setProgressWeek] = useState(1);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [progressNotes, setProgressNotes] = useState("");

  /* --- Edición de rutina --- */
  const [editingRoutine, setEditingRoutine] = useState(false);
  const [exerciseLibrary, setExerciseLibrary] = useState<LibraryExercise[]>([]);
  const [dayEdits, setDayEdits] = useState<Record<string, DayEditState>>({});
  const [savingDay, setSavingDay] = useState<string|null>(null);
  const [editError, setEditError] = useState<string|null>(null);
  const [creatingExercise, setCreatingExercise] = useState<{key:string;idx:number;name:string;muscleGroup:string}|null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<Client|null>(null);

  /* --- Portal --- */
  const [portalTab, setPortalTab] = useState<PortalTab>("rutina");

  /* --- Exercise logging --- */
  const [logWeek, setLogWeek] = useState(1);
  const [logDay, setLogDay] = useState(0);
  const [exerciseLogs, setExerciseLogs] = useState<Record<string, SetLog[]>>({});
  const [logNotes, setLogNotes] = useState<Record<string, string>>({});
  const [, setDayLogsLoaded] = useState(false);
  const [logSaving, setLogSaving] = useState(false);

  /* --- Modal de imagen de ejercicio --- */
  const [exerciseModal, setExerciseModal] = useState<{name:string;imageUrl?:string;videoUrl?:string}|null>(null);
  /* --- GIFs de ejercicios cargados dinámicamente --- */
  const [gifMap, setGifMap] = useState<Record<string,string|null>>({});

  /* --- Swap de ejercicio (portal cliente) --- */
  const [swapTarget, setSwapTarget] = useState<{weekNumber:number;dayIndex:number;sel:Selection;routineId:string}|null>(null);
  const [swapOptions, setSwapOptions] = useState<LibraryExercise[]>([]);
  const [swapLoading, setSwapLoading] = useState(false);
  const [swapSaving, setSwapSaving] = useState(false);

  /* --- History --- */
  const [historyExercise, setHistoryExercise] = useState("");
  const [historyData, setHistoryData] = useState<ExerciseLogRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  /* --- Chat (movido a FloatingChat — autocontenido) --- */

  /* --- Global state --- */
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);

  /* ---- API helper ---- */
  async function apiFetch(path:string, init:RequestInit={}, allowPublic=false):Promise<Response>{
    const token=authSession?.token;
    if(!allowPublic&&!token)throw new Error("Sesión no iniciada.");
    const headers=new Headers(init.headers);
    if(!allowPublic&&token)headers.set("Authorization",`Bearer ${token}`);
    const res=await fetch(`${API}${path}`,{...init,headers});
    if(res.status===401&&!allowPublic){setAuthSession(null);throw new Error("Sesión expirada.");}
    return res;
  }

  /* ---- Clients loader ---- */
  async function refreshClients():Promise<Client[]>{
    if(!authSession){setClients([]);return[];}
    if(authSession.role==="client"&&authSession.clientId){
      const res=await apiFetch(`/usuario/${authSession.clientId}`);
      if(!res.ok)throw new Error(`Error ${res.status}`);
      const d=await res.json() as {usuario:ApiClientDashboard};
      const c=mapApiClient(d.usuario);setClients([c]);return[c];
    }
    const res=await apiFetch("/usuarios");
    if(!res.ok)throw new Error(`Error ${res.status}`);
    const d=await res.json() as {usuarios:ApiClientDashboard[]};
    const ds=d.usuarios.map(mapApiClient);setClients(ds);return ds;
  }

  useEffect(()=>{refreshClients().catch(e=>setError(e instanceof Error?e.message:"Error"));},[authSession]);
  useEffect(()=>{if(!authSession){sessionStorage.removeItem(SESSION_KEY);return;}sessionStorage.setItem(SESSION_KEY,JSON.stringify(authSession));},[authSession]);
  useEffect(()=>{if(!clients.some(c=>c.id===selectedClientId))setSelectedClientId(clients[0]?.id??"");},[clients]);

  // Precargar GIFs cuando hay un programa disponible (portal cliente o step 3)
  useEffect(()=>{
    const program=flowProgram??clients.find(c=>c.id===selectedClientId)?.program??null;
    if(!program)return;
    const names=[...new Set(program.weeks.flatMap(w=>w.days.flatMap(d=>d.selections.map(s=>s.exercise.name))))];
    const missing=names.filter(n=>!(n in gifMap));
    if(!missing.length)return;
    preloadExerciseGifs(missing);
    // Ir cargando el gifMap a medida que llegan
    missing.forEach((name,i)=>{
      setTimeout(async()=>{
        const url=await fetchExerciseGif(name);
        setGifMap(prev=>({...prev,[name]:url}));
      }, i*130);
    });
  },[flowProgram,selectedClientId]);
  useEffect(()=>{if(authSession?.role==="client"&&authSession.clientId){setSelectedClientId(authSession.clientId);setActiveTab("portal");}},[authSession]);
  // Pre-llenar personalización cuando se selecciona cliente en Step 2
  useEffect(()=>{
    if(coachStep===2&&flowClient){
      setWizGoal(flowClient.goal);
      setWizFocusMuscle(null);
      setWizGender(flowClient.gender??"unspecified");
      setWizSessionDuration(flowClient.sessionDuration??60);
      setWizTrainingLocation(flowClient.trainingLocation??"gym");
      setWizWeak(flowClient.weakPoints??[]);
      const pats=flowClient.limitations?.flatMap(l=>l.affectedPatterns)??[];
      setWizPatterns(pats as MovementPattern[]);
      if(flowClient.limitations?.[0]){
        setWizSeverity(flowClient.limitations[0].severity);
        setWizLimitDesc(flowClient.limitations[0].description??"");
      }
    }
  },[flowClient?.id,coachStep]);

  const selectedClient=useMemo(()=>clients.find(c=>c.id===selectedClientId)??null,[clients,selectedClientId]);

  /* ---- Chat — manejado por <FloatingChat> autocontenido ---- */

  /* ---- Edición de rutina ---- */
  async function loadExerciseLibrary() {
    if(exerciseLibrary.length>0)return;
    try{
      const res=await apiFetch("/exercise-library");
      if(res.ok){const d=await res.json() as {exercises:LibraryExercise[]};setExerciseLibrary(d.exercises??[]);}
    }catch{}
  }

  function enterEditMode() {
    if(!selectedClient?.program)return;
    const edits:Record<string,DayEditState>={};
    for(const week of selectedClient.program.weeks){
      for(const day of week.days){
        const key=`${week.weekNumber}-${day.dayIndex}`;
        edits[key]={
          exercises: day.selections.map((s,i)=>({
            uid:`${s.exercise.id??s.exercise.name}-${i}`,
            exerciseId: s.exercise.id??s.exercise.name,
            exerciseName: s.exercise.name,
            role: s.role as DayExerciseEdit["role"],
            sets:s.sets, repsMin:s.repsMin, repsMax:s.repsMax, rir:s.rir,
          })),
          isDirty:false,
        };
      }
    }
    setDayEdits(edits);
    setEditingRoutine(true);
    setEditError(null);
    loadExerciseLibrary();
  }

  function exitEditMode(){setEditingRoutine(false);setDayEdits({});setEditError(null);}

  function enterFlowEditMode(){
    if(!flowProgram)return;
    const edits:Record<string,DayEditState>={};
    for(const week of flowProgram.weeks){
      for(const day of week.days){
        const key=`${week.weekNumber}-${day.dayIndex}`;
        edits[key]={
          exercises:day.selections.map((s,i)=>({
            uid:`${s.exercise.id??s.exercise.name}-${i}`,
            exerciseId:s.exercise.id??s.exercise.name,
            exerciseName:s.exercise.name,
            role:s.role as DayExerciseEdit["role"],
            sets:s.sets,repsMin:s.repsMin,repsMax:s.repsMax,rir:s.rir,
          })),
          isDirty:false,
        };
      }
    }
    setDayEdits(edits);
    setEditingRoutine(true);
    setEditError(null);
    loadExerciseLibrary();
  }

  async function saveAllFlowDays(){
    if(!flowClient?.routineId)return;
    setSavingDay("all");
    setEditError(null);
    try{
      const dirtyKeys=Object.entries(dayEdits).filter(([,v])=>v.isDirty).map(([k])=>k);
      for(const key of dirtyKeys){
        const [wStr,dStr]=key.split("-");
        const dayState=dayEdits[key];
        const res=await apiFetch(`/routine/${flowClient.routineId}/week/${wStr}/day/${dStr}`,{
          method:"PATCH",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({action:"set_day",exercises:dayState.exercises.map(e=>({exerciseId:e.exerciseId,role:e.role,sets:e.sets,repsMin:e.repsMin,repsMax:e.repsMax,rir:e.rir}))}),
        });
        if(!res.ok){const d=await res.json().catch(()=>({}));throw new Error(d?.message??`Error ${res.status}`);}
      }
      const fresh=await refreshClients();
      const upd=fresh.find(c=>c.id===flowClient.id);
      if(upd?.program)setFlowProgram(upd.program);
      exitEditMode();
    }catch(e){setEditError(e instanceof Error?e.message:"Error al guardar");}
    finally{setSavingDay(null);}
  }

  function updateDayExercise(key:string, idx:number, field:keyof DayExerciseEdit, value:string|number) {
    setDayEdits(prev=>{
      const day={...prev[key]};
      const exs=[...day.exercises];
      exs[idx]={...exs[idx],[field]:value};
      return{...prev,[key]:{exercises:exs,isDirty:true}};
    });
  }

  function changeExercise(key:string, idx:number, exerciseId:string) {
    if(exerciseId==="__new__"){setCreatingExercise({key,idx,name:"",muscleGroup:"Glúteo"});return;}
    const ex=exerciseLibrary.find(e=>e.id===exerciseId);
    if(!ex)return;
    setDayEdits(prev=>{
      const day={...prev[key]};
      const exs=[...day.exercises];
      exs[idx]={...exs[idx],exerciseId:ex.id,exerciseName:ex.name};
      return{...prev,[key]:{exercises:exs,isDirty:true}};
    });
  }

  function confirmCreateExercise(){
    if(!creatingExercise)return;
    const {key,idx,name,muscleGroup}=creatingExercise;
    const n=name.trim();
    if(!n)return;
    const newEx:LibraryExercise={id:`local_${Date.now()}`,name:n,muscleGroup,primaryMuscle:muscleGroup,category:"strength",equipment:"machine"};
    setExerciseLibrary(prev=>[...prev,newEx]);
    setDayEdits(prev=>{
      const day={...prev[key]};
      const exs=[...day.exercises];
      exs[idx]={...exs[idx],exerciseId:newEx.id,exerciseName:newEx.name};
      return{...prev,[key]:{exercises:exs,isDirty:true}};
    });
    setCreatingExercise(null);
  }

  function removeDayExercise(key:string, idx:number) {
    setDayEdits(prev=>{
      const day={...prev[key]};
      const exs=day.exercises.filter((_,i)=>i!==idx);
      return{...prev,[key]:{exercises:exs,isDirty:true}};
    });
  }

  function addDayExercise(key:string) {
    const firstEx=exerciseLibrary[0];
    if(!firstEx)return;
    setDayEdits(prev=>{
      const day={...prev[key]};
      const newEx:DayExerciseEdit={uid:`new-${Date.now()}`,exerciseId:firstEx.id,exerciseName:firstEx.name,role:"accessory",sets:3,repsMin:10,repsMax:15,rir:2};
      return{...prev,[key]:{exercises:[...day.exercises,newEx],isDirty:true}};
    });
  }

  async function saveDayEdit(routineId:string, weekNumber:number, dayIndex:number) {
    const key=`${weekNumber}-${dayIndex}`;
    const dayState=dayEdits[key];
    if(!dayState?.isDirty)return;
    setSavingDay(key);setEditError(null);
    try{
      const res=await apiFetch(`/routine/${routineId}/week/${weekNumber}/day/${dayIndex}`,{
        method:"PATCH",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          action:"set_day",
          exercises:dayState.exercises.map(e=>({exerciseId:e.exerciseId,role:e.role,sets:e.sets,repsMin:e.repsMin,repsMax:e.repsMax,rir:e.rir})),
        }),
      });
      if(!res.ok){const d=await res.json().catch(()=>({}));throw new Error(d?.message??`Error ${res.status}`);}
      setDayEdits(prev=>({...prev,[key]:{...dayState,isDirty:false}}));
      await refreshClients();
    }catch(e){setEditError(e instanceof Error?e.message:"Error al guardar");}
    finally{setSavingDay(null);}
  }

  async function saveAllDays(routineId:string) {
    const dirtyKeys=Object.entries(dayEdits).filter(([,v])=>v.isDirty).map(([k])=>k);
    for(const key of dirtyKeys){
      const [wStr,dStr]=key.split("-");
      await saveDayEdit(routineId,Number(wStr),Number(dStr));
    }
  }

  /* ---- Exercise logging ---- */
  async function loadDayLogs(clientId:string,week:number,day:number){
    setDayLogsLoaded(false);
    try{
      const res=await apiFetch(`/usuario/${clientId}/logs?week=${week}&day=${day}`);
      if(!res.ok)return;
      const d=await res.json() as {logs:ExerciseLogRecord[]};
      const newLogs:Record<string,SetLog[]>={};
      const newNotes:Record<string,string>={};
      for(const log of d.logs){newLogs[log.exerciseName]=log.setsData;newNotes[log.exerciseName]=log.notes??"";}
      setExerciseLogs(newLogs);setLogNotes(newNotes);
    }catch{}finally{setDayLogsLoaded(true);}
  }

  const portalClientId = authSession?.role==="client"?authSession.clientId:selectedClientId;

  useEffect(()=>{
    if(portalTab!=="registrar"||!portalClientId)return;
    const client=clients.find(c=>c.id===portalClientId);
    if(!client?.program)return;
    // Init sets from routine prescription
    const day=client.program.weeks.find(w=>w.weekNumber===logWeek)?.days.find(d=>d.dayIndex===logDay);
    if(day){
      const init:Record<string,SetLog[]>={};
      for(const sel of day.selections){
        if(!exerciseLogs[sel.exercise.name]){
          init[sel.exercise.name]=Array.from({length:sel.sets},(_,i)=>({setNumber:i+1,reps:sel.repsMin,weightKg:0,completed:false}));
        }
      }
      if(Object.keys(init).length>0)setExerciseLogs(prev=>({...init,...prev}));
    }
    loadDayLogs(portalClientId,logWeek,logDay);
  },[portalTab,logWeek,logDay,portalClientId]);

  async function saveExerciseLog(exerciseName:string){
    if(!portalClientId)return;
    const sets=exerciseLogs[exerciseName];
    if(!sets||sets.length===0)return;
    setLogSaving(true);
    try{
      await apiFetch(`/usuario/${portalClientId}/logs`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({weekNumber:logWeek,dayIndex:logDay,exerciseName,setsData:sets,notes:logNotes[exerciseName]||""})});
    }catch(e){setError(e instanceof Error?e.message:"Error al guardar")}
    finally{setLogSaving(false);}
  }

  async function loadHistory(exerciseName:string){
    if(!portalClientId)return;
    setHistoryLoading(true);
    try{
      const res=await apiFetch(`/usuario/${portalClientId}/logs/historial/${encodeURIComponent(exerciseName)}`);
      if(!res.ok)return;
      const d=await res.json() as {logs:ExerciseLogRecord[]};setHistoryData(d.logs);
    }catch{}finally{setHistoryLoading(false);}
  }

  /* ---- Coach wizard ---- */
  async function handleStep1(){
    setError(null);
    if(useExisting){
      const c=clients.find(cc=>cc.id===selectedClientId);
      if(!c){setError("Selecciona un cliente.");return;}
      setFlowClient(c);setGoal(c.goal);setLevel(c.experienceLevel);setDays(c.daysPerWeek);setCoachStep(2);return;
    }
    const name=newClientName.trim();if(!name){setError("Escribe el nombre.");return;}

    // Verificar duplicado por nombre (búsqueda case-insensitive)
    const dup=clients.find(c=>c.name.trim().toLowerCase()===name.toLowerCase());
    if(dup){setDuplicateWarning(dup);return;}
    setDuplicateWarning(null);
    setLoading(true);
    try{
      const res=await apiFetch("/usuario",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,goal,experienceLevel,daysPerWeek,gender:wizGender,sessionDuration:wizSessionDuration,trainingLocation:wizTrainingLocation})});
      if(!res.ok){const d=await res.json().catch(()=>({}));throw new Error(d?.message??`Error ${res.status}`);}
      const data=await res.json() as {usuario:{id:string};generatedPin?:string};
      if(data.generatedPin) setGeneratedPin(data.generatedPin);
      const fresh=await refreshClients();
      setFlowClient(fresh.find(c=>c.id===data.usuario.id)??null);
      setSelectedClientId(data.usuario.id);setNewClientName("");setCoachStep(2);
    }catch(e){setError(e instanceof Error?e.message:"Error")}finally{setLoading(false);}
  }

  async function handleStep2(){
    if(!flowClient)return;setLoading(true);setError(null);
    try{
      // Si hay músculo en enfoque, inyectarlo como punto débil prioridad 3
      // "upper_body" expande a los tres grupos del tren superior
      const focusWeaks: WeakPoint[] = wizFocusMuscle === "upper_body"
        ? [{muscleGroup:"chest",priority:3 as const},{muscleGroup:"back",priority:3 as const},{muscleGroup:"shoulders",priority:3 as const}]
        : wizFocusMuscle
          ? [{muscleGroup:wizFocusMuscle, priority:3 as const}]
          : [];
      const focusKeys = focusWeaks.map(w=>w.muscleGroup);
      const effectiveWeak: WeakPoint[] = [
        ...focusWeaks,
        ...wizWeak.filter(w=>!focusKeys.includes(w.muscleGroup)),
      ];

      // Guardar personalización antes de generar
      const limitations:Limitation[]=wizPatterns.length>0
        ?[{description:wizLimitDesc.trim(),affectedPatterns:wizPatterns,severity:wizSeverity}]
        :[];
      if(wizWeak.length>0||limitations.length>0||wizTrainingLocation!==flowClient.trainingLocation||wizGender!==flowClient.gender||wizSessionDuration!==flowClient.sessionDuration||wizGoal!==flowClient.goal){
        await apiFetch(`/usuario/${flowClient.id}/perfil`,{
          method:"PATCH",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({weakPoints:effectiveWeak,limitations,trainingLocation:wizTrainingLocation,gender:wizGender,sessionDuration:wizSessionDuration,goal:wizGoal}),
        });
      }
      const res=await apiFetch("/generate-routine",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({clientId:flowClient.id,weeks:4})});
      if(!res.ok){const d=await res.json().catch(()=>({}));throw new Error(d?.message??`Error ${res.status}`);}
      const data=await res.json() as {program:Program};
      setFlowProgram(data.program);
      const fresh=await refreshClients();
      const updFc=fresh.find(c=>c.id===flowClient.id);
      if(updFc)setFlowClient(updFc);
      setCoachStep(3);
    }catch(e){setError(e instanceof Error?e.message:"Error")}finally{setLoading(false);}
  }

  async function handleSetPin(){
    if(!flowClient)return;
    const pin=clientPin.trim();
    if(!/^\d{4,8}$/.test(pin)){setError("El PIN debe tener 4-8 dígitos numéricos.");return;}
    try{
      await apiFetch(`/usuario/${flowClient.id}/pin`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({pin})});
      setPinSaved(true);setTimeout(()=>setPinSaved(false),3000);setError(null);
    }catch(e){setError(e instanceof Error?e.message:"Error al guardar PIN");}
  }

  async function saveProgress(){
    if(!selectedClient?.program)return;
    setLoading(true);setError(null);
    try{
      const res=await apiFetch(`/usuario/${selectedClient.id}/progreso`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({weekNumber:progressWeek,completedSessions:Math.max(0,Math.min(selectedClient.daysPerWeek,completedSessions)),notes:progressNotes.trim()})});
      if(!res.ok){const d=await res.json().catch(()=>({}));throw new Error(d?.message??`Error ${res.status}`);}
      await refreshClients();setProgressNotes("");
    }catch(e){setError(e instanceof Error?e.message:"Error")}finally{setLoading(false);}
  }

  async function login(){
    setError(null);
    try{
      if(authRole==="coach"){
        const res=await apiFetch("/auth/coach/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:loginEmail.trim().toLowerCase(),password:loginPassword})},true);
        const d=await res.json().catch(()=>({})) as Record<string,unknown>;
        if(res.status===429){setLoginLockedUntil((d.lockedUntil as number)??null);setError(d.message as string??"Cuenta bloqueada temporalmente.");return;}
        if(!res.ok){
          if(d.twoFactorRequired){setTwoFactorPending(true);setTwoFactorMaskedEmail(d.maskedEmail as string??"");setError(d.message as string??"Código enviado a tu correo.");return;}
          throw new Error(d.message as string??"Credenciales inválidas.");
        }
        setAuthSession({...(d.session as {role:AuthRole;name:string;clientId?:string}),token:d.token as string});return;
      }
      const id=loginIdentifier.trim();
      if(!id){setError("Ingresa tu correo, nombre o ID.");return;}
      if(!loginPin){setError("Ingresa tu PIN de acceso.");return;}
      const res=await apiFetch("/auth/usuario/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({identifier:id,pin:loginPin})},true);
      const d=await res.json().catch(()=>({})) as Record<string,unknown>;
      if(res.status===429){setLoginLockedUntil((d.lockedUntil as number)??null);setError(d.message as string??"Demasiados intentos. Espera 15 minutos.");return;}
      if(!res.ok){throw new Error(d.message as string??"No se pudo iniciar sesión.");}
      setSelectedClientId((d.session as {clientId?:string}).clientId??"");setAuthSession({...(d.session as {role:AuthRole;name:string;clientId?:string}),token:d.token as string});
    }catch(e){setError(e instanceof Error?e.message:"Error");}
  }

  async function verifyTwoFactor(){
    if(!twoFactorCode.trim()){setError("Ingresa el código.");return;}
    setError(null);
    try{
      const res=await apiFetch("/auth/coach/verify-2fa",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:loginEmail.trim().toLowerCase(),code:twoFactorCode.trim()})},true);
      const d=await res.json().catch(()=>({})) as Record<string,unknown>;
      if(res.status===429){setLoginLockedUntil((d.lockedUntil as number)??null);setError("Cuenta bloqueada. Espera 30 minutos.");return;}
      if(!res.ok){throw new Error(d.message as string??"Código incorrecto o expirado.");}
      setTwoFactorPending(false);setTwoFactorCode("");
      setAuthSession({...(d.session as {role:AuthRole;name:string;clientId?:string}),token:d.token as string});
    }catch(e){setError(e instanceof Error?e.message:"Error");}
  }

  async function resendTwoFactorCode(){
    setError(null);
    await apiFetch("/auth/coach/resend-2fa",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:loginEmail.trim().toLowerCase()})},true);
    setError("Código reenviado a tu correo.");
  }


  async function openSwap(weekNumber:number, dayIndex:number, sel:Selection, routineId:string, clientLevel:Level, clientLocation:TrainingLocation){
    setSwapTarget({weekNumber,dayIndex,sel,routineId});
    setSwapOptions([]);
    setSwapLoading(true);
    try{
      const ref=encodeURIComponent(sel.exercise.id??sel.exercise.name);
      const res=await apiFetch(`/exercise-alternatives?exerciseRef=${ref}&level=${clientLevel}&trainingLocation=${clientLocation}`);
      if(res.ok){const d=await res.json() as {alternatives:LibraryExercise[]};setSwapOptions(d.alternatives??[]);}
    }catch{}finally{setSwapLoading(false);}
  }

  async function applySwap(newExerciseId:string){
    if(!swapTarget||!swapTarget.routineId)return;
    setSwapSaving(true);
    setError(null);
    try{
      // Buscar el programa del cliente — puede estar en clients[] o en el portal
      const portalC=clients.find(c=>c.routineId===swapTarget.routineId)
                  ??clients.find(c=>c.id===portalClientId);
      const weeks=portalC?.program?.weeks??[];
      if(!weeks.length){setError("No se encontró la rutina.");return;}

      const oldRef=swapTarget.sel.exercise.id??swapTarget.sel.exercise.name;

      let changed=false;
      for(const week of weeks){
        const day=week.days.find(d=>d.dayIndex===swapTarget.dayIndex);
        if(!day)continue;
        const has=day.selections.some(s=>(s.exercise.id&&s.exercise.id===swapTarget.sel.exercise.id)||s.exercise.name===swapTarget.sel.exercise.name);
        if(!has)continue;
        const res=await apiFetch(`/routine/${swapTarget.routineId}/week/${week.weekNumber}/day/${swapTarget.dayIndex}`,{
          method:"PATCH",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({action:"replace",oldExerciseId:oldRef,newExerciseId}),
        });
        if(!res.ok){const d=await res.json().catch(()=>({})) as {message?:string};throw new Error(d.message??`Error ${res.status}`);}
        changed=true;
      }
      if(changed)await refreshClients();
      setSwapTarget(null);setSwapOptions([]);
    }catch(e){setError(e instanceof Error?e.message:"Error al cambiar ejercicio.");}
    finally{setSwapSaving(false);}
  }

  function logout(){setAuthSession(null);setLoginPassword("");setLoginEmail("");setLoginIdentifier("");setLoginPin("");setActiveTab("coach");resetWizard();}
  function resetWizard(){setCoachStep(1);setFlowClient(null);setFlowProgram(null);setUseExisting(false);setNewClientName("");setGoal("glute_hypertrophy");setLevel("intermediate");setDays(4);setClientPin("");setGeneratedPin("");setPinSaved(false);setError(null);setDuplicateWarning(null);setWizGoal("glute_hypertrophy");setWizFocusMuscle(null);setWizGender("unspecified");setWizSessionDuration(60);setWizTrainingLocation("gym");setWizWeak([]);setWizPatterns([]);setWizSeverity("mild");setWizLimitDesc("");}
  function copyPin(p:string){navigator.clipboard.writeText(p).then(()=>{setCopiedPin(true);setTimeout(()=>setCopiedPin(false),2500);});}

  const visibleTabs=[{id:"coach" as Tab,label:"Coach Studio"},{id:"clients" as Tab,label:"Clientes"},{id:"portal" as Tab,label:"Portal"}];
  const navTabs=authSession?.role==="coach"?visibleTabs:visibleTabs.filter(t=>t.id==="portal");

  /* ===================================================================
     LOGIN SCREEN
     =================================================================== */
  if(!authSession) return (
    <div className="flex min-h-screen flex-wrap bg-[#f4f1ea]">
      <div className="relative flex min-h-[260px] flex-1 basis-[420px] flex-col justify-between overflow-hidden bg-[#14110d] p-10 text-[#f4f1ea] sm:p-12">
        <div className="pointer-events-none absolute inset-0" style={{background:"radial-gradient(circle at 80% 8%, rgba(168,125,73,0.22), transparent 42%)"}}/>
        <span className="relative text-[11px] uppercase tracking-[0.34em] text-[#b7ad9d]">LB Method</span>
        <div className="relative flex flex-col items-start gap-6">
          <img src={lbMethodLogo} alt="LB Method" className="w-32 rounded-2xl object-cover sm:w-36"/>
          <h1 className="font-display max-w-[12ch] text-4xl font-medium leading-[1.04] tracking-tight sm:text-5xl">Entrena con método. Progresa con datos.</h1>
          <p className="max-w-[34ch] text-sm leading-relaxed text-[#b7ad9d]">Programación inteligente de entrenamiento con seguimiento real.</p>
        </div>
        <p className="relative text-[11px] tracking-wide text-[#6f685c]">Programación · Seguimiento · Resultados</p>
      </div>

      <div className="flex flex-1 basis-[420px] items-center justify-center px-6 py-10 sm:px-8">
        <div className="lb-enter w-full max-w-[392px]">
          <h2 className="font-display text-[34px] font-semibold tracking-tight text-[#17120d]">Inicio de sesión</h2>
          <p className="mt-2 text-sm text-[#8c8377]">Bienvenida de vuelta.</p>

          {/* Pantalla 2FA */}
          {twoFactorPending && (
            <div className="mt-6">
              <div className="rounded-2xl border border-[#e7e1d6] bg-[#faf8f4] p-5 text-center">
                <div className="text-3xl">🔐</div>
                <h3 className="mt-2 font-display text-[18px] font-semibold">Verificación de identidad</h3>
                <p className="mt-1 text-[13px] text-[#8c8377]">Se envió un código de 6 dígitos a <strong>{twoFactorMaskedEmail || "tu correo"}</strong>. Revisa tu bandeja de entrada.</p>
              </div>
              <div className="mt-4">
                <label className="block"><span className={labelCls}>Código de verificación</span>
                  <input
                    autoFocus
                    className={`${inputCls} text-center font-mono text-2xl tracking-[0.3em]`}
                    placeholder="000000"
                    maxLength={6}
                    value={twoFactorCode}
                    onChange={e=>setTwoFactorCode(e.target.value.replace(/\D/g,""))}
                    onKeyDown={e=>e.key==="Enter"&&verifyTwoFactor()}
                  />
                </label>
              </div>
              {error && <p className="mt-3 rounded-xl bg-[#f7ece6] p-2.5 text-sm text-[#9a4b34]">{error}</p>}
              <button onClick={verifyTwoFactor} className={`mt-4 w-full py-3.5 ${primaryBtn}`}>Verificar código</button>
              <div className="mt-3 flex items-center justify-between">
                <button onClick={()=>{setTwoFactorPending(false);setTwoFactorCode("");setError(null);}} className="text-[12px] text-[#a39a8d] hover:text-[#17120d]">← Volver</button>
                <button onClick={resendTwoFactorCode} className="text-[12px] text-[#a87d49] hover:underline">Reenviar código</button>
              </div>
            </div>
          )}

          {/* Bloqueo temporal */}
          {!twoFactorPending && loginLockedUntil && (
            <div className="mt-6 rounded-2xl border border-[#e7e1d6] bg-[#faf8f4] p-5 text-center">
              <div className="text-3xl">🔒</div>
              <h3 className="mt-2 font-display text-[18px] font-semibold">Acceso bloqueado</h3>
              <p className="mt-1 text-[13px] text-[#8c8377]">Demasiados intentos fallidos. Vuelve a intentarlo después de las <strong>{new Date(loginLockedUntil).toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"})}</strong>.</p>
              <button onClick={()=>setLoginLockedUntil(null)} className={`mt-4 px-5 py-2 text-sm ${ghostBtn}`}>Reintentar</button>
            </div>
          )}

          {/* Formulario coach (default) */}
          {!twoFactorPending && !loginLockedUntil && authRole==="coach" && (
            <div className="mt-5 space-y-3">
              <label className="block"><span className={labelCls}>Correo electrónico</span>
                <input className={inputCls} placeholder="correo@ejemplo.com" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()}/>
              </label>
              <label className="block"><span className={labelCls}>Contraseña</span>
                <input className={inputCls} type="password" placeholder="••••••••" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()}/>
              </label>
            </div>
          )}

          {/* Formulario cliente (PIN) */}
          {!twoFactorPending && !loginLockedUntil && authRole==="client" && (
            <div className="mt-5 space-y-4">
              <label className="block">
                <span className={labelCls}>Correo, nombre o ID</span>
                <input className={inputCls} type="text" autoComplete="username"
                  placeholder="Ej. maria@correo.com  o  María García"
                  value={loginIdentifier} onChange={e=>setLoginIdentifier(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()}/>
                <span className="mt-1 block text-[11px] text-[#b3aa9b]">Usa el dato que te compartió tu coach.</span>
              </label>
              <label className="block">
                <span className={labelCls}>PIN de acceso</span>
                <input className={`${inputCls} font-mono tracking-[0.12em]`} type="password" autoComplete="current-password"
                  maxLength={12} placeholder="••••••••"
                  value={loginPin} onChange={e=>setLoginPin(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()}/>
              </label>
            </div>
          )}

          {!twoFactorPending && error && <p className="mt-3 rounded-xl bg-[#f7ece6] p-2.5 text-sm text-[#9a4b34]">{error}</p>}
          {!twoFactorPending && !loginLockedUntil && (
            <button onClick={login} className={`mt-5 w-full py-3.5 ${primaryBtn}`}>Iniciar sesión</button>
          )}

          {/* Cambio de modo — discreto */}
          {!twoFactorPending && !loginLockedUntil && (
            <p className="mt-5 text-center text-[12px] text-[#a39a8d]">
              {authRole==="coach"
                ? <><span>¿Eres cliente? </span><button onClick={()=>{setAuthRole("client");setError(null);setLoginLockedUntil(null);}} className="text-[#a87d49] hover:underline">Entra con tu PIN</button></>
                : <button onClick={()=>{setAuthRole("coach");setError(null);setLoginLockedUntil(null);}} className="text-[#a87d49] hover:underline">← Volver</button>
              }
            </p>
          )}
        </div>
      </div>
    </div>
  );

  /* ===================================================================
     APP
     =================================================================== */
  const pgTitle = activeTab==="coach"?"Flujo de alta":activeTab==="clients"?"Tus clientes":"Mi entrenamiento";
  const pgSub = activeTab==="coach"?"Agrega cliente, genera rutina y dale acceso.":activeTab==="clients"?"Seguimiento de adherencia y avance.":"Tu rutina y registro de progreso.";
  const sessionInitials = authSession.role==="coach"?"BL":initials(authSession.name);

  return (
    <div className="flex min-h-screen items-stretch bg-[#f4f1ea] text-[#17120d]">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[248px] flex-none flex-col bg-[#17120d] p-6 text-[#f4f1ea] md:flex">
        <div className="flex items-center gap-3">
          <img src={lbMethodLogo} alt="" className="h-11 w-11 flex-none rounded-xl object-cover"/>
          <div><div className="font-display text-xl font-semibold leading-none">LB Method</div><div className="mt-0.5 text-[9.5px] uppercase tracking-[0.22em] text-[#9a9186]">Coaching Studio</div></div>
        </div>
        <nav className="mt-9 flex flex-col gap-1">
          {navTabs.map(tab=>{const a=activeTab===tab.id;return(
            <button key={tab.id} onClick={()=>setActiveTab(tab.id)} className={`flex items-center gap-3 rounded-[10px] px-3.5 py-3 text-left text-sm transition ${a?"bg-white/[0.07] font-semibold text-[#f4f1ea]":"font-medium text-[#9a9186] hover:text-[#f4f1ea]"}`}>
              <span className="h-[15px] w-[3px] flex-none rounded-full" style={{background:a?"#a87d49":"transparent"}}/>
              {tab.label}
            </button>
          );})}
        </nav>
        <div className="mt-auto flex flex-col gap-3">
          <div className="rounded-2xl border border-white/10 p-3.5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#a87d49] text-[13px] font-semibold text-white">{sessionInitials}</span>
              <div className="min-w-0"><div className="truncate text-[13px] font-semibold">{authSession.name}</div><div className="text-[10.5px] text-[#9a9186]">{authSession.role==="coach"?"Head Coach":"Clienta"}</div></div>
            </div>
          </div>
          <button onClick={logout} className="rounded-[10px] px-3.5 py-2.5 text-left text-[12.5px] font-medium text-[#9a9186] transition hover:text-[#f4f1ea]">Cerrar sesión</button>
        </div>
      </aside>

      {/* Main */}
      <main className="min-w-0 flex-1 px-5 py-7 sm:px-8 lg:px-10 lg:py-9">
        {/* Mobile top bar */}
        <div className="mb-6 flex items-center justify-between gap-3 md:hidden">
          <div className="flex items-center gap-2.5"><img src={lbMethodLogo} alt="" className="h-9 w-9 rounded-lg object-cover"/><span className="font-display text-lg font-semibold">LB Method</span></div>
          <button onClick={logout} className="text-[12.5px] font-medium text-[#8c8377]">Salir</button>
        </div>
        <div className="mb-6 flex flex-wrap gap-1.5 md:hidden">
          {navTabs.map(t=><button key={t.id} onClick={()=>setActiveTab(t.id)} className={`rounded-full px-4 py-2 text-[13px] font-semibold transition ${activeTab===t.id?"bg-[#17120d] text-white":"bg-[#ece6db] text-[#8c8377]"}`}>{t.label}</button>)}
        </div>

        <header className="mb-7">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a87d49]">{activeTab==="coach"?"Coach Studio":activeTab==="clients"?"Gestión":"Portal"}</div>
          <h1 className="font-display mt-1.5 text-[34px] font-semibold tracking-tight sm:text-[38px]">{pgTitle}</h1>
          <p className="mt-1.5 text-[13.5px] text-[#8c8377]">{pgSub}</p>
        </header>

        {/* ========== COACH STUDIO ========== */}
        {authSession.role==="coach" && activeTab==="coach" && (
          <section className="flex flex-col gap-6">
            {/* Stepper */}
            <div className="flex items-center gap-0 overflow-x-auto rounded-2xl border border-[#e7e1d6] bg-white p-1">
              {([1,2,3,4] as CoachStep[]).map((step,i)=>{const done=coachStep>step;const active=coachStep===step;return(
                <div key={step} className="flex flex-1 items-center">
                  <button onClick={()=>done&&setCoachStep(step)} disabled={!done} className={`flex flex-1 flex-col items-center gap-1 rounded-xl px-3 py-3 text-center transition ${active?"bg-[#17120d] text-white":done?"cursor-pointer text-[#a87d49] hover:bg-[#faf6ef]":"cursor-default text-[#c2b9aa]"}`}>
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${active?"bg-[#a87d49] text-white":done?"bg-[#f0e7d8] text-[#8f6a3c]":"bg-[#ece6db] text-[#b3aa9b]"}`}>{done?"✓":step}</span>
                    <span className="text-[11px] font-semibold leading-tight">{STEP_LABELS[step]}</span>
                  </button>
                  {i<3&&<span className="mx-1 flex-none text-[#ddd5c5]">›</span>}
                </div>
              );})}
            </div>

            {/* Paso 1 */}
            {coachStep===1 && (
              <article className="rounded-[18px] border border-[#e7e1d6] bg-white p-6 sm:p-8">
                <h2 className="font-display text-[24px] font-semibold">① Agregar cliente</h2>
                <div className="mt-5 flex gap-1.5 rounded-2xl bg-[#ece6db] p-1.5">
                  <button onClick={()=>{setUseExisting(false);setError(null);setDuplicateWarning(null);}} className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${!useExisting?"bg-[#17120d] text-white":"text-[#8c8377]"}`}>Nueva persona</button>
                  <button onClick={()=>{setUseExisting(true);setError(null);setDuplicateWarning(null);}} className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${useExisting?"bg-[#17120d] text-white":"text-[#8c8377]"}`}>Cliente existente</button>
                </div>
                {!useExisting && (
                  <div className="mt-5 flex flex-col gap-3.5">
                    <label className="block"><span className={labelCls}>Nombre completo</span><input className={inputCls} placeholder="Ej. María García" value={newClientName} onChange={e=>{setNewClientName(e.target.value);setDuplicateWarning(null);}}/></label>
                    <div>
                      <span className={labelCls}>Género</span>
                      <div className="mt-1.5 flex gap-1.5 rounded-2xl bg-[#ece6db] p-1.5">
                        {(Object.entries(GENDER_LABELS) as [Gender,string][]).map(([val,label])=>(
                          <button key={val} onClick={()=>{setWizGender(val);if(!GOALS_BY_GENDER[val as Gender].includes(goal))setGoal(GOALS_BY_GENDER[val as Gender][0]);}} className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${wizGender===val?"bg-[#17120d] text-white":"text-[#8c8377]"}`}>{label}</button>
                        ))}
                      </div>
                    </div>
                    <label className="block"><span className={labelCls}>Objetivo</span>
                      <select className={inputCls} value={goal} onChange={e=>{
                        if(e.target.value==="__upper_body__"){
                          setGoal("muscle_gain");
                          setWizFocusMuscle("upper_body");
                        } else {
                          setGoal(e.target.value as Goal);
                        }
                      }}>
                        {GOALS_BY_GENDER[wizGender].map(g=><option key={g} value={g}>{GOAL_LABELS[g]}</option>)}
                        <option value="__upper_body__">Enfoque tren superior</option>
                      </select>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block"><span className={labelCls}>Nivel</span>
                        <select className={inputCls} value={experienceLevel} onChange={e=>setLevel(e.target.value as Level)}>
                          {(Object.keys(LEVEL_LABELS) as Level[]).map(l=><option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
                        </select>
                      </label>
                      <label className="block"><span className={labelCls}>Días/sem</span>
                        <select className={inputCls} value={daysPerWeek} onChange={e=>setDays(Number(e.target.value))}>
                          {[3,4,5,6].map(d=><option key={d} value={d}>{d} días</option>)}
                        </select>
                      </label>
                    </div>
                    
                    <div>
                      <span className={labelCls}>Duración por sesión</span>
                      <div className="mt-1.5 flex gap-1.5 rounded-2xl bg-[#ece6db] p-1.5">
                        {SESSION_DURATION_OPTIONS.map(({v,l})=>(
                          <button key={v} onClick={()=>setWizSessionDuration(v)} className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${wizSessionDuration===v?"bg-[#17120d] text-white":"text-[#8c8377]"}`}>{l}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className={labelCls}>Lugar de entrenamiento</span>
                      <div className="mt-1.5 flex gap-1.5 rounded-2xl bg-[#ece6db] p-1.5">
                        {([["gym","Gimnasio"],["home","En casa"]] as [TrainingLocation,string][]).map(([val,label])=>(
                          <button key={val} onClick={()=>setWizTrainingLocation(val)} className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${wizTrainingLocation===val?"bg-[#17120d] text-white":"text-[#8c8377]"}`}>{label}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {useExisting && (
                  <div className="mt-5">
                    <label className="block"><span className={labelCls}>Selecciona clienta</span>
                      <select className={inputCls} value={selectedClientId} onChange={e=>setSelectedClientId(e.target.value)}>
                        <option value="">— elige una clienta —</option>
                        {clients.map(c=><option key={c.id} value={c.id}>{c.name} · {GOAL_LABELS[c.goal]}</option>)}
                      </select>
                    </label>
                  </div>
                )}
                {error && <p className="mt-4 rounded-xl bg-[#f7ece6] p-3 text-sm text-[#9a4b34]">{error}</p>}

                {/* Advertencia de duplicado */}
                {duplicateWarning && !useExisting && (
                  <div className="mt-4 rounded-xl border border-[#d4a84b] bg-[#fdf8f0] p-4">
                    <p className="text-[13px] font-semibold text-[#8f6a3c]">Ya existe un cliente con ese nombre</p>
                    <p className="mt-1 text-[12px] text-[#a87d49]">
                      <strong>{duplicateWarning.name}</strong> · {GOAL_LABELS[duplicateWarning.goal]} · {LEVEL_LABELS[duplicateWarning.experienceLevel]}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={()=>{setFlowClient(duplicateWarning);setGoal(duplicateWarning.goal);setLevel(duplicateWarning.experienceLevel);setDays(duplicateWarning.daysPerWeek);setDuplicateWarning(null);setCoachStep(2);}}
                        className={`flex-1 py-2 text-[13px] ${primaryBtn}`}
                      >Usar cliente existente</button>
                      <button
                        onClick={()=>{setNewClientName("");setDuplicateWarning(null);}}
                        className={`flex-1 py-2 text-[13px] ${ghostBtn}`}
                      >Cambiar nombre</button>
                    </div>
                  </div>
                )}

                {!duplicateWarning && (
                  <button onClick={handleStep1} disabled={loading} className={`mt-6 w-full py-3.5 text-[15px] ${primaryBtn}`}>{loading?"Guardando…":"Continuar → Generar rutina"}</button>
                )}
              </article>
            )}

            {/* Paso 2 */}
            {coachStep===2 && flowClient && (
              <article className="rounded-[18px] border border-[#e7e1d6] bg-white p-6 sm:p-8">
                <h2 className="font-display text-[24px] font-semibold">② Personalizar y generar</h2>
                <p className="mt-1 text-[13px] text-[#8c8377]">El motor usará estos datos para crear una rutina a medida para {flowClient.name}.</p>

                {/* Género — toggle interactivo */}
                <div className="mt-5">
                  <span className={labelCls}>Género</span>
                  <div className="mt-1.5 flex gap-1.5 rounded-2xl bg-[#ece6db] p-1.5">
                    {(Object.entries(GENDER_LABELS) as [Gender,string][]).map(([val,label])=>(
                      <button key={val} onClick={()=>{
                        setWizGender(val);
                        // Resetear objetivo si no está disponible para el nuevo género
                        if(!GOALS_BY_GENDER[val].includes(wizGoal)) setWizGoal(GOALS_BY_GENDER[val][0]);
                      }} className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${wizGender===val?"bg-[#17120d] text-white":"text-[#8c8377]"}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Objetivo — selector filtrado por género */}
                <div className="mt-4">
                  <span className={labelCls}>Objetivo</span>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {GOALS_BY_GENDER[wizGender].map(g=>(
                      <button key={g} onClick={()=>{setWizGoal(g);if(wizFocusMuscle==="upper_body")setWizFocusMuscle(null);}}
                        className={`rounded-xl border px-3.5 py-2.5 text-left transition ${wizGoal===g&&wizFocusMuscle!=="upper_body"?"border-[#a87d49] bg-[#fdf8f0]":"border-[#e0d9cc] bg-white hover:border-[#c2b9aa]"}`}>
                        <div className={`text-[13px] font-semibold ${wizGoal===g&&wizFocusMuscle!=="upper_body"?"text-[#a87d49]":"text-[#28231c]"}`}>{wizGoal===g&&wizFocusMuscle!=="upper_body"?"✓ ":""}{GOAL_LABELS[g]}</div>
                        {GOAL_DESCRIPTIONS[g] && <div className="mt-0.5 text-[10.5px] text-[#8c8377] max-w-[200px]">{GOAL_DESCRIPTIONS[g]}</div>}
                      </button>
                    ))}
                    {/* Enfoque tren superior — opción especial */}
                    <button onClick={()=>{setWizGoal("muscle_gain");setWizFocusMuscle("upper_body");}}
                      className={`rounded-xl border px-3.5 py-2.5 text-left transition ${wizFocusMuscle==="upper_body"?"border-[#a87d49] bg-[#fdf8f0]":"border-[#e0d9cc] bg-white hover:border-[#c2b9aa]"}`}>
                      <div className={`text-[13px] font-semibold ${wizFocusMuscle==="upper_body"?"text-[#a87d49]":"text-[#28231c]"}`}>{wizFocusMuscle==="upper_body"?"✓ ":""}Enfoque tren superior</div>
                      <div className="mt-0.5 text-[10.5px] text-[#8c8377] max-w-[200px]">Pecho, espalda y hombros como prioridad.</div>
                    </button>
                  </div>
                </div>

                {/* Info de sesión — tarjetas pequeñas no editables aquí */}
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {[
                    {l:"Nivel",v:LEVEL_LABELS[flowClient.experienceLevel]},
                    {l:"Días/sem",v:`${flowClient.daysPerWeek} días`},
                    {l:"Sesión",v:`${wizSessionDuration} min`},
                    {l:"Lugar",v:wizTrainingLocation==="home"?"En casa":"Gimnasio"},
                  ].map(({l,v})=>(
                    <div key={l} className={`rounded-[13px] border p-3 text-center ${l==="Lugar"&&wizTrainingLocation==="home"?"border-[#a87d49] bg-[#fdf8f0]":"border-[#eee7da] bg-[#faf8f4]"}`}>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#9a9186]">{l}</div>
                      <div className="mt-1 text-[13px] font-semibold">{v}</div>
                    </div>
                  ))}
                </div>
                {wizTrainingLocation==="home" && (
                  <p className="mt-3 rounded-xl border border-[#e0d9cc] bg-[#faf8f4] px-3 py-2 text-[11px] text-[#8c8377]">
                    Entreno en casa: ejercicios de peso libre. Sin máquinas ni poleas.
                  </p>
                )}

                {/* Músculo en enfoque */}
                <div className="mt-6">
                  <span className={labelCls}>¿En qué músculo quieres enfocarte? <span className="normal-case font-normal text-[#b3aa9b]">(opcional)</span></span>
                  <p className="mb-3 text-[11px] text-[#a39a8d]">El motor adaptará volumen, selección de ejercicios y accesorios para priorizar ese músculo.</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {ALL_FOCUS_OPTIONS.map(opt=>{
                      const active=wizFocusMuscle===opt.key;
                      return(
                        <button key={opt.key} onClick={()=>{
                          if(active){setWizFocusMuscle(null);}
                          else{
                            setWizFocusMuscle(opt.key);
                            if(!GOALS_BY_GENDER[wizGender].includes(wizGoal)||wizGoal===GOALS_BY_GENDER[wizGender][0])
                              setWizGoal(opt.suggestGoal);
                          }
                        }}
                          className={`rounded-xl border p-3 text-left transition ${active?"border-[#a87d49] bg-[#fdf8f0]":"border-[#e0d9cc] bg-white hover:border-[#c2b9aa]"}`}>
                          <div className={`text-[13px] font-semibold ${active?"text-[#a87d49]":"text-[#28231c]"}`}>{active?"✓ ":""}{opt.label}</div>
                          {opt.desc && <div className="mt-0.5 text-[10.5px] text-[#8c8377] leading-snug">{opt.desc}</div>}
                        </button>
                      );
                    })}
                  </div>
                  {wizFocusMuscle && (
                    <p className="mt-2 text-[11px] text-[#a87d49]">El objetivo se ajustará a <strong>{GOAL_LABELS[wizGoal]}</strong> para complementar el enfoque en {ALL_FOCUS_OPTIONS.find(f=>f.key===wizFocusMuscle)?.label}.</p>
                  )}
                </div>

                {/* Lesiones / Restricciones */}
                <div className="mt-6">
                  <span className={labelCls}>Lesiones / restricciones de movimiento <span className="normal-case font-normal text-[#b3aa9b]">(opcional)</span></span>
                  <p className="mb-3 text-[11px] text-[#a39a8d]">Los patrones marcados serán excluidos de la selección de ejercicios.</p>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(PATTERN_LABELS) as MovementPattern[]).map(p=>{
                      const active=wizPatterns.includes(p);
                      return(
                        <button key={p}
                          onClick={()=>setWizPatterns(prev=>prev.includes(p)?prev.filter(x=>x!==p):[...prev,p])}
                          className={`rounded-xl border px-3 py-2 text-[12px] font-semibold transition ${active?"border-[#9a4b34] bg-[#f7ece6] text-[#9a4b34]":"border-[#e0d9cc] text-[#5a5044] hover:border-[#c2b9aa]"}`}
                        >{active?"✕ ":""}{PATTERN_LABELS[p]}</button>
                      );
                    })}
                  </div>
                  {wizPatterns.length>0 && (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <label className="block">
                        <span className={labelCls}>Gravedad</span>
                        <select className={inputCls} value={wizSeverity} onChange={e=>setWizSeverity(e.target.value as LimitationSeverity)}>
                          {(Object.entries(SEVERITY_LABELS) as [LimitationSeverity,string][]).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                        </select>
                      </label>
                      <label className="block">
                        <span className={labelCls}>Descripción <span className="normal-case font-normal text-[#b3aa9b]">(opcional)</span></span>
                        <input className={inputCls} placeholder="Ej. Dolor lumbar, rodilla derecha…" value={wizLimitDesc} onChange={e=>setWizLimitDesc(e.target.value)}/>
                      </label>
                    </div>
                  )}
                </div>

                {error && <p className="mt-4 rounded-xl bg-[#f7ece6] p-3 text-sm text-[#9a4b34]">{error}</p>}
                <div className="mt-6 flex gap-3">
                  <button onClick={()=>setCoachStep(1)} className={`px-5 py-3.5 text-sm ${ghostBtn}`}>← Atrás</button>
                  <button onClick={handleStep2} disabled={loading} className={`flex-1 py-3.5 text-[15px] ${primaryBtn}`}>{loading?"Generando…":"Generar rutina · 4 semanas"}</button>
                </div>
              </article>
            )}

            {/* Paso 3 */}
            {coachStep===3 && flowClient && flowProgram && (
              <div className="flex flex-col gap-5">
                <article className="rounded-[18px] border border-[#e7e1d6] bg-white p-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div><h2 className="font-display text-[24px] font-semibold">③ Descargar rutina</h2>
                      <p className="mt-1 text-[13px] text-[#8c8377]">Programa de 4 semanas para {flowClient.name}.</p>
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      {!editingRoutine && (
                        <button onClick={enterFlowEditMode} className={`flex items-center gap-2 px-5 py-3 text-sm ${ghostBtn}`}>✏ Editar rutina</button>
                      )}
                      <button onClick={()=>downloadPdf(flowClient,flowProgram)} className={`flex items-center gap-2 px-5 py-3 text-sm ${darkBtn}`}>↓ Descargar PDF</button>
                      <button onClick={()=>window.print()} className={`px-5 py-3 text-sm ${ghostBtn}`}>Imprimir</button>
                    </div>
                  </div>
                </article>

                {/* Editor de rutina */}
                {editingRoutine && (
                  <article className="rounded-[18px] border-2 border-[#a87d49] bg-white p-6">
                    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-display text-[20px] font-semibold text-[#17120d]">Editar rutina</h3>
                        <p className="mt-0.5 text-[12px] text-[#8c8377]">Cambia ejercicios, series, reps y RIR. Los cambios se guardan al presionar el botón.</p>
                      </div>
                      <div className="flex items-center gap-2.5">
                        {editError && <p className="text-[12px] text-[#9a4b34]">{editError}</p>}
                        <button onClick={exitEditMode} className={`px-4 py-2 text-sm ${ghostBtn}`}>Cancelar</button>
                        <button onClick={saveAllFlowDays} disabled={!!savingDay} className={`px-5 py-2 text-sm ${primaryBtn}`}>
                          {savingDay?"Guardando…":"✓ Guardar cambios"}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-6">
                      {flowProgram.weeks.map(week=>(
                        <div key={week.weekNumber}>
                          <div className="mb-3 flex items-center gap-3">
                            <span className="rounded-full bg-[#17120d] px-3 py-1 text-[11px] font-bold text-white">Semana {week.weekNumber}{week.deload?" · Deload":""}</span>
                            <span className="text-[11px] text-[#a39a8d]">RIR {week.rir}</span>
                          </div>
                          <div className="flex flex-col gap-4">
                            {week.days.map(day=>{
                              const key=`${week.weekNumber}-${day.dayIndex}`;
                              const dayState=dayEdits[key];
                              if(!dayState)return null;
                              return (
                                <div key={key} className={`rounded-2xl border p-4 transition ${dayState.isDirty?"border-[#a87d49] bg-[#fffbf5]":"border-[#e7e1d6] bg-[#fafaf9]"}`}>
                                  <div className="mb-3 flex items-center gap-2">
                                    <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#a87d49]">Día {day.dayIndex+1}</span>
                                    <span className="text-[13px] font-semibold capitalize text-[#3a342c]">{FOCUS_LABELS[day.focus]??day.focus.replace(/_/g," ")}</span>
                                    {dayState.isDirty && <span className="rounded-full bg-[#a87d49] px-2 py-0.5 text-[9px] font-bold text-white">CAMBIOS</span>}
                                  </div>
                                  <div className="mb-1.5 grid grid-cols-[120px_1fr_50px_60px_60px_48px_32px] gap-1.5 px-1 text-[9.5px] font-semibold uppercase tracking-[0.07em] text-[#a39a8d]">
                                    <span>Rol</span><span>Ejercicio</span><span>Series</span><span>Rep mín</span><span>Rep máx</span><span>RIR</span><span></span>
                                  </div>
                                  <div className="flex flex-col gap-1.5">
                                    {dayState.exercises.map((ex,idx)=>(
                                      <div key={ex.uid}>
                                        <div className="grid grid-cols-[120px_1fr_50px_60px_60px_48px_32px] items-center gap-1.5">
                                          <select value={ex.role} onChange={e=>updateDayExercise(key,idx,"role",e.target.value)} className="rounded-lg border border-[#e0d9cc] bg-white px-2 py-1.5 text-[11px] font-semibold focus:border-[#a87d49] focus:outline-none">
                                            <option value="main">Principal</option>
                                            <option value="unilateral">Unilateral</option>
                                            <option value="isolation">Aislamiento</option>
                                            <option value="accessory">Accesorio</option>
                                          </select>
                                          <select value={ex.exerciseId} onChange={e=>changeExercise(key,idx,e.target.value)} className="rounded-lg border border-[#e0d9cc] bg-white px-2 py-1.5 text-[12px] focus:border-[#a87d49] focus:outline-none truncate">
                                            <option value="__new__">➕ Crear ejercicio…</option>
                                            {exerciseLibrary.map(lib=>(
                                              <option key={lib.id} value={lib.id}>{tx(lib.name)} ({lib.muscleGroup})</option>
                                            ))}
                                          </select>
                                          <input type="number" min={1} max={10} value={ex.sets} onChange={e=>updateDayExercise(key,idx,"sets",Number(e.target.value))} className="rounded-lg border border-[#e0d9cc] bg-white p-1.5 text-center text-[13px] font-semibold focus:border-[#a87d49] focus:outline-none"/>
                                          <input type="number" min={1} max={50} value={ex.repsMin} onChange={e=>updateDayExercise(key,idx,"repsMin",Number(e.target.value))} className="rounded-lg border border-[#e0d9cc] bg-white p-1.5 text-center text-[13px] focus:border-[#a87d49] focus:outline-none"/>
                                          <input type="number" min={1} max={50} value={ex.repsMax} onChange={e=>updateDayExercise(key,idx,"repsMax",Number(e.target.value))} className="rounded-lg border border-[#e0d9cc] bg-white p-1.5 text-center text-[13px] focus:border-[#a87d49] focus:outline-none"/>
                                          <input type="number" min={0} max={5} value={ex.rir} onChange={e=>updateDayExercise(key,idx,"rir",Number(e.target.value))} className="rounded-lg border border-[#e0d9cc] bg-white p-1.5 text-center text-[13px] focus:border-[#a87d49] focus:outline-none"/>
                                          <button onClick={()=>removeDayExercise(key,idx)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#c2b9aa] transition hover:bg-[#fde8e8] hover:text-[#a62020]" title="Eliminar">✕</button>
                                        </div>
                                        {creatingExercise?.key===key && creatingExercise?.idx===idx && (
                                          <div className="mt-1 flex items-center gap-2 rounded-xl border border-[#a87d49] bg-[#fffbf5] px-3 py-2">
                                            <input autoFocus type="text" placeholder="Nombre del ejercicio"
                                              value={creatingExercise.name}
                                              onChange={e=>setCreatingExercise(p=>p?{...p,name:e.target.value}:null)}
                                              onKeyDown={e=>{if(e.key==="Enter")confirmCreateExercise();if(e.key==="Escape")setCreatingExercise(null);}}
                                              className="min-w-0 flex-1 rounded-lg border border-[#e0d9cc] bg-white px-2 py-1.5 text-[12px] focus:border-[#a87d49] focus:outline-none"
                                            />
                                            <select value={creatingExercise.muscleGroup}
                                              onChange={e=>setCreatingExercise(p=>p?{...p,muscleGroup:e.target.value}:null)}
                                              className="rounded-lg border border-[#e0d9cc] bg-white px-2 py-1.5 text-[11px] focus:border-[#a87d49] focus:outline-none"
                                            >
                                              <option>Glúteo</option><option>Cuádriceps</option><option>Isquiotibiales</option>
                                              <option>Espalda</option><option>Pecho</option><option>Hombros</option>
                                              <option>Core</option><option>Otro</option>
                                            </select>
                                            <button onClick={confirmCreateExercise} className={`flex-none px-3 py-1.5 text-[12px] ${primaryBtn}`}>Agregar</button>
                                            <button onClick={()=>setCreatingExercise(null)} className={`flex-none px-2 py-1.5 text-[12px] ${ghostBtn}`}>✕</button>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                  <button onClick={()=>addDayExercise(key)} className="mt-3 flex items-center gap-1.5 rounded-xl border border-dashed border-[#d8cdb8] px-3 py-2 text-[12px] font-semibold text-[#8c8377] transition hover:border-[#a87d49] hover:text-[#a87d49]">
                                    + Agregar ejercicio
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                )}

                <ProgramView program={flowProgram} onShowExercise={setExerciseModal} gifMap={gifMap}/>
                <div className="flex gap-3">
                  <button onClick={()=>setCoachStep(2)} className={`px-5 py-3.5 text-sm ${ghostBtn}`}>← Regenerar</button>
                  <button onClick={()=>setCoachStep(4)} className={`flex-1 py-3.5 text-[15px] ${primaryBtn}`}>Continuar → Acceso cliente</button>
                </div>
              </div>
            )}

            {/* Paso 4 */}
            {coachStep===4 && flowClient && (
              <article className="rounded-[18px] border border-[#e7e1d6] bg-white p-6 sm:p-8">
                {/* Cabecera */}
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-[#17120d] text-xl font-bold text-white">{initials(flowClient.name)}</div>
                  <div>
                    <h2 className="font-display text-[24px] font-semibold">④ Acceso cliente listo</h2>
                    <p className="mt-0.5 text-[13px] text-[#8c8377]">{flowClient.name} ya tiene perfil y rutina. Comparte el PIN con ella.</p>
                  </div>
                </div>

                {/* PIN — muestra el existente o el recién generado */}
                {(()=>{
                  const displayPin = generatedPin || clientPin || flowClient.pin;
                  const isNew = !!(generatedPin || clientPin);
                  return (
                    <div className="mt-6 rounded-2xl bg-[#17120d] p-6 text-center text-[#f4f1ea]">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#a87d49]">
                        {isNew ? "PIN generado automáticamente" : "PIN de acceso actual"}
                      </div>
                      <div className="mt-3 font-mono text-[42px] font-bold tracking-[0.18em] leading-none">
                        {displayPin ?? "——"}
                      </div>
                      <p className="mt-2 text-[11px] text-[#9a9186]">Comparte este PIN con {flowClient.name} para que pueda entrar a la app.</p>
                      {displayPin && (
                        <button
                          onClick={()=>copyPin(displayPin)}
                          className={`mt-4 rounded-xl px-6 py-2.5 text-sm font-semibold transition ${copiedPin?"bg-[#4caf50] text-white":"bg-white/10 text-white hover:bg-white/20"}`}
                        >
                          {copiedPin ? "✓ PIN copiado" : "Copiar PIN"}
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* Datos de acceso */}
                <div className="mt-5 rounded-2xl bg-[#faf8f4] border border-[#eee7da] p-5 space-y-4">
                  <div>
                    <div className={labelCls}>Nombre / identificador de acceso</div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 rounded-xl border border-[#e0d9cc] bg-white px-4 py-2.5 text-[13px] font-medium break-all">
                        {flowClient.name}
                      </code>
                      <button
                        onClick={()=>navigator.clipboard.writeText(flowClient.name)}
                        className="flex-none rounded-xl border border-[#e0d9cc] px-3 py-2.5 text-[12px] font-semibold text-[#8c8377] hover:border-[#a87d49] hover:text-[#a87d49] transition"
                      >
                        Copiar
                      </button>
                    </div>
                    <p className="mt-1.5 text-[11px] text-[#b3aa9b]">
                      La clienta puede usar su nombre, correo o ID para iniciar sesión.
                    </p>
                  </div>
                </div>

                {/* Cambiar PIN manualmente */}
                <details className="mt-4 rounded-2xl border border-[#e7e1d6] p-4">
                  <summary className="cursor-pointer text-[12.5px] font-semibold text-[#8c8377] select-none">
                    ⚙ Cambiar PIN manualmente
                  </summary>
                  <div className="mt-3 flex items-center gap-2.5">
                    <input
                      className={`${inputCls} max-w-[200px] font-mono text-[15px] tracking-[0.12em]`}
                      type="text" maxLength={12} placeholder="NuevoPIN#8"
                      value={clientPin} onChange={e=>setClientPin(e.target.value)}
                    />
                    <button onClick={handleSetPin} className={`px-5 py-3 text-sm ${primaryBtn}`}>
                      {pinSaved?"✓ Guardado":"Guardar"}
                    </button>
                  </div>
                  {error&&<p className="mt-2 text-sm text-[#9a4b34]">{error}</p>}
                  <p className="mt-2 text-[11px] text-[#b3aa9b]">Mínimo 6 caracteres. Puede incluir letras, números y símbolos (@#$!%&*).</p>
                </details>

                {/* Instrucciones */}
                <div className="mt-5 rounded-2xl bg-[#faf3e8] border border-[#ede0c4] p-5">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#8f6a3c]">Instrucciones para {flowClient.name}</p>
                  <ol className="mt-3 space-y-2 text-[13px] text-[#7a6a52]">
                    <li>1. Abre la app LB Method y toca <strong>«Cliente»</strong>.</li>
                    <li>2. Ingresa tu correo, nombre o ID: <strong className="font-mono text-[#8f6a3c]">{flowClient.name}</strong></li>
                    <li>3. Ingresa tu PIN: <strong className="font-mono text-[#8f6a3c]">{generatedPin||clientPin||flowClient.pin||"(ver arriba)"}</strong></li>
                    <li>4. ¡Listo! Verás tu rutina, podrás registrar tus pesos y chatear con tu coach.</li>
                  </ol>
                </div>

                <div className="mt-6 flex gap-3">
                  <button onClick={()=>{resetWizard();setActiveTab("clients");}} className={`flex-1 py-3.5 text-sm ${ghostBtn}`}>Ver clientas</button>
                  <button onClick={resetWizard} className={`flex-1 py-3.5 text-sm ${primaryBtn}`}>+ Nueva persona</button>
                </div>
              </article>
            )}
          </section>
        )}

        {/* ========== CLIENTS ========== */}
        {authSession.role==="coach" && activeTab==="clients" && (
          <section className="grid items-start gap-6 lg:grid-cols-[minmax(260px,0.8fr)_1.4fr]">
            <div className="flex flex-col gap-2.5">
              {clients.map(c=>{const a=selectedClientId===c.id;return(
                <button key={c.id} onClick={()=>setSelectedClientId(c.id)} className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition ${a?"border-[#a87d49] bg-[#fdfbf7] ring-1 ring-[#a87d49]":"border-[#e7e1d6] bg-white hover:border-[#d8cdb8]"}`}>
                  <span className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-full bg-[#17120d] text-sm font-semibold text-[#f4f1ea]">{initials(c.name)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-semibold">{c.name}</span>
                    <span className="mt-0.5 block text-[11.5px] text-[#8c8377]">{GOAL_LABELS[c.goal]} · {LEVEL_LABELS[c.experienceLevel]}</span>
                  </span>
                  <span className="flex-none text-right">
                    <span className="font-display block text-[19px] font-semibold leading-none">{adherence(c)}%</span>
                    <span className="mt-0.5 block text-[9.5px] uppercase tracking-[0.08em] text-[#a39a8d]">adherencia</span>
                  </span>
                </button>
              );})}
              {clients.length===0 && <div className="rounded-2xl border border-dashed border-[#dcd4c5] p-6 text-center"><p className="text-sm text-[#a39a8d]">Sin clientas aún.</p><button onClick={()=>setActiveTab("coach")} className={`mt-3 px-5 py-2.5 text-sm ${primaryBtn}`}>+ Agregar</button></div>}
            </div>

            {selectedClient && (
              <div className="flex flex-col gap-4">
                {/* Header clienta */}
                <article className="rounded-[18px] border border-[#e7e1d6] bg-white p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="font-display text-[27px] font-semibold">{selectedClient.name}</h2>
                      <p className="mt-1 text-[13px] text-[#8c8377]">{GOAL_LABELS[selectedClient.goal]} · {LEVEL_LABELS[selectedClient.experienceLevel]} · {selectedClient.daysPerWeek} días/sem</p>
                    </div>
                    <div className="min-w-[170px]">
                      <div className="mb-1.5 flex justify-between text-[11px] uppercase tracking-wide text-[#a39a8d]"><span>Adherencia</span><span>{adherence(selectedClient)}%</span></div>
                      <div className="h-[7px] overflow-hidden rounded-full bg-[#ece6db]"><div className="h-full rounded-full bg-[#a87d49] transition-all" style={{width:`${adherence(selectedClient)}%`}}/></div>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedClient.program && <button onClick={()=>downloadPdf(selectedClient,selectedClient.program!)} className={`px-4 py-2.5 text-[12.5px] ${ghostBtn}`}>↓ Descargar PDF</button>}
                    {selectedClient.program && !editingRoutine && (
                      <button onClick={enterEditMode} className={`px-4 py-2.5 text-[12.5px] ${primaryBtn}`}>✏ Editar rutina</button>
                    )}
                    {editingRoutine && (
                      <>
                        <button onClick={()=>saveAllDays(selectedClient.routineId!)} disabled={!!savingDay} className={`px-4 py-2.5 text-[12.5px] ${primaryBtn}`}>
                          {savingDay?"Guardando…":"✓ Guardar todos los cambios"}
                        </button>
                        <button onClick={exitEditMode} className={`px-4 py-2.5 text-[12.5px] ${ghostBtn}`}>✕ Cancelar</button>
                      </>
                    )}
                    <button onClick={()=>{setFlowClient(selectedClient);setCoachStep(4);setActiveTab("coach");}} className={`px-4 py-2.5 text-[12.5px] ${ghostBtn}`}>⚙ PIN</button>
                    {!selectedClient.program && <button onClick={()=>{setFlowClient(selectedClient);setGoal(selectedClient.goal);setLevel(selectedClient.experienceLevel);setDays(selectedClient.daysPerWeek);setCoachStep(2);setActiveTab("coach");}} className={`px-4 py-2.5 text-[12.5px] ${primaryBtn}`}>Generar rutina</button>}
                  </div>
                </article>

                {/* Progreso semanal */}
                {selectedClient.program && (
                  <article className="rounded-[18px] border border-[#e7e1d6] bg-white p-6">
                    <h3 className="font-display text-[18px] font-semibold">Registrar avance</h3>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <label className="block"><span className={labelCls}>Semana</span>
                        <select className={inputCls} value={progressWeek} onChange={e=>{const w=Number(e.target.value);setProgressWeek(w);const s=selectedClient.progress.find(p=>p.weekNumber===w);setCompletedSessions(s?.completedSessions??0);setProgressNotes(s?.notes??"");}}>
                          {selectedClient.program.weeks.map(w=><option key={w.weekNumber} value={w.weekNumber}>Semana {w.weekNumber}</option>)}
                        </select>
                      </label>
                      <label className="block"><span className={labelCls}>Sesiones completadas</span>
                        <input className={inputCls} type="number" min={0} max={selectedClient.daysPerWeek} value={completedSessions} onChange={e=>setCompletedSessions(Number(e.target.value))}/>
                      </label>
                    </div>
                    <label className="mt-3 block"><span className={labelCls}>Notas</span>
                      <textarea className={`${inputCls} min-h-[72px] resize-y`} value={progressNotes} onChange={e=>setProgressNotes(e.target.value)} placeholder="Energía, técnica, cargas…"/>
                    </label>
                    <button onClick={saveProgress} className={`mt-3 px-6 py-3 text-sm ${primaryBtn}`}>Guardar avance</button>
                    {selectedClient.progress.length>0 && (
                      <div className="mt-5 flex flex-col gap-2">
                        {selectedClient.progress.slice().sort((a,b)=>b.weekNumber-a.weekNumber).map(item=>(
                          <div key={item.weekNumber} className="rounded-[13px] border border-[#ece6db] p-3">
                            <div className="flex items-center justify-between"><span className="text-[13px] font-semibold">Semana {item.weekNumber}</span><span className="text-[11px] text-[#a39a8d]">{fdt(item.updatedAt)}</span></div>
                            <div className="mt-0.5 text-[12px] text-[#6b6358]">{item.completedSessions}/{selectedClient.daysPerWeek} sesiones</div>
                            {item.notes&&<div className="mt-1 text-[12px] text-[#8c8377]">{item.notes}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                )}

                {/* Chat disponible como burbuja flotante (esquina inferior derecha) */}

                {/* ===== EDITOR DE RUTINA ===== */}
                {editingRoutine && selectedClient.program && selectedClient.routineId && (
                  <article className="rounded-[18px] border-2 border-[#a87d49] bg-white p-6">
                    <div className="mb-5 flex items-center justify-between">
                      <div>
                        <h3 className="font-display text-[20px] font-semibold text-[#17120d]">Editar rutina</h3>
                        <p className="mt-0.5 text-[12px] text-[#8c8377]">Cambia ejercicios, series, reps y RIR. Guarda cada día o todos a la vez.</p>
                      </div>
                      {editError && <p className="max-w-[220px] text-right text-[12px] text-[#9a4b34]">{editError}</p>}
                    </div>

                    <div className="flex flex-col gap-6">
                      {selectedClient.program.weeks.map(week=>(
                        <div key={week.weekNumber}>
                          {/* Cabecera semana */}
                          <div className="mb-3 flex items-center gap-3">
                            <span className="rounded-full bg-[#17120d] px-3 py-1 text-[11px] font-bold text-white">Semana {week.weekNumber}{week.deload?" · Deload":""}</span>
                            <span className="text-[11px] text-[#a39a8d]">RIR {week.rir}</span>
                          </div>

                          <div className="flex flex-col gap-4">
                            {week.days.map(day=>{
                              const key=`${week.weekNumber}-${day.dayIndex}`;
                              const dayState=dayEdits[key];
                              if(!dayState)return null;
                              const isSaving=savingDay===key;
                              return (
                                <div key={key} className={`rounded-2xl border p-4 transition ${dayState.isDirty?"border-[#a87d49] bg-[#fffbf5]":"border-[#e7e1d6] bg-[#fafaf9]"}`}>
                                  {/* Cabecera día */}
                                  <div className="mb-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#a87d49]">Día {day.dayIndex+1}</span>
                                      <span className="text-[13px] font-semibold capitalize text-[#3a342c]">{FOCUS_LABELS[day.focus]??day.focus.replace(/_/g," ")}</span>
                                      {dayState.isDirty && <span className="rounded-full bg-[#a87d49] px-2 py-0.5 text-[9px] font-bold text-white">CAMBIOS</span>}
                                    </div>
                                    <button
                                      onClick={()=>saveDayEdit(selectedClient.routineId!,week.weekNumber,day.dayIndex)}
                                      disabled={!dayState.isDirty||isSaving}
                                      className={`rounded-xl px-4 py-2 text-[12px] font-semibold transition ${dayState.isDirty?"bg-[#a87d49] text-white hover:bg-[#946b3b]":"border border-[#e0d9cc] text-[#c2b9aa] cursor-default"} disabled:opacity-50`}
                                    >
                                      {isSaving?"Guardando…":"Guardar día"}
                                    </button>
                                  </div>

                                  {/* Encabezado columnas */}
                                  <div className="mb-1.5 grid grid-cols-[120px_1fr_50px_60px_60px_48px_32px] gap-1.5 px-1 text-[9.5px] font-semibold uppercase tracking-[0.07em] text-[#a39a8d]">
                                    <span>Rol</span><span>Ejercicio</span><span>Series</span><span>Rep min</span><span>Rep máx</span><span>RIR</span><span></span>
                                  </div>

                                  {/* Filas de ejercicios */}
                                  <div className="flex flex-col gap-1.5">
                                    {dayState.exercises.map((ex,idx)=>(
                                      <div key={ex.uid}>
                                        <div className="grid grid-cols-[120px_1fr_50px_60px_60px_48px_32px] items-center gap-1.5">
                                        {/* Rol */}
                                        <select
                                          value={ex.role}
                                          onChange={e=>updateDayExercise(key,idx,"role",e.target.value)}
                                          className="rounded-lg border border-[#e0d9cc] bg-white px-2 py-1.5 text-[11px] font-semibold focus:border-[#a87d49] focus:outline-none"
                                        >
                                          <option value="main">Principal</option>
                                          <option value="unilateral">Unilateral</option>
                                          <option value="isolation">Aislamiento</option>
                                          <option value="accessory">Accesorio</option>
                                        </select>
                                        {/* Ejercicio */}
                                        <select
                                          value={ex.exerciseId}
                                          onChange={e=>changeExercise(key,idx,e.target.value)}
                                          className="rounded-lg border border-[#e0d9cc] bg-white px-2 py-1.5 text-[12px] focus:border-[#a87d49] focus:outline-none truncate"
                                        >
                                          <option value="__new__">➕ Crear ejercicio…</option>
                                          {exerciseLibrary.map(lib=>(
                                            <option key={lib.id} value={lib.id}>
                                              {tx(lib.name)} ({lib.muscleGroup})
                                            </option>
                                          ))}
                                        </select>
                                        {/* Series */}
                                        <input type="number" min={1} max={10} value={ex.sets}
                                          onChange={e=>updateDayExercise(key,idx,"sets",Number(e.target.value))}
                                          className="rounded-lg border border-[#e0d9cc] bg-white p-1.5 text-center text-[13px] font-semibold focus:border-[#a87d49] focus:outline-none"
                                        />
                                        {/* Rep min */}
                                        <input type="number" min={1} max={50} value={ex.repsMin}
                                          onChange={e=>updateDayExercise(key,idx,"repsMin",Number(e.target.value))}
                                          className="rounded-lg border border-[#e0d9cc] bg-white p-1.5 text-center text-[13px] focus:border-[#a87d49] focus:outline-none"
                                        />
                                        {/* Rep máx */}
                                        <input type="number" min={1} max={50} value={ex.repsMax}
                                          onChange={e=>updateDayExercise(key,idx,"repsMax",Number(e.target.value))}
                                          className="rounded-lg border border-[#e0d9cc] bg-white p-1.5 text-center text-[13px] focus:border-[#a87d49] focus:outline-none"
                                        />
                                        {/* RIR */}
                                        <input type="number" min={0} max={5} value={ex.rir}
                                          onChange={e=>updateDayExercise(key,idx,"rir",Number(e.target.value))}
                                          className="rounded-lg border border-[#e0d9cc] bg-white p-1.5 text-center text-[13px] focus:border-[#a87d49] focus:outline-none"
                                        />
                                        {/* Eliminar */}
                                        <button onClick={()=>removeDayExercise(key,idx)}
                                          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#c2b9aa] transition hover:bg-[#fde8e8] hover:text-[#a62020]"
                                          title="Eliminar ejercicio"
                                        >✕</button>
                                        </div>
                                        {creatingExercise?.key===key && creatingExercise?.idx===idx && (
                                          <div className="mt-1 flex items-center gap-2 rounded-xl border border-[#a87d49] bg-[#fffbf5] px-3 py-2">
                                            <input autoFocus type="text" placeholder="Nombre del ejercicio"
                                              value={creatingExercise.name}
                                              onChange={e=>setCreatingExercise(p=>p?{...p,name:e.target.value}:null)}
                                              onKeyDown={e=>{if(e.key==="Enter")confirmCreateExercise();if(e.key==="Escape")setCreatingExercise(null);}}
                                              className="min-w-0 flex-1 rounded-lg border border-[#e0d9cc] bg-white px-2 py-1.5 text-[12px] focus:border-[#a87d49] focus:outline-none"
                                            />
                                            <select value={creatingExercise.muscleGroup}
                                              onChange={e=>setCreatingExercise(p=>p?{...p,muscleGroup:e.target.value}:null)}
                                              className="rounded-lg border border-[#e0d9cc] bg-white px-2 py-1.5 text-[11px] focus:border-[#a87d49] focus:outline-none"
                                            >
                                              <option>Glúteo</option><option>Cuádriceps</option><option>Isquiotibiales</option>
                                              <option>Espalda</option><option>Pecho</option><option>Hombros</option>
                                              <option>Core</option><option>Otro</option>
                                            </select>
                                            <button onClick={confirmCreateExercise} className={`flex-none px-3 py-1.5 text-[12px] ${primaryBtn}`}>Agregar</button>
                                            <button onClick={()=>setCreatingExercise(null)} className={`flex-none px-2 py-1.5 text-[12px] ${ghostBtn}`}>✕</button>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>

                                  {/* Agregar ejercicio */}
                                  <button
                                    onClick={()=>addDayExercise(key)}
                                    className="mt-3 flex items-center gap-1.5 rounded-xl border border-dashed border-[#d8cdb8] px-3 py-2 text-[12px] font-semibold text-[#8c8377] transition hover:border-[#a87d49] hover:text-[#a87d49]"
                                  >
                                    + Agregar ejercicio
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Guardar todo */}
                    <div className="mt-6 flex gap-3">
                      <button onClick={()=>saveAllDays(selectedClient.routineId!)} disabled={!!savingDay} className={`flex-1 py-3 text-sm ${primaryBtn}`}>
                        {savingDay?"Guardando…":"✓ Guardar todos los cambios"}
                      </button>
                      <button onClick={exitEditMode} className={`px-6 py-3 text-sm ${ghostBtn}`}>Cancelar</button>
                    </div>
                  </article>
                )}
              </div>
            )}
            {!selectedClient && <div className="rounded-[18px] border border-[#e7e1d6] bg-white p-8 text-center text-sm text-[#a39a8d]">Selecciona un cliente.</div>}
          </section>
        )}

        {/* ========== PORTAL ========== */}
        {activeTab==="portal" && (
          <section className="mx-auto flex max-w-[800px] flex-col gap-5">
            {authSession.role==="coach" && (
              <label className="block max-w-sm"><span className={labelCls}>Ver clienta</span>
                <select className={inputCls} value={selectedClientId} onChange={e=>setSelectedClientId(e.target.value)}>
                  <option value="">— selecciona —</option>
                  {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            )}

            {(() => {
              const portalClient=clients.find(c=>c.id===portalClientId)??null;
              if(!portalClient)return <p className="text-sm text-[#a39a8d]">Selecciona un cliente.</p>;
              return (
                <>
                  {/* Header portal */}
                  <div className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] bg-[#17120d] px-7 py-5 text-[#f4f1ea]">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a87d49]">Plan activo</div>
                      <h2 className="font-display mt-1 text-[28px] font-semibold">{portalClient.name}</h2>
                      <p className="mt-0.5 text-[12px] text-[#b7ad9d]">{GOAL_LABELS[portalClient.goal]} · {portalClient.daysPerWeek} días/sem</p>
                    </div>
                    <div className="text-center">
                      <div className="font-display text-[48px] font-semibold leading-none">{adherence(portalClient)}%</div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#9a9186]">adherencia</div>
                    </div>
                  </div>

                  {/* Portal sub-tabs */}
                  <div className="flex gap-1 rounded-2xl border border-[#e7e1d6] bg-white p-1">
                    {PORTAL_TABS.map(t=>(
                      <button key={t.id} onClick={()=>setPortalTab(t.id)} className={`flex-1 rounded-xl py-2.5 text-[12.5px] font-semibold transition ${portalTab===t.id?"bg-[#17120d] text-white":"text-[#8c8377] hover:text-[#17120d]"}`}>{t.label}</button>
                    ))}
                  </div>

                  {/* Mi rutina */}
                  {portalTab==="rutina" && (
                    portalClient.program
                      ? <ClientProgramView
                          program={portalClient.program}
                          routineId={portalClient.routineId??""}
                          clientLevel={portalClient.experienceLevel}
                          clientLocation={portalClient.trainingLocation}
                          swapTarget={swapTarget}
                          swapOptions={swapOptions}
                          swapLoading={swapLoading}
                          swapSaving={swapSaving}
                          onOpenSwap={openSwap}
                          onApplySwap={applySwap}
                          onCancelSwap={()=>{setSwapTarget(null);setSwapOptions([]);}}
                          onShowExercise={setExerciseModal}
                          gifMap={gifMap}
                        />
                      : <p className="rounded-xl bg-[#faf6ef] p-4 text-sm text-[#7a6a52]">Aún no tienes rutina asignada. Tu coach la generará pronto.</p>
                  )}

                  {/* Registrar sesión */}
                  {portalTab==="registrar" && (
                    <div className="flex flex-col gap-4">
                      {!portalClient.program
                        ? <p className="rounded-xl bg-[#faf6ef] p-4 text-sm text-[#7a6a52]">Sin rutina asignada todavía.</p>
                        : (()=>{
                          const currentWeekData=portalClient.program!.weeks.find(w=>w.weekNumber===logWeek);
                          const currentDayData=currentWeekData?.days.find(d=>d.dayIndex===logDay);
                          return (
                            <>
                              <article className="rounded-[18px] border border-[#e7e1d6] bg-white p-5">
                                <h3 className="font-display text-[18px] font-semibold">Selecciona sesión</h3>
                                <div className="mt-4 grid grid-cols-2 gap-3">
                                  <label className="block"><span className={labelCls}>Semana</span>
                                    <select className={inputCls} value={logWeek} onChange={e=>{setLogWeek(Number(e.target.value));setExerciseLogs({});setLogNotes({});}}>
                                      {portalClient.program!.weeks.map(w=><option key={w.weekNumber} value={w.weekNumber}>Semana {w.weekNumber}{w.deload?" (Deload)":""}</option>)}
                                    </select>
                                  </label>
                                  <label className="block"><span className={labelCls}>Día</span>
                                    <select className={inputCls} value={logDay} onChange={e=>{setLogDay(Number(e.target.value));setExerciseLogs({});setLogNotes({});}}>
                                      {currentWeekData?.days.map(d=><option key={d.dayIndex} value={d.dayIndex}>Día {d.dayIndex+1} — {d.focus.replace(/_/g," ")}</option>)}
                                    </select>
                                  </label>
                                </div>
                              </article>

                              {currentDayData?.selections.map(sel=>{
                                const name=sel.exercise.name;
                                const sets=exerciseLogs[name]??Array.from({length:sel.sets},(_,i)=>({setNumber:i+1,reps:sel.repsMin,weightKg:0,completed:false}));
                                const updateSet=(si:number,field:keyof SetLog,val:number|boolean)=>{
                                  const updated=sets.map((s,idx)=>idx===si?{...s,[field]:val}:s);
                                  setExerciseLogs(prev=>({...prev,[name]:updated}));
                                };
                                return (
                                  <article key={name} className="rounded-[18px] border border-[#e7e1d6] bg-white p-5">
                                    <div className="flex items-center justify-between gap-3">
                                      <div>
                                        <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#a87d49]">{sel.role}</div>
                                        <h4 className="font-display text-[17px] font-semibold">{tx(name)}</h4>
                                        <p className="text-[12px] text-[#8c8377]">Prescrito: {sel.sets}×{sel.repsMin}-{sel.repsMax} · RIR {sel.rir}</p>
                                      </div>
                                    </div>

                                    <div className="mt-4 space-y-2">
                                      {/* Header */}
                                      <div className="grid grid-cols-[40px_1fr_1fr_40px] gap-2 px-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a39a8d]">
                                        <span>Set</span><span>Reps</span><span>Peso (kg)</span><span>✓</span>
                                      </div>
                                      {sets.map((s,si)=>(
                                        <div key={si} className={`grid grid-cols-[40px_1fr_1fr_40px] items-center gap-2 rounded-xl p-2 transition ${s.completed?"bg-[#f0faf0]":"bg-[#faf8f4]"}`}>
                                          <span className="text-center text-[13px] font-bold text-[#a87d49]">{s.setNumber}</span>
                                          <input type="number" min={0} max={50} value={s.reps} onChange={e=>updateSet(si,"reps",Number(e.target.value))}
                                            className="rounded-lg border border-[#e0d9cc] bg-white p-2 text-center text-[14px] font-semibold focus:border-[#a87d49] focus:outline-none"/>
                                          <input type="number" min={0} max={500} step={0.5} value={s.weightKg} onChange={e=>updateSet(si,"weightKg",Number(e.target.value))}
                                            className="rounded-lg border border-[#e0d9cc] bg-white p-2 text-center text-[14px] font-semibold focus:border-[#a87d49] focus:outline-none"/>
                                          <button onClick={()=>updateSet(si,"completed",!s.completed)} className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold transition ${s.completed?"bg-[#a87d49] text-white":"border-2 border-[#e0d9cc] text-[#c2b9aa]"}`}>{s.completed?"✓":"○"}</button>
                                        </div>
                                      ))}
                                      {/* Add/Remove set */}
                                      <div className="flex gap-2 pt-1">
                                        <button onClick={()=>setExerciseLogs(prev=>({...prev,[name]:[...sets,{setNumber:sets.length+1,reps:sel.repsMin,weightKg:sets[sets.length-1]?.weightKg??0,completed:false}]}))}
                                          className="rounded-lg border border-dashed border-[#d8cdb8] px-3 py-1.5 text-[12px] font-semibold text-[#8c8377] hover:border-[#a87d49] hover:text-[#a87d49]">+ Serie</button>
                                        {sets.length>1&&<button onClick={()=>setExerciseLogs(prev=>({...prev,[name]:sets.slice(0,-1)}))}
                                          className="rounded-lg border border-dashed border-[#d8cdb8] px-3 py-1.5 text-[12px] font-semibold text-[#8c8377] hover:border-[#9a4b34] hover:text-[#9a4b34]">− Serie</button>}
                                      </div>
                                    </div>

                                    <label className="mt-3 block"><span className={labelCls}>Notas del ejercicio</span>
                                      <input className={inputCls} placeholder="Sensaciones, técnica…" value={logNotes[name]??""} onChange={e=>setLogNotes(prev=>({...prev,[name]:e.target.value}))}/>
                                    </label>
                                    <button onClick={()=>saveExerciseLog(name)} disabled={logSaving} className={`mt-3 px-5 py-2.5 text-sm ${primaryBtn}`}>{logSaving?"Guardando…":"Guardar este ejercicio"}</button>
                                  </article>
                                );
                              })}
                            </>
                          );
                        })()
                      }
                    </div>
                  )}

                  {/* Chat — burbuja flotante esquina inferior derecha */}
                  {portalTab==="chat" && (
                    <article className="rounded-[18px] border border-[#e7e1d6] bg-[#faf8f4] p-7 text-center">
                      <div className="text-4xl mb-3">💬</div>
                      <p className="font-display text-[17px] font-semibold text-[#17120d]">El chat está disponible en todo momento</p>
                      <p className="mt-2 text-[13px] text-[#8c8377]">Presiona el botón flotante <strong>💬</strong> en la esquina inferior derecha para abrir el chat con tu coach desde cualquier pantalla.</p>
                    </article>
                  )}

                  {/* Historial */}
                  {portalTab==="historial" && (
                    <div className="flex flex-col gap-4">
                      <article className="rounded-[18px] border border-[#e7e1d6] bg-white p-5">
                        <h3 className="font-display mb-3 text-[18px] font-semibold">Historial por ejercicio</h3>
                        <label className="block"><span className={labelCls}>Selecciona ejercicio</span>
                          <select className={inputCls} value={historyExercise} onChange={e=>{setHistoryExercise(e.target.value);if(e.target.value)loadHistory(e.target.value);}}>
                            <option value="">— elige un ejercicio —</option>
                            {portalClient.program?.weeks[0]?.days.flatMap(d=>d.selections.map(s=>s.exercise.name)).filter((n,i,a)=>a.indexOf(n)===i).map(n=><option key={n} value={n}>{tx(n)}</option>)}
                          </select>
                        </label>
                      </article>

                      {historyLoading && <p className="text-sm text-[#a39a8d]">Cargando historial…</p>}

                      {!historyLoading && historyExercise && historyData.length===0 && (
                        <p className="text-sm text-[#a39a8d]">Sin registros aún para {tx(historyExercise)}.</p>
                      )}

                      {historyData.length>0 && (
                        <article className="rounded-[18px] border border-[#e7e1d6] bg-white p-5">
                          <h4 className="font-display text-[17px] font-semibold mb-4">{tx(historyExercise)}</h4>
                          <div className="flex flex-col gap-3">
                            {historyData.map(log=>{
                              const maxKg=Math.max(...log.setsData.map(s=>s.weightKg),0);
                              const totalReps=log.setsData.reduce((s,l)=>s+(l.completed?l.reps:0),0);
                              const completed=log.setsData.filter(s=>s.completed).length;
                              return (
                                <div key={log.id} className="rounded-xl border border-[#ece6db] p-4">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[13px] font-semibold">Sem {log.weekNumber} · Día {log.dayIndex+1}</span>
                                    <span className="text-[11px] text-[#a39a8d]">{fdt(log.loggedAt)}</span>
                                  </div>
                                  <div className="mt-2 grid grid-cols-3 gap-2">
                                    <div className="rounded-lg bg-[#faf8f4] p-2 text-center">
                                      <div className="font-display text-[20px] font-semibold text-[#a87d49]">{maxKg}<span className="text-[11px] font-normal text-[#9a9186]"> kg</span></div>
                                      <div className="text-[9.5px] uppercase tracking-[0.06em] text-[#9a9186]">Peso máx</div>
                                    </div>
                                    <div className="rounded-lg bg-[#faf8f4] p-2 text-center">
                                      <div className="font-display text-[20px] font-semibold">{totalReps}</div>
                                      <div className="text-[9.5px] uppercase tracking-[0.06em] text-[#9a9186]">Reps totales</div>
                                    </div>
                                    <div className="rounded-lg bg-[#faf8f4] p-2 text-center">
                                      <div className="font-display text-[20px] font-semibold">{completed}/{log.setsData.length}</div>
                                      <div className="text-[9.5px] uppercase tracking-[0.06em] text-[#9a9186]">Series</div>
                                    </div>
                                  </div>
                                  {log.notes && <p className="mt-2 text-[12px] text-[#8c8377]">{log.notes}</p>}
                                </div>
                              );
                            })}
                          </div>
                        </article>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </section>
        )}
      </main>

      {/* ── Modal de imagen de ejercicio ── */}
      {exerciseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={()=>setExerciseModal(null)}>
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#e7e1d6]">
              <h3 className="font-display text-[18px] font-semibold text-[#17120d]">{tx(exerciseModal.name)}</h3>
              <button onClick={()=>setExerciseModal(null)} className="text-[#8c8377] hover:text-[#17120d] text-xl leading-none">✕</button>
            </div>
            {exerciseModal.imageUrl ? (
              <img src={exerciseModal.imageUrl} alt={tx(exerciseModal.name)} className="w-full object-contain max-h-72 bg-[#faf8f4]"/>
            ) : (
              <div className="flex h-48 items-center justify-center bg-[#faf8f4]">
                <p className="text-[13px] text-[#a39a8d]">Sin imagen disponible</p>
              </div>
            )}
            {exerciseModal.videoUrl && (
              <div className="px-5 py-4">
                <a href={exerciseModal.videoUrl.replace("/embed/","watch?v=")} target="_blank" rel="noreferrer"
                  className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold ${darkBtn}`}>
                  ▶ Ver video en YouTube
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Chat flotante global ── */}
      {authSession && (() => {
        const chatClientId = authSession.role==="client" ? authSession.clientId : selectedClientId;
        const chatClientName = authSession.role==="client"
          ? "Coach"
          : clients.find(c=>c.id===selectedClientId)?.name ?? "";
        if(!chatClientId) return null;
        return (
          <FloatingChat
            key={chatClientId}
            clientId={chatClientId}
            myRole={authSession.role}
            otherName={chatClientName}
            apiFetch={apiFetch}
          />
        );
      })()}
    </div>
  );
}

/* ===================================================================
   PROGRAM VIEW
   =================================================================== */
/* ===================================================================
   CLIENT PROGRAM VIEW — igual que ProgramView pero con botón de cambiar ejercicio
   =================================================================== */
interface ClientProgramViewProps {
  program: Program; routineId: string;
  clientLevel: Level; clientLocation: TrainingLocation;
  swapTarget: {weekNumber:number;dayIndex:number;sel:Selection;routineId:string}|null;
  swapOptions: LibraryExercise[]; swapLoading: boolean; swapSaving: boolean;
  onOpenSwap: (wn:number,di:number,sel:Selection,rid:string,lv:Level,loc:TrainingLocation)=>void;
  onApplySwap: (newId:string)=>void;
  onCancelSwap: ()=>void;
  onShowExercise: (ex:{name:string;imageUrl?:string;videoUrl?:string})=>void;
  gifMap: Record<string,string|null>;
}
const EQUIP_LABEL: Record<string,string> = {
  barbell:"Barra",dumbbell:"Mancuernas",machine:"Máquina",cable:"Polea",
  smith:"Smith",bodyweight:"Peso corporal",band:"Banda",kettlebell:"Kettlebell",
};
function ClientProgramView({program,routineId,clientLevel,clientLocation,swapTarget,swapOptions,swapLoading,swapSaving,onOpenSwap,onApplySwap,onCancelSwap,onShowExercise,gifMap}:ClientProgramViewProps){
  const allSame=program.weeks.length>1&&program.weeks.slice(1).every(w=>weekEq(w,program.weeks[0]));
  const weeksToShow=allSame?[program.weeks[0]]:program.weeks;
  return(
    <div className="flex flex-col gap-3.5">
      {weeksToShow.map(week=>(
        <article key={week.weekNumber} className="rounded-2xl border border-[#e7e1d6] bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-baseline gap-3">
              <span className="font-display text-[26px] font-semibold leading-none tracking-tight">{allSame?"Mes 1":`Semana ${week.weekNumber}`}</span>
              {allSame&&<span className="rounded-full bg-[#f0e7d8] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8f6a3c]">{program.weeks.length} semanas · misma estructura</span>}
              {!allSame&&week.deload&&<span className="rounded-full bg-[#f0e7d8] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8f6a3c]">Deload</span>}
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8c8377]">{allSame?`RIR progresivo sem 1–${program.weeks.length}`:week.deload?"Semana de descarga":`RIR objetivo ${week.rir}`}</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            {[{v:week.volume.weeklyGluteSets,l:"series"},{v:`${Math.round(week.volume.lowerVolumePct*100)}%`,l:"tren inferior"},{v:`${week.volume.gluteFrequency}×`,l:"frec. glúteo"}].map(({v,l})=>(
              <div key={l} className="rounded-[11px] border border-[#eee7da] bg-[#faf8f4] p-3 text-center">
                <div className="font-display text-2xl font-semibold leading-none">{v}</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.08em] text-[#9a9186]">{l}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-2.5">
            {week.days.map(day=>(
              <div key={day.dayIndex} className="rounded-xl border border-[#ece6db] p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#a87d49]">Día {day.dayIndex+1}</span>
                    <span className="text-[13px] font-semibold capitalize text-[#3a342c]">{FOCUS_LABELS[day.focus]??day.focus.replace(/_/g," ")}</span>
                  </div>
                  <span className="text-[11px] text-[#a39a8d]">{day.totalSets} series · Fatiga {day.sessionFatigue}/12</span>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  {day.selections.map((sel,i)=>{
                    const tag=ROLE_TAG[sel.role]??{label:sel.role,cls:"bg-[#efece5] text-[#8c8377]"};
                    const method=(sel.method??"straight") as TrainingMethod;
                    const mTag=METHOD_TAG[method]??METHOD_TAG.straight;
                    const mConfig=sel.methodConfig;
                    const isIntensity=mConfig?.isIntensityTechnique??false;
                    const isSwapping=swapTarget?.weekNumber===week.weekNumber&&swapTarget?.dayIndex===day.dayIndex&&swapTarget?.sel.exercise.name===sel.exercise.name;
                    return(
                      <div key={`${sel.exercise.name}-${i}`}>
                        <div className={`rounded-xl p-3 transition ${isIntensity?"bg-[#fdfaf6] border border-[#ede5d8]":"bg-[#fafaf9]"} ${isSwapping?"ring-2 ring-[#a87d49]":""}`}>
                          <div className="flex items-center gap-2">
                            {(()=>{const img=sel.exercise.imageUrl||gifMap[sel.exercise.name]||undefined;const vid=sel.exercise.videoUrl;if(!img&&!vid)return null;return(<button onClick={()=>onShowExercise({name:sel.exercise.name,imageUrl:img,videoUrl:vid})} className="flex-none h-10 w-10 rounded-lg overflow-hidden border border-[#e0d9cc] bg-[#f5f1ea] hover:border-[#a87d49] transition" title="Ver ejercicio">{img?<img src={img} alt="" className="h-full w-full object-cover" onError={e=>{(e.currentTarget.parentElement as HTMLElement).style.display="none";}}/>:<span className="flex h-full w-full items-center justify-center text-[16px]">▶</span>}</button>);})()}
                            <span className={`flex-none rounded-md px-2 py-[3px] text-center text-[9px] font-semibold uppercase tracking-[0.06em] ${tag.cls}`}>{tag.label}</span>
                            <span className="flex-1 text-[13.5px] font-medium text-[#28231c]">{tx(sel.exercise.name)}</span>
                            <span className="whitespace-nowrap text-[11px] tabular-nums text-[#a39a8d]">{sel.sets}×{sel.repsMin}-{sel.repsMax} · RIR {sel.rir}</span>
                            {routineId && (
                              <button
                                onClick={()=>isSwapping?onCancelSwap():onOpenSwap(week.weekNumber,day.dayIndex,sel,routineId,clientLevel,clientLocation)}
                                className={`ml-1 flex-none rounded-lg border px-2 py-1 text-[10px] font-semibold transition ${isSwapping?"border-[#a87d49] bg-[#fdf8f0] text-[#a87d49]":"border-[#e0d9cc] text-[#8c8377] hover:border-[#a87d49] hover:text-[#a87d49]"}`}
                              >{isSwapping?"✕ Cerrar":"Cambiar"}</button>
                            )}
                          </div>
                          {isIntensity&&mConfig&&(
                            <div className="mt-2 flex flex-wrap items-start gap-2">
                              <span className={`flex-none rounded-full px-2.5 py-1 text-[10px] font-bold ${mTag.cls}`}>{mTag.emoji} {mConfig.labelEs}</span>
                              <span className="text-[11px] leading-relaxed text-[#6b6358]">{mConfig.prescriptionNote}</span>
                            </div>
                          )}
                          {isIntensity&&mConfig&&<div className="mt-1 text-[10px] text-[#a39a8d]">⏱ Descanso: {mConfig.restNote}</div>}
                        </div>

                        {/* Panel de alternativas */}
                        {isSwapping && (
                          <div className="mt-1.5 rounded-xl border border-[#a87d49] bg-[#fffbf5] p-3">
                            <p className="mb-2 text-[11px] font-semibold text-[#8f6a3c]">Ejercicios equivalentes — mismo movimiento y músculo:</p>
                            {swapLoading && <p className="text-[12px] text-[#a39a8d]">Buscando alternativas…</p>}
                            {!swapLoading && swapOptions.length===0 && <p className="text-[12px] text-[#a39a8d]">No se encontraron alternativas compatibles.</p>}
                            {!swapLoading && swapOptions.length>0 && (
                              <div className="flex flex-col gap-1.5">
                                {swapOptions.map(opt=>(
                                  <button key={opt.id} disabled={swapSaving}
                                    onClick={()=>onApplySwap(opt.id)}
                                    className="flex items-center justify-between rounded-lg border border-[#e0d9cc] bg-white px-3 py-2 text-left transition hover:border-[#a87d49] hover:bg-[#fdf8f0] disabled:opacity-50">
                                    <span className="text-[13px] font-medium text-[#28231c]">{tx(opt.name)}</span>
                                    <span className="ml-2 flex-none rounded-full bg-[#f0ede8] px-2 py-0.5 text-[10px] font-semibold text-[#8c8377]">{EQUIP_LABEL[opt.equipment]??opt.equipment}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                            {swapSaving && <p className="mt-2 text-[11px] text-[#a87d49]">Guardando cambio en todas las semanas…</p>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

function selEq(a:Selection,b:Selection):boolean{
  return a.exercise.name===b.exercise.name&&a.role===b.role&&a.sets===b.sets&&
    a.repsMin===b.repsMin&&a.repsMax===b.repsMax&&a.rir===b.rir&&
    (a.method??"straight")===(b.method??"straight");
}
function weekEq(a:Week,b:Week):boolean{
  if(a.rir!==b.rir||a.deload!==b.deload||a.days.length!==b.days.length)return false;
  return a.days.every((da,i)=>{
    const db=b.days[i];
    return da.selections.length===db.selections.length&&da.selections.every((s,j)=>selEq(s,db.selections[j]));
  });
}

function ProgramView({program,onShowExercise,gifMap}:{program:Program;onShowExercise?:(ex:{name:string;imageUrl?:string;videoUrl?:string})=>void;gifMap?:Record<string,string|null>}){
  const allSame=program.weeks.length>1&&program.weeks.slice(1).every(w=>weekEq(w,program.weeks[0]));
  const weeksToShow=allSame?[program.weeks[0]]:program.weeks;
  return (
    <div className="flex flex-col gap-3.5">
      {weeksToShow.map(week=>(
        <article key={week.weekNumber} className="rounded-2xl border border-[#e7e1d6] bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-baseline gap-3">
              <span className="font-display text-[26px] font-semibold leading-none tracking-tight">
                {allSame ? "Mes 1" : `Semana ${week.weekNumber}`}
              </span>
              {allSame && (
                <span className="rounded-full bg-[#f0e7d8] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8f6a3c]">
                  {program.weeks.length} semanas · misma estructura
                </span>
              )}
              {!allSame && week.deload && <span className="rounded-full bg-[#f0e7d8] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8f6a3c]">Deload</span>}
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8c8377]">
              {allSame ? `RIR progresivo sem 1–${program.weeks.length}` : week.deload ? "Semana de descarga" : `RIR objetivo ${week.rir}`}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            {[{v:week.volume.weeklyGluteSets,l:"series glúteo"},{v:`${Math.round(week.volume.lowerVolumePct*100)}%`,l:"tren inferior"},{v:`${week.volume.gluteFrequency}×`,l:"frec. glúteo"}].map(({v,l})=>(
              <div key={l} className="rounded-[11px] border border-[#eee7da] bg-[#faf8f4] p-3 text-center">
                <div className="font-display text-2xl font-semibold leading-none">{v}</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.08em] text-[#9a9186]">{l}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-2.5">
            {week.days.map(day=>(
              <div key={day.dayIndex} className="rounded-xl border border-[#ece6db] p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#a87d49]">Día {day.dayIndex+1}</span>
                    <span className="text-[13px] font-semibold capitalize text-[#3a342c]">{FOCUS_LABELS[day.focus]??day.focus.replace(/_/g," ")}</span>
                  </div>
                  <span className="text-[11px] text-[#a39a8d]">{day.totalSets} series · Fatiga {day.sessionFatigue}/12</span>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  {day.selections.map((sel,i)=>{
                    const tag = ROLE_TAG[sel.role]??{label:sel.role,cls:"bg-[#efece5] text-[#8c8377]"};
                    const method = (sel.method ?? "straight") as TrainingMethod;
                    const mTag = METHOD_TAG[method] ?? METHOD_TAG.straight;
                    const mConfig = sel.methodConfig;
                    const isIntensity = mConfig?.isIntensityTechnique ?? false;
                    return(
                      <div key={`${sel.exercise.name}-${i}`} className={`rounded-xl p-3 transition ${isIntensity?"bg-[#fdfaf6] border border-[#ede5d8]":"bg-[#fafaf9]"}`}>
                        {/* Row 1: role · name · prescription */}
                        <div className="flex items-center gap-2">
                          {(()=>{const img=sel.exercise.imageUrl||gifMap?.[sel.exercise.name]||undefined;const vid=sel.exercise.videoUrl;if(!img&&!vid)return null;if(!onShowExercise)return null;return(<button onClick={()=>onShowExercise({name:sel.exercise.name,imageUrl:img,videoUrl:vid})} className="flex-none h-10 w-10 rounded-lg overflow-hidden border border-[#e0d9cc] bg-[#f5f1ea] hover:border-[#a87d49] transition" title="Ver ejercicio">{img?<img src={img} alt="" className="h-full w-full object-cover" onError={e=>{(e.currentTarget.parentElement as HTMLElement).style.display="none";}}/>:<span className="flex h-full w-full items-center justify-center text-[16px]">▶</span>}</button>);})()}
                          <span className={`flex-none rounded-md px-2 py-[3px] text-center text-[9px] font-semibold uppercase tracking-[0.06em] ${tag.cls}`}>{tag.label}</span>
                          <span className="flex-1 text-[13.5px] font-medium text-[#28231c]">{tx(sel.exercise.name)}</span>
                          <span className="whitespace-nowrap text-[11px] tabular-nums text-[#a39a8d]">{sel.sets}×{sel.repsMin}-{sel.repsMax} · RIR {sel.rir}</span>
                        </div>
                        {/* Row 2: method badge + note (only if not straight) */}
                        {isIntensity && mConfig && (
                          <div className="mt-2 flex flex-wrap items-start gap-2">
                            <span className={`flex-none rounded-full px-2.5 py-1 text-[10px] font-bold ${mTag.cls}`}>
                              {mTag.emoji} {mConfig.labelEs}
                            </span>
                            <span className="text-[11px] leading-relaxed text-[#6b6358]">{mConfig.prescriptionNote}</span>
                          </div>
                        )}
                        {/* Row 3: rest note (only if not straight) */}
                        {isIntensity && mConfig && (
                          <div className="mt-1 text-[10px] text-[#a39a8d]">⏱ Descanso: {mConfig.restNote}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

/* ===================================================================
   FLOATING CHAT  — autocontenido, con polling, optimistic send y toasts
   =================================================================== */
function FloatingChat({clientId, myRole, otherName, apiFetch}: {
  clientId: string;
  myRole: "coach" | "client";
  otherName: string;
  apiFetch: (path: string, init?: RequestInit, pub?: boolean) => Promise<Response>;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [toasts, setToasts] = useState<{id:string; text:string}[]>([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File|null>(null);
  const [sending, setSending] = useState(false);
  const [chatErr, setChatErr] = useState<string|null>(null);

  // refs para evitar stale closures y marcar primera carga
  const apiFetchRef = useRef(apiFetch);
  apiFetchRef.current = apiFetch;            // siempre actualizado
  const openRef = useRef(open);
  openRef.current = open;
  const prevOtherCount = useRef(-1);         // -1 = primera carga
  const initialized = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const otherRole = myRole === "coach" ? "client" : "coach";
  const displayName = otherName || (myRole === "client" ? "Coach" : "Clienta");
  const API_BASE = (import.meta.env.VITE_API_URL?.replace("/api","")) ?? "";

  // ---- carga de mensajes (siempre usa refs actualizados) ----
  const load = useRef(async () => {
    try {
      const res = await apiFetchRef.current(`/chat/${clientId}`);
      if (!res.ok) {
        const txt = await res.text().catch(() => `HTTP ${res.status}`);
        setChatErr(`Error ${res.status}: ${txt.slice(0, 80)}`);
        return;
      }
      setChatErr(null);
      const d = await res.json() as {messages: ChatMessage[]};
      const msgs: ChatMessage[] = d.messages ?? [];
      const fromOther = msgs.filter(m => m.senderRole === otherRole);

      // Primera carga: inicializar contador sin mostrar toasts
      if (!initialized.current) {
        prevOtherCount.current = fromOther.length;
        initialized.current = true;
      } else if (fromOther.length > prevOtherCount.current) {
        const newOnes = fromOther.slice(prevOtherCount.current);
        prevOtherCount.current = fromOther.length;
        if (!openRef.current) {
          setUnread(u => u + newOnes.length);
          newOnes.slice(-2).forEach(msg => {
            const id = Math.random().toString(36).slice(2);
            const text = msg.content?.slice(0, 55) ?? (msg.mediaFilename ? `📎 ${msg.mediaFilename}` : "Archivo adjunto");
            setToasts(prev => [...prev.slice(-2), {id, text}]);
            setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
          });
        }
      }
      setMessages(msgs);
    } catch (e) {
      setChatErr(e instanceof Error ? e.message : "Error de red. Verifica que el backend esté activo.");
    }
  });

  // Polling cada 3.5 s. El ref de load siempre tiene la versión actual.
  useEffect(() => {
    initialized.current = false;
    prevOtherCount.current = -1;
    load.current();
    const id = setInterval(() => load.current(), 3500);
    return () => clearInterval(id);
  }, [clientId]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => bottomRef.current?.scrollIntoView({behavior:"smooth"}), 100);
    }
  }, [open]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({behavior:"smooth"});
  }, [messages]);

  // ---- enviar mensaje con update optimista ----
  async function send() {
    const text = input.trim();
    if (!text && !file) return;
    setSending(true);
    setChatErr(null);

    // Optimistic: agregar mensaje en UI inmediatamente
    const optimistic: ChatMessage = {
      id: `opt-${Date.now()}`,
      senderRole: myRole,
      content: text || null,
      mediaUrl: null,
      mediaType: null,
      mediaFilename: null,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);
    setInput("");

    try {
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        if (text) fd.append("content", text);
        const res = await apiFetch(`/chat/${clientId}/upload`, {method:"POST", body:fd});
        if (!res.ok) throw new Error(`Error ${res.status}`);
        setFile(null);
      } else {
        const res = await apiFetch(`/chat/${clientId}/message`, {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({content:text}),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({})) as {message?:string};
          throw new Error(d.message ?? `Error ${res.status}`);
        }
      }
      // Reemplazar mensaje optimista con versión real
      await load.current();
    } catch (e) {
      // Revertir optimistic si falla
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setInput(text);
      setChatErr(e instanceof Error ? e.message : "No se pudo enviar el mensaje.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Toast notifications — esquina inferior derecha, sobre el botón */}
      <div className="fixed bottom-24 right-5 z-50 flex flex-col items-end gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto flex max-w-[260px] items-start gap-2.5 rounded-2xl bg-[#17120d] px-4 py-3 text-[#f4f1ea] shadow-2xl"
            style={{animation:"slideInRight 0.3s ease"}}>
            <span className="mt-0.5 text-base">💬</span>
            <div className="min-w-0 flex-1">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#a87d49]">{displayName}</div>
              <div className="truncate text-[12.5px] leading-snug">{t.text}</div>
            </div>
            <button className="mt-0.5 text-[#9a9186] hover:text-white leading-none"
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}>✕</button>
          </div>
        ))}
      </div>

      {/* Botón flotante */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#17120d] text-white shadow-2xl transition-all hover:scale-105 hover:bg-[#2a2118] active:scale-95"
        title={open ? "Cerrar chat" : `Chat con ${displayName}`}
      >
        <span className="text-2xl select-none">{open ? "✕" : "💬"}</span>
        {unread > 0 && !open && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#a87d49] text-[10px] font-bold">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Panel de chat flotante */}
      {open && (
        <div className="fixed bottom-24 right-5 z-50 flex w-[360px] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/10"
          style={{maxHeight:"520px", animation:"slideUpChat 0.22s ease"}}>

          {/* Header */}
          <div className="flex flex-none items-center gap-3 bg-[#17120d] px-5 py-3.5 text-[#f4f1ea]">
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#a87d49] text-sm font-bold">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-semibold truncate">{displayName}</div>
              <div className="text-[10px] text-[#9a9186]">{myRole==="coach" ? "Clienta" : "Head Coach"}</div>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-[#4caf50]" title="En línea"/>
              <button onClick={() => setOpen(false)} className="ml-2 rounded-lg p-1 text-[#9a9186] hover:text-white transition">✕</button>
            </div>
          </div>

          {/* Error banner */}
          {chatErr && (
            <div className="flex-none flex items-center gap-2 bg-[#fde8e8] px-4 py-2.5 text-[11.5px] text-[#a62020]">
              <span>⚠</span>
              <span className="flex-1">{chatErr}</span>
              <button onClick={()=>setChatErr(null)} className="font-bold">✕</button>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto bg-[#faf8f4] p-4 flex flex-col gap-2" style={{minHeight:0, maxHeight:"340px"}}>
            {!chatErr && messages.length === 0 && (
              <div className="m-auto text-center">
                <div className="text-3xl mb-2">💬</div>
                <p className="text-sm text-[#a39a8d]">Sin mensajes aún.<br/>¡Empieza la conversación!</p>
              </div>
            )}
            {messages.map(msg => {
              const isMe = msg.senderRole === myRole;
              return (
                <div key={msg.id} className={`flex ${isMe?"justify-end":"justify-start"}`}>
                  {!isMe && (
                    <div className="mr-2 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[#a87d49] text-[10px] font-bold text-white self-end mb-1">
                      {displayName.charAt(0)}
                    </div>
                  )}
                  <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 ${
                    isMe
                      ? "rounded-br-sm bg-[#17120d] text-[#f4f1ea]"
                      : "rounded-bl-sm bg-white border border-[#e7e1d6] text-[#17120d]"
                  }`}>
                    {msg.content && <p className="text-[13px] leading-relaxed break-words">{msg.content}</p>}
                    {msg.mediaUrl && msg.mediaType==="image" && (
                      <img src={`${API_BASE}${msg.mediaUrl}`} alt="" className="mt-1.5 max-h-[160px] w-full rounded-xl object-cover"/>
                    )}
                    {msg.mediaUrl && msg.mediaType==="video" && (
                      <video src={`${API_BASE}${msg.mediaUrl}`} controls className="mt-1.5 max-h-[160px] w-full rounded-xl"/>
                    )}
                    {msg.mediaUrl && (msg.mediaType==="document"||msg.mediaType==="audio") && (
                      <a href={`${API_BASE}${msg.mediaUrl}`} target="_blank" rel="noreferrer"
                        className={`mt-1.5 flex items-center gap-1.5 text-[12px] underline ${isMe?"text-[#f0e7d8]":"text-[#a87d49]"}`}>
                        📎 {msg.mediaFilename ?? msg.mediaType}
                      </a>
                    )}
                    <div className={`mt-0.5 text-[9.5px] ${isMe?"text-[#6f685c]":"text-[#b3aa9b]"}`}>{fdt(msg.createdAt)}</div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef}/>
          </div>

          {/* File preview */}
          {file && (
            <div className="flex flex-none items-center gap-2 border-t border-[#e7e1d6] bg-white px-4 py-2">
              <span className="text-lg">{file.type.startsWith("image")?"🖼":file.type.startsWith("video")?"🎬":"📎"}</span>
              <span className="flex-1 truncate text-[12px] text-[#17120d]">{file.name}</span>
              <button onClick={()=>setFile(null)} className="font-bold text-[#9a4b34] hover:text-[#6b2c1a]">✕</button>
            </div>
          )}

          {/* Input */}
          <div className="flex flex-none items-center gap-2 border-t border-[#e7e1d6] bg-white px-3 py-3">
            <input ref={fileRef} type="file" className="hidden" accept="image/*,video/*,application/pdf,audio/*"
              onChange={e=>setFile(e.target.files?.[0]??null)}/>
            <button onClick={()=>fileRef.current?.click()}
              className="flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-[#e0d9cc] text-lg transition hover:border-[#a87d49] hover:bg-[#faf6ef]"
              title="Adjuntar archivo">📎</button>
            <input
              className="flex-1 rounded-xl border border-[#e0d9cc] bg-white px-3 py-2 text-[13px] placeholder-[#b3aa9b] focus:border-[#a87d49] focus:outline-none focus:ring-2 focus:ring-[#a87d49]/15"
              placeholder="Escribe un mensaje…"
              value={input}
              onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
            />
            <button onClick={send} disabled={sending||(!input.trim()&&!file)}
              className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-[#a87d49] text-white transition hover:bg-[#946b3b] disabled:cursor-not-allowed disabled:opacity-40">
              {sending ? <span className="text-lg">⋯</span> : <span className="text-base font-bold">↑</span>}
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUpChat {
          from { opacity:0; transform:translateY(16px) scale(0.97); }
          to   { opacity:1; transform:translateY(0)   scale(1);    }
        }
        @keyframes slideInRight {
          from { opacity:0; transform:translateX(16px); }
          to   { opacity:1; transform:translateX(0);    }
        }
      `}</style>
    </>
  );
}

