# LBMethodEngine — Quick Start (Local Dev)

## 🎯 Resumen rápido

Tienes un **motor de programación de entrenamiento profesional** basado en reglas
para mujeres (glute hypertrophy, lower-body focus, etc.).

**Commit:** `351400f` (local en tu máquina)  
**Tests:** 25 / 25 ✅  
**TypeScript:** 100% strict, type-check limpio ✅

---

## ⚡ Comandos esenciales

### 1️⃣ Ver el motor en acción (sin DB)
```bash
npm run engine:demo
```
Imprime un mesociclo de 4 semanas completamente validado. El output muestra:
- Cada semana con volumen, frecuencia, RIR y deload
- 5 días de entrenamiento (glutes, upper, etc.)
- Cada ejercicio con sets, reps, RIR
- Validación (VALID ✅)
- Signatures únicas (nunca se repite la combinación semanal)

### 2️⃣ Ejecutar todos los tests
```bash
npm test                    # run once
npm test -- --watch        # watch mode
```
Tests incluyen:
- Volume Calculator (rangos por nivel)
- Split Generator (distribuciones canónicas)
- Fatigue Engine (≤12/sesión)
- Progression Engine (RIR 3→2→1→deload)
- RoutineValidator (reglas de negocio)
- Integration tests (end-to-end por goal×level×days)

### 3️⃣ Levantar la API (sin DB)
```bash
npm run dev
# Listens on http://localhost:3000/api
```

Endpoints disponibles:
```bash
# Ver biblioteca de ejercicios
curl http://localhost:3000/api/exercise-library | jq '.exercises | length'

# Crear un asesorado
curl -X POST http://localhost:3000/api/client \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ana@example.com",
    "goal": "glute_hypertrophy",
    "experienceLevel": "intermediate",
    "daysPerWeek": 5
  }'

# Generar una rutina (sin asesorado previo)
curl -X POST http://localhost:3000/api/generate-routine \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "glute_hypertrophy",
    "experienceLevel": "intermediate",
    "daysPerWeek": 5,
    "weeks": 4
  }' | jq '.program.weeks[0].days[0]'
```

### 4️⃣ Build producción
```bash
npm run build
# Genera /dist con TypeScript compilado
```

---

## 📁 Estructura

```
src/
  engine/              El corazón (SOLID, sin Prisma/Express)
    calculators/      VolumeCalculator
    generators/       SplitGenerator, ExerciseSelector
    rules/            businessRules, Rng (seeded)
    services/         LBMethodEngine, FatigueEngine, ProgressionEngine
    validators/       RoutineValidator
  api/                Express routes, zod validation, RoutineService
  models/             ExerciseRepository (abstraction)
  data/               exerciseLibrary (~50 ejercicios)
  types/              Pure domain types
  examples/           usage.ts (runnable demo)

tests/                25 Vitest tests (all passing)
frontend/             RoutineGenerator.tsx (React+Tailwind example)
prisma/               schema.prisma, seed.ts
```

---

## 🔧 Con PostgreSQL (opcional)

Si quieres perseverar en DB:

```bash
# 1) Configura DB_URL en .env
cp .env.example .env
# Edita DATABASE_URL (apunta a tu PostgreSQL)

# 2) Prisma
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed

# 3) API con DB
USE_DB=true npm run dev
```

---

## 📚 Programmatic usage

```typescript
import { LBMethodEngine, EXERCISE_LIBRARY } from "./src";

const engine = new LBMethodEngine();

// Generar una semana
const routine = engine.generateRoutine(
  { goal: "glute_hypertrophy", experienceLevel: "intermediate", daysPerWeek: 5 },
  EXERCISE_LIBRARY,
  { seed: 123 }
);

// Validar
const report = engine.validate(routine);
console.log(report.valid ? "✅" : "❌", report.issues);

// Generar un mesociclo de 4 semanas
const program = engine.generateProgram(
  { goal: "glute_growth", experienceLevel: "advanced", daysPerWeek: 6 },
  EXERCISE_LIBRARY,
  4
);

program.weeks.forEach((week) => {
  console.log(`Week ${week.weekNumber}: ${week.volume.weeklyGluteSets} glute sets`);
});
```

---

## ✅ Checklist para desarrollo

- [ ] `npm test` — todos pasan
- [ ] `npm run build` — compilación limpia
- [ ] `npm run engine:demo` — output coherente
- [ ] `npm run dev` — API responde en localhost:3000
- [ ] Cambios en `src/engine/*` — puedo verificar que no rompan tests
- [ ] Cambios en DB/API — puedo levantar con `USE_DB=true npm run dev`

---

## 🚀 Próximos pasos típicos

1. **Agregar más ejercicios** → edita `src/data/exerciseLibrary.ts`
2. **Tunar reglas** → edita `src/engine/rules/businessRules.ts`
3. **Cambiar mesociclo** → edita `src/engine/services/ProgressionEngine.ts` + `MESOCYCLE`
4. **Conectar a tu frontend** → usa los endpoints `/api/*` desde React
5. **Historiales de asesorado** → agrega campos a Prisma schema + seed
6. **Tracking real** → implementa POST `/api/log-workout` que actualice `TrainingHistory`

---

## 🆘 Troubleshooting

**Tests fallan después de cambios**
```bash
npm test -- --reporter=verbose
```

**API no levanta**
```bash
lsof -i :3000  # ¿Algo está usando puerto 3000?
npm run dev 2>&1 | head -20  # Ver los errores completos
```

**Tipos no resuelven**
```bash
npm run lint  # tsc --noEmit
npx tsc --showConfig -p tsconfig.json
```

---

**¿Listo para empezar?**

```bash
npm run engine:demo    # ← Corre esto primero
npm test               # ← Luego esto
npm run dev            # ← Levanta la API
```

¡Divertirse! 🍑
