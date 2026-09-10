import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "./schema";

let pool: mysql.Pool | null = null;

/**
 * Pooled MySQL connection, shared across every API route in one process —
 * this is also why the realtime layer (src/lib/realtime/bus.ts) is a
 * same-process EventEmitter rather than something that assumes multiple
 * server instances.
 *
 * timezone: "Z" makes mysql2 read/write DATETIME columns as UTC — every
 * DATETIME in this schema is a UTC instant, same as the timestamptz columns
 * it replaces.
 */
export function getDb() {
  if (!pool) {
    const host = process.env.MYSQL_HOST;
    const user = process.env.MYSQL_USER;
    const password = process.env.MYSQL_PASSWORD;
    const database = process.env.MYSQL_DATABASE;
    if (!host || !user || !password || !database) {
      throw new Error(
        "MySQL env vars are missing (MYSQL_HOST/MYSQL_USER/MYSQL_PASSWORD/MYSQL_DATABASE)."
      );
    }
    pool = mysql.createPool({
      host,
      port: process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306,
      user,
      password,
      database,
      timezone: "Z",
      dateStrings: false,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return drizzle(pool, { schema, mode: "default" });
}

export type Db = ReturnType<typeof getDb>;
