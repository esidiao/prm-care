# 💊 PRM Care — Plataforma de Seguimento Farmacoterapêutico

> SaaS para identificação, análise, classificação e orientação sobre Problemas Relacionados aos Medicamentos (PRM) baseado no **Método Dáder de Seguimento Farmacoterapêutico**.

---

## ⚠️ Aviso Legal Obrigatório

> Esta ferramenta é de **apoio técnico e educacional**.
> **Não substitui** avaliação profissional habilitada, diagnóstico médico ou prescrição farmacêutica.
> Todas as análises devem ser validadas por farmacêutico ou profissional de saúde habilitado.

---

## 🏗️ Arquitetura

```
Frontend:    Next.js 14 (App Router) + TypeScript
Styling:     Tailwind CSS + Shadcn/UI
Backend:     Next.js API Routes
Database:    PostgreSQL + Prisma ORM
Auth:        NextAuth.js (credentials)
PDF:         @react-pdf/renderer (a implementar)
Pagamentos:  Stripe / Mercado Pago (integração futura)
Deploy:      Vercel (frontend) + Supabase/Railway (database)
```

---

## 📦 Estrutura do Projeto

```
prm-care/
├── prisma/
│   ├── schema.prisma          # Schema completo do banco de dados
│   └── seed.ts                # Dados demonstrativos
├── src/
│   ├── app/
│   │   ├── (auth)/            # Login e cadastro
│   │   ├── (dashboard)/       # Área autenticada
│   │   │   ├── dashboard/     # Painel principal
│   │   │   ├── patients/      # Gestão de pacientes
│   │   │   ├── analysis/      # Análise PRM
│   │   │   ├── reports/       # Relatórios PDF
│   │   │   ├── tokens/        # Compra de tokens
│   │   │   └── settings/      # Configurações e LGPD
│   │   ├── admin/             # Painel administrativo
│   │   ├── api/               # API Routes (backend)
│   │   ├── terms/             # Termos de uso
│   │   └── privacy/           # Política de privacidade
│   ├── lib/
│   │   ├── prm-engine.ts      # ⭐ Motor clínico de análise PRM
│   │   ├── token-service.ts   # Gestão de tokens
│   │   ├── auth.ts            # Configuração NextAuth
│   │   ├── prisma.ts          # Cliente Prisma
│   │   └── utils.ts           # Utilitários
│   ├── components/
│   │   ├── layout/            # Sidebar, TopBar, etc.
│   │   └── ui/                # Componentes de interface
│   └── types/
│       └── index.ts           # Tipos TypeScript
```

---

## 🚀 Instalação e Configuração

### 1. Clonar e instalar dependências
```bash
cd prm-care
npm install
```

### 2. Configurar variáveis de ambiente
```bash
cp .env.example .env
# Edite o .env com suas configurações
```

Variáveis obrigatórias:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/prm_care"
NEXTAUTH_SECRET="sua-chave-secreta-min-32-chars"
NEXTAUTH_URL="http://localhost:3000"
```

### 3. Configurar banco de dados
```bash
# Criar as tabelas
npm run db:push

# OU usar migrations (recomendado para produção)
npm run db:migrate

# Gerar o cliente Prisma
npm run db:generate

