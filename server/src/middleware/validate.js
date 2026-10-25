export function validate(schema, property = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[property])
    if (!result.success) {
      return res.status(400).json({
        error: 'Revisa los datos introducidos.',
        details: result.error.issues.map(({ path, message }) => ({ field: path.join('.'), message })),
      })
    }
    req[property] = result.data
    return next()
  }
}
