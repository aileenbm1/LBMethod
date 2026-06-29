import { useEffect, useMemo, useRef, useState } from "react";
import lbMethodLogo from "./src/assets/lbmethod-logo.jpg";
import jsPDF from "jspdf";
import { fetchExerciseGif, preloadExerciseGifs } from "./src/exerciseGifs";

/* ===================================================================
   TYPES
   =================================================================== */
type Goal = "glute_hypertrophy"|"glute_growth"|"lower_body_focus"|"fat_loss"|"body_recomposition"|"muscle_gain"|"general_health";
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
interface Client { id: string; name: string; goal: Goal; experienceLevel: Level; daysPerWeek: number; gender: Gender; sessionDuration: SessionDuration; trainingLocation: TrainingLocation; bodyweightKg?: number; routineId: string|null; program: Program|null; progress: WeeklyProgress[]; pin?: string; weakPoints?: WeakPoint[]; limitations?: Limitation[]; }
interface ApiClientDashboard { client: { id: string; name?: string; email?: string; goal: Goal; experienceLevel: Level; daysPerWeek: number; gender?: Gender; sessionDuration?: number; trainingLocation?: TrainingLocation; bodyweightKg?: number; pin?: string; weakPoints?: WeakPoint[]; limitations?: Limitation[]; }; routineId: string|null; program: Program|null; progress: WeeklyProgress[]; }

/* ===================================================================
   CONSTANTS
   =================================================================== */
