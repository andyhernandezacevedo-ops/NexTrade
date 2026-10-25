import { useMutation } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'framer-motion'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { jsonBody, request } from '../api.js'
import { Button } from '../components/ui/Button.jsx'
import { FormField } from '../components/ui/FormField.jsx'
import { Eyebrow, Panel, StatusTag } from '../components/ui/Panel.jsx'
import { useSessionStore } from '../store.js'

export default function AuthPage({ mode }) {
  const isRegister = mode === 'register'
  const reduceMotion = useReducedMotion()
  const navigate = useNavigate()
  const location = useLocation()
  const token = useSessionStore((state) => state.token)
  const setSession = useSessionStore((state) => state.setSession)
  const mutation = useMutation({
    mutationFn: (data) => request(`/auth/${isRegister ? 'register' : 'login'}`, {
      method: 'POST',
      body: jsonBody(data),
    }),
    onSuccess: (session) => {
      setSession(session)
      navigate(location.state?.from || '/journal', { replace: true })
    },
  })

  if (token) return <Navigate to="/journal" replace />

  function submit(event) {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    mutation.mutate(values)
  }

  return (
    <motion.main
      className="mx-auto grid min-h-screen w-full max-w-[1200px] content-center gap-10 px-5 py-10 sm:px-10 lg:grid-cols-[1fr_0.85fr] lg:gap-20"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.25 }}
    >
      <section className="flex flex-col justify-center">
        <Link className="flex w-fit items-center gap-3" to="/">
          <span className="grid size-9 place-items-center border border-accent font-display text-lg font-bold text-accent">N</span>
          <span className="font-display text-lg font-semibold tracking-tight text-copy">NEXTRADE</span>
        </Link>
        <div className="mt-16 max-w-xl">
          <Eyebrow>Registro y análisis personal</Eyebrow>
          <h1 className="mt-5 font-display text-4xl font-medium tracking-[-0.05em] text-copy sm:text-6xl">
            {isRegister ? 'Empieza con método.' : 'Vuelve a tu diario.'}
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-muted">
            Tu espacio para llevar un registro honesto de tus decisiones y estrategias.
            NexTrade no ejecuta operaciones ni conecta cuentas de trading.
          </p>
        </div>
        <div className="mt-9">
          <StatusTag>Sin dinero real ni cuenta demo</StatusTag>
        </div>
      </section>

      <Panel className="w-full max-w-lg p-6 sm:p-8 lg:justify-self-end">
        <Eyebrow>{isRegister ? 'Nueva cuenta' : 'Acceso seguro'}</Eyebrow>
        <h2 className="mt-3 font-display text-2xl font-semibold text-copy">
          {isRegister ? 'Crea tu perfil' : 'Iniciar sesión'}
        </h2>

        <form className="mt-7 grid gap-5" onSubmit={submit}>
          {isRegister && (
            <FormField
              autoComplete="username"
              label="Nombre de usuario"
              maxLength={32}
              minLength={3}
              name="username"
              pattern="[A-Za-z0-9_]+"
              placeholder="tu_nombre"
              required
            />
          )}
          <FormField
            autoComplete="email"
            label="Correo electrónico"
            name="email"
            placeholder="tu@correo.com"
            required
            type="email"
          />
          <FormField
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            label="Contraseña"
            maxLength={72}
            minLength={isRegister ? 10 : 1}
            name="password"
            placeholder={isRegister ? 'Al menos 10 caracteres' : 'Tu contraseña'}
            required
            type="password"
          />

          {mutation.error && (
            <p className="whitespace-pre-line border border-red-400/30 bg-red-400/5 px-3 py-2 text-sm text-red-200" role="alert">
              {mutation.error.message}
            </p>
          )}

          <Button className="mt-1 w-full" disabled={mutation.isPending} type="submit">
            {mutation.isPending ? 'Procesando…' : isRegister ? 'Crear cuenta' : 'Entrar al diario'}
          </Button>
        </form>

        <p className="mt-6 border-t border-line pt-5 text-sm text-muted">
          {isRegister ? '¿Ya tienes cuenta?' : '¿Primera vez en NexTrade?'}{' '}
          <Link className="font-semibold text-accent hover:underline" to={isRegister ? '/login' : '/register'}>
            {isRegister ? 'Inicia sesión' : 'Crea tu cuenta'}
          </Link>
        </p>
      </Panel>
    </motion.main>
  )
}
