import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'framer-motion'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { jsonBody, request } from '../api.js'
import { Button } from '../components/ui/Button.jsx'
import { FormField } from '../components/ui/FormField.jsx'
import { Eyebrow, Panel, StatusTag } from '../components/ui/Panel.jsx'
import { useSessionStore } from '../store.js'

const tabs = [
  { id: 'trades', label: 'Operaciones' },
  { id: 'strategies', label: 'Estrategias' },
]

function localDateTime(value = new Date()) {
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function formatDate(value) {
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(value))
}

function formatPrice(value) {
  if (value == null) return '—'
  return new Intl.NumberFormat('es', { maximumFractionDigits: 8 }).format(Number(value))
}

function Dialog({ title, children, onClose, className = 'max-w-xl' }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-4" onMouseDown={onClose}>
      <section
        aria-label={title}
        aria-modal="true"
        className={`my-auto w-full border border-line bg-panel p-5 shadow-2xl shadow-black/40 sm:p-7 ${className}`}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="mb-6 flex items-start justify-between gap-4 border-b border-line pb-4">
          <div>
            <Eyebrow>Diario personal</Eyebrow>
            <h2 className="mt-2 font-display text-xl font-semibold text-copy">{title}</h2>
          </div>
          <Button aria-label="Cerrar" className="min-h-9 px-3" onClick={onClose} type="button" variant="quiet">×</Button>
        </div>
        {children}
      </section>
    </div>
  )
}

function TradeForm({ trade, strategies, onCancel, onSave, saving, error }) {
  const [hasExit, setHasExit] = useState(Boolean(trade?.exitPrice))

  const submit = (event) => {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    const closed = Boolean(values.exitPrice)
    onSave({
      strategyId: values.strategyId || null,
      asset: values.asset,
      side: values.side,
      entryPrice: values.entryPrice,
      exitPrice: values.exitPrice || null,
      stopLoss: values.stopLoss || null,
      takeProfit: values.takeProfit || null,
      resultR: closed && values.resultR !== '' ? values.resultR : null,
      notes: values.notes || '',
      openedAt: new Date(values.openedAt).toISOString(),
      closedAt: closed && values.closedAt ? new Date(values.closedAt).toISOString() : null,
    })
  }

  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
      <FormField autoComplete="off" label="Activo" maxLength={32} name="asset" placeholder="EURUSD" required defaultValue={trade?.asset || ''} />
      <label className="block text-xs font-medium text-muted" htmlFor="trade-side">
        Dirección
        <select className="mt-2 w-full border border-line bg-canvas px-3 py-2.5 text-sm text-copy outline-none focus:border-accent" defaultValue={trade?.side || 'long'} id="trade-side" name="side">
          <option value="long">Largo</option>
          <option value="short">Corto</option>
        </select>
      </label>
      <FormField label="Precio de entrada" min="0" name="entryPrice" placeholder="0.00" required step="any" type="number" defaultValue={trade?.entryPrice ?? ''} />
      <FormField label="Precio de salida · opcional" min="0" name="exitPrice" onChange={(event) => setHasExit(Boolean(event.target.value))} placeholder="Deja vacío si sigue abierta" step="any" type="number" defaultValue={trade?.exitPrice ?? ''} />
      <FormField label="Stop loss · opcional" min="0" name="stopLoss" placeholder="0.00" step="any" type="number" defaultValue={trade?.stopLoss ?? ''} />
      <FormField label="Take profit · opcional" min="0" name="takeProfit" placeholder="0.00" step="any" type="number" defaultValue={trade?.takeProfit ?? ''} />
      <FormField label="Apertura" name="openedAt" required type="datetime-local" defaultValue={trade ? localDateTime(trade.openedAt) : localDateTime()} />
      <FormField label="Cierre · requerido si hay salida" name="closedAt" required={hasExit} type="datetime-local" defaultValue={trade?.closedAt ? localDateTime(trade.closedAt) : ''} />
      <FormField label="Resultado en R · opcional" name="resultR" placeholder="Ej. 1.5 o -1" step="any" type="number" defaultValue={trade?.resultR ?? ''} />
      <label className="block text-xs font-medium text-muted" htmlFor="trade-strategy">
        Estrategia
        <select className="mt-2 w-full border border-line bg-canvas px-3 py-2.5 text-sm text-copy outline-none focus:border-accent" defaultValue={trade?.strategyId || ''} id="trade-strategy" name="strategyId">
          <option value="">Sin estrategia</option>
          {strategies.map((strategy) => <option key={strategy.id} value={strategy.id}>{strategy.title}</option>)}
        </select>
      </label>
      <FormField as="textarea" className="sm:col-span-2" label="Notas" maxLength={10000} name="notes" placeholder="Contexto, plan y observaciones" rows={3} defaultValue={trade?.notes || ''} />
      {error && <p className="whitespace-pre-line sm:col-span-2 border border-red-400/30 bg-red-400/5 px-3 py-2 text-sm text-red-200" role="alert">{error}</p>}
      <div className="flex justify-end gap-3 border-t border-line pt-4 sm:col-span-2">
        <Button onClick={onCancel} type="button" variant="quiet">Cancelar</Button>
        <Button disabled={saving} type="submit">{saving ? 'Guardando…' : trade ? 'Guardar cambios' : 'Añadir operación'}</Button>
      </div>
    </form>
  )
}

