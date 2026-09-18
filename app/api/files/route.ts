import { del, list, put } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get('limit') || 100), 20), 200)
    const cursor = request.nextUrl.searchParams.get('cursor') || undefined
    const result = await list({ prefix: 'atelier/', limit, cursor })
    const markers = result.blobs.filter((blob) => blob.pathname.endsWith('/.keep'))
    const files = result.blobs.filter((blob) => !blob.pathname.endsWith('/.keep'))
    const folders = markers.map((blob) => ({ pathname: blob.pathname.slice(0, -'/.keep'.length), createdAt: blob.uploadedAt }))
    return NextResponse.json({ files, folders, cursor: result.cursor ?? null, hasMore: result.hasMore, pageBytes: files.reduce((sum, file) => sum + file.size, 0) }, { headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=60' } })
  } catch (error) {
    console.error('[v0] Blob list failed', error)
    return NextResponse.json({ error: 'Không thể đọc danh sách file' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const folder = String(body.folder || '').replace(/^\/+|\/+$/g, '').replace(/[^a-zA-Z0-9._/-]/g, '-')
    if (!folder) return NextResponse.json({ error: 'Tên thư mục không hợp lệ' }, { status: 400 })
    const blob = await put(`atelier/${folder}/.keep`, new Blob(['folder']), { access: 'public', addRandomSuffix: false, contentType: 'text/plain' })
    return NextResponse.json({ pathname: blob.pathname })
  } catch (error) {
    console.error('[v0] Folder create failed', error)
    return NextResponse.json({ error: 'Không thể tạo thư mục' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { pathname, name } = await request.json()
    if (typeof pathname !== 'string' || typeof name !== 'string' || !name.trim()) return NextResponse.json({ error: 'Tên file không hợp lệ' }, { status: 400 })
    const safeName = name.trim().replace(/[^a-zA-Z0-9._-]/g, '-')
    const source = (await list({ prefix: pathname })).blobs[0]
    if (!source) return NextResponse.json({ error: 'Không tìm thấy file' }, { status: 404 })
    const nextPath = `${pathname.slice(0, pathname.lastIndexOf('/') + 1)}${safeName}`
    const response = await fetch(source.url)
    const blob = await put(nextPath, await response.blob(), { access: 'public', addRandomSuffix: false, contentType: source.contentType })
    await del(source.url)
    return NextResponse.json({ url: blob.url, pathname: blob.pathname, size: source.size, uploadedAt: new Date().toISOString() })
  } catch (error) {
    console.error('[v0] Rename failed', error)
    return NextResponse.json({ error: 'Không thể đổi tên file' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const pathname = typeof body.pathname === 'string' ? body.pathname : ''
    const prefix = typeof body.prefix === 'string' ? body.prefix : ''
    if (!pathname && !prefix) return NextResponse.json({ error: 'Thiếu file hoặc thư mục cần xóa' }, { status: 400 })
    const targets = pathname ? [pathname] : (await list({ prefix })).blobs.map((blob) => blob.url)
    if (targets.length) await del(targets)
    return NextResponse.json({ deleted: targets.length })
  } catch (error) {
    console.error('[v0] Blob delete failed', error)
    return NextResponse.json({ error: 'Không thể xóa file hoặc thư mục' }, { status: 500 })
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
