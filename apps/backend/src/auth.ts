import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import type { User, MemberRole } from '@prisma/client'
import prisma from './db'

const COOKIE_NAME = 'auth_token'
const JWT_SECRET = process.env.JWT_SECRET || 'dev'
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'none' as const,
  path: '/'
}

export function issueToken(res: Response, user: Pick<User, 'id' | 'email' | 'displayName'>) {
  const token = jwt.sign(
    { sub: user.id, email: user.email, name: user.displayName || null },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
  res.cookie(COOKIE_NAME, token, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 })
}

export function clearToken(res: Response) {
  res.clearCookie(COOKIE_NAME, { ...COOKIE_OPTIONS, maxAge: 0 })
}

export function getUserIdFromReq(req: Request): string | null {
  const token = (req as any).cookies?.[COOKIE_NAME]
  if (!token) return null
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any
    return decoded?.sub || null
  } catch {
    return null
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const uid = getUserIdFromReq(req)
  if (!uid) return res.status(401).json({ error: 'unauthorized' })
  ;(req as any).userId = uid
  next()
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const uid = getUserIdFromReq(req)
  if (uid) (req as any).userId = uid
  next()
}

/**
 * 檢查對專案的存取權限
 * @param minRole 最低要求的角色，若不傳則僅需為成員（或 owner）
 */
export function checkProjectAccess(minRole?: MemberRole) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).userId
    const projectId = req.params.id || req.body.projectId
    if (!userId || !projectId) return res.status(401).json({ error: 'unauthorized_or_no_project' })

    try {
      const project = await prisma.project.findUnique({ where: { id: projectId } })
      if (!project) return res.status(404).json({ error: 'project_not_found' })

      // 1. 若是 owner 直接放行
      if (project.ownerUserId === userId) return next()

      // 2. 實作權限繼承邏輯：檢查路徑中任何一個節點的成員資格
      // path 格式範例: /root-id/child-id/grandchild-id
      const pathIds = project.path.split('/').filter(Boolean)
      
      const memberships = await prisma.projectMembership.findMany({
        where: {
          userId,
          projectId: { in: pathIds }
        }
      })

      if (memberships.length === 0) {
        return res.status(403).json({ error: 'not_a_member', message: '您不是此專案或其父專案的成員' })
      }

      // 3. 檢查角色等級
      // 如果要求 MANAGER，則在繼承路徑中至少要有一個節點具有 MANAGER 身份
      if (minRole === 'MANAGER') {
        const isManager = memberships.some(m => m.role === 'MANAGER')
        if (!isManager) {
          return res.status(403).json({ error: 'manager_required', message: '需要管理員權限' })
        }
      }

      next()
    } catch (e) {
      console.error('Access check failed:', e)
      res.status(500).json({ error: 'access_check_failed' })
    }
  }
}
