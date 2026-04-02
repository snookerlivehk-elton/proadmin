import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import type { User } from '@prisma/client'

const COOKIE_NAME = 'auth_token'
const JWT_SECRET = process.env.JWT_SECRET || 'dev'
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
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
