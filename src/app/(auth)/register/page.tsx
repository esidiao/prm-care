'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Pill, Eye, EyeOff, Loader2, AlertCircle, CheckCircle, Info } from 'lucide-react'

const registerSchema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres')
    .regex(/[A-Z]/, 'Deve conter ao menos uma letra maiúscula')
    .regex(/[0-9]/, 'Deve conter ao menos um número'),
  confirmPassword: z.string(),
  role: z.enum(['PROFESSIONAL', 'STUDENT']),
  crfNumber: z.string().optional(),
  institution: z.string().optional(),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'Você deve aceitar os Termos de Uso' }) }),
  acceptPrivacy: z.literal(true, { errorMap: () => ({ message: 'Você deve aceitar a Política de Privacidade' }) }),
  acceptClinicalDisclaimer: z.literal(true, { errorMap: () => ({ message: 'Você deve aceitar o aviso clínico' }) }),
}).refine(d => d.password === d.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
})
type RegisterForm = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState(1) // 1: dados, 2: consentimento

  const { register, handleSubmit, watch, trigger, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'PROFESSIONAL' },
  })

  const role = watch('role')

  async function goToStep2() {
    const valid = await trigger(['name', 'email', 'password', 'confirmPassword', 'role'])
    if (valid) setStep(2)
  }

  async function onSubmit(data: RegisterForm) {
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          email: data.email.toLowerCase().trim(),
          password: data.password,
          role: data.role,
          crfNumber: data.crfNumber,
          institution: data.institution,
          consents: {
            terms: data.acceptTerms,
            privacy: data.acceptPrivacy,
            clinical: data.acceptClinicalDisclaimer,
          },
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Erro ao criar conta.')
      router.push('/login?registered=1')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-5/12 flex-col bg-gradient-to-br from-[#1e3a5f] to-[#2563eb] p-12 text-white">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20">
            <Pill className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold">PRM Care</span>
        </div>
        <div className="flex-1 flex flex-col justify-center space-y-6">
          <h2 className="text-3xl font-bold">Comece gratuitamente</h2>
          <p className="text-blue-200">2 análises demonstrativas incluídas. Sem cartão de crédito.</p>
          <ul className="space-y-3">
            {[
              'Identificação sistemática de PRMs',
              'Classificação por nível de risco',
              'Relatórios SOAP completos',
              'Base de conhecimento clínico',
              'Conformidade com LGPD',
              'Método Dáder validado',
            ].map((f, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <CheckCircle className="h-4 w-4 text-green-300 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-white/20 bg-white/10 p-4 text-sm text-blue-200">
          <strong className="text-white">Aviso:</strong> Esta ferramenta é de apoio técnico.
          Não substitui avaliação profissional habilitada.
        </div>
      </div>

      {/* Right panel */}
      <div className="flex w-full items-center justify-center px-6 py-12 lg:w-7/12">
        <div className="w-full max-w-lg space-y-8">
          <div className="flex lg:hidden items-center gap-2 justify-center mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1e3a5f]">
              <Pill className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-[#1e3a5f]">PRM Care</span>
          </div>

          {/* Progress */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl font-bold text-gray-900">
                {step === 1 ? 'Criar conta' : 'Consentimentos obrigatórios'}
              </h1>
              <span className="text-sm text-gray-400">Etapa {step}/2</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-gray-200">
              <div className="h-1.5 rounded-full bg-[#1e3a5f] transition-all" style={{ width: step === 1 ? '50%' : '100%' }} />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {step === 1 && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo</label>
                  <input {...register('name')} className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-[#1e3a5f] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20" placeholder="Dr. Maria Silva" />
                  {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email profissional</label>
                  <input {...register('email')} type="email" className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-[#1e3a5f] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20" placeholder="seu@email.com" />
                  {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Perfil de acesso</label>
                  <select {...register('role')} className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-[#1e3a5f] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20">
                    <option value="PROFESSIONAL">Farmacêutico / Profissional de Saúde</option>
                    <option value="STUDENT">Estudante (com supervisão)</option>
                  </select>
                  {role === 'STUDENT' && (
                    <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                      <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                      Análises de estudantes exigem supervisão de profissional habilitado. Relatórios gerados incluirão aviso obrigatório de não-finalidade clínica.
                    </div>
                  )}
                </div>

                {role === 'PROFESSIONAL' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nº CRF (opcional)</label>
                    <input {...register('crfNumber')} className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-[#1e3a5f] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20" placeholder="CRF/SP 00000" />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Instituição (opcional)</label>
                  <input {...register('institution')} className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-[#1e3a5f] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20" placeholder="Hospital / Clínica / Universidade" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                  <div className="relative">
                    <input {...register('password')} type={showPassword ? 'text' : 'password'} className="w-full rounded-lg border border-gray-300 px-4 py-3 pr-11 text-sm focus:border-[#1e3a5f] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20" placeholder="Mínimo 8 caracteres" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar senha</label>
                  <input {...register('confirmPassword')} type="password" className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-[#1e3a5f] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20" placeholder="Repita a senha" />
                  {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>}
                </div>

                <button type="button" onClick={goToStep2}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1e3a5f] py-3 text-sm font-semibold text-white hover:bg-[#162d4a] transition-colors">
                  Próximo — Consentimentos
                </button>
              </>
            )}

            {step === 2 && (
              <>
                <div className="space-y-4">
                  {/* Terms */}
                  <div className="rounded-xl border border-gray-200 p-4">
                    <div className="mb-3 text-sm font-semibold text-gray-900">Termos de Uso e Privacidade</div>
                    <div className="mb-4 h-32 overflow-y-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-600 space-y-2">
                      <p>O PRM Care é uma ferramenta de apoio técnico e educacional para identificação e análise de Problemas Relacionados a Medicamentos (PRM). Ao usar esta plataforma, você declara ser profissional de saúde habilitado ou estudante sob supervisão.</p>
                      <p><strong>Limitações:</strong> Esta ferramenta NÃO substitui avaliação clínica profissional, diagnóstico médico, prescrição farmacêutica ou qualquer decisão clínica. As análises geradas devem ser validadas por profissional habilitado.</p>
                      <p><strong>Responsabilidade:</strong> O usuário é inteiramente responsável pela aplicação das recomendações geradas. O PRM Care não se responsabiliza por decisões clínicas tomadas com base exclusiva nas análises automatizadas.</p>
                    </div>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox" {...register('acceptTerms')} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#1e3a5f]" />
                      <span className="text-sm text-gray-700">
                        Li e aceito os <Link href="/terms" target="_blank" className="text-[#1e3a5f] underline">Termos de Uso</Link>
                      </span>
                    </label>
                    {errors.acceptTerms && <p className="mt-1 ml-7 text-xs text-red-600">{errors.acceptTerms.message}</p>}
                  </div>

                  {/* Privacy */}
                  <div className="rounded-xl border border-gray-200 p-4">
                    <div className="mb-3 text-sm font-semibold text-gray-900">Política de Privacidade e LGPD</div>
                    <div className="mb-4 h-24 overflow-y-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-600 space-y-2">
                      <p>Coletamos dados necessários para o funcionamento da plataforma. Dados de pacientes são armazenados com criptografia e podem ser anonimizados. Você pode solicitar exportação ou exclusão dos seus dados a qualquer momento.</p>
                      <p>Não comercializamos dados pessoais. Seus dados são usados exclusivamente para prestação do serviço.</p>
                    </div>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox" {...register('acceptPrivacy')} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#1e3a5f]" />
                      <span className="text-sm text-gray-700">
                        Li e aceito a <Link href="/privacy" target="_blank" className="text-[#1e3a5f] underline">Política de Privacidade</Link> e o tratamento dos meus dados conforme a LGPD
                      </span>
                    </label>
                    {errors.acceptPrivacy && <p className="mt-1 ml-7 text-xs text-red-600">{errors.acceptPrivacy.message}</p>}
                  </div>

                  {/* Clinical disclaimer */}
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <div className="mb-3 text-sm font-semibold text-amber-900">Aviso Clínico Obrigatório</div>
                    <p className="mb-4 text-xs text-amber-800">
                      Declaro ciência de que o PRM Care é uma ferramenta de apoio técnico. As análises geradas NÃO substituem avaliação profissional habilitada. Não interromperei, substituirei ou ajustarei medicamentos de pacientes com base exclusivamente nas sugestões desta ferramenta, sem validação profissional.
                    </p>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox" {...register('acceptClinicalDisclaimer')} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-amber-600" />
                      <span className="text-sm text-amber-900 font-medium">Entendo e aceito as limitações desta ferramenta</span>
                    </label>
                    {errors.acceptClinicalDisclaimer && <p className="mt-1 ml-7 text-xs text-red-600">{errors.acceptClinicalDisclaimer.message}</p>}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep(1)}
                    className="flex-1 rounded-lg border border-gray-300 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                    Voltar
                  </button>
                  <button type="submit" disabled={isLoading}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#1e3a5f] py-3 text-sm font-semibold text-white hover:bg-[#162d4a] disabled:opacity-60 transition-colors">
                    {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Criar conta
                  </button>
                </div>
              </>
            )}
          </form>

          <p className="text-center text-sm text-gray-500">
            Já tem conta?{' '}
            <Link href="/login" className="font-medium text-[#1e3a5f] hover:underline">Entrar</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
