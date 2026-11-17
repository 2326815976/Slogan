import { respond } from '@/lib/shiguang/http';
import { uploadMedia } from '@/lib/shiguang/media';
export async function POST(request: Request) { return respond(() => uploadMedia(request)); }
