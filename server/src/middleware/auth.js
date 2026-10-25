import jwt from 'jsonwebtoken'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/index.js'
import { users } from '../db/schema.js'

const tokenUserIdSchema = z.string().uuid()

export async function requireAuth(req, res, next) {
  const authorization = req.get('authorization')
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null

  if (!token) {
    return res.status(401).json({ error: 'Debes iniciar sesión para continuar.' })
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    if (payload === null || typeof payload !== 'object' || !tokenUserIdSchema.safeParse(payload.id).success) {
      return res.status(401).json({ error: 'La sesión no es válida o ha caducado.' })
    }
    const [user] = await db.select({ id: users.id, status: users.status, role: users.role })
      .from(users)
      .where(eq(users.id, payload.id))
      .limit(1)
    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: 'La sesión no es válida o ha caducado.' })
    }
    req.user = { id: user.id, role: user.role }
    return next()
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'La sesión no es válida o ha caducado.' })
    }
    return next(error)
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'No tienes permisos para realizar esta acción.' })
    }
    return next()
  }
}
