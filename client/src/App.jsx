import { motion, useReducedMotion } from 'framer-motion'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { Button } from './components/ui/Button.jsx'
import { Eyebrow, Panel, StatusTag } from './components/ui/Panel.jsx'

const foundations = [
  { number: '01', title: 'Diario', description: 'Registra y revisa tus operaciones.' },
  { number: '02', title: 'Laboratorio', description: 'Prueba reglas con datos históricos.' },
  { number: '03', title: 'Comunidad', description: 'Contrasta ideas y estrategias.' },
]

function FoundationPage() {
  const reduceMotion = useReducedMotion()

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
        <StatusTag>Sin ejecución de órdenes</StatusTag>
      </header>

      <section className="grid flex-1 content-center gap-12 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20">
        <div className="max-w-3xl">
          <Eyebrow>Fundación · Fase 0</Eyebrow>
          <h1 className="mt-6 font-display text-5xl font-medium leading-[1.04] tracking-[-0.055em] text-copy sm:text-7xl">
            El método
            <br />
            <span className="text-accent">antes que</span> el mercado.
          </h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-muted sm:text-lg">
            Un espacio para registrar, analizar y compartir estrategias. NexTrade no opera,
            no conecta cuentas y no mueve dinero.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Button type="button" disabled>Construyendo la base</Button>
            <span className="font-mono text-xs text-muted">API · PostgreSQL · React</span>
          </div>
        </div>

        <Panel className="self-center p-6 sm:p-8">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <Eyebrow>Mapa de producto</Eyebrow>
            <span className="font-mono text-[10px] text-accent">0 / 5 FASES</span>
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
            Solo análisis. Sin trading real ni demo.
          </p>
        </Panel>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 font-mono text-[10px] uppercase tracking-wider text-muted">
        <span>Datos primero. Decisiones tuyas.</span>
        <span>NexTrade · Fundación del sistema</span>
      </footer>
    </motion.main>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<FoundationPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