# Popular com dados de demonstração
npm run db:seed
```

### 4. Executar em desenvolvimento
```bash
npm run dev
```
Acesse: http://localhost:3000

---

## 👤 Credenciais de Demonstração (após seed)

| Perfil | Email | Senha |
|--------|-------|-------|
| Administrador | admin@prmcare.com.br | Admin@123456 |
| Farmacêutico | farmaceutico@demo.com | Demo@123456 |

---

## 💡 Funcionalidades Implementadas

### ✅ Autenticação & Usuários
- [x] Cadastro com consentimento LGPD em 2 etapas
- [x] Login seguro com NextAuth
- [x] Perfis: Admin, Profissional, Estudante, Gestor Institucional
- [x] Logs de auditoria automáticos
- [x] Aviso de limitação clínica para estudantes

### ✅ Motor Clínico (PRM Engine)
- [x] Análise de Necessidade (automedicação, duplicidade, necessidade não atendida)
- [x] Análise de Efetividade (adesão, polifarmácia, esquema complexo)
- [x] Análise de Segurança:
  - [x] Interações medicamentosas (banco de dados interno)
  - [x] Contraindicações na gestação
  - [x] Critérios de Beers para idosos
  - [x] Ajuste em insuficiência renal
  - [x] Ajuste em hepatopatia
  - [x] Alergias vs medicamentos em uso
- [x] Análise de Adesão/Conveniência
- [x] Classificação de risco: Baixo, Moderado, Alto, Urgente
- [x] Geração de SOAP automático
- [x] Sistema anti-alucinação (nível de confiança, validação obrigatória)
- [x] Avisos de dados insuficientes

### ✅ Sistema de Tokens
- [x] Saldo de tokens por usuário
- [x] Débito automático por análise
- [x] Histórico de transações
- [x] Pacotes de tokens configuráveis
- [x] Alerta de saldo baixo
- [x] Tokens de demonstração (boas-vindas)
- [x] Custo configurável pelo painel admin (SystemConfig)

### ✅ Pacientes
- [x] Cadastro completo (dados demográficos, clínicos, laboratoriais)
- [x] Comorbidades, alergias, diagnósticos
- [x] Anonimização
- [x] Histórico de análises por paciente

### ✅ Análises
- [x] Fluxo multi-etapas (Paciente → Medicamentos → Dados Clínicos → Confirmar)
- [x] Custo dinâmico por tipo de análise
- [x] Resultado detalhado com badges de risco
- [x] Registro SOAP integrado
- [x] Recomendações por PRM identificado

### ✅ Painel Admin
- [x] Métricas gerais (usuários, tokens, análises, receita)
- [x] Gestão da base de conhecimento clínico
- [x] Top alertas mais frequentes
- [x] Alertas de base desatualizada

### ✅ Conformidade LGPD
- [x] Consentimento informado em 3 categorias
- [x] Política de privacidade completa
- [x] Termos de uso completos
- [x] Histórico de consentimentos
- [x] Avisos de limitação clínica em todas as telas
- [x] Logs de auditoria

---

## 🔧 Custo por Operação (tokens)

| Operação | Tokens |
|----------|--------|
| Análise básica (≤ 3 medicamentos) | 1 |
| Análise completa (≤ 10 medicamentos) | 3 |
| Análise avançada (com exames) | 5 |
| Relatório PDF | 2 |
| Reanálise | 1 |
| Relatório institucional | 5 |

> Todos os valores são configuráveis pelo painel admin via `SystemConfig`.

---

## 💳 Planos Comerciais

| Plano | Preço | Tokens | Recursos |
|-------|-------|--------|----------|
| Gratuito | R$ 0 | 5 (boas-vindas) | 2 análises demo |
| Básico | Avulso | Compra avulsa | PDF, histórico 3m |
| Profissional | R$ 97/mês | 50/mês | SOAP, PDF avançado |
| Institucional | Sob consulta | Pool compartilhado | Multi-usuário, relatórios gerenciais |

---

## 🏥 Motor Clínico — Detalhes Técnicos

O arquivo `src/lib/prm-engine.ts` contém toda a lógica de análise farmacoterapêutica:

### Banco de Interações
- 10+ interações medicamentosas documentadas com mecanismo e conduta
- Extensível — adicione interações ao array `KNOWN_INTERACTIONS`

### Verificações automáticas
- **Critérios de Beers (AGS 2023)** — 12 medicamentos mapeados
- **Gravidez** — 20+ contraindicados, 10+ com cautela
- **Insuficiência renal** — 11 medicamentos com ajuste necessário
- **Hepatopatia** — 7 medicamentos mapeados
- **Duplicidade terapêutica** — 8 classes farmacológicas verificadas
- **Polifarmácia** — alerta a partir de 5 medicamentos

### Sistema Anti-Alucinação
```typescript
// Sempre retorna nível de confiança
confidenceLevel: 'high' | 'moderate' | 'low' | 'insufficient_data'

// Sempre inclui nota de validação
validationNote: "Baseado em dados publicados. Avaliação profissional é essencial."

// Avisa sobre dados ausentes
dataQualityWarnings: ['Idade não informada — análise de risco etário limitada.']
```

---

## 📊 Banco de Dados — Tabelas Principais

```
users                  — Usuários e autenticação
patients               — Dados dos pacientes
medications            — Medicamentos por paciente
lab_results            — Exames laboratoriais
prm_analyses           — Análises realizadas
prm_findings           — PRMs identificados (detalhado)
soap_records           — Registros SOAP
reports                — Relatórios gerados
token_packages         — Pacotes disponíveis para compra
token_transactions     — Histórico de débitos/créditos
knowledge_base         — Base de conhecimento clínico
system_config          — Configurações dinâmicas (custo de tokens, etc.)
audit_logs             — Logs de auditoria
consent_records        — Histórico de consentimentos LGPD
```

---

## 🔮 Próximos Passos (Roadmap)

### Fase imediata
- [ ] Integração com Stripe/Mercado Pago para pagamentos reais
- [ ] Geração de PDF com `@react-pdf/renderer`
- [ ] Formulário completo de criação de paciente (UI)
- [ ] Autenticação em dois fatores

### Curto prazo
- [ ] Importação de bulas via API da Anvisa
- [ ] Cálculo automático de ClCr (Cockcroft-Gault)
- [ ] Notificações por email (saldo baixo, alertas clínicos)
- [ ] Dashboard do gestor institucional
- [ ] Relatório institucional com assinatura digital

### Médio prazo
- [ ] Integração com bases licenciadas (Micromedex API)
- [ ] App mobile (React Native)
- [ ] Exportação FHIR para prontuários eletrônicos
- [ ] IA generativa para recomendações contextuais (com validação)
- [ ] Análise de interações com suplementos e fitoterápicos

---

## 🛡️ Segurança

- Senhas com bcrypt (salt rounds: 12)
- Sessions JWT com expiração de 30 dias
- Middleware de proteção de rotas por perfil
- Logs de auditoria em todas as operações críticas
- LGPD: consentimento, anonimização, exclusão sob demanda
- Dados sensíveis de pacientes criptografados em repouso (via provedor de banco)

---

## 📞 Suporte e Contato

- **Suporte técnico:** suporte@prmcare.com.br
- **Privacidade / LGPD:** privacidade@prmcare.com.br
- **DPO:** dpo@prmcare.com.br
- **Comercial:** comercial@prmcare.com.br

---

*PRM Care — Apoio técnico ao seguimento farmacoterapêutico. Versão 1.0.0*
