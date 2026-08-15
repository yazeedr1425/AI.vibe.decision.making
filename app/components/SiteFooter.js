import Link from "next/link";

// فوتر حبري: يقفل الصفحة بنفس اللوح الغامق اللي فتحتها فيه شاشة
// الدخول — الورق بين دفّتين.
export default function SiteFooter() {
  return (
    <footer className="on-ink mt-16 bg-ink text-on-ink">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-10 text-sm sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-base font-bold text-accent-ink">
            حـ
          </span>
          <p className="text-on-ink-muted">
            احسم — يساعدك تحسم قراراتك اليومية بسرعة، مع السبب.
          </p>
        </div>
        <nav className="flex items-center gap-5 text-on-ink-muted">
          <Link href="/how" className="transition-colors hover:text-on-ink">
            كيف يعمل
          </Link>
          <Link href="/#history" className="transition-colors hover:text-on-ink">
            سجل القرارات
          </Link>
          <Link href="/settings" className="transition-colors hover:text-on-ink">
            الإعدادات
          </Link>
        </nav>
      </div>
    </footer>
  );
}
