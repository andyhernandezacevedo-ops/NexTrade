import { Router } from 'express'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { comments, strategies, users } from '../db/schema.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { z } from 'zod'

const router = Router()
const commentSchema = z.object({ content: z.string().trim().min(1).max(2000) })

router.get('/:strategyId/comments', async (req, res) => {
  const [strategy] = await db.select({ id: strategies.id })
    .from(strategies)
    .where(and(eq(strategies.id, req.params.strategyId), eq(strategies.isPublished, true)))
    .limit(1)
  if (!strategy) return res.status(404).json({ error: 'La estrategia no existe o no es pública.' })

  const rows = await db.select({
    id: comments.id,
    content: comments.content,
    createdAt: comments.createdAt,
    username: users.username,
  }).from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.strategyId, strategy.id))
    .orderBy(desc(comments.createdAt))
  return res.json({ comments: rows })
})

router.post('/:strategyId/comments', requireAuth, validate(commentSchema), async (req, res) => {
  const [strategy] = await db.select({ id: strategies.id })
    .from(strategies)
    .where(and(eq(strategies.id, req.params.strategyId), eq(strategies.isPublished, true)))
    .limit(1)
  if (!strategy) return res.status(404).json({ error: 'La estrategia no existe o no es pública.' })
  const [comment] = await db.insert(comments).values({
    userId: req.user.id,
    strategyId: strategy.id,
    content: req.body.content,
  }).returning()
  return res.status(201).json({ comment })
})

export default router
