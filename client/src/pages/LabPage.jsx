import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'framer-motion'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { jsonBody, request, uploadFile } from '../api.js'
import TradingViewWidget from '../components/TradingViewWidget.jsx'
import { Button } from '../components/ui/Button.jsx'
import { FormField } from '../components/ui/FormField.jsx'
import { Eyebrow, Panel, StatusTag } from '../components/ui/Panel.jsx'
import { useSessionStore } from '../store.js'

const intervals = [
  { value: '1m', label: '1 minuto', widget: '1' },
  { value: '5m', label: '5 minutos', widget: '5' },
  { value: '15m', label: '15 minutos', widget: '15' },
  { value: '1h', label: '1 hora', widget: '60' },
  { value: '4h', label: '4 horas', widget: '240' },
  { value: '1d', label: '1 día', widget: 'D' },
  { value: '1w', label: '1 semana', widget: 'W' },
]

function LabChart({ curve, reduceMotion }) {
  if (!curve?.length) {
    return (
      <div className="grid min-h-56 place-items-center border border-dashed border-line text-center">
        <div>
          <Eyebrow>Curva simulada · índice base 100</Eyebrow>
          <p className="mt-2 text-sm text-muted">Ejecuta un backtest para ver su curva de capital simulada.</p>
        </div>
      </div>
    )
  }

  const values = curve.map((point) => Number(point.equityIndex))
  const min = Math.min(100, ...values)
  const max = Math.max(100, ...values)
  const span = max - min || 1
  const line = curve.map((point, index) => {
    const x = (index / Math.max(curve.length - 1, 1)) * 1000
    const y = 190 - ((Number(point.equityIndex) - min) / span) * 160
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
  }).join(' ')
  const last = values.at(-1)
  const lastY = 190 - ((last - min) / span) * 160

  return (
    <div className="border border-line bg-canvas px-3 pb-3 pt-5 sm:px-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Eyebrow>Índice de capital simulado</Eyebrow>
        <span className="font-mono text-xs text-accent">{last.toFixed(2)}</span>
      </div>
      <svg aria-label="Curva del índice de capital simulado" className="h-56 w-full" preserveAspectRatio="none" role="img" viewBox="0 0 1000 220">
        {[0, 1, 2, 3].map((step) => (
          <line className="stroke-line" key={step} opacity="0.7" x1="0" x2="1000" y1={15 + step * 53} y2={15 + step * 53} />
        ))}
        <motion.path
          animate={{ pathLength: 1 }}
          className="fill-none stroke-accent"
          d={line}
          initial={reduceMotion ? { pathLength: 1 } : { pathLength: 0 }}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
          transition={{ duration: reduceMotion ? 0 : 0.8, ease: 'easeOut' }}
        />
        <circle className="fill-accent" cx="1000" cy={lastY} r="5" />
      </svg>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-muted">
        <span>{curve[0].date ? new Date(curve[0].date).toLocaleDateString('es') : 'Inicio'}</span>
        <span>{curve.at(-1).date ? new Date(curve.at(-1).date).toLocaleDateString('es') : 'Fin'}</span>
      </div>
    </div>
  )
}

function Metric({ label, value, note, accent = false }) {
  return (
    <div className="border-b border-line px-4 py-4 sm:border-b-0 sm:border-r last:border-r-0">
      <Eyebrow>{label}</Eyebrow>
      <p className={`mt-2 font-mono text-2xl ${accent ? 'text-accent' : 'text-copy'}`}>{value}</p>
      <p className="mt-1 text-xs text-muted">{note}</p>
    </div>
  )
}

function SelectField({ label, name, children, value, onChange }) {
  return (
    <label className="block text-xs font-medium text-muted">
      {label}
      <select className="mt-2 w-full border border-line bg-canvas px-3 py-2.5 text-sm text-copy outline-none focus:border-accent" name={name} onChange={onChange} value={value}>
        {children}
      </select>
    </label>
  )
}

