'use client';
import { money, parsePages } from '@/lib/shared/commerce';
import type { Photo } from '@/lib/shared/types';
import { ArrowRight, CheckCircle, FileText, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useStore } from './context';
import { Button, Choice, Notice, PageIntro } from './ui';
import { UploadZone } from './uploads';
export function Documentos() { const { catalog, addItem } = useStore(); const [file, setFile] = useState<Photo | null>(null); const [color, setColor] = useState('bw'); const [copies, setCopies] = useState(1); const [pageCount, setPageCount] = useState(1); const [pages, setPages] = useState(''); const [duplex, setDuplex] = useState('no'); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false); const [added, setAdded] = useState(false); const [error, setError] = useState(''); let count = 0; try {
    count = parsePages(pages, pageCount).length;
}
catch { } const rate = color === 'bw' ? catalog.settings.documentBw : catalog.settings.documentColor; const submit = async () => { setBusy(true); setError(''); try {
    if (!file)
        throw Error('Envie um documento.');
    parsePages(pages, pageCount);
    await addItem({ productId: 'documentos', quantity: copies, photos: [], fields: { fileId: file.id, color, pageCount: String(pageCount), pages, duplex, notes: note } });
    setAdded(true);
}
catch (e) {
    setError((e as Error).message);
}
finally {
    setBusy(false);
} }; return <div className="container page-space"><PageIntro eyebrow="Impressões" title="Seu documento, pronto para imprimir." description="Envie o arquivo e escolha como ele deve ficar. Simples assim."/><div className="two-column"><div><UploadZone documents multiple={false} onUploaded={p => { setFile(p); setPageCount((p as Photo & {
    pageCount?: number;
}).pageCount ?? 1); }}/>{file && <div className="document-file"><FileText /><div><strong>{file.name}</strong><span>{(file.bytes / 1024 / 1024).toFixed(2)} MB · Original preservado</span></div><CheckCircle className="green"/></div>}</div><div className="panel document-options"><h2>Preferências de impressão</h2><div className="form-grid"><label>Cor<Choice value={color} onChange={setColor} label="Cor de impressão" options={[{ value: 'bw', label: 'Preto e branco' }, { value: 'color', label: 'Colorido' }]}/></label><label>Cópias<input type="number" min={1} max={999} value={copies} onChange={e => setCopies(Math.max(1, Math.min(999, Number(e.target.value))))}/></label><label>Total de páginas<input type="number" min={1} max={2000} readOnly value={pageCount} aria-label="Total de páginas identificado no arquivo"/></label><label>Páginas a imprimir<input value={pages} onChange={e => setPages(e.target.value)} placeholder="Todas ou 1-3, 5, 8"/></label><label className="span-two">Lados<Choice value={duplex} onChange={setDuplex} label="Lados da impressão" options={[{ value: 'no', label: 'Somente frente' }, ...(catalog.settings.documentDuplex ? [{ value: 'yes', label: 'Frente e verso' }] : [])]}/></label><label className="span-two">Observações<textarea value={note} onChange={e => setNote(e.target.value)} maxLength={3000} placeholder="Algum cuidado especial com seu documento?"/></label></div><div className="summary-total"><span>{count * copies} páginas impressas</span><strong>{rate === null ? 'Sob consulta' : money(rate * count * copies)}</strong></div>{error && <Notice error>{error}</Notice>}<Button className="full" busy={busy} disabled={!file} onClick={() => void submit()}><ShoppingBag size={18}/> Adicionar ao carrinho</Button>{added && <Link className="btn outline full" href="/carrinho">Ir para o carrinho <ArrowRight size={18}/></Link>}<p className="muted small">O preço considera as páginas impressas, inclusive em frente e verso. Documentos protegidos por senha precisam ser desbloqueados antes do envio.</p></div></div></div>; }
