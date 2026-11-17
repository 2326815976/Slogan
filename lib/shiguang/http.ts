import { NextResponse } from 'next/server';
import { publicError } from './db';
import { object, ShiguangError } from './validation';

export async function body(request: Request) {
  if (Number(request.headers.get('content-length') || 0) > 65536) throw new ShiguangError('提交内容过大', 413);
  const raw = await request.text();
  if (raw.length > 65536) throw new ShiguangError('提交内容过大', 413);
  try { return object(JSON.parse(raw)); } catch { throw new ShiguangError('请求 JSON 格式错误'); }
}
export async function respond(work: () => Promise<unknown>) {
  try { return NextResponse.json({ data: await work() }, { headers: { 'Cache-Control': 'private, no-store' } }); }
  catch (error) {
    const result = publicError(error);
    return NextResponse.json({ error: result.message }, { status: result.status, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
