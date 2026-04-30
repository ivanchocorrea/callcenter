'use client';

import { FormEvent, useState } from 'react';
import { api } from '@/lib/api/client';
import { X, Eye, EyeOff } from 'lucide-react';

interface Props { onClose: () => void; onSaved: () => void; }

const DRIVERS = [
  { v: 'local', l: 'Local (disco del servidor)', desc: 'Gratis pero limitado al espacio del VPS' },
  { v: 's3', l: 'AWS S3', desc: 'Amazon Web Services S3' },
  { v: 'minio', l: 'MinIO (self-hosted)', desc: 'S3 compatible auto-alojado' },
  { v: 'wasabi', l: 'Wasabi', desc: 'S3 compatible más barato' },
  { v: 'backblaze', l: 'Backblaze B2', desc: 'S3 compatible muy económico' },
];

export function StorageProviderFormModal({ onClose, onSaved }: Props) {
  const [driver, setDriver] = useState<'local'|'s3'|'minio'|'wasabi'|'backblaze'>('s3');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [bucket, setBucket] = useState('');
  const [region, setRegion] = useState('us-east-1');
  const [endpoint, setEndpoint] = useState('');
  const [accessKey, setAccessKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [usePathStyle, setUsePathStyle] = useState(true);
  const [basePath, setBasePath] = useState('/var/recordings');
  const [isDefault, setIsDefault] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleDriverChange(d: typeof driver) {
    setDriver(d);
    if (!name) setName(DRIVERS.find(x => x.v === d)?.l ?? d);
    if (!slug) setSlug(d);
    if (d === 'wasabi' && !endpoint) setEndpoint('https://s3.wasabisys.com');
    if (d === 'backblaze' && !endpoint) setEndpoint('https://s3.us-west-002.backblazeb2.com');
    if (d === 'minio' && !endpoint) setEndpoint('https://minio.tu-dominio.com');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name) return setError('Nombre requerido');
    if (!slug) return setError('Slug requerido');
    if (driver !== 'local') {
      if (!bucket) return setError('Bucket requerido');
      if (!accessKey) return setError('Access key requerida');
      if (!secretKey) return setError('Secret key requerida');
    }

    setSubmitting(true);
    try {
      await api.post('/storage/providers', {
        slug, name, driver,
        bucket: driver === 'local' ? undefined : bucket,
        region: driver === 'local' ? undefined : region,
        endpoint: endpoint || undefined,
        access_key: accessKey || undefined,
        secret_key: secretKey || undefined,
        use_path_style: usePathStyle,
        base_path: driver === 'local' ? basePath : undefined,
        is_default: isDefault,
        is_active: true,
      });
      onSaved();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message ?? 'Error al crear storage';
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Nuevo proveedor de almacenamiento</h3>
            <p className="text-xs text-slate-500 mt-0.5">Para grabaciones de llamadas. Credenciales cifradas con AES-256.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Driver <span className="text-rose-500">*</span></label>
            <div className="space-y-2">
              {DRIVERS.map(d => (
                <label key={d.v} className={`flex items-start gap-3 px-3 py-2 border rounded-lg cursor-pointer ${driver === d.v ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input type="radio" name="driver" value={d.v} checked={driver === d.v} onChange={() => handleDriverChange(d.v as any)} className="mt-1" />
                  <div className="text-sm">
                    <div className="font-medium text-slate-900">{d.l}</div>
                    <p className="text-xs text-slate-500">{d.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre <span className="text-rose-500">*</span></label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Slug <span className="text-rose-500">*</span></label>
              <input type="text" value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" />
            </div>
          </div>

          {driver === 'local' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ruta base en el servidor</label>
              <input type="text" value={basePath} onChange={e => setBasePath(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" />
            </div>
          )}

          {driver !== 'local' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Bucket <span className="text-rose-500">*</span></label>
                  <input type="text" value={bucket} onChange={e => setBucket(e.target.value)} required
                    placeholder="mi-empresa-recordings"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Región</label>
                  <input type="text" value={region} onChange={e => setRegion(e.target.value)}
                    placeholder="us-east-1"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Endpoint URL (custom)</label>
                <input type="url" value={endpoint} onChange={e => setEndpoint(e.target.value)}
                  placeholder="Solo para MinIO/Wasabi/Backblaze. Vacío para AWS S3 estándar."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Access Key <span className="text-rose-500">*</span></label>
                <input type="text" value={accessKey} onChange={e => setAccessKey(e.target.value)} required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Secret Key <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <input type={showSecret ? 'text' : 'password'} value={secretKey} onChange={e => setSecretKey(e.target.value)} required
                    className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg text-sm font-mono" />
                  <button type="button" onClick={() => setShowSecret(s => !s)} className="absolute right-2 top-2 text-slate-400 hover:text-slate-600">
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={usePathStyle} onChange={e => setUsePathStyle(e.target.checked)} />
                Usar path-style URLs (necesario para MinIO/algunas configuraciones)
              </label>
            </>
          )}

          <label className="flex items-center gap-2 text-sm text-slate-700 pt-2 border-t border-slate-100">
            <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} />
            Usar como storage por defecto para nuevas grabaciones
          </label>
        </form>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50 sticky bottom-0">
          <button type="button" onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50">Cancelar</button>
          <button type="button" onClick={handleSubmit as any} disabled={submitting} className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium">
            {submitting ? 'Creando…' : 'Crear storage'}
          </button>
        </div>
      </div>
    </div>
  );
}