function BacktestForm({ datasets, strategies, busy, onRun, error }) {
  const [ruleType, setRuleType] = useState('sma_cross')
  const [side, setSide] = useState('both')
  const [strategyId, setStrategyId] = useState('')

  function submit(event) {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    const rule = ruleType === 'sma_cross'
      ? { type: ruleType, fastPeriod: Number(values.fastPeriod), slowPeriod: Number(values.slowPeriod), side: values.side }
      : ruleType === 'rsi'
        ? { type: ruleType, period: Number(values.period), oversold: Number(values.oversold), overbought: Number(values.overbought), side: values.side }
        : { type: ruleType, support: values.support, resistance: values.resistance, side: values.side }

    onRun({
      datasetId: values.datasetId,
      strategyId: values.strategyId || null,
      rule,
    })
  }

  return (
    <form className="grid gap-5" onSubmit={submit}>
      <SelectField label="Dataset histórico" name="datasetId" value={datasets.selectedId} onChange={(event) => datasets.onSelect(event.target.value)}>
        {datasets.items.length === 0
          ? <option value="">Primero carga datos históricos</option>
          : datasets.items.map((dataset) => (
            <option key={dataset.id} value={dataset.id}>
              {dataset.asset} · {dataset.timeframe} · {dataset.candleCount} velas · {dataset.source === 'csv' ? 'CSV' : 'API pública'}
            </option>
          ))}
      </SelectField>

      <SelectField label="Regla de entrada/salida" name="ruleType" value={ruleType} onChange={(event) => setRuleType(event.target.value)}>
        <option value="sma_cross">Cruce de medias móviles</option>
        <option value="rsi">RSI · reversión de umbrales</option>
        <option value="levels">Rebote en niveles</option>
      </SelectField>

      {ruleType === 'sma_cross' && (
        <div className="grid grid-cols-2 gap-4">
          <FormField defaultValue="10" label="Media rápida" max="200" min="2" name="fastPeriod" required type="number" />
          <FormField defaultValue="30" label="Media lenta" max="500" min="3" name="slowPeriod" required type="number" />
        </div>
      )}
      {ruleType === 'rsi' && (
        <div className="grid grid-cols-3 gap-3">
          <FormField defaultValue="14" label="Periodo" max="100" min="2" name="period" required type="number" />
          <FormField defaultValue="30" label="Sobreventa" max="45" min="5" name="oversold" required type="number" />
          <FormField defaultValue="70" label="Sobrecompra" max="95" min="55" name="overbought" required type="number" />
        </div>
      )}
      {ruleType === 'levels' && (
        <div className="grid grid-cols-2 gap-4">
          <FormField defaultValue="95" label="Nivel de soporte" min="0" name="support" required step="any" type="number" />
          <FormField defaultValue="105" label="Nivel de resistencia" min="0" name="resistance" required step="any" type="number" />
        </div>
      )}

      <SelectField label="Dirección simulada" name="side" value={side} onChange={(event) => setSide(event.target.value)}>
        <option value="both">Largo y corto</option>
        <option value="long">Solo largo</option>
        <option value="short">Solo corto</option>
      </SelectField>
      <SelectField label="Vincular a estrategia propia · opcional" name="strategyId" value={strategyId} onChange={(event) => setStrategyId(event.target.value)}>
        <option value="">Sin estrategia</option>
        {strategies.map((strategy) => <option key={strategy.id} value={strategy.id}>{strategy.title}</option>)}
      </SelectField>

      <p className="border-l-2 border-accent px-3 py-2 text-xs leading-5 text-muted">
        Las señales se calculan al cierre de cada vela y se simulan al precio de apertura de la siguiente. Sin comisiones ni deslizamiento.
      </p>
      {error && <p className="whitespace-pre-line border border-red-400/30 bg-red-400/5 px-3 py-2 text-sm text-red-200" role="alert">{error}</p>}
      <Button disabled={busy || datasets.items.length === 0} type="submit">
        {busy ? 'Simulando…' : 'Ejecutar backtest'}
      </Button>
    </form>
  )
}

