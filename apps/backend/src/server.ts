import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import type { Request, Response } from 'express'

const app = express()
app.use(express.json())

const allowOrigin = process.env.APP_BASE_URL || '*'
app.use(
  cors({
    origin: allowOrigin === '*' ? true : allowOrigin,
    credentials: true
  })
)

app.get('/healthz', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' })
})

app.get('/projects/:id/tree', (_req: Request, res: Response) => {
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
