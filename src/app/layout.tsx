import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { THEME_INIT_SCRIPT } from "@/components/layout/theme-toggle";

export const metadata: Metadata = {
  title: { default: "Digitusul Hub", template: "%s · Digitusul Hub" },
  description: "Plataforma interna de soluções Digitusul",
  icons: { icon: "/brand/digitusul-icon.svg" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: [{ media: "(prefers-color-scheme: light)", color: "#F3F6FC" }, { media: "(prefers-color-scheme: dark)", color: "#070B16" }] };

// Fontes da interface e do editor (o canvas precisa das famílias reais carregadas no documento).
const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Montserrat:wght@400;600;700;800;900&family=Poppins:wght@400;600;700;800&family=Roboto:wght@400;700;900&family=Oswald:wght@400;600;700&family=Playfair+Display:wght@400;700;900&display=swap";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href={FONTS_URL} />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
