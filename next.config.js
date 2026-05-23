/** @type {import('next').NextConfig} */

// Content Security Policy — permite apenas origens necessárias
const CSP = [
  "default-src 'self'",
  // Scripts: apenas do próprio domínio + Next.js inline necessário
  "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
  // Estilos: permite inline (necessário para Tailwind em SSR)
  "style-src 'self' 'unsafe-inline'",
  // Imagens: próprio domínio + data URIs (avatars base64) + domínios externos de avatar
  "img-src 'self' data: blob: https://avatars.githubusercontent.com https://lh3.googleusercontent.com",
  // Fontes
  "font-src 'self' data:",
  // Conexões: próprio domínio + APIs externas usadas pelo backend (não expostas ao browser diretamente)
  "connect-src 'self'",
  // Frames: nenhum (proteção contra clickjacking reforçada)
  "frame-src 'none'",
  // Objetos: nenhum (previne Flash etc.)
  "object-src 'none'",
  // Base URI: apenas próprio domínio
  "base-uri 'self'",
  // Form action: apenas próprio domínio
  "form-action 'self'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', '@react-pdf/renderer'],
  },
  // remotePatterns é mais seguro que domains (depreciado) — permite especificar protocol e pathname
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com', pathname: '/**' },
    ],
  },
  async headers() {
    return [
      {
        // Aplicar headers em todas as rotas
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

module.exports = nextConfig
