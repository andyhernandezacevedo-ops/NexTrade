function average(values, end, period) {
  const start = end - period + 1
  if (start < 0) return null
  let sum = 0
  for (let index = start; index <= end; index += 1) sum += values[index]
  return sum / period
}

function movingAverageSignals(candles, rule) {
  const closes = candles.map((candle) => Number(candle.close))
  return candles.map((_, index) => {
    if (index < rule.slowPeriod) return 0
    const fast = average(closes, index, rule.fastPeriod)
    const slow = average(closes, index, rule.slowPeriod)
    const previousFast = average(closes, index - 1, rule.fastPeriod)
    const previousSlow = average(closes, index - 1, rule.slowPeriod)
    if (previousFast <= previousSlow && fast > slow) return 1
    if (previousFast >= previousSlow && fast < slow) return -1
    return 0
  })
}

function relativeStrengthSignals(candles, rule) {
  const closes = candles.map((candle) => Number(candle.close))
  const values = Array(candles.length).fill(null)
  let gain = 0
  let loss = 0

  for (let index = 1; index < closes.length; index += 1) {
    const change = closes[index] - closes[index - 1]
    if (index <= rule.period) {
      gain += Math.max(change, 0) / rule.period
      loss += Math.max(-change, 0) / rule.period
    } else {
      gain = (gain * (rule.period - 1) + Math.max(change, 0)) / rule.period
      loss = (loss * (rule.period - 1) + Math.max(-change, 0)) / rule.period
    }

    if (index >= rule.period) {
      values[index] = loss === 0 ? (gain === 0 ? 50 : 100) : 100 - (100 / (1 + gain / loss))
    }
  }

  return candles.map((_, index) => {
    const current = values[index]
    const previous = values[index - 1]
    if (current == null || previous == null) return 0
    if (previous <= rule.oversold && current > rule.oversold) return 1
    if (previous >= rule.overbought && current < rule.overbought) return -1
    return 0
  })
}

function levelSignals(candles, rule) {
  return candles.map((candle) => {
    const touchedSupport = Number(candle.low) <= Number(rule.support) && Number(candle.close) > Number(rule.support)
    const rejectedResistance = Number(candle.high) >= Number(rule.resistance) && Number(candle.close) < Number(rule.resistance)
    if (touchedSupport && rejectedResistance) return 0
    if (touchedSupport) return 1
    if (rejectedResistance) return -1
    return 0
  })
}

function calculateReturns(trades, startAt) {
  let equity = 100
  let peak = 100
  let maxDrawdownPct = 0
  const curve = [{ date: startAt, equityIndex: 100, returnPct: 0 }]

  for (const trade of trades) {
    equity += trade.returnPct
    peak = Math.max(peak, equity)
    if (peak > 0) maxDrawdownPct = Math.max(maxDrawdownPct, ((peak - equity) / peak) * 100)
    curve.push({
      date: trade.exitAt,
      equityIndex: Number(equity.toFixed(4)),
      returnPct: Number(trade.returnPct.toFixed(4)),
    })
  }

  const gains = trades.filter((trade) => trade.returnPct > 0).map((trade) => trade.returnPct)
  const losses = trades.filter((trade) => trade.returnPct < 0).map((trade) => trade.returnPct)
  const grossProfit = gains.reduce((sum, value) => sum + value, 0)
  const grossLoss = Math.abs(losses.reduce((sum, value) => sum + value, 0))
  const totalReturnPct = trades.reduce((sum, trade) => sum + trade.returnPct, 0)

  return {
    metrics: {
      totalTrades: trades.length,
      winrate: trades.length ? Number(((gains.length / trades.length) * 100).toFixed(1)) : null,
      profitFactor: grossLoss ? Number((grossProfit / grossLoss).toFixed(2)) : null,
      averageReturnPct: trades.length
        ? Number((totalReturnPct / trades.length).toFixed(4))
        : null,
      cumulativeReturnPct: Number(totalReturnPct.toFixed(4)),
      maxDrawdownPct: Number(maxDrawdownPct.toFixed(4)),
      bestTradePct: trades.length ? Number(Math.max(...trades.map((trade) => trade.returnPct)).toFixed(4)) : null,
      worstTradePct: trades.length ? Number(Math.min(...trades.map((trade) => trade.returnPct)).toFixed(4)) : null,
    },
    equityCurve: curve,
  }
}

function makeTrade(position, exitPrice, exitAt) {
  const direction = position.side === 'long' ? 1 : -1
  return {
    side: position.side,
    entryAt: position.entryAt,
    exitAt,
    entryPrice: position.entryPrice,
    exitPrice,
    returnPct: ((exitPrice - position.entryPrice) / position.entryPrice) * direction * 100,
  }
}

export function runBacktest(candles, rule) {
  const minimumBars = rule.type === 'sma_cross'
    ? rule.slowPeriod + 2
    : rule.type === 'rsi'
      ? rule.period + 2
      : 3

  if (candles.length < minimumBars) {
    throw new RangeError(`Esta regla necesita al menos ${minimumBars} velas.`)
  }

  const signals = rule.type === 'sma_cross'
    ? movingAverageSignals(candles, rule)
    : rule.type === 'rsi'
      ? relativeStrengthSignals(candles, rule)
      : levelSignals(candles, rule)
  const trades = []
  let position = null

  for (let executionIndex = 1; executionIndex < candles.length; executionIndex += 1) {
    const signal = signals[executionIndex - 1]
    if (signal === 0 || position?.side === (signal === 1 ? 'long' : 'short')) continue

    const execution = candles[executionIndex]
    if (position) {
      trades.push(makeTrade(position, Number(execution.open), execution.time))
      position = null
    }

    const side = signal === 1 ? 'long' : 'short'
    if (rule.side === 'both' || rule.side === side) {
      position = { side, entryAt: execution.time, entryPrice: Number(execution.open) }
    }
  }

  if (position) {
    const lastCandle = candles.at(-1)
    trades.push(makeTrade(position, Number(lastCandle.close), lastCandle.time))
  }

  return {
    rule,
    candles: candles.length,
    startAt: candles[0].time,
    endAt: candles.at(-1).time,
    trades,
    ...calculateReturns(trades, candles[0].time),
  }
}
