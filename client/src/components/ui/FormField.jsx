const controlClass = 'mt-2 w-full border border-line bg-canvas px-3 py-2.5 text-sm text-copy outline-none transition placeholder:text-muted/60 focus:border-accent'

export function FormField({ label, className = '', id, as: Element = 'input', ...props }) {
  const fieldId = id || props.name
  return (
    <label className={`block text-xs font-medium text-muted ${className}`} htmlFor={fieldId}>
      {label}
      <Element className={controlClass} id={fieldId} {...props} />
    </label>
  )
}
