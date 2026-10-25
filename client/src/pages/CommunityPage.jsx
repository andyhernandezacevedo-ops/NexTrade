import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'framer-motion'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { jsonBody, request } from '../api.js'
import { Button } from '../components/ui/Button.jsx'
import { FormField } from '../components/ui/FormField.jsx'
import { Eyebrow, Panel, StatusTag } from '../components/ui/Panel.jsx'
import { useSessionStore } from '../store.js'

function metric(value, suffix = '') {
  return value == null ? '—' : `${value}${suffix}`
}

function PostComposer({ strategies, onCancel, onPublish, busy, error }) {
  const [kind, setKind] = useState('idea')

  function submit(event) {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    onPublish({
      kind,
      title: values.title,
      content: values.content,
      strategyId: kind === 'strategy' ? values.strategyId : null,
    })
  }

  return (
    <form className="grid gap-4 border-t border-line pt-5" onSubmit={submit}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>Nueva publicación</Eyebrow>
          <h2 className="mt-1 font-display text-lg font-semibold text-copy">Comparte una idea o estrategia</h2>
        </div>
        <label className="block text-xs font-medium text-muted">
          Tipo
          <select className="mt-2 min-w-40 border border-line bg-canvas px-3 py-2.5 text-sm text-copy outline-none focus:border-accent" name="kind" onChange={(event) => setKind(event.target.value)} value={kind}>
            <option value="idea">Idea de mercado</option>
            <option value="strategy">Estrategia del diario</option>
          </select>
        </label>
      </div>
      {kind === 'strategy' && (
        strategies.length
          ? <label className="block text-xs font-medium text-muted">
            Estrategia propia
            <select className="mt-2 w-full border border-line bg-canvas px-3 py-2.5 text-sm text-copy outline-none focus:border-accent" name="strategyId" required defaultValue="">
              <option disabled value="">Selecciona una estrategia para compartir</option>
              {strategies.map((strategy) => <option key={strategy.id} value={strategy.id}>{strategy.title} · {strategy.asset}</option>)}
            </select>
          </label>
          : <p className="border border-line px-3 py-2 text-xs text-muted">Crea primero una estrategia en tu diario para poder publicarla.</p>
      )}
      <FormField label="Título" maxLength={160} minLength={3} name="title" placeholder="Contexto y tesis de mercado" required />
      <FormField as="textarea" label="Descripción" maxLength={10000} minLength={10} name="content" placeholder="Explica el contexto, hipótesis y riesgos. No incluyas datos personales." required rows={4} />
      {kind === 'strategy' && strategies.length === 0 && (
        <Link className="text-sm text-accent hover:underline" to="/journal">Ir al diario a crear una estrategia</Link>
      )}
      <p className="text-xs leading-5 text-muted">
        Las métricas se calculan desde el registro de operaciones cerradas del autor. No introduzcas resultados manualmente.
      </p>
      {error && <p className="whitespace-pre-line border border-red-400/30 bg-red-400/5 px-3 py-2 text-sm text-red-200" role="alert">{error}</p>}
      <div className="flex justify-end gap-3">
        <Button onClick={onCancel} type="button" variant="quiet">Cancelar</Button>
        <Button disabled={busy || (kind === 'strategy' && strategies.length === 0)} type="submit">{busy ? 'Publicando…' : 'Publicar'}</Button>
      </div>
    </form>
  )
}

