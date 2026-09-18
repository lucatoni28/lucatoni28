import { list } from '@vercel/blob'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    let cursor: string | undefined
    let totalBytes = 0
    let totalFiles = 0

    do {
      const page = await list({ prefix: 'atelier/', limit: 1000, cursor })
      const files = page.blobs.filter((blob) => !blob.pathname.endsWith('/.keep'))
      totalFiles += files.length
      totalBytes += files.reduce((sum, file) => sum + file.size, 0)
      cursor = page.hasMore ? page.cursor : undefined
    } while (cursor)

    return NextResponse.json(
      { totalFiles, totalBytes, bucket: 'public / vuakiemhiep.acc', measuredAt: new Date().toISOString() },
      { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=120' } },
    )
  } catch (error) {
    console.error('[v0] Bucket stats failed:', error)
    return NextResponse.json({ error: 'Không thể đọc tổng dung lượng bucket.' }, { status: 500 })
  }
}
