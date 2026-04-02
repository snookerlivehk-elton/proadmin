import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import type { Request, Response } from 'express'
import { z } from 'zod'
import prisma from './db'

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

const CreateProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  ownerUserId: z.string().uuid().optional(),
  owner: z
    .object({
      email: z.string().email(),
      displayName: z.string().optional()
    })
    .optional()
})

app.post('/projects', async (req: Request, res: Response) => {
  const parsed = CreateProjectSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() })
  }
  const { name, description, ownerUserId, owner } = parsed.data
  try {
    const userId =
      ownerUserId ??
      (await (async () => {
        if (!owner?.email) return null
        const email = owner.email.toLowerCase()
        const u = await prisma.user.upsert({
          where: { email },
          update: {},
          create: { email, displayName: owner.displayName ?? email }
        })
        return u.id
      })())

    if (!userId) {
      return res.status(400).json({ error: 'owner_required', message: 'ownerUserId 或 owner.email 其一必填' })
    }

    const created = await prisma.$transaction(async (tx) => {
      const p = await tx.project.create({
        data: {
          name,
          description,
          ownerUserId: userId,
          status: 'active',
          // 先留空，待取得 id 後更新 path
          path: ''
        }
      })
      const updated = await tx.project.update({
        where: { id: p.id },
        data: { path: `/${p.id}` }
      })
      return updated
    })
    res.status(201).json(created)
  } catch (e: any) {
    res.status(500).json({ error: 'create_failed', message: e?.message ?? 'unknown' })
  }
})

const CreateChildSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  ownerUserId: z.string().uuid().optional()
})

app.post('/projects/:id/children', async (req: Request, res: Response) => {
  const parsed = CreateChildSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() })
  }
  const { id: parentId } = req.params
  const { name, description, ownerUserId } = parsed.data
  try {
    const parent = await prisma.project.findUnique({ where: { id: parentId } })
    if (!parent) return res.status(404).json({ error: 'not_found', message: 'parent project not found' })
    const userId = ownerUserId ?? parent.ownerUserId

    const created = await prisma.$transaction(async (tx) => {
      const p = await tx.project.create({
        data: {
          parentId: parent.id,
          name,
          description,
          ownerUserId: userId,
          status: 'active',
          path: ''
        }
      })
      const updated = await tx.project.update({
        where: { id: p.id },
        data: { path: `${parent.path}/${p.id}` }
      })
      return updated
    })
    res.status(201).json(created)
  } catch (e: any) {
    res.status(500).json({ error: 'create_child_failed', message: e?.message ?? 'unknown' })
  }
})

app.get('/projects/:id/tree', async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const root = await prisma.project.findUnique({ where: { id } })
    if (!root) return res.status(404).json({ error: 'not_found' })
    const nodes = await prisma.project.findMany({
      where: { path: { startsWith: root.path } },
      orderBy: { path: 'asc' }
    })
    const byId: Record<string, any> = {}
    nodes.forEach((n) => {
      byId[n.id] = { id: n.id, name: n.name, description: n.description ?? null, parentId: n.parentId, children: [] as any[] }
    })
    const treeRoot = byId[root.id]
    nodes.forEach((n) => {
      if (n.parentId) {
        const parent = byId[n.parentId]
        if (parent) parent.children.push(byId[n.id])
      }
    })
    res.json(treeRoot)
  } catch (e: any) {
    res.status(500).json({ error: 'tree_failed', message: e?.message ?? 'unknown' })
  }
})

app.get('/', (_req: Request, res: Response) => {
  res.status(200).send('hp-collab backend online. Check /healthz')
})

const port = Number(process.env.PORT || 3000)
app.listen(port, () => {
  process.stdout.write(`backend listening on :${port}\n`)
})
