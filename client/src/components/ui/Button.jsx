const variants = {
  primary: 'border-accent bg-accent text-canvas hover:bg-transparent hover:text-accent',
  secondary: 'border-line bg-raised text-copy hover:border-accent/50 hover:text-accent',
  quiet: 'border-transparent bg-transparent text-muted hover:bg-raised hover:text-copy',
}

export function Button({ children, className = '', variant = 'primary', ...props }) {
  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center gap-2 border px-4 py-2 text-sm font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