function StrategyForm({ strategy, onCancel, onSave, saving, error }) {
  const submit = (event) => {
    event.preventDefault()
    onSave(Object.fromEntries(new FormData(event.currentTarget)))
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <FormField label="Nombre de la estrategia" maxLength={120} minLength={3} name="title" placeholder="Ruptura de rango" required defaultValue={strategy?.title || ''} />
      <FormField as="textarea" label="Descripción" maxLength={5000} minLength={10} name="description" placeholder="Describe el contexto y la idea detrás de la estrategia." required rows={3} defaultValue={strategy?.description || ''} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Activo" maxLength={32} name="asset" placeholder="EURUSD" required defaultValue={strategy?.asset || ''} />
        <FormField label="Temporalidad" maxLength={16} name="timeframe" placeholder="4H" required defaultValue={strategy?.timeframe || ''} />
      </div>
      <FormField as="textarea" label="Reglas" maxLength={10000} name="rules" placeholder="Condiciones de entrada, salida y gestión de riesgo." rows={4} defaultValue={strategy?.rules || ''} />
      <p className="border-l-2 border-accent px-3 py-2 text-xs leading-5 text-muted">
        Las estrategias se guardan privadas. La publicación en comunidad se habilitará en una fase posterior.
      </p>
      {error && <p className="whitespace-pre-line border border-red-400/30 bg-red-400/5 px-3 py-2 text-sm text-red-200" role="alert">{error}</p>}
      <div className="flex justify-end gap-3 border-t border-line pt-4">
        <Button onClick={onCancel} type="button" variant="quiet">Cancelar</Button>
        <Button disabled={saving} type="submit">{saving ? 'Guardando…' : strategy ? 'Guardar cambios' : 'Crear estrategia'}</Button>
      </div>
    </form>
  )
}

function ProfileForm({ user, onCancel, onSave, saving, error }) {
  const submit = (event) => {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    onSave({ username: values.username, bio: values.bio || null })
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <FormField autoComplete="username" label="Nombre de usuario" maxLength={32} minLength={3} name="username" pattern="[A-Za-z0-9_]+" required defaultValue={user.username} />
      <FormField as="textarea" label="Biografía" maxLength={280} name="bio" placeholder="Una breve presentación" rows={3} defaultValue={user.bio || ''} />
      <p className="text-xs text-muted">{user.email}</p>
      {error && <p className="border border-red-400/30 bg-red-400/5 px-3 py-2 text-sm text-red-200" role="alert">{error}</p>}
      <div className="flex justify-end gap-3 border-t border-line pt-4">
        <Button onClick={onCancel} type="button" variant="quiet">Cancelar</Button>
        <Button disabled={saving} type="submit">{saving ? 'Guardando…' : 'Guardar perfil'}</Button>
      </div>
    </form>
  )
}

