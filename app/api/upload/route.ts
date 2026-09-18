import { put } from '@vercel/blob'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!file || typeof file === 'string' || typeof (file as File).arrayBuffer !== 'function' || typeof (file as File).name !== 'string') return NextResponse.json({ error: 'Thiếu file tải lên' }, { status: 400 })
    console.log('[v0] Upload received:', (file as File).name, (file as File).size, (file as File).type)

    const parts = String(formData.get('path') || file.name).replaceAll('\\', '/').replace(/^\/+/, '').split('/').filter((part) => part && part !== '.' && part !== '..').map((part) => part.replace(/[^a-zA-Z0-9._-]/g, '-'))
    const safeName = (parts.pop() || 'file').slice(0, 180)
    const folderPath = parts.length ? `${parts.join('/')}/` : ''
    const blob = await put(`atelier/${folderPath}${Date.now()}-${safeName}`, file, {
      access: 'public',
      addRandomSuffix: false,
      contentType: file.type || 'application/octet-stream',
    })

    return NextResponse.json({ url: blob.url, pathname: blob.pathname, size: file.size, contentType: file.type, uploadedAt: new Date().toISOString() })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi không xác định'
    console.error('[v0] Blob upload failed:', message)
    return NextResponse.json({ error: `Không thể tải file lên Blob: ${message}` }, { status: 500 })
  }
}
