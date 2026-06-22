/**
 * Prisma seed — loads the curated exercise library into PostgreSQL.
 * Idempotent: re-running upserts by the stable slug id.
 */
import { PrismaClient } from "@prisma/client";
import { EXERCISE_LIBRARY } from "../src/data/exerciseLibrary";

const prisma = new PrismaClient();

async function main() {
  console.log(`Seeding ${EXERCISE_LIBRARY.length} exercises...`);
  for (const e of EXERCISE_LIBRARY) {
    await prisma.exercise.upsert({
      where: { id: e.id },
      update: {
        name: e.name,
        muscleGroup: e.muscleGroup,
        movementPattern: e.movementPattern as any,
        category: e.category as any,
        equipment: e.equipment as any,
        difficulty: e.difficulty as any,
        activationScore: e.activationScore,
        fatigueScore: e.fatigueScore,
        stabilityRequirement: e.stabilityRequirement,
        unilateral: e.unilateral,
        primaryMuscle: e.primaryMuscle,
        secondaryMuscles: e.secondaryMuscles,
        imageUrl: e.imageUrl,
        videoUrl: e.videoUrl,
      },
      create: {
        id: e.id,
        name: e.name,
        muscleGroup: e.muscleGroup,
        movementPattern: e.movementPattern as any,
        category: e.category as any,
        equipment: e.equipment as any,
        difficulty: e.difficulty as any,
        activationScore: e.activationScore,
        fatigueScore: e.fatigueScore,
        stabilityRequirement: e.stabilityRequirement,
        unilateral: e.unilateral,
        primaryMuscle: e.primaryMuscle,
        secondaryMuscles: e.secondaryMuscles,
        imageUrl: e.imageUrl,
        videoUrl: e.videoUrl,
      },
    });
  }
  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
