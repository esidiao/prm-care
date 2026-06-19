/**
 * Embeddings via Hugging Face Inference API (custo zero — token HF_TOKEN).
 * Usado como RERANKER semântico dos trechos de fonte candidatos antes de enviar
 * ao explicador. Degrada com elegância: se o HF falhar/indisponível, mantém a
 * ordem original (a recuperação lexical continua funcionando).
 */
const HF_MODEL = 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'
const HF_URL = `https://api-inference.huggingface.co/pipeline/feature-extraction/${HF_MODEL}`

export async function embed(texts: string[]): Promise<number[][] | null> {
  const token = process.env.HF_TOKEN
  if (!token || texts.length === 0) return null
  try {
    const r = await fetch(HF_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: texts, options: { wait_for_model: true } }),
      signal: AbortSignal.timeout(20000),
    })
    if (!r.ok) return null
    const data = await r.json()
    if (Array.isArray(data) && Array.isArray(data[0]) && typeof data[0][0] === 'number') return data as number[][]
    return null
  } catch {
    return null
  }
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0
}

/** Reordena `candidates` por similaridade semântica com `query` e devolve os top-K. */
export async function rerank<T extends { content: string }>(query: string, candidates: T[], topK = 4): Promise<T[]> {
  if (candidates.length <= topK) return candidates
  const vecs = await embed([query, ...candidates.map(c => c.content.slice(0, 800))])
  if (!vecs || vecs.length !== candidates.length + 1) return candidates.slice(0, topK)
  const q = vecs[0]
  return candidates
    .map((c, i) => ({ c, s: cosine(q, vecs[i + 1]) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, topK)
    .map(x => x.c)
}
