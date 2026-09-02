import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import Link from 'next/link'
import { ShieldAlert, CircleCheck, Info, ArrowRight } from 'lucide-react'
import {
  montarFicha, pendenciasDaFicha, fichaEmTexto, ehGrave,
  GRAVIDADE_ROTULO, DESFECHO_ROTULO,
  type Gravidade, type Desfecho, type AcaoTomada, type Reexposicao,
} from '@/lib/evento-adverso'
import { FichaVigimed } from '@/components/analysis/FichaVigimed'

/**
 * Suspeitas de reação adversa e a ficha para o VigiMed (lacuna 10).
 *
 * O sistema detecta a suspeita com os dados já estruturados; o que faltava era
 * o último passo, e é onde a notificação morria — redigitar tudo no portal.
 * Não notificadas vêm primeiro: a pendência é o assunto da tela.
 */

export const dynamic = 'force-dynamic'

export default async function EventosAdversosPage() {
  const session = await getSession()
  if (!session) return null

  const [eventos, notificador] = await Promise.all([
    prisma.adverseEventReport.findMany({
      where: { userId: session.user.id },
      orderBy: [{ notificadoEm: { sort: 'asc', nulls: 'first' } }, { dataInicio: 'asc' }],
      include: {
        patient: { select: { id: true, code: true, name: true, sex: true, dateOfBirth: true, age: true } },
      },
      take: 100,
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, crfNumber: true, specialization: true },
    }),
  ])

  const pendentes = eventos.filter(e => !e.notificadoEm)

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <ShieldAlert className="h-6 w-6 text-brand-800" /> Reações adversas
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Suspeitas registradas e a ficha pronta para notificar à ANVISA.
        </p>
      </div>

      {eventos.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-semibold text-foreground">Nenhuma suspeita registrada</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Ao identificar uma reação adversa durante o acompanhamento, registre aqui a partir da
            ficha do paciente. O sistema monta a ficha do VigiMed com os dados que já tem.
          </p>
          <Link href="/patients" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900 transition-colors">
            Ir para pacientes <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <>
          {pendentes.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/30">
              <p className="font-semibold text-amber-900 dark:text-amber-200">
                {pendentes.length} suspeita{pendentes.length === 1 ? '' : 's'} ainda não notificada{pendentes.length === 1 ? '' : 's'} à ANVISA
              </p>
              <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300">
                A notificação de suspeita de reação adversa é atribuição do farmacêutico e alimenta a
                farmacovigilância nacional — um caso não notificado não existe para o sistema de saúde.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {eventos.map(e => {
              const ficha = montarFicha({
                paciente: {
                  nome: e.patient.name,
                  code: e.patient.code,
                  sexo: e.patient.sex,
                  dataNascimento: e.patient.dateOfBirth,
                  idade: e.patient.age,
                },
                notificador: {
                  nome: notificador?.name ?? null,
                  email: notificador?.email ?? '',
                  crf: notificador?.crfNumber ?? null,
                  especializacao: notificador?.specialization ?? null,
                },
                medicamentos: e.medicamentos,
                reacao: e.reacao,
                dataInicio: e.dataInicio,
                dataFim: e.dataFim,
                gravidade: e.gravidade as Gravidade,
                desfecho: e.desfecho as Desfecho,
                acaoTomada: e.acaoTomada as AcaoTomada,
                reexposicao: e.reexposicao as Reexposicao,
                historicoRelevante: e.historicoRelevante,
                observacoes: e.observacoes,
              })
              const grave = ehGrave(e.gravidade as Gravidade)

              return (
                <details key={e.id} className="overflow-hidden rounded-xl border border-border bg-card" open={!e.notificadoEm}>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-5 py-3.5">
                    {e.notificadoEm
                      ? <CircleCheck className="h-4 w-4 shrink-0 text-green-700 dark:text-green-400" />
                      : <ShieldAlert className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />}
                    <span className="text-sm font-semibold text-foreground">{e.patient.code}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                      {e.medicamentos.split('\n')[0]} — {e.reacao}
                    </span>
                    {grave && (
                      <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-800 dark:bg-red-900/40 dark:text-red-300">
                        grave
                      </span>
                    )}
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {e.dataInicio.toLocaleDateString('pt-BR')}
                    </span>
                  </summary>

                  <div className="border-t border-border px-5 py-4">
                    <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span><b className="text-foreground">Gravidade:</b> {GRAVIDADE_ROTULO[e.gravidade as Gravidade]}</span>
                      <span><b className="text-foreground">Desfecho:</b> {DESFECHO_ROTULO[e.desfecho as Desfecho]}</span>
                      <Link href={`/patients/${e.patient.id}`} className="underline hover:text-foreground">
                        abrir o paciente
                      </Link>
                    </div>
                    <FichaVigimed
                      eventoId={e.id}
                      ficha={ficha}
                      pendencias={pendenciasDaFicha(ficha)}
                      textoFicha={fichaEmTexto(ficha)}
                      notificadoEm={e.notificadoEm?.toISOString() ?? null}
                      protocolo={e.protocoloVigimed}
                    />
                  </div>
                </details>
              )
            })}
          </div>
        </>
      )}

      <div className="rounded-xl border border-border bg-muted p-5 text-xs text-muted-foreground space-y-1.5">
        <p className="flex items-center gap-1.5 font-semibold text-foreground">
          <Info className="h-4 w-4" /> O que o PRM Care faz e não faz aqui
        </p>
        <p>
          Monta a ficha com os campos obrigatórios do VigiMed a partir do prontuário, e guarda o
          registro da notificação com o protocolo. <b>Não submete à ANVISA</b> — não existe API
          pública para notificação por profissional; o envio é pelo formulário aberto do VigiMed,
          que não exige cadastro.
        </p>
        <p>
          A ficha identifica o paciente por <b>iniciais</b>, como a norma pede — o nome completo não
          sai daqui.
        </p>
      </div>
    </div>
  )
}
