export function notFound(req, res) {
  res.status(404).json({ error: 'No se encontró el recurso solicitado.' })
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error)
  console.error(error)
  return res.status(500).json({ error: 'Ocurrió un error inesperado en el servidor.' })
}
