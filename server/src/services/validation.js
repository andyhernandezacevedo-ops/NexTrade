import { z } from 'zod'

const optionalPrice = z.union([z.number().positive(), z.string().regex(/^\d+(\.\d{1,8})?$/)]).nullable().optional()

export const registerSchema = z.object({
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
  username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(10).max(72),
})

export const loginSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(72),
})

export const strategySchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(5000),
  asset: z.string().trim().min(1).max(32),
  timeframe: z.string().trim().min(1).max(16),
  rules: z.string().max(10000).default(''),
  isPublished: z.boolean().default(false),
})

export const tradeSchema = z.object({
  strategyId: z.string().uuid().nullable().optional(),
  asset: z.string().trim().min(1).max(32),
  side: z.enum(['long', 'short']),
  entryPrice: z.union([z.number().positive(), z.string().regex(/^\d+(\.\d{1,8})?$/)]),
  exitPrice: optionalPrice,
  stopLoss: optionalPrice,
  takeProfit: optionalPrice,
  resultR: z.union([z.number(), z.string().regex(/^-?\d+(\.\d{1,4})?$/)]).nullable().optional(),
  notes: z.string().max(10000).default(''),
  openedAt: z.string().datetime(),
  closedAt: z.string().datetime().nullable().optional(),
})