export default function LabPage() {
  const reduceMotion = useReducedMotion()
  const queryClient = useQueryClient()
  const user = useSessionStore((state) => state.user)
  const [selectedDatasetId, setSelectedDatasetId] = useState('')
  const [selectedBacktest, setSelectedBacktest] = useState(null)
  const [symbol, setSymbol] = useState('BTCUSDT')
  const [widgetSymbol, setWidgetSymbol] = useState('BINANCE:BTCUSDT')
  const [timeframe, setTimeframe] = useState('1d')
  const [limit, setLimit] = useState('500')

  const datasetsQuery = useQuery({
    queryKey: ['lab', 'datasets'],
    queryFn: async () => (await request('/lab/datasets')).datasets,
  })
  const strategiesQuery = useQuery({
    queryKey: ['strategies', 'mine'],
    queryFn: async () => (await request('/strategies/mine')).strategies,
  })
  const backtestsQuery = useQuery({
    queryKey: ['lab', 'backtests'],
    queryFn: async () => (await request('/lab/backtests')).backtests,
  })

  const datasets = datasetsQuery.data || []
  const currentDataset = datasets.find((dataset) => dataset.id === selectedDatasetId) || datasets[0]
  const selectedRun = selectedBacktest || backtestsQuery.data?.[0] || null
  const activeInterval = intervals.find((item) => item.value === timeframe) || intervals[5]

  const csvMutation = useMutation({
    mutationFn: async (formData) => uploadFile('/lab/datasets/csv', formData),
    onSuccess: async ({ dataset }) => {
      setSelectedDatasetId(dataset.id)
      await queryClient.invalidateQueries({ queryKey: ['lab', 'datasets'] })
    },
  })
  const publicMutation = useMutation({
    mutationFn: (data) => request('/lab/datasets/public', { method: 'POST', body: jsonBody(data) }),
    onSuccess: async ({ dataset }) => {
      setSelectedDatasetId(dataset.id)
      await queryClient.invalidateQueries({ queryKey: ['lab', 'datasets'] })
    },
  })
  const backtestMutation = useMutation({
    mutationFn: (data) => request('/lab/backtests', { method: 'POST', body: jsonBody(data) }),
    onSuccess: async ({ backtest }) => {
      setSelectedBacktest(backtest)
      await queryClient.invalidateQueries({ queryKey: ['lab', 'backtests'] })
    },
  })

  function importCsv(event) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    csvMutation.mutate(formData)
    event.currentTarget.reset()
  }

  function loadPublicData(event) {
    event.preventDefault()
    publicMutation.mutate({ symbol, timeframe, limit: Number(limit) })
    setWidgetSymbol(`BINANCE:${symbol.trim().toUpperCase()}`)
  }

  const datasetError = datasetsQuery.error || csvMutation.error || publicMutation.error
  const runError = backtestMutation.error || strategiesQuery.error || backtestsQuery.error
  const metrics = selectedRun?.results?.metrics
  const rows = selectedRun?.results?.trades || []

  return (
    <motion.main
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto min-h-screen max-w-[1440px] px-4 py-5 sm:px-8 lg:px-12"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      transition={{ duration: reduceMotion ? 0 : 0.25 }}
    >
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
        <div className="flex items-center gap-8">
          <Link className="flex items-center gap-3" to="/">
            <span className="grid size-9 place-items-center border border-accent font-display text-lg font-bold text-accent">N</span>
            <span className="font-display text-lg font-semibold tracking-tight text-copy">NEXTRADE</span>
          </Link>
          <span className="hidden h-7 w-px bg-line sm:block" />
          <nav aria-label="Navegación del espacio personal" className="flex gap-4 text-sm">
            <Link className="text-muted transition hover:text-accent" to="/journal">Diario</Link>
            <span aria-current="page" className="text-accent">Laboratorio</span>
            <Link className="text-muted transition hover:text-accent" to="/community">Comunidad</Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <StatusTag>Simulación · Sin órdenes</StatusTag>
          <span className="hidden text-xs text-muted sm:block">@{user?.username}</span>
        </div>
      </header>

      <section className="py-8">
        <Eyebrow>Investigación histórica · Solo simulación</Eyebrow>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.04em] text-copy sm:text-4xl">
          Laboratorio de <span className="text-accent">estrategias.</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Explora gráficos y contrasta reglas sencillas con datos históricos. El resultado es una simulación educativa,
          no una señal ni una recomendación de inversión.
        </p>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.45fr_0.75fr]">
        <div className="space-y-5">
          <Panel className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <Eyebrow>Gráfico de mercado</Eyebrow>
                <h2 className="mt-1 font-display text-lg font-semibold text-copy">{widgetSymbol}</h2>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted">TradingView · gratuito</span>
            </div>
            <TradingViewWidget height={420} interval={activeInterval.widget} symbol={widgetSymbol} />
          </Panel>

          <Panel className="p-5 sm:p-6">
            <Eyebrow>1 · Carga tus datos históricos</Eyebrow>
            <div className="mt-5 grid gap-6 lg:grid-cols-2">
              <form className="grid content-start gap-4" onSubmit={importCsv}>
                <p className="text-sm font-medium text-copy">Importar CSV</p>
                <p className="text-xs leading-5 text-muted">
                  Encabezados requeridos: `timestamp,open,high,low,close`; `volume` es opcional. Máximo 5.000 filas y 1 MB.
                </p>
                <input accept=".csv,text/csv" className="w-full text-xs text-muted file:mr-3 file:border file:border-line file:bg-raised file:px-3 file:py-2 file:text-xs file:text-copy" name="file" required type="file" />
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Activo" maxLength={32} name="asset" placeholder="BTCUSDT" required />
                  <FormField label="Temporalidad" maxLength={16} name="timeframe" placeholder="1d" required />
                </div>
                <Button disabled={csvMutation.isPending} type="submit" variant="secondary">
                  {csvMutation.isPending ? 'Importando…' : 'Importar archivo CSV'}
                </Button>
              </form>

              <form className="grid content-start gap-4 border-t border-line pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0" onSubmit={loadPublicData}>
                <p className="text-sm font-medium text-copy">API pública sin clave</p>
                <p className="text-xs leading-5 text-muted">Descarga velas de Binance Spot para análisis histórico. No se conecta ninguna cuenta.</p>
                <div className="grid grid-cols-2 gap-3">
                  <FormField autoComplete="off" label="Símbolo" maxLength={20} name="symbol" onChange={(event) => setSymbol(event.target.value)} pattern="[A-Za-z0-9]{5,20}" required value={symbol} />
                  <SelectField label="Intervalo" name="timeframe" value={timeframe} onChange={(event) => setTimeframe(event.target.value)}>
                    {intervals.map((interval) => <option key={interval.value} value={interval.value}>{interval.label}</option>)}
                  </SelectField>
                </div>
                <SelectField label="Velas" name="limit" value={limit} onChange={(event) => setLimit(event.target.value)}>
                  <option value="100">100</option>
                  <option value="250">250</option>
                  <option value="500">500</option>
                  <option value="1000">1.000</option>
                </SelectField>
                <Button disabled={publicMutation.isPending} type="submit" variant="secondary">
                  {publicMutation.isPending ? 'Descargando…' : 'Cargar datos públicos'}
                </Button>
              </form>
            </div>

            {datasetError && <p className="mt-4 whitespace-pre-line border border-red-400/30 bg-red-400/5 px-3 py-2 text-sm text-red-200" role="alert">{datasetError.message}</p>}
            {datasetsQuery.isLoading && <p className="mt-4 text-xs text-muted">Cargando tus datasets…</p>}
            {!datasetsQuery.isLoading && datasets.length > 0 && (
              <div className="mt-5 border-t border-line pt-4">
                <Eyebrow>Datasets guardados</Eyebrow>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {datasets.slice(0, 6).map((dataset) => (
                    <button
                      aria-pressed={currentDataset?.id === dataset.id}
                      className={`flex items-center justify-between gap-3 border px-3 py-2.5 text-left transition ${currentDataset?.id === dataset.id ? 'border-accent/60 bg-accent/[0.04]' : 'border-line hover:border-accent/30'}`}
                      key={dataset.id}
                      onClick={() => setSelectedDatasetId(dataset.id)}
                      type="button"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-copy">{dataset.asset} · {dataset.timeframe}</span>
                        <span className="mt-1 block font-mono text-[10px] text-muted">{dataset.candleCount} velas · {dataset.source === 'csv' ? 'CSV' : 'API pública'}</span>
                      </span>
                      <span className="font-mono text-[10px] text-accent">{currentDataset?.id === dataset.id ? 'ACTIVO' : 'USAR'}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Panel>
        </div>

        <Panel className="h-fit p-5 sm:p-6">
          <Eyebrow>2 · Define una regla simple</Eyebrow>
          <h2 className="mt-2 font-display text-xl font-semibold text-copy">Backtest</h2>
          <p className="mt-2 text-xs leading-5 text-muted">
            Una posición simulada a la vez. Las señales se ejecutan a la apertura de la vela siguiente.
          </p>
          <div className="mt-5">
            <BacktestForm
              busy={backtestMutation.isPending}
              datasets={{ items: datasets, selectedId: currentDataset?.id || '', onSelect: setSelectedDatasetId }}
              error={runError?.message}
              onRun={(data) => backtestMutation.mutate(data)}
              strategies={strategiesQuery.data || []}
            />
          </div>
          {backtestsQuery.isLoading && <p className="mt-5 text-xs text-muted">Cargando ejecuciones anteriores…</p>}
          {backtestsQuery.error && <p className="mt-4 text-sm text-red-200" role="alert">{backtestsQuery.error.message}</p>}
          {backtestsQuery.data?.length > 0 && (
            <div className="mt-6 border-t border-line pt-4">
              <Eyebrow>Backtests recientes</Eyebrow>
              <div className="mt-2 grid gap-1">
                {backtestsQuery.data.slice(0, 5).map((run) => (
                  <button
                    className={`flex justify-between gap-3 px-2 py-2 text-left text-xs transition hover:bg-raised ${selectedRun?.id === run.id ? 'text-accent' : 'text-muted'}`}
                    key={run.id}
                    onClick={() => setSelectedBacktest(run)}
                    type="button"
                  >
                    <span>{run.configuration.asset} · {run.configuration.rule.type}</span>
                    <span className="font-mono">{new Date(run.createdAt).toLocaleDateString('es')}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </Panel>
      </section>

      <section className="mt-5">
        <Panel className="p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
            <div>
              <Eyebrow>3 · Resultados</Eyebrow>
              <h2 className="mt-2 font-display text-xl font-semibold text-copy">
                {selectedRun ? `${selectedRun.configuration.asset} · ${selectedRun.configuration.timeframe}` : 'Aún no hay resultados'}
              </h2>
            </div>
            {selectedRun && <span className="font-mono text-[10px] text-muted">{selectedRun.results.candles} velas · {new Date(selectedRun.createdAt).toLocaleString('es')}</span>}
          </div>

          {!selectedRun && (
            <div className="grid min-h-44 place-items-center text-center">
              <p className="max-w-md text-sm leading-6 text-muted">Carga un CSV o datos públicos, configura una regla y ejecuta una simulación.</p>
            </div>
          )}
          {selectedRun && metrics && (
            <div className="space-y-5 pt-5">
              <div className="grid border border-line sm:grid-cols-2 lg:grid-cols-5">
                <Metric accent label="Operaciones simuladas" note="No son órdenes reales" value={metrics.totalTrades} />
                <Metric label="Winrate" note="Ganadoras / total" value={metrics.winrate == null ? '—' : `${metrics.winrate}%`} />
                <Metric label="Profit factor" note="Ganancias / pérdidas brutas" value={metrics.profitFactor ?? '—'} />
                <Metric label="Drawdown máximo" note="Desde el pico del índice" value={`${metrics.maxDrawdownPct}%`} />
                <Metric accent={metrics.cumulativeReturnPct >= 0} label="Retorno acumulado" note="Porcentaje simple, sin costes" value={`${metrics.cumulativeReturnPct > 0 ? '+' : ''}${metrics.cumulativeReturnPct}%`} />
              </div>
              <LabChart curve={selectedRun.results.equityCurve} reduceMotion={reduceMotion} />

              {rows.length > 0 && (
                <div className="overflow-x-auto border border-line">
                  <div className="border-b border-line px-4 py-3"><Eyebrow>Últimas operaciones simuladas · máximo 20 visibles</Eyebrow></div>
                  <table className="w-full min-w-[650px] text-left text-xs">
                    <thead className="font-mono text-[10px] uppercase text-muted">
                      <tr className="border-b border-line">
                        <th className="px-4 py-3 font-medium">Dirección</th>
                        <th className="px-4 py-3 font-medium">Entrada</th>
                        <th className="px-4 py-3 font-medium">Salida</th>
                        <th className="px-4 py-3 font-medium">Precio entrada</th>
                        <th className="px-4 py-3 font-medium">Precio salida</th>
                        <th className="px-4 py-3 text-right font-medium">Retorno sim.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(-20).reverse().map((trade, index) => (
                        <tr className="border-b border-line/70 last:border-0" key={`${trade.entryAt}-${index}`}>
                          <td className={trade.side === 'long' ? 'px-4 py-3 text-accent' : 'px-4 py-3 text-copy'}>{trade.side === 'long' ? 'Largo' : 'Corto'}</td>
                          <td className="px-4 py-3 font-mono text-muted">{new Date(trade.entryAt).toLocaleString('es')}</td>
                          <td className="px-4 py-3 font-mono text-muted">{new Date(trade.exitAt).toLocaleString('es')}</td>
                          <td className="px-4 py-3 font-mono text-copy">{trade.entryPrice}</td>
                          <td className="px-4 py-3 font-mono text-copy">{trade.exitPrice}</td>
                          <td className={`px-4 py-3 text-right font-mono ${trade.returnPct >= 0 ? 'text-accent' : 'text-red-300'}`}>{trade.returnPct > 0 ? '+' : ''}{trade.returnPct.toFixed(3)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-xs leading-5 text-muted">
                Simulación educativa sobre datos históricos. Retornos simples, posiciones secuenciales, sin comisiones, deslizamiento, financiación ni impacto de mercado. El índice base 100 no es una cuenta ni representa dinero real.
              </p>
            </div>
          )}
        </Panel>
      </section>

      <footer className="flex flex-wrap justify-between gap-3 py-5 font-mono text-[10px] uppercase tracking-wider text-muted">
        <span>Datos históricos · No es asesoramiento financiero</span>
        <Link className="hover:text-accent" to="/journal">Volver al diario</Link>
      </footer>
    </motion.main>
  )
}
