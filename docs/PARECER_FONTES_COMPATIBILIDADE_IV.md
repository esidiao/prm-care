# Parecer — Fontes para compatibilidade IV (lacuna 03)

> **PREMISSA, declarada de propósito.** Vale para o **PRM Care como produto COMERCIAL**
> — plataforma proprietária que cobra por pacotes de token. Toda conclusão depende
> disso. Se o modelo de negócio mudar, reavaliar antes de qualquer decisão.
>
> Não é parecer jurídico. Confirmar com assessoria antes de ingerir qualquer base.

Levantado em 02/09/2026. Fontes testadas, não apenas citadas.

## Conclusão, antes do detalhe

**Não existe base livre, licenciável e estruturada de compatibilidade em Y.** As
quatro referências do campo são comerciais, e a única gratuita relevante proíbe
extração de forma explícita. Não é uma lacuna de esforço — é de licenciamento.

O que dá para entregar sem risco jurídico é **menos** do que a lacuna pedia, e
precisa ser rotulado com honestidade para não passar por substituto do Trissel's.

## Veredito por fonte

| Fonte | Traz o quê | Licença | Serve? |
|---|---|---|---|
| **Trissel's / ASHP Injectable Drug Information** | Padrão do campo; Y-site, seringa, estabilidade | Comercial (Wolters Kluwer / ASHP) | 💰 Só com contrato |
| **King Guide to Parenteral Admixtures** | 500+ injetáveis em 12 fluidos | Comercial | 💰 Só com contrato |
| **Micromedex IV Compatibility** | Checador de compatibilidade | Comercial (Merative) | 💰 Só com contrato |
| **Stabilis (Infostab)** | Base internacional de estabilidade e compatibilidade, 30 idiomas, consulta gratuita | 🛑 **Proíbe extração** | 🛑 **Não ingerir** |
| **openFDA / DailyMed (SPL)** | Cautelas de diluente, pH, adsorção, veículo compatível — **em prosa** | Domínio público (gov. EUA) | ⚠️ Parcial — ver limites |
| **Guias de hospitais públicos BR** (EBSERH, HUs) | Tabelas de diluição e estabilidade em PDF | Caso a caso | ⚠️ Verificar individualmente |

### Por que o Stabilis está fora

É gratuito para consultar e foi a primeira candidata óbvia. As menções legais
proíbem explicitamente **"toute reproduction, représentation, modification,
publication, adaptation de tout ou partie des éléments du site... sauf
autorisation écrite préalable"**, e a base é protegida pela lei francesa de
01/07/1998, que transpõe a **Diretiva europeia 96/9** — cuja proteção *sui
generis* existe justamente contra extração de parte substancial de base de dados.

Consultar como profissional é livre. Ingerir é o que a norma proíbe. É a lição do
DDInter aplicada **antes** de ingerir, e não depois.

## O que a openFDA realmente entrega — testado em 02/09/2026

Consultadas as bulas de furosemida, midazolam, vancomicina, amiodarona e
pantoprazol. Há conteúdo de compatibilidade, mas com três limites que mudam o que
se pode construir:

**1. É prosa, não par estruturado.** O dado vive em `dosage_and_administration`
como texto corrido. Não há campo de compatibilidade Y-site fármaco×fármaco.

**2. É majoritariamente fármaco × veículo, não fármaco × fármaco.** O que aparece
é pH e risco de precipitação (furosemida: *"may precipitate at pH values below
7"*), adsorção a material (amiodarona: *"adsorbs to polyvinyl chloride (PVC)
tubing"*), diluente compatível (vancomicina). Isso é útil — e **não** é o que
"compatibilidade em Y" significa.

**3. Extração por palavra-chave produz falso positivo perigoso.** O caso que
resolve a discussão: a bula do midazolam diz que o flumazenil *"may **precipitate**
acute withdrawal reactions"*. Um extrator que procura "precipitate" registraria
isso como incompatibilidade física entre midazolam e flumazenil. Seria uma
afirmação clínica inventada, gerada por um regex.

## Recomendação

**Fase A — entregar o que a openFDA sustenta, com o nome certo.**
Uma seção de *"Preparo e administração do injetável"* na monografia já existente:
diluente compatível, pH, cautela de material, tempo de infusão. Vem de domínio
público, é verificável e é conteúdo que o farmacêutico hoje busca fora do sistema.
**Não chamar de compatibilidade IV**, porque não é.

Extração exige revisão humana — não automatizar por palavra-chave, pelo motivo do
item 3. O caminho viável é a IA extratora já existente (`ai-guardrails.ts`) com
saída revisada por farmacêutico antes de publicar, seguindo o mesmo modelo de
`status: PENDING → VALIDATED` que o `KnowledgeBase` já implementa.

**Fase B — decisão que é do negócio, não da engenharia.**

1. **Licenciar Trissel's ou King Guide.** É a única forma de ter compatibilidade
   em Y com cobertura de verdade. Custo real, e resolve a porta de entrada do
   mercado hospitalar.
2. **Curadoria própria de um subconjunto**, no mesmo modelo das 198 interações já
   curadas: as combinações mais frequentes em UTI, cada uma com citação de estudo
   primário. Fato não é protegido por direito autoral; a expressão é. Exige
   farmacêutico revisor e tempo, e entrega cobertura pequena com procedência
   forte — agora rastreável pela tela `/admin/curadoria`.
3. **Não fazer.** Defensável: sem uma das duas acima, qualquer coisa que se chame
   "compatibilidade IV" seria cobertura ilusória num campo onde erro precipita
   embolia. Melhor não ter do que ter pela metade.

**Minha recomendação:** Fase A agora, e a opção 2 da Fase B como projeto separado,
com escopo declarado — *"N combinações curadas de UTI"* —, nunca apresentado como
substituto do Trissel's. Se o alvo for hospital de porte, a opção 1 é inevitável.

## O que NÃO fazer

- **Não extrair do Stabilis.** É o caminho mais rápido e o mais claramente vedado.
- **Não gerar pares Y-site por regex sobre a bula.** Ver o caso do midazolam.
- **Não chamar dado de veículo/diluente de "compatibilidade IV".** São perguntas
  clínicas diferentes, e a confusão aparece à beira do leito.
- **Não pedir para a IA "completar" a base.** Compatibilidade físico-química não é
  inferível por analogia farmacológica — é resultado de ensaio.

## Fontes verificadas em 02/09/2026

- [Trissel's IV Compatibility (Wolters Kluwer)](https://www.wolterskluwer.com/en/solutions/uptodate/enterprise/lexidrug-trissels-iv-compatibility)
- [Micromedex IV Compatibility (Merative)](https://www.merative.com/clinical-decision-support/micromedex-iv-compatibility)
- [Stabilis 4.0 — Infostab](https://www.stabilis.org/Infostab.php?codeLangue=PT-pt) ·
  menções legais consultadas em `MentionsLegales.php` (proibição de reprodução; Diretiva 96/9)
- [Evaluation of seven i.v. drug compatibility references](https://pubmed.ncbi.nlm.nih.gov/19635773/) —
  divergência entre referências do campo
- openFDA `api.fda.gov/drug/label.json` — consultado para 5 injetáveis; resultados no corpo deste parecer
