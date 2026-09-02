import prisma from '@/lib/prisma'
import { escapeHtml } from '@/lib/utils'

/**
 * Resumo de acompanhamento — o "follow-up ativo" que faltava.
 *
 * As revisões vencidas e os achados graves não resolvidos já eram calculados em
 * `/api/notifications`, mas só apareciam se o farmacêutico abrisse o sistema —
 * era pull. Isto é o push: o mesmo dado indo atrás dele.
 *
 * PRIVACIDADE: o e-mail identifica paciente pelo CÓDIGO, nunca pelo nome. Dado
 * clínico saindo do sistema por e-mail é exposição desnecessária sob a LGPD —
 * o farmacêutico resolve o código dentro da plataforma, onde há sessão e
 * auditoria. O e-mail é um gatilho para entrar, não um relatório clínico.
 */

export interface ItemResumo {
  tipo: 'revisao_vencida' | 'revisao_hoje' | 'achado_grave'
  titulo: string
  codigoPaciente: string
  detalhe: string
  href: string
}

export interface ResumoFarmaceutico {
  userId: string
  nome: string | null
  email: string
  itens: ItemResumo[]
}

const DIAS_ACHADO = 30

/**
 * Monta o resumo de todos os farmacêuticos que têm algo pendente.
 * Quem não tem pendência não entra na lista — e-mail vazio treina o usuário a
 * ignorar o remetente.
 */
export async function montarResumos(): Promise<ResumoFarmaceutico[]> {
  const agora = new Date()
  const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())
  const fimHoje = new Date(inicioHoje.getTime() + 86_400_000)
  const desdeAchado = new Date(agora.getTime() - DIAS_ACHADO * 86_400_000)

  const [vencidas, deHoje, achados] = await Promise.all([
    prisma.patientReview.findMany({
      where: { status: 'PENDING', scheduledDate: { lt: inicioHoje } },
      select: {
        id: true, title: true, scheduledDate: true, userId: true,
        patient: { select: { id: true, code: true } },
      },
      orderBy: { scheduledDate: 'asc' },
      take: 2000,
    }),
    prisma.patientReview.findMany({
      where: { status: 'PENDING', scheduledDate: { gte: inicioHoje, lt: fimHoje } },
      select: {
        id: true, title: true, scheduledDate: true, userId: true,
        patient: { select: { id: true, code: true } },
      },
      orderBy: { scheduledDate: 'asc' },
      take: 2000,
    }),
    prisma.pRMFinding.findMany({
      where: {
        isResolved: false,
        riskLevel: { in: ['URGENT', 'HIGH'] },
        analysis: { status: 'COMPLETED', createdAt: { gte: desdeAchado } },
      },
      select: {
        id: true, title: true, riskLevel: true,
        analysis: { select: { id: true, userId: true, patient: { select: { code: true } } } },
      },
      orderBy: { riskLevel: 'asc' },
      take: 2000,
    }),
  ])

  const porUsuario = new Map<string, ItemResumo[]>()
  const push = (userId: string, item: ItemResumo) => {
    const lista = porUsuario.get(userId)
    if (lista) lista.push(item)
    else porUsuario.set(userId, [item])
  }

  for (const r of vencidas) {
    const atraso = Math.floor((inicioHoje.getTime() - r.scheduledDate.getTime()) / 86_400_000)
    push(r.userId, {
      tipo: 'revisao_vencida',
      titulo: r.title,
      codigoPaciente: r.patient.code,
      detalhe: `vencida há ${atraso} dia${atraso === 1 ? '' : 's'}`,
      href: `/patients/${r.patient.id}`,
    })
  }
  for (const r of deHoje) {
    push(r.userId, {
      tipo: 'revisao_hoje',
      titulo: r.title,
      codigoPaciente: r.patient.code,
      detalhe: 'agendada para hoje',
      href: `/patients/${r.patient.id}`,
    })
  }
  for (const f of achados) {
    push(f.analysis.userId, {
      tipo: 'achado_grave',
      titulo: f.title,
      codigoPaciente: f.analysis.patient.code,
      detalhe: f.riskLevel === 'URGENT' ? 'risco urgente, não resolvido' : 'risco alto, não resolvido',
      href: `/analysis/${f.analysis.id}`,
    })
  }

  if (porUsuario.size === 0) return []

  const usuarios = await prisma.user.findMany({
    where: { id: { in: Array.from(porUsuario.keys()) }, isActive: true },
    select: { id: true, name: true, email: true },
  })

  return usuarios
    .filter(u => !!u.email)
    .map(u => ({ userId: u.id, nome: u.name, email: u.email!, itens: porUsuario.get(u.id) ?? [] }))
    .filter(r => r.itens.length > 0)
}

