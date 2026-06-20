# Parecer — Fontes gratuitas de interações medicamentosas (uso por Secretaria de Saúde)

> Baseado em deep-research com verificação adversarial (2026-06). Uso pretendido:
> órgão público, **sem fins comerciais**, integração a software próprio de **apoio à
> decisão clínica** (uso interno/assistencial, sem revenda). Não é parecer jurídico
> formal — confirmar com a assessoria jurídica/RT antes de ingerir bases com licença.

## Veredito por fonte

| Fonte | Tem interações? | Disponível hoje | Licença | Pode a Secretaria usar (NC/assistencial)? |
|---|---|---|---|---|
| **RxNorm / RxNav (NLM)** | ❌ (só normalização/ATC via RxClass) | ✅ APIs ativas | UMLS Metathesaurus (gratuito; conta UTS) | ✅ **Sim** — licença permite incorporar em app próprio NC. Subset "Prescribable" nem exige login. |
| **RxNav Drug Interaction API** | ✅ era a fonte gov | ❌ **DESCONTINUADA em 02/01/2024** | — | ❌ Não existe mais |
| **DDInter 2.0** | ✅ ~302 mil DDIs / ~2.290 fármacos (8 CSV por ATC) | ✅ baixável sem login (usar subdomínio **ddinter2**) | **CC BY-NC-SA 4.0** (dados) | ⚠️ **Sim, com cautela** — NC permitido; exige **atribuição** + **ShareAlike** (derivados/redistribuição mantêm a mesma licença) |
| **openFDA / DailyMed (SPL)** | ✅ seção de interações nas bulas | ✅ API pública | Domínio público (gov EUA) | ✅ **Sim** (já integrado no RAG) |
| **WHO ATC/DDD** | ❌ (classificação) | ✅ | Índice público | ✅ Sim (normalização/classe) |
| **CredibleMeds (QTdrugs)** | ✅ lista QT/TdP | ✅ (cadastro gratuito) | Uso gratuito mediante registro | ✅ Sim (reforço QT) |
| **CPIC / PharmGKB** | Farmacogenômica | ✅ | Aberto | ✅ Sim (já implementado) |
| **DrugBank — "Open Data"** | ❌ (só vocabulário/estruturas) | ✅ | CC0 | ✅ mas **sem interações** |
| **DrugBank — dataset completo (DDI)** | ✅ | ❌ **downloads acadêmicos SUSPENSOS desde v5.1.21 (jun/2026)** | CC BY-NC 4.0 (NC, exige licença/citação) | 🛑 **Evitar** — restrito + indisponível |
| **OFFSIDES / TWOSIDES (Tatonetti)** | ✅ (derivado de FAERS) | ✅ CSV/MySQL | **Código MIT, mas DADOS sem licença declarada** | 🛑 **Não integrar** sem contato/autorização do lab (status jurídico indeterminado) |

## Conclusão prática (custo zero, segurança jurídica)

**Stack 100% segura e gratuita (usar sem ressalva):**
- **RxNorm/UMLS** → normalização de fármacos (a licença UMLS ampara incorporar em app próprio NC/assistencial de órgão público).
- **openFDA + DailyMed + ANVISA** → bulas/labels (domínio público) no RAG.
- **WHO ATC/DDD** → classificação. **CredibleMeds** → QT. **CPIC** → farmacogenômica.
- **Base própria curada/verificada do PRM Care** (199 pares + classes + alimento/suplemento) — conteúdo nosso, sem licença de terceiros.

**Maior alavanca de cobertura (interações), com cautela:**
- **DDInter 2.0** (~302 mil DDIs) — utilizável para uso **não-comercial/assistencial**, MAS a licença **CC BY-NC-SA 4.0** impõe: (1) **atribuição** ao DDInter; (2) **ShareAlike** — os dados/derivados integrados precisam permanecer sob a mesma licença (não se "fecha" o dado). Para um CDS interno de Secretaria isso é geralmente aceitável; **decisão do RT/jurídico**.

**Evitar (pago/restrito/indeterminado):** DrugBank-DDI (NC + indisponível agora), OFFSIDES/TWOSIDES (dados sem licença).

## Recomendação de implementação
1. **Imediato (sem nenhuma pendência jurídica):** RxNorm para normalização + ampliar o RAG com openFDA/DailyMed/ANVISA + manter expansão da base própria verificada (workflow). Já temos quase tudo disso.
2. **Se o RT/jurídico aceitar CC BY-NC-SA:** ingerir o **DDInter 2.0** como camada de interações (com **atributo de fonte "DDInter (CC BY-NC-SA 4.0)"** em cada registro e aviso de atribuição na tela), tratando esse subconjunto de dados como CC BY-NC-SA.

## Fontes (verificadas 3-0)
- DDInter download/termos: https://ddinter2.scbdd.com/download/ · http://ddinter.scbdd.com/terms/ · artigo NAR 2024 (https://academic.oup.com/nar/article/53/D1/D1356/7740584)
- RxNav DDI descontinuada: https://lhncbc.nlm.nih.gov/RxNav/APIs/InteractionAPIs.html
- DrugBank licença/Open Data: documentação DrugBank (CC BY-NC 4.0 / CC0 open data) + aviso de suspensão de downloads (v5.1.21)
- OFFSIDES/TWOSIDES: github.com/tatonetti-lab/offsides (código MIT; dados sem licença) · nsides.io
