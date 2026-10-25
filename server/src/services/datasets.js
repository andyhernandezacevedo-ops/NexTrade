import { parse } from 'csv-parse/sync'
import { marketCandlesSchema } from './validation.js'

const columnAliases = new Map([
  ['timestamp', 'time'],
  ['datetime', 'time'],
  ['date', 'time'],
  ['open_time', 'time'],
  ['time', 'time'],
  ['open', 'open'],
  ['high', 'high'],
  ['low', 'low'],
  ['close', 'close'],
  ['volume', 'volume'],
])

function normalizeTime(value) {
  const trimmed = String(value || '').trim()
  if (/^\d{10,13}$/.test(trimmed)) {
    const numeric = Number(trimmed)
    const date = new Date(trimmed.length === 10 ? numeric * 1000 : numeric)
    return Number.isNaN(date.getTime()) ? trimmed : date.toISOString()
  }
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) return trimmed
  return date.toISOString()
}

export function parseCsvCandles(csvText) {
  let records
  try {
    records = parse(csvText, {
      bom: true,
      columns: (headers) => headers.map((header) => columnAliases.get(header.trim().toLowerCase()) || header.trim().toLowerCase()),
      skip_empty_lines: true,
      trim: true,
      max_record_size: 4096,
      relax_column_count: false,
    })
  } catch (error) {
    return {
      error: `El CSV no se pudo leer: ${error.message}`,
    }
  }

  if (records.length < 2 || records.length > 5000) {
    return { error: 'El CSV debe contener entre 2 y 5.000 velas históricas.' }
  }

  const candles = records.map((record) => ({
    time: normalizeTime(record.time),
    open: record.open,
    high: record.high,
    low: record.low,
    close: record.close,
    volume: record.volume || null,
  }))
  const result = marketCandlesSchema.safeParse(candles)
  if (!result.success) {
    const firstIssue = result.error.issues[0]
    const row = firstIssue.path[0] + 2
    return { error: `Fila ${row}: ${firstIssue.message}` }
  }

  for (let index = 1; index < result.data.length; index += 1) {
    if (Date.parse(result.data[index].time) <= Date.parse(result.data[index - 1].time)) {
      return { error: `Las fechas deben estar en orden cronológico y no repetirse (fila ${index + 2}).` }
    }
  }

  return { candles: result.data }
}

export function normalizePublicCandles(rows) {
  if (!Array.isArray(rows)) return { error: 'La API pública devolvió un formato inesperado.' }
  const candles = rows.map((row) => {
    if (!Array.isArray(row) || row.length < 6 || !Number.isFinite(Number(row[0]))) return null
    const date = new Date(Number(row[0]))
    if (Number.isNaN(date.getTime())) return null
    return {
      time: date.toISOString(),
      open: String(row[1]),
      high: String(row[2]),
      low: String(row[3]),
      close: String(row[4]),
      volume: String(row[5]),
    }
  })
  if (candles.some((candle) => candle === null)) {
    return { error: 'La API pública devolvió velas incompletas.' }
  }

  const result = marketCandlesSchema.safeParse(candles)
  if (!result.success) return { error: 'La API pública devolvió datos de mercado inválidos.' }
  return { candles: result.data }
}
