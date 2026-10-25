import { and, eq, isNotNull } from 'drizzle-orm'
import { db } from '../db/index.js'
import { trades } from '../db/schema.js'

export function calculateMetrics(results) {
  const values = results.map((result) => result == null ? 0 : Number(result)).filter(Number.isFinite)
  const wins = values.filter((result) => result > 0)
  const losses = values.filter((result) => result < 0)
  const grossProfit = wins.reduce((total, result) => total + result, 0)
  const grossLoss = Math.abs(losses.reduce((total, result) => total + result, 0))

  // El winrate solo considera operaciones cerradas; los trades abiertos no entran en el denominador.
  return {
    closedTrades: results.length,
    winrate: results.length ? Number(((wins.length / results.length) * 100).toFixed(1)) : null,
    profitFactor: grossLoss ? Number((grossProfit / grossLoss).toFixed(2)) : null,
    riskReward: wins.length && losses.length
      ? Number(((grossProfit / wins.length) / (grossLoss / losses.length)).toFixed(2))
      : null,
  }
}

export async function strategyMetrics(strategyId) {
  const rows = await db.select({ resultR: trades.resultR })
    .from(trades)
    .where(and(eq(trades.strategyId, strategyId), isNotNull(trades.exitPrice)))
  return calculateMetrics(rows.map((row) => row.resultR))
}
