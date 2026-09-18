import JSZip from 'jszip'
import { put } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const { url, prefix = 'atelier/unzipped' } = await request.json()
    if (!url || typeof url !== 'string') return NextResponse.json({ error: 'Thiếu URL file ZIP.' }, { status: 400 })
    const source = await fetch(url)
    if (!source.ok) return NextResponse.json({ error: `Không đọc được ZIP (${source.status}).` }, { status: 400 })
    const zip = await JSZip.loadAsync(await source.arrayBuffer())
    const entries = Object.values(zip.files).filter((entry) => !entry.dir)
    const safePrefix = String(prefix).replace(/^\/+/, '').replace(/\/+$/, '')
    if (!safePrefix.startsWith('atelier/')) return NextResponse.json({ error: 'Đường dẫn giải nén không hợp lệ.' }, { status: 400 })
    const uploaded: string[] = []
    for (const entry of entries) {
      const parts = entry.name.replaceAll('\\', '/').split('/').filter((part) => part && part !== '.' && part !== '..').map((part) => part.replace(/[^a-zA-Z0-9._-]/g, '-'))
      if (!parts.length) continue
      const name = parts.pop()!
      const path = `${safePrefix}/${parts.join('/')}${parts.length ? '/' : ''}${name}`
      const content = await entry.async('uint8array')
      const blob = await put(path, new Blob([content]), { access: 'public', addRandomSuffix: true })
      uploaded.push(blob.pathname)
    }
    return NextResponse.json({ extracted: uploaded.length, files: uploaded })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ZIP không hợp lệ.'
    console.error('[v0] unzip failed:', message)
    return NextResponse.json({ error: `Giải nén thất bại: ${message}` }, { status: 500 })
  }
}
