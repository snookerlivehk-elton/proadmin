import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import type { Request, Response } from 'express'
import { z } from 'zod'
import prisma from './db'
import cookieParser from 'cookie-parser'
import { OAuth2Client } from 'google-auth-library'
import bcrypt from 'bcryptjs'
import { issueToken, clearToken, requireAuth, optionalAuth } from './auth'

const app = express()
app.use(express.json())
app.disable('x-powered-by')
app.use(cookieParser())

const allowOrigin = process.env.APP_BASE_URL || '*'
const allowList = allowOrigin === '*' ? '*' : allowOrigin.split(',').map(s => s.trim()).filter(Boolean)
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true)
    if (allowList === '*' || (Array.isArray(allowList) && allowList.includes(origin))) return cb(null, true)
    return cb(new Error('CORS'), false)
  },
  credentials: true
}))

app.get('/healthz', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' })
})

const GoogleSchema = z.object({ credential: z.string().min(10) })
app.post('/auth/google', async (req: Request, res: Response) => {
  try {
    const parsed = GoogleSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'invalid_body' })
    const clientId = process.env.GOOGLE_CLIENT_ID
    if (!clientId) return res.status(500).json({ error: 'server_misconfigured' })
    const client = new OAuth2Client(clientId)
    const ticket = await client.verifyIdToken({ idToken: parsed.data.credential, audience: clientId })
    const payload: any = ticket.getPayload()
    if (!payload?.email) return res.status(400).json({ error: 'no_email' })
    const email = String(payload.email).toLowerCase()
    const googleId = String(payload.sub)
    const user = await prisma.user.upsert({
      where: { email },
      update: { googleId, displayName: payload.name || undefined, avatarUrl: payload.picture || undefined },
      create: { email, googleId, displayName: payload.name || undefined, avatarUrl: payload.picture || undefined }
    })
    issueToken(res, { id: user.id, email: user.email, displayName: user.displayName || null })
    res.json({ user: { id: user.id, email: user.email, displayName: user.displayName } })
  } catch (e: any) {
    res.status(401).json({ error: 'google_verify_failed', message: e?.message ?? 'unknown' })
  }
})

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().optional()
})
app.post('/auth/register', async (req: Request, res: Response) => {
  const parsed = RegisterSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() })
  const email = parsed.data.email.toLowerCase()
  try {
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing?.passwordHash) return res.status(409).json({ error: 'email_taken' })
    const passwordHash = bcrypt.hashSync(parsed.data.password, 10)
    const user = existing
      ? await prisma.user.update({ where: { id: existing.id }, data: { passwordHash, displayName: parsed.data.displayName ?? existing.displayName } })
      : await prisma.user.create({ data: { email, passwordHash, displayName: parsed.data.displayName ?? email } })
    issueToken(res, { id: user.id, email: user.email, displayName: user.displayName || null })
    res.json({ user: { id: user.id, email: user.email, displayName: user.displayName } })
  } catch (e: any) {
    res.status(500).json({ error: 'register_failed', message: e?.message ?? 'unknown' })
  }
})

const LoginSchema = z.object({ email: z.string().email(), password: z.string().min(6) })
app.post('/auth/login', async (req: Request, res: Response) => {
  const parsed = LoginSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body' })
  const email = parsed.data.email.toLowerCase()
  try {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user?.passwordHash) return res.status(401).json({ error: 'invalid_credentials' })
    const ok = bcrypt.compareSync(parsed.data.password, user.passwordHash)
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' })
    issueToken(res, { id: user.id, email: user.email, displayName: user.displayName || null })
    res.json({ user: { id: user.id, email: user.email, displayName: user.displayName } })
  } catch (e: any) {
    res.status(500).json({ error: 'login_failed', message: e?.message ?? 'unknown' })
  }
})

app.post('/auth/logout', (_req: Request, res: Response) => {
  clearToken(res)
  res.json({ ok: true })
})

app.get('/auth/me', optionalAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as string | undefined
  if (!userId) return res.json({ user: null })
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return res.json({ user: null })
  res.json({ user: { id: user.id, email: user.email, displayName: user.displayName } })
})

app.get('/debug/db', async (_req: Request, res: Response) => {
  try {
    const r = await prisma.$queryRaw`SELECT 1 as ok`
    res.json({ db: 'ok', result: r })
  } catch (e: any) {
    res.status(500).json({ db: 'error', message: e?.message ?? 'unknown' })
  }
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

app.post('/projects', requireAuth, async (req: Request, res: Response) => {
  console.log('POST /projects', { body: req.body })
  const parsed = CreateProjectSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() })
  }
  const { name, description, ownerUserId, owner } = parsed.data
  try {
    const userId =
      ownerUserId ??
      (await (async () => {
        if (!owner?.email && !(req as any).userId) return null
        if (!owner?.email && (req as any).userId) return (req as any).userId
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
    console.error('create_failed', e)
    res.status(500).json({ error: 'create_failed', message: e?.message ?? 'unknown' })
  }
})

const CreateChildSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  ownerUserId: z.string().uuid().optional()
})

