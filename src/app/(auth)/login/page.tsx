'use client'
import { Suspense, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Pill, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'

const loginSchema = z.object({
  email: z.string().min(1, 'CPF ou e-mail obrigatório'),
  password: z.string().min(1, 'Senha obrigatória'),
})
type LoginForm = z.infer<typeof loginSchema>

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
      setError('Email ou senha incorretos. Verifique seus dados e tente novamente.')
      return
    }
    router.push(callbackUrl)
    router.refresh()
  }

  return (
    <div className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
      <div className="w-full max-w-md space-y-8">
        {/* Mobile logo */}
        <div className="flex lg:hidden items-center gap-2 justify-center mb-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1e3a5f]">
            <Pill className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-[#1e3a5f]">PRM Care</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bem-vindo de volta</h1>
          <p className="mt-2 text-sm text-gray-500">
            Não tem conta?{' '}
            <Link href="/register" className="font-medium text-[#1e3a5f] hover:underline">
              Criar conta gratuita
            </Link>
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {params.get('registered') && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            Conta criada com sucesso! Faça login para continuar.
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CPF ou E-mail</label>
            <input
              {...register('email')}
              type="text"
              autoComplete="username"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-[#1e3a5f] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
              placeholder="CPF (apenas números) ou e-mail"
            />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Senha</label>
              <Link href="/forgot-password" className="text-xs text-[#1e3a5f] hover:underline">
                Esqueci minha senha
              </Link>
            </div>
            <div className="relative">
              <input
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 pr-11 text-sm focus:border-[#1e3a5f] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
          </div>

          <button type="submit" disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1e3a5f] py-3 text-sm font-semibold text-white hover:bg-[#162d4a] disabled:opacity-60 transition-colors">
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Entrar
          </button>
        </form>

        <p className="text-center text-xs text-gray-400">
          Ao entrar, você concorda com nossos{' '}
          <Link href="/terms" className="underline">Termos de Uso</Link> e{' '}
          <Link href="/privacy" className="underline">Política de Privacidade</Link>.
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-[#1e3a5f] p-12 text-white">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20">
            <Pill className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold">PRM Care</span>
        </div>
        <div>
          <blockquote className="text-lg italic text-blue-200">
            "O seguimento farmacoterapêutico é um serviço de atenção farmacêutica que tem como objetivo identificar,
            prevenir e resolver problemas relacionados aos medicamentos."
          </blockquote>
          <p className="mt-3 text-sm text-blue-300">— Método Dáder</p>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {[
            { label: 'PRMs identificados', value: '12.000+' },
            { label: 'Farmacêuticos', value: '850+' },
            { label: 'Instituições', value: '40+' },
            { label: 'Relatórios gerados', value: '5.200+' },
          ].map((s, i) => (
            <div key={i} className="rounded-lg bg-white/10 p-3">
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-blue-300">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel with Suspense for useSearchParams */}
      <Suspense fallback={
        <div className="flex w-full items-center justify-center lg:w-1/2">
          <Loader2 className="h-8 w-8 animate-spin text-[#1e3a5f]" />
        </div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  )
}
