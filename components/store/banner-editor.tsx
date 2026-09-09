'use client';

import { Switch } from '@/components/ui/switch';
import { Check, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { PhotoImage } from './media';
import { Button, Notice } from './ui';

type Row = Record<string, unknown>;

async function prepareStorePhoto(file: File): Promise<Blob> {
    if (!['image/jpeg', 'image/png'].includes(file.type)) throw Error('Escolha uma fotografia JPG ou PNG.');
    if (file.size > 20 * 1024 * 1024) throw Error('Escolha uma foto de até 20 MB.');
    const bitmap = await createImageBitmap(file);
    try {
        const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext('2d');
        if (!context) throw Error('Não foi possível preparar a imagem neste navegador.');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(Error('Não foi possível preparar a foto.')), 'image/jpeg', .88));
    } finally { bitmap.close(); }
}

export function BannerEditor({ value, onSave }: { value: Row; onSave: (value: Row) => Promise<void> }) {
    const [form, setForm] = useState({ title: '', subtitle: '', image: '', link: '/revelacao', sortOrder: 1, illustrative: 0, active: 1, ...value });
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const input = useRef<HTMLInputElement>(null);
    const change = (key: string, next: unknown) => setForm(current => ({ ...current, [key]: next }));

    async function upload(file?: File) {
        if (!file) return;
        setUploading(true); setError('');
        try {
            const blob = await prepareStorePhoto(file);
            const response = await fetch('/api/admin/media', { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
            const result = await response.json() as { url?: string; error?: string };
            if (!response.ok || !result.url) throw Error(result.error ?? 'Não foi possível enviar. Tente novamente.');
            setForm(current => ({ ...current, image: result.url!, illustrative: 0 }));
        } catch (caught) { setError((caught as Error).message); }
        finally { setUploading(false); if (input.current) input.current.value = ''; }
    }

    return <form className="record-form banner-editor" onSubmit={async event => {
        event.preventDefault(); setSaving(true); setError('');
        try { await onSave(form); } catch (caught) { setError((caught as Error).message); } finally { setSaving(false); }
    }}>
        <div className="banner-editor-image"><div className="banner-preview">{form.image ? <PhotoImage key={String(form.image)} src={String(form.image)} alt={String(form.title || 'Prévia da foto da vitrine')} width={350} height={440} /> : <div><Upload size={30} /><span>Escolha a próxima foto da sua vitrine</span></div>}</div><div><h3>Foto do destaque</h3><p>Esta imagem aparecerá na página inicial. Use fotos que você tem autorização para publicar.</p><input ref={input} className="sr-only" aria-label="Enviar fotografia da vitrine" type="file" accept="image/jpeg,image/png" disabled={uploading || saving} onChange={event => void upload(event.target.files?.[0])} /><Button type="button" variant="outline" busy={uploading} disabled={saving} onClick={() => input.current?.click()}><Upload size={17} />{form.image ? 'Trocar fotografia' : 'Enviar fotografia'}</Button><small>JPG ou PNG · até 20 MB<br />A foto será ajustada para carregar rápido no site.</small><details><summary>Usar endereço de uma imagem</summary><label>URL da fotografia<input type="text" value={String(form.image)} onChange={event => change('image', event.target.value)} placeholder="https://images.pexels.com/..." /></label><small>Fontes permitidas: Pexels, Unsplash e armazenamento R2/S3 autorizado.</small></details></div></div>
        <div className="form-grid"><label className="span-two">Título<input required maxLength={100} value={String(form.title)} onChange={event => change('title', event.target.value)} placeholder="Ex.: Sua história, página por página." /></label><label className="span-two">Breve descrição<textarea required rows={3} maxLength={240} value={String(form.subtitle)} onChange={event => change('subtitle', event.target.value)} placeholder="Conte em poucas palavras o que esta fotografia apresenta." /><small>{String(form.subtitle).length}/240 caracteres</small></label><label>Página de destino<input required value={String(form.link)} pattern="/.*" placeholder="/revelacao" onChange={event => change('link', event.target.value)} /><small>Ex.: /revelacao, /polaroid ou /produto/caneca-personalizada</small></label><label>Posição na vitrine<input type="number" min={0} max={999} required value={Number(form.sortOrder)} onChange={event => change('sortOrder', Number(event.target.value))} /><small>Os menores números aparecem primeiro. As 8 primeiras fotos ativas aparecem na home.</small></label><label className="switch-label">Exibir na página inicial<Switch checked={form.active === 1} onCheckedChange={checked => change('active', checked ? 1 : 0)} /></label><label className="switch-label">Identificar como imagem ilustrativa<Switch checked={form.illustrative === 1} onCheckedChange={checked => change('illustrative', checked ? 1 : 0)} /></label></div>
        {error && <Notice error>{error}</Notice>}<Button type="submit" busy={saving} disabled={uploading || !form.image}><Check size={17} />Salvar destaque</Button>
    </form>;
}
