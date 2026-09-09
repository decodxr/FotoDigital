'use client';
import { Checkbox } from '@/components/ui/checkbox';
import { defaultCrop, money, photoQuality, tierPrice } from '@/lib/shared/commerce';
import type { Photo, PhotoConfig } from '@/lib/shared/types';
import { ArrowRight, CheckCircle, ImageIcon, Info, ShoppingBag, SlidersHorizontal, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api, useStore } from './context';
import { PhotoImage } from './media';
import { CropPreview, PhotoEditor } from './photo-editor';
import { Button, Check, Choice, PageIntro } from './ui';
import { UploadZone } from './uploads';
export function Revelacao({ mode = 'traditional', productSlug = '' }: {
    mode?: 'traditional' | 'polaroid' | '3x4';
    productSlug?: string;
}) {
    const { catalog, addItem } = useStore();
    const magnet = mode === 'polaroid' && productSlug === 'polaroid-com-ima';
    const sizes = catalog.sizes.filter(s => mode === '3x4' ? s.id === '3x4' : mode === 'polaroid' ? s.id === (magnet ? 'polaroid-ima' : 'polaroid') : !['3x4', 'polaroid', 'polaroid-ima'].includes(s.id));
    const [sizeId, setSizeId] = useState(sizes[0]?.id ?? '10x15');
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [configs, setConfigs] = useState<Record<string, PhotoConfig>>({});
    const [selected, setSelected] = useState<string[]>([]);
    const [quantity, setQuantity] = useState(1);
    const [editing, setEditing] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [accepted, setAccepted] = useState(false);
    const [added, setAdded] = useState(false);
    const [history, setHistory] = useState<Photo[]>([]);
    useEffect(() => { api<Photo[]>('uploads').then(p => setHistory(p.filter(i => i.mime.startsWith('image/')))).catch(() => { }); }, []);
    const size = sizes.find(s => s.id === sizeId) ?? sizes[0];
    const totalQuantity = Object.values(configs).reduce((s, c) => s + c.quantity, 0);
    const estimated = Object.values(configs).reduce<number | null>((sum, c) => { const s = sizes.find(s => s.id === c.sizeId); const n = Object.values(configs).filter(x => x.sizeId === c.sizeId).reduce((a, b) => a + b.quantity, 0); const p = s ? tierPrice(s.price, s.tiers, n) : null; return sum === null || p === null ? null : sum + p * c.quantity; }, 0);
    const addPhoto = (photo: Photo) => { setPhotos(p => p.some(i => i.id === photo.id) ? p : [...p, photo]); setConfigs(c => ({ ...c, [photo.id]: c[photo.id] ?? { photoId: photo.id, sizeId, quantity: 1, finish: size?.finishes[0] ?? 'Brilhante', crop: { ...defaultCrop } } })); setAdded(false); };
    const update = (id: string, data: Partial<PhotoConfig>) => { setConfigs(c => ({ ...c, [id]: { ...c[id], ...data } })); setAdded(false); };
    const apply = () => { setConfigs(c => Object.fromEntries(Object.entries(c).map(([id, value]) => [id, selected.includes(id) ? { ...value, sizeId, quantity, finish: size?.finishes.includes(value.finish) ? value.finish : size?.finishes[0] ?? 'Brilhante' } : value]))); toast.success('Configuração aplicada às fotos selecionadas.'); };
    const title = mode === 'polaroid' ? (magnet ? 'Polaroid com ímã, sempre por perto.' : 'Memórias em formato Polaroid.') : mode === '3x4' ? 'Cartela de fotos 3x4.' : 'Vamos tirar suas fotos da tela?';
    const low = photos.some(p => { const c = configs[p.id], s = sizes.find(s => s.id === c?.sizeId); return s && ['low', 'unknown'].includes(photoQuality(p.width, p.height, s.width, s.height, c.crop).level); });
    const submit = async () => { setBusy(true); try {
        await addItem({ productId: mode === 'polaroid' ? (magnet ? 'polaroid-com-ima' : 'polaroid') : mode === '3x4' ? 'foto-3x4' : (catalog.products.find(p => p.slug === productSlug && p.kind === 'photo')?.id ?? 'fotos-tradicionais'), quantity: 1, fields: mode === '3x4' ? { sheetCount: String(catalog.settings.photoSheetCount) } : {}, photos: Object.values(configs).map(c => ({ ...c, qualityAccepted: accepted })) });
        setAdded(true);
    }
    catch (e) {
        toast.error((e as Error).message);
    }
    finally {
        setBusy(false);
    } };
    return <div className="container page-space"><PageIntro eyebrow="Revelação" title={title} description={mode === '3x4' ? `Envie seu retrato e escolha a quantidade de cartelas. Cada cartela contém ${catalog.settings.photoSheetCount} fotos.` : 'Escolha suas fotos, cuide dos detalhes e deixe a impressão com a gente.'}/><ol className="flow-steps"><li className="active"><span>1</span> Envie suas fotos</li><li className={photos.length ? 'active' : ''}><span>2</span> Escolha o tamanho</li><li><span>3</span> Ajuste o enquadramento</li><li><span>4</span> Finalize seu pedido</li></ol><div className="photo-workspace"><div className="photo-work-main"><UploadZone onUploaded={addPhoto} multiple={mode !== '3x4'}/>{history.length > 0 && photos.length === 0 && <details className="previous-uploads"><summary>Usar fotografias enviadas anteriormente ({history.length})</summary><div>{history.slice(0, 30).map(p => <button key={p.id} onClick={() => addPhoto(p)}>{p.thumbnail ? <PhotoImage src={p.thumbnail} alt={p.name} width={80} height={80}/> : <ImageIcon />}<span>{p.name}</span></button>)}</div></details>}
 {photos.length > 0 && <><div className="photo-toolbar"><Check id="select-all" checked={selected.length === photos.length} onChange={v => setSelected(v ? photos.map(p => p.id) : [])}>Selecionar todas ({photos.length})</Check><span>{totalQuantity} {mode === '3x4' ? 'cartelas' : 'impressões'}</span></div>{selected.length > 0 && <div className="batch-bar"><Choice value={sizeId} onChange={setSizeId} label="Tamanho em lote" options={sizes.map(s => ({ value: s.id, label: s.name }))}/><label>Quantidade<input type="number" min={1} max={999} value={quantity} onChange={e => setQuantity(Math.min(999, Math.max(1, Number(e.target.value))))}/></label><Button variant="outline" onClick={apply}>Aplicar a {selected.length} fotos</Button></div>}<div className="uploaded-grid">{photos.map(p => { const c = configs[p.id], s = sizes.find(s => s.id === c.sizeId) ?? size; if (!s)
        return null; const q = photoQuality(p.width, p.height, s.width, s.height, c.crop); return <article className="uploaded-photo" key={p.id}><div className={'uploaded-image ' + (mode === 'polaroid' ? 'polaroid' : '')}><CropPreview photo={p} crop={c.crop} ratio={s.width / s.height}/><Checkbox className="photo-select" aria-label={'Selecionar ' + p.name} checked={selected.includes(p.id)} onCheckedChange={v => setSelected(x => v === true ? [...x, p.id] : x.filter(i => i !== p.id))}/><button className="edit-photo" onClick={() => setEditing(p.id)}><SlidersHorizontal size={15}/> Enquadrar</button></div><div className="uploaded-details"><strong title={p.name}>{p.name}</strong><span className={'quality ' + q.level}><CheckCircle size={13}/>{q.label}{q.dpi > 0 ? ' · ' + q.dpi + ' DPI' : ''}</span><div className="photo-options"><Choice value={c.sizeId} onChange={v => update(p.id, { sizeId: v })} label="Tamanho da fotografia" options={sizes.map(s => ({ value: s.id, label: s.name }))}/><input type="number" min={1} max={999} value={c.quantity} aria-label={'Quantidade de ' + p.name} onChange={e => update(p.id, { quantity: Math.min(999, Math.max(1, Number(e.target.value))) })}/></div><Choice value={c.finish} onChange={v => update(p.id, { finish: v })} label="Acabamento" options={s.finishes.map(f => ({ value: f, label: f }))}/>{mode === 'polaroid' && catalog.settings.polaroidCaption && <input placeholder="Uma pequena mensagem (opcional)" maxLength={80} value={c.caption ?? ''} onChange={e => update(p.id, { caption: e.target.value })} aria-label="Texto na Polaroid"/>}<button className="remove-text" onClick={() => { setPhotos(x => x.filter(v => v.id !== p.id)); setConfigs(x => { const next = { ...x }; delete next[p.id]; return next; }); setSelected(x => x.filter(v => v !== p.id)); }}><Trash2 size={14}/> Remover da seleção</button></div></article>; })}</div></>}
 </div><aside className="photo-summary panel"><span className="eyebrow">SEU PEDIDO, DO SEU JEITO</span><h2>Os detalhes importam.</h2><label>Tamanho inicial</label><Choice value={sizeId} onChange={setSizeId} label="Tamanho inicial" options={sizes.map(s => ({ value: s.id, label: s.name }))}/><div className="print-size-visual"><span style={{ aspectRatio: size ? size.width / size.height : 2 / 3 }}><ImageIcon size={30} strokeWidth={1}/></span><div><strong>{size?.name ?? 'Tamanho sob consulta'}</strong><p>{size?.price === null ? 'Consulte o valor com a loja' : size && money(size.price) + ' por foto'}</p></div></div><div className="summary-line"><span>Fotografias selecionadas</span><strong>{photos.length}</strong></div><div className="summary-line"><span>{mode === '3x4' ? 'Total de cartelas' : 'Total de impressões'}</span><strong>{totalQuantity}</strong></div><div className="summary-total"><span>Subtotal</span><strong>{estimated === null ? 'Sob consulta' : money(estimated)}</strong></div>{low && <Check id="quality-accept" checked={accepted} onChange={setAccepted}>Revisei os avisos de resolução e desejo manter essas fotos.</Check>}<Button className="full" busy={busy} disabled={!photos.length || low && !accepted} onClick={() => void submit()}><ShoppingBag size={18}/> Adicionar ao carrinho</Button>{added && <Link className="btn outline full" href="/carrinho">Ir para o carrinho <ArrowRight size={18}/></Link>}<div className="photo-help"><Info size={17}/><p>Enquadramento e miniaturas ficam separados. Seus arquivos originais continuam intactos.</p></div><p className="muted small">A qualidade é estimada pela resolução e pelo tamanho escolhido. Nitidez e iluminação também influenciam o resultado.</p></aside></div>{editing && configs[editing] && <PhotoEditor photo={photos.find(p => p.id === editing)!} initial={configs[editing].crop} ratio={(() => { const s = sizes.find(s => s.id === configs[editing].sizeId) ?? size; return s ? s.width / s.height : 2 / 3; })()} polaroid={mode === 'polaroid'} onClose={() => setEditing(null)} onSave={crop => { update(editing, { crop }); setEditing(null); }}/>}</div>;
}
