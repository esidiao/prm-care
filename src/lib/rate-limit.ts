/**
 * Rate limiter distribuído com fallback in-memory.
 *
 * - Quando `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` estão definidos,
 *   usa Upstash Redis (janela fixa via INCR + EXPIRE). Funciona de forma
 *   consistente entre os isolates serverless/edge da Vercel. Prefixo: `prm-rl:`.
 * - Sem essas variáveis (ex.: dev local ou antes de provisionar o Upstash),
 *   cai para um limiter in-memory por isolate — o mesmo comportamento anterior.
 * - Em QUALQUER erro do Redis faz *fail-open* (permite a requisição), para nunca
 *   derrubar a aplicação por indisponibilidade do cache.
 *
 * Compatível com Edge Runtime: @upstash/redis usa a REST API (fetch).
 */
import { Redis } from '@upstash/redis'

interface Window {
  count: number
  resetAt: number
}

const store = new Map<string, Window>()

export interface RateLimitOptions {
  /** Maximum requests per window */
  limit: number
  /** Window duration in seconds */
  windowSecs: number
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
}

const REDIS_PREFIX = 'prm-rl:'

let redisClient: Redis | null = null
let redisResolved = false

/** Instancia (uma vez) o cliente Redis se as credenciais estiverem presentes. */
function getRedis(): Redis | null {
  if (redisResolved) return redisClient
  redisResolved = true
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (url && token) {
    redisClient = new Redis({ url, token })
  }
  return redisClient
}

/** Limiter in-memory (por isolate) — usado como fallback quando não há Redis. */
function memoryLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  let win = store.get(key)

  if (!win || win.resetAt < now) {
    win = { count: 0, resetAt: now + opts.windowSecs * 1000 }
    store.set(key, win)
  }

  win.count++
  const remaining = Math.max(0, opts.limit - win.count)

  // Poda periódica de entradas expiradas (~1 a cada 500 checagens)
  if (Math.random() < 0.002) {
    store.forEach((v, k) => {
      if (v.resetAt < now) store.delete(k)
    })
  }

  return {
    success: win.count <= opts.limit,
    remaining,
    resetAt: win.resetAt,
  }
}

export async function rateLimit(key: string, opts: RateLimitOptions): Promise<RateLimitResult> {
  const client = getRedis()
  if (!client) return memoryLimit(key, opts)

  const redisKey = `${REDIS_PREFIX}${key}`
  try {
    // INCR + TTL em um único round-trip; define a expiração apenas na primeira
    // ocorrência da janela (quando ainda não há TTL).
    const pipe = client.pipeline()
    pipe.incr(redisKey)
    pipe.ttl(redisKey)
    const [count, ttlRaw] = (await pipe.exec()) as [number, number]

    let ttl = ttlRaw
    if (count === 1 || ttl < 0) {
      await client.expire(redisKey, opts.windowSecs)
      ttl = opts.windowSecs
    }

    return {
      success: count <= opts.limit,
      remaining: Math.max(0, opts.limit - count),
      resetAt: Date.now() + ttl * 1000,
    }
  } catch (err) {
    // Fail-open: indisponibilidade do cache nunca deve bloquear a aplicação.
    console.error('[rate-limit] Redis indisponível — fail-open:', err)
    return {
      success: true,
      remaining: opts.limit,
      resetAt: Date.now() + opts.windowSecs * 1000,
    }
  }
}

// Pre-configured limiters (assíncronos)
export const authLimiter     = (ip: string) => rateLimit(`auth:${ip}`,     { limit: 10, windowSecs: 60 })
export const registerLimiter = (ip: string) => rateLimit(`reg:${ip}`,      { limit: 5,  windowSecs: 300 })
export const analysisLimiter = (ip: string) => rateLimit(`analysis:${ip}`, { limit: 20, windowSecs: 60 })
export const exportLimiter   = (ip: string) => rateLimit(`export:${ip}`,   { limit: 10, windowSecs: 300 })
// Geração de PDF (uso intensivo de CPU/memória) — chaveado por usuário
export const reportLimiter   = (id: string) => rateLimit(`report:${id}`,   { limit: 10, windowSecs: 300 })
// Criação de preferência de pagamento / compra de tokens — chaveado por usuário
export const purchaseLimiter = (id: string) => rateLimit(`purchase:${id}`, { limit: 15, windowSecs: 300 })
// Explicação de interações via IA (Groq) — custo/latência por chamada, chaveado por usuário
export const explainLimiter  = (id: string) => rateLimit(`explain:${id}`,  { limit: 15, windowSecs: 300 })
// Sugestão de nota de resolução via IA (Groq) — chaveado por usuário
// Escritas clínicas (paciente, medicamento, nota, revisão, escala, conciliação,
// consulta de interação salva). Teto generoso — um farmacêutico em atendimento
// não chega perto disso; serve para conter script/loop abusivo por conta.
export const writeLimiter    = (id: string) => rateLimit(`write:${id}`,      { limit: 60, windowSecs: 60 })
export const aiSuggestLimiter = (id: string) => rateLimit(`ai-suggest:${id}`, { limit: 20, windowSecs: 300 })
