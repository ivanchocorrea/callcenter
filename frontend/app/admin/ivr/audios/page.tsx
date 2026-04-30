'use client';

import { useEffect, useRef, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { api, unwrap } from '@/lib/api/client';
import { ArrowLeft, Upload, Trash2, Volume2, FileAudio } from 'lucide-react';
import Link from 'next/link';

interface Audio {
  id: number;
  name: string;
  format: string;
  purpose: string;
  duration_seconds: number | null;
  transcription: string | null;
  created_at: string;
}

const PURPOSES = [
  { v: 'welcome', l: 'Bienvenida' },
  { v: 'menu', l: 'Menú principal' },
  { v: 'wait', l: 'Espera' },
  { v: 'moh', l: 'Música on-hold' },
  { v: 'out_of_hours', l: 'Fuera de horario' },
  { v: 'invalid_option', l: 'Opción inválida' },
  { v: 'timeout', l: 'Timeout' },
  { v: 'recording_disclosure', l: 'Aviso grabación' },
  { v: 'position', l: 'Posición en cola' },
  { v: 'custom', l: 'Personalizado' },
];

export default function IvrAudiosPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [audios, setAudios] = useState<Audio[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('welcome');
  const [transcription, setTranscription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  function reload() {
    setLoading(true);
    api.get('/ivr/audios/list')
      .then(r => setAudios(unwrap<Audio[]>(r)))
      .catch(e => setError(e?.response?.data?.error?.message ?? 'Error al cargar'))
      .finally(() => setLoading(false));
  }
  useEffect(() => { reload(); }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      setError('El archivo supera los 10 MB');
      return;
    }
    setSelectedFile(f);
    if (!name) setName(f.name.replace(/\.[^.]+$/, ''));
    setError(null);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selectedFile) return setError('Selecciona un archivo de audio');
    if (!name) return setError('Nombre requerido');

    setUploading(true);
    try {
      const reader = new FileReader();
      const b64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1] || result);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(selectedFile);
      const file_b64 = await b64Promise;

      const ext = selectedFile.name.split('.').pop()?.toLowerCase();
      const format = ext === 'wav' ? 'wav' : ext === 'mp3' ? 'mp3' : ext === 'ogg' ? 'ogg' : 'wav';

      await api.post('/ivr/audios', {
        name, file_b64, format, purpose,
        transcription: transcription || undefined,
      });

      setName(''); setTranscription(''); setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = '';
      reload();
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message ?? 'Error al subir';
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`¿Eliminar audio "${name}"?`)) return;
    try {
      await api.delete(`/ivr/audios/${id}`);
      reload();
    } catch (e: any) {
      alert(e?.response?.data?.error?.message ?? 'Error al eliminar');
    }
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl">
        <Link href="/admin/ivr" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" /> Volver a IVR
        </Link>

        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Audios IVR</h2>
          <p className="text-slate-500 mt-1">Sube audios MP3/WAV para usar en tus menús IVR (bienvenidas, opciones, fuera de horario...).</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Upload className="w-5 h-5 text-brand-600" /> Subir nuevo audio
          </h3>
          <form onSubmit={handleUpload} className="space-y-4">
            {error && <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">{error}</div>}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Archivo (MP3, WAV, OGG, máx. 10 MB) <span className="text-rose-500">*</span></label>
              <input ref={fileRef} type="file" accept="audio/mpeg,audio/wav,audio/ogg,.mp3,.wav,.ogg" onChange={handleFileChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              {selectedFile && (
                <p className="text-xs text-slate-500 mt-1">
                  📁 {selectedFile.name} · {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre <span className="text-rose-500">*</span></label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} required
                  placeholder="Bienvenida principal"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Propósito</label>
                <select value={purpose} onChange={e => setPurpose(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  {PURPOSES.map(p => <option key={p.v} value={p.v}>{p.l}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Transcripción (opcional, ayuda para búsquedas)</label>
              <textarea value={transcription} onChange={e => setTranscription(e.target.value)} rows={2}
                placeholder='"Bienvenido a NODOE, marque 1 para soporte..."'
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>

            <button type="submit" disabled={uploading || !selectedFile}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium">
              <Upload className="w-4 h-4" /> {uploading ? 'Subiendo…' : 'Subir audio'}
            </button>
          </form>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-900">Audios subidos ({audios.length})</h3>
            <p className="text-xs text-slate-500 mt-0.5">Asígnalos en /admin/ivr/[id] como bienvenida, menú, etc.</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Audio</th>
                <th className="text-left px-4 py-3 font-medium">Propósito</th>
                <th className="text-left px-4 py-3 font-medium">Formato</th>
                <th className="text-left px-4 py-3 font-medium">Duración</th>
                <th className="text-left px-4 py-3 font-medium">Subido</th>
                <th className="text-right px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Cargando…</td></tr>}
              {!loading && audios.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                  <FileAudio className="w-8 h-8 mx-auto mb-2 text-slate-300" />Sin audios todavía. Sube el primero arriba.
                </td></tr>
              )}
              {audios.map(a => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-brand-600" /> {a.name}
                    </div>
                    {a.transcription && <p className="text-xs text-slate-500 mt-0.5 italic truncate max-w-xs">"{a.transcription}"</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                      {PURPOSES.find(p => p.v === a.purpose)?.l ?? a.purpose}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700"><code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">{a.format}</code></td>
                  <td className="px-4 py-3 text-slate-700">{a.duration_seconds ? `${a.duration_seconds}s` : '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{new Date(a.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDelete(a.id, a.name)} className="text-slate-400 hover:text-rose-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
