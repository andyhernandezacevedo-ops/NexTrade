import { runner } from 'node-pg-migrate'
import { fileURLToPath } from 'node:url'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL es obligatorio para ejecutar las migraciones.')
}

await runner({
  databaseUrl,
  dir: fileURLToPath(new URL('../migrations', import.meta.url)),
  direction: 'up',
  migrationsTable: 'pgmigrations',
})

console.info('Migraciones aplicadas correctamente.')
