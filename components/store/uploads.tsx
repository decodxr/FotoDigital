'use client';
import { Progress } from '@/components/ui/progress';
import type { Photo } from '@/lib/shared/types';
import { CheckCircle2, FileText, ImagePlus, LockKeyhole, RefreshCw, Upload, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, useStore } from './context';
import { Button, Check, Notice } from './ui';
type Task = {
    id: string;
    file: File;
    progress: number;
    error?: string;
    done?: boolean;
};
async function preview(file: File): Promise<{
    width: number;
    height: number;
    blob: Blob | null;
}> { if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))
    return { width: 0, height: 0, blob: null }; let bitmap: ImageBitmap; try {
    bitmap = await createImageBitmap(file);
}
catch {
    return { width: 0, height: 0, blob: null };
} const { width, height } = bitmap; if (width * height > 120000000) {
    bitmap.close();
    throw Error('A imagem ultrapassa 120 megapixels. Fale com a loja para enviar este arquivo.');
} const canvas = document.createElement('canvas'); const scale = Math.min(1, 600 / Math.max(width, height)); canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale)); const ctx = canvas.getContext('2d')!; ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close(); const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', .83)); return { width, height, blob }; }
function transfer(url: string, file: File, onProgress: (n: number) => void) { return new Promise<void>((resolve, reject) => { const xhr = new XMLHttpRequest(); xhr.open('PUT', url); xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream'); xhr.upload.onprogress = e => { if (e.lengthComputable)
    onProgress(Math.round(e.loaded / e.total * 90)); }; xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(Error('O envio foi interrompido. Tente novamente.')); xhr.onerror = () => reject(Error('Sem conexão. Seu arquivo pode ser reenviado.')); xhr.ontimeout = () => reject(Error('O envio demorou mais do que o esperado. Tente novamente.')); xhr.timeout = 600000; xhr.send(file); }); }
export function UploadZone({ onUploaded, documents = false, multiple = true }: {
    onUploaded: (photo: Photo) => void;
    documents?: boolean;
    multiple?: boolean;
}) {
    const { catalog, ready } = useStore();
    const [consent, setConsent] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [error, setError] = useState('');
    const fileInput = useRef<HTMLInputElement>(null);
    const active = useRef(0);
    const queue = useRef<Task[]>([]);
    const mounted = useRef(true);
    const callback = useRef(onUploaded);
    useEffect(() => { callback.current = onUploaded; }, [onUploaded]);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const patch = (id: string, change: Partial<Task>) => { if (mounted.current)
        setTasks(t => t.map(x => x.id === id ? { ...x, ...change } : x)); };
    const run = useCallback(async function processQueue() { if (active.current >= 2 || !queue.current.length)
        return; const task = queue.current.shift()!; active.current++; void processQueue(); try {
        const mime = task.file.type === 'image/heif' ? 'image/heic' : task.file.type || (/\.heic$/i.test(task.file.name) ? 'image/heic' : /\.jpe?g$/i.test(task.file.name) ? 'image/jpeg' : /\.png$/i.test(task.file.name) ? 'image/png' : /\.pdf$/i.test(task.file.name) ? 'application/pdf' : '');
        if (!['image/jpeg', 'image/png', 'image/heic', ...(documents ? ['application/pdf'] : [])].includes(mime))
            throw Error('Formato não aceito. Use JPG, PNG' + (documents ? ' ou PDF.' : ' ou HEIC.'));
        if (task.file.size > catalog.settings.maxUploadMb * 1024 * 1024)
            throw Error('Limite de ' + catalog.settings.maxUploadMb + ' MB por arquivo.');
        const pre = await preview(task.file);
        const result = await api<{
            id: string;
            url: string;
        }>('uploads', 'POST', { name: task.file.name, mime, bytes: task.file.size, width: pre.width, height: pre.height, consent: true });
        await transfer(result.url, task.file, n => patch(task.id, { progress: n }));
        const photo = await api<Photo>('uploads/' + result.id + '/complete', 'POST', {});
        if (pre.blob) {
            const r = await fetch('/api/uploads/' + result.id + '/thumbnail', { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: pre.blob });
            if (r.ok)
                photo.thumbnail = '/api/files/' + result.id + '?thumbnail=1';
        }
        patch(task.id, { progress: 100, done: true, error: undefined });
        callback.current(photo);
    }
    catch (e) {
        patch(task.id, { error: (e as Error).message });
    }
    finally {
        active.current--;
        void processQueue();
    } }, [catalog.settings.maxUploadMb, documents]);
    const select = (files: FileList | File[]) => { setError(''); if (!consent) {
        setError('Marque a autorização abaixo para enviar seus arquivos.');
        return;
    } const selected = Array.from(files).slice(0, multiple ? catalog.settings.maxPhotos : 1); if (selected.length + tasks.filter(t => !t.error).length > catalog.settings.maxPhotos) {
        setError('Você pode enviar até ' + catalog.settings.maxPhotos + ' arquivos.');
        return;
    } const batch = selected.map(file => ({ id: crypto.randomUUID(), file, progress: 0 })); setTasks(t => [...t, ...batch]); queue.current.push(...batch); void run(); };
    return <div><div className={'upload-zone ' + (dragging ? 'dragging' : '')} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); select(e.dataTransfer.files); }}><div className="upload-circle">{documents ? <FileText size={30}/> : <ImagePlus size={31} strokeWidth={1.5}/>}</div><h3>{documents ? 'Envie seu documento' : 'Cada foto tem uma história.'}</h3><p>{documents ? 'Selecione um PDF ou uma imagem.' : 'Arraste suas fotos até aqui ou escolha da sua galeria.'}</p><input ref={fileInput} type="file" className="sr-only" aria-label="Selecionar arquivos" accept={documents ? '.pdf,.jpg,.jpeg,.png' : '.jpg,.jpeg,.png,.heic,.heif'} multiple={multiple} onChange={e => { if (e.target.files)
        select(e.target.files); e.target.value = ''; }}/><Button onClick={() => fileInput.current?.click()} disabled={!ready}><Upload size={17}/>{documents ? 'Selecionar documento' : 'Escolher minhas fotos'}</Button><small>{documents ? 'PDF, JPG e PNG' : 'JPG, PNG e HEIC'} · Até {catalog.settings.maxUploadMb} MB por arquivo</small></div><div className="upload-consent"><Check id={'consent-' + (documents ? 'docs' : 'photos')} checked={consent} onChange={setConsent}>Autorizo o uso dos arquivos para atender meu pedido, conforme a <a href="/politica-de-privacidade" target="_blank">Política de Privacidade</a>.</Check><span><LockKeyhole size={14}/> Seus arquivos são privados. O original não é reduzido.</span></div>{error && <Notice error>{error}</Notice>}{tasks.length > 0 && <div className="upload-tasks">{tasks.map(task => <div className="upload-task" key={task.id}><FileText size={17}/><div><strong>{task.file.name}</strong>{task.error ? <span className="error-text">{task.error}</span> : <Progress value={task.progress} aria-label={'Envio de ' + task.file.name}/>}</div>{task.done ? <CheckCircle2 className="green" size={19}/> : task.error ? <button className="icon-button" aria-label="Tentar novamente" onClick={() => { patch(task.id, { error: undefined, progress: 0 }); queue.current.push(task); void run(); }}><RefreshCw size={18}/></button> : <span>{task.progress}%</span>}{task.done && <button className="icon-button" aria-label="Dispensar confirmação de envio" onClick={() => setTasks(t => t.filter(x => x.id !== task.id))}><X size={16}/></button>}</div>)}</div>}</div>;
}