app.post('/projects/:id/children', requireAuth, async (req: Request, res: Response) => {
  console.log('POST /projects/:id/children', { params: req.params, body: req.body })
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
    console.error('create_child_failed', e)
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

// --- Specific routes BEFORE /projects/:id to avoid being captured by the dynamic route ---
app.get('/projects/search', async (req: Request, res: Response) => {
  const q = (req.query.q as string) || ''
  const limit = Math.min(Number(req.query.limit || 20), 100)
  try {
    const rows = await prisma.project.findMany({
      where: q ? { name: { contains: q, mode: 'insensitive' } } : {},
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, name: true, parentId: true, path: true, createdAt: true }
    })
    res.json(rows)
  } catch (e: any) {
    res.status(500).json({ error: 'search_failed', message: e?.message ?? 'unknown' })
  }
})

app.get('/projects/recent', async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit || 20), 100)
  try {
    const rows = await prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, name: true, parentId: true, path: true, createdAt: true }
    })
    res.json(rows)
  } catch (e: any) {
    res.status(500).json({ error: 'recent_failed', message: e?.message ?? 'unknown' })
  }
})

app.get('/projects/:id/parent', async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const proj = await prisma.project.findUnique({ where: { id } })
    if (!proj) return res.status(404).json({ error: 'not_found' })
    if (!proj.parentId) return res.json({ parent: null })
    const parent = await prisma.project.findUnique({ where: { id: proj.parentId } })
    res.json({ parent })
  } catch (e: any) {
    res.status(500).json({ error: 'parent_failed', message: e?.message ?? 'unknown' })
  }
})
// --- End specific routes ---

app.get('/projects/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const proj = await prisma.project.findUnique({ where: { id } })
    if (!proj) return res.status(404).json({ error: 'not_found' })
    res.json(proj)
  } catch (e: any) {
    res.status(500).json({ error: 'get_failed', message: e?.message ?? 'unknown' })
  }
})

const UpdateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(['active', 'archived']).optional()
}).refine(v => Object.keys(v).length > 0, { message: 'no_fields' })

app.patch('/projects/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params
  const parsed = UpdateProjectSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() })
  }
  try {
    const exists = await prisma.project.findUnique({ where: { id } })
    if (!exists) return res.status(404).json({ error: 'not_found' })
    const updated = await prisma.project.update({ where: { id }, data: parsed.data })
    res.json(updated)
  } catch (e: any) {
    res.status(500).json({ error: 'update_failed', message: e?.message ?? 'unknown' })
  }
})

const ArchiveSchema = z.object({ archived: z.boolean() })
app.post('/projects/:id/archive', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params
  const parsed = ArchiveSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() })
  }
  try {
    const exists = await prisma.project.findUnique({ where: { id } })
    if (!exists) return res.status(404).json({ error: 'not_found' })
    const status = parsed.data.archived ? 'archived' : 'active'
    const updated = await prisma.project.update({ where: { id }, data: { status } })
    res.json(updated)
  } catch (e: any) {
    res.status(500).json({ error: 'archive_failed', message: e?.message ?? 'unknown' })
  }
})

app.get('/projects/search', async (req: Request, res: Response) => {
  const q = (req.query.q as string) || ''
  const limit = Math.min(Number(req.query.limit || 20), 100)
  try {
    const rows = await prisma.project.findMany({
      where: q ? { name: { contains: q, mode: 'insensitive' } } : {},
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, name: true, parentId: true, path: true, createdAt: true }
    })
    res.json(rows)
  } catch (e: any) {
    res.status(500).json({ error: 'search_failed', message: e?.message ?? 'unknown' })
  }
})

app.get('/projects/recent', async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit || 20), 100)
  try {
    const rows = await prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, name: true, parentId: true, path: true, createdAt: true }
    })
    res.json(rows)
  } catch (e: any) {
    res.status(500).json({ error: 'recent_failed', message: e?.message ?? 'unknown' })
  }
})

app.get('/projects/:id/parent', async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const proj = await prisma.project.findUnique({ where: { id } })
    if (!proj) return res.status(404).json({ error: 'not_found' })
    if (!proj.parentId) return res.json({ parent: null })
    const parent = await prisma.project.findUnique({ where: { id: proj.parentId } })
    res.json({ parent })
  } catch (e: any) {
    res.status(500).json({ error: 'parent_failed', message: e?.message ?? 'unknown' })
  }
})

app.get('/', (_req: Request, res: Response) => {
  res.status(200).send('hp-collab backend online. Check /healthz')
})

const port = Number(process.env.PORT || 3000)
app.listen(port, () => {
  process.stdout.write(`backend listening on :${port}\n`)
})

process.on('unhandledRejection', (reason) => {
  console.error('unhandledRejection', reason)
})
process.on('uncaughtException', (err) => {
  console.error('uncaughtException', err)
})
