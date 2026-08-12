import { IBM_Plex_Sans_Arabic, Space_Grotesk } from "next/font/google";
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
