import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'framer-motion'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { jsonBody, request } from '../api.js'
import { Button } from '../components/ui/Button.jsx'
import { Eyebrow, Panel, StatusTag } from '../components/ui/Panel.jsx'
import { useSessionStore } from '../store.js'

const moderationFilters = [
  ['pending', 'Pendientes'],
  ['approved', 'Aprobadas'],
  ['rejected', 'Rechazadas'],
]

function ModerationQueue({ status, onStatusChange }) {
  const queryClient = useQueryClient()
  const queueQuery = useQuery({
    queryKey: ['admin', 'posts', status],
    queryFn: async () => (await request(`/admin/posts?status=${status}`)).posts,
  })
  const moderationMutation = useMutation({
    mutationFn: ({ postId, nextStatus }) => request(`/admin/posts/${postId}`, {
      method: 'PATCH',
      body: jsonBody({ status: nextStatus }),
    }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'posts'] }),
        queryClient.invalidateQueries({ queryKey: ['community', 'feed'] }),
        queryClient.invalidateQueries({ queryKey: ['strategies'] }),
      ])
    },
  })

  return (
    <Panel className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <Eyebrow>Cola de contenido</Eyebrow>
          <h2 className="mt-1 font-display text-lg font-semibold text-copy">Moderación de publicaciones</h2>
        </div>
        <label className="text-xs text-muted">
          Estado
          <select className="ml-2 border border-line bg-canvas px-3 py-2 text-copy" onChange={(event) => onStatusChange(event.target.value)} value={status}>
            {moderationFilters.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      {queueQuery.error && <p className="mt-4 border border-red-400/30 px-3 py-2 text-sm text-red-200" role="alert">{queueQuery.error.message}</p>}
      {moderationMutation.error && <p className="mt-4 border border-red-400/30 px-3 py-2 text-sm text-red-200" role="alert">{moderationMutation.error.message}</p>}
      {queueQuery.isLoading && <p className="py-8 text-sm text-muted">Cargando publicaciones…</p>}
      {!queueQuery.isLoading && queueQuery.data?.length === 0 && <p className="py-8 text-sm text-muted">No hay publicaciones con este estado.</p>}
      <div className="mt-4 grid gap-3">
        {queueQuery.data?.map((post) => (
          <article className="border border-line p-4" key={post.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusTag>{post.kind === 'strategy' ? 'Estrategia' : 'Idea'}</StatusTag>
                  <span className="text-xs text-muted">@{post.username} · {new Date(post.createdAt).toLocaleString('es')}</span>
                </div>
                <h3 className="mt-2 font-display text-lg font-semibold text-copy">{post.title}</h3>
                {post.strategyTitle && <p className="mt-1 text-xs text-accent">{post.strategyTitle} · {post.asset} · {post.timeframe}</p>}
              </div>
              <span className="font-mono text-[10px] uppercase text-muted">{post.status}</span>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">{post.content}</p>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
              {post.status !== 'approved' && <Button disabled={moderationMutation.isPending} onClick={() => moderationMutation.mutate({ postId: post.id, nextStatus: 'approved' })} type="button">Aprobar y publicar</Button>}
              {post.status !== 'rejected' && <Button disabled={moderationMutation.isPending} onClick={() => moderationMutation.mutate({ postId: post.id, nextStatus: 'rejected' })} type="button" variant="secondary">Rechazar</Button>}
            </div>
          </article>
        ))}
      </div>
    </Panel>
  )
}

function UserManagement({ search, setSearch, status, setStatus }) {
  const queryClient = useQueryClient()
  const usersQuery = useQuery({
    queryKey: ['admin', 'users', status, search],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      if (search.trim()) params.set('search', search.trim())
      return (await request(`/admin/users?${params}`)).users
    },
  })
  const statusMutation = useMutation({
    mutationFn: ({ userId, nextStatus }) => request(`/admin/users/${userId}/status`, {
      method: 'PATCH',
      body: jsonBody({ status: nextStatus }),
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })

  return (
    <Panel className="p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
        <div>
          <Eyebrow>Acceso y cuentas</Eyebrow>
          <h2 className="mt-1 font-display text-lg font-semibold text-copy">Gestión de usuarios</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-muted">
            Buscar nombre
            <input className="mt-2 block border border-line bg-canvas px-3 py-2 text-sm text-copy" maxLength={64} onChange={(event) => setSearch(event.target.value)} value={search} />
          </label>
          <label className="text-xs text-muted">
            Estado
            <select className="mt-2 block border border-line bg-canvas px-3 py-2 text-sm text-copy" onChange={(event) => setStatus(event.target.value)} value={status}>
              <option value="">Todos</option>
              <option value="active">Activas</option>
              <option value="suspended">Suspendidas</option>
            </select>
          </label>
        </div>
      </div>
      {usersQuery.error && <p className="mt-4 border border-red-400/30 px-3 py-2 text-sm text-red-200" role="alert">{usersQuery.error.message}</p>}
      {statusMutation.error && <p className="mt-4 border border-red-400/30 px-3 py-2 text-sm text-red-200" role="alert">{statusMutation.error.message}</p>}
      {usersQuery.isLoading && <p className="py-8 text-sm text-muted">Cargando cuentas…</p>}
      {!usersQuery.isLoading && usersQuery.data?.length === 0 && <p className="py-8 text-sm text-muted">No hay cuentas con estos filtros.</p>}
      {usersQuery.data?.length > 0 && (
        <div className="mt-4 overflow-x-auto border border-line">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="font-mono text-[10px] uppercase text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-3 font-medium">Usuario</th>
                <th className="px-4 py-3 font-medium">Correo</th>
                <th className="px-4 py-3 font-medium">Rol</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Acción</th>
              </tr>
            </thead>
            <tbody>
              {usersQuery.data.map((user) => (
                <tr className="border-b border-line/70 last:border-0" key={user.id}>
                  <td className="px-4 py-3 text-copy">@{user.username}</td>
                  <td className="px-4 py-3 text-muted">{user.email}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">{user.role}</td>
                  <td className={`px-4 py-3 text-xs ${user.status === 'active' ? 'text-accent' : 'text-red-200'}`}>{user.status === 'active' ? 'Activa' : 'Suspendida'}</td>
                  <td className="px-4 py-3 text-right">
                    {user.role === 'admin'
                      ? <span className="text-xs text-muted">Protegida</span>
                      : <Button disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ userId: user.id, nextStatus: user.status === 'active' ? 'suspended' : 'active' })} type="button" variant="secondary">
                        {user.status === 'active' ? 'Suspender' : 'Reactivar'}
                      </Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs leading-5 text-muted">Se muestran como máximo 100 cuentas. Las cuentas de administrador no se pueden suspender desde esta pantalla.</p>
    </Panel>
  )
}

export default function AdminPage() {
  const [section, setSection] = useState('posts')
  const [postStatus, setPostStatus] = useState('pending')
  const [userStatus, setUserStatus] = useState('')
  const [search, setSearch] = useState('')
  const reduceMotion = useReducedMotion()
  const token = useSessionStore((state) => state.token)
  const sessionUser = useSessionStore((state) => state.user)
  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: async () => (await request('/auth/me')).user,
    enabled: Boolean(token),
  })
  const user = profileQuery.data
  const isModerator = user?.role === 'moderator' || user?.role === 'admin'

  return (
    <motion.main
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto min-h-screen max-w-[1440px] px-4 py-5 sm:px-8 lg:px-12"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      transition={{ duration: reduceMotion ? 0 : 0.25 }}
    >
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
        <div className="flex items-center gap-6">
          <Link className="flex items-center gap-3" to="/">
            <span className="grid size-9 place-items-center border border-accent font-display text-lg font-bold text-accent">N</span>
            <span className="font-display text-lg font-semibold tracking-tight text-copy">NEXTRADE</span>
          </Link>
          <nav aria-label="Navegación" className="flex gap-4 text-sm">
            <Link className="text-muted hover:text-accent" to="/community">Comunidad</Link>
            <span aria-current="page" className="text-accent">Administración</span>
          </nav>
        </div>
        <StatusTag>{user?.role || sessionUser?.role || 'Verificando acceso'}</StatusTag>
      </header>

      <section className="py-8">
        <Eyebrow>Operación segura · Acceso restringido</Eyebrow>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.04em] text-copy sm:text-4xl">
          Administración <span className="text-accent">NexTrade.</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Modera contenido público y controla el estado de las cuentas, sin acceso a contraseñas ni datos privados de trading.</p>
      </section>

      {(profileQuery.isLoading || profileQuery.isFetching) && <Panel className="p-5 text-sm text-muted">Verificando permisos…</Panel>}
      {profileQuery.error && <Panel className="p-5 text-sm text-red-200" role="alert">{profileQuery.error.message}</Panel>}
      {!profileQuery.isFetching && !profileQuery.error && !isModerator && (
        <Panel className="p-6">
          <Eyebrow>Acceso denegado</Eyebrow>
          <p className="mt-2 text-sm text-muted">Tu cuenta no tiene permisos de moderación. Contacta a un administrador si necesitas acceso.</p>
        </Panel>
      )}
      {!profileQuery.isFetching && isModerator && (
        <>
          <div className="mb-5 flex flex-wrap gap-2 border-b border-line" role="tablist" aria-label="Herramientas de administración">
            <button aria-selected={section === 'posts'} className={`border-b-2 px-4 py-3 text-sm ${section === 'posts' ? 'border-accent text-accent' : 'border-transparent text-muted'}`} onClick={() => setSection('posts')} role="tab" type="button">Moderación</button>
            {user?.role === 'admin' && <button aria-selected={section === 'users'} className={`border-b-2 px-4 py-3 text-sm ${section === 'users' ? 'border-accent text-accent' : 'border-transparent text-muted'}`} onClick={() => setSection('users')} role="tab" type="button">Usuarios</button>}
          </div>
          {section === 'posts'
            ? <ModerationQueue onStatusChange={setPostStatus} status={postStatus} />
            : user?.role === 'admin' && <UserManagement search={search} setSearch={setSearch} setStatus={setUserStatus} status={userStatus} />}
        </>
      )}
      <footer className="py-6 text-center text-[10px] uppercase tracking-wider text-muted">Las acciones administrativas quedan asociadas a la cuenta moderadora.</footer>
    </motion.main>
  )
}
