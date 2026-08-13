import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-8 text-sm text-muted sm:px-6">
        <p>احسم — يساعدك تحسم قراراتك اليومية بسرعة، مع السبب.</p>
        <nav className="flex items-center gap-4">
          <Link href="/how" className="transition-colors hover:text-foreground">
            كيف يعمل
          </Link>
          <Link
            href="/#history"
            className="transition-colors hover:text-foreground"
          >
            سجل القرارات
          </Link>
          <Link
            href="/settings"
            className="transition-colors hover:text-foreground"
          >
            الإعدادات
          </Link>
        </nav>
      </div>
    </footer>
  );
}
