'use client'
import { Suspense, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Pill, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, Shield, Users, FileText, Activity } from 'lucide-react'

const loginSchema = z.object({
  email: z.string().min(1, 'CPF ou e-mail obrigatório'),
  password: z.string().min(1, 'Senha obrigatória'),
})
type LoginForm = z.infer<typeof loginSchema>

const STATS = [
  { icon: Activity, label: 'PRMs identificados', value: '12.000+' },
  { icon: Users, label: 'Farmacêuticos', value: '850+' },
  { icon: Shield, label: 'Instituições', value: '40+' },
  { icon: FileText, label: 'Relatórios gerados', value: '5.200+' },
]

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const callbackUrl = params.get('callbackUrl') || '/dashboard'
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginForm) {
    setIsLoading(true)
    setError('')
    const result = await signIn('credentials', {
      email: data.email.toLowerCase().trim(),
      password: data.password,
      redirect: false,
    })
    setIsLoading(false)
    if (result?.error) {
      setError('E-mail/CPF ou senha incorretos. Verifique seus dados e tente novamente.')
      return
    }
    router.push(callbackUrl)
    router.refresh()
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12 bg-gray-50">
      <div className="w-full max-w-sm">

        {/* Mobile logo */}
        <div className="flex lg:hidden flex-col items-center gap-3 mb-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1e3a5f] shadow-lg">
            <Pill className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-[#1e3a5f]">PRM Care</span>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Bem-vindo de volta</h1>
            <p className="mt-1.5 text-sm text-gray-500">
              Não tem conta?{' '}
              <Link href="/register" className="font-semibold text-[#1e3a5f] hover:text-[#162d4a] transition-colors">
                Criar conta gratuita
              </Link>
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700 mb-6">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {params.get('registered') && (
            <div className="flex items-start gap-3 rounded-xl border border-green-100 bg-green-50 p-4 text-sm text-green-700 mb-6">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>Conta criada com sucesso! Faça login para continuar.</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">CPF ou E-mail</label>
              <input
                {...register('email')}
                type="text"
                autoComplete="username"
                className={`w-full rounded-xl border px-4 py-3 text-sm bg-gray-50 focus:bg-white transition-colors focus:border-[#1e3a5f] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/15 ${
                  errors.email ? 'border-red-300 bg-red-50' : 'border-gray-200'
                }`}
                placeholder="CPF (apenas números) ou e-mail"
              />
              {errors.email && <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.email.message}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-700">Senha</label>
                <Link href="/forgot-password" className="text-xs text-[#1e3a5f] hover:text-[#162d4a] font-medium transition-colors">
                  Esqueci minha senha
                </Link>
              </div>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className={`w-full rounded-xl border px-4 py-3 pr-11 text-sm bg-gray-50 focus:bg-white transition-colors focus:border-[#1e3a5f] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/15 ${
                    errors.password ? 'border-red-300 bg-red-50' : 'border-gray-200'
                  }`}
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
              {errors.password && <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1e3a5f] py-3.5 text-sm font-semibold text-white hover:bg-[#162d4a] disabled:opacity-60 transition-all duration-200 shadow-sm hover:shadow-md mt-2"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isLoading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Ao entrar, você concorda com nossos{' '}
          <Link href="/terms" className="underline underline-offset-2 hover:text-gray-600 transition-colors">Termos de Uso</Link>
          {' '}e{' '}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-gray-600 transition-colors">Política de Privacidade</Link>.
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen">

      {/* ── Left panel ─────────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] flex-col relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #0f2644 0%, #1e3a5f 50%, #1a4d7a 100%)' }}>

        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Large circle top-right */}
          <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-[0.06]"
            style={{ background: 'radial-gradient(circle, #ffffff 0%, transparent 70%)' }} />
          {/* Medium circle bottom-left */}
          <div className="absolute -bottom-24 -left-24 w-[350px] h-[350px] rounded-full opacity-[0.06]"
            style={{ background: 'radial-gradient(circle, #ffffff 0%, transparent 70%)' }} />
          {/* Grid dots */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="dots" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.5" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)" />
          </svg>
        </div>

        {/* Content */}
        <div className="relative flex flex-col h-full p-12">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm border border-white/20">
              <Pill className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold text-white tracking-tight">PRM Care</span>
              <div className="text-[10px] text-blue-300/80 font-medium tracking-widest uppercase mt-px">Atenção Farmacêutica</div>
            </div>
          </div>

          {/* Main content - centered vertically */}
          <div className="flex-1 flex flex-col justify-center gap-10">

            {/* Headline */}
            <div>
              <h2 className="text-4xl font-bold text-white leading-tight tracking-tight mb-4">
                Seguimento<br />
                <span className="text-blue-300">farmacoterapêutico</span><br />
                de excelência
              </h2>
              <p className="text-blue-200/80 text-sm leading-relaxed max-w-xs">
                Plataforma clínica para identificação, prevenção e resolução de Problemas Relacionados a Medicamentos.
              </p>
            </div>

            {/* Quote */}
            <div className="border-l-2 border-blue-400/40 pl-5">
              <p className="text-blue-100/90 text-sm italic leading-relaxed">
                "O seguimento farmacoterapêutico tem como objetivo identificar, prevenir e resolver problemas relacionados aos medicamentos."
              </p>
              <p className="mt-2 text-xs text-blue-400/70 font-medium">— Método Dáder</p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              {STATS.map(({ icon: Icon, label, value }) => (
                <div key={label}
                  className="rounded-xl bg-white/[0.07] border border-white/10 p-4 backdrop-blur-sm hover:bg-white/[0.10] transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="h-3.5 w-3.5 text-blue-300/80" />
                    <span className="text-[11px] text-blue-300/70 font-medium">{label}</span>
                  </div>
                  <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom badge */}
          <div className="flex items-center gap-2 mt-8">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[10px] text-blue-400/60 font-medium tracking-wider uppercase px-2">
              Seguro · Confiável · Eficiente
            </span>
            <div className="h-px flex-1 bg-white/10" />
          </div>
        </div>
      </div>

      {/* ── Right panel ─────────────────────────────────────────────────────── */}
      <Suspense fallback={
        <div className="flex flex-1 items-center justify-center bg-gray-50">
          <Loader2 className="h-8 w-8 animate-spin text-[#1e3a5f]" />
        </div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  )
}
