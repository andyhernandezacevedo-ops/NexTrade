import multer from 'multer'

export function notFound(req, res) {
  res.status(404).json({ error: 'No se encontró el recurso solicitado.' })
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error)
  if (error instanceof multer.MulterError) {
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? 'El archivo CSV no puede superar 1 MB.'
      : error.message
    return res.status(400).json({ error: message })
  }
  if (error.message === 'Selecciona un archivo con extensión .csv.') {
    return res.status(400).json({ error: error.message })
  }
  console.error(error)
  return res.status(500).json({ error: 'Ocurrió un error inesperado en el servidor.' })
}
