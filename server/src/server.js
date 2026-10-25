import app from './app.js'
import { pool } from './db/index.js'

const port = Number(process.env.PORT || 3001)
const secret = process.env.JWT_SECRET

if (!secret || secret.length < 32) {
  throw new Error('JWT_SECRET debe configurarse con al menos 32 caracteres.')
}

const server = app.listen(port, () => {
  console.info(`NexTrade API disponible en http://localhost:${port}`)
})

async function shutdown() {
  server.close(async (error) => {
    if (error) {
      console.error('Error al cerrar el servidor:', error)
      process.exitCode = 1
    }
    await pool.end()
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
