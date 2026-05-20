import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { AuthProvider } from '@/components/layout/auth-provider'
import { ThemeProvider } from '@/components/layout/ThemeProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'PRM Care — Seguimento Farmacoterapêutico',
    template: '%s | PRM Care',
  },
  description:
    'Plataforma SaaS para identificação, análise e orientação sobre Problemas Relacionados aos Medicamentos baseada no Método Dáder.',
  keywords: ['farmácia clínica', 'PRM', 'seguimento farmacoterapêutico', 'Método Dáder', 'atenção farmacêutica'],
  authors: [{ name: 'PRM Care' }],
  openGraph: {
    title: 'PRM Care',
    description: 'Plataforma de seguimento farmacoterapêutico baseada no Método Dáder',
    type: 'website',
    locale: 'pt_BR',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