function EmptyState({ type, onCreate }) {
  const isTrades = type === 'trades'
  return (
    <div className="grid min-h-56 place-items-center px-5 py-10 text-center">
      <div className="max-w-sm">
        <Eyebrow>{isTrades ? 'Sin registros' : 'Sin estrategias'}</Eyebrow>
        <h3 className="mt-3 font-display text-xl font-semibold text-copy">
          {isTrades ? 'Empieza tu diario.' : 'Define tu primer método.'}
        </h3>
        <p className="mt-2 text-sm leading-6 text-muted">
          {isTrades ? 'Guarda cada decisión para revisar tu proceso con datos reales.' : 'Documenta tus reglas para dar consistencia a tu proceso.'}
        </p>
        <Button className="mt-5" onClick={onCreate} type="button">
          {isTrades ? 'Registrar operación' : 'Crear estrategia'}
        </Button>
      </div>
    </div>
  )
}

function QueryError({ error, onRetry }) {
  return (
    <div className="grid min-h-48 place-items-center px-5 py-10 text-center">
      <div>
        <p className="text-sm text-red-200" role="alert">{error.message}</p>
        <Button className="mt-4" onClick={onRetry} type="button" variant="secondary">Reintentar</Button>
      </div>
    </div>
  )
}

export default function JournalPage() {
  const [activeTab, setActiveTab] = useState('trades')
  const [dialog, setDialog] = useState(null)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
  const clearSession = useSessionStore((state) => state.clearSession)
  const user = useSessionStore((state) => state.user)

  const tradesQuery = useQuery({
    queryKey: ['trades'],
    queryFn: async () => (await request('/trades')).trades,
  })
  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: async () => (await request('/auth/me')).user,
  })
  const strategiesQuery = useQuery({
    queryKey: ['strategies', 'mine'],
    queryFn: async () => (await request('/strategies/mine')).strategies,
  })
  const profileMutation = useMutation({
    mutationFn: (data) => request('/auth/me', { method: 'PATCH', body: jsonBody(data) }),
    onSuccess: ({ user: updatedUser }) => {
      useSessionStore.getState().setSession({ user: updatedUser, token: useSessionStore.getState().token })
      queryClient.setQueryData(['profile'], updatedUser)
      setDialog(null)
    },
  })

  const currentUser = profileQuery.data || user
  const trades = tradesQuery.data || []
  const strategies = strategiesQuery.data || []
  const openTrades = trades.filter((trade) => trade.exitPrice == null).length

  const saveTrade = useMutation({
    mutationFn: ({ id, data }) => request(id ? `/trades/${id}` : '/trades', {
      method: id ? 'PUT' : 'POST',
      body: jsonBody(data),
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['trades'] })
      setDialog(null)
    },
  })
  const deleteTrade = useMutation({
    mutationFn: (id) => request(`/trades/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trades'] }),
  })
  const saveStrategy = useMutation({
    mutationFn: ({ id, data }) => request(id ? `/strategies/${id}` : '/strategies', {
      method: id ? 'PUT' : 'POST',
      body: jsonBody(data),
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['strategies', 'mine'] })
      setDialog(null)
    },
  })
  const deleteStrategy = useMutation({
    mutationFn: (id) => request(`/strategies/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['strategies', 'mine'] }),
        queryClient.invalidateQueries({ queryKey: ['trades'] }),
      ])
    },
  })

  function signOut() {
    clearSession()
    queryClient.clear()
    navigate('/', { replace: true })
  }

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
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-muted sm:block">Diario de trading</span>
        </div>
        <div className="flex items-center gap-3">
          <Button className="min-h-9 px-3 text-xs" disabled={!currentUser} onClick={() => setDialog({ type: 'profile' })} type="button" variant="quiet">
            @{currentUser?.username || 'perfil'}
          </Button>
          <Button className="min-h-9 px-3 text-xs" onClick={signOut} type="button" variant="secondary">Salir</Button>
        </div>
      </header>

      <section className="py-8 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <Eyebrow>Espacio personal · Solo análisis</Eyebrow>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.04em] text-copy sm:text-4xl">
              Tu proceso, <span className="text-accent">en registro.</span>
            </h1>
            <p className="mt-2 text-sm text-muted">Revisa tus decisiones. NexTrade no ejecuta operaciones.</p>
          </div>
          <StatusTag>Cuenta privada</StatusTag>
        </div>

        <div className="mt-7 grid gap-px border border-line bg-line sm:grid-cols-3">
          <div className="bg-canvas px-4 py-4">
            <Eyebrow>Operaciones registradas</Eyebrow>
            <p className="mt-2 font-mono text-2xl text-copy">{tradesQuery.isLoading ? '—' : trades.length}</p>
          </div>
          <div className="bg-canvas px-4 py-4">
            <Eyebrow>En seguimiento</Eyebrow>
            <p className="mt-2 font-mono text-2xl text-accent">{tradesQuery.isLoading ? '—' : openTrades}</p>
          </div>
          <div className="bg-canvas px-4 py-4">
            <Eyebrow>Mis estrategias</Eyebrow>
            <p className="mt-2 font-mono text-2xl text-copy">{strategiesQuery.isLoading ? '—' : strategies.length}</p>
          </div>
        </div>
      </section>

      <Panel className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-4 py-4 sm:px-6">
          <div className="flex gap-1" role="tablist" aria-label="Contenido del diario">
            {tabs.map((tab) => (
              <button
                aria-selected={activeTab === tab.id}
                className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${activeTab === tab.id ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-copy'}`}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
          <Button onClick={() => setDialog({ type: activeTab === 'trades' ? 'trade' : 'strategy' })} type="button">
            + {activeTab === 'trades' ? 'Añadir operación' : 'Nueva estrategia'}
          </Button>
        </div>

        {profileQuery.error && <p className="m-5 border border-red-400/30 bg-red-400/5 px-3 py-2 text-sm text-red-200" role="alert">{profileQuery.error.message}</p>}
        {deleteTrade.error && <p className="m-5 border border-red-400/30 px-3 py-2 text-sm text-red-200" role="alert">{deleteTrade.error.message}</p>}
        {deleteStrategy.error && <p className="m-5 border border-red-400/30 px-3 py-2 text-sm text-red-200" role="alert">{deleteStrategy.error.message}</p>}
        {tradesQuery.error && tradesQuery.data && <p className="m-5 border border-red-400/30 bg-red-400/5 px-3 py-2 text-sm text-red-200" role="alert">{tradesQuery.error.message}</p>}
        {strategiesQuery.error && strategiesQuery.data && <p className="m-5 border border-red-400/30 bg-red-400/5 px-3 py-2 text-sm text-red-200" role="alert">{strategiesQuery.error.message}</p>}

        {activeTab === 'trades' && (
          tradesQuery.isLoading
            ? <div className="px-6 py-12 text-sm text-muted">Cargando el diario…</div>
            : tradesQuery.error && trades.length === 0
              ? <QueryError error={tradesQuery.error} onRetry={() => tradesQuery.refetch()} />
            : trades.length === 0
              ? <EmptyState onCreate={() => setDialog({ type: 'trade' })} type="trades" />
              : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] border-collapse text-left text-sm">
                    <thead className="font-mono text-[10px] uppercase tracking-wider text-muted">
                      <tr className="border-b border-line">
                        <th className="px-5 py-3 font-medium">Fecha</th>
                        <th className="px-5 py-3 font-medium">Activo</th>
                        <th className="px-5 py-3 font-medium">Dirección</th>
                        <th className="px-5 py-3 font-medium">Entrada / salida</th>
                        <th className="px-5 py-3 font-medium">Resultado R</th>
                        <th className="px-5 py-3 font-medium">Estrategia</th>
                        <th className="px-5 py-3 font-medium">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trades.map((trade) => (
                        <tr className="border-b border-line/70 last:border-0 hover:bg-raised/50" key={trade.id}>
                          <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-muted">{formatDate(trade.openedAt)}</td>
                          <td className="px-5 py-4 font-semibold text-copy">{trade.asset}</td>
                          <td className="px-5 py-4">
                            <span className={trade.side === 'long' ? 'text-accent' : 'text-copy'}>{trade.side === 'long' ? 'Largo' : 'Corto'}</span>
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-muted">
                            {formatPrice(trade.entryPrice)} <span className="text-line">/</span> {formatPrice(trade.exitPrice)}
                          </td>
                          <td className="px-5 py-4 font-mono text-xs text-copy">{trade.resultR == null ? '—' : `${trade.resultR}R`}</td>
                          <td className="max-w-44 truncate px-5 py-4 text-xs text-muted">
                            {strategies.find((strategy) => strategy.id === trade.strategyId)?.title || '—'}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4">
                            <button className="mr-3 text-xs text-muted hover:text-accent" onClick={() => setDialog({ type: 'trade', item: trade })} type="button">Editar</button>
                            <button className="text-xs text-muted hover:text-red-300" onClick={() => window.confirm('¿Eliminar esta operación del diario?') && deleteTrade.mutate(trade.id)} type="button">Eliminar</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
        )}

        {activeTab === 'strategies' && (
          strategiesQuery.isLoading
            ? <div className="px-6 py-12 text-sm text-muted">Cargando estrategias…</div>
            : strategiesQuery.error && strategies.length === 0
              ? <QueryError error={strategiesQuery.error} onRetry={() => strategiesQuery.refetch()} />
            : strategies.length === 0
              ? <EmptyState onCreate={() => setDialog({ type: 'strategy' })} type="strategies" />
              : (
                <div className="divide-y divide-line">
                  {strategies.map((strategy) => (
                    <article className="flex flex-wrap items-start justify-between gap-5 px-5 py-5 sm:px-6" key={strategy.id}>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-lg font-semibold text-copy">{strategy.title}</h3>
                          <span className="border border-line px-2 py-1 font-mono text-[10px] uppercase text-muted">{strategy.asset}</span>
                          <span className="border border-line px-2 py-1 font-mono text-[10px] text-muted">{strategy.timeframe}</span>
                          <span className="border border-accent/30 px-2 py-1 font-mono text-[10px] text-accent">PRIVADA</span>
                        </div>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{strategy.description}</p>
                        {strategy.rules && <p className="mt-3 whitespace-pre-wrap border-l border-line pl-3 text-xs leading-5 text-muted">{strategy.rules}</p>}
                      </div>
                      <div className="flex shrink-0 gap-3">
                        <button className="text-xs text-muted hover:text-accent" onClick={() => setDialog({ type: 'strategy', item: strategy })} type="button">Editar</button>
                        <button className="text-xs text-muted hover:text-red-300" onClick={() => window.confirm('¿Eliminar esta estrategia? Las operaciones vinculadas se conservarán sin estrategia.') && deleteStrategy.mutate(strategy.id)} type="button">Eliminar</button>
                      </div>
                    </article>
                  ))}
                </div>
              )
        )}
      </Panel>

      <footer className="flex flex-wrap justify-between gap-3 py-5 font-mono text-[10px] uppercase tracking-wider text-muted">
        <span>Datos personales · No se envían órdenes al mercado</span>
        <span>{currentUser?.email}</span>
      </footer>

      {dialog?.type === 'trade' && (
        <Dialog onClose={() => setDialog(null)} title={dialog.item ? 'Editar operación' : 'Registrar operación'}>
          <TradeForm
            error={saveTrade.error?.message}
            onCancel={() => setDialog(null)}
            onSave={(data) => saveTrade.mutate({ id: dialog.item?.id, data })}
            saving={saveTrade.isPending}
            strategies={strategies}
            trade={dialog.item}
          />
        </Dialog>
      )}
      {dialog?.type === 'strategy' && (
        <Dialog onClose={() => setDialog(null)} title={dialog.item ? 'Editar estrategia' : 'Crear estrategia'}>
          <StrategyForm
            error={saveStrategy.error?.message}
            onCancel={() => setDialog(null)}
            onSave={(data) => saveStrategy.mutate({ id: dialog.item?.id, data })}
            saving={saveStrategy.isPending}
            strategy={dialog.item}
          />
        </Dialog>
      )}
      {dialog?.type === 'profile' && (
        <Dialog onClose={() => setDialog(null)} title="Tu perfil">
          <ProfileForm
            error={profileMutation.error?.message}
            onCancel={() => setDialog(null)}
            onSave={(data) => profileMutation.mutate(data)}
            saving={profileMutation.isPending}
            user={currentUser}
          />
        </Dialog>
      )}
    </motion.main>
  )
}
