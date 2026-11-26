/**
 * A tiny database interface so repositories and domain logic do not depend on
 * expo-sqlite directly. The app uses expo-sqlite; tests use better-sqlite3.
 */
export type SqlValue = string | number | null;

export interface Db {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<{ changes: number }>;
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  first<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
  transaction(fn: () => Promise<void>): Promise<void>;
}
