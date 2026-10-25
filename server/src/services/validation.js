import { z } from 'zod'

const price = z.union([
  z.number().finite().positive().max(999999999999.99999999),
  z.string()
    .regex(/^\d{1,12}(\.\d{1,8})?$/, 'Introduce un precio positivo con hasta 8 decimales.')
    .refine((value) => Number(value) > 0, 'El precio debe ser mayor que cero.'),
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

export const communityPostSchema = z.object({
  kind: z.enum(['strategy', 'idea']),
  title: z.string().trim().min(3).max(160),
  content: z.string().trim().min(10).max(10000),
  strategyId: z.string().uuid().nullable().optional(),
}).superRefine((post, context) => {
  if (post.kind === 'strategy' && !post.strategyId) {
    context.addIssue({
      code: 'custom',
      path: ['strategyId'],
      message: 'Selecciona una estrategia propia para compartir.',
    })
  }
})

export const communityFeedQuerySchema = z.object({
  kind: z.enum(['strategy', 'idea']).optional(),
})

export const communityPostIdParamsSchema = z.object({ postId: z.string().uuid() })
export const voteSchema = z.object({ value: z.union([z.literal(-1), z.literal(1)]) })
export const communityCommentSchema = z.object({ content: z.string().trim().min(1).max(2000) })

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

const candlePrice = z.string()
  .regex(/^\d{1,12}(\.\d{1,8})?$/, 'El precio debe tener hasta 12 enteros y 8 decimales.')
  .refine((value) => Number.isFinite(Number(value)) && Number(value) > 0, 'El precio debe ser mayor que cero.')

const candleVolume = z.string()
  .regex(/^\d{1,16}(\.\d{1,8})?$/, 'El volumen debe tener hasta 16 enteros y 8 decimales.')
  .refine((value) => Number.isFinite(Number(value)) && Number(value) >= 0, 'El volumen no puede ser negativo.')

export const marketCandlesSchema = z.array(z.object({
  time: z.string().datetime({ offset: true }),
  open: candlePrice,
  high: candlePrice,
  low: candlePrice,
  close: candlePrice,
  volume: candleVolume.nullable().optional(),
}).superRefine((candle, context) => {
  const open = Number(candle.open)
  const high = Number(candle.high)
  const low = Number(candle.low)
  const close = Number(candle.close)

  if (high < Math.max(open, low, close)) {
    context.addIssue({ code: 'custom', path: ['high'], message: 'El máximo debe cubrir apertura, cierre y mínimo.' })
  }
  if (low > Math.min(open, high, close)) {
    context.addIssue({ code: 'custom', path: ['low'], message: 'El mínimo debe cubrir apertura, cierre y máximo.' })
  }
})).min(2).max(5000)

export const csvDatasetSchema = z.object({
  asset: z.string().trim().min(1).max(32).transform((value) => value.toUpperCase()),
  timeframe: z.string().trim().min(1).max(16),
})

export const publicDatasetSchema = z.object({
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{5,20}$/),
  timeframe: z.enum(['1m', '5m', '15m', '1h', '4h', '1d', '1w']),
  limit: z.coerce.number().int().min(100).max(1000).default(500),
})

const sideSchema = z.enum(['both', 'long', 'short']).default('both')

export const backtestRuleSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('sma_cross'),
    fastPeriod: z.number().int().min(2).max(200),
    slowPeriod: z.number().int().min(3).max(500),
    side: sideSchema,
  }).refine((rule) => rule.fastPeriod < rule.slowPeriod, {
    path: ['fastPeriod'],
    message: 'La media rápida debe ser menor que la media lenta.',
  }),
  z.object({
    type: z.literal('rsi'),
    period: z.number().int().min(2).max(100),
    oversold: z.number().int().min(5).max(45),
    overbought: z.number().int().min(55).max(95),
    side: sideSchema,
  }),
  z.object({
    type: z.literal('levels'),
    support: candlePrice,
    resistance: candlePrice,
    side: sideSchema,
  }).refine((rule) => Number(rule.support) < Number(rule.resistance), {
    path: ['support'],
    message: 'El soporte debe estar por debajo de la resistencia.',
  }),
])

export const createBacktestSchema = z.object({
  datasetId: z.string().uuid(),
  strategyId: z.string().uuid().nullable().optional(),
  rule: backtestRuleSchema,
})

export const datasetIdParamsSchema = z.object({ datasetId: z.string().uuid() })
