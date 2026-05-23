import Link from 'next/link'
import {
  ShieldCheck, Zap, FileText, Users, BarChart3, Lock,
  CheckCircle, ArrowRight, Star, AlertTriangle, BookOpen, Pill,
  Brain, Microscope, Stethoscope, FlaskConical, GraduationCap,
  Building2, Heart, Activity, CheckCircle2, ChevronRight,
} from 'lucide-react'

// ── Data ─────────────────────────────────────────────────────────────────────

const WHAT_WE_IDENTIFY = [
  'Problemas Relacionados a Medicamentos (PRMs)',
  'Interações medicamentosas e alimentares',
  'Incompatibilidades terapêuticas',
  'Duplicidades de tratamento',
  'Riscos associados a suplementos alimentares',
  'Impactos sobre biodisponibilidade',
  'Inadequações de dose',
  'Contraindicações clínicas',
  'Oportunidades de intervenção farmacêutica e multiprofissional',
]

const TARGET_AREAS = [
  { icon: '💊', label: 'Farmácia Clínica' },
  { icon: '🩺', label: 'Medicina' },
  { icon: '🥗', label: 'Nutrição Clínica' },
  { icon: '💉', label: 'Enfermagem' },
  { icon: '🏋️', label: 'Educação Física' },
  { icon: '🏥', label: 'Ambulatórios' },
  { icon: '🏨', label: 'Hospitais' },
  { icon: '🤝', label: 'Clínicas multiprofissionais' },
  { icon: '🏦', label: 'Operadoras de saúde' },
  { icon: '🎓', label: 'Instituições de ensino' },
]

const TECH_PILLARS = [
  { icon: Brain, label: 'Inteligência Artificial', desc: 'Modelos treinados em farmacologia clínica aplicada.' },
  { icon: FlaskConical, label: 'Conhecimento Farmacológico', desc: 'Base de dados atualizada com referências internacionais.' },
  { icon: Stethoscope, label: 'Raciocínio Clínico', desc: 'Análises contextualizadas ao perfil do paciente.' },
  { icon: ShieldCheck, label: 'Segurança Terapêutica', desc: 'Anti-alucinação e validação profissional obrigatória.' },
  { icon: Microscope, label: 'Evidências Científicas', desc: 'Atualização contínua com literatura de alta qualidade.' },
]

const CREATOR_EXPERTISE = [
  'Farmácia Clínica',
  'Educação Superior',
  'Gestão Acadêmica',
  'Medicina Tropical',
  'Tecnologias Educacionais',
  'Inteligência Artificial aplicada à saúde',
  'Desenvolvimento de soluções digitais clínicas',
]

const FEATURES = [
  {
    icon: <Pill className="h-6 w-6" />,
    title: 'Análise de PRMs',
    description: 'Identifica problemas de Necessidade, Efetividade, Segurança e Adesão com base no Método Dáder. Classifica por nível de risco.',
    color: 'text-blue-600 bg-blue-50',
  },
  {
    icon: <ShieldCheck className="h-6 w-6" />,
    title: 'Segurança Anti-alucinação',
    description: 'Nunca inventa doses, interações ou diagnósticos. Sempre informa o nível de confiança e exige validação profissional.',
    color: 'text-green-600 bg-green-50',
  },
  {
    icon: <FileText className="h-6 w-6" />,
    title: 'Relatórios em PDF',
    description: 'Relatório clínico completo com SOAP, plano de cuidado, orientações ao paciente e termo de limitação.',
    color: 'text-purple-600 bg-purple-50',
  },
  {
    icon: <BookOpen className="h-6 w-6" />,
    title: 'Base de Conhecimento',
    description: 'Base clínica atualizável com interações, contraindicações, protocolos e alertas de farmacovigilância.',
    color: 'text-orange-600 bg-orange-50',
  },
  {
    icon: <Users className="h-6 w-6" />,
    title: 'Acesso Institucional',
    description: 'Gerencie equipes, clínicas e turmas de alunos. Distribuição de tokens, painel do gestor e relatórios agregados.',
    color: 'text-teal-600 bg-teal-50',
  },
  {
    icon: <Lock className="h-6 w-6" />,
    title: 'Conformidade LGPD',
    description: 'Consentimento informado, anonimização de dados, criptografia, logs de auditoria e exclusão sob demanda.',
    color: 'text-red-600 bg-red-50',
  },
]

