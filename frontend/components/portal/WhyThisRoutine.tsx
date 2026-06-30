import { useState } from "react";

interface RationaleWeek {
  weekNumber: number;
  rir: number;
  deload: boolean;
  volume: { weeklyGluteSets: number; lowerVolumePct: number; gluteFrequency: number };
}
interface RationaleProgram {
  goal: string;
  daysPerWeek: number;
  weeks: RationaleWeek[];
}

interface WhyThisRoutineProps {
  program: RationaleProgram;
  goalLabel: string;
  levelLabel: string;
}

interface Bullet { icon: string; title: string; text: string; }

export function buildRoutineRationale(program: RationaleProgram, goalLabel: string, levelLabel: string): Bullet[] {
  const weeks = program.weeks;
  if (weeks.length === 0) return [];
  const totalWeeks = weeks.length;
  const working = weeks.filter(w => !w.deload);
  const deloadWeeks = weeks.filter(w => w.deload).map(w => w.weekNumber);
  const w1 = weeks[0];
  const gluteSets = w1.volume.weeklyGluteSets;
  const freq = w1.volume.gluteFrequency;
  const lowerPct = Math.round(w1.volume.lowerVolumePct * 100);
  const isGluteFocus = /glute|lower/i.test(program.goal) || gluteSets >= 16;

  const rirs = working.map(w => w.rir);
  const maxRir = rirs.length ? Math.max(...rirs) : 0;
  const minRir = rirs.length ? Math.min(...rirs) : 0;

  const bullets: Bullet[] = [];

  // 1. Objetivo + volumen
  if (isGluteFocus && gluteSets > 0 && freq > 0) {
    bullets.push({
      icon: "🎯",
      title: "Tu objetivo manda",
      text: `Como buscas ${goalLabel.toLowerCase()}, el plan concentra ${gluteSets} series de glúteo por semana repartidas en ${freq} días. Entrenar el músculo varias veces por semana lo hace crecer más rápido que trabajarlo una sola vez.`,
    });
  } else {
    bullets.push({
      icon: "🎯",
      title: "Tu objetivo manda",
      text: `El plan está armado para ${goalLabel.toLowerCase()}: el volumen y los ejercicios se eligieron para empujar justo ese resultado según tu nivel ${levelLabel.toLowerCase()}.`,
    });
  }

  // 2. Equilibrio tren inferior/superior
  if (lowerPct >= 55 && lowerPct <= 90) {
    bullets.push({
      icon: "⚖️",
      title: "Enfoque con equilibrio",
      text: `${lowerPct}% del trabajo va a tren inferior y el resto a tren superior: prioriza tu objetivo sin descuidar el resto del cuerpo.`,
    });
  }

  // 3. Sobrecarga progresiva por RIR
  if (maxRir > minRir) {
    bullets.push({
      icon: "📈",
      title: "Subes de a poco",
      text: `Cada semana te exiges un poco más: el RIR (las repeticiones que te sobran al terminar cada serie) baja de ${maxRir} a ${minRir}. Empiezas cómodo y terminas cerca de tu máximo esfuerzo. A eso se le llama sobrecarga progresiva.`,
    });
  }

  // 4. Deload
  if (deloadWeeks.length > 0) {
    bullets.push({
      icon: "🌙",
      title: "Semana de descanso",
      text: `La semana ${deloadWeeks.join(" y ")} es de descarga: menos series y más suave, para que tu cuerpo se recupere y vuelvas más fuerte al siguiente bloque.`,
    });
  }

  // 5. Orden de ejercicios
  bullets.push({
    icon: "🔢",
    title: "El orden importa",
    text: `Cada día empieza con los ejercicios pesados (6–10 reps) cuando tienes más energía, y cierra con los ligeros (12–20 reps) para el último bombeo.`,
  });

  // 6. Bloque completo
  bullets.push({
    icon: "🗓️",
    title: `${totalWeeks} semanas, un bloque`,
    text: `Es un mesociclo completo. Al terminarlo, tu coach ajusta cargas y ejercicios para que sigas progresando en el siguiente.`,
  });

  return bullets;
}

export function WhyThisRoutine({ program, goalLabel, levelLabel }: WhyThisRoutineProps) {
  const [open, setOpen] = useState(false);
  const bullets = buildRoutineRationale(program, goalLabel, levelLabel);
  if (bullets.length === 0) return null;

  return (
    <article className="overflow-hidden rounded-2xl border border-[#e7e1d6] bg-[#faf8f4]">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-[#f4efe5]"
      >
        <span className="flex items-center gap-2.5">
          <span className="text-[18px]">💡</span>
          <span className="font-display text-[16px] font-semibold text-[#17120d]">¿Por qué esta rutina?</span>
        </span>
        <span className={`text-[#a87d49] transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="border-t border-[#ece6db] px-5 py-4">
          <div className="flex flex-col gap-3.5">
            {bullets.map((b, i) => (
              <div key={i} className="flex gap-3">
                <span className="flex-none text-[16px] leading-6">{b.icon}</span>
                <div>
                  <div className="text-[13.5px] font-semibold text-[#3a342c]">{b.title}</div>
                  <div className="mt-0.5 text-[12.5px] leading-relaxed text-[#6b6358]">{b.text}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 border-t border-[#ece6db] pt-3 text-[11px] text-[#a39a8d]">
            Generado automáticamente según tu objetivo, nivel y disponibilidad. Tu coach puede ajustarlo cuando quiera.
          </p>
        </div>
      )}
    </article>
  );
}
