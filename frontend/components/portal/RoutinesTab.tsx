
interface WeeklyProgress {
  weekNumber: number;
  completedSessions: number;
  notes: string;
  updatedAt: string;
}

interface Mesocycle {
  num: number;
  weeks: WeeklyProgress[];
  status: 'closed'|'active'|'upcoming';
  completedSessions: number;
  totalSessions: number;
}

interface RoutinesTabProps {
  progress: WeeklyProgress[];
  daysPerWeek: number;
  groupProgressByMesocycles: (progress: WeeklyProgress[], daysPerWeek: number) => Mesocycle[];
  clientName?: string;
}

export function RoutinesTab({ progress, daysPerWeek, groupProgressByMesocycles, clientName }: RoutinesTabProps) {
  const mesocycles = groupProgressByMesocycles(progress, daysPerWeek);

  if (mesocycles.every(m => m.weeks.length === 0)) {
    return (
      <div className="rounded-lg border border-[#e7e1d6] bg-[#faf8f4] p-8 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#f0e7d8] text-[18px]">◔</div>
        <p className="mt-3 font-semibold text-[#17120d]">Sin historial de entrenamiento aún</p>
        <p className="mt-1 text-[13px] text-[#8c8377]">
          Cuando {clientName?.split(" ")[0] ?? "el asesorado"} registre su primera sesión, verás aquí el progreso por mesociclo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {mesocycles.map(meso => (
        <div key={meso.num} className="rounded-lg border border-[#e7e1d6] bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-lg font-semibold text-[#17120d]">Mesociclo {meso.num}</div>
              <div className="text-xs text-[#8c8377] mt-1">
                Semanas {(meso.num - 1) * 4 + 1}–{meso.num * 4}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-sm font-semibold text-[#a87d49]">
                  {meso.completedSessions}/{meso.totalSessions}
                </div>
                <div className="text-xs text-[#8c8377]">sesiones</div>
              </div>
              <div
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  meso.status === 'closed'
                    ? 'bg-[#f1ece0] text-[#a89f8d]'
                    : meso.status === 'active'
                    ? 'bg-[#e9efe3] text-[#5f7a4f]'
                    : 'bg-[#e6ecf2] text-[#4a6076]'
                }`}
              >
                {meso.status === 'closed' ? 'Cerrado' : meso.status === 'active' ? 'En curso' : 'Próximo'}
              </div>
            </div>
          </div>
          {meso.weeks.length > 0 && (
            <div className="space-y-2 text-xs text-[#8c8377]">
              {meso.weeks.map(week => (
                <div key={week.weekNumber} className="flex justify-between">
                  <span>Semana {week.weekNumber}</span>
                  <span>
                    {week.completedSessions}/{daysPerWeek} sesiones
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
