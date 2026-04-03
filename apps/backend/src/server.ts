import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import type { Request, Response } from 'express'
import { z } from 'zod'
import prisma from './db'
import cookieParser from 'cookie-parser'
import { OAuth2Client } from 'google-auth-library'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { issueToken, clearToken, requireAuth, optionalAuth, checkProjectAccess } from './auth'
import { execSync } from 'child_process'
import multer from 'multer'
import path from 'path'
import fs from 'fs'

// 輔助函數：記錄活動日誌
async function recordAudit(
  actorUserId: string,
  actionType: string,
  entityType: string,
  entityId: string,
  projectId?: string,
  payload?: any
) {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId,
        actionType,
        entityType,
        entityId,
        projectId,
        payload: payload || {}
      }
    })
  } catch (e) {
    console.error('Failed to record audit log:', e)
  }
}

// 資料庫同步邏輯已移至部署流程中，避免啟動時重複執行
const app = express()

// 確保 uploads 目錄存在
const UPLOADS_DIR = path.join(process.cwd(), 'uploads')
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR)
}

// 設定靜態檔案服務
app.use('/uploads', express.static(UPLOADS_DIR))

// Multer 設定
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR)
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  }
})
const upload = multer({ storage })

app.use(express.json())
app.disable('x-powered-by')
app.use(cookieParser())

