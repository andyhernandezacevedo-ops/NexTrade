import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { users } from '../db/schema.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { loginSchema, profileSchema, registerSchema } from '../services/validation.js'

const router = Router()

function createToken(user) {
  return jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' })
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
  }
}

router.post('/register', validate(registerSchema), async (req, res) => {
  const { email, username, password } = req.body
  const passwordHash = await bcrypt.hash(password, 12)

  try {
    const [user] = await db.insert(users).values({ email, username, passwordHash }).returning()
    return res.status(201).json({ user: publicUser(user), token: createToken(user) })
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'El correo o nombre de usuario ya está en uso.' })
    }
    throw error
  }
})

router.post('/login', validate(loginSchema), async (req, res) => {
  const [user] = await db.select().from(users).where(eq(users.email, req.body.email)).limit(1)
  if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos.' })
  }
  if (user.status !== 'active') {
    return res.status(403).json({ error: 'La cuenta está suspendida. Contacta con soporte.' })
  }
  return res.json({ user: publicUser(user), token: createToken(user) })
})

router.get('/me', requireAuth, async (req, res) => {
  const [user] = await db.select({
    id: users.id,
    email: users.email,
    username: users.username,
    bio: users.bio,
    avatarUrl: users.avatarUrl,
  }).from(users).where(eq(users.id, req.user.id)).limit(1)
  if (!user) return res.status(401).json({ error: 'La cuenta ya no está disponible.' })
  return res.json({ user })
})

router.patch('/me', requireAuth, validate(profileSchema), async (req, res) => {
  try {
    const [user] = await db.update(users)
      .set(req.body)
      .where(eq(users.id, req.user.id))
      .returning({
        id: users.id,
        email: users.email,
        username: users.username,
        bio: users.bio,
        avatarUrl: users.avatarUrl,
      })
    if (!user) return res.status(404).json({ error: 'No se encontró la cuenta.' })
    return res.json({ user })
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'El nombre de usuario ya está en uso.' })
    }
    throw error
  }
})

export default router
