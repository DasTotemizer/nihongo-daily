import * as SQLite from 'expo-sqlite';

import type { Db, SqlValue } from './db';

export async function openExpoDb(name: string): Promise<Db> {
  const db = await SQLite.openDatabaseAsync(name);
  await db.execAsync('PRAGMA journal_mode = WAL;');
  return {
    exec: (sql) => db.execAsync(sql),
    run: async (sql, params: SqlValue[] = []) => {
      const r = await db.runAsync(sql, params);
      return { changes: r.changes };
    },
    all: (sql, params: SqlValue[] = []) => db.getAllAsync(sql, params),
    first: (sql, params: SqlValue[] = []) => db.getFirstAsync(sql, params),
    transaction: (fn) => db.withTransactionAsync(fn),
  };
}
