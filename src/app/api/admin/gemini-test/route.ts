import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    return NextResponse.json({ status: 'inactive', message: 'GEMINI_API_KEY não configurada no servidor.' })
  }

  // Testa a chave com uma requisição mínima
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Responda apenas: OK' }] }],
          generationConfig: { maxOutputTokens: 10, temperature: 0 },
        }),
        signal: AbortSignal.timeout(15000),
      }
    )

    if (!response.ok) {
      const err = await response.text()
      return NextResponse.json({ status: 'error', message: `Erro HTTP ${response.status}`, detail: err.substring(0, 200) })
    }

    const data = await response.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''

    return NextResponse.json({
      status: 'active',
      message: 'Google Gemini está funcionando corretamente.',
      response: text.trim(),
      model: 'gemini-2.0-flash',
    })
  } catch (err: any) {
    return NextResponse.json({ status: 'error', message: err.message || 'Erro desconhecido' })
  }
}
