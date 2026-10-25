import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema.js'

const { Pool } = pg

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL es obligatorio para conectar con PostgreSQL.')
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL })
export const db = drizzle(pool, { schema })
