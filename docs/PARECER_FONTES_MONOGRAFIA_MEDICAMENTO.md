# Parecer — Fontes para monografia de medicamento (lacuna 02)

> **PREMISSA, declarada de propósito.** Este parecer vale para o **PRM Care como
> produto COMERCIAL** — plataforma proprietária que cobra por pacotes de token via
> Mercado Pago. Toda conclusão abaixo depende disso.
>
> A premissa está no topo porque o parecer anterior
> (`PARECER_FONTES_GRATUITAS_INTERACOES.md`, jun/2026) foi escrito para "órgão
> público, sem fins comerciais, sem revenda", a premissa mudou, e o documento
> continuou parecendo válido — foi assim que a base DDInter entrou sob licença
> CC BY-NC-SA num produto que cobra. **Se o modelo de negócio mudar, este parecer
> precisa ser reavaliado antes de qualquer decisão.**
>
> Não é parecer jurídico. Confirmar com assessoria antes de ingerir qualquer base.

Levantado em 01/09/2026. Todas as URLs de dados foram testadas, não apenas citadas.

## A distinção que decide tudo

Monografia de medicamento parece uma coisa só, mas são **duas fontes com regimes
jurídicos diferentes**, e confundi-las é exatamente o erro que já cometemos:

| | Origem | Quem detém o direito | Uso comercial |
|---|---|---|---|
| **Dado de registro e preço** | Sistemas da ANVISA/CMED | Poder público | ✅ Livre, no máximo com atribuição |
| **Texto da bula** | Redigido pelo titular do registro | **A empresa farmacêutica** | ⚠️ Reprodução por terceiro exige permissão do detentor |

A RDC nº 47/2009 põe no titular do registro a responsabilidade pelo conteúdo da
bula. A ANVISA **hospeda** a bula como documento sanitário; isso não transfere a
autoria do texto para o domínio público. Raspar o Bulário e republicar o texto
como nossa monografia é ato distinto — e mais arriscado — do que usar os
conjuntos de dados de registro e preço.

**Consequência prática:** dá para montar uma monografia forte, comercialmente
segura, **sem reproduzir texto de bula**.

## O que já temos, hoje, sem nenhuma pendência

| Ativo | Onde | Cobertura |
|---|---|---|
| openFDA (bulas dos EUA) | `drug-lookup-service.ts` | Domínio público (gov. EUA), já integrado, sem chave |
| RxNorm/RxNav | `drug-lookup-service.ts` | Normalização PT→EN, já integrado, sem chave |
| Base farmacocinética própria | `pharma-pk-db.ts` (786 linhas) | Alimento, horário, meia-vida — conteúdo nosso |
| Posologia própria | `posology.ts` (435 linhas) | Conteúdo nosso |
| Sinônimos/aliases | `drug-aliases.ts` | Conteúdo nosso |
| Base clínica curada | `prm-engine.ts` + `KnowledgeBase` | 201 pares + classes — conteúdo nosso |

Ou seja: o esqueleto farmacológico já existe. O que falta é a **camada
brasileira** — nome comercial, apresentação, tarja, preço, intercambialidade.

## Veredito por fonte

| Fonte | Traz o quê | Testado em 01/09 | Licença | Uso comercial |
|---|---|---|---|---|
| **ANVISA — Medicamentos registrados** (`DADOS_ABERTOS_MEDICAMENTOS.csv`) | Produto, princípio ativo, classe terapêutica, categoria regulatória, registro, detentor, situação | ✅ HTTP 200, **8,3 MB**, CSV `;` latin-1 | Dados abertos gov.br — no máximo atribuição + ShareAlike | ✅ **Sim** — sem cláusula NC |
| **CMED — Lista de preços** (`TA_PRECO_MEDICAMENTO.csv`) | Substância, laboratório, EAN, produto, apresentação, **PF e PMC por alíquota**, tarja, restrição hospitalar, comercializado em 2025 | ✅ HTTP 200, **16,5 MB**, 74 colunas, publicada 21/07/2026 | Idem | ✅ **Sim** |
| **openFDA / DailyMed (SPL)** | Indicação, contraindicação, advertência, interação — texto de bula **dos EUA** | ✅ já em produção | Domínio público (gov. EUA) | ✅ **Sim** |
| **RxNorm / RxNav** | Normalização, ATC via RxClass | ✅ já em produção | UMLS (conta gratuita) | ✅ Sim |
| **WHO ATC/DDD** | Classificação e dose diária definida | — | Índice público | ✅ Sim |
| **Bulário Eletrônico (texto da bula BR)** | Bula completa em português | Acessível | **Autoria do titular do registro** | ⚠️ **Não reproduzir** sem permissão — ver seção acima |
| **APIs de terceiros** (`medicamentos.api.br`, wrappers no GitHub) | Reembalam os mesmos dados da ANVISA | — | Termos do intermediário, não do dado | 🛑 Evitar — adiciona dependência e termo de terceiro sobre dado que já é público |
| **DrugBank / Lexicomp / Micromedex** | Monografia completa | — | Comercial paga | 💰 Só com contrato |