// 偵錯日誌：記錄所有請求與 Origin
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Origin: ${req.get('origin') || 'N/A'}`)
  next()
})

const allowOrigin = process.env.APP_BASE_URL || '*'
const allowList = allowOrigin === '*' ? '*' : allowOrigin.split(',').map(s => s.trim()).filter(Boolean)

app.use(cors({
  origin: (origin, cb) => {
    // 如果沒有 origin (例如同源或某些工具)，允許
    if (!origin) return cb(null, true)
    
    // 如果 allowList 是 '*'，在有 credentials 的情況下必須回傳請求的 origin 而不能是 '*'
    if (allowList === '*') return cb(null, true)
    
    if (Array.isArray(allowList) && allowList.includes(origin)) return cb(null, true)
    
    console.warn(`CORS blocked for origin: ${origin}. AllowList: ${allowList}`)
    return cb(new Error('CORS blocked'), false)
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
    if (!clientId) {
      console.error('GOOGLE_CLIENT_ID is not set in environment variables!')
      return res.status(500).json({ error: 'server_misconfigured', message: 'Missing GOOGLE_CLIENT_ID' })
    }
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
    console.error('Google Auth Error:', e.message)
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
    if ((existing as any)?.passwordHash) return res.status(409).json({ error: 'email_taken' })
    const passwordHash = bcrypt.hashSync(parsed.data.password, 10)
    
    // 使用 upsert 來處理註冊，確保原子性並解決唯一索引衝突問題
    const user = await prisma.user.upsert({
      where: { email },
      update: { 
        passwordHash, 
        displayName: parsed.data.displayName ?? undefined 
      },
      create: { 
        email, 
        passwordHash, 
        displayName: parsed.data.displayName ?? email 
      }
    })

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
    if (!user || !(user as any)?.passwordHash) return res.status(401).json({ error: 'invalid_credentials' })
    const ok = bcrypt.compareSync(parsed.data.password, (user as any).passwordHash)
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' })
    issueToken(res, { id: user!.id, email: user!.email, displayName: user!.displayName || null })
    res.json({ user: { id: user!.id, email: user!.email, displayName: user!.displayName } })
  } catch (e: any) {
    res.status(500).json({ error: 'login_failed', message: e?.message ?? 'unknown' })
  }
})

app.post('/auth/logout', (_req: Request, res: Response) => {
  clearToken(res)
  res.json({ ok: true })
})

app.get('/auth/invitations', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as string
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return res.status(404).json({ error: 'user_not_found' })

    const invites = await prisma.projectInvitation.findMany({
      where: { 
        inviteeEmail: user.email.toLowerCase(), 
        status: { in: ['PENDING', 'REJECTED', 'CANCELLED'] } 
      },
      include: { 
        project: { select: { id: true, name: true, description: true } },
        inviter: { select: { displayName: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    res.json(invites)
  } catch (e: any) {
    res.status(500).json({ error: 'get_auth_invites_failed' })
  }
})

app.get('/auth/me', optionalAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as string | undefined
  if (!userId) return res.json({ user: null })
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return res.json({ user: null })
  
  // 順便檢查是否有屬於該 Email 的待處理邀請
  const pendingCount = await prisma.projectInvitation.count({
    where: { inviteeEmail: user.email.toLowerCase(), status: 'PENDING' }
  })

  res.json({ 
    user: { id: user.id, email: user.email, displayName: user.displayName },
    pendingInvitations: pendingCount
  })
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
        const currentUserId = (req as any).userId as string | undefined
        if (!owner?.email) return currentUserId ?? null
        const email = owner.email.toLowerCase()
        const displayName = owner.displayName ?? email
        const u = await prisma.user.upsert({
          where: { email },
          update: {},
          create: { email, displayName }
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

    await recordAudit(userId, 'PROJECT_CREATE', 'Project', created.id, created.id, { name: created.name })
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

app.post('/projects/:id/children', requireAuth, checkProjectAccess('MANAGER'), async (req: Request, res: Response) => {
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

    await recordAudit(userId, 'SUBPROJECT_CREATE', 'Project', created.id, created.id, { 
      name: created.name, 
      parentId: created.parentId 
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
app.get('/projects/search', requireAuth, async (req: Request, res: Response) => {
  const q = (req.query.q as string) || ''
  const limit = Math.min(Number(req.query.limit || 20), 100)
  const userId = (req as any).userId as string

  try {
    const rows = await prisma.project.findMany({
      where: {
        AND: [
          q ? { name: { contains: q, mode: 'insensitive' } } : {},
          {
            OR: [
              { ownerUserId: userId },
              { memberships: { some: { userId } } }
            ]
          }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, name: true, parentId: true, path: true, createdAt: true, status: true, description: true }
    })
    res.json(rows)
  } catch (e: any) {
    res.status(500).json({ error: 'search_failed' })
  }
})

app.get('/projects/recent', requireAuth, async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit || 20), 100)
  const userId = (req as any).userId as string

  try {
    const rows = await prisma.project.findMany({
      where: {
        OR: [
          { ownerUserId: userId },
          { memberships: { some: { userId } } }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, name: true, parentId: true, path: true, createdAt: true, status: true, description: true }
    })
    res.json(rows)
  } catch (e: any) {
    res.status(500).json({ error: 'recent_failed' })
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

app.patch('/projects/:id', requireAuth, checkProjectAccess('MANAGER'), async (req: Request, res: Response) => {
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
app.post('/projects/:id/archive', requireAuth, checkProjectAccess('MANAGER'), async (req: Request, res: Response) => {
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

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['VIEWER', 'MANAGER']).default('VIEWER')
})

const CreateLogSchema = z.object({
  type: z.enum(['ENGINEERING', 'EXPENSE', 'INCOME', 'REPORT', 'COMPLETION']),
  title: z.string().min(1),
  content: z.string(),
  amount: z.number().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  attachments: z.array(z.object({ name: z.string(), url: z.string() })).optional().nullable()
})

app.get('/projects/:id/members', requireAuth, checkProjectAccess(), async (req: Request, res: Response) => {
  const { id: projectId } = req.params
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        owner: { select: { id: true, email: true, displayName: true, avatarUrl: true } },
        memberships: {
          include: { user: { select: { id: true, email: true, displayName: true, avatarUrl: true } } }
        }
      }
    })
    if (!project) return res.status(404).json({ error: 'not_found' })
    
    const members = [
      { user: project.owner, role: 'OWNER', joinedAt: project.createdAt },
      ...project.memberships.map(m => ({ user: m.user, role: m.role, joinedAt: m.joinedAt }))
    ]
    res.json(members)
  } catch (e: any) {
    res.status(500).json({ error: 'members_failed' })
  }
})

app.get('/projects/:id/invitations', requireAuth, checkProjectAccess('MANAGER'), async (req: Request, res: Response) => {
  const { id: projectId } = req.params
  try {
    const invites = await prisma.projectInvitation.findMany({
      where: { 
        projectId, 
        status: { in: ['PENDING', 'REJECTED', 'CANCELLED'] } 
      },
      include: { inviter: { select: { displayName: true, email: true } } },
      orderBy: { createdAt: 'desc' }
    })
    res.json(invites)
  } catch (e: any) {
    res.status(500).json({ error: 'invitations_failed' })
  }
})

app.post('/projects/:id/invitations', requireAuth, checkProjectAccess('MANAGER'), async (req: Request, res: Response) => {
  const { id: projectId } = req.params
  const userId = (req as any).userId as string
  const parsed = InviteSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() })
  const { email, role } = parsed.data

  try {
    // checkProjectAccess 已經檢查過專案存在與權限了
    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const invite = await prisma.projectInvitation.create({
      data: {
        projectId,
        inviteeEmail: email.toLowerCase(),
        role: role as any,
        inviterUserId: userId,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    })
    // 實戰中應寄信，測試階段直接回傳 token
    await recordAudit(userId, 'MEMBER_INVITE', 'ProjectInvitation', invite.id, projectId, { 
      inviteeEmail: email, 
      role 
    })
    res.json({ ...invite, token })
  } catch (e: any) {
    res.status(500).json({ error: 'invite_failed', message: e?.message ?? 'unknown' })
  }
})

app.get('/invitations/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const invite = await prisma.projectInvitation.findUnique({
      where: { id },
      include: { project: { select: { name: true } }, inviter: { select: { displayName: true, email: true } } }
    })
    if (!invite) return res.status(404).json({ error: 'not_found' })
    res.json(invite)
  } catch (e: any) {
    res.status(500).json({ error: 'get_invite_failed' })
  }
})

app.post('/invitations/:id/accept', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params
  const userId = (req as any).userId as string
  const token = req.body.token as string | undefined

  try {
    const invite = await prisma.projectInvitation.findUnique({ where: { id } })
    if (!invite || invite.status !== 'PENDING') return res.status(404).json({ error: 'invalid_invite' })
    if (invite.expiresAt < new Date()) return res.status(410).json({ error: 'expired' })

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return res.status(404).json({ error: 'user_not_found' })

    // 安全邏輯優化：
    // 1. 如果登入者的 Email 與受邀 Email 完全匹配，則不強制要求 Token (身分已驗證)
    // 2. 如果 Email 不匹配，則必須提供正確的 Token (身分未驗證)
    const emailMatches = user.email.toLowerCase() === invite.inviteeEmail.toLowerCase()
    
    if (!emailMatches) {
      if (!token) return res.status(400).json({ error: 'token_required', message: 'Email 不匹配，請輸入邀請 Token' })
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
      if (invite.tokenHash !== tokenHash) return res.status(401).json({ error: 'invalid_token' })
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.projectInvitation.update({ where: { id }, data: { status: 'ACCEPTED' } })
      return await tx.projectMembership.upsert({
        where: { projectId_userId: { projectId: invite.projectId, userId } },
        update: { role: invite.role },
        create: { projectId: invite.projectId, userId, role: invite.role }
      })
    })

    await recordAudit(userId, 'INVITE_ACCEPT', 'ProjectInvitation', id, invite.projectId)
    res.json({ ok: true, membership: result })
  } catch (e: any) {
    res.status(500).json({ error: 'accept_failed', message: e?.message ?? 'unknown' })
  }
})

app.post('/invitations/:id/reject', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params
  const userId = (req as any).userId as string

  try {
    const invite = await prisma.projectInvitation.findUnique({ where: { id } })
    if (!invite || invite.status !== 'PENDING') return res.status(404).json({ error: 'invalid_invite' })

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (user?.email.toLowerCase() !== invite.inviteeEmail.toLowerCase()) {
      return res.status(403).json({ error: 'forbidden', message: '只有受邀本人可以拒絕邀請' })
    }

    await prisma.projectInvitation.update({
      where: { id },
      data: { status: 'REJECTED' }
    })
    await recordAudit(userId, 'INVITE_REJECT', 'ProjectInvitation', id, invite.projectId)
    res.json({ ok: true })
  } catch (e: any) {
    res.status(500).json({ error: 'reject_failed' })
  }
})

app.post('/invitations/:id/cancel', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params
  const userId = (req as any).userId as string

  try {
    const invite = await prisma.projectInvitation.findUnique({ where: { id } })
    if (!invite || invite.status !== 'PENDING') return res.status(404).json({ error: 'invalid_invite' })

    // 檢查是否為邀請人，或專案擁有者
    const project = await prisma.project.findUnique({ where: { id: invite.projectId } })
    if (invite.inviterUserId !== userId && project?.ownerUserId !== userId) {
      return res.status(403).json({ error: 'forbidden', message: '只有邀請人或專案擁有者可以撤回邀請' })
    }

    await prisma.projectInvitation.update({
      where: { id },
      data: { status: 'CANCELLED' }
    })
    await recordAudit(userId, 'INVITE_CANCEL', 'ProjectInvitation', id, invite.projectId)
    res.json({ ok: true })
  } catch (e: any) {
    res.status(500).json({ error: 'cancel_failed' })
  }
})

// 刪除/隱藏邀請紀錄 (實務上通常是軟刪除)
app.delete('/invitations/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params
  const userId = (req as any).userId as string

  try {
    const invite = await prisma.projectInvitation.findUnique({ where: { id } })
    if (!invite) return res.status(404).json({ error: 'not_found' })

    const user = await prisma.user.findUnique({ where: { id: userId } })
    const project = await prisma.project.findUnique({ where: { id: invite.projectId } })

    // 只有受邀者本人 (如果是 rejected/accepted)、邀請者、或專案擁有者可以刪除
    const isInvitee = user?.email.toLowerCase() === invite.inviteeEmail.toLowerCase()
    const isInviter = invite.inviterUserId === userId
    const isOwner = project?.ownerUserId === userId

    if (!isInvitee && !isInviter && !isOwner) {
      return res.status(403).json({ error: 'forbidden' })
    }

    // 這裡我們直接從資料庫移除，或是您可以改成 update status: 'DELETED'
    await prisma.projectInvitation.delete({ where: { id } })
    res.json({ ok: true })
  } catch (e: any) {
    res.status(500).json({ error: 'delete_failed' })
  }
})

app.get('/projects/:id/logs', requireAuth, checkProjectAccess(), async (req: Request, res: Response) => {
  const { id: projectId } = req.params
  try {
    const logs = await prisma.projectLog.findMany({
      where: { projectId },
      include: { author: { select: { displayName: true, email: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' }
    })
    res.json(logs)
  } catch (e: any) {
    res.status(500).json({ error: 'get_logs_failed' })
  }
})

app.post('/projects/:id/logs', requireAuth, checkProjectAccess(), async (req: Request, res: Response) => {
  const { id: projectId } = req.params
  const userId = (req as any).userId as string
  const parsed = CreateLogSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() })

  try {
    const log = await prisma.projectLog.create({
      data: {
        projectId,
        userId,
        type: parsed.data.type as any,
        title: parsed.data.title,
        content: parsed.data.content,
        amount: parsed.data.amount,
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
        attachments: parsed.data.attachments as any
      }
    })
    await recordAudit(userId, 'LOG_CREATE', 'ProjectLog', log.id, projectId, { 
      type: log.type, 
      title: log.title,
      amount: log.amount 
    })
    res.json(log)
  } catch (e: any) {
    res.status(500).json({ error: 'create_log_failed', message: e.message })
  }
})

app.delete('/logs/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params
  const userId = (req as any).userId as string

  try {
    const log = await prisma.projectLog.findUnique({ where: { id } })
    if (!log) return res.status(404).json({ error: 'not_found' })

    // 只有作者本人或是專案 Manager 可以刪除
    const membership = await prisma.projectMembership.findUnique({
      where: { projectId_userId: { projectId: log.projectId, userId } }
    })
    const project = await prisma.project.findUnique({ where: { id: log.projectId } })

    if (log.userId !== userId && membership?.role !== 'MANAGER' && project?.ownerUserId !== userId) {
      return res.status(403).json({ error: 'forbidden' })
    }

    await prisma.projectLog.delete({ where: { id } })
    await recordAudit(userId, 'LOG_DELETE', 'ProjectLog', id, log.projectId, { title: log.title })
    res.json({ ok: true })
  } catch (e: any) {
    res.status(500).json({ error: 'delete_log_failed' })
  }
})

// 檔案上傳 API
app.post('/upload', requireAuth, upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'no_file' })
  
  // 回傳檔案資訊，供前端保存
  const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`
  res.json({
    name: req.file.originalname,
    url: url,
    filename: req.file.filename
  })
})

