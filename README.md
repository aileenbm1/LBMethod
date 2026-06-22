# LBMethodEngine 🍑

A professional, rule-based training-programming engine for **female glute
hypertrophy and lower-body focused training**. It generates thousands of valid,
individualized routines from biomechanical and physiological **business rules** —
never random, never hardcoded.

Built with **TypeScript · Node.js · Express · PostgreSQL · Prisma**, following
SOLID and a clean separation between **database / rule engine / API / frontend**.

---

## ✨ What it does

Given a client's `goal`, `experienceLevel` and `daysPerWeek`, the engine:

1. **Calculates weekly volume** per muscle region (level-based glute set ranges).
2. **Generates the split** (3–6 days) using the canonical LB Method distributions.
3. **Selects exercises** for each day from the biomechanical library
   (`main · unilateral · isolation · optional accessory` on every glute day).
4. **Caps session fatigue** at 12 points via the Fatigue Engine.
5. **Applies progression**: RIR 3 → 2 → 1 → Deload (-20% volume).
6. **Validates** the result (volume, frequency, fatigue, repeats, balance).
7. **Guarantees variety**: every week has a unique exercise *signature* — the
   same weekly combination is never repeated.

---

## 🧠 Business rules (the "no random" core)

| Rule | Value |
|------|-------|
| Glute frequency (priority goals) | ≥ 3×/week (4+ day splits) |
| Lower-body volume (priority goals) | ≥ 60% |
| Upper-body volume (priority goals) | ≤ 40% |
| Beginner glute sets / week | 12–16 |
| Intermediate glute sets / week | 18–24 |
| Advanced glute sets / week | 22–30 |
| Max session fatigue | ≤ 12 |
| Mesocycle | W1 RIR3 · W2 RIR2 · W3 RIR1 · W4 Deload −20% |

**Priority goals:** `glute_hypertrophy`, `glute_growth`, `lower_body_focus`,
`body_recomposition`.

### Biomechanical glute classification
`hip_thrust` · `hip_hinge` · `knee_dominant` · `abduction` · `unilateral`

---

## 🏗 Architecture

```
src/
  types/            Pure domain types (framework-agnostic)
  data/             Curated exercise library
  models/           Repository abstraction (in-memory + Prisma impls)
  database/         Prisma client singleton
  engine/
    calculators/    VolumeCalculator
    generators/     SplitGenerator · ExerciseSelector
    rules/          businessRules · seeded Rng
    services/       LBMethodEngine · FatigueEngine · ProgressionEngine
    validators/     RoutineValidator
  api/              Express routes · RoutineService · zod validation · server
  examples/         Runnable usage demo
frontend/           React + Tailwind reference component
prisma/             schema.prisma · seed.ts
tests/              Vitest unit + integration tests
```

The **rule engine never imports Prisma or Express** — it depends only on
`types/`, so it is fully unit-testable and reusable.

---

## 🚀 Quick start

### 1. Install
```bash
npm install
```

### 2. Run the engine demo (no database required)
```bash
npm run engine:demo
```
Prints a full validated 4-week glute-hypertrophy mesocycle.

### 3. Run the API (no database required)
```bash
npm run dev          # ts-node-dev, hot reload
# or
npm run build && npm start
```
The API serves on `http://localhost:3000/api` using the in-memory exercise
library. To back it with PostgreSQL set `USE_DB=true` (see below).

### 4. Run tests
```bash
npm test
```

---

## 🐘 Using PostgreSQL + Prisma (production)

```bash
cp .env.example .env          # set DATABASE_URL
npm run prisma:generate       # generate the client
npm run prisma:migrate        # create tables
npm run prisma:seed           # load the exercise library
USE_DB=true npm run dev       # run API against Postgres
```

---

## 🔌 API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/client` | Create a client/user |
| POST | `/api/generate-routine` | Generate a validated multi-week program |
| POST | `/api/progress-routine` | Advance a program to the next week |
| GET  | `/api/routine/:id` | Fetch a stored program |
| GET  | `/api/exercise-library` | List the exercise database |
| GET  | `/api/health` | Health check |

### Example: generate a program
```bash
curl -X POST http://localhost:3000/api/generate-routine \
  -H "Content-Type: application/json" \
  -d '{ "goal": "glute_hypertrophy", "experienceLevel": "intermediate", "daysPerWeek": 5, "weeks": 4 }'
```

### Example: create a client then generate
```bash
# 1) create client -> returns { client: { id, ... } }
curl -X POST http://localhost:3000/api/client \
  -H "Content-Type: application/json" \
  -d '{ "email": "ana@example.com", "goal": "glute_growth", "experienceLevel": "advanced", "daysPerWeek": 6 }'

# 2) generate for that client
curl -X POST http://localhost:3000/api/generate-routine \
  -H "Content-Type: application/json" \
  -d '{ "clientId": "<ID_FROM_STEP_1>", "weeks": 4 }'
```

---

## 💻 Programmatic usage

```ts
import { LBMethodEngine, EXERCISE_LIBRARY } from "lbmethod-engine";

const engine = new LBMethodEngine();
const program = engine.generateProgram(
  { goal: "glute_hypertrophy", experienceLevel: "intermediate", daysPerWeek: 5 },
  EXERCISE_LIBRARY,
  4,
);

console.log(program.weeks[0].days);
console.log(engine.validate(program.weeks[0]));
```

---

## 🎨 Frontend

`frontend/RoutineGenerator.tsx` is a React + Tailwind reference component that
calls the API. Drop it into a Vite or Next.js app (React 18 + Tailwind) and set
`VITE_API_URL` to your backend.

---

## ✅ Test coverage

- Volume ranges & 60/40 distribution
- Split shapes & glute frequency
- Fatigue ceiling enforcement
- RIR progression & deload
- Validator guards (volume, frequency, balance, fatigue, repeats)
- End-to-end: every goal × level × day-count generates a **valid** program with
  **unique** weekly combinations

---

## License
MIT
