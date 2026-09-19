import { handleUpload } from '@vercel/blob/client'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => ({
        maximumSizeInBytes: 300 * 1024 * 1024,
        addRandomSuffix: false,
        tokenPayload: JSON.stringify({ pathname }),
      }),
      onUploadCompleted: async () => undefined,
    })
    return NextResponse.json(jsonResponse)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể tạo phiên upload multipart.'
    console.error('[v0] Multipart upload failed:', message)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