function PostCard({ post, token, onVote, onCopy, voteBusy, copyBusy }) {
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [commentError, setCommentError] = useState('')
  const queryClient = useQueryClient()
  const commentsQuery = useQuery({
    queryKey: ['community', 'comments', post.id],
    queryFn: async () => (await request(`/community/posts/${post.id}/comments`)).comments,
    enabled: commentsOpen,
  })
  const commentMutation = useMutation({
    mutationFn: (content) => request(`/community/posts/${post.id}/comments`, {
      method: 'POST',
      body: jsonBody({ content }),
    }),
    onSuccess: async () => {
      setCommentError('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['community', 'comments', post.id] }),
        queryClient.invalidateQueries({ queryKey: ['community', 'feed'] }),
      ])
    },
    onError: (error) => setCommentError(error.message),
  })

  function submitComment(event) {
    event.preventDefault()
    const form = event.currentTarget
    const content = new FormData(form).get('content')
    commentMutation.mutate(content)
    form.reset()
  }

  return (
    <Panel className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusTag>{post.kind === 'strategy' ? 'Estrategia' : 'Idea'}</StatusTag>
            {post.strategy && <span className="font-mono text-[10px] uppercase tracking-wider text-muted">{post.strategy.asset} · {post.strategy.timeframe}</span>}
          </div>
          <h2 className="mt-3 font-display text-xl font-semibold text-copy">{post.title}</h2>
          <p className="mt-1 text-xs text-muted">por @{post.username} · {new Date(post.publishedAt).toLocaleDateString('es')}</p>
        </div>
      </div>
      <p className="whitespace-pre-wrap py-5 text-sm leading-6 text-copy">{post.content}</p>

      {post.strategy && (
        <div className="mb-5 border-l-2 border-accent px-4 py-3">
          <p className="font-medium text-copy">{post.strategy.title}</p>
          <p className="mt-1 text-xs leading-5 text-muted">{post.strategy.description}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-6">
        <div className="bg-canvas px-3 py-3 sm:col-span-2">
          <Eyebrow>{post.strategy ? 'Operaciones · estrategia' : 'Operaciones · autor'}</Eyebrow>
          <p className="mt-1 font-mono text-lg text-copy">{post.metrics?.closedTrades ?? 0}</p>
        </div>
        <div className="bg-canvas px-3 py-3">
          <Eyebrow>Winrate</Eyebrow>
          <p className="mt-1 font-mono text-lg text-accent">{metric(post.metrics?.winrate, '%')}</p>
        </div>
        <div className="bg-canvas px-3 py-3">
          <Eyebrow>Factor</Eyebrow>
          <p className="mt-1 font-mono text-lg text-copy">{metric(post.metrics?.profitFactor)}</p>
        </div>
        <div className="bg-canvas px-3 py-3">
          <Eyebrow>Retorno R</Eyebrow>
          <p className="mt-1 font-mono text-lg text-copy">{metric(post.metrics?.cumulativeR)}</p>
        </div>
        <div className="bg-canvas px-3 py-3">
          <Eyebrow>DD máx. R</Eyebrow>
          <p className="mt-1 font-mono text-lg text-copy">{metric(post.metrics?.maxDrawdownR)}</p>
        </div>
      </div>
      <p className="mt-2 text-[10px] leading-4 text-muted">Métricas de operaciones cerradas del registro. Resultados en R; no son importes ni rentabilidad monetaria.</p>

      <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
        {token
          ? <>
            <Button disabled={voteBusy} onClick={() => onVote(post.id, 1)} type="button" variant="secondary">↑ {post.voteCount}</Button>
            <Button disabled={voteBusy} onClick={() => onVote(post.id, -1)} type="button" variant="quiet">↓</Button>
          </>
          : <Link className="inline-flex min-h-10 items-center border border-line px-4 py-2 text-sm text-muted hover:border-accent/50 hover:text-accent" to="/login">↑ Votar · {post.voteCount}</Link>}
        <Button onClick={() => setCommentsOpen((value) => !value)} type="button" variant="quiet">
          {commentsOpen ? 'Ocultar comentarios' : `Comentarios · ${post.commentCount}`}
        </Button>
        {post.strategy && (token
          ? <Button disabled={copyBusy} onClick={() => onCopy(post.strategy.id)} type="button" variant="secondary">{copyBusy ? 'Copiando…' : 'Copiar al diario'}</Button>
          : <Link className="inline-flex min-h-10 items-center border border-line px-4 py-2 text-sm text-muted hover:border-accent/50 hover:text-accent" to="/login">Copiar al diario</Link>)}
      </div>

      {commentsOpen && (
        <div className="mt-4 border-t border-line pt-4">
          {commentsQuery.error && <p className="text-sm text-red-200" role="alert">{commentsQuery.error.message}</p>}
          {commentsQuery.isLoading && <p className="text-xs text-muted">Cargando comentarios…</p>}
          <div className="grid gap-3">
            {commentsQuery.data?.map((comment) => (
              <article className="border-l border-line pl-3" key={comment.id}>
                <p className="text-xs text-copy">{comment.content}</p>
                <p className="mt-1 font-mono text-[10px] text-muted">@{comment.username} · {new Date(comment.createdAt).toLocaleDateString('es')}</p>
              </article>
            ))}
          </div>
          {token
            ? <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={submitComment}>
              <FormField label="Añadir comentario" maxLength={2000} minLength={1} name="content" placeholder="Aporta contexto con respeto" required />
              <Button className="self-end" disabled={commentMutation.isPending} type="submit" variant="secondary">{commentMutation.isPending ? 'Enviando…' : 'Comentar'}</Button>
            </form>
            : <Link className="mt-4 inline-block text-sm text-accent hover:underline" to="/login">Inicia sesión para comentar</Link>}
          {commentError && <p className="mt-2 text-sm text-red-200" role="alert">{commentError}</p>}
        </div>
      )}
    </Panel>
  )
}

export default function CommunityPage() {
  const [filter, setFilter] = useState('')
  const [composing, setComposing] = useState(false)
  const [notice, setNotice] = useState('')
  const reduceMotion = useReducedMotion()
  const token = useSessionStore((state) => state.token)
  const user = useSessionStore((state) => state.user)
  const queryClient = useQueryClient()
  const feedQuery = useQuery({
    queryKey: ['community', 'feed', filter],
    queryFn: async () => (await request(`/community/feed${filter ? `?kind=${filter}` : ''}`)).posts,
  })
  const strategiesQuery = useQuery({
    queryKey: ['strategies', 'mine'],
    queryFn: async () => (await request('/strategies/mine')).strategies,
    enabled: Boolean(token) && composing,
  })
  const publishMutation = useMutation({
    mutationFn: (data) => request('/community/posts', { method: 'POST', body: jsonBody(data) }),
    onSuccess: async () => {
      setComposing(false)
      setNotice('Publicación enviada a moderación. Aparecerá en el feed cuando sea aprobada.')
      await queryClient.invalidateQueries({ queryKey: ['community', 'feed'] })
    },
  })
  const voteMutation = useMutation({
    mutationFn: ({ postId, value }) => request(`/community/posts/${postId}/vote`, {
      method: 'POST',
      body: jsonBody({ value }),
    }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['community', 'feed'] }),
  })
  const copyMutation = useMutation({
    mutationFn: (strategyId) => request(`/strategies/${strategyId}/copy`, { method: 'POST' }),
    onSuccess: () => {
      setNotice('Estrategia copiada a tu diario privado.')
      queryClient.invalidateQueries({ queryKey: ['strategies', 'mine'] })
    },
    onError: (error) => setNotice(error.message),
  })
  const error = publishMutation.error || strategiesQuery.error

  return (
    <motion.main
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto min-h-screen max-w-[1200px] px-4 py-5 sm:px-8 lg:px-12"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      transition={{ duration: reduceMotion ? 0 : 0.25 }}
    >
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
        <div className="flex items-center gap-8">
          <Link className="flex items-center gap-3" to="/">
            <span className="grid size-9 place-items-center border border-accent font-display text-lg font-bold text-accent">N</span>
            <span className="font-display text-lg font-semibold tracking-tight text-copy">NEXTRADE</span>
          </Link>
          <nav aria-label="Navegación principal" className="flex gap-4 text-sm">
            <Link className="text-muted transition hover:text-accent" to="/journal">Diario</Link>
            <Link className="text-muted transition hover:text-accent" to="/lab">Laboratorio</Link>
            <span aria-current="page" className="text-accent">Comunidad</span>
            {(user?.role === 'admin' || user?.role === 'moderator') && <Link className="text-muted transition hover:text-accent" to="/admin">Administración</Link>}
          </nav>
        </div>
        {token
          ? <Button onClick={() => setComposing((value) => !value)} type="button">{composing ? 'Cerrar formulario' : 'Nueva publicación'}</Button>
          : <Link className="border border-accent px-4 py-2 text-sm text-accent hover:bg-accent hover:text-canvas" to="/login">Iniciar sesión para publicar</Link>}
      </header>

      <section className="py-8">
        <Eyebrow>Ideas abiertas · Métricas verificables</Eyebrow>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.04em] text-copy sm:text-4xl">
          Comunidad <span className="text-accent">NexTrade.</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Comparte ideas o estrategias y conversa con otros miembros. Las métricas se obtienen del diario del autor en el servidor; no se introducen a mano.
        </p>
      </section>

      <Panel className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Eyebrow>Publicaciones públicas</Eyebrow>
            <p className="mt-1 text-xs text-muted">Las ideas muestran el historial cerrado del autor; las estrategias, el historial asociado a esa estrategia.</p>
          </div>
          <div aria-label="Filtrar publicaciones" className="flex gap-1" role="group">
            {[['', 'Todas'], ['strategy', 'Estrategias'], ['idea', 'Ideas']].map(([value, label]) => (
              <button className={`border px-3 py-2 text-xs transition ${filter === value ? 'border-accent text-accent' : 'border-line text-muted hover:text-copy'}`} key={value} onClick={() => setFilter(value)} type="button">{label}</button>
            ))}
          </div>
        </div>
        {composing && (
          <div className="mt-5">
            <PostComposer
              busy={publishMutation.isPending}
              error={error?.message}
              onCancel={() => setComposing(false)}
              onPublish={(data) => publishMutation.mutate(data)}
              strategies={strategiesQuery.data || []}
            />
          </div>
        )}
      </Panel>

      {notice && <p className={`mt-4 border px-4 py-3 text-sm ${copyMutation.isError ? 'border-red-400/30 text-red-200' : 'border-accent/30 text-accent'}`} role={copyMutation.isError ? 'alert' : 'status'}>{notice}</p>}
      {voteMutation.error && <p className="mt-4 border border-red-400/30 px-4 py-3 text-sm text-red-200" role="alert">{voteMutation.error.message}</p>}
      {feedQuery.error && <p className="mt-4 border border-red-400/30 px-4 py-3 text-sm text-red-200" role="alert">{feedQuery.error.message}</p>}
      {feedQuery.isLoading && <p className="py-10 text-center text-sm text-muted">Cargando el feed…</p>}
      {!feedQuery.isLoading && feedQuery.data?.length === 0 && (
        <Panel className="mt-5 grid min-h-48 place-items-center p-6 text-center">
          <div><Eyebrow>Aún no hay publicaciones</Eyebrow><p className="mt-2 text-sm text-muted">Sé la primera persona en compartir una idea o estrategia.</p></div>
        </Panel>
      )}
      <div className="mt-5 grid gap-4">
        {feedQuery.data?.map((post) => (
          <PostCard
            copyBusy={copyMutation.isPending}
            key={post.id}
            onCopy={(strategyId) => copyMutation.mutate(strategyId)}
            onVote={(postId, value) => voteMutation.mutate({ postId, value })}
            post={post}
            token={token}
            voteBusy={voteMutation.isPending}
          />
        ))}
      </div>
      <footer className="py-6 text-center text-[10px] uppercase tracking-wider text-muted">
        Análisis público en unidades R · No es asesoramiento financiero ni ejecución de operaciones
      </footer>
    </motion.main>
  )
}
