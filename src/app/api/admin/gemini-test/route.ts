import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const apiKey = process.env.GROQ_API_KEY

  if (!apiKey) {
    return NextResponse.json({ status: 'inactive', message: 'GROQ_API_KEY não configurada no servidor.' })
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: 'Responda apenas: OK' }],
        max_tokens: 10,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      const err = await response.text()
      return NextResponse.json({ status: 'error', message: `Erro HTTP ${response.status}`, detail: err.substring(0, 300) })
    }

    const data = await response.json()
    const text = data?.choices?.[0]?.message?.content || ''

    return NextResponse.json({
      status: 'active',
      message: 'Groq IA está funcionando corretamente.',
      response: text.trim(),
      model: 'llama-3.3-70b-versatile',
    })
  } catch (err: any) {
    return NextResponse.json({ status: 'error', message: err.message || 'Erro desconhecido' })
  }
}
