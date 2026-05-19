import Link from 'next/link'
import {
  ShieldCheck, Zap, FileText, Users, BarChart3, Lock,
  CheckCircle, ArrowRight, Star, AlertTriangle, BookOpen, Pill
} from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1e3a5f]">
              <Pill className="h-4 w-4 text-white" />
            </div>
            <span className="text-xl font-bold text-[#1e3a5f]">PRM Care</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
            <a href="#features" className="hover:text-[#1e3a5f]">Funcionalidades</a>
            <a href="#pricing" className="hover:text-[#1e3a5f]">Preços</a>
            <a href="#about" className="hover:text-[#1e3a5f]">Sobre</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-[#1e3a5f]">
              Entrar
            </Link>
            <Link href="/register"
              className="rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-medium text-white hover:bg-[#162d4a] transition-colors">
              Começar grátis
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1e3a5f] via-[#1e4d8c] to-[#2563eb] py-24 text-white">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        <div className="container mx-auto px-4 text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm">
            <Star className="h-4 w-4 text-yellow-300" />
            Baseado no Método Dáder de Seguimento Farmacoterapêutico
          </div>
          <h1 className="mx-auto mb-6 max-w-4xl text-4xl font-bold leading-tight md:text-6xl">
            Identificação inteligente de <span className="text-yellow-300">Problemas Relacionados a Medicamentos</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-blue-100">
            Plataforma SaaS para farmacêuticos, clínicas e instituições de ensino. Analise farmacoterapias, gere relatórios estruturados e apoie decisões clínicas com segurança.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register"
              className="flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-[#1e3a5f] hover:bg-blue-50 transition-colors shadow-lg">
              Criar conta gratuita <ArrowRight className="h-5 w-5" />
            </Link>
            <a href="#pricing"
              className="rounded-xl border border-white/30 px-8 py-4 text-base font-semibold hover:bg-white/10 transition-colors">
              Ver planos
            </a>
          </div>
          <p className="mt-6 text-sm text-blue-200">
            2 análises demonstrativas gratuitas · Sem cartão de crédito
          </p>
        </div>
      </section>

      {/* Disclaimer Banner */}
      <div className="bg-amber-50 border-b border-amber-200 py-3">
        <div className="container mx-auto px-4 flex items-center gap-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-600" />
          <p>
            <strong>Ferramenta de apoio técnico e educacional.</strong> Não substitui avaliação profissional, prescrição médica ou decisão farmacêutica habilitada. Todas as análises devem ser validadas por profissional de saúde.
          </p>
        </div>
      </div>

      {/* Features */}
      <section id="features" className="py-24">
        <div className="container mx-auto px-4">
          <div className="page-header text-center mb-16">
            <h2 className="text-3xl font-bold text-[#1e3a5f]">Tudo que você precisa para o seguimento farmacoterapêutico</h2>
            <p className="mt-4 text-gray-500 max-w-2xl mx-auto">
              Do cadastro do paciente ao relatório SOAP completo, com identificação sistemática de PRMs e recomendações baseadas em evidências.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: <Pill className="h-6 w-6" />,
                title: 'Análise de PRMs',
                description: 'Identifica problemas de Necessidade, Efetividade, Segurança e Adesão com base no Método Dáder. Classifica por nível de risco: Baixo, Moderado, Alto e Urgente.',
                color: 'text-blue-600 bg-blue-50',
              },
              {
                icon: <ShieldCheck className="h-6 w-6" />,
                title: 'Segurança Anti-alucinação',
                description: 'Sistema de controle de incerteza clínica. Nunca inventa doses, interações ou diagnósticos. Sempre informa o nível de confiança e exige validação profissional.',
                color: 'text-green-600 bg-green-50',
              },
              {
                icon: <FileText className="h-6 w-6" />,
                title: 'Relatórios em PDF',
                description: 'Relatório clínico completo com SOAP, plano de cuidado, orientações ao paciente e termo de limitação. Pronto para prontuário.',
                color: 'text-purple-600 bg-purple-50',
              },
              {
                icon: <BookOpen className="h-6 w-6" />,
                title: 'Base de Conhecimento',
                description: 'Base clínica atualizável com interações, contraindicações, protocolos e alertas de farmacovigilância. Rastreabilidade de fonte e data de revisão.',
                color: 'text-orange-600 bg-orange-50',
              },
              {
                icon: <Users className="h-6 w-6" />,
                title: 'Acesso Institucional',
                description: 'Gerencie equipes, clínicas e turmas de alunos. Distribuição de tokens, painel do gestor e relatórios gerenciais agregados.',
                color: 'text-teal-600 bg-teal-50',
              },
              {
                icon: <Lock className="h-6 w-6" />,
                title: 'Conformidade LGPD',
                description: 'Consentimento informado, anonimização de dados, criptografia, logs de auditoria e exclusão de dados sob demanda.',
                color: 'text-red-600 bg-red-50',
              },
            ].map((f, i) => (
              <div key={i} className="rounded-xl border bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className={`mb-4 inline-flex rounded-lg p-3 ${f.color}`}>{f.icon}</div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900">{f.title}</h3>
                <p className="text-sm text-gray-500">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 py-24">
        <div className="container mx-auto px-4">
          <h2 className="mb-16 text-center text-3xl font-bold text-[#1e3a5f]">Como funciona</h2>
          <div className="grid gap-6 md:grid-cols-4">
            {[
              { step: '01', title: 'Cadastre o paciente', desc: 'Insira dados clínicos, comorbidades, alergias e exames laboratoriais.' },
              { step: '02', title: 'Adicione medicamentos', desc: 'Registre dose, via, frequência, indicação e nível de adesão de cada medicamento.' },
              { step: '03', title: 'Solicite a análise', desc: 'O sistema avalia interações, riscos, duplicidades e necessidades não atendidas.' },
              { step: '04', title: 'Gere o relatório', desc: 'Exporte PDF com SOAP, recomendações, plano de cuidado e orientações ao paciente.' },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#1e3a5f] text-xl font-bold text-white">
                  {s.step}
                </div>
                <h3 className="mb-2 font-semibold text-gray-900">{s.title}</h3>
                <p className="text-sm text-gray-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24">
        <div className="container mx-auto px-4">
          <h2 className="mb-4 text-center text-3xl font-bold text-[#1e3a5f]">Planos e preços</h2>
          <p className="mb-16 text-center text-gray-500">Comece grátis e escale conforme sua necessidade</p>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                name: 'Gratuito',
                price: 'R$ 0',
                period: '/mês',
                description: 'Para conhecer a plataforma',
                highlight: false,
                features: [
                  '2 análises demonstrativas',
                  'Cadastro de pacientes',
                  'Identificação de PRMs',
                  'Sem exportação PDF',
                  'Aviso de uso educacional',
                ],
                cta: 'Começar grátis',
                href: '/register',
              },
              {
                name: 'Básico',
                price: 'Tokens avulsos',
                period: '',
                description: 'Para uso individual',
                highlight: false,
                features: [
                  'Compra de tokens avulsos',
                  'Análises individuais',
                  'Relatório simples PDF',
                  'Histórico 3 meses',
                  'Suporte por email',
                ],
                cta: 'Comprar tokens',
                href: '/register',
              },
              {
                name: 'Profissional',
                price: 'R$ 97',
                period: '/mês',
                description: 'Para farmacêuticos clínicos',
                highlight: true,
                features: [
                  '50 tokens/mês inclusos',
                  'Histórico ilimitado',
                  'Relatório SOAP completo',
                  'Exportação PDF avançada',
                  'Base de conhecimento',
                  'Suporte prioritário',
                ],
                cta: 'Assinar agora',
                href: '/register',
              },
              {
                name: 'Institucional',
                price: 'Sob consulta',
                period: '',
                description: 'Clínicas e instituições de ensino',
                highlight: false,
                features: [
                  'Múltiplos usuários',
                  'Painel do gestor',
                  'Gestão de turmas/equipes',
                  'Tokens em pool',
                  'Relatórios gerenciais',
                  'Faturamento institucional',
                ],
                cta: 'Falar com vendas',
                href: '/register',
              },
            ].map((plan, i) => (
              <div key={i} className={`rounded-xl border p-6 ${plan.highlight
                ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white shadow-xl scale-105'
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
                      <CheckCircle className={`h-4 w-4 flex-shrink-0 ${plan.highlight ? 'text-green-300' : 'text-green-500'}`} />
                      <span className={plan.highlight ? 'text-blue-100' : 'text-gray-600'}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href={plan.href}
                  className={`block w-full rounded-lg py-3 text-center text-sm font-semibold transition-colors ${plan.highlight
                    ? 'bg-white text-[#1e3a5f] hover:bg-blue-50'
                    : 'bg-[#1e3a5f] text-white hover:bg-[#162d4a]'}`}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>

          {/* Token packages */}
          <div className="mt-16 rounded-2xl border bg-gray-50 p-8">
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
                <div key={i} className="rounded-lg border bg-white p-4 text-center shadow-sm">
                  <div className="mb-1 text-2xl font-bold text-[#1e3a5f]">{item.tokens}</div>
                  <div className="text-sm font-medium text-gray-900">{item.op}</div>
                  <div className="text-xs text-gray-500">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Target audience */}
      <section id="about" className="bg-[#1e3a5f] py-24 text-white">
        <div className="container mx-auto px-4">
          <h2 className="mb-4 text-center text-3xl font-bold">Quem usa o PRM Care</h2>
          <p className="mb-12 text-center text-blue-200">Desenvolvido para profissionais e instituições da área farmacêutica</p>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: '💊', title: 'Farmacêuticos Clínicos', desc: 'Seguimento farmacoterapêutico individual e em equipe.' },
              { icon: '🏥', title: 'Clínicas e Hospitais', desc: 'Revisão de medicamentos em internações e ambulatório.' },
              { icon: '🎓', title: 'Instituições de Ensino', desc: 'Prática supervisionada de estudantes de farmácia.' },
              { icon: '🏪', title: 'Farmácias Clínicas', desc: 'Serviços de atenção farmacêutica ao paciente.' },
            ].map((a, i) => (
              <div key={i} className="rounded-xl border border-white/20 bg-white/10 p-6 text-center">
                <div className="mb-3 text-4xl">{a.icon}</div>
                <h3 className="mb-2 font-semibold">{a.title}</h3>
                <p className="text-sm text-blue-200">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
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
              <p className="text-sm text-gray-500">Apoio técnico ao seguimento farmacoterapêutico baseado no Método Dáder.</p>
            </div>
            <div>
              <h4 className="mb-3 font-semibold text-gray-900">Plataforma</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><Link href="/register" className="hover:text-[#1e3a5f]">Começar grátis</Link></li>
                <li><a href="#pricing" className="hover:text-[#1e3a5f]">Preços</a></li>
                <li><Link href="/login" className="hover:text-[#1e3a5f]">Entrar</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-3 font-semibold text-gray-900">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><Link href="/terms" className="hover:text-[#1e3a5f]">Termos de Uso</Link></li>
                <li><Link href="/privacy" className="hover:text-[#1e3a5f]">Política de Privacidade</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-3 font-semibold text-gray-900">Aviso Legal</h4>
              <p className="text-xs text-gray-400">
                Esta ferramenta é de apoio técnico e educacional. Não substitui avaliação profissional, prescrição ou diagnóstico médico/farmacêutico. Em emergências, procure atendimento de saúde imediatamente.
              </p>
            </div>
          </div>
          <div className="mt-8 border-t pt-8 text-center text-xs text-gray-400">
            © {new Date().getFullYear()} PRM Care. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  )
}
