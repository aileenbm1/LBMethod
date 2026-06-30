# 🍑 LBMethodEngine — Guía de Desarrollo Local

**Estado:** Proyecto completado, 25/25 tests pasando, `tsc` limpio, listo para desarrollo.

**Commit:** `351400f` (en tu máquina, rama `claude/eloquent-hawking-xebmo6`)

---

## 📋 Qué tienes

### ✅ El Engine (core, sin dependencias externas)

```
src/engine/
├── calculators/
│   └── VolumeCalculator.ts         # Vol por nivel, distribución 60/40
├── generators/
│   ├── SplitGenerator.ts           # Distribuciones 3–6 días (LB Method)
│   └── ExerciseSelector.ts         # Main + unilateral + isolation
├── rules/
│   ├── businessRules.ts            # Todas las constantes de negocio
│   └── rng.ts                      # Mulberry32 (seeded, reproducible)
├── services/
│   ├── LBMethodEngine.ts           # Orquestador principal
│   ├── FatigueEngine.ts            # Tope 12 pts/sesión
│   └── ProgressionEngine.ts        # RIR 3→2→1→deload
├── validators/
│   └── RoutineValidator.ts         # 6 validadores (volumen, fatiga, etc.)
└── index.ts                        # Barril de exportaciones
```

**Importancia:** El engine es framework-agnostic. Puedes:
- Usarlo en Node.js puro
- Exponerlo via Express (ya hecho)
- Integrarlo en una app Next.js
- Hacer tests sin tocar Prisma ni Express

### ✅ API (Express + zod)

```
src/api/
├── server.ts                # Crea el app Express, resuelve repo (mem o DB)
├── routes.ts                # 6 endpoints REST
├── RoutineService.ts        # Capa de aplicación (clients + programs)
└── validation.ts            # Zod schemas para request validation
```

**Endpoints:**
- `POST /api/client` — crear user
- `POST /api/generate-routine` — generar mesociclo
- `POST /api/progress-routine` — avanzar a próxima semana
- `GET /api/routine/:id` — fetch programa
- `GET /api/exercise-library` — ver ejercicios
- `GET /api/health` — health check

### ✅ Datos

```
src/data/
└── exerciseLibrary.ts               # ~50 ejercicios curados (cadera, cuads, etc.)

src/models/
├── ExerciseRepository.ts            # Abstracción (interfaz)
└── PrismaExerciseRepository.ts      # Implementación (PostgreSQL)
```

### ✅ Database (Prisma)

```
prisma/
├── schema.prisma                    # 10 modelos (User, Exercise, Routine, etc.)
└── seed.ts                          # Carga librería de ejercicios
```

Sin DB, funciona con `InMemoryExerciseRepository`.

### ✅ Tests (Vitest)

```
tests/
├── volumeCalculator.test.ts         # 5 tests
├── splitGenerator.test.ts           # 4 tests
├── fatigueEngine.test.ts            # 3 tests
├── progressionEngine.test.ts        # 3 tests
├── validator.test.ts                # 5 tests
└── engine.test.ts                   # 5 tests (integration)
```

**25 tests, todos pasando.**

### ✅ Frontend (React + Tailwind, ejemplo)

```
frontend/
└── RoutineGenerator.tsx             # Componente drop-in para React 18+
```

### ✅ Documentación

```
README.md                            # Descripción, arquitectura, API
QUICKSTART.md                        # Comandos rápidos
LOCAL_DEV_GUIDE.md                   # Este archivo
dev-script.sh                        # Helper script
```

---

## 🚀 Cómo empezar (ya está todo listo)

### 1️⃣ Ver el engine generando rutinas

```bash
npm run engine:demo
```

Output: Una rutina de 4 semanas para `glute_hypertrophy / intermediate / 5 days`.

Muestra:
- Volumen semanal (21 glute sets)
- Distribución lower/upper (69% / 31%)
- 5 días de entrenamiento
- Cada sesión con ejercicios, sets, reps, RIR
- **Validación VALID ✅**
- Signature de la semana (anti-repeat)

### 2️⃣ Ejecutar tests

```bash
npm test
```

Verás 25 tests pasando:
- Volume ranges (beginner 12–16, intermediate 18–24, advanced 22–30)
- Split shapes (3–6 días, ≥3x glutes for priority goals)
- Fatigue ceiling (≤12/sesión)
- RIR progression + deload
- Validators (volume, frequency, balance, fatigue, repeats)
- **End-to-end:** todos los goal × level × day-count generan rutinas válidas

### 3️⃣ Levantar la API

```bash
npm run dev
```

Listens on `http://localhost:3000/api`.

**Pruébalo:**
```bash
# Ver la librería de ejercicios
curl http://localhost:3000/api/exercise-library | jq '.exercises | length'
# Output: 51

# Generar una rutina
curl -X POST http://localhost:3000/api/generate-routine \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "glute_hypertrophy",
    "experienceLevel": "advanced",
    "daysPerWeek": 6,
    "weeks": 4
  }' | jq '.program.weeks[0].volume'
```

---

## 📝 Trabajar localmente: flujo típico

### Agregar un nuevo ejercicio

1. Abre `src/data/exerciseLibrary.ts`
2. Agrega una línea al array `EXERCISE_LIBRARY`:
   ```typescript
   ex("leg-press-iso", "Isometric Leg Press", "quadriceps", "knee_dominant", "isolation", "machine", "beginner", 8.5, 2, 2, false, "quadriceps", []),
   ```
3. `npm run engine:demo` — verás el nuevo ejercicio en rotación
4. `npm test` — verifica que no rompa validaciones

### Cambiar una regla de negocio

