import { Router } from 'express'
import { and, desc, eq, ilike, ne } from 'drizzle-orm'
import { db } from '../db/index.js'
import { communityPosts, strategies, users } from '../db/schema.js'
import { requireRole } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import {
  accountStatusSchema,
  adminPostQuerySchema,
  adminUserIdParamsSchema,
  adminUserQuerySchema,
  communityPostIdParamsSchema,
  moderationSchema,
} from '../services/validation.js'

const router = Router()

router.get('/posts', requireRole('moderator', 'admin'), async (req, res) => {
  const parsedQuery = adminPostQuerySchema.safeParse(req.query)
  if (!parsedQuery.success) return res.status(400).json({ error: 'El filtro de moderación no es válido.' })

  const rows = await db.select({
    id: communityPosts.id,
    userId: communityPosts.userId,
    strategyId: communityPosts.strategyId,
    kind: communityPosts.kind,
    title: communityPosts.title,
    content: communityPosts.content,
    status: communityPosts.moderationStatus,
    createdAt: communityPosts.createdAt,
    username: users.username,
    strategyTitle: strategies.title,
    asset: strategies.asset,
    timeframe: strategies.timeframe,
  }).from(communityPosts)
    .innerJoin(users, eq(communityPosts.userId, users.id))
    .leftJoin(strategies, eq(communityPosts.strategyId, strategies.id))
    .where(eq(communityPosts.moderationStatus, parsedQuery.data.status))
    .orderBy(desc(communityPosts.createdAt))
    .limit(100)
  return res.json({ posts: rows })
})

router.patch('/posts/:postId', requireRole('moderator', 'admin'), validate(communityPostIdParamsSchema, 'params'), validate(moderationSchema), async (req, res) => {
  const { status } = req.body
  const post = await db.transaction(async (tx) => {
    const [updated] = await tx.update(communityPosts)
      .set({
        moderationStatus: status,
        moderatedBy: req.user.id,
        moderatedAt: new Date(),
        publishedAt: status === 'approved' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(communityPosts.id, req.params.postId))
      .returning({
        id: communityPosts.id,
        strategyId: communityPosts.strategyId,
        kind: communityPosts.kind,
        moderationStatus: communityPosts.moderationStatus,
        publishedAt: communityPosts.publishedAt,
      })
    if (!updated) return null
    if (updated.strategyId) {
      await tx.update(strategies)
        .set({
          isPublished: status === 'approved',
          moderationStatus: status,
          updatedAt: new Date(),
        })
        .where(eq(strategies.id, updated.strategyId))
    }
    return updated
  })
  if (!post) return res.status(404).json({ error: 'No se encontró la publicación.' })
  return res.json({ post })
})

router.get('/users', requireRole('admin'), async (req, res) => {
  const parsedQuery = adminUserQuerySchema.safeParse(req.query)
  if (!parsedQuery.success) return res.status(400).json({ error: 'El filtro de usuarios no es válido.' })
  const filters = []
  if (parsedQuery.data.status) filters.push(eq(users.status, parsedQuery.data.status))
  if (parsedQuery.data.search) filters.push(ilike(users.username, `%${parsedQuery.data.search}%`))

  const userQuery = db.select({
    id: users.id,
    email: users.email,
    username: users.username,
    role: users.role,
    status: users.status,
    createdAt: users.createdAt,
  }).from(users)
  const filteredUsers = filters.length ? userQuery.where(and(...filters)) : userQuery
  const rows = await filteredUsers
    .orderBy(desc(users.createdAt))
    .limit(100)
  return res.json({ users: rows })
})

router.patch('/users/:userId/status', requireRole('admin'), validate(adminUserIdParamsSchema, 'params'), validate(accountStatusSchema), async (req, res) => {
  if (req.params.userId === req.user.id && req.body.status === 'suspended') {
    return res.status(400).json({ error: 'No puedes suspender tu propia cuenta de administrador.' })
  }
  const [target] = await db.select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, req.params.userId))
    .limit(1)
  if (!target) return res.status(404).json({ error: 'No se encontró la cuenta solicitada.' })
  if (target.role === 'admin' && target.id !== req.user.id) {
    return res.status(403).json({ error: 'No puedes cambiar el estado de otra cuenta de administrador.' })
  }

  const [updated] = await db.update(users)
    .set({ status: req.body.status })
    .where(and(eq(users.id, target.id), ne(users.role, 'admin')))
    .returning({ id: users.id, username: users.username, role: users.role, status: users.status })
  if (!updated) return res.status(403).json({ error: 'No se puede cambiar el estado de esta cuenta.' })
  return res.json({ user: updated })
})

export default router
