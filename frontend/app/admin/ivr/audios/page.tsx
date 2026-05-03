'use client';

import { useEffect, useRef, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { api, unwrap, tokens } from '@/lib/api/client';
import { ArrowLeft, Upload, Trash2, Volume2, FileAudio, Play, Pause, Calendar, Clock } from 'lucide-react';
import Link from 'next/link';
import { ConfirmDialog, Toast, DialogIcons } from '@/components/shared/Dialog';

interface Audio {
  id: number;
  name: string;
  format: string;
  purpose: string;
  duration_seconds: number | null;
  durationSeconds?: number | null;
  transcription: string | null;
  created_at: string;
  createdAt?: string;
  file_size_bytes?: number | null;
  fileSizeBytes?: number | null;
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

function formatDuration(s: number | null | undefined): string {
  if (!s || s <= 0) return '—';
  const min = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${min}:${String(sec).padStart(2, '0')}`;
}

function formatBytes(b: number | null | undefined): string {
  if (!b) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

function formatDateTime(d: string | undefined): string {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' · ' + dt.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  } catch { return d; }
}

/** Calcula la duración del audio en el cliente leyendo el blob con un <audio>. */
function probeAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      const d = isFinite(audio.duration) ? Math.round(audio.duration) : 0;
      URL.revokeObjectURL(url);
      resolve(d);
    };
    audio.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
    audio.src = url;
  });
}

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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewDuration, setPreviewDuration] = useState<number>(0);

  // Reproducción inline
  const [playingId, setPlayingId] = useState<number | null>(null);
  const audioRefs = useRef<Record<number, HTMLAudioElement | null>>({});

  // Modal eliminar
  const [confirmDelete, setConfirmDelete] = useState<Audio | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; variant: 'success' | 'danger' | 'info' } | null>(null);

  function reload() {
    setLoading(true);
    api.get('/ivr/audios/list')
      .then(r => setAudios(unwrap<Audio[]>(r)))
      .catch(e => setError(e?.response?.data?.error?.message ?? 'Error al cargar'))
      .finally(() => setLoading(false));
  }
  useEffect(() => { reload(); }, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      setError('El archivo supera los 10 MB');
      return;
    }
    setSelectedFile(f);
    if (!name) setName(f.name.replace(/\.[^.]+$/, ''));
    setError(null);

    // Crear preview URL para escuchar antes de subir
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(f));

    // Calcular duración del audio
    const dur = await probeAudioDuration(f);
    setPreviewDuration(dur);
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

      // Calcular duración si aún no la tenemos
      let dur = previewDuration;
      if (!dur) dur = await probeAudioDuration(selectedFile);

      await api.post('/ivr/audios', {
        name, file_b64, format, purpose,
        transcription: transcription || undefined,
        duration_seconds: dur || undefined,
      });

      // Reset
      setName(''); setTranscription(''); setSelectedFile(null);
      setPreviewDuration(0);
      if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
      if (fileRef.current) fileRef.current.value = '';
      setToast({ msg: 'Audio subido correctamente', variant: 'success' });
      reload();
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message ?? 'Error al subir';
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setUploading(false);
    }
  }

  async function executeDelete() {
    if (!confirmDelete) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/ivr/audios/${confirmDelete.id}`);
      setToast({ msg: `Audio "${confirmDelete.name}" eliminado`, variant: 'success' });
      setConfirmDelete(null);
      reload();
    } catch (e: any) {
      setToast({ msg: e?.response?.data?.error?.message ?? 'Error al eliminar', variant: 'danger' });
    } finally {
      setDeleteLoading(false);
    }
  }

  function togglePlay(id: number) {
    const el = audioRefs.current[id];
    if (!el) return;
    // Pausar cualquier otro
    Object.entries(audioRefs.current).forEach(([k, audio]) => {
      if (Number(k) !== id && audio) { audio.pause(); audio.currentTime = 0; }
    });
    if (playingId === id) {
      el.pause();
      setPlayingId(null);
    } else {
      el.play().catch(() => setToast({ msg: 'Error al reproducir audio', variant: 'danger' }));
      setPlayingId(id);
    }
  }

  // URL para reproducir un audio del servidor (con token Bearer en query)
  function audioStreamUrl(id: number): string {
    const base = api.defaults.baseURL ?? '/api';
    const token = tokens.getAccess() ?? '';
    return `${base}/ivr/audios/${id}/file?token=${encodeURIComponent(token)}`;
  }

  // Cleanup preview URL al desmontar
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl">
        <Link href="/admin/ivr" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" /> Volver a IVR
        </Link>

        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Audios IVR</h2>
          <p className="text-slate-500 mt-1">Sube audios MP3/WAV/OGG para usar en tus menús IVR (bienvenidas, opciones, fuera de horario...).</p>
        </div>

        {/* SUBIR */}
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
                  📁 {selectedFile.name} · {formatBytes(selectedFile.size)}
                  {previewDuration > 0 && <> · Duración: <strong>{formatDuration(previewDuration)}</strong></>}
                </p>
              )}
            </div>

            {/* Reproductor de preview ANTES de subir */}
            {previewUrl && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Volume2 className="w-4 h-4 text-emerald-700" />
                  <span className="text-sm font-medium text-emerald-900">Vista previa antes de subir</span>
                </div>
                <audio src={previewUrl} controls className="w-full" />
              </div>
            )}

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

        {/* LISTA */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-900">Audios subidos ({audios.length})</h3>
            <p className="text-xs text-slate-500 mt-0.5">Reproduce cada audio para verificar antes de asignarlo en /admin/ivr/[id].</p>
          </div>
          <div className="divide-y divide-slate-100">
            {loading && <div className="px-4 py-8 text-center text-slate-500">Cargando…</div>}
            {!loading && audios.length === 0 && (
              <div className="px-4 py-12 text-center text-slate-500">
                <FileAudio className="w-8 h-8 mx-auto mb-2 text-slate-300" />Sin audios todavía. Sube el primero arriba.
              </div>
            )}
            {audios.map(a => {
              const dur = a.duration_seconds ?? a.durationSeconds;
              const created = a.created_at ?? a.createdAt;
              const size = a.file_size_bytes ?? a.fileSizeBytes;
              return (
                <div key={a.id} className="group px-5 py-4 hover:bg-slate-50 transition">
                  <div className="flex items-center gap-4">
                    {/* Botón Play/Pause grande */}
                    <button
                      onClick={() => togglePlay(a.id)}
                      className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition ${
                        playingId === a.id
                          ? 'bg-brand-600 text-white shadow-lg'
                          : 'bg-slate-100 text-slate-600 hover:bg-brand-100 hover:text-brand-700'
                      }`}
                      title={playingId === a.id ? 'Pausar' : 'Reproducir'}
                    >
                      {playingId === a.id ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                    </button>

                    {/* Audio invisible — UNICO elemento que reproduce, controlado
                        por el boton custom de arriba. Antes habia DOS audios
                        (este + un inline con autoPlay debajo) reproduciendo
                        el mismo archivo con ms de offset → sonaba como eco. */}
                    <audio
                      ref={el => { audioRefs.current[a.id] = el; }}
                      src={audioStreamUrl(a.id)}
                      onEnded={() => setPlayingId(null)}
                      onPause={() => { if (playingId === a.id) setPlayingId(null); }}
                      preload="none"
                    />

                    {/* Info principal */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-900 truncate">{a.name}</span>
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                          {PURPOSES.find(p => p.v === a.purpose)?.l ?? a.purpose}
                        </span>
                        <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{a.format}</code>
                      </div>
                      {a.transcription && (
                        <p className="text-xs text-slate-500 mt-0.5 italic truncate">"{a.transcription}"</p>
                      )}
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {formatDuration(dur)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {formatDateTime(created)}
                        </span>
                        <span>{formatBytes(size)}</span>
                      </div>
                    </div>

                    {/* Acción eliminar */}
                    <button
                      onClick={() => setConfirmDelete(a)}
                      title="Eliminar audio"
                      className="shrink-0 p-2 rounded-lg text-slate-400 hover:bg-rose-100 hover:text-rose-600 opacity-30 group-hover:opacity-100 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Barra de progreso simple cuando esta sonando — usa el
                      MISMO audio element de arriba (no monta uno nuevo). */}
                  {playingId === a.id && (
                    <div className="mt-3 ml-16 flex items-center gap-2 text-xs text-slate-500">
                      <Volume2 className="w-3.5 h-3.5 text-brand-600 animate-pulse" />
                      <span>Reproduciendo…</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Eliminar audio"
        message={confirmDelete && (
          <>
            Vas a eliminar <strong>"{confirmDelete.name}"</strong>.
            <br /><span className="text-xs text-slate-500 mt-2 block">Si está en uso por algún IVR, ese IVR dejará de reproducir el audio. Asegúrate de no romper menús activos.</span>
          </>
        )}
        variant="danger"
        icon={DialogIcons.Trash}
        confirmText="Sí, eliminar"
        onConfirm={executeDelete}
        onCancel={() => !deleteLoading && setConfirmDelete(null)}
        loading={deleteLoading}
      />

      <Toast
        open={toast !== null}
        message={toast?.msg ?? ''}
        variant={toast?.variant ?? 'info'}
        onClose={() => setToast(null)}
      />
    </AppShell>
  );
}
