import jwt from 'jsonwebtoken'

export function requireAuth(req, res, next) {
  const authorization = req.get('authorization')
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null

  if (!token) {
    return res.status(401).json({ error: 'Debes iniciar sesión para continuar.' })
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET)
    return next()
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'La sesión no es válida o ha caducado.' })
    }
    return next(error)
  }
}
