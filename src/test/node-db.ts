/** better-sqlite3 implementation of Db, for tests that run under Node. */
import Database from 'better-sqlite3';

import type { Db, SqlValue } from '@/data/db';

export function openNodeDb(): Db {
  const db = new Database(':memory:');
  let depth = 0;
  return {
    exec: async (sql) => {
      db.exec(sql);
    },
    run: async (sql, params: SqlValue[] = []) => ({ changes: db.prepare(sql).run(...params).changes }),
    all: async <T,>(sql: string, params: SqlValue[] = []) => db.prepare(sql).all(...params) as T[],
    first: async <T,>(sql: string, params: SqlValue[] = []) => (db.prepare(sql).get(...params) as T) ?? null,
    transaction: async (fn) => {
      if (depth > 0) return fn();
      depth++;
      db.exec('BEGIN');
      try {
        await fn();
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      } finally {
        depth--;
      }
    },
  };
}
