import Link from 'next/link';
import { ArrowLeft, LockKeyhole } from 'lucide-react';

/** 普通用户打开管理链接时只展示提示，不渲染后台内容。 */
export default function AdminAccessDenied() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#FFFBF0] px-6 py-12">
      <section className="w-full max-w-md rounded-[32px] border border-[#5D4037]/10 bg-white/85 p-8 text-center shadow-[0_16px_48px_rgba(93,64,55,0.08)]" aria-labelledby="admin-access-title">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#FFC857]/20 text-[#8D6E63]">
          <LockKeyhole size={32} strokeWidth={1.6} aria-hidden="true" />
        </div>
        <p className="mb-3 text-xs tracking-widest text-[#8D6E63]">拾光谣 · 管理空间</p>
        <h1 id="admin-access-title" className="text-2xl font-bold text-[#5D4037]">这里需要管理员权限</h1>
        <p className="mt-4 text-sm leading-7 text-[#8D6E63]">当前账号暂时无法访问此页面。<br />你可以返回个人中心，继续查看自己的拾光记录。</p>
        <Link href="/profile" className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#FFC857] px-5 font-semibold text-[#5D4037] transition-colors hover:bg-[#FFD477] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8D6E63]">
          <ArrowLeft size={18} aria-hidden="true" />返回个人中心
        </Link>
      </section>
    </main>
  );
}