const ROTULO: Record<ItemResumo['tipo'], string> = {
  revisao_vencida: 'Revisões vencidas',
  revisao_hoje: 'Revisões de hoje',
  achado_grave: 'Achados graves não resolvidos',
}

const ORDEM: ItemResumo['tipo'][] = ['achado_grave', 'revisao_vencida', 'revisao_hoje']

export function montarEmail(resumo: ResumoFarmaceutico, baseUrl: string) {
  const grupos = ORDEM
    .map(tipo => ({ tipo, itens: resumo.itens.filter(i => i.tipo === tipo) }))
    .filter(g => g.itens.length > 0)

  const primeiroNome = (resumo.nome || '').trim().split(/\s+/)[0] || 'Farmacêutico(a)'
  const total = resumo.itens.length
  const assunto = `PRM Care — ${total} pendência${total === 1 ? '' : 's'} de acompanhamento`

  const html = `<!doctype html><html><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f5f8fb;font-family:Segoe UI,Arial,sans-serif;color:#0f2744">
  <div style="max-width:600px;margin:24px auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #d7e1ec">
    <div style="background:#0f2744;padding:18px 24px">
      <h1 style="margin:0;font-size:17px;color:#fff">PRM Care — acompanhamento</h1>
    </div>
    <div style="padding:20px 24px">
      <p style="margin:0 0 14px">Olá, ${escapeHtml(primeiroNome)}. Há <b>${total}</b> item${total === 1 ? '' : 's'} aguardando sua avaliação.</p>
      ${grupos.map(g => `
        <h2 style="font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#40566f;margin:18px 0 8px">${escapeHtml(ROTULO[g.tipo])} (${g.itens.length})</h2>
        <ul style="margin:0;padding-left:18px">
          ${g.itens.slice(0, 15).map(i => `
            <li style="margin-bottom:6px;font-size:14px">
              <b>${escapeHtml(i.codigoPaciente)}</b> — ${escapeHtml(i.titulo)}
              <span style="color:#74879c">(${escapeHtml(i.detalhe)})</span>
            </li>`).join('')}
        </ul>
        ${g.itens.length > 15 ? `<p style="font-size:12px;color:#74879c;margin:6px 0 0">e mais ${g.itens.length - 15} — veja no sistema.</p>` : ''}
      `).join('')}
      <p style="margin:22px 0 0">
        <a href="${escapeHtml(baseUrl)}/dashboard" style="display:inline-block;background:#1d5fd0;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;font-size:14px">Abrir o PRM Care</a>
      </p>
      <p style="font-size:11px;color:#74879c;margin:20px 0 0;border-top:1px solid #e6ecf3;padding-top:12px">
        Os pacientes são identificados por código — nenhum dado clínico ou nome trafega neste e-mail.
        Consulte o prontuário dentro da plataforma.
      </p>
    </div>
  </div>
</body></html>`

  const texto = [
    `Olá, ${primeiroNome}. Há ${total} item(ns) aguardando sua avaliação.`,
    '',
    ...grupos.flatMap(g => [
      `${ROTULO[g.tipo]} (${g.itens.length}):`,
      ...g.itens.slice(0, 15).map(i => `  - ${i.codigoPaciente} — ${i.titulo} (${i.detalhe})`),
      '',
    ]),
    `Abra em ${baseUrl}/dashboard`,
    'Pacientes identificados por código — nenhum dado clínico neste e-mail.',
  ].join('\n')

  return { assunto, html, texto }
}
