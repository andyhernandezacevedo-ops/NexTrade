import { motion, useReducedMotion } from 'framer-motion'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Eyebrow, Panel, StatusTag } from './components/ui/Panel.jsx'
import AuthPage from './pages/AuthPage.jsx'
import JournalPage from './pages/JournalPage.jsx'
import { useSessionStore } from './store.js'

const foundations = [
  { number: '01', title: 'Diario', description: 'Registra y revisa tus operaciones.' },
  { number: '02', title: 'Laboratorio', description: 'Prueba reglas con datos históricos.' },
  { number: '03', title: 'Comunidad', description: 'Contrasta ideas y estrategias.' },
]

function FoundationPage() {
  const reduceMotion = useReducedMotion()
  const token = useSessionStore((state) => state.token)

  return (
    <motion.main
      className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-5 py-6 sm:px-10 lg:px-16"
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.35, ease: 'easeOut' }}
    >
      <header className="flex items-center justify-between border-b border-line pb-5">
        <Link className="flex items-center gap-3" to="/" aria-label="NexTrade inicio">
          <span className="grid size-9 place-items-center border border-accent font-display text-lg font-bold text-accent">N</span>
          <span className="font-display text-lg font-semibold tracking-tight text-copy">NEXTRADE</span>
        </Link>
        <div className="flex items-center gap-3">
          <StatusTag>Sin ejecución de órdenes</StatusTag>
          <Link className="hidden text-sm text-muted transition hover:text-accent sm:block" to={token ? '/journal' : '/login'}>
            {token ? 'Mi diario' : 'Iniciar sesión'}
          </Link>
        </div>
      </header>

      <section className="grid flex-1 content-center gap-12 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20">
        <div className="max-w-3xl">
          <Eyebrow>Tu registro · Fase 1</Eyebrow>
          <h1 className="mt-6 font-display text-5xl font-medium leading-[1.04] tracking-[-0.055em] text-copy sm:text-7xl">
            El método
            <br />
            <span className="text-accent">antes que</span> el mercado.
          </h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-muted sm:text-lg">
            Registra operaciones, documenta tus estrategias y revisa tu proceso con calma.
            NexTrade no ejecuta órdenes, no conecta cuentas y no mueve dinero.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link
              className="inline-flex min-h-10 items-center justify-center border border-accent bg-accent px-4 py-2 text-sm font-semibold text-canvas transition-colors hover:bg-transparent hover:text-accent"
              to={token ? '/journal' : '/register'}
            >
              {token ? 'Abrir mi diario' : 'Crear cuenta'}
            </Link>
            {!token && <Link className="text-sm font-medium text-muted hover:text-copy" to="/login">Ya tengo cuenta</Link>}
          </div>
        </div>

        <Panel className="self-center p-6 sm:p-8">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <Eyebrow>Enfoque de producto</Eyebrow>
            <span className="font-mono text-[10px] text-accent">SOLO ANÁLISIS</span>
          </div>
          <div className="divide-y divide-line">
            {foundations.map(({ number, title, description }) => (
              <div className="grid grid-cols-[2rem_1fr] gap-3 py-5" key={number}>
                <span className="pt-0.5 font-mono text-xs text-accent">{number}</span>
                <div>
                  <h2 className="font-display text-base font-semibold text-copy">{title}</h2>
                  <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="border-t border-line pt-4 font-mono text-[10px] uppercase tracking-wider text-muted">
            Sin trading real ni cuenta demo.
          </p>
        </Panel>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 font-mono text-[10px] uppercase tracking-wider text-muted">
        <span>Datos primero. Decisiones tuyas.</span>
        <span>NexTrade · Análisis personal</span>
      </footer>
    </motion.main>
  )
}

function ProtectedJournal() {
  const token = useSessionStore((state) => state.token)
  const location = useLocation()
  if (!token) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <JournalPage />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<FoundationPage />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/journal" element={<ProtectedJournal />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
