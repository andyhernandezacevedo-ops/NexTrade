import express from 'express'
import authRoutes from './routes/auth.js'
import communityRoutes from './routes/community.js'
import commentsRoutes from './routes/comments.js'
import labRoutes from './routes/lab.js'
import strategiesRoutes from './routes/strategies.js'
import tradesRoutes from './routes/trades.js'
import { errorHandler, notFound } from './middleware/errors.js'

const app = express()

app.disable('x-powered-by')
app.use(express.json({ limit: '1mb' }))
app.get('/api/health', (req, res) => res.json({ status: 'ok' }))
app.use('/api/auth', authRoutes)
app.use('/api/community', communityRoutes)
app.use('/api/lab', labRoutes)
app.use('/api/strategies', strategiesRoutes)
app.use('/api/strategies', commentsRoutes)
app.use('/api/trades', tradesRoutes)
app.use(notFound)
app.use(errorHandler)

export default app
