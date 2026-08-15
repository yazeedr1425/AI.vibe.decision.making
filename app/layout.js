import { IBM_Plex_Sans_Arabic, Space_Grotesk } from "next/font/google";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { ScreenProvider } from "@/lib/a11y/ScreenContext";
import Assistant from "./components/Assistant";
import "./globals.css";

const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-latin",
  subsets: ["latin"],
});

export const metadata = {
  title: "احسم — مساعد القرارات",
  description: "اكتب خياراتك، جاوب أسئلة سريعة، وأحسمها لك — مع السبب.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${plexArabic.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-ink"
        >
          تخطَّ إلى المحتوى
        </a>
        <AuthProvider>
          <ScreenProvider>
            {children}
            {/* آخر عنصر: يستقبل التركيز بعد المحتوى لا قبله */}
            <Assistant />
          </ScreenProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