## Recomendação

**Ingerir ANVISA + CMED, não raspar bula.** As duas planilhas juntas entregam o
que o farmacêutico procura quando sai do sistema: qual é o nome comercial, qual
apresentação existe, se tem genérico, qual a tarja, quanto custa.

Fases, em ordem de valor por esforço:

1. **ETL das duas planilhas para tabelas próprias**, com job de atualização.
   **Armadilhas confirmadas rodando o ETL** (`scripts/etl/anvisa-cmed.mjs`), não
   só lendo a documentação:
   - **Os dois arquivos têm encodings DIFERENTES**: o da ANVISA é `latin-1` e o
     da CMED é `UTF-8`. Fixar um corrompe o outro em silêncio — vira
     `restriÃ§Ã£o` no lugar de `restrição`, e o dado entra torto sem erro
     nenhum. *(Correção de 01/09: a primeira versão deste parecer afirmava
     latin-1 para ambos, antes de o ETL ser executado.)*
   - **A CMED grafa colunas com acento** (`SUBSTÂNCIA`, `APRESENTAÇÃO`). Ler a
     versão sem acento devolve `undefined` sem erro: na primeira execução o
     cruzamento com a base clínica deu **zero** por causa disso. O ETL canoniza
     o cabeçalho.
   - O CSV da CMED tem **59 linhas de preâmbulo**; o cabeçalho está na linha 60,
     e a posição muda a cada publicação — procurar é mais seguro que fixar.
   - `SITUACAO_REGISTRO` permite filtrar registro caduco/cancelado, que não deve
     aparecer como opção terapêutica.

   **Volumes reais medidos em 01/09/2026:** 43.445 medicamentos registrados
   (17.270 ativos) e 25.699 apresentações na CMED, das quais 13.086
   comercializadas, cobrindo **1.917 princípios ativos distintos**.
2. **Tela de monografia** unindo: dado ANVISA (identidade e regulação) + CMED
   (apresentações e preço) + nosso conteúdo próprio (posologia, farmacocinética,
   alimento/horário, interações) + openFDA como leitura complementar rotulada
   como fonte norte-americana.
3. **Fecha a lacuna 17 de brinde.** A CMED traz PF e PMC por apresentação — é
   exatamente o dado que faltava para "alternativa terapêutica mais barata" e
   para a estimativa de custo evitado que hoje o `/impacto` declara não ter.

## O que NÃO fazer

- **Não reproduzir texto de bula brasileira** como conteúdo próprio.
- **Não usar API intermediária** de terceiro para dado que a ANVISA publica
  direto: acrescenta termo de uso alheio sobre dado público e um ponto de falha.
- **Não repetir o erro do DDInter:** antes de ingerir, verificar a cláusula
  **NonCommercial**. Foi ela, não a atribuição, que criou a pendência atual.

## Fontes verificadas em 01/09/2026

- ANVISA — [Dados abertos](https://dados.gov.br/dataset?tags=ANVISA) ·
  CSV testado: `https://dados.anvisa.gov.br/dados/DADOS_ABERTOS_MEDICAMENTOS.csv` (200, 8,3 MB)
- CMED — [Listas de preços](https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/cmed/precos) ·
  CSV testado: `https://dados.anvisa.gov.br/dados/TA_PRECO_MEDICAMENTO.csv` (200, 16,5 MB, publicada 21/07/2026)
- ANVISA — [Bulário Eletrônico](https://www.gov.br/anvisa/pt-br/sistemas/bulario-eletronico)
- [RDC nº 47/2009](https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2009/res0047_08_09_2009_rep.html) — regras de bula e responsabilidade do titular do registro
- openFDA (`api.fda.gov`) e RxNav (`rxnav.nlm.nih.gov`) — já integrados em `drug-lookup-service.ts`
