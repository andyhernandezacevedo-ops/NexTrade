export function Panel({ children, className = '', as: Element = 'section', ...props }) {
  return (
    <Element className={`border border-line bg-panel ${className}`} {...props}>
      {children}
    </Element>
  )
}

export function Eyebrow({ children, className = '' }) {
  return (
    <p className={`font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-muted ${className}`}>
      {children}
    </p>
  )
}

export function StatusTag({ children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 border border-line px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted ${className}`}>
      <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
      {children}
    </span>
  )
}
