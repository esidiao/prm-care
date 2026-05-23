import { NextRequest, NextResponse } from 'next/server'
import { searchICD10 } from '@/lib/icd10-data'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? ''
  const results = searchICD10(q, 10)
  return NextResponse.json(results)
}
