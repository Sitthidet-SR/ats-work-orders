import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-5xl font-semibold text-slate-300">404</p>
      <h1 className="text-xl font-semibold">ไม่พบหน้าที่ต้องการ</h1>
      <Link className="text-sm text-blue-600" href="/dashboard">
        กลับหน้า Dashboard
      </Link>
    </div>
  );
}
