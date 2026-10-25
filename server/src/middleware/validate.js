export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({
        error: 'Revisa los datos introducidos.',
        details: result.error.issues.map(({ path, message }) => ({ field: path.join('.'), message })),
      })
    }
    req.body = result.data
    return next()
  }
}
