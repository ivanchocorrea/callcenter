import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center text-center px-6">
      <div>
        <h1 className="text-7xl font-bold text-brand-600">404</h1>
        <p className="mt-2 text-slate-600">Página no encontrada</p>
        <Link href="/" className="mt-4 inline-block text-brand-600 hover:text-brand-700 underline">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