app.get('/projects/:id/audit-logs', requireAuth, checkProjectAccess(), async (req: Request, res: Response) => {
  const { id: projectId } = req.params
  try {
    const logs = await prisma.auditLog.findMany({
      where: { projectId },
      include: { actor: { select: { displayName: true, email: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50
    })
    res.json(logs)
  } catch (e: any) {
    res.status(500).json({ error: 'get_audit_logs_failed' })
  }
})

// 遞迴財務匯總：包含當前專案及其所有子專案的財務數據
app.get('/projects/:id/finance-recursive', requireAuth, checkProjectAccess(), async (req: Request, res: Response) => {
  const { id: projectId } = req.params
  try {
    const root = await prisma.project.findUnique({ where: { id: projectId } })
    if (!root) return res.status(404).json({ error: 'not_found' })

    // 取得所有子專案的 ID (包含自己)
    const projects = await prisma.project.findMany({
      where: { path: { startsWith: root.path } },
      select: { id: true }
    })
    const projectIds = projects.map(p => p.id)

    // 彙總日誌數據
    const summary = await prisma.projectLog.groupBy({
      by: ['type'],
      where: { projectId: { in: projectIds } },
      _sum: { amount: true }
    })

    const result = {
      INCOME: 0,
      EXPENSE: 0,
      ENGINEERING: 0,
      balance: 0
    }

    summary.forEach(s => {
      if (s.type === 'INCOME') result.INCOME = Number(s._sum.amount || 0)
      if (s.type === 'EXPENSE') result.EXPENSE = Number(s._sum.amount || 0)
      if (s.type === 'ENGINEERING') result.ENGINEERING = Number(s._sum.amount || 0)
    })

    result.balance = result.INCOME - result.EXPENSE

    res.json(result)
  } catch (e: any) {
    res.status(500).json({ error: 'finance_summary_failed' })
  }
})

app.delete('/projects/:id/members/:userId', requireAuth, checkProjectAccess('MANAGER'), async (req: Request, res: Response) => {
  const { id: projectId, userId: targetUserId } = req.params
  const currentUserId = (req as any).userId as string

  try {
    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) return res.status(404).json({ error: 'not_found' })

    // 不能移除擁有者
    if (project.ownerUserId === targetUserId) {
      return res.status(403).json({ error: 'forbidden', message: '不能移除專案擁有者' })
    }

    await prisma.projectMembership.delete({
      where: { projectId_userId: { projectId, userId: targetUserId } }
    })

    await recordAudit(currentUserId, 'MEMBER_REMOVE', 'User', targetUserId, projectId)
    res.json({ ok: true })
  } catch (e: any) {
    res.status(500).json({ error: 'remove_member_failed' })
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