1. Abre `src/engine/rules/businessRules.ts`
2. Edita una constante (ej: `MIN_GLUTE_FREQUENCY = 4`)
3. `npm test` — algunos tests fallarán, actualízalos con la nueva expectativa
4. `npm run engine:demo` — verás el efecto inmediato

**Ej: aumentar volumen mínimo de intermedio**
```typescript
// Antes
intermediate: { min: 18, max: 24 },

// Después
intermediate: { min: 20, max: 26 },

// npm test -- volumeCalculator  → falla, actualiza el test
// npm run engine:demo           → ves más volumen
```

### Cambiar la progresión (RIR / deload)

1. Abre `src/engine/services/ProgressionEngine.ts` (consulta el MESOCYCLE)
2. Edita los weeks:
   ```typescript
   { week: 1, rir: 3, volumeMultiplier: 1.0, deload: false, ... },
   { week: 2, rir: 2, volumeMultiplier: 1.0, deload: false, ... },
   { week: 3, rir: 1, volumeMultiplier: 1.0, deload: false, ... },
   { week: 4, rir: 3, volumeMultiplier: 0.8, deload: true, ... },  // ← edita acá
   ```
3. `npm test -- progressionEngine` — verifica que la progresión sea válida
4. `npm run engine:demo` — ve cómo cambia el RIR semana a semana

### Ajustar la distribución de splits

1. Abre `src/engine/generators/SplitGenerator.ts`
2. Edita `PRIORITY_SPLITS` o `BALANCED_SPLITS`:
   ```typescript
   const PRIORITY_SPLITS: Record<number, DayFocus[]> = {
     3: ["glute_hamstring", "upper_body", "glute_quad"],
     4: ["glute_hamstring", "upper_body", "glute_quad", "glute_specialization"],
     // Edita acá
   };
   ```
3. `npm test -- splitGenerator` — verifica glute frequency
4. `npm run engine:demo` — ve los nuevos splits

### Agregar un nuevo validador

1. Abre `src/engine/validators/RoutineValidator.ts`
2. Agrega un nuevo método:
   ```typescript
   checkCustomRule(routine: GeneratedRoutine): ValidationIssue[] {
     // tu lógica
     return issues;
   }
   ```
3. Llámalo desde `validate()`:
   ```typescript
   validate(routine: GeneratedRoutine): ValidationResult {
     const issues: ValidationIssue[] = [
       ...this.checkVolume(...),
       ...this.checkCustomRule(routine),  // ← nuevo
       // ... resto
     ];
   }
   ```
4. `npm test -- validator` — escribe un test para tu validador
5. `npm run engine:demo` — verifica que el validador actúa

---

## 📊 Estructura mental

```
User (goal, level, days)
    ↓
VolumeCalculator → VolumePlan (weeklyGluteSets, distribution)
    ↓
SplitGenerator → DayTemplate[] (day_focus, is_glute)
    ↓
ExerciseSelector → SelectedExercise[] per day
                   (main + unilateral + isolation + accessory)
    ↓
FatigueEngine → validates sessionFatigue ≤ 12
    ↓
RoutineValidator → checks vol, freq, distrib, balance, repeats
    ↓
GeneratedRoutine (signature-based anti-repeat)
    ↓
ProgressionEngine → applies RIR, deload, volumeMultiplier
    ↓
GeneratedProgram (mesocycle completo)
```

---

## 🔧 Script de ayuda

Usa `./dev-script.sh` para comandos comunes:

```bash
./dev-script.sh demo       # Engine demo
./dev-script.sh test       # Tests
./dev-script.sh test:watch # Tests en watch mode
./dev-script.sh build      # TypeScript → dist/
./dev-script.sh lint       # Type-check
./dev-script.sh dev        # API sin DB
./dev-script.sh all        # Full pre-commit check
```

---

## 🐘 Con PostgreSQL (cuando estés listo)

```bash
# 1) Configura .env
cp .env.example .env
# Edita DATABASE_URL = "postgresql://user:pass@localhost/lbmethod?schema=public"

# 2) Prisma setup
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed

# 3) Levanta API con DB
USE_DB=true npm run dev

# 4) Ahora persiste asesorados y programas
curl -X POST http://localhost:3000/api/client ...
# El asesorado se guarda en DB
```

---

## 📚 Próximos pasos típicos

| Tarea | Archivo | Tiempo |
|-------|---------|--------|
| Agregar 10 ejercicios más | `src/data/exerciseLibrary.ts` | 30min |
| Cambiar volumen por nivel | `src/engine/rules/businessRules.ts` | 10min |
| Agregar validador personalizado | `src/engine/validators/RoutineValidator.ts` | 20min |
| Tunar distribuciones de split | `src/engine/generators/SplitGenerator.ts` | 15min |
| Cambiar progresión RIR/deload | `src/engine/services/ProgressionEngine.ts` | 10min |
| Conectar React frontend | `frontend/RoutineGenerator.tsx` + API | 1hour |
| Integrar Prisma + PostgreSQL | `.env` + `npm run prisma:*` | 30min |
| Agregar tracking de historial | `src/api/RoutineService.ts` + nuevos endpoints | 1hour |

---

## ✅ Checklist para cada cambio

- [ ] `npm run lint` — TypeScript compila sin errores
- [ ] `npm test` — todos los tests pasan (o actualiza tests si cambio es intencional)
- [ ] `npm run engine:demo` — output tiene sentido
- [ ] Commit con mensaje claro: `git commit -m "feat: ..."`

---

## 🎯 ¡Ahora qué?

1. **Corre el demo:** `npm run engine:demo`
2. **Corre los tests:** `npm test`
3. **Levanta la API:** `npm run dev` y prueba los endpoints
4. **Examina el código** en `src/engine/` — está bien comentado
5. **Cambia algo** (regla, ejercicio, validador) y ve el efecto

¡Listo para construir! 🚀
