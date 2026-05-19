import Link from 'next/link'
import { Pill, ArrowLeft } from 'lucide-react'

export default function PrivacyPage() {
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Política de Privacidade</h1>
        <p className="text-sm text-gray-400 mb-8">Versão 1.0 — Maio de 2025 — Conforme a LGPD (Lei 13.709/2018)</p>
        <div className="prose prose-sm max-w-none space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-900">1. Dados Coletados</h2>
            <p>Coletamos as seguintes categorias de dados para operação da plataforma:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Dados de cadastro:</strong> nome, email, senha (criptografada), número de registro profissional;</li>
              <li><strong>Dados de uso:</strong> logs de acesso, análises realizadas, relatórios gerados;</li>
              <li><strong>Dados de pacientes:</strong> inseridos voluntariamente pelo usuário, podendo ser anonimizados;</li>
              <li><strong>Dados financeiros:</strong> histórico de compras de tokens (não armazenamos dados de cartão).</li>
            </ul>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900">2. Finalidade do Tratamento</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Prestação do serviço de análise farmacoterapêutica;</li>
              <li>Melhoria contínua da plataforma;</li>
              <li>Cumprimento de obrigações legais e regulatórias;</li>
              <li>Comunicações relacionadas ao serviço contratado.</li>
            </ul>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900">3. Base Legal (LGPD)</h2>
            <p>O tratamento de dados é realizado com base em:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Consentimento explícito do titular (Art. 7º, I);</li>
              <li>Execução de contrato (Art. 7º, V);</li>
              <li>Legítimo interesse do controlador (Art. 7º, IX).</li>
            </ul>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900">4. Dados de Pacientes</h2>
            <p>Os dados de saúde inseridos na plataforma são considerados dados sensíveis (Art. 11, LGPD). O usuário é responsável pela adequação legal do uso desses dados, incluindo consentimento do paciente e conformidade com o CFM/CRF. O PRM Care fornece a opção de anonimização de todos os dados de pacientes.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900">5. Segurança dos Dados</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Criptografia de dados sensíveis em repouso e em trânsito (TLS/SSL);</li>
              <li>Controle de acesso por perfil de usuário;</li>
              <li>Logs de auditoria de todas as operações;</li>
              <li>Backups regulares com retenção controlada.</li>
            </ul>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900">6. Direitos do Titular</h2>
            <p>Você tem direito a:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Acesso aos seus dados pessoais;</li>
              <li>Correção de dados incompletos ou inexatos;</li>
              <li>Portabilidade dos dados;</li>
              <li>Exclusão dos dados (direito ao esquecimento);</li>
              <li>Revogação do consentimento a qualquer momento;</li>
              <li>Informação sobre compartilhamento de dados.</li>
            </ul>
            <p className="mt-2">Para exercer estes direitos, envie solicitação para: <a href="mailto:privacidade@prmcare.com.br" className="text-[#1e3a5f] underline">privacidade@prmcare.com.br</a></p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900">7. Compartilhamento de Dados</h2>
            <p>Não comercializamos dados pessoais. Podemos compartilhar dados exclusivamente com:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Provedores de infraestrutura (hospedagem, banco de dados);</li>
              <li>Processadores de pagamento (apenas dados financeiros necessários);</li>
              <li>Autoridades, quando exigido por lei.</li>
            </ul>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900">8. Retenção de Dados</h2>
            <p>Dados são retidos pelo período necessário à prestação do serviço. Após cancelamento da conta, dados pessoais são excluídos em até 30 dias, salvo obrigação legal de retenção.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900">9. Encarregado de Dados (DPO)</h2>
            <p>Nosso encarregado de proteção de dados pode ser contatado em: <a href="mailto:dpo@prmcare.com.br" className="text-[#1e3a5f] underline">dpo@prmcare.com.br</a></p>
          </section>
        </div>
      </div>
    </div>
  )
}
