import { z } from 'zod'

const price = z.union([
  z.number().finite().positive().max(999999999999.99999999),
  z.string().regex(/^\d{1,12}(\.\d{1,8})?$/, 'Introduce un precio positivo con hasta 8 decimales.'),
])

const optionalPrice = price.nullable().optional()
const resultR = z.union([
  z.number().finite().min(-999999).max(999999),
  z.string().regex(/^-?\d{1,6}(\.\d{1,4})?$/, 'Introduce un resultado R con hasta 4 decimales.'),
]).nullable().optional()

export const strategyIdParamsSchema = z.object({ strategyId: z.string().uuid() })
export const tradeIdParamsSchema = z.object({ tradeId: z.string().uuid() })

export const registerSchema = z.object({
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
  username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/).transform((value) => value.toLowerCase()),
  password: z.string().min(10).max(72),
})

export const loginSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(72),
})

export const profileSchema = z.object({
  username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/).transform((value) => value.toLowerCase()).optional(),
  bio: z.string().trim().max(280).nullable().optional(),
  avatarUrl: z.string().url().max(2048).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, 'Incluye al menos un campo para actualizar.')

export const strategySchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(5000),
  asset: z.string().trim().min(1).max(32).transform((value) => value.toUpperCase()),
  timeframe: z.string().trim().min(1).max(16),
  rules: z.string().trim().max(10000).default(''),
})

export const tradeSchema = z.object({
  strategyId: z.string().uuid().nullable().optional(),
  asset: z.string().trim().min(1).max(32).transform((value) => value.toUpperCase()),
  side: z.enum(['long', 'short']),
  entryPrice: price,
  exitPrice: optionalPrice,
  stopLoss: optionalPrice,
  takeProfit: optionalPrice,
  resultR,
  notes: z.string().trim().max(10000).default(''),
  openedAt: z.string().datetime({ offset: true }),
  closedAt: z.string().datetime({ offset: true }).nullable().optional(),
}).superRefine((trade, context) => {
  const hasExit = trade.exitPrice != null
  const hasCloseDate = trade.closedAt != null

  if (hasExit !== hasCloseDate) {
    context.addIssue({
      code: 'custom',
      path: [hasExit ? 'closedAt' : 'exitPrice'],
      message: 'Una operación cerrada necesita precio de salida y fecha de cierre.',
    })
  }

  if (trade.resultR != null && !hasExit) {
    context.addIssue({
      code: 'custom',
      path: ['resultR'],
      message: 'Añade el resultado R al cerrar la operación.',
    })
  }

  if (trade.closedAt && Date.parse(trade.closedAt) < Date.parse(trade.openedAt)) {
    context.addIssue({
      code: 'custom',
      path: ['closedAt'],
      message: 'La fecha de cierre no puede ser anterior a la apertura.',
    })
  }
})