const GOAL_LABELS: Record<Goal, string> = {
  glute_hypertrophy:"Hipertrofia de glúteo", glute_growth:"Crecimiento de glúteo",
  lower_body_focus:"Enfoque tren inferior", fat_loss:"Pérdida de grasa",
  body_recomposition:"Recomposición corporal", muscle_gain:"Ganancia muscular",
  general_health:"Movimiento saludable",
};
const LEVEL_LABELS: Record<Level,string> = { beginner:"Principiante", intermediate:"Intermedio", advanced:"Avanzado" };
const GENDER_LABELS: Record<Gender,string> = { female:"Mujer", male:"Hombre", unspecified:"No especificar" };
const GOALS_BY_GENDER: Record<Gender, Goal[]> = {
  female: ["glute_hypertrophy","lower_body_focus","fat_loss","body_recomposition","muscle_gain","general_health"],
  male:   ["muscle_gain","fat_loss","body_recomposition","lower_body_focus","general_health"],
  unspecified: ["glute_hypertrophy","lower_body_focus","fat_loss","body_recomposition","muscle_gain","general_health"],
};
type FocusMuscleKey = "glutes"|"glute_medius"|"glute_minimus"|"hamstrings"|"quadriceps"|"calves"|"core"|"chest"|"back"|"shoulders"|"biceps"|"triceps"|"upper_body";
interface FocusOption { key: FocusMuscleKey; label: string; desc: string; suggestGoal: Goal; }
const ALL_FOCUS_OPTIONS: FocusOption[] = [
  {key:"glutes",        label:"Glúteo Mayor",    desc:"Masa y forma del glúteo mayor. Hip thrust, bisagra y alta frecuencia.",               suggestGoal:"glute_hypertrophy"},
  {key:"glute_medius",  label:"Glúteo Medio",    desc:"Anchura y estabilidad de cadera. Abducción y ejercicios unilaterales.",               suggestGoal:"glute_hypertrophy"},
  {key:"glute_minimus", label:"Glúteo Mínimo",   desc:"Estabilidad pélvica y abducción profunda. Complementa glúteo medio y mayor.",         suggestGoal:"glute_hypertrophy"},
  {key:"hamstrings",    label:"Isquiotibiales",  desc:"Fuerza y definición posterior de pierna. Peso muerto y curl femoral.",                suggestGoal:"lower_body_focus"},
  {key:"quadriceps",    label:"Cuádriceps",      desc:"Volumen frontal de pierna. Sentadillas, prensa y hack squat.",                        suggestGoal:"lower_body_focus"},
  {key:"calves",        label:"Pantorrillas",    desc:"Desarrollo de gemelos y sóleo. Elevaciones de talón en todas sus variantes.",         suggestGoal:"lower_body_focus"},
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
  general_health:"Cuerpo completo, intensidad moderada. Ideal para empezar o moverse con bienestar.",
};
const SESSION_DURATION_OPTIONS: {v:SessionDuration;l:string}[] = [{v:45,l:"45 min"},{v:60,l:"60 min"},{v:75,l:"75 min"},{v:90,l:"90 min"}];
const PATTERN_LABELS: Record<MovementPattern,string> = {
  hip_thrust:"Hip Thrust", hip_hinge:"Hip Hinge / Bisagra", knee_dominant:"Dominante de rodilla",
  abduction:"Abducción", unilateral:"Unilateral / Desplantes", horizontal_push:"Empuje horizontal",
  vertical_push:"Empuje vertical", horizontal_pull:"Jalón horizontal", vertical_pull:"Jalón vertical", core:"Core",
};
const SEVERITY_LABELS: Record<LimitationSeverity,string> = { mild:"Leve", moderate:"Moderada", severe:"Severa" };
const STEP_LABELS: Record<CoachStep,string> = { 1:"Agregar asesorado", 2:"Generar rutina", 3:"Descargar rutina", 4:"Acceso asesorado" };
const FOCUS_LABELS: Record<string,string> = {
  glute_hamstring:"Glúteo · Isquiotibiales", glute_quad:"Glúteo · Cuádriceps",
  glute_specialization:"Especialización glúteo", glute_heavy:"Glúteo pesado",
  glute_metabolic:"Glúteo metabólico", upper_body:"Tren superior",
  back_shoulder:"Espalda · Hombros", back_biceps:"Espalda · Bíceps",
  shoulder_triceps:"Hombros · Tríceps", chest_triceps:"Pecho · Tríceps",
  full_leg:"Pierna completa", legs_push:"Cuádriceps · Pierna",
};
const PORTAL_TABS: {id: PortalTab; label: string}[] = [
  {id:"rutina", label:"Mi entrenamiento"},
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
const COACH_WHATSAPP = import.meta.env.VITE_COACH_WHATSAPP ?? "524733543649";

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
function mapApiClient(p:ApiClientDashboard):Client{return{id:p.client.id,name:p.client.name?.trim()||p.client.email||"Asesorado",goal:p.client.goal,experienceLevel:p.client.experienceLevel,daysPerWeek:p.client.daysPerWeek,gender:(p.client.gender??"unspecified") as Gender,sessionDuration:([45,60,75,90].includes(p.client.sessionDuration??0)?p.client.sessionDuration:60) as SessionDuration,trainingLocation:p.client.trainingLocation??"gym",bodyweightKg:p.client.bodyweightKg,pin:p.client.pin,routineId:p.routineId,program:p.program,progress:p.progress??[],weakPoints:p.client.weakPoints??[],limitations:p.client.limitations??[]};}
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

/** 1RM estimado con la fórmula de Epley. Solo válido para 1-10 reps. */
function estimatedOneRM(weightKg: number, reps: number): number | null {
  if(reps<=0||reps>10||weightKg<=0)return null;
  if(reps===1)return weightKg;
  return Math.round(weightKg*(1+reps/30)*10)/10;
}

/** Mejor 1RM estimado de un conjunto de sets. */
function bestOneRM(sets:{weightKg:number;reps:number;completed:boolean}[]): number | null {
  const estimates=sets.filter(s=>s.completed&&s.reps>=1&&s.reps<=10&&s.weightKg>0)
    .map(s=>estimatedOneRM(s.weightKg,s.reps)??0).filter(v=>v>0);
  return estimates.length>0?Math.max(...estimates):null;
}

/** Sugiere un rango de carga inicial basado en peso corporal, nivel y rol del ejercicio. */
function suggestedLoad(equipment: string, category: string, level: Level, bwKg: number): string | null {
  if(!bwKg || bwKg <= 0) return null;
  // Solo para ejercicios con carga externa
  if(!["barbell","dumbbell","machine","smith","cable","kettlebell"].includes(equipment)) return null;
  type Pct = [number, number]; // [min%, max%] del peso corporal
  const PCT: Record<string, Record<Level, Pct>> = {
    barbell:    { beginner:[0.3,0.5], intermediate:[0.5,0.8], advanced:[0.7,1.2] },
    smith:      { beginner:[0.3,0.5], intermediate:[0.5,0.8], advanced:[0.7,1.2] },
    dumbbell:   { beginner:[0.1,0.2], intermediate:[0.15,0.3], advanced:[0.25,0.45] },
    machine:    { beginner:[0.4,0.6], intermediate:[0.6,0.9], advanced:[0.8,1.3] },
    cable:      { beginner:[0.1,0.2], intermediate:[0.15,0.3], advanced:[0.2,0.4] },
    kettlebell: { beginner:[0.15,0.25], intermediate:[0.2,0.35], advanced:[0.3,0.5] },
  };
  if(category === "isolation") return null; // aislamiento: sin sugerencia
  const pct = PCT[equipment]?.[level];
  if(!pct) return null;
  const lo = Math.round(bwKg * pct[0] / 2.5) * 2.5;
  const hi = Math.round(bwKg * pct[1] / 2.5) * 2.5;
  if(lo <= 0 || hi <= 0) return null;
  return `~${lo}–${hi} kg`;
}

/* Gráfica SVG de línea — progresión de carga por ejercicio */
function LineChart({data,yUnit="kg"}:{data:{label:string;value:number}[];yUnit?:string}){
  if(data.length===0)return null;
  const W=280,H=110,PL=36,PR=8,PT=12,PB=28;
  const maxV=Math.max(...data.map(d=>d.value),1);
  const xs=(i:number)=>data.length===1?(W-PL-PR)/2+PL:PL+i*(W-PL-PR)/(data.length-1);
  const ys=(v:number)=>PT+(1-v/maxV)*(H-PT-PB);
  const pathD=data.map((d,i)=>`${i===0?"M":"L"}${xs(i).toFixed(1)} ${ys(d.value).toFixed(1)}`).join(" ");
  const mid=Math.round(maxV/2);
  return(
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible">
      {/* Grid */}
      {[0,mid,maxV].map((v,i)=><line key={i} x1={PL} y1={ys(v)} x2={W-PR} y2={ys(v)} stroke="#ece6db" strokeWidth={0.8}/>)}
      {/* Y labels */}
      {[0,mid,maxV].map((v,i)=><text key={i} x={PL-4} y={ys(v)+4} textAnchor="end" fontSize={8} fill="#9a9186">{v}{yUnit}</text>)}
      {/* Line */}
      {data.length>1&&<path d={pathD} fill="none" stroke="#a87d49" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>}
      {/* Área bajo la curva */}
      {data.length>1&&<path d={`${pathD} L${xs(data.length-1).toFixed(1)} ${H-PB} L${xs(0).toFixed(1)} ${H-PB} Z`} fill="#a87d49" fillOpacity={0.08}/>}
      {/* Dots + valores + etiquetas */}
      {data.map((d,i)=>(
        <g key={i}>
          <circle cx={xs(i)} cy={ys(d.value)} r={3.5} fill="#a87d49" stroke="white" strokeWidth={1.5}/>
          {d.value>0&&<text x={xs(i)} y={ys(d.value)-7} textAnchor="middle" fontSize={8} fill="#a87d49" fontWeight="700">{d.value}{yUnit}</text>}
          <text x={xs(i)} y={H-PB+12} textAnchor="middle" fontSize={7.5} fill="#8c8377">{d.label}</text>
        </g>
      ))}
    </svg>
  );
}

/* Gráfica de barras — adherencia semanal */
function BarChart({data}:{data:{label:string;pct:number}[]}){
  if(data.length===0)return null;
  const BAR_W=data.length>6?24:32;
  const GAP=data.length>6?6:10;
  const W=Math.max(200,(BAR_W+GAP)*data.length+20),H=80,PB=22,PT=8;
  const barH=(pct:number)=>((H-PB-PT)*pct/100);
  return(
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible">
      {data.map((d,i)=>{
        const x=10+i*(BAR_W+GAP);
        const bh=barH(d.pct);
        const y=H-PB-bh;
        return(
          <g key={i}>
            <rect x={x} y={y} width={BAR_W} height={Math.max(bh,1)} rx={4} fill={d.pct>=80?"#a87d49":d.pct>=50?"#c4a06a":"#ece6db"}/>
            {d.pct>0&&<text x={x+BAR_W/2} y={y-3} textAnchor="middle" fontSize={8} fill="#a87d49" fontWeight="700">{d.pct}%</text>}
            <text x={x+BAR_W/2} y={H-PB+12} textAnchor="middle" fontSize={7.5} fill="#8c8377">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

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

  // ── Info del asesorado ──
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
      (client.goal==="glute_hypertrophy"||client.goal==="glute_growth")
        ? `Series glúteo: ${week.volume.weeklyGluteSets}   ·   Frecuencia glúteo: ${week.volume.gluteFrequency}×/sem   ·   Tren inferior: ${Math.round(week.volume.lowerVolumePct*100)}%`
        : `Series totales: ${week.days.reduce((s,d)=>s+d.totalSets,0)}   ·   Tren inferior: ${Math.round(week.volume.lowerVolumePct*100)}%   ·   Tren superior: ${Math.round(week.volume.upperVolumePct*100)}%`,
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
        const rowH = hasMethod ? 16 : 8;

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

        // Prescripción + carga sugerida
        const loadHint = client.bodyweightKg
          ? suggestedLoad((sel as any).exercise.equipment??"", (sel as any).exercise.category??"", client.experienceLevel, client.bodyweightKg)
          : null;
        const presc = `${sel.sets}×${sel.repsMin}–${sel.repsMax}  RIR ${sel.rir}${loadHint ? `  ·  ${loadHint}` : ""}`;
        doc.setTextColor(...R.mid);
        doc.setFontSize(8);
        doc.text(presc, ML + CW - 3, y + 3.5, {align:"right"});

        y += 6.5;

        // Nota del método de entrenamiento
        if (hasMethod && sel.methodConfig) {
          const methodTag = `${sel.methodConfig.labelEs}: `;
          // Limpiar caracteres Unicode que jsPDF no soporta (→ ≥ ≤ etc.)
          const fullNote = sel.methodConfig.prescriptionNote
            .replace(/→/g, "->").replace(/←/g, "<-")
            .replace(/[""]/g, '"').replace(/['']/g, "'")
            .replace(/[^\x00-\xFF]/g, "?");
          const noteX = ML + 27;
          const noteMaxW = CW - 32;

          doc.setFontSize(7);
          doc.setFont("helvetica","bold");
          const tagW = doc.getTextWidth(methodTag);

          doc.setFont("helvetica","normal");
          // Dividir solo la nota (sin el tag) en el ancho disponible
          const availableW = noteMaxW - tagW;
          const noteLines: string[] = doc.splitTextToSize(fullNote, availableW > 20 ? availableW : noteMaxW);
          const visibleLines = noteLines.slice(0, 2);
          const blockH = visibleLines.length * 4.8 + 3;

          doc.setFillColor(254, 243, 226);
          doc.rect(ML + 26, y - 1, CW - 27, blockH, "F");

          doc.setTextColor(...R.gold);
          doc.setFont("helvetica","bold");
          doc.setFontSize(7);
          doc.text(methodTag, noteX, y + 3);

          doc.setTextColor(100, 85, 60);
          doc.setFont("helvetica","normal");
          doc.setFontSize(6.8);
          // Primera línea: después del tag
          doc.text(visibleLines[0] ?? "", noteX + tagW, y + 3);
          // Segunda línea: sangría izquierda con el tag
          if (visibleLines[1]) doc.text(visibleLines[1], noteX + tagW, y + 7.2);

          y += blockH;
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
  const isAsesoradoRoute = window.location.pathname.startsWith("/asesorado");
  const isRegistroRoute = window.location.pathname.startsWith("/registro");
  const registroToken = isRegistroRoute ? window.location.pathname.split("/registro/")[1]?.trim() : null;
  const [authRole, setAuthRole] = useState<AuthRole>(isAsesoradoRoute?"client":"coach");
  void setAuthRole; // usado en login de coach cuando expira sesión
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
  const [wizInjuries, setWizInjuries] = useState<Set<string>>(new Set());
  const [wizMonthsTrained, setWizMonthsTrained] = useState<string>("");
  const [wizWeight, setWizWeight] = useState<string>("");
  const [wizAge, setWizAge] = useState<string>("");
  const [wizHomeEquipment, setWizHomeEquipment] = useState<Set<string>>(new Set());
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
  const [savedExercises, setSavedExercises] = useState<Set<string>>(new Set());
  const [sessionComplete, setSessionComplete] = useState(false);

  /* --- Modal de imagen de ejercicio --- */
  const [exerciseModal, setExerciseModal] = useState<{name:string;imageUrl?:string;videoUrl?:string}|null>(null);
  /* --- GIFs de ejercicios cargados dinámicamente --- */
  const [gifMap, setGifMap] = useState<Record<string,string|null>>({});

  /* --- Swap de ejercicio (portal asesorado) --- */
  const [swapTarget, setSwapTarget] = useState<{weekNumber:number;dayIndex:number;sel:Selection;routineId:string}|null>(null);
  const [swapOptions, setSwapOptions] = useState<LibraryExercise[]>([]);
  const [swapLoading, setSwapLoading] = useState(false);
  const [swapSaving, setSwapSaving] = useState(false);

  /* --- History --- */
  const [historyExercise, setHistoryExercise] = useState("");
  const [historyData, setHistoryData] = useState<ExerciseLogRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  /* --- Peso corporal --- */
  const [weightLogs, setWeightLogs] = useState<{id:string;weightKg:number;notes?:string;loggedAt:string}[]>([]);
  const [newWeight, setNewWeight] = useState("");
  const [weightNote, setWeightNote] = useState("");
  const [weightSaving, setWeightSaving] = useState(false);

  /* --- Notas del coach --- */
  const [coachNotes, setCoachNotes] = useState<Record<string,string>>({});
  const [editingNote, setEditingNote] = useState<{key:string;text:string}|null>(null);
  const [noteSaving, setNoteSaving] = useState(false);

  /* --- Feedback post-sesión --- */
  const [sessionFeedbacks, setSessionFeedbacks] = useState<Record<string,string>>({});
  const [feedbackSaving, setFeedbackSaving] = useState(false);

  /* --- Dashboard alertas --- */
  const [dashboardData, setDashboardData] = useState<{id:string;name:string;goal:string;lastSession:string|null;inactive:boolean}[]>([]);
  const [, setDashboardLoading] = useState(false);

  /* --- Timer de descanso --- */
  const [restTimer, setRestTimer] = useState<{secs:number;total:number;label:string}|null>(null);
  const restTimerRef = useRef<ReturnType<typeof setInterval>|null>(null);

  /* --- Récord personal (PR) --- */
  const [prAlert, setPrAlert] = useState<{name:string;kg:number;prev:number}|null>(null);

  /* --- Check-in semanal --- */
  type CheckIn = {id:string;weekNumber:number;energy:number;sleep:number;stress:number;notes?:string;createdAt:string};
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [checkInForm, setCheckInForm] = useState({energy:3,sleep:3,stress:3,notes:""});
  const [checkInSaving, setCheckInSaving] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);

  /* --- Registro público (formulario de invitación) --- */
  type InviteStatus = "verifying"|"valid"|"invalid"|"submitting"|"done";
  const [inviteStatus, setInviteStatus] = useState<InviteStatus>("verifying");
  const [inviteError, setInviteError] = useState("");
  const [regForm, setRegForm] = useState({name:"",goal:"glute_hypertrophy" as Goal,gender:"unspecified" as Gender,experienceLevel:"beginner" as Level,daysPerWeek:4,sessionDuration:60 as SessionDuration,trainingLocation:"gym" as TrainingLocation,age:"",bodyweightKg:"",monthsTrained:"",homeEquipment:new Set<string>(),injuries:new Set<string>(),focusMuscle:"" as FocusMuscleKey|""});
  const [regSubmitted, setRegSubmitted] = useState<{pin:string;name:string}|null>(null);

  /* --- Gestión de invitaciones (coach) --- */
  type InviteRecord = {id:string;token:string;note?:string;expiresAt:string;usedAt?:string;createdUserId?:string;createdAt:string};
  const [invites, setInvites] = useState<InviteRecord[]>([]);
  const [inviteNote, setInviteNote] = useState("");
  const [inviteGenerating, setInviteGenerating] = useState(false);
  const [showInvitePanel, setShowInvitePanel] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState<string|null>(null);

  /* --- Templates de rutinas --- */
  type Template = {id:string;name:string;goal:string;level:string;daysPerWeek:number;totalWeeks:number;createdAt:string};
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateSaving, setTemplateSaving] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState<Template|null>(null);
  const [applyClientId, setApplyClientId] = useState("");

  /* --- Medidas corporales --- */
  type MeasLog = {id:string;hipCm?:number;waistCm?:number;thighCm?:number;armCm?:number;chestCm?:number;notes?:string;loggedAt:string};
  const [measurementLogs, setMeasurementLogs] = useState<MeasLog[]>([]);
  const [measForm, setMeasForm] = useState({hip:"",waist:"",thigh:"",arm:"",chest:"",notes:""});
  const [measSaving, setMeasSaving] = useState(false);

  /* --- Fotos de progreso --- */
  const [progressPhotos, setProgressPhotos] = useState<{id:string;url:string;notes?:string;takenAt:string}[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoNote, setPhotoNote] = useState("");
  const [compareMode, setCompareMode] = useState(false);

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
      if(res.status===404||res.status===401){
        setAuthSession(null);
        setError("Tu cuenta ya no está registrada. Pide a tu coach que te agregue de nuevo.");
        return[];
      }
      if(!res.ok)throw new Error(`Error ${res.status}`);
      const d=await res.json() as {usuario:ApiClientDashboard};
      const c=mapApiClient(d.usuario);setClients([c]);return[c];
    }
    const res=await apiFetch("/usuarios");
    if(!res.ok)throw new Error(`Error ${res.status}`);
    const d=await res.json() as {usuarios:ApiClientDashboard[]};
    const ds=d.usuarios.map(mapApiClient);setClients(ds);return ds;
  }

  useEffect(()=>{if(registroToken)verifyInviteToken(registroToken);},[]);
  useEffect(()=>{refreshClients().catch(e=>setError(e instanceof Error?e.message:"Error"));},[authSession]);
  useEffect(()=>{if(!authSession){sessionStorage.removeItem(SESSION_KEY);return;}sessionStorage.setItem(SESSION_KEY,JSON.stringify(authSession));},[authSession]);
  useEffect(()=>{if(!clients.some(c=>c.id===selectedClientId))setSelectedClientId(clients[0]?.id??"");},[clients]);
  useEffect(()=>{
    if(selectedClientId&&authSession?.role==="coach"){
      loadCoachNotes(selectedClientId);
      loadCheckIns(selectedClientId);
    }
  },[selectedClientId]);

  // Precargar GIFs cuando hay un programa disponible (portal asesorado o step 3)
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
  useEffect(()=>{
    if(authSession?.role==="client"&&authSession.clientId){
      setSelectedClientId(authSession.clientId);
      setActiveTab("portal");
      loadWeightLogs(authSession.clientId);
      loadProgressPhotos(authSession.clientId);
      loadMeasurements(authSession.clientId);
      loadCheckIns(authSession.clientId);
      // Cargar feedback previo
      apiFetch(`/usuario/${authSession.clientId}/feedback`).then(r=>r.json()).then((d:any)=>{
        if(d.feedbacks){const m:Record<string,string>={};for(const f of d.feedbacks)m[`${f.weekNumber}-${f.dayIndex}`]=f.feeling;setSessionFeedbacks(m);}
      }).catch(()=>{});
      // Cargar notas del coach
      loadCoachNotes(authSession.clientId);
    }
    if(authSession?.role==="coach"){
      loadDashboard();
      loadTemplates();
      loadInvites();
    }
  },[authSession]);
  // Pre-llenar personalización cuando se selecciona asesorado en Step 2
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
      const alreadySaved=new Set<string>();
      for(const log of d.logs){
        newLogs[log.exerciseName]=log.setsData;
        newNotes[log.exerciseName]=log.notes??"";
        alreadySaved.add(log.exerciseName);
      }
      setExerciseLogs(newLogs);
      setLogNotes(newNotes);
      // Marcar como guardados los ejercicios que ya tienen log
      if(alreadySaved.size>0) setSavedExercises(alreadySaved);
    }catch{}finally{setDayLogsLoaded(true);}
  }

  const portalClientId = authSession?.role==="client"?authSession.clientId:selectedClientId;

  useEffect(()=>{
    if((portalTab!=="registrar"&&portalTab!=="rutina")||!portalClientId)return;
    // Reset local state — loadDayLogs poblará savedExercises desde la DB
    setSavedExercises(new Set());setSessionComplete(false);setExerciseLogs({});setLogNotes({});
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

  async function saveExerciseLog(exerciseName:string, allNames?: string[]){
    if(!portalClientId)return;
    const sets=exerciseLogs[exerciseName];
    if(!sets||sets.length===0)return;
    setLogSaving(true);
    try{
      const res=await apiFetch(`/usuario/${portalClientId}/logs`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({weekNumber:logWeek,dayIndex:logDay,exerciseName,setsData:sets,notes:logNotes[exerciseName]||""})});
      const d=await res.json().catch(()=>({})) as {isPR?:boolean;newMaxKg?:number;previousBest?:number};
      if(d.isPR && d.newMaxKg) setPrAlert({name:tx(exerciseName),kg:d.newMaxKg,prev:d.previousBest??0});
      setSavedExercises(prev=>{
        const next=new Set(prev);next.add(exerciseName);
        if(allNames && next.size>=allNames.length) setSessionComplete(true);
        return next;
      });
    }catch(e){setError(e instanceof Error?e.message:"Error al guardar")}
    finally{setLogSaving(false);}
  }

  async function saveFullSession(names: string[]){
    if(!portalClientId||names.length===0)return;
    setLogSaving(true);setError(null);
    try{
      for(const name of names){
        const sets=exerciseLogs[name];
        if(!sets||sets.length===0)continue;
        await apiFetch(`/usuario/${portalClientId}/logs`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({weekNumber:logWeek,dayIndex:logDay,exerciseName:name,setsData:sets,notes:logNotes[name]||""})});
        setSavedExercises(prev=>{const next=new Set(prev);next.add(name);return next;});
      }
      setSessionComplete(true);
    }catch(e){setError(e instanceof Error?e.message:"Error al guardar sesión")}
    finally{setLogSaving(false);}
  }

  async function loadWeightLogs(clientId:string){
    try{
      const res=await apiFetch(`/usuario/${clientId}/peso`);
      if(!res.ok)return;
      const d=await res.json() as {logs:{id:string;weightKg:number;notes?:string;loggedAt:string}[]};
      setWeightLogs(d.logs);
    }catch{}
  }

  async function saveWeight(){
    if(!portalClientId||!newWeight||isNaN(Number(newWeight)))return;
    setWeightSaving(true);
    try{
      await apiFetch(`/usuario/${portalClientId}/peso`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({weightKg:Number(newWeight),notes:weightNote||undefined})});
      setNewWeight("");setWeightNote("");
      await loadWeightLogs(portalClientId);
    }catch(e){setError(e instanceof Error?e.message:"Error al guardar peso")}
    finally{setWeightSaving(false);}
  }

  async function loadCoachNotes(clientId:string){
    try{
      const res=await apiFetch(`/usuario/${clientId}/coach-notes`);
      if(!res.ok)return;
      const d=await res.json() as {notes:{weekNumber:number;dayIndex:number;note:string}[]};
      const map:Record<string,string>={};
      for(const n of d.notes) map[`${n.weekNumber}-${n.dayIndex}`]=n.note;
      setCoachNotes(map);
    }catch{}
  }

  async function saveCoachNote(clientId:string,weekNumber:number,dayIndex:number,note:string){
    setNoteSaving(true);
    try{
      await apiFetch(`/usuario/${clientId}/coach-note`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({weekNumber,dayIndex,note})});
      setCoachNotes(prev=>({...prev,[`${weekNumber}-${dayIndex}`]:note}));
      setEditingNote(null);
    }catch(e){setError(e instanceof Error?e.message:"Error al guardar nota")}
    finally{setNoteSaving(false);}
  }

  async function saveFeedback(feeling:string,weekNumber:number,dayIndex:number){
    if(!portalClientId)return;
    setFeedbackSaving(true);
    try{
      await apiFetch(`/usuario/${portalClientId}/feedback`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({weekNumber,dayIndex,feeling})});
      setSessionFeedbacks(prev=>({...prev,[`${weekNumber}-${dayIndex}`]:feeling}));
    }catch{}
    finally{setFeedbackSaving(false);}
  }

  // ── Registro público ─────────────────────────────────────────────────────
  async function verifyInviteToken(token:string){
    setInviteStatus("verifying");
    try{
      const res=await fetch(`${API}/invites/verify/${token}`);
      const d=await res.json() as {valid?:boolean;error?:string};
      if(!res.ok||!d.valid){setInviteError(d.error??"Invitación inválida.");setInviteStatus("invalid");return;}
      setInviteStatus("valid");
    }catch{setInviteError("No se pudo verificar la invitación.");setInviteStatus("invalid");}
  }

  async function submitRegistro(){
    if(!registroToken)return;
    setInviteStatus("submitting");
    try{
      const monthsMap:Record<string,number>={"Menos de 6 meses":3,"6–12 meses":9,"1–2 años":18,"Más de 2 años":30};
      const body:Record<string,unknown>={
        name:regForm.name.trim(),goal:regForm.goal,experienceLevel:regForm.experienceLevel,
        daysPerWeek:regForm.daysPerWeek,gender:regForm.gender,sessionDuration:regForm.sessionDuration,
        trainingLocation:regForm.trainingLocation,
        age:regForm.age?Number(regForm.age):undefined,
        bodyweightKg:regForm.bodyweightKg?Number(regForm.bodyweightKg):undefined,
        monthsTrained:regForm.monthsTrained?monthsMap[regForm.monthsTrained]:undefined,
        homeEquipment:regForm.trainingLocation==="home"&&regForm.homeEquipment.size>0?[...regForm.homeEquipment]:undefined,
        limitations:[...regForm.injuries].map(z=>({description:`Molestia en ${z}`,affectedPatterns:["knee_dominant","hip_hinge"],severity:"mild"})),
        weakPoints:regForm.focusMuscle&&regForm.focusMuscle!=="upper_body"?[{muscleGroup:regForm.focusMuscle,priority:3}]:undefined,
      };
      const res=await fetch(`${API}/invites/${registroToken}/registro`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const d=await res.json() as {client?:{name:string};generatedPin?:string;error?:string};
      if(!res.ok) throw new Error(d.error??"Error al enviar formulario.");
      setRegSubmitted({pin:d.generatedPin??"",name:d.client?.name??regForm.name});
      setInviteStatus("done");
    }catch(e){setInviteError(e instanceof Error?e.message:"Error");setInviteStatus("valid");}
  }

  // ── Invitaciones del coach ────────────────────────────────────────────────
  async function loadInvites(){
    try{
      const res=await apiFetch("/invites");
      if(!res.ok)return;
      const d=await res.json() as {invites:InviteRecord[]};
      setInvites(d.invites);
    }catch{}
  }

  async function generateInvite(){
    setInviteGenerating(true);
    try{
      const res=await apiFetch("/invites",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({note:inviteNote.trim()||undefined})});
      if(!res.ok)return;
      setInviteNote("");
      await loadInvites();
    }catch{}
    finally{setInviteGenerating(false);}
  }

  async function revokeInvite(id:string){
    try{
      await apiFetch(`/invites/${id}`,{method:"DELETE"});
      setInvites(prev=>prev.filter(i=>i.id!==id));
    }catch{}
  }

  function copyInviteLink(token:string){
    const url=`https://lb-method.vercel.app/registro/${token}`;
    navigator.clipboard.writeText(url).then(()=>{setCopiedInvite(token);setTimeout(()=>setCopiedInvite(null),2500);});
  }

  async function loadCheckIns(clientId:string){
    try{
      const res=await apiFetch(`/usuario/${clientId}/checkins`);
      if(!res.ok)return;
      const d=await res.json() as {checkIns:CheckIn[]};
      setCheckIns(d.checkIns);
    }catch{}
  }

  async function saveCheckIn(weekNumber:number){
    if(!portalClientId)return;
    setCheckInSaving(true);
    try{
      await apiFetch(`/usuario/${portalClientId}/checkin`,{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({weekNumber,...checkInForm})});
      setShowCheckIn(false);
      await loadCheckIns(portalClientId);
    }catch(e){setError(e instanceof Error?e.message:"Error")}
    finally{setCheckInSaving(false);}
  }

  async function loadTemplates(){
    try{
      const res=await apiFetch("/templates");
      if(!res.ok)return;
      const d=await res.json() as {templates:Template[]};
      setTemplates(d.templates);
    }catch{}
  }

  async function saveAsTemplate(){
    if(!flowProgram||!templateName.trim())return;
    setTemplateSaving(true);
    try{
      await apiFetch("/templates",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({name:templateName.trim(),goal:flowProgram.goal,level:flowProgram.level,daysPerWeek:flowProgram.daysPerWeek,totalWeeks:flowProgram.weeks.length,payload:flowProgram})});
      setTemplateName("");setShowTemplateModal(false);
      await loadTemplates();
    }catch(e){setError(e instanceof Error?e.message:"Error al guardar template")}
    finally{setTemplateSaving(false);}
  }

  async function applyTemplate(){
    if(!applyingTemplate||!applyClientId)return;
    setTemplateSaving(true);
    try{
      await apiFetch(`/templates/${applyingTemplate.id}/aplicar`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({clientId:applyClientId})});
      setShowApplyModal(false);setApplyingTemplate(null);setApplyClientId("");
      await refreshClients();
    }catch(e){setError(e instanceof Error?e.message:"Error al aplicar template")}
    finally{setTemplateSaving(false);}
  }

  async function deleteTemplate(id:string){
    try{
      await apiFetch(`/templates/${id}`,{method:"DELETE"});
      setTemplates(prev=>prev.filter(t=>t.id!==id));
    }catch{}
  }

  async function loadMeasurements(clientId:string){
    try{
      const res=await apiFetch(`/usuario/${clientId}/medidas`);
      if(!res.ok)return;
      const d=await res.json() as {logs:MeasLog[]};
      setMeasurementLogs(d.logs);
    }catch{}
  }

  async function saveMeasurement(){
    if(!portalClientId)return;
    const {hip,waist,thigh,arm,chest,notes}=measForm;
    if(!hip&&!waist&&!thigh&&!arm&&!chest)return;
    setMeasSaving(true);
    try{
      await apiFetch(`/usuario/${portalClientId}/medidas`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        hipCm:hip?Number(hip):undefined,waistCm:waist?Number(waist):undefined,
        thighCm:thigh?Number(thigh):undefined,armCm:arm?Number(arm):undefined,
        chestCm:chest?Number(chest):undefined,notes:notes||undefined,
      })});
      setMeasForm({hip:"",waist:"",thigh:"",arm:"",chest:"",notes:""});
      await loadMeasurements(portalClientId);
    }catch(e){setError(e instanceof Error?e.message:"Error al guardar")}
    finally{setMeasSaving(false);}
  }

  function startRestTimer(role:string, exerciseName:string){
    if(restTimerRef.current) clearInterval(restTimerRef.current);
    const REST: Record<string,number> = { main:120, unilateral:90, isolation:60, accessory:60 };
    const secs = REST[role] ?? 90;
    setRestTimer({secs, total:secs, label:exerciseName});
    restTimerRef.current = setInterval(()=>{
      setRestTimer(prev=>{
        if(!prev) return null;
        if(prev.secs<=1){
          clearInterval(restTimerRef.current!);
          // Vibrar cuando termina (móvil)
          if(navigator.vibrate) navigator.vibrate([200,100,200]);
          return null;
        }
        return {...prev, secs:prev.secs-1};
      });
    }, 1000);
  }

  async function loadProgressPhotos(clientId:string){
    try{
      const res=await apiFetch(`/usuario/${clientId}/fotos`);
      if(!res.ok)return;
      const d=await res.json() as {photos:{id:string;url:string;notes?:string;takenAt:string}[]};
      setProgressPhotos(d.photos);
    }catch{}
  }

  async function uploadPhoto(file:File){
    if(!portalClientId)return;
    setPhotoUploading(true);setError(null);
    try{
      const form=new FormData();
      form.append("photo",file);
      if(photoNote.trim())form.append("notes",photoNote.trim());
      const token=authSession?.token??"";
      const res=await fetch(`${API}/usuario/${portalClientId}/fotos`,{method:"POST",headers:{Authorization:`Bearer ${token}`},body:form});
      if(!res.ok){const d=await res.json().catch(()=>({})) as Record<string,string>;throw new Error(d.error??"Error al subir foto");}
      setPhotoNote("");
      await loadProgressPhotos(portalClientId);
    }catch(e){setError(e instanceof Error?e.message:"Error al subir")}
    finally{setPhotoUploading(false);}
  }

  async function deletePhoto(photoId:string){
    if(!portalClientId)return;
    try{
      await apiFetch(`/usuario/${portalClientId}/fotos/${photoId}`,{method:"DELETE"});
      setProgressPhotos(prev=>prev.filter(p=>p.id!==photoId));
    }catch{}
  }

  async function loadDashboard(){
    setDashboardLoading(true);
    try{
      const res=await apiFetch("/dashboard");
      if(!res.ok)return;
      const d=await res.json() as {dashboard:{id:string;name:string;goal:string;lastSession:string|null;inactive:boolean}[]};
      setDashboardData(d.dashboard);
    }catch{}
    finally{setDashboardLoading(false);}
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
      if(!c){setError("Selecciona un asesorado.");return;}
      setFlowClient(c);setGoal(c.goal);setLevel(c.experienceLevel);setDays(c.daysPerWeek);setCoachStep(2);return;
    }
    const name=newClientName.trim();if(!name){setError("Escribe el nombre.");return;}

    // Verificar duplicado por nombre (búsqueda case-insensitive)
    const dup=clients.find(c=>c.name.trim().toLowerCase()===name.toLowerCase());
    if(dup){setDuplicateWarning(dup);return;}
    setDuplicateWarning(null);
    setLoading(true);
    try{
      const injuryNotes=[...wizInjuries].length>0?`Lesiones/molestias: ${[...wizInjuries].join(", ")}.`:"";
      const historyNotes=wizMonthsTrained?`Historial: ${wizMonthsTrained}.`:"";
      const notes=[injuryNotes,historyNotes].filter(Boolean).join(" ")||undefined;
      const injuryLimitations=[...wizInjuries].map(zone=>({description:`Molestia en ${zone}`,affectedPatterns:["knee_dominant","hip_hinge","hip_thrust","unilateral","horizontal_push","vertical_push","horizontal_pull","vertical_pull"].slice(0,2),severity:"mild" as const}));
      const bodyweightKg=wizWeight&&!isNaN(Number(wizWeight))&&Number(wizWeight)>0?Number(wizWeight):undefined;
      const age=wizAge&&!isNaN(Number(wizAge))&&Number(wizAge)>0?Number(wizAge):undefined;
      // Convertir historial de texto a meses numéricos
      const monthsMap:Record<string,number>={"Menos de 6 meses":3,"6–12 meses":9,"1–2 años":18,"Más de 2 años":30};
      const monthsTrained=wizMonthsTrained?monthsMap[wizMonthsTrained]:undefined;
      // Equipamiento en casa
      const homeEquipment=wizTrainingLocation==="home"&&wizHomeEquipment.size>0?[...wizHomeEquipment]:undefined;
      const res=await apiFetch("/usuario",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,goal,experienceLevel,daysPerWeek,gender:wizGender,sessionDuration:wizSessionDuration,trainingLocation:wizTrainingLocation,bodyweightKg,age,monthsTrained,homeEquipment,notes,limitations:injuryLimitations.length>0?injuryLimitations:undefined})});
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
      const data=await res.json() as {program:Program;volumeBias?:number;feedbackMessage?:string};
      setFlowProgram(data.program);
      if(data.feedbackMessage) setError(`ℹ️ ${data.feedbackMessage}`);
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
      // Buscar el programa del asesorado — puede estar en clients[] o en el portal
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
  function resetWizard(){setCoachStep(1);setFlowClient(null);setFlowProgram(null);setUseExisting(false);setNewClientName("");setGoal("glute_hypertrophy");setLevel("intermediate");setDays(4);setClientPin("");setGeneratedPin("");setPinSaved(false);setError(null);setDuplicateWarning(null);setWizGoal("glute_hypertrophy");setWizFocusMuscle(null);setWizGender("unspecified");setWizSessionDuration(60);setWizTrainingLocation("gym");setWizWeak([]);setWizPatterns([]);setWizSeverity("mild");setWizLimitDesc("");setWizInjuries(new Set());setWizMonthsTrained("");setWizWeight("");setWizAge("");setWizHomeEquipment(new Set());}
  function copyPin(p:string){navigator.clipboard.writeText(p).then(()=>{setCopiedPin(true);setTimeout(()=>setCopiedPin(false),2500);});}

  const visibleTabs=[{id:"coach" as Tab,label:"Coach Studio"},{id:"clients" as Tab,label:"Asesorados"},{id:"portal" as Tab,label:"Portal"}];
  const navTabs=authSession?.role==="coach"?visibleTabs:visibleTabs.filter(t=>t.id==="portal");

  /* ===================================================================
     FORMULARIO DE REGISTRO (ruta /registro/:token)
     =================================================================== */
  if(isRegistroRoute) return (
    <div className="min-h-screen bg-[#f4f1ea] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#17120d] mb-3">
            <span className="font-display text-2xl font-bold text-[#a87d49]">LB</span>
          </div>
          <h1 className="font-display text-[28px] font-semibold text-[#17120d]">LB Method</h1>
          <p className="text-[13px] text-[#8c8377]">Formulario de registro</p>
        </div>

        {/* Verificando token */}
        {inviteStatus==="verifying" && (
          <div className="rounded-[20px] bg-white p-8 text-center">
            <div className="text-3xl mb-3">⏳</div>
            <p className="text-[14px] text-[#8c8377]">Verificando invitación…</p>
          </div>
        )}

        {/* Token inválido/expirado */}
        {inviteStatus==="invalid" && (
          <div className="rounded-[20px] bg-white p-8 text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <h2 className="font-display text-[20px] font-semibold text-[#17120d]">Invitación no válida</h2>
            <p className="mt-2 text-[13px] text-[#8c8377]">{inviteError}</p>
            <p className="mt-3 text-[12px] text-[#b3aa9b]">Pide a tu coach que genere una nueva invitación.</p>
          </div>
        )}

        {/* Registro completado */}
        {inviteStatus==="done" && regSubmitted && (
          <div className="rounded-[20px] bg-[#17120d] p-8 text-center text-[#f4f1ea]">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="font-display text-[24px] font-semibold">¡Registro completado!</h2>
            <p className="mt-2 text-[13px] text-[#b7ad9d]">Hola, {regSubmitted.name}. Tu perfil fue creado.</p>
            <div className="mt-5 rounded-2xl bg-white/10 p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a87d49] mb-2">Tu PIN de acceso</div>
              <div className="font-mono text-[36px] font-bold tracking-[0.2em]">{regSubmitted.pin}</div>
              <p className="mt-2 text-[11px] text-[#9a9186]">Guárdalo — lo necesitarás para entrar a la app.</p>
            </div>
            <p className="mt-4 text-[12px] text-[#9a9186]">Tu coach generará tu rutina personalizada y te avisará cuando esté lista.</p>
            <a href="/asesorado" className="mt-5 inline-block rounded-xl bg-[#a87d49] px-6 py-3 text-sm font-semibold text-white">
              Ir a la app →
            </a>
          </div>
        )}

        {/* Formulario */}
        {(inviteStatus==="valid"||inviteStatus==="submitting") && (
          <div className="rounded-[20px] bg-white p-6 sm:p-8 flex flex-col gap-4">
            <h2 className="font-display text-[22px] font-semibold text-[#17120d]">Cuéntame sobre ti</h2>
            <p className="text-[12px] text-[#8c8377] -mt-2">Con estos datos generaré tu rutina 100% personalizada.</p>

            {inviteError && <p className="rounded-xl bg-[#f7ece6] p-3 text-sm text-[#9a4b34]">{inviteError}</p>}

            {/* Nombre */}
            <label className="block"><span className={labelCls}>Nombre completo *</span>
              <input className={inputCls} placeholder="Ej. María García" value={regForm.name} onChange={e=>setRegForm(p=>({...p,name:e.target.value}))}/>
            </label>

            {/* Género */}
            <div><span className={labelCls}>Género</span>
              <div className="mt-1.5 flex gap-1.5 rounded-2xl bg-[#ece6db] p-1.5">
                {(Object.entries(GENDER_LABELS) as [Gender,string][]).map(([v,l])=>(
                  <button key={v} onClick={()=>setRegForm(p=>({...p,gender:v}))}
                    className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${regForm.gender===v?"bg-[#17120d] text-white":"text-[#8c8377]"}`}>{l}</button>
                ))}
              </div>
            </div>

            {/* Objetivo */}
            <label className="block"><span className={labelCls}>Objetivo principal *</span>
              <select className={inputCls} value={regForm.goal} onChange={e=>setRegForm(p=>({...p,goal:e.target.value as Goal}))}>
                {GOALS_BY_GENDER[regForm.gender].map(g=><option key={g} value={g}>{GOAL_LABELS[g]}</option>)}
              </select>
            </label>

            {/* Nivel + Días */}
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className={labelCls}>Nivel *</span>
                <select className={inputCls} value={regForm.experienceLevel} onChange={e=>setRegForm(p=>({...p,experienceLevel:e.target.value as Level}))}>
                  {(Object.keys(LEVEL_LABELS) as Level[]).map(l=><option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
                </select>
              </label>
              <label className="block"><span className={labelCls}>Días/semana *</span>
                <select className={inputCls} value={regForm.daysPerWeek} onChange={e=>setRegForm(p=>({...p,daysPerWeek:Number(e.target.value)}))}>
                  {[3,4,5,6].map(d=><option key={d} value={d}>{d} días</option>)}
                </select>
              </label>
            </div>

            {/* Duración */}
            <div><span className={labelCls}>Duración por sesión</span>
              <div className="mt-1.5 flex gap-1.5 rounded-2xl bg-[#ece6db] p-1.5">
                {SESSION_DURATION_OPTIONS.map(({v,l})=>(
                  <button key={v} onClick={()=>setRegForm(p=>({...p,sessionDuration:v}))}
                    className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${regForm.sessionDuration===v?"bg-[#17120d] text-white":"text-[#8c8377]"}`}>{l}</button>
                ))}
              </div>
            </div>

            {/* Lugar */}
            <div><span className={labelCls}>Lugar de entrenamiento</span>
              <div className="mt-1.5 flex gap-1.5 rounded-2xl bg-[#ece6db] p-1.5">
                {([["gym","Gimnasio"],["home","En casa"]] as [TrainingLocation,string][]).map(([v,l])=>(
                  <button key={v} onClick={()=>setRegForm(p=>({...p,trainingLocation:v}))}
                    className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${regForm.trainingLocation===v?"bg-[#17120d] text-white":"text-[#8c8377]"}`}>{l}</button>
                ))}
              </div>
            </div>

            {/* Equipamiento en casa */}
            {regForm.trainingLocation==="home" && (
              <div><span className={labelCls}>Equipamiento disponible</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {([["bodyweight","Peso corporal"],["dumbbell","Mancuernas"],["band","Bandas"],["kettlebell","Pesas rusas"],["barbell","Barra"]] as [string,string][]).map(([eq,label])=>{
                    const on=regForm.homeEquipment.has(eq);
                    return <button key={eq} onClick={()=>setRegForm(p=>{const n=new Set(p.homeEquipment);on?n.delete(eq):n.add(eq);return{...p,homeEquipment:n};})}
                      className={`rounded-xl px-3 py-2 text-[12px] font-semibold border transition ${on?"border-[#a87d49] bg-[#a87d49] text-white":"border-[#e0d9cc] text-[#8c8377]"}`}>{label}</button>;
                  })}
                </div>
              </div>
            )}

            {/* Edad + Peso */}
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className={labelCls}>Edad <span className="font-normal text-[#b3aa9b]">(opcional)</span></span>
                <input className={inputCls} type="number" min={12} max={90} placeholder="28" value={regForm.age} onChange={e=>setRegForm(p=>({...p,age:e.target.value}))}/>
              </label>
              <label className="block"><span className={labelCls}>Peso kg <span className="font-normal text-[#b3aa9b]">(opcional)</span></span>
                <input className={inputCls} type="number" min={30} max={250} step={0.5} placeholder="65" value={regForm.bodyweightKg} onChange={e=>setRegForm(p=>({...p,bodyweightKg:e.target.value}))}/>
              </label>
            </div>

            {/* Historial */}
            <div><span className={labelCls}>¿Cuánto tiempo llevas entrenando?</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {(["Menos de 6 meses","6–12 meses","1–2 años","Más de 2 años"]).map(opt=>(
                  <button key={opt} onClick={()=>setRegForm(p=>({...p,monthsTrained:p.monthsTrained===opt?"":opt}))}
                    className={`rounded-xl px-3 py-2 text-[12px] font-semibold border transition ${regForm.monthsTrained===opt?"border-[#a87d49] bg-[#a87d49] text-white":"border-[#e0d9cc] text-[#8c8377]"}`}>{opt}</button>
                ))}
              </div>
            </div>

            {/* Lesiones */}
            <div><span className={labelCls}>Lesiones o molestias <span className="font-normal text-[#b3aa9b]">(opcional)</span></span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {(["Rodilla","Espalda baja","Hombro","Cadera","Tobillo","Muñeca","Cuello"]).map(z=>{
                  const on=regForm.injuries.has(z);
                  return <button key={z} onClick={()=>setRegForm(p=>{const n=new Set(p.injuries);on?n.delete(z):n.add(z);return{...p,injuries:n};})}
                    className={`rounded-xl px-3 py-2 text-[12px] font-semibold border transition ${on?"border-[#9a4b34] bg-[#9a4b34] text-white":"border-[#e0d9cc] text-[#8c8377]"}`}>{z}</button>;
                })}
              </div>
            </div>

            {/* Músculo prioritario */}
            <label className="block"><span className={labelCls}>¿En qué músculo quieres enfocarte? <span className="font-normal text-[#b3aa9b]">(opcional)</span></span>
              <select className={inputCls} value={regForm.focusMuscle} onChange={e=>setRegForm(p=>({...p,focusMuscle:e.target.value as FocusMuscleKey|""}))}>
                <option value="">Sin preferencia específica</option>
                {ALL_FOCUS_OPTIONS.map(o=><option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </label>

            <button onClick={submitRegistro} disabled={!regForm.name.trim()||inviteStatus==="submitting"}
              className={`mt-2 w-full py-4 text-[15px] font-semibold ${primaryBtn}`}>
              {inviteStatus==="submitting"?"Enviando…":"Enviar mis datos →"}
            </button>
            <p className="text-center text-[11px] text-[#b3aa9b]">Tu información es privada y solo la verá tu coach.</p>
          </div>
        )}
      </div>
    </div>
  );

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
          <h2 className="font-display text-[34px] font-semibold tracking-tight text-[#17120d]">
            {isAsesoradoRoute?"Mi entrenamiento":"Coach Studio"}
          </h2>
          <p className="mt-2 text-sm text-[#8c8377]">
            {isAsesoradoRoute?"Ingresa tu PIN para ver tu rutina.":"Acceso exclusivo para coaches."}
          </p>

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

          {/* Formulario asesorado (PIN) */}
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
          {/* Solo mostrar el toggle si NO estamos en una ruta fija */}
          {!twoFactorPending && !loginLockedUntil && !isAsesoradoRoute && authRole==="coach" && (
            <p className="mt-5 text-center text-[12px] text-[#a39a8d]">
              <span>¿Eres asesorado? </span>
              <a href="/asesorado" className="text-[#a87d49] hover:underline">Entra aquí</a>
            </p>
          )}
        </div>
      </div>
    </div>
  );

  /* ===================================================================
     APP
     =================================================================== */
  const pgTitle = activeTab==="coach"?"Flujo de alta":activeTab==="clients"?"Tus asesorados":"Mi entrenamiento";
  const pgSub = activeTab==="coach"?"Agrega asesorado, genera rutina y dale acceso.":activeTab==="clients"?"Seguimiento de adherencia y avance.":"Tu rutina y registro de progreso.";
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
              <div className="min-w-0"><div className="truncate text-[13px] font-semibold">{authSession.name}</div><div className="text-[10.5px] text-[#9a9186]">{authSession.role==="coach"?"Head Coach":"Asesorada"}</div></div>
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
                <h2 className="font-display text-[24px] font-semibold">① Agregar asesorado</h2>
                <div className="mt-5 flex gap-1.5 rounded-2xl bg-[#ece6db] p-1.5">
                  <button onClick={()=>{setUseExisting(false);setError(null);setDuplicateWarning(null);}} className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${!useExisting?"bg-[#17120d] text-white":"text-[#8c8377]"}`}>Nueva persona</button>
                  <button onClick={()=>{setUseExisting(true);setError(null);setDuplicateWarning(null);}} className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${useExisting?"bg-[#17120d] text-white":"text-[#8c8377]"}`}>Asesorado existente</button>
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

                    <label className="block">
                      <span className={labelCls}>Edad <span className="font-normal text-[#b3aa9b]">— opcional</span></span>
                      <input className={inputCls} type="number" min={12} max={90} placeholder="Ej. 28"
                        value={wizAge} onChange={e=>setWizAge(e.target.value)}/>
                      <p className="mt-1 text-[11px] text-[#b3aa9b]">A partir de 45 años se ajusta el volumen para optimizar la recuperación.</p>
                    </label>

                    <label className="block">
                      <span className={labelCls}>Peso corporal (kg) <span className="font-normal text-[#b3aa9b]">— opcional</span></span>
                      <div className="relative mt-1">
                        <input className={inputCls} type="number" min={30} max={300} step={0.5}
                          placeholder="Ej. 65"
                          value={wizWeight}
                          onChange={e=>setWizWeight(e.target.value)}/>
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#b3aa9b]">kg</span>
                      </div>
                      <p className="mt-1 text-[11px] text-[#b3aa9b]">Se usa para sugerir cargas iniciales en la rutina. No se comparte con nadie.</p>
                    </label>

                    {/* Equipamiento específico — solo para entreno en casa */}
                    {wizTrainingLocation==="home" && (
                      <div>
                        <span className={labelCls}>Equipamiento disponible en casa</span>
                        <p className="mt-0.5 mb-2 text-[11px] text-[#b3aa9b]">Selecciona solo lo que tienes. El motor elegirá ejercicios compatibles.</p>
                        <div className="flex flex-wrap gap-1.5">
                          {([
                            ["bodyweight","Peso corporal"],
                            ["dumbbell","Mancuernas"],
                            ["band","Bandas elásticas"],
                            ["kettlebell","Pesas rusas"],
                            ["barbell","Barra + discos"],
                          ] as [string,string][]).map(([eq,label])=>{
                            const on=wizHomeEquipment.has(eq);
                            return(
                              <button key={eq} onClick={()=>setWizHomeEquipment(prev=>{const n=new Set(prev);on?n.delete(eq):n.add(eq);return n;})}
                                className={`rounded-xl px-3.5 py-2 text-[12.5px] font-semibold transition border ${on?"border-[#a87d49] bg-[#a87d49] text-white":"border-[#e0d9cc] bg-white text-[#8c8377] hover:border-[#a87d49]"}`}>
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div>
                      <span className={labelCls}>Historial de entrenamiento</span>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {(["Menos de 6 meses","6–12 meses","1–2 años","Más de 2 años"] as string[]).map(opt=>(
                          <button key={opt} onClick={()=>setWizMonthsTrained(wizMonthsTrained===opt?"":opt)}
                            className={`rounded-xl px-3.5 py-2 text-[12.5px] font-semibold transition border ${wizMonthsTrained===opt?"border-[#a87d49] bg-[#a87d49] text-white":"border-[#e0d9cc] bg-white text-[#8c8377] hover:border-[#a87d49]"}`}>
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className={labelCls}>Lesiones o molestias (opcional)</span>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {(["Rodilla","Espalda baja","Hombro","Cadera","Tobillo","Muñeca","Cuello"] as string[]).map(zone=>{
                          const on=wizInjuries.has(zone);
                          return (
                            <button key={zone} onClick={()=>setWizInjuries(prev=>{const n=new Set(prev);on?n.delete(zone):n.add(zone);return n;})}
                              className={`rounded-xl px-3.5 py-2 text-[12.5px] font-semibold transition border ${on?"border-[#9a4b34] bg-[#9a4b34] text-white":"border-[#e0d9cc] bg-white text-[#8c8377] hover:border-[#9a4b34]"}`}>
                              {zone}
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-1.5 text-[11px] text-[#b3aa9b]">Selecciona las zonas donde hay dolor o restricción de movimiento.</p>
                    </div>
                  </div>
                )}
                {useExisting && (
                  <div className="mt-5">
                    <label className="block"><span className={labelCls}>Selecciona asesorada</span>
                      <select className={inputCls} value={selectedClientId} onChange={e=>setSelectedClientId(e.target.value)}>
                        <option value="">— elige una asesorada —</option>
                        {clients.map(c=><option key={c.id} value={c.id}>{c.name} · {GOAL_LABELS[c.goal]}</option>)}
                      </select>
                    </label>
                  </div>
                )}
                {error && <p className="mt-4 rounded-xl bg-[#f7ece6] p-3 text-sm text-[#9a4b34]">{error}</p>}

                {/* Advertencia de duplicado */}
                {duplicateWarning && !useExisting && (
                  <div className="mt-4 rounded-xl border border-[#d4a84b] bg-[#fdf8f0] p-4">
                    <p className="text-[13px] font-semibold text-[#8f6a3c]">Ya existe un asesorado con ese nombre</p>
                    <p className="mt-1 text-[12px] text-[#a87d49]">
                      <strong>{duplicateWarning.name}</strong> · {GOAL_LABELS[duplicateWarning.goal]} · {LEVEL_LABELS[duplicateWarning.experienceLevel]}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={()=>{setFlowClient(duplicateWarning);setGoal(duplicateWarning.goal);setLevel(duplicateWarning.experienceLevel);setDays(duplicateWarning.daysPerWeek);setDuplicateWarning(null);setCoachStep(2);}}
                        className={`flex-1 py-2 text-[13px] ${primaryBtn}`}
                      >Usar asesorado existente</button>
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
                  <button onClick={()=>setShowTemplateModal(true)} className={`px-4 py-3.5 text-sm ${ghostBtn}`}>📋 Guardar template</button>
                  <button onClick={()=>setCoachStep(4)} className={`flex-1 py-3.5 text-[15px] ${primaryBtn}`}>Continuar → Acceso asesorado</button>
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
                    <h2 className="font-display text-[24px] font-semibold">④ Acceso asesorado listo</h2>
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
                      La asesorada puede usar su nombre, correo o ID para iniciar sesión.
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
                    <li>1. Abre la app LB Method y toca <strong>«Asesorado»</strong>.</li>
                    <li>2. Ingresa tu correo, nombre o ID: <strong className="font-mono text-[#8f6a3c]">{flowClient.name}</strong></li>
                    <li>3. Ingresa tu PIN: <strong className="font-mono text-[#8f6a3c]">{generatedPin||clientPin||flowClient.pin||"(ver arriba)"}</strong></li>
                    <li>4. ¡Listo! Verás tu rutina, podrás registrar tus pesos y chatear con tu coach.</li>
                  </ol>
                </div>

                <div className="mt-6 flex gap-3">
                  <button onClick={()=>{resetWizard();setActiveTab("clients");}} className={`flex-1 py-3.5 text-sm ${ghostBtn}`}>Ver asesoradas</button>
                  <button onClick={resetWizard} className={`flex-1 py-3.5 text-sm ${primaryBtn}`}>+ Nueva persona</button>
                </div>
              </article>
            )}
          </section>
        )}

        {/* ========== CLIENTS ========== */}
        {authSession.role==="coach" && activeTab==="clients" && (
          <section className="flex flex-col gap-5">

            {/* Panel de invitaciones — siempre visible arriba */}
            <div className="rounded-[18px] border border-[#e7e1d6] bg-white p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-display text-[17px] font-semibold">Invitaciones de registro</h3>
                  <p className="text-[12px] text-[#8c8377]">Genera un link único para que tu asesorada llene su formulario.</p>
                </div>
                <button onClick={()=>setShowInvitePanel(!showInvitePanel)}
                  className={`rounded-xl px-4 py-2 text-[13px] font-semibold transition ${showInvitePanel?"bg-[#17120d] text-white":"border border-[#e0d9cc] text-[#8c8377] hover:border-[#a87d49]"}`}>
                  {showInvitePanel?"Cerrar ×":"+ Nueva invitación"}
                </button>
              </div>

              {/* Formulario nueva invitación — solo al abrir */}
              {showInvitePanel && (
                <div className="flex gap-2 border-t border-[#f0eae0] pt-4">
                  <input className={`flex-1 ${inputCls}`} placeholder="Para quién es (opcional): Ana García" value={inviteNote} onChange={e=>setInviteNote(e.target.value)} onKeyDown={e=>e.key==="Enter"&&generateInvite()}/>
                  <button onClick={generateInvite} disabled={inviteGenerating} className={`flex-none px-5 py-2 text-sm font-semibold ${primaryBtn}`}>
                    {inviteGenerating?"Generando…":"Generar link"}
                  </button>
                </div>
              )}

              {/* Lista de invitaciones — SIEMPRE visible */}
              {invites.length===0
                ? <p className="text-[12px] text-[#a39a8d] text-center py-2">Sin invitaciones. Genera una con el botón de arriba.</p>
                : <div className="flex flex-col gap-2 mt-2">
                  {invites.map(inv=>{
                    const used=!!inv.usedAt;
                    const expired=!used&&new Date(inv.expiresAt)<new Date();
                    const active=!used&&!expired;
                    return(
                      <div key={inv.id} className={`rounded-[14px] border px-4 py-3 ${active?"border-[#e7e1d6]":used?"border-[#d4edd4] bg-[#f6fff6]":"border-[#ece6db] bg-[#fafaf9]"}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            {inv.note && <div className="text-[13px] font-semibold truncate">{inv.note}</div>}
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${active?"bg-[#f0e7d8] text-[#8f6a3c]":used?"bg-[#d4edd4] text-[#2e7d32]":"bg-[#ece6db] text-[#9a9186]"}`}>
                                {active?"🟡 Activa":used?"✅ Usada":"⚠️ Expirada"}
                              </span>
                              {active && <span className="text-[10px] text-[#a39a8d]">Expira {new Date(inv.expiresAt).toLocaleDateString("es-MX",{day:"2-digit",month:"short"})}</span>}
                            </div>
                          </div>
                          <div className="flex gap-1.5 flex-none">
                            {active && (
                              <button onClick={()=>copyInviteLink(inv.token)}
                                className={`rounded-xl px-3 py-1.5 text-[12px] font-semibold transition ${copiedInvite===inv.token?"bg-[#a87d49] text-white":"border border-[#e0d9cc] text-[#8c8377] hover:border-[#a87d49]"}`}>
                                {copiedInvite===inv.token?"✓ Copiado":"Copiar link"}
                              </button>
                            )}
                            {!used && <button onClick={()=>revokeInvite(inv.id)} className="rounded-xl px-2 py-1.5 text-[11px] text-[#c62828] hover:bg-[#fde8e8]">✕</button>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              }
            </div>

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(260px,0.8fr)_1.4fr]">
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
              {clients.length===0 && <div className="rounded-2xl border border-dashed border-[#dcd4c5] p-6 text-center"><p className="text-sm text-[#a39a8d]">Sin asesorados aún.</p><button onClick={()=>setActiveTab("coach")} className={`mt-3 px-5 py-2.5 text-sm ${primaryBtn}`}>+ Agregar</button></div>}

              {/* Alertas de inactividad */}
              {dashboardData.filter(d=>d.inactive).length>0 && (
                <div className="rounded-[16px] border border-[#f5c6c6] bg-[#fff5f5] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#c62828] mb-2">Sin entrenar +7 días</div>
                  {dashboardData.filter(d=>d.inactive).map(d=>(
                    <div key={d.id} className="flex items-center justify-between py-1.5">
                      <span className="text-[13px] font-semibold">{d.name}</span>
                      <span className="text-[11px] text-[#a39a8d]">{d.lastSession?`Última: ${new Date(d.lastSession).toLocaleDateString("es-MX",{day:"2-digit",month:"short"})}`:"Sin sesiones"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedClient && (
              <div className="flex flex-col gap-4">
                {/* Header asesorada */}
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

                {/* Check-ins del asesorado */}
                {selectedClient.program && (() => {
                  const clientCheckIns = checkIns; // loaded when coach selects client
                  if(clientCheckIns.length===0) return null;
                  return (
                    <article className="rounded-[18px] border border-[#e7e1d6] bg-white p-6">
                      <h3 className="font-display text-[17px] font-semibold mb-4">Check-ins semanales</h3>
                      <div className="flex flex-col gap-2">
                        {clientCheckIns.slice().reverse().map(ci=>(
                          <div key={ci.id} className="rounded-[14px] border border-[#ece6db] px-4 py-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[13px] font-semibold">Semana {ci.weekNumber}</span>
                              <span className="text-[11px] text-[#a39a8d]">{fdt(ci.createdAt)}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              {([["⚡ Energía",ci.energy],["😴 Sueño",ci.sleep],["🧠 Estrés",ci.stress]] as [string,number][]).map(([l,v])=>(
                                <div key={l} className="rounded-lg bg-[#faf8f4] p-2 text-center">
                                  <div className="text-[11px] text-[#8c8377]">{l}</div>
                                  <div className="font-display text-[18px] font-semibold text-[#a87d49]">{v}/5</div>
                                </div>
                              ))}
                            </div>
                            {ci.notes && <p className="mt-2 text-[12px] text-[#8c8377] italic">"{ci.notes}"</p>}
                          </div>
                        ))}
                      </div>
                    </article>
                  );
                })()}

                {/* Templates — acceso rápido */}
                {templates.length>0 && (
                  <article className="rounded-[18px] border border-[#e7e1d6] bg-white p-6">
                    <h3 className="font-display text-[17px] font-semibold mb-4">Templates de rutinas</h3>
                    <div className="flex flex-col gap-2">
                      {templates.map(t=>(
                        <div key={t.id} className="flex items-center justify-between rounded-[14px] border border-[#ece6db] px-4 py-3">
                          <div>
                            <div className="text-[13px] font-semibold">{t.name}</div>
                            <div className="text-[11px] text-[#a39a8d]">{GOAL_LABELS[t.goal as Goal]??t.goal} · {t.level} · {t.daysPerWeek}d · {t.totalWeeks} sem</div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={()=>{setApplyingTemplate(t);setShowApplyModal(true);}} className={`px-3 py-1.5 text-[12px] ${primaryBtn}`}>Aplicar</button>
                            <button onClick={()=>deleteTemplate(t.id)} className="px-2.5 py-1.5 text-[12px] text-[#c62828] hover:bg-[#fde8e8] rounded-xl transition">✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                )}

                {/* Notas del coach por sesión */}
                {selectedClient.program && (
                  <article className="rounded-[18px] border border-[#e7e1d6] bg-white p-6">
                    <h3 className="font-display text-[17px] font-semibold mb-4">Notas por sesión</h3>
                    <p className="text-[12px] text-[#8c8377] mb-4">Deja feedback en cada día de entrenamiento. El asesorado lo verá en su historial.</p>
                    <div className="flex flex-col gap-3">
                      {selectedClient.program.weeks.flatMap(w=>w.days.map(d=>{
                        const key=`${w.weekNumber}-${d.dayIndex}`;
                        const existingNote=coachNotes[key]??"";
                        const isEditing=editingNote?.key===key;
                        return(
                          <div key={key} className="rounded-[14px] border border-[#ece6db] p-3.5">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[12px] font-semibold">Sem {w.weekNumber} · Día {d.dayIndex+1} — {FOCUS_LABELS[d.focus]??d.focus}</span>
                              {!isEditing && (
                                <button onClick={()=>setEditingNote({key,text:existingNote})}
                                  className="text-[11px] text-[#a87d49] hover:underline">
                                  {existingNote?"Editar":"+ Nota"}
                                </button>
                              )}
                            </div>
                            {isEditing ? (
                              <div className="flex flex-col gap-2">
                                <textarea className={`${inputCls} min-h-[60px] resize-none text-[12px]`}
                                  placeholder="Ej: Excelente técnica en hip thrust. Intenta +2.5kg la próxima semana."
                                  value={editingNote.text} onChange={e=>setEditingNote({key,text:e.target.value})}/>
                                <div className="flex gap-2">
                                  <button onClick={()=>saveCoachNote(selectedClient.id,w.weekNumber,d.dayIndex,editingNote.text)} disabled={noteSaving}
                                    className={`flex-1 py-2 text-[12px] ${primaryBtn}`}>{noteSaving?"Guardando…":"Guardar"}</button>
                                  <button onClick={()=>setEditingNote(null)} className={`px-4 py-2 text-[12px] ${ghostBtn}`}>Cancelar</button>
                                </div>
                              </div>
                            ) : existingNote ? (
                              <p className="text-[12px] text-[#6b6358] italic">"{existingNote}"</p>
                            ) : (
                              <p className="text-[11px] text-[#c2b9aa]">Sin nota</p>
                            )}
                          </div>
                        );
                      }))}
                    </div>
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
            {!selectedClient && <div className="rounded-[18px] border border-[#e7e1d6] bg-white p-8 text-center text-sm text-[#a39a8d]">Selecciona un asesorado.</div>}
          </div>{/* cierre grid clientes */}
          </section>
        )}

        {/* ========== PORTAL ========== */}
        {activeTab==="portal" && (
          <section className="mx-auto flex max-w-[800px] flex-col gap-5">
            {authSession.role==="coach" && (
              <label className="block max-w-sm"><span className={labelCls}>Ver asesorada</span>
                <select className={inputCls} value={selectedClientId} onChange={e=>setSelectedClientId(e.target.value)}>
                  <option value="">— selecciona —</option>
                  {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            )}

            {(() => {
              const portalClient=clients.find(c=>c.id===portalClientId)??null;
              if(!portalClient)return <p className="text-sm text-[#a39a8d]">Selecciona un asesorado.</p>;
              return (
                <>
                  {/* Header portal */}
                  <div className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] bg-[#17120d] px-7 py-5 text-[#f4f1ea]">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a87d49]">Plan activo</div>
                      <h2 className="font-display mt-1 text-[28px] font-semibold">{portalClient.name}</h2>
                      <p className="mt-0.5 text-[12px] text-[#b7ad9d]">{GOAL_LABELS[portalClient.goal]} · {portalClient.daysPerWeek} días/sem</p>
                      {/* Check-in semanal */}
                      {authSession?.role==="client" && (
                        <button onClick={()=>setShowCheckIn(true)}
                          className="mt-2 rounded-xl border border-white/20 px-3 py-1.5 text-[11px] font-semibold text-white/70 hover:text-white hover:border-white/40 transition">
                          📋 Check-in semanal
                        </button>
                      )}
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

                  {/* Mi entrenamiento — vista diaria + registro fusionados */}
                  {portalTab==="rutina" && (
                    !portalClient.program
                      ? <div className="rounded-[18px] border border-[#e7e1d6] bg-[#faf8f4] p-8 text-center">
                          <div className="text-4xl mb-3">⏳</div>
                          <p className="font-display text-[17px] font-semibold text-[#17120d]">Tu rutina está en preparación</p>
                          <p className="mt-1 text-[13px] text-[#8c8377]">Tu coach está generando tu plan personalizado. Te avisará cuando esté listo.</p>
                        </div>
                      : (()=>{
                          const allWeeks=portalClient.program!.weeks;
                          const currentWeekData=allWeeks.find(w=>w.weekNumber===logWeek)??allWeeks[0];
                          const currentDayData=currentWeekData?.days.find(d=>d.dayIndex===logDay)??currentWeekData?.days[0];
                          const allNames=currentDayData?.selections.map(s=>s.exercise.name)??[];

                          const goToDay=(w:number,d:number)=>{setLogWeek(w);setLogDay(d);setSavedExercises(new Set());setSessionComplete(false);setExerciseLogs({});setLogNotes({});};

                          if(sessionComplete){
                            const allDays=currentWeekData?.days??[];
                            const nextDayInWeek=allDays.find(d=>d.dayIndex===logDay+1);
                            const nextWeek=allWeeks.find(w=>w.weekNumber===logWeek+1);
                            const hasNextDay=!!nextDayInWeek||(!!nextWeek&&nextWeek.days.length>0);
                            const isProgramComplete=!hasNextDay; // última sesión del programa

                            // ── Pantalla de programa completado (renovación) ──
                            if(isProgramComplete) return (
                              <div className="flex flex-col gap-4">
                                <div className="rounded-[18px] bg-[#17120d] p-8 text-center text-[#f4f1ea]">
                                  <div className="text-5xl mb-3">🏆</div>
                                  <h3 className="font-display text-[26px] font-semibold">¡Completaste tu programa!</h3>
                                  <p className="mt-2 text-[13px] text-[#b7ad9d]">{allWeeks.length} semanas · {portalClient.daysPerWeek} días/sem</p>
                                  <p className="mt-1 text-[12px] text-[#9a9186]">Entrenaste con constancia. Tu cuerpo lo sabe.</p>
                                </div>
                                <div className="rounded-[18px] border border-[#e7e1d6] bg-white p-6">
                                  <h4 className="font-display text-[18px] font-semibold text-center">¿Quieres continuar entrenando?</h4>
                                  <p className="mt-1 text-[13px] text-[#8c8377] text-center">Contáctate con tu coach para renovar tu plan.</p>
                                  <div className="mt-5 flex flex-col gap-3">
                                    {/* WhatsApp */}
                                    <a href={`https://wa.me/${COACH_WHATSAPP}?text=${encodeURIComponent("¡Hola! Terminé mi programa de entrenamiento y quiero renovar mi plan 💪")}`}
                                      target="_blank" rel="noopener noreferrer"
                                      className="flex items-center justify-center gap-2.5 rounded-xl bg-[#25D366] py-3.5 text-[15px] font-semibold text-white hover:opacity-90">
                                      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.118.554 4.107 1.523 5.827L.057 23.886c-.07.358.241.669.599.599l6.059-1.466A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.793 9.793 0 01-5.001-1.373l-.359-.214-3.727.977.977-3.727-.214-.359A9.793 9.793 0 012.182 12C2.182 6.56 6.56 2.182 12 2.182S21.818 6.56 21.818 12 17.44 21.818 12 21.818z"/></svg>
                                      Escribir por WhatsApp
                                    </a>
                                    {/* Chat en app */}
                                    <button onClick={()=>setPortalTab("chat")}
                                      className="flex items-center justify-center gap-2.5 rounded-xl border-2 border-[#17120d] py-3.5 text-[15px] font-semibold text-[#17120d] hover:bg-[#17120d] hover:text-white transition">
                                      💬 Chat con mi coach
                                    </button>
                                  </div>
                                </div>
                                <button onClick={()=>{setSessionComplete(false);setSavedExercises(new Set());setExerciseLogs({});setLogNotes({});}}
                                  className="text-center text-[12px] text-[#a39a8d] hover:text-[#17120d]">Ver mi historial</button>
                              </div>
                            );

                            // ── Pantalla de sesión completada normal ──
                            return (
                              <div className="rounded-[18px] bg-[#17120d] p-8 text-center text-[#f4f1ea]">
                                <div className="text-5xl mb-3">🎉</div>
                                <h3 className="font-display text-[24px] font-semibold">¡Sesión completada!</h3>
                                <p className="mt-2 text-[13px] text-[#b7ad9d]">Semana {logWeek} · Día {logDay+1} — {FOCUS_LABELS[currentDayData?.focus??""]??""}</p>
                                <p className="mt-1 text-[11px] text-[#9a9186]">Tus datos quedaron guardados</p>

                                {/* Feedback post-sesión */}
                                {!sessionFeedbacks[`${logWeek}-${logDay}`] && (
                                  <div className="mt-5">
                                    <p className="text-[12px] text-[#b7ad9d] mb-3">¿Cómo te sentiste en esta sesión?</p>
                                    <div className="flex justify-center gap-3">
                                      {([["easy","😴","Muy fácil"],["good","💪","Perfecta"],["hard","🥵","Muy dura"]] as [string,string,string][]).map(([f,emoji,label])=>(
                                        <button key={f} disabled={feedbackSaving} onClick={()=>saveFeedback(f,logWeek,logDay)}
                                          className="flex flex-col items-center gap-1 rounded-xl border border-white/20 px-3 py-2 hover:border-[#a87d49] hover:bg-white/5 transition">
                                          <span className="text-2xl">{emoji}</span>
                                          <span className="text-[10px] text-[#b7ad9d]">{label}</span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {sessionFeedbacks[`${logWeek}-${logDay}`] && (
                                  <p className="mt-4 text-[12px] text-[#9a9186]">
                                    Feedback guardado {sessionFeedbacks[`${logWeek}-${logDay}`]==="easy"?"😴":sessionFeedbacks[`${logWeek}-${logDay}`]==="good"?"💪":"🥵"}
                                  </p>
                                )}

                                <div className="mt-5 flex flex-col gap-2.5 items-center">
                                  <button onClick={()=>{
                                    if(nextDayInWeek) goToDay(logWeek,logDay+1);
                                    else if(nextWeek) goToDay(logWeek+1,nextWeek.days[0].dayIndex);
                                  }} className="w-full max-w-[240px] rounded-xl bg-[#a87d49] px-6 py-3 text-sm font-semibold text-white hover:bg-[#8f6538]">
                                    Siguiente sesión →
                                  </button>
                                  <button onClick={()=>{setSessionComplete(false);setSavedExercises(new Set());setExerciseLogs({});setLogNotes({});}}
                                    className="w-full max-w-[240px] rounded-xl border border-white/20 px-6 py-2.5 text-sm font-semibold text-white/70 hover:text-white">
                                    Ver otro día
                                  </button>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div className="flex flex-col gap-4">
                              {/* Navegador semana */}
                              <div className="flex items-center justify-between rounded-[18px] border border-[#e7e1d6] bg-white p-4">
                                <button disabled={logWeek<=1} onClick={()=>goToDay(logWeek-1,0)}
                                  className="rounded-xl border border-[#e0d9cc] px-3 py-2 text-sm font-semibold text-[#8c8377] disabled:opacity-30 hover:border-[#a87d49] hover:text-[#a87d49]">← Sem ant.</button>
                                <div className="text-center">
                                  <div className="font-display text-[17px] font-semibold">Semana {logWeek}{currentWeekData?.deload?" — Deload":""}</div>
                                  <div className="text-[11px] text-[#a39a8d]">{allWeeks.length} semanas en total</div>
                                </div>
                                <button disabled={logWeek>=allWeeks.length} onClick={()=>goToDay(logWeek+1,0)}
                                  className="rounded-xl border border-[#e0d9cc] px-3 py-2 text-sm font-semibold text-[#8c8377] disabled:opacity-30 hover:border-[#a87d49] hover:text-[#a87d49]">Sem sig. →</button>
                              </div>

                              {/* Selector de días */}
                              <div className="flex gap-1.5 overflow-x-auto rounded-2xl border border-[#e7e1d6] bg-white p-1.5">
                                {currentWeekData?.days.map(d=>(
                                  <button key={d.dayIndex} onClick={()=>goToDay(logWeek,d.dayIndex)}
                                    className={`flex-none rounded-xl px-3 py-2 text-center transition ${logDay===d.dayIndex?"bg-[#17120d] text-white":"text-[#8c8377] hover:bg-[#f5f0e8]"}`}>
                                    <div className="text-[11px] font-bold">Día {d.dayIndex+1}</div>
                                    <div className="text-[9.5px] mt-0.5 max-w-[70px] truncate">{FOCUS_LABELS[d.focus]??d.focus.replace(/_/g," ")}</div>
                                  </button>
                                ))}
                              </div>

                              {/* Info del día */}
                              {currentDayData && (
                                <div className="flex items-center justify-between rounded-[16px] bg-[#17120d] px-5 py-3.5 text-[#f4f1ea]">
                                  <div>
                                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a87d49]">Sesión de hoy</div>
                                    <div className="font-display text-[18px] font-semibold mt-0.5">{FOCUS_LABELS[currentDayData.focus]??currentDayData.focus.replace(/_/g," ")}</div>
                                  </div>
                                  {allNames.length>0 && (
                                    <div className="text-right">
                                      <div className="font-display text-[28px] font-semibold leading-none">{savedExercises.size}/{allNames.length}</div>
                                      <div className="text-[9.5px] uppercase tracking-[0.08em] text-[#9a9186] mt-0.5">ejercicios</div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Barra progreso */}
                              {allNames.length>0 && savedExercises.size>0 && (
                                <div className="h-2 w-full rounded-full bg-[#ece6db]">
                                  <div className="h-2 rounded-full bg-[#a87d49] transition-all" style={{width:`${(savedExercises.size/allNames.length)*100}%`}}/>
                                </div>
                              )}

                              {/* Ejercicios del día */}
                              {currentDayData?.selections.map(sel=>{
                                const name=sel.exercise.name;
                                const isSaved=savedExercises.has(name);
                                const sets=exerciseLogs[name]??Array.from({length:sel.sets},(_,i)=>({setNumber:i+1,reps:sel.repsMin,weightKg:0,completed:false}));
                                const completedSets=sets.filter(s=>s.completed).length;
                                const maxKg=Math.max(...sets.map(s=>s.weightKg),0);
                                const updateSet=(si:number,field:keyof SetLog,val:number|boolean)=>{
                                  setExerciseLogs(prev=>({...prev,[name]:sets.map((s,idx)=>idx===si?{...s,[field]:val}:s)}));
                                  // Iniciar timer de descanso al marcar set como completado
                                  if(field==="completed"&&val===true) startRestTimer(sel.role,tx(name));
                                };
                                const markAll=()=>{const done=sets.every(s=>s.completed);setExerciseLogs(prev=>({...prev,[name]:sets.map(s=>({...s,completed:!done}))}));if(!done)startRestTimer(sel.role,tx(name));};

                                /* ---- Tarjeta colapsada (ya guardado) ---- */
                                if(isSaved) return (
                                  <article key={name} className="rounded-[16px] border border-[#a87d49] bg-[#fdf9f4] px-4 py-3 flex items-center gap-3">
                                    <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#a87d49] text-white text-sm font-bold">✓</div>
                                    <div className="min-w-0 flex-1">
                                      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a87d49]">{sel.role}</div>
                                      <div className="text-[14px] font-semibold truncate leading-tight">{tx(name)}</div>
                                      <div className="text-[11px] text-[#8c8377] mt-0.5">
                                        {sets.length} series{maxKg>0?` · ${maxKg} kg máx`:""}
                                        {completedSets>0?` · ${completedSets}/${sets.length} completadas`:""}
                                      </div>
                                    </div>
                                    <button onClick={()=>setSavedExercises(prev=>{const n=new Set(prev);n.delete(name);return n;})}
                                      className="flex-none text-[11px] text-[#a39a8d] hover:text-[#a87d49] px-2 py-1">editar</button>
                                  </article>
                                );

                                /* ---- Tarjeta expandida (pendiente) ---- */
                                return (
                                  <article key={name} className="rounded-[18px] border border-[#e7e1d6] bg-white p-4 sm:p-5">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#a87d49]">{sel.role}</div>
                                        <h4 className="font-display text-[15px] font-semibold leading-tight mt-0.5">{tx(name)}</h4>
                                        <p className="text-[11px] text-[#8c8377] mt-0.5">{sel.sets} series · {sel.repsMin}–{sel.repsMax} reps · RIR {sel.rir}</p>
                                      </div>
                                      <button onClick={()=>openSwap(currentWeekData?.weekNumber??1,currentDayData.dayIndex,sel,portalClient.routineId??"",portalClient.experienceLevel,portalClient.trainingLocation)}
                                        className="flex-none rounded-xl border border-[#e0d9cc] px-2.5 py-1 text-[11px] font-semibold text-[#8c8377] hover:border-[#a87d49] hover:text-[#a87d49]">Cambiar ↕</button>
                                    </div>

                                    {/* Sets — optimizado para móvil */}
                                    <div className="mt-3 space-y-1.5">
                                      <div className="grid grid-cols-[28px_1fr_1fr_36px] gap-1.5 px-1 text-[9px] font-semibold uppercase tracking-[0.07em] text-[#a39a8d]">
                                        <span>#</span><span>Reps</span><span>kg</span><span>✓</span>
                                      </div>
                                      {sets.map((s,si)=>(
                                        <div key={si} className={`grid grid-cols-[28px_1fr_1fr_36px] items-center gap-1.5 rounded-xl px-1 py-1 transition ${s.completed?"bg-[#f5f0e8]":"bg-[#faf8f4]"}`}>
                                          <span className="text-center text-[11px] font-bold text-[#a87d49]">{s.setNumber}</span>
                                          <input type="number" inputMode="numeric" min={0} max={50} value={s.reps} onChange={e=>updateSet(si,"reps",Number(e.target.value))}
                                            className="rounded-lg border border-[#e0d9cc] bg-white p-2 text-center text-[14px] font-semibold focus:border-[#a87d49] focus:outline-none w-full"/>
                                          <input type="number" inputMode="decimal" min={0} max={500} step={0.5} value={s.weightKg} onChange={e=>updateSet(si,"weightKg",Number(e.target.value))}
                                            className="rounded-lg border border-[#e0d9cc] bg-white p-2 text-center text-[14px] font-semibold focus:border-[#a87d49] focus:outline-none w-full"/>
                                          <button onClick={()=>updateSet(si,"completed",!s.completed)}
                                            className={`flex h-9 w-9 items-center justify-center rounded-lg text-base font-bold transition ${s.completed?"bg-[#a87d49] text-white":"border-2 border-[#e0d9cc] text-[#c2b9aa]"}`}>
                                            {s.completed?"✓":"○"}
                                          </button>
                                        </div>
                                      ))}
                                      <div className="flex flex-wrap items-center gap-2 pt-1">
                                        <button onClick={markAll} className="rounded-lg border border-[#a87d49] px-3 py-1.5 text-[11px] font-semibold text-[#a87d49]">
                                          {sets.every(s=>s.completed)?"Desmarcar":"Marcar todo ✓"}
                                        </button>
                                        <button onClick={()=>setExerciseLogs(prev=>({...prev,[name]:[...sets,{setNumber:sets.length+1,reps:sel.repsMin,weightKg:sets[sets.length-1]?.weightKg??0,completed:false}]}))}
                                          className="rounded-lg border border-dashed border-[#d8cdb8] px-3 py-1.5 text-[11px] font-semibold text-[#8c8377]">+ Serie</button>
                                        <span className="ml-auto text-[11px] text-[#a39a8d]">{completedSets}/{sets.length}</span>
                                      </div>
                                    </div>

                                    {/* 1RM estimado en tiempo real */}
                                    {(()=>{const orm=bestOneRM(sets as {weightKg:number;reps:number;completed:boolean}[]);return orm?<p className="mt-2 text-[11px] text-[#a87d49] font-semibold">1RM estimado: ~{orm} kg</p>:null;})()}
                                    <input className={`mt-3 ${inputCls}`} placeholder="Notas: peso alcanzado, sensaciones…" value={logNotes[name]??""} onChange={e=>setLogNotes(prev=>({...prev,[name]:e.target.value}))}/>
                                    <button onClick={()=>saveExerciseLog(name,allNames)} disabled={logSaving}
                                      className={`mt-3 w-full py-3 text-sm font-semibold ${primaryBtn}`}>
                                      {logSaving?"Guardando…":"Guardar ejercicio"}
                                    </button>
                                  </article>
                                );
                              })}

                              {/* Swap modal inline */}
                              {swapTarget && swapTarget.dayIndex===currentDayData?.dayIndex && (
                                <article className="rounded-[18px] border border-[#a87d49] bg-[#fffbf5] p-5">
                                  <h4 className="font-display text-[16px] font-semibold">Cambiar: {tx(swapTarget.sel.exercise.name)}</h4>
                                  <p className="text-[12px] text-[#8c8377] mt-0.5">Solo ejercicios del mismo patrón de movimiento</p>
                                  {swapLoading && <p className="mt-3 text-sm text-[#a39a8d]">Buscando alternativas…</p>}
                                  {!swapLoading && swapOptions.length===0 && <p className="mt-3 text-sm text-[#a39a8d]">Sin alternativas disponibles.</p>}
                                  {swapOptions.map(opt=>(
                                    <div key={opt.id} className="mt-2 flex items-center justify-between rounded-xl border border-[#e7e1d6] bg-white p-3">
                                      <span className="text-[13px] font-semibold">{tx(opt.name)}</span>
                                      <button onClick={()=>applySwap(opt.id)} disabled={swapSaving}
                                        className={`ml-3 flex-none rounded-xl px-3 py-1.5 text-[12px] font-semibold ${primaryBtn}`}>Elegir</button>
                                    </div>
                                  ))}
                                  <button onClick={()=>{setSwapTarget(null);setSwapOptions([]);}} className="mt-3 text-[12px] text-[#a39a8d] hover:text-[#17120d]">Cancelar</button>
                                </article>
                              )}

                              {/* Botón guardar sesión completa */}
                              {allNames.length>0 && !sessionComplete && (
                                <button onClick={()=>saveFullSession(allNames)} disabled={logSaving}
                                  className={`w-full py-4 text-[15px] font-semibold ${primaryBtn}`}>
                                  {logSaving?"Guardando…":"Guardar sesión completa"}
                                </button>
                              )}

                              {/* Vista completa de la rutina */}
                              <details className="rounded-[18px] border border-[#e7e1d6] bg-white">
                                <summary className="cursor-pointer px-5 py-4 text-[13px] font-semibold text-[#8c8377] hover:text-[#17120d]">Ver rutina completa ▾</summary>
                                <div className="border-t border-[#e7e1d6] p-5">
                                  <ClientProgramView
                                    program={portalClient.program!}
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
                                </div>
                              </details>
                            </div>
                          );
                        })()
                  )}

                  {/* Registrar sesión */}
                  {portalTab==="registrar" && (
                    <div className="flex flex-col gap-4">
                      {!portalClient.program
                        ? <div className="rounded-[18px] border border-[#e7e1d6] bg-[#faf8f4] p-8 text-center">
                            <div className="text-4xl mb-3">🏋️</div>
                            <p className="font-display text-[17px] font-semibold text-[#17120d]">Tu rutina está en camino</p>
                            <p className="mt-1 text-[13px] text-[#8c8377]">Tu coach la generará pronto. Vuelve aquí para registrar tus sesiones.</p>
                          </div>
                        : (()=>{
                          const allWeeks=portalClient.program!.weeks;
                          const currentWeekData=allWeeks.find(w=>w.weekNumber===logWeek);
                          const currentDayData=currentWeekData?.days.find(d=>d.dayIndex===logDay);
                          const allNames=currentDayData?.selections.map(s=>s.exercise.name)??[];
                          const savedCount=savedExercises.size;
                          const totalCount=allNames.length;

                          if(sessionComplete){
                            return (
                              <div className="rounded-[18px] bg-[#17120d] p-8 text-center text-[#f4f1ea]">
                                <div className="text-5xl mb-3">🎉</div>
                                <h3 className="font-display text-[24px] font-semibold">¡Sesión completada!</h3>
                                <p className="mt-2 text-[13px] text-[#b7ad9d]">Semana {logWeek} · Día {logDay+1} — {FOCUS_LABELS[currentDayData?.focus??""]??""}</p>
                                <p className="mt-1 text-[13px] text-[#9a9186]">{totalCount} ejercicios registrados</p>
                                <button onClick={()=>{setSessionComplete(false);setSavedExercises(new Set());setExerciseLogs({});setLogNotes({});}}
                                  className="mt-5 rounded-xl bg-[#a87d49] px-6 py-3 text-sm font-semibold text-white hover:bg-[#8f6538]">
                                  Registrar otra sesión
                                </button>
                              </div>
                            );
                          }

                          return (
                            <>
                              {/* Selector de sesión */}
                              <article className="rounded-[18px] border border-[#e7e1d6] bg-white p-5">
                                <h3 className="font-display text-[18px] font-semibold">¿Qué sesión entrenaste hoy?</h3>
                                <div className="mt-4 grid grid-cols-2 gap-3">
                                  <label className="block"><span className={labelCls}>Semana</span>
                                    <select className={inputCls} value={logWeek} onChange={e=>{setLogWeek(Number(e.target.value));setExerciseLogs({});setLogNotes({});setSavedExercises(new Set());setSessionComplete(false);}}>
                                      {allWeeks.map(w=><option key={w.weekNumber} value={w.weekNumber}>Semana {w.weekNumber}{w.deload?" — Deload":""}</option>)}
                                    </select>
                                  </label>
                                  <label className="block"><span className={labelCls}>Día</span>
                                    <select className={inputCls} value={logDay} onChange={e=>{setLogDay(Number(e.target.value));setExerciseLogs({});setLogNotes({});setSavedExercises(new Set());setSessionComplete(false);}}>
                                      {currentWeekData?.days.map(d=><option key={d.dayIndex} value={d.dayIndex}>Día {d.dayIndex+1} — {FOCUS_LABELS[d.focus]??d.focus.replace(/_/g," ")}</option>)}
                                    </select>
                                  </label>
                                </div>
                                {/* Barra de progreso de sesión */}
                                {totalCount>0 && (
                                  <div className="mt-4">
                                    <div className="flex items-center justify-between mb-1.5">
                                      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a39a8d]">Progreso de sesión</span>
                                      <span className="text-[12px] font-semibold text-[#a87d49]">{savedCount}/{totalCount} ejercicios</span>
                                    </div>
                                    <div className="h-2 w-full rounded-full bg-[#ece6db]">
                                      <div className="h-2 rounded-full bg-[#a87d49] transition-all" style={{width:`${(savedCount/totalCount)*100}%`}}/>
                                    </div>
                                  </div>
                                )}
                              </article>

                              {currentDayData?.selections.map(sel=>{
                                const name=sel.exercise.name;
                                const isSaved=savedExercises.has(name);
                                const sets=exerciseLogs[name]??Array.from({length:sel.sets},(_,i)=>({setNumber:i+1,reps:sel.repsMin,weightKg:0,completed:false}));
                                const completedSets=sets.filter(s=>s.completed).length;
                                const updateSet=(si:number,field:keyof SetLog,val:number|boolean)=>{
                                  const updated=sets.map((s,idx)=>idx===si?{...s,[field]:val}:s);
                                  setExerciseLogs(prev=>({...prev,[name]:updated}));
                                };
                                const markAllSets=()=>{
                                  const allDone=sets.every(s=>s.completed);
                                  setExerciseLogs(prev=>({...prev,[name]:sets.map(s=>({...s,completed:!allDone}))}));
                                };
                                return (
                                  <article key={name} className={`rounded-[18px] border p-5 transition ${isSaved?"border-[#a87d49] bg-[#fdf9f4]":"border-[#e7e1d6] bg-white"}`}>
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#a87d49]">{sel.role}</div>
                                        <h4 className="font-display text-[17px] font-semibold">{tx(name)}</h4>
                                        <p className="text-[12px] text-[#8c8377]">{sel.sets} series · {sel.repsMin}–{sel.repsMax} reps · RIR {sel.rir}</p>
                                      </div>
                                      {isSaved && <span className="flex-none rounded-full bg-[#a87d49] px-2.5 py-1 text-[11px] font-semibold text-white">Guardado ✓</span>}
                                    </div>

                                    <div className="mt-4 space-y-2">
                                      <div className="grid grid-cols-[36px_1fr_1fr_44px] gap-2 px-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a39a8d]">
                                        <span>#</span><span>Reps</span><span>Peso kg</span><span>Listo</span>
                                      </div>
                                      {sets.map((s,si)=>(
                                        <div key={si} className={`grid grid-cols-[36px_1fr_1fr_44px] items-center gap-2 rounded-xl p-2 transition ${s.completed?"bg-[#f5f0e8]":"bg-[#faf8f4]"}`}>
                                          <span className="text-center text-[13px] font-bold text-[#a87d49]">{s.setNumber}</span>
                                          <input type="number" min={0} max={50} value={s.reps} onChange={e=>updateSet(si,"reps",Number(e.target.value))}
                                            className="rounded-lg border border-[#e0d9cc] bg-white p-2 text-center text-[14px] font-semibold focus:border-[#a87d49] focus:outline-none"/>
                                          <input type="number" min={0} max={500} step={0.5} value={s.weightKg} onChange={e=>updateSet(si,"weightKg",Number(e.target.value))}
                                            className="rounded-lg border border-[#e0d9cc] bg-white p-2 text-center text-[14px] font-semibold focus:border-[#a87d49] focus:outline-none"/>
                                          <button onClick={()=>updateSet(si,"completed",!s.completed)}
                                            className={`flex h-9 w-9 items-center justify-center rounded-lg text-base font-bold transition ${s.completed?"bg-[#a87d49] text-white shadow-sm":"border-2 border-[#e0d9cc] text-[#c2b9aa] hover:border-[#a87d49]"}`}>
                                            {s.completed?"✓":"○"}
                                          </button>
                                        </div>
                                      ))}
                                      <div className="flex flex-wrap gap-2 pt-1">
                                        <button onClick={markAllSets}
                                          className="rounded-lg border border-[#a87d49] px-3 py-1.5 text-[12px] font-semibold text-[#a87d49] hover:bg-[#fdf5ec]">
                                          {sets.every(s=>s.completed)?"Desmarcar todo":"Marcar todo ✓"}
                                        </button>
                                        <button onClick={()=>setExerciseLogs(prev=>({...prev,[name]:[...sets,{setNumber:sets.length+1,reps:sel.repsMin,weightKg:sets[sets.length-1]?.weightKg??0,completed:false}]}))}
                                          className="rounded-lg border border-dashed border-[#d8cdb8] px-3 py-1.5 text-[12px] font-semibold text-[#8c8377] hover:border-[#a87d49] hover:text-[#a87d49]">+ Serie</button>
                                        {sets.length>1&&<button onClick={()=>setExerciseLogs(prev=>({...prev,[name]:sets.slice(0,-1)}))}
                                          className="rounded-lg border border-dashed border-[#d8cdb8] px-3 py-1.5 text-[12px] font-semibold text-[#8c8377] hover:border-[#9a4b34] hover:text-[#9a4b34]">− Serie</button>}
                                        <span className="ml-auto text-[11px] text-[#a39a8d] self-center">{completedSets}/{sets.length} completadas</span>
                                      </div>
                                    </div>

                                    <label className="mt-3 block"><span className={labelCls}>Notas</span>
                                      <input className={inputCls} placeholder="Sensaciones, técnica, peso alcanzado…" value={logNotes[name]??""} onChange={e=>setLogNotes(prev=>({...prev,[name]:e.target.value}))}/>
                                    </label>
                                    <button onClick={()=>saveExerciseLog(name, allNames)} disabled={logSaving||isSaved}
                                      className={`mt-3 px-5 py-2.5 text-sm transition ${isSaved?"cursor-default rounded-xl bg-[#ece6db] text-[#a39a8d]":primaryBtn}`}>
                                      {isSaved?"Guardado":"Guardar ejercicio"}
                                    </button>
                                  </article>
                                );
                              })}

                              {/* Botón guardar sesión completa */}
                              {allNames.length>0 && !sessionComplete && (
                                <button onClick={()=>saveFullSession(allNames)} disabled={logSaving}
                                  className={`w-full py-4 text-[15px] font-semibold ${primaryBtn}`}>
                                  {logSaving?"Guardando sesión…":"Guardar sesión completa"}
                                </button>
                              )}
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

                      {/* Fotos de progreso */}
                      <article className="rounded-[18px] border border-[#e7e1d6] bg-white p-5">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-display text-[17px] font-semibold">Fotos de progreso</h3>
                          {progressPhotos.length>=2 && (
                            <button onClick={()=>setCompareMode(!compareMode)}
                              className={`rounded-xl px-3 py-1.5 text-[11px] font-semibold transition ${compareMode?"bg-[#17120d] text-white":"border border-[#e0d9cc] text-[#8c8377]"}`}>
                              {compareMode?"Galería":"Comparar →"}
                            </button>
                          )}
                        </div>

                        {/* Modo comparación: primera vs última */}
                        {compareMode && progressPhotos.length>=2 && (
                          <div className="mb-4 grid grid-cols-2 gap-3">
                            {[progressPhotos[0],progressPhotos[progressPhotos.length-1]].map((p,i)=>(
                              <div key={p.id} className="flex flex-col gap-1">
                                <img src={p.url} alt="" className="w-full rounded-[12px] object-cover aspect-[3/4]"/>
                                <div className="text-center">
                                  <div className="text-[10px] font-semibold uppercase tracking-wide text-[#a87d49]">{i===0?"Inicio":"Ahora"}</div>
                                  <div className="text-[10px] text-[#a39a8d]">{new Date(p.takenAt).toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"})}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Galería */}
                        {!compareMode && progressPhotos.length>0 && (
                          <div className="mb-4 grid grid-cols-3 gap-2">
                            {progressPhotos.map(p=>(
                              <div key={p.id} className="relative group">
                                <img src={p.url} alt="" className="w-full rounded-[10px] object-cover aspect-square"/>
                                <div className="absolute inset-0 rounded-[10px] bg-black/0 group-hover:bg-black/30 transition flex items-end p-1.5">
                                  <div className="hidden group-hover:flex w-full items-center justify-between">
                                    <span className="text-[9px] text-white">{new Date(p.takenAt).toLocaleDateString("es-MX",{day:"2-digit",month:"short"})}</span>
                                    <button onClick={()=>deletePhoto(p.id)} className="text-white/80 hover:text-red-300 text-[11px]">✕</button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {progressPhotos.length===0 && (
                          <p className="mb-4 text-center text-[12px] text-[#b3aa9b]">Aún no tienes fotos. ¡Sube tu primera foto de referencia!</p>
                        )}

                        {/* Upload */}
                        <input className={inputCls} placeholder="Nota (opcional): semana 1, frente…" value={photoNote} onChange={e=>setPhotoNote(e.target.value)}/>
                        <label className={`mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition ${photoUploading?"opacity-50 cursor-not-allowed bg-[#ece6db] text-[#8c8377]":primaryBtn}`}>
                          {photoUploading?"Subiendo…":"📷 Subir foto"}
                          <input type="file" accept="image/*" capture="environment" className="hidden" disabled={photoUploading}
                            onChange={e=>{const f=e.target.files?.[0];if(f)uploadPhoto(f);e.target.value="";}}/>
                        </label>
                      </article>

                      {/* Registro de peso corporal */}
                      <article className="rounded-[18px] border border-[#e7e1d6] bg-white p-5">
                        <h3 className="font-display text-[17px] font-semibold mb-4">Peso corporal</h3>
                        {weightLogs.length>0 && (()=>{
                          const chartData=weightLogs.slice(-8).map(l=>({label:new Date(l.loggedAt).toLocaleDateString("es-MX",{day:"2-digit",month:"short"}),value:l.weightKg}));
                          const first=weightLogs[0].weightKg;
                          const last=weightLogs[weightLogs.length-1].weightKg;
                          return(
                            <div className="mb-4">
                              <LineChart data={chartData} yUnit="kg"/>
                              <div className="mt-2 grid grid-cols-3 gap-2">
                                <div className="rounded-lg bg-[#faf8f4] p-2 text-center">
                                  <div className="font-display text-[17px] font-semibold">{first}kg</div>
                                  <div className="text-[9px] uppercase text-[#9a9186]">Inicio</div>
                                </div>
                                <div className="rounded-lg bg-[#faf8f4] p-2 text-center">
                                  <div className="font-display text-[17px] font-semibold">{last}kg</div>
                                  <div className="text-[9px] uppercase text-[#9a9186]">Actual</div>
                                </div>
                                <div className="rounded-lg bg-[#faf8f4] p-2 text-center">
                                  <div className={`font-display text-[17px] font-semibold ${last-first<=0?"text-[#2e7d32]":"text-[#a87d49]"}`}>{last-first>0?"+":""}{(last-first).toFixed(1)}kg</div>
                                  <div className="text-[9px] uppercase text-[#9a9186]">Cambio</div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                        <div className="flex gap-2">
                          <input type="number" inputMode="decimal" step={0.1} min={30} max={300}
                            className={`flex-1 ${inputCls}`} placeholder="Tu peso hoy (kg)" value={newWeight} onChange={e=>setNewWeight(e.target.value)}/>
                          <button onClick={saveWeight} disabled={weightSaving||!newWeight}
                            className={`flex-none px-4 py-2 text-sm font-semibold ${primaryBtn}`}>
                            {weightSaving?"…":"Guardar"}
                          </button>
                        </div>
                        {weightLogs.length>0 && (
                          <p className="mt-1.5 text-[11px] text-[#b3aa9b]">Último registro: {weightLogs[weightLogs.length-1].weightKg}kg</p>
                        )}
                      </article>

                      {/* Medidas corporales */}
                      <article className="rounded-[18px] border border-[#e7e1d6] bg-white p-5">
                        <h3 className="font-display text-[17px] font-semibold mb-4">Medidas corporales</h3>

                        {/* Gráficas si hay datos */}
                        {measurementLogs.length>=2 && (()=>{
                          const metrics:[string,keyof MeasLog,string][]=[
                            ["Cadera","hipCm","cm"],["Cintura","waistCm","cm"],
                            ["Muslo","thighCm","cm"],["Brazo","armCm","cm"],
                          ];
                          return(
                            <div className="mb-4 grid grid-cols-2 gap-3">
                              {metrics.map(([label,key,unit])=>{
                                const data=measurementLogs.filter(l=>l[key]!=null).map(l=>({
                                  label:new Date(l.loggedAt).toLocaleDateString("es-MX",{day:"2-digit",month:"short"}),
                                  value:l[key] as number,
                                }));
                                if(data.length<2)return null;
                                const first=data[0].value,last=data[data.length-1].value;
                                const delta=last-first;
                                return(
                                  <div key={key} className="rounded-[14px] border border-[#ece6db] p-3">
                                    <div className="flex items-baseline justify-between mb-2">
                                      <span className="text-[12px] font-semibold">{label}</span>
                                      <span className={`text-[12px] font-bold ${delta<=0?"text-[#2e7d32]":"text-[#a87d49]"}`}>{delta>0?"+":""}{delta.toFixed(1)}{unit}</span>
                                    </div>
                                    <LineChart data={data} yUnit={unit}/>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}

                        {/* Formulario */}
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {([["hip","Cadera cm"],["waist","Cintura cm"],["thigh","Muslo cm"],["arm","Brazo cm"],["chest","Pecho cm"]] as [keyof typeof measForm,string][]).map(([k,label])=>(
                            <label key={k} className="block">
                              <span className={labelCls}>{label}</span>
                              <input type="number" inputMode="decimal" step={0.1} min={20} max={200} className={inputCls} placeholder="—"
                                value={measForm[k]} onChange={e=>setMeasForm(prev=>({...prev,[k]:e.target.value}))}/>
                            </label>
                          ))}
                        </div>
                        <input className={`mt-2 ${inputCls}`} placeholder="Notas (opcional)" value={measForm.notes} onChange={e=>setMeasForm(prev=>({...prev,notes:e.target.value}))}/>
                        <button onClick={saveMeasurement} disabled={measSaving}
                          className={`mt-3 w-full py-3 text-sm font-semibold ${primaryBtn}`}>
                          {measSaving?"Guardando…":"Guardar medidas de hoy"}
                        </button>
                        {measurementLogs.length>0 && (
                          <p className="mt-1.5 text-[11px] text-[#b3aa9b]">
                            Último registro: {new Date(measurementLogs[measurementLogs.length-1].loggedAt).toLocaleDateString("es-MX",{day:"2-digit",month:"long",year:"numeric"})}
                          </p>
                        )}
                      </article>

                      {/* Adherencia semanal */}
                      {portalClient.program && (()=>{
                        const weeks=portalClient.program!.weeks;
                        const barData=weeks.map(w=>{
                          const prog=portalClient.progress.find(p=>p.weekNumber===w.weekNumber);
                          const done=prog?.completedSessions??0;
                          const total=portalClient.daysPerWeek;
                          return{label:`S${w.weekNumber}`,pct:total>0?Math.min(100,Math.round(done/total*100)):0};
                        });
                        const totalDone=portalClient.progress.reduce((s,p)=>s+p.completedSessions,0);
                        const totalSessions=weeks.length*portalClient.daysPerWeek;
                        return(
                          <article className="rounded-[18px] border border-[#e7e1d6] bg-white p-5">
                            <div className="flex items-baseline justify-between mb-4">
                              <h3 className="font-display text-[17px] font-semibold">Adherencia semanal</h3>
                              <span className="text-[13px] font-semibold text-[#a87d49]">{totalSessions>0?Math.round(totalDone/totalSessions*100):0}% total</span>
                            </div>
                            <BarChart data={barData}/>
                            <p className="mt-2 text-[10px] text-[#b3aa9b] text-center">{totalDone} de {totalSessions} sesiones completadas</p>
                          </article>
                        );
                      })()}

                      {/* Progresión de carga */}
                      <article className="rounded-[18px] border border-[#e7e1d6] bg-white p-5">
                        <h3 className="font-display mb-3 text-[17px] font-semibold">Progresión de carga</h3>
                        <select className={inputCls} value={historyExercise} onChange={e=>{setHistoryExercise(e.target.value);if(e.target.value)loadHistory(e.target.value);}}>
                          <option value="">— elige un ejercicio —</option>
                          {portalClient.program?.weeks[0]?.days.flatMap(d=>d.selections.map(s=>s.exercise.name)).filter((n,i,a)=>a.indexOf(n)===i).map(n=><option key={n} value={n}>{tx(n)}</option>)}
                        </select>

                        {historyLoading && <p className="mt-3 text-sm text-[#a39a8d]">Cargando…</p>}

                        {!historyLoading && historyExercise && historyData.length===0 && (
                          <p className="mt-3 text-sm text-[#a39a8d]">Sin registros aún para este ejercicio.</p>
                        )}

                        {historyData.length>0 && (()=>{
                          const chartData=historyData.map(log=>({
                            label:`S${log.weekNumber}D${log.dayIndex+1}`,
                            value:Math.max(...(log.setsData as {weightKg:number}[]).map(s=>s.weightKg),0),
                          }));
                          const maxKgAll=Math.max(...chartData.map(d=>d.value),0);
                          const firstKg=chartData[0]?.value??0;
                          const lastKg=chartData[chartData.length-1]?.value??0;
                          const delta=lastKg-firstKg;
                          // 1RM del mejor set de toda la historia
                          const allSets=historyData.flatMap(l=>l.setsData as {weightKg:number;reps:number;completed:boolean}[]);
                          const best1RM=bestOneRM(allSets);
                          return(
                            <div className="mt-4">
                              <LineChart data={chartData}/>
                              <div className={`mt-3 grid gap-2 ${best1RM?"grid-cols-4":"grid-cols-3"}`}>
                                <div className="rounded-lg bg-[#faf8f4] p-2.5 text-center">
                                  <div className="font-display text-[17px] font-semibold text-[#a87d49]">{maxKgAll}<span className="text-[10px] font-normal"> kg</span></div>
                                  <div className="text-[9px] uppercase tracking-wide text-[#9a9186]">Récord</div>
                                </div>
                                <div className="rounded-lg bg-[#faf8f4] p-2.5 text-center">
                                  <div className="font-display text-[17px] font-semibold">{firstKg}<span className="text-[10px] font-normal"> kg</span></div>
                                  <div className="text-[9px] uppercase tracking-wide text-[#9a9186]">Inicio</div>
                                </div>
                                <div className="rounded-lg bg-[#faf8f4] p-2.5 text-center">
                                  <div className={`font-display text-[17px] font-semibold ${delta>=0?"text-[#2e7d32]":"text-[#c62828]"}`}>{delta>0?"+":""}{delta}<span className="text-[10px] font-normal"> kg</span></div>
                                  <div className="text-[9px] uppercase tracking-wide text-[#9a9186]">Progreso</div>
                                </div>
                                {best1RM && (
                                  <div className="rounded-lg bg-[#f0e7d8] p-2.5 text-center">
                                    <div className="font-display text-[17px] font-semibold text-[#8f6a3c]">~{best1RM}<span className="text-[10px] font-normal"> kg</span></div>
                                    <div className="text-[9px] uppercase tracking-wide text-[#9a9186]">1RM est.</div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </article>

                      {/* Registros detallados + notas del coach */}
                      {historyData.length>0 && (
                        <article className="rounded-[18px] border border-[#e7e1d6] bg-white p-5">
                          <h4 className="font-display text-[15px] font-semibold mb-3">{tx(historyExercise)} — detalle</h4>
                          <div className="flex flex-col gap-2">
                            {historyData.map(log=>{
                              const maxKg=Math.max(...log.setsData.map(s=>s.weightKg),0);
                              const completed=log.setsData.filter(s=>s.completed).length;
                              const coachNote=coachNotes[`${log.weekNumber}-${log.dayIndex}`];
                              const feedback=sessionFeedbacks[`${log.weekNumber}-${log.dayIndex}`];
                              return(
                                <div key={log.id} className="rounded-xl border border-[#ece6db] px-4 py-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[13px] font-semibold">Sem {log.weekNumber} · Día {log.dayIndex+1}</span>
                                      {feedback && <span className="text-base">{feedback==="easy"?"😴":feedback==="good"?"💪":"🥵"}</span>}
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-[13px] font-semibold text-[#a87d49]">{maxKg}kg</span>
                                      <span className="text-[11px] text-[#a39a8d]">{completed}/{log.setsData.length} series</span>
                                    </div>
                                  </div>
                                  {coachNote && (
                                    <div className="mt-1.5 rounded-lg bg-[#fdf8f0] border border-[#ede0c4] px-3 py-1.5">
                                      <span className="text-[10px] font-semibold uppercase tracking-wide text-[#a87d49]">Coach: </span>
                                      <span className="text-[12px] text-[#7a6a52]">{coachNote}</span>
                                    </div>
                                  )}
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
      {/* ── Timer de descanso flotante ── */}
      {restTimer && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2">
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-[#17120d] px-6 py-4 shadow-2xl text-[#f4f1ea]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a87d49]">Descansa</div>
            {/* Círculo de progreso */}
            <div className="relative flex h-20 w-20 items-center justify-center">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="#2a231a" strokeWidth="6"/>
                <circle cx="40" cy="40" r="34" fill="none" stroke="#a87d49" strokeWidth="6"
                  strokeDasharray={`${2*Math.PI*34}`}
                  strokeDashoffset={`${2*Math.PI*34*(1-restTimer.secs/restTimer.total)}`}
                  strokeLinecap="round" style={{transition:"stroke-dashoffset 1s linear"}}/>
              </svg>
              <span className="font-display text-[28px] font-bold leading-none">
                {Math.floor(restTimer.secs/60)}:{String(restTimer.secs%60).padStart(2,"0")}
              </span>
            </div>
            <div className="text-[11px] text-[#9a9186] max-w-[160px] text-center truncate">{restTimer.label}</div>
            <button onClick={()=>{clearInterval(restTimerRef.current!);setRestTimer(null);}}
              className="mt-1 rounded-xl border border-white/20 px-4 py-1.5 text-[11px] font-semibold text-white/60 hover:text-white">
              Saltar
            </button>
          </div>
        </div>
      )}

      {/* ── Modal Check-in semanal ── */}
      {showCheckIn && portalClientId && (()=>{
        const portalC=clients.find(c=>c.id===portalClientId);
        const currentWeek=portalC?.program?.weeks.find((_,i)=>i===logWeek-1)?.weekNumber??logWeek;
        const existing=checkIns.find(c=>c.weekNumber===currentWeek);
        return(
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={()=>setShowCheckIn(false)}>
            <div className="w-full max-w-sm rounded-[24px] bg-white p-6" onClick={e=>e.stopPropagation()}>
              <h3 className="font-display text-[20px] font-semibold">Check-in Semana {currentWeek}</h3>
              <p className="mt-1 text-[12px] text-[#8c8377]">¿Cómo vas esta semana? Tu coach lo verá.</p>
              {([
                ["energy","⚡ Energía",checkInForm.energy],
                ["sleep","😴 Sueño",checkInForm.sleep],
                ["stress","🧠 Estrés (1=tranquila)",checkInForm.stress],
              ] as [string,string,number][]).map(([key,label,val])=>(
                <div key={key} className="mt-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[13px] font-semibold">{label}</span>
                    <span className="text-[13px] font-bold text-[#a87d49]">{val}/5</span>
                  </div>
                  <div className="flex gap-2">
                    {[1,2,3,4,5].map(n=>(
                      <button key={n} onClick={()=>setCheckInForm(prev=>({...prev,[key]:n}))}
                        className={`flex-1 rounded-xl py-2.5 text-[13px] font-bold transition ${val===n?"bg-[#a87d49] text-white":"bg-[#faf8f4] text-[#8c8377] hover:bg-[#f0e7d8]"}`}>{n}</button>
                    ))}
                  </div>
                </div>
              ))}
              <textarea className={`mt-4 ${inputCls} min-h-[60px] resize-none text-[13px]`}
                placeholder="Nota opcional: cómo te has sentido, algo que quieras comentar…"
                value={checkInForm.notes} onChange={e=>setCheckInForm(prev=>({...prev,notes:e.target.value}))}/>
              {existing && <p className="mt-2 text-[11px] text-[#a87d49]">Ya tienes check-in esta semana. Guardar sobreescribirá.</p>}
              <button onClick={()=>saveCheckIn(currentWeek)} disabled={checkInSaving} className={`mt-4 w-full py-3 text-sm ${primaryBtn}`}>
                {checkInSaving?"Guardando…":"Enviar check-in"}
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── Modal Guardar Template ── */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={()=>setShowTemplateModal(false)}>
          <div className="w-full max-w-sm rounded-[24px] bg-white p-6" onClick={e=>e.stopPropagation()}>
            <h3 className="font-display text-[20px] font-semibold mb-1">Guardar como template</h3>
            <p className="text-[12px] text-[#8c8377] mb-4">Podrás aplicar este programa a otros asesorados con un clic.</p>
            <label className="block"><span className={labelCls}>Nombre del template</span>
              <input className={inputCls} placeholder="Ej. PPL Principiante 4 días" value={templateName} onChange={e=>setTemplateName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveAsTemplate()}/>
            </label>
            <button onClick={saveAsTemplate} disabled={templateSaving||!templateName.trim()} className={`mt-4 w-full py-3 text-sm ${primaryBtn}`}>
              {templateSaving?"Guardando…":"Guardar template"}
            </button>
          </div>
        </div>
      )}

      {/* ── Modal Aplicar Template ── */}
      {showApplyModal && applyingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={()=>{setShowApplyModal(false);setApplyingTemplate(null);}}>
          <div className="w-full max-w-sm rounded-[24px] bg-white p-6" onClick={e=>e.stopPropagation()}>
            <h3 className="font-display text-[20px] font-semibold mb-1">Aplicar: {applyingTemplate.name}</h3>
            <p className="text-[12px] text-[#8c8377] mb-4">Selecciona el asesorado que recibirá este programa.</p>
            <select className={inputCls} value={applyClientId} onChange={e=>setApplyClientId(e.target.value)}>
              <option value="">— selecciona asesorado —</option>
              {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button onClick={applyTemplate} disabled={templateSaving||!applyClientId} className={`mt-4 w-full py-3 text-sm ${primaryBtn}`}>
              {templateSaving?"Aplicando…":"Aplicar programa"}
            </button>
          </div>
        </div>
      )}

      {/* ── Célébración de PR ── */}
      {prAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={()=>setPrAlert(null)}>
          <div className="w-full max-w-sm rounded-[24px] bg-[#17120d] p-8 text-center text-[#f4f1ea]" onClick={e=>e.stopPropagation()}>
            <div className="text-6xl mb-3">🏆</div>
            <h3 className="font-display text-[26px] font-semibold">¡Nuevo récord!</h3>
            <p className="mt-2 text-[14px] text-[#b7ad9d]">{prAlert.name}</p>
            <div className="mt-4 flex items-baseline justify-center gap-2">
              <span className="font-display text-[48px] font-bold text-[#a87d49] leading-none">{prAlert.kg}</span>
              <span className="text-[18px] text-[#9a9186]">kg</span>
            </div>
            {prAlert.prev>0 && (
              <p className="mt-2 text-[13px] text-[#9a9186]">Antes: {prAlert.prev} kg · <span className="text-[#a87d49]">+{(prAlert.kg-prAlert.prev).toFixed(1)} kg</span></p>
            )}
            {(()=>{const orm=estimatedOneRM(prAlert.kg,8);return orm?<p className="mt-1 text-[12px] text-[#9a9186]">1RM estimado: ~<span className="text-[#a87d49] font-semibold">{orm} kg</span></p>:null;})()}
            <button onClick={()=>setPrAlert(null)} className={`mt-6 w-full py-3 text-sm ${primaryBtn}`}>
              ¡A seguir rompiendo! 💪
            </button>
          </div>
        </div>
      )}

      {/* WhatsApp flotante — solo para asesorados */}
      {authSession?.role==="client" && (
        <a href={`https://wa.me/${COACH_WHATSAPP}`} target="_blank" rel="noopener noreferrer"
          className="fixed bottom-24 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] shadow-lg hover:scale-110 transition-transform"
          title="WhatsApp con tu coach">
          <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.118.554 4.107 1.523 5.827L.057 23.886c-.07.358.241.669.599.599l6.059-1.466A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.793 9.793 0 01-5.001-1.373l-.359-.214-3.727.977.977-3.727-.214-.359A9.793 9.793 0 012.182 12C2.182 6.56 6.56 2.182 12 2.182S21.818 6.56 21.818 12 17.44 21.818 12 21.818z"/>
          </svg>
        </a>
      )}

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
            {volumeStats(program.goal, week).map(({v,l})=>(
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

function volumeStats(goal: Goal, week: Week): {v:string|number; l:string}[] {
  const isGlute = goal==="glute_hypertrophy"||goal==="glute_growth";
  if(isGlute) return [
    {v:week.volume.weeklyGluteSets, l:"series glúteo"},
    {v:`${Math.round(week.volume.lowerVolumePct*100)}%`, l:"tren inferior"},
    {v:`${week.volume.gluteFrequency}×`, l:"frec. glúteo"},
  ];
  const totalSets=week.days.reduce((s,d)=>s+d.totalSets,0);
  return [
    {v:totalSets, l:"series totales"},
    {v:`${Math.round(week.volume.lowerVolumePct*100)}%`, l:"tren inferior"},
    {v:`${Math.round(week.volume.upperVolumePct*100)}%`, l:"tren superior"},
  ];
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
            {volumeStats(program.goal, week).map(({v,l})=>(
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
  const displayName = otherName || (myRole === "client" ? "Coach" : "Asesorada");
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
              <div className="text-[10px] text-[#9a9186]">{myRole==="coach" ? "Asesorada" : "Head Coach"}</div>
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

