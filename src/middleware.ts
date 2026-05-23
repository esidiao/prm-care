import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'

// Helper to get client IP from Next.js edge request
function getIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

export default withAuth(
  function middleware(req) {
    const token    = req.nextauth.token
    const pathname = req.nextUrl.pathname
    const ip       = getIp(req)
    const isApi    = pathname.startsWith('/api/')

    // ── Rate limiting ───────────────────────────────────────────────────────────

    // Auth endpoints (login / register)
    if (pathname.startsWith('/api/auth') || pathname === '/api/auth/register') {
      const rl = rateLimit(`auth:${ip}`, { limit: 15, windowSecs: 60 })
      if (!rl.success) {
        return new NextResponse(
          JSON.stringify({ error: 'Muitas tentativas. Tente novamente em instantes.' }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
            },
          }
        )
      }
    }

    // Analysis endpoint (IA + token consumption)
    if (pathname === '/api/analysis' && req.method === 'POST') {
      const userId = token?.id as string ?? ip
      const rl = rateLimit(`analysis:${userId}`, { limit: 10, windowSecs: 60 })
      if (!rl.success) {
        return new NextResponse(
          JSON.stringify({ error: 'Limite de análises por minuto atingido. Aguarde um momento.' }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }

    // Export endpoints
    if (pathname.startsWith('/api/export')) {
      const userId = token?.id as string ?? ip
      const rl = rateLimit(`export:${userId}`, { limit: 5, windowSecs: 300 })
      if (!rl.success) {
        return new NextResponse(
          JSON.stringify({ error: 'Muitas exportações em pouco tempo. Aguarde 5 minutos.' }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }

    // ── Role-based access control ───────────────────────────────────────────────

    // Proteção dupla: frontend /admin/* E API /api/admin/*
    const isAdminRoute = pathname.startsWith('/admin') || pathname.startsWith('/api/admin')
    if (isAdminRoute) {
      if (token?.role !== 'ADMIN') {
        if (isApi) {
          return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
        }
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
    }

    if (pathname.startsWith('/manager')) {
      if (!['ADMIN', 'INSTITUTIONAL_MANAGER'].includes(token?.role as string)) {
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
    }

    // ── Security headers ────────────────────────────────────────────────────────
    const res = NextResponse.next()

    // Proteção contra clickjacking
    res.headers.set('X-Frame-Options', 'DENY')
    // Prevenir MIME-type sniffing
    res.headers.set('X-Content-Type-Options', 'nosniff')
    // Política de referrer segura
    res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    // Desabilitar acesso a câmera, microfone e geolocalização
    res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    // Força HTTPS por 2 anos em produção (HSTS)
    if (process.env.NODE_ENV === 'production') {
      res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
    }

    return res
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname
        if (
          pathname === '/' ||
          pathname === '/login' ||
          pathname === '/register' ||
          pathname === '/pricing' ||
          pathname === '/terms' ||
          pathname === '/privacy' ||
          pathname.startsWith('/api/auth') ||
          pathname === '/api/payments/webhook'  // Webhook do MP não precisa de autenticação de usuário
        ) return true
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|logo.svg|images/|.*\\.jpg$|.*\\.jpeg$|.*\\.png$|.*\\.webp$|.*\\.svg$|.*\\.gif$|.*\\.ico$).*)',
  ],
}