const PLANS = [
  {
    name: 'Gratuito',
    price: 'R$ 0',
    period: '/mês',
    description: 'Para conhecer a plataforma',
    highlight: false,
    features: ['2 análises demonstrativas', 'Cadastro de pacientes', 'Identificação de PRMs', 'Sem exportação PDF', 'Aviso de uso educacional'],
    cta: 'Começar grátis',
    href: '/register',
  },
  {
    name: 'Básico',
    price: 'Tokens avulsos',
    period: '',
    description: 'Para uso individual',
    highlight: false,
    features: ['Compra de tokens avulsos', 'Análises individuais', 'Relatório simples PDF', 'Histórico 3 meses', 'Suporte por email'],
    cta: 'Comprar tokens',
    href: '/register',
  },
  {
    name: 'Profissional',
    price: 'R$ 97',
    period: '/mês',
    description: 'Para farmacêuticos clínicos',
    highlight: true,
    features: ['50 tokens/mês inclusos', 'Histórico ilimitado', 'Relatório SOAP completo', 'Exportação PDF avançada', 'Base de conhecimento', 'Suporte prioritário'],
    cta: 'Assinar agora',
    href: '/register',
  },
  {
    name: 'Institucional',
    price: 'Sob consulta',
    period: '',
    description: 'Clínicas e instituições de ensino',
    highlight: false,
    features: ['Múltiplos usuários', 'Painel do gestor', 'Gestão de turmas/equipes', 'Tokens em pool', 'Relatórios gerenciais', 'Faturamento institucional'],
    cta: 'Falar com vendas',
    href: '/register',
  },
]

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1e3a5f]">
              <Pill className="h-4 w-4 text-white" />
            </div>
            <span className="text-xl font-bold text-[#1e3a5f]">PRM Care</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
            <a href="#plataforma" className="hover:text-[#1e3a5f] transition-colors">Plataforma</a>
            <a href="#funcionalidades" className="hover:text-[#1e3a5f] transition-colors">Funcionalidades</a>
            <a href="#precos" className="hover:text-[#1e3a5f] transition-colors">Preços</a>
            <a href="#criador" className="hover:text-[#1e3a5f] transition-colors">Criador</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-[#1e3a5f] transition-colors">
              Entrar
            </Link>
            <Link href="/register"
              className="rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-medium text-white hover:bg-[#162d4a] transition-colors">
              Começar grátis
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0f2644] via-[#1e3a5f] to-[#1a4d7a] py-28 text-white">
        <div className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '36px 36px' }} />
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-[0.05]"
          style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }} />
        <div className="container mx-auto px-4 text-center relative">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium">
            <Star className="h-4 w-4 text-yellow-300" />
            Baseado no Método Dáder de Seguimento Farmacoterapêutico
          </div>
          <h1 className="mx-auto mb-4 max-w-4xl text-4xl font-bold leading-tight md:text-6xl tracking-tight">
            Inteligência Clínica Aplicada à{' '}
            <span className="text-blue-300">Segurança Medicamentosa</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-blue-100/90 leading-relaxed">
            Plataforma inteligente para análise de terapias medicamentosas, identificação de riscos clínicos e suporte avançado à tomada de decisão — baseada em IA e evidências científicas.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register"
              className="flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-[#1e3a5f] hover:bg-blue-50 transition-colors shadow-lg">
              Criar conta gratuita <ArrowRight className="h-5 w-5" />
            </Link>
            <a href="#plataforma"
              className="flex items-center gap-2 rounded-xl border border-white/30 px-8 py-4 text-base font-semibold hover:bg-white/10 transition-colors">
              Conheça a plataforma <ChevronRight className="h-4 w-4" />
            </a>
          </div>
          <p className="mt-6 text-sm text-blue-300/80">
            2 análises demonstrativas gratuitas · Sem cartão de crédito
          </p>
        </div>
      </section>

      {/* ── Disclaimer ───────────────────────────────────────────────────── */}
      <div className="bg-amber-50 border-b border-amber-200 py-3">
        <div className="container mx-auto px-4 flex items-center gap-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-600" />
          <p>
            <strong>Ferramenta de apoio técnico e educacional.</strong> Não substitui avaliação profissional, prescrição médica ou decisão farmacêutica habilitada. Todas as análises devem ser validadas por profissional de saúde.
          </p>
        </div>
      </div>

      {/* ── O que é o PMCare ─────────────────────────────────────────────── */}
      <section id="plataforma" className="py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-5xl">

            {/* Section label */}
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1.5 text-sm font-semibold text-[#1e3a5f]">
              <Brain className="h-4 w-4" /> Sobre a Plataforma
            </div>

            <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 leading-tight mb-5">
                  Mais do que verificação de interações —{' '}
                  <span className="text-[#1e3a5f]">inteligência clínica completa</span>
                </h2>
                <p className="text-gray-600 leading-relaxed mb-6">
                  O PRM Care é uma plataforma inteligente desenvolvida para transformar a forma como profissionais da saúde analisam terapias medicamentosas, identificam riscos clínicos e promovem maior segurança ao paciente.
                </p>
                <p className="text-gray-600 leading-relaxed">
                  Utilizando inteligência artificial aplicada à farmacologia clínica, o sistema atua como suporte avançado à tomada de decisão, permitindo análises rápidas, seguras e contextualizadas sobre prescrições, suplementos, condições clínicas e exames laboratoriais.
                </p>
              </div>

              {/* What we identify */}
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-8">
                <h3 className="text-base font-bold text-gray-900 mb-5 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-[#1e3a5f]" />
                  A plataforma identifica:
                </h3>
                <ul className="space-y-3">
                  {WHAT_WE_IDENTIFY.map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                      <CheckCircle2 className="h-4 w-4 text-[#1e3a5f] shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 rounded-xl bg-[#1e3a5f]/5 border border-[#1e3a5f]/10 p-4 text-xs text-[#1e3a5f] font-medium">
                  Tudo de forma dinâmica, intuitiva e baseada em evidências científicas.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Para profissionais ───────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-[#0f2644] to-[#1e3a5f] py-24 text-white">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-5xl text-center mb-14">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-blue-200">
              <Users className="h-4 w-4" /> Público-alvo
            </div>
            <h2 className="text-3xl font-bold leading-tight mb-4">
              Uma plataforma criada para profissionais da saúde
            </h2>
            <p className="text-blue-200/80 max-w-2xl mx-auto">
              Desenvolvido para apoiar decisões clínicas com maior segurança, eficiência e rastreabilidade — sem substituir o profissional, mas ampliando sua capacidade analítica.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 max-w-4xl mx-auto">
            {TARGET_AREAS.map(({ icon, label }) => (
              <div key={label}
                className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/[0.07] p-5 text-center hover:bg-white/[0.12] transition-colors">
                <span className="text-3xl">{icon}</span>
                <span className="text-xs font-medium text-blue-100 leading-tight">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tecnologia com propósito ─────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-5xl">
            <div className="text-center mb-14">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1.5 text-sm font-semibold text-[#1e3a5f]">
                <FlaskConical className="h-4 w-4" /> Tecnologia com Propósito Clínico
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                O diferencial está na união entre ciência e tecnologia
              </h2>
              <p className="text-gray-500 max-w-xl mx-auto">
                Nosso objetivo é transformar dados terapêuticos complexos em informações clínicas úteis, acessíveis e aplicáveis à prática profissional.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
              {TECH_PILLARS.map(({ icon: Icon, label, desc }) => (
                <div key={label}
                  className="flex flex-col items-center text-center rounded-2xl border border-gray-100 bg-gray-50 p-6 hover:shadow-md transition-shadow">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#1e3a5f]/10">
                    <Icon className="h-5 w-5 text-[#1e3a5f]" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 mb-1">{label}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Funcionalidades ──────────────────────────────────────────────── */}
      <section id="funcionalidades" className="py-24 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white border px-4 py-1.5 text-sm font-semibold text-[#1e3a5f]">
              <Zap className="h-4 w-4" /> Funcionalidades
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Tudo que você precisa para o seguimento farmacoterapêutico</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Do cadastro do paciente ao relatório SOAP completo, com identificação sistemática de PRMs e recomendações baseadas em evidências.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
            {FEATURES.map((f, i) => (
              <div key={i} className="rounded-2xl border bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className={`mb-4 inline-flex rounded-xl p-3 ${f.color}`}>{f.icon}</div>
                <h3 className="mb-2 text-base font-bold text-gray-900">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Como funciona ────────────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="mb-16 text-center text-3xl font-bold text-gray-900">Como funciona</h2>
          <div className="grid gap-6 md:grid-cols-4 max-w-4xl mx-auto">
            {[
              { step: '01', title: 'Cadastre o paciente', desc: 'Insira dados clínicos, comorbidades, alergias e exames laboratoriais.' },
              { step: '02', title: 'Adicione medicamentos', desc: 'Registre dose, via, frequência, indicação e nível de adesão de cada medicamento.' },
              { step: '03', title: 'Solicite a análise', desc: 'O sistema avalia interações, riscos, duplicidades e necessidades não atendidas.' },
              { step: '04', title: 'Gere o relatório', desc: 'Exporte PDF com SOAP, recomendações, plano de cuidado e orientações ao paciente.' },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1e3a5f] text-xl font-bold text-white shadow-lg">
                  {s.step}
                </div>
                <h3 className="mb-2 font-bold text-gray-900">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Preços ───────────────────────────────────────────────────────── */}
      <section id="precos" className="py-24 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="mb-4 text-center text-3xl font-bold text-gray-900">Planos e preços</h2>
          <p className="mb-16 text-center text-gray-500">Comece grátis e escale conforme sua necessidade</p>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4 max-w-5xl mx-auto">
            {PLANS.map((plan, i) => (
              <div key={i} className={`rounded-2xl border p-6 ${plan.highlight
                ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white shadow-2xl scale-105'
                : 'bg-white shadow-sm hover:shadow-md'} transition-all`}>
                {plan.highlight && (
                  <div className="mb-3 inline-flex rounded-full bg-yellow-400 px-3 py-1 text-xs font-bold text-[#1e3a5f]">
                    Mais popular
                  </div>
                )}
                <h3 className={`text-lg font-bold ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>{plan.name}</h3>
                <p className={`mb-1 text-sm ${plan.highlight ? 'text-blue-200' : 'text-gray-500'}`}>{plan.description}</p>
                <div className="my-4">
                  <span className={`text-3xl font-bold ${plan.highlight ? 'text-white' : 'text-[#1e3a5f]'}`}>{plan.price}</span>
                  <span className={`text-sm ${plan.highlight ? 'text-blue-200' : 'text-gray-500'}`}>{plan.period}</span>
                </div>
                <ul className="mb-6 space-y-2">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm">
                      <CheckCircle className={`h-4 w-4 shrink-0 ${plan.highlight ? 'text-green-300' : 'text-green-500'}`} />
                      <span className={plan.highlight ? 'text-blue-100' : 'text-gray-600'}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href={plan.href}
                  className={`block w-full rounded-xl py-3 text-center text-sm font-semibold transition-colors ${plan.highlight
                    ? 'bg-white text-[#1e3a5f] hover:bg-blue-50'
                    : 'bg-[#1e3a5f] text-white hover:bg-[#162d4a]'}`}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>

          {/* Token packages */}
          <div className="mt-16 rounded-2xl border bg-white p-8 max-w-5xl mx-auto">
            <h3 className="mb-6 text-center text-xl font-bold text-[#1e3a5f]">Custo por operação (tokens)</h3>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              {[
                { op: 'Análise básica', tokens: '1 token', desc: 'Até 3 medicamentos' },
                { op: 'Análise completa', tokens: '3 tokens', desc: 'Até 10 medicamentos' },
                { op: 'Análise avançada', tokens: '5 tokens', desc: 'Com exames laboratoriais' },
                { op: 'Relatório PDF', tokens: '2 tokens', desc: 'Relatório clínico' },
                { op: 'Reanálise', tokens: '1 token', desc: 'Após atualização de dados' },
                { op: 'Rel. institucional', tokens: '5 tokens', desc: 'Com assinatura e SOAP' },
              ].map((item, i) => (
                <div key={i} className="rounded-xl border bg-gray-50 p-4 text-center">
                  <div className="mb-1 text-2xl font-bold text-[#1e3a5f]">{item.tokens}</div>
                  <div className="text-sm font-medium text-gray-900">{item.op}</div>
                  <div className="text-xs text-gray-500">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Sobre o Criador ──────────────────────────────────────────────── */}
      <section id="criador" className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-5xl">

            <div className="text-center mb-14">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1.5 text-sm font-semibold text-[#1e3a5f]">
                <GraduationCap className="h-4 w-4" /> Sobre o Criador
              </div>
            </div>

            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">

              {/* Photo + credentials */}
              <div className="flex flex-col items-center lg:items-start">
                <div className="relative mb-6">
                  {/* Photo */}
                  <div className="h-64 w-64 rounded-2xl overflow-hidden shadow-2xl border-4 border-white ring-1 ring-gray-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/dr-edson.jpg"
                      alt="Dr. Edson Sidião de Souza Júnior"
                      className="h-full w-full object-cover object-top"
                    />
                  </div>
                  {/* Badge */}
                  <div className="absolute -bottom-4 -right-4 flex items-center gap-2 rounded-xl bg-[#1e3a5f] px-4 py-2 shadow-lg">
                    <Pill className="h-4 w-4 text-white" />
                    <span className="text-xs font-bold text-white">Farmacêutico Dr.</span>
                  </div>
                </div>

                <div className="mt-6 text-center lg:text-left">
                  <h3 className="text-2xl font-bold text-gray-900">Dr. Edson Sidião de Souza Júnior</h3>
                  <p className="text-sm text-[#1e3a5f] font-semibold mt-1">Farmacêutico · Doutor em Medicina Tropical</p>
                  <p className="text-sm text-gray-500 mt-0.5">Especialista em Gestão, Assistência Farmacêutica e Educação em Saúde</p>
                </div>
              </div>

              {/* Bio */}
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-5 leading-tight">
                  Experiência prática,{' '}
                  <span className="text-[#1e3a5f]">conhecimento científico</span>{' '}
                  e inovação tecnológica
                </h2>
                <p className="text-gray-600 leading-relaxed mb-6">
                  Com ampla experiência acadêmica, clínica e institucional, atua há anos na formação de profissionais da área da saúde, gestão educacional e desenvolvimento de soluções inovadoras aplicadas à assistência e à segurança do paciente.
                </p>

                <h4 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider">Áreas de atuação</h4>
                <div className="grid grid-cols-2 gap-2">
                  {CREATOR_EXPERTISE.map((area) => (
                    <div key={area} className="flex items-center gap-2 text-sm text-gray-700">
                      <div className="h-1.5 w-1.5 rounded-full bg-[#1e3a5f] shrink-0" />
                      {area}
                    </div>
                  ))}
                </div>

                <div className="mt-8 rounded-xl border border-[#1e3a5f]/10 bg-[#1e3a5f]/5 p-5">
                  <p className="text-sm text-[#1e3a5f] font-medium italic">
                    "O PRM Care nasce da união entre experiência prática, conhecimento científico e inovação tecnológica — para transformar complexidade terapêutica em inteligência clínica."
                  </p>
                  <p className="mt-2 text-xs text-[#1e3a5f]/70 font-semibold">— Dr. Edson Sidião</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Final ────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0f2644] via-[#1e3a5f] to-[#1a4d7a] py-24 text-white">
        <div className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '36px 36px' }} />
        <div className="container mx-auto px-4 text-center relative">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 border border-white/20">
            <Heart className="h-8 w-8 text-white" />
          </div>
          <h2 className="mb-4 text-3xl font-bold md:text-4xl leading-tight">
            O futuro da segurança medicamentosa começa agora
          </h2>
          <p className="mb-3 text-blue-200 max-w-2xl mx-auto leading-relaxed">
            Mais do que um software, o PRM Care representa uma nova proposta de inteligência clínica aplicada à saúde. Uma plataforma criada para reduzir riscos, ampliar a segurança terapêutica e apoiar profissionais na tomada de decisões mais precisas, humanas e baseadas em evidências.
          </p>
          <p className="mb-10 text-blue-300 font-semibold text-lg italic">
            Transformando complexidade terapêutica em inteligência clínica.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register"
              className="flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-[#1e3a5f] hover:bg-blue-50 transition-colors shadow-lg">
              Criar conta gratuita <ArrowRight className="h-5 w-5" />
            </Link>
            <Link href="/login"
              className="rounded-xl border border-white/30 px-8 py-4 text-base font-semibold hover:bg-white/10 transition-colors">
              Acessar plataforma
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t bg-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1e3a5f]">
                  <Pill className="h-4 w-4 text-white" />
                </div>
                <span className="font-bold text-[#1e3a5f]">PRM Care</span>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">Apoio técnico ao seguimento farmacoterapêutico baseado no Método Dáder.</p>
            </div>
            <div>
              <h4 className="mb-3 font-semibold text-gray-900">Plataforma</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><Link href="/register" className="hover:text-[#1e3a5f] transition-colors">Começar grátis</Link></li>
                <li><a href="#precos" className="hover:text-[#1e3a5f] transition-colors">Preços</a></li>
                <li><Link href="/login" className="hover:text-[#1e3a5f] transition-colors">Entrar</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-3 font-semibold text-gray-900">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><Link href="/terms" className="hover:text-[#1e3a5f] transition-colors">Termos de Uso</Link></li>
                <li><Link href="/privacy" className="hover:text-[#1e3a5f] transition-colors">Política de Privacidade</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-3 font-semibold text-gray-900">Aviso Legal</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Esta ferramenta é de apoio técnico e educacional. Não substitui avaliação profissional, prescrição ou diagnóstico médico/farmacêutico. Em emergências, procure atendimento de saúde imediatamente.
              </p>
            </div>
          </div>
          <div className="mt-8 border-t pt-8 text-center text-xs text-gray-400">
            © {new Date().getFullYear()} PRM Care · Desenvolvido por Dr. Edson Sidião de Souza Júnior · Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  )
}
