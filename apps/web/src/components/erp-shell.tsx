'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  LayoutDashboard,
  FileText,
  Users,
  BriefcaseBusiness,
  Wrench,
  Ruler,
  CalendarDays,
  Factory,
  ShoppingCart,
  Warehouse,
  ShieldCheck,
  Truck,
  ChartNoAxesCombined,
  Contact,
  Clock3,
  Files,
  BarChart3,
  Settings,
  Search,
  Bell,
  ChevronDown,
  ChevronRight,
  LogOut,
  Menu,
  X,
  CircleHelp,
} from 'lucide-react';
import { useAuth } from './providers';
import { Loading } from './ui/common';
import { toast } from 'sonner';
const navigation = [
  ['Dashboard', LayoutDashboard, '/dashboard'],
  ['ใบเสนอราคา', FileText, ''],
  ['ลูกค้า / CRM', Users, ''],
  ['งาน / Project', BriefcaseBusiness, ''],
  ['วิศวกรรม', Wrench, ''],
  ['แบบ / Drawing', Ruler, ''],
  ['วางแผนการผลิต', CalendarDays, ''],
  ['ฝ่ายผลิต', Factory, '/work-orders'],
  ['จัดซื้อ / จัดจ้าง', ShoppingCart, ''],
  ['Store / คลัง', Warehouse, ''],
  ['QC', ShieldCheck, ''],
  ['แพ็ค / จัดส่ง', Truck, ''],
  ['ต้นทุน / กำไร', ChartNoAxesCombined, ''],
  ['HR', Contact, ''],
  ['ระบบบันทึกเวลา', Clock3, ''],
  ['เอกสาร', Files, ''],
  ['รายงาน', BarChart3, ''],
  ['ตั้งค่า', Settings, '/settings'],
] as const;
export function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[34px] font-bold italic leading-none tracking-[-3px] text-[#c62836]">
        ATS
        <span className="ml-1 inline-block h-5 w-[3px] bg-[#c62836]" />
      </span>
      <div
        className={`border-l pl-3 ${light ? 'border-white/20 text-white' : 'border-slate-200 text-slate-700'}`}
      >
        <div className="text-[11px] font-bold tracking-[1.3px]">COMPANY PLATFORM</div>
        <div
          className={`mt-0.5 text-[8px] tracking-[1.7px] ${light ? 'text-slate-400' : 'text-slate-400'}`}
        >
          AUTO-TECHSYSTEM
        </div>
      </div>
    </div>
  );
}
export function ErpShell({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState('');
  const [profile, setProfile] = useState(false);
  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);
  if (loading || !user)
    return (
      <div className="p-10">
        <Loading />
      </div>
    );
  return (
    <div className="min-h-screen">
      <header className="fixed inset-x-0 top-0 z-30 flex h-[76px] items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-7">
        <div className="flex items-center gap-3">
          <button aria-label="เปิดเมนู" className="lg:hidden" onClick={() => setMobile(!mobile)}>
            <Menu size={22} />
          </button>
          <Link href="/dashboard">
            <Brand />
          </Link>
        </div>
        <form
          className="hidden w-[390px] items-center gap-2 rounded-lg bg-[#f5f7fa] px-3 md:flex"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(`/work-orders?search=${encodeURIComponent(search)}`);
          }}
        >
          <Search size={17} className="text-slate-400" />
          <input
            aria-label="ค้นหาทั้งระบบ"
            placeholder="ค้นหาเลขที่เอกสาร ชิ้นงาน หรือคำสำคัญ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ background: 'transparent', border: 0, boxShadow: 'none' }}
          />
          <span className="whitespace-nowrap rounded border border-slate-200 px-1 text-[10px] text-slate-400">
            ↵
          </span>
        </form>
        <div className="flex items-center gap-4">
          <button
            aria-label="งานที่ต้องทำ"
            onClick={() => router.push('/dashboard')}
            className="relative text-slate-500"
          >
            <Bell size={19} />
          </button>
          <span className="hidden border-r border-slate-200 pr-4 text-xs text-slate-500 sm:block">
            TH
          </span>
          <div className="relative">
            <button className="flex items-center gap-2" onClick={() => setProfile(!profile)}>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700">
                {user.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="hidden text-left sm:block">
                <span className="block text-xs font-semibold">{user.name}</span>
                <span className="text-[10px] text-slate-400">{user.position}</span>
              </span>
              <ChevronDown size={14} className="text-slate-400" />
            </button>
            {profile && (
              <div className="absolute right-0 top-12 w-48 rounded-xl border bg-white p-2 shadow-lg">
                <p className="px-2 py-2 text-xs text-slate-400">{user.roles.join(', ')}</p>
                <button
                  className="flex w-full items-center gap-2 rounded-lg p-2 text-sm hover:bg-slate-50"
                  onClick={async () => {
                    try {
                      await logout();
                      router.replace('/login');
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                >
                  <LogOut size={15} />
                  ออกจากระบบ
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      {mobile && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden"
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        className={`scrollbar-thin fixed bottom-0 left-0 top-[76px] z-40 flex w-[232px] flex-col overflow-y-auto border-r border-slate-200 bg-white transition-transform lg:translate-x-0 ${mobile ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-6 pb-2 pt-6">
          <span className="text-[9px] font-semibold tracking-[1.7px] text-slate-400">
            WORKSPACE
          </span>
          <button className="lg:hidden" aria-label="ปิดเมนู" onClick={() => setMobile(false)}>
            <X size={16} />
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-2">
          {navigation.map(([label, Icon, path]) => {
            const active = path && pathname.startsWith(path);
            const style = `flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] ${active ? 'bg-[#fceef0] font-semibold text-[#c62836]' : path ? 'text-slate-600 hover:bg-slate-50' : 'cursor-default text-slate-400'}`;
            return (
              <div key={label}>
                {path ? (
                  <Link href={path} className={style} onClick={() => setMobile(false)}>
                    <Icon size={17} />
                    {label}
                    {label === 'ฝ่ายผลิต' && <ChevronDown className="ml-auto" size={13} />}
                  </Link>
                ) : (
                  <button disabled title="เตรียมรองรับในเวอร์ชันถัดไป" className={style}>
                    <Icon size={17} />
                    {label}
                  </button>
                )}
                {label === 'ฝ่ายผลิต' && active && (
                  <Link
                    href="/work-orders"
                    className="ml-8 mt-1 block border-l-2 border-[#c62836] py-2 pl-4 text-[11px] font-medium text-[#c62836]"
                  >
                    ใบสั่งงานผลิตชั่วคราว
                  </Link>
                )}
              </div>
            );
          })}
        </nav>
        <div className="m-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
          <div className="flex items-center gap-2 text-xs font-medium">
            <CircleHelp size={15} />
            ATS Work Order
          </div>
          <p className="mt-1 text-[10px] text-slate-400">Company Platform · Version 1.0</p>
        </div>
      </aside>
      <main className="print-content min-h-screen px-4 pb-8 pt-[104px] lg:ml-[232px] lg:px-8">
        {children}
        <footer className="no-print mt-10 flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-4 text-[10px] text-slate-400">
          <span>© {new Date().getFullYear()} AUTO-TECHSYSTEM CO., LTD.</span>
          <span>ATS Company Platform · Temporary Work Order</span>
        </footer>
      </main>
    </div>
  );
}
export function PageHeader({
  title,
  subtitle,
  action,
  crumb = 'ฝ่ายผลิต / ใบสั่งงานผลิตชั่วคราว',
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
  crumb?: string;
}) {
  return (
    <div className="mb-7">
      <p className="mb-4 flex items-center gap-2 text-[11px] text-slate-400">
        <Link href="/dashboard">ATS Platform</Link>
        <ChevronRight size={11} />
        {crumb}
      </p>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[25px] font-semibold tracking-tight text-[#17243b]">{title}</h1>
          <p className="mt-1.5 text-xs text-slate-400">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">{action}</div>
      </div>
    </div>
  );
}
