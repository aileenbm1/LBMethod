interface ChartPoint { label: string; value: number; }

interface AvanceChartsProps {
  volumeData: ChartPoint[];
  strengthData: ChartPoint[];
  adherencePct: number;
  totalSessions: number;
  deltaPct: number;
}

function BarChart({ data }: { data: ChartPoint[] }) {
  if (data.length === 0) {
    return <div className="flex h-[120px] items-center justify-center text-[12px] text-[#b3aa9b]">Sin datos aún</div>;
  }
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex h-[120px] items-end justify-between gap-2 px-1">
      {data.map((d, i) => {
        const h = Math.max((d.value / max) * 100, 4);
        const isLast = i === data.length - 1;
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full flex-1 items-end">
              <div
                className={`w-full rounded-t-[4px] transition-all ${isLast ? "bg-[#a87d49]" : "bg-[#ddd0bb]"}`}
                style={{ height: `${h}%` }}
                title={`${d.value}`}
              />
            </div>
            <span className="text-[9.5px] text-[#a39a8d]">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function LineChart({ data }: { data: ChartPoint[] }) {
  if (data.length < 2) {
    return <div className="flex h-[120px] items-center justify-center text-[12px] text-[#b3aa9b]">Faltan datos</div>;
  }
  const W = 260, H = 100, pad = 6;
  const max = Math.max(...data.map(d => d.value), 1);
  const min = Math.min(...data.map(d => d.value), 0);
  const range = max - min || 1;
  const pts = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (W - pad * 2);
    const y = H - pad - ((d.value - min) / range) * (H - pad * 2);
    return [x, y] as const;
  });
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${pts[pts.length - 1][0].toFixed(1)},${H - pad} L${pts[0][0].toFixed(1)},${H - pad} Z`;
  return (
    <div className="h-[120px] w-full">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full">
        <defs>
          <linearGradient id="strengthFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a87d49" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#a87d49" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#strengthFill)" />
        <path d={linePath} fill="none" stroke="#a87d49" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {pts.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r="2.5" fill="#a87d49" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
    </div>
  );
}

export function AvanceCharts({ volumeData, strengthData, adherencePct, totalSessions, deltaPct }: AvanceChartsProps) {
  const deltaPositive = deltaPct >= 0;
  return (
    <div className="flex flex-col gap-4">
      {/* Gráficas */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-[16px] border border-[#ece6db] bg-[#faf8f4] p-5">
          <div className="text-[12px] font-semibold text-[#6b6358]">Volumen semanal (series)</div>
          <div className="mt-3"><BarChart data={volumeData} /></div>
        </div>
        <div className="rounded-[16px] border border-[#ece6db] bg-[#faf8f4] p-5">
          <div className="text-[12px] font-semibold text-[#6b6358]">Progreso de fuerza</div>
          <div className="mt-3"><LineChart data={strengthData} /></div>
          <div className="mt-1 text-right text-[10px] text-[#b3aa9b]">Últimas {strengthData.length} semanas</div>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-[16px] border border-[#ece6db] bg-white p-4 text-center">
          <div className="font-display text-[28px] font-semibold text-[#a87d49] leading-none">{adherencePct}%</div>
          <div className="mt-1.5 text-[11px] text-[#8c8377]">Adherencia</div>
        </div>
        <div className="rounded-[16px] border border-[#ece6db] bg-white p-4 text-center">
          <div className="font-display text-[28px] font-semibold text-[#17120d] leading-none">{totalSessions}</div>
          <div className="mt-1.5 text-[11px] text-[#8c8377]">Sesiones</div>
        </div>
        <div className="rounded-[16px] border border-[#ece6db] bg-white p-4 text-center">
          <div className={`font-display text-[28px] font-semibold leading-none ${deltaPositive ? "text-[#5f7a4f]" : "text-[#b5573f]"}`}>
            {deltaPositive ? "+" : ""}{deltaPct}%
          </div>
          <div className="mt-1.5 text-[11px] text-[#8c8377]">Δ Volumen</div>
        </div>
      </div>
    </div>
  );
}
