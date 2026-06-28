/**
 * PostgreSQL-backed ExerciseRepository (Prisma). Maps DB rows to the engine's
 * pure `Exercise` domain type.
 */
import type { PrismaClient } from "@prisma/client";
import type { Exercise } from "../types";
import { EXERCISE_LIBRARY } from "../data/exerciseLibrary";
import type { ExerciseRepository } from "./ExerciseRepository";

export class PrismaExerciseRepository implements ExerciseRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async all(): Promise<Exercise[]> {
    const rows = await this.prisma.exercise.findMany();
    if (rows.length === 0) {
      await this.seedLibrary();
      return EXERCISE_LIBRARY;
    }
    return rows.map(toDomain);
  }

  private async seedLibrary(): Promise<void> {
    console.log(`Auto-seeding ${EXERCISE_LIBRARY.length} exercises into database...`);
    for (const e of EXERCISE_LIBRARY) {
      await this.prisma.exercise.upsert({
        where: { id: e.id },
        update: { name: e.name, muscleGroup: e.muscleGroup, movementPattern: e.movementPattern as any, category: e.category as any, equipment: e.equipment as any, difficulty: e.difficulty as any, activationScore: e.activationScore, fatigueScore: e.fatigueScore, stabilityRequirement: e.stabilityRequirement, unilateral: e.unilateral, primaryMuscle: e.primaryMuscle, secondaryMuscles: e.secondaryMuscles, imageUrl: e.imageUrl, videoUrl: e.videoUrl },
        create: { id: e.id, name: e.name, muscleGroup: e.muscleGroup, movementPattern: e.movementPattern as any, category: e.category as any, equipment: e.equipment as any, difficulty: e.difficulty as any, activationScore: e.activationScore, fatigueScore: e.fatigueScore, stabilityRequirement: e.stabilityRequirement, unilateral: e.unilateral, primaryMuscle: e.primaryMuscle, secondaryMuscles: e.secondaryMuscles, imageUrl: e.imageUrl, videoUrl: e.videoUrl },
      });
    }
    console.log("Exercise seed complete.");
  }

  async byId(id: string): Promise<Exercise | null> {
    const row = await this.prisma.exercise.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }
}

function toDomain(row: {
  id: string;
  name: string;
  muscleGroup: string;
  movementPattern: string;
  category: string;
  equipment: string;
  difficulty: string;
  activationScore: number;
  fatigueScore: number;
  stabilityRequirement: number;
  unilateral: boolean;
  primaryMuscle: string;
  secondaryMuscles: string[];
  imageUrl: string | null;
  videoUrl: string | null;
}): Exercise {
  return {
    id: row.id,
    name: row.name,
    muscleGroup: row.muscleGroup,
    movementPattern: row.movementPattern as Exercise["movementPattern"],
    category: row.category as Exercise["category"],
    equipment: row.equipment as Exercise["equipment"],
    difficulty: row.difficulty as Exercise["difficulty"],
    activationScore: row.activationScore,
    fatigueScore: row.fatigueScore,
    stabilityRequirement: row.stabilityRequirement,
    unilateral: row.unilateral,
    primaryMuscle: row.primaryMuscle,
    secondaryMuscles: row.secondaryMuscles,
    imageUrl: row.imageUrl ?? undefined,
    videoUrl: row.videoUrl ?? undefined,
  };
}
