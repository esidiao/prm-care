import Link from 'next/link'
import { Pill, ArrowLeft } from 'lucide-react'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b px-6 py-4 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1e3a5f]">
            <Pill className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-[#1e3a5f]">PRM Care</span>
        </Link>
        <Link href="/" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
      </nav>
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Termos de Uso</h1>
        <p className="text-sm text-gray-400 mb-8">Versão 1.0 — Maio de 2025</p>
        <div className="prose prose-sm max-w-none space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-900">1. Natureza da Ferramenta</h2>
            <p>O PRM Care é uma plataforma SaaS (Software como Serviço) de apoio técnico e educacional para a identificação, análise e orientação sobre Problemas Relacionados aos Medicamentos (PRM), baseada no Método Dáder de Seguimento Farmacoterapêutico.</p>
            <div className="rounded-lg border-l-4 border-amber-400 bg-amber-50 p-4 text-amber-900 font-medium">
              ⚠️ ESTA FERRAMENTA NÃO SUBSTITUI AVALIAÇÃO PROFISSIONAL HABILITADA, DIAGNÓSTICO MÉDICO, PRESCRIÇÃO FARMACÊUTICA OU QUALQUER DECISÃO CLÍNICA.
            </div>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900">2. Uso Autorizado</h2>
            <p>O PRM Care é destinado exclusivamente a:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Farmacêuticos habilitados e devidamente registrados no CRF;</li>
              <li>Estudantes de farmácia e ciências da saúde <strong>sob supervisão de profissional habilitado</strong>;</li>
              <li>Instituições de saúde e ensino devidamente regularizadas;</li>
              <li>Pesquisadores e docentes da área da saúde.</li>
            </ul>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900">3. Limitações e Responsabilidades</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>As análises são baseadas exclusivamente nos dados informados pelo usuário;</li>
              <li>Dados incompletos ou incorretos podem gerar conclusões limitadas ou imprecisas;</li>
              <li>O usuário é inteiramente responsável pela aplicação das recomendações geradas;</li>
              <li>O PRM Care não se responsabiliza por decisões clínicas tomadas com base exclusiva nas análises automatizadas;</li>
              <li>Toda recomendação gerada deve ser validada por profissional habilitado antes de qualquer intervenção.</li>
            </ul>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900">4. Avisos Clínicos Obrigatórios</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Não interrompa, substitua ou ajuste medicamentos sem orientação profissional;</li>
              <li>Em situações de urgência ou emergência, procure atendimento de saúde imediatamente;</li>
              <li>Não utilize as análises como único critério para condutas clínicas;</li>
              <li>Sempre verifique as informações com fontes científicas atualizadas.</li>
            </ul>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900">5. Propriedade Intelectual</h2>
            <p>Todo o conteúdo da plataforma, incluindo algoritmos de análise, interface e base de conhecimento própria, é propriedade do PRM Care. Fontes clínicas externas são referenciadas e não reproduzidas integralmente, respeitando os direitos autorais.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900">6. Tokens e Pagamentos</h2>
            <p>Os tokens são créditos não-reembolsáveis utilizados para acesso às funcionalidades da plataforma. Pacotes de tokens são adquiridos e consumidos conforme as operações realizadas. Consulte nossa política de preços para valores atualizados.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900">7. Alterações nos Termos</h2>
            <p>O PRM Care reserva-se o direito de atualizar estes termos a qualquer momento. Usuários serão notificados de alterações significativas por email e, ao continuar utilizando a plataforma, concordam com os novos termos.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900">8. Contato</h2>
            <p>Para dúvidas sobre estes termos, entre em contato pelo email: <a href="mailto:suporte@prmcare.com.br" className="text-[#1e3a5f] underline">suporte@prmcare.com.br</a></p>
          </section>
        </div>
      </div>
    </div>
  )
}
