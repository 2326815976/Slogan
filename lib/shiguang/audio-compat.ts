import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ShiguangError } from './validation';

const maxBytes = 15 * 1024 * 1024;
let lastRecording: { fileId: string; result: Promise<Buffer> } | undefined;

async function convertRecording(content: Buffer) {
  const folder = await mkdtemp(join(tmpdir(), 'shiguang-audio-'));
  const output = join(folder, 'voice.m4a');
  try {
    await new Promise<void>((resolve, reject) => {
      const process = execFile('ffmpeg', [
        '-nostdin', '-hide_banner', '-loglevel', 'error', '-xerror',
        '-protocol_whitelist', 'pipe', '-f', 'matroska', '-threads', '1', '-i', 'pipe:0',
        '-map', '0:a:0', '-map_metadata', '-1', '-map_chapters', '-1', '-c:a', 'aac', '-profile:a', 'aac_low',
        '-threads', '1', '-ac', '1', '-ar', '44100', '-b:a', '96k', '-fs', String(maxBytes + 1024 * 1024),
        '-movflags', '+faststart', output,
      ], { timeout: 30000, killSignal: 'SIGKILL', windowsHide: true }, error => {
        if (!error) resolve();
        else if (error.code === 1) reject(new ShiguangError('录音文件无法解码', 415));
        else reject(error);
      });
      process.stdin?.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code !== 'EPIPE') reject(error);
      });
      process.stdin?.end(content);
    });
    if ((await stat(output)).size > maxBytes) throw new ShiguangError('转换后的录音超过 15MB', 413);
    return await readFile(output);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}

export async function playableRecording(content: Buffer, mime: string, fileId?: string) {
  if (!mime.startsWith('audio/') || content.length < 4 || content.readUInt32BE(0) !== 0x1a45dfa3) {
    return { content, mime };
  }
  if (!fileId) return { content: await convertRecording(content), mime: 'audio/mp4' };
  if (lastRecording?.fileId !== fileId) lastRecording = { fileId, result: convertRecording(content) };
  const recording = lastRecording;
  try {
    return { content: await recording.result, mime: 'audio/mp4' };
  } catch (error) {
    if (lastRecording === recording) lastRecording = undefined;
    throw error;
  }
}
