function Metric({ label, value, suffix = '' }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-sm font-semibold text-slate-200">{value ?? '—'}{value != null ? suffix : ''}</p>
    </div>
  )
}

export default function StrategyCard({ strategy, onSelect }) {
  const winrate = strategy.metrics?.winrate
  return (
    <button
      type="button"
      onClick={() => onSelect(strategy)}
      className="group w-full rounded-lg border border-line bg-panel p-5 text-left transition-colors hover:border-accent/40 hover:bg-raised"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-sm bg-accent/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-accent">{strategy.asset}</span>
            <span className="rounded-sm bg-raised px-2 py-1 text-[10px] font-medium text-muted">{strategy.timeframe}</span>
          </div>
          <h3 className="truncate text-base font-semibold text-copy group-hover:text-accent">{strategy.title}</h3>
        </div>
        <span className="shrink-0 font-mono text-lg font-semibold text-emerald-300">{winrate == null ? '—' : `${winrate}%`}</span>
      </div>
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted">{strategy.description}</p>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-line pt-4">
        <div className="flex gap-7">
          <Metric label="Operaciones" value={strategy.metrics?.closedTrades || 0} />
          <Metric label="Profit factor" value={strategy.metrics?.profitFactor} />
          <Metric label="R/B medio" value={strategy.metrics?.riskReward} />
        </div>
        <span className="text-xs text-muted">por @{strategy.username}</span>
      </div>
    </button>
  )
}
