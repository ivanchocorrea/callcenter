import './globals.css';
import type { Metadata } from 'next';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Call Center NODOE',
  description: 'Plataforma SaaS de Call Center multiempresa con IA',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      {/* Sin next/font/google porque al buildear en VPS sin acceso confiable
          a fonts.googleapis.com el build falla. Usamos system-ui via la
          font-family de Tailwind (en globals.css o tailwind.config) para
          tener una tipografia limpia sin dependencias remotas. */}
      <body className="font-sans antialiased bg-slate-50 text-slate-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
