import 'dotenv/config'
import express from 'express'
import cors from 'cors'

const app = express()
app.use(express.json())

const allowOrigin = process.env.APP_BASE_URL || '*'
app.use(
  cors({
    origin: allowOrigin === '*' ? true : allowOrigin,
    credentials: true
  })
)

app.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok' })
})

app.get('/projects/:id/tree', (_req, res) => {
  res.json({
    id: 'sample-root',
    name: 'Root Project',
    children: [{ id: 'child-1', name: 'Child Project', children: [] }]
  })
})

const port = Number(process.env.PORT || 3000)
app.listen(port, () => {
  process.stdout.write(`backend listening on :${port}\n`)
})
