/**
 * Centralised audit logging helper.
 * Never throws — audit failures must not block the main request.
 */
import prisma from './prisma'

export type AuditAction =
  | 'LOGIN' | 'LOGOUT' | 'REGISTER'
  | 'PATIENT_VIEW' | 'PATIENT_CREATE' | 'PATIENT_UPDATE' | 'PATIENT_DELETE'
  | 'ANALYSIS_CREATE' | 'ANALYSIS_VIEW'
  | 'REPORT_VIEW' | 'REPORT_GENERATE' | 'REPORT_DOWNLOAD'
  | 'EXPORT_PATIENTS' | 'EXPORT_PRMS'
  | 'CONSENT_GIVEN' | 'CONSENT_REVOKED'
  | 'PASSWORD_CHANGE' | 'PROFILE_UPDATE'
  | 'DATA_PORTABILITY_REQUEST' | 'DATA_DELETION_REQUEST'
  | 'TOKEN_PURCHASE'

export async function logAudit(params: {
  userId?: string | null
  action: AuditAction | string
  resource: string
  resourceId?: string
  details?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId:     params.userId ?? null,
        action:     params.action,
        resource:   params.resource,
        resourceId: params.resourceId,
        details:    params.details ?? {},
        ipAddress:  params.ipAddress,
        userAgent:  params.userAgent,
      },
    })
  } catch (err) {
    // Log to console but never propagate — audit failure ≠ request failure
    console.warn('[AUDIT] Failed to write log:', params.action, params.resource, err)
  }
}

/** Extract IP from Next.js request headers */
export function getClientIp(req: Request | { headers: Headers }): string {
  const h = req.headers
  return (
    (h.get ? h.get('x-forwarded-for') : (h as any)['x-forwarded-for']) ??
    (h.get ? h.get('x-real-ip')       : (h as any)['x-real-ip'])       ??
    'unknown'
  )
}
