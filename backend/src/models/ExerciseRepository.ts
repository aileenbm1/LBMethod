/**
 * ExerciseRepository — abstraction over exercise storage.
 *
 * The engine and API depend on this interface, not on Prisma directly, so the
 * system runs in-memory (tests, demos, no DB) or against PostgreSQL with the
 * same code path (Dependency Inversion / Liskov).
 */
import type { Exercise } from "../types";
import { EXERCISE_LIBRARY } from "../data/exerciseLibrary";

export interface ExerciseRepository {
  all(): Promise<Exercise[]>;
  byId(id: string): Promise<Exercise | null>;
}

/** Zero-dependency repository backed by the curated in-memory library. */
export class InMemoryExerciseRepository implements ExerciseRepository {
  constructor(private readonly library: Exercise[] = EXERCISE_LIBRARY) {}

  async all(): Promise<Exercise[]> {
    return this.library;
  }

  async byId(id: string): Promise<Exercise | null> {
    return this.library.find((e) => e.id === id) ?? null;
  }
}
