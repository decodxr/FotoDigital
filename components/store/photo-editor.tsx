'use client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { defaultCrop } from '@/lib/shared/commerce';
import type { Crop, Photo } from '@/lib/shared/types';
import { Check, Minus, Move, Plus, RotateCcw, RotateCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button, Choice } from './ui';
export function CropPreview({ photo, crop, ratio, interactive = false, onChange }: {
    photo: Photo;
    crop: Crop;
    ratio: number;
    interactive?: boolean;
    onChange?: (crop: Crop) => void;
}) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const loaded = useRef<HTMLImageElement | null>(null);
    const [version, setVersion] = useState(0);
    const drag = useRef<{
        x: number;
        y: number;
        crop: Crop;
    } | null>(null);
    const dims = useRef({ w: 1, h: 1, dw: 1, dh: 1 });
    useEffect(() => { if (!photo.thumbnail)
        return; const img = new window.Image(); img.onload = () => { loaded.current = img; setVersion(v => v + 1); }; img.src = photo.thumbnail; return () => { img.onload = null; }; }, [photo.thumbnail]);
    useEffect(() => { const c = canvas.current, img = loaded.current; if (!c || !img)
        return; const ctx = c.getContext('2d')!; const width = 900, height = 900 / ratio; c.width = width; c.height = height; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height); const rotated = crop.rotation % 180 !== 0; const iw = rotated ? img.naturalHeight : img.naturalWidth, ih = rotated ? img.naturalWidth : img.naturalHeight; const scale = (crop.fit === 'cover' ? Math.max(width / iw, height / ih) : Math.min(width / iw, height / ih)) * crop.zoom; const dw = iw * scale, dh = ih * scale; dims.current = { w: width, h: height, dw, dh }; ctx.save(); ctx.translate((width - dw) * crop.x / 100 + dw / 2, (height - dh) * crop.y / 100 + dh / 2); ctx.rotate(crop.rotation * Math.PI / 180); ctx.drawImage(img, -img.naturalWidth * scale / 2, -img.naturalHeight * scale / 2, img.naturalWidth * scale, img.naturalHeight * scale); ctx.restore(); }, [crop, ratio, version]);
    return photo.thumbnail ? <canvas ref={canvas} className={'crop-preview ' + (interactive ? 'interactive' : '')} role="img" aria-label="Prévia da área que será impressa" style={{ aspectRatio: ratio }} onPointerDown={e => { if (!interactive)
        return; drag.current = { x: e.clientX, y: e.clientY, crop }; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={e => { if (!drag.current || !interactive)
        return; const d = dims.current, rect = e.currentTarget.getBoundingClientRect(), start = drag.current; const clamp = (v: number) => Math.min(100, Math.max(0, v)); onChange?.({ ...crop, x: Math.abs(d.w - d.dw) < 1 ? 50 : clamp(start.crop.x + (e.clientX - start.x) / rect.width * d.w / (d.w - d.dw) * 100), y: Math.abs(d.h - d.dh) < 1 ? 50 : clamp(start.crop.y + (e.clientY - start.y) / rect.height * d.h / (d.h - d.dh) * 100) }); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}/> : <div className="no-preview">Prévia indisponível para este arquivo.<br />Seu original permanece preservado.</div>;
}
export function PhotoEditor({ photo, initial, ratio, onSave, onClose, polaroid = false }: {
    photo: Photo;
    initial: Crop;
    ratio: number;
    onSave: (c: Crop) => void;
    onClose: () => void;
    polaroid?: boolean;
}) { const [crop, setCrop] = useState(initial); return <Dialog open onOpenChange={v => { if (!v)
    onClose(); }}><DialogContent className="photo-editor-dialog"><DialogHeader><DialogTitle>Ajuste o seu enquadramento</DialogTitle><DialogDescription>O que estiver fora da área visível será cortado na impressão.</DialogDescription></DialogHeader><div className={'editor-stage ' + (polaroid ? 'polaroid-stage' : '')}><CropPreview photo={photo} crop={crop} ratio={ratio} interactive onChange={setCrop}/></div><div className="editor-hint"><Move size={15}/> Arraste a foto para encontrar o melhor enquadramento.</div><div className="editor-controls"><div><label>Preenchimento</label><Choice value={crop.fit} onChange={v => setCrop({ ...crop, fit: v as Crop['fit'], zoom: 1 })} label="Preenchimento" options={[{ value: 'cover', label: 'Preencher e recortar' }, { value: 'contain', label: 'Foto inteira com bordas' }]}/></div><div><label>Ampliação · {crop.zoom.toFixed(1)}×</label><div className="slider-row"><Minus size={17}/><Slider aria-label="Ampliação" min={1} max={4} step={.05} value={[crop.zoom]} onValueChange={v => setCrop({ ...crop, zoom: v[0] })}/><Plus size={17}/></div></div><div><label>Posição horizontal</label><Slider aria-label="Posição horizontal" min={0} max={100} step={1} value={[crop.x]} onValueChange={v => setCrop({ ...crop, x: v[0] })}/></div><div><label>Posição vertical</label><Slider aria-label="Posição vertical" min={0} max={100} step={1} value={[crop.y]} onValueChange={v => setCrop({ ...crop, y: v[0] })}/></div></div><div className="editor-actions"><Button variant="outline" onClick={() => setCrop({ ...crop, rotation: (crop.rotation + 90) % 360 })}><RotateCw size={17}/> Girar</Button><Button variant="text" onClick={() => setCrop({ ...defaultCrop })}><RotateCcw size={17}/> Restaurar</Button><Button onClick={() => onSave(crop)}><Check size={17}/> Salvar enquadramento</Button></div></DialogContent></Dialog>; }
