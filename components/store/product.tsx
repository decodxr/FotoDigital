'use client';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { whats } from '@/lib/shared/brand';
import { money } from '@/lib/shared/commerce';
import { ArrowRight, Camera, Check, Heart, MapPin, MessageCircle, ShieldCheck, ShoppingBag, Truck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { useStore } from './context';
import { PhotoImage } from './media';
import { Button, Choice, EmptyState, Notice, ProductCard } from './ui';
import { UploadZone } from './uploads';
export function ProductPage({ slug }: {
    slug: string;
}) {
    const { catalog, addItem, favorite, favorites } = useStore();
    const product = catalog.products.find(p => p.slug === slug);
    const [quantity, setQuantity] = useState(1);
    const [variantId, setVariantId] = useState('');
    const [fields, setFields] = useState<Record<string, string>>({});
    const [photoName, setPhotoName] = useState('');
    const [busy, setBusy] = useState(false);
    const [added, setAdded] = useState(false);
    if (!product)
        return <div className="container page-space"><EmptyState title="Este produto não está disponível." description="Conheça as outras opções da nossa loja." href="/loja"/></div>;
    const variant = product.variants.find(v => v.id === variantId);
    const price = variant?.price ?? product.salePrice ?? product.price;
    const submit = async () => { setBusy(true); try {
        await addItem({ productId: product.id, quantity, variantId: variantId || undefined, fields, photos: [] });
        setAdded(true);
    }
    catch (e) {
        toast.error((e as Error).message);
    }
    finally {
        setBusy(false);
    } };
    return <div className="container page-space"><div className="breadcrumb"><Link href="/">Início</Link><span>/</span><Link href="/loja">Loja</Link><span>/</span>{product.name}</div><div className="product-detail"><div><div className="detail-image">{product.image ? <PhotoImage src={product.image} alt={product.name + ' — imagem ilustrativa'} width={900} height={1000}/> : <Camera size={80} strokeWidth={1}/>}<button className={'heart-button ' + (favorites.includes(product.id) ? 'is-favorite' : '')} onClick={() => void favorite(product.id)} aria-label="Favoritar produto"><Heart fill={favorites.includes(product.id) ? 'currentColor' : 'none'}/></button></div><p className="image-disclosure">Imagem ilustrativa. A personalização será feita com a sua ideia.</p></div><div className="product-detail-info"><span className="eyebrow">{product.category}</span><h1>{product.name}</h1><p className="detail-description">{product.description}</p><div className="detail-price">{price === null ? 'Valor sob consulta' : money(price)}{price !== null && <small>{money(Math.round(price * (1 - catalog.settings.pixDiscount / 100)))} no PIX · {catalog.settings.pixDiscount}% de desconto</small>}</div>{product.kind === 'photo' || product.kind === 'document' ? <Link className="btn full" href={product.kind === 'document' ? '/documentos' : product.slug === 'foto-3x4' ? '/foto-3x4' : product.slug.includes('polaroid') ? '/polaroid' : '/revelacao'}>Enviar minhas fotos <ArrowRight size={18}/></Link> : product.kind === 'quote' ? <Link href="/restauracao" className="btn full">Solicitar orçamento <ArrowRight size={18}/></Link> : <><div className="custom-fields">{product.variants.length > 0 && <label>Escolha a variação<Choice value={variantId} onChange={setVariantId} label="Variação" options={product.variants.map(v => ({ value: v.id, label: v.name }))}/></label>}{product.fields.map(f => <div key={f.key}><label htmlFor={'custom-' + f.key}>{f.label} {f.required && <span>*</span>}</label>{f.type === 'photo' ? <><UploadZone multiple={false} onUploaded={p => { setFields(v => ({ ...v, [f.key]: p.id })); setPhotoName(p.name); }}/>{photoName && <p className="green"><Check size={15}/> {photoName}</p>}</> : f.type === 'select' ? <Choice id={'custom-' + f.key} value={fields[f.key] ?? ''} onChange={v => setFields(p => ({ ...p, [f.key]: v }))} label={f.label} options={(f.options ?? []).map(o => ({ value: o, label: o }))}/> : f.type === 'textarea' ? <textarea id={'custom-' + f.key} maxLength={3000} value={fields[f.key] ?? ''} required={f.required} onChange={e => setFields(p => ({ ...p, [f.key]: e.target.value }))}/> : <input id={'custom-' + f.key} type={f.type === 'date' ? 'date' : 'text'} value={fields[f.key] ?? ''} required={f.required} maxLength={3000} onChange={e => setFields(p => ({ ...p, [f.key]: e.target.value }))}/>}</div>)}</div><label htmlFor="product-note">Observações (opcional)</label><textarea id="product-note" maxLength={3000} placeholder="Conte um detalhe que faz diferença para você." value={fields.notes ?? ''} onChange={e => setFields(p => ({ ...p, notes: e.target.value }))}/><div className="product-buy"><div className="quantity-picker"><button aria-label="Diminuir quantidade" onClick={() => setQuantity(q => Math.max(1, q - 1))}>−</button><input type="number" min={1} max={999} value={quantity} aria-label="Quantidade" onChange={e => setQuantity(Math.min(999, Math.max(1, Number(e.target.value))))}/><button aria-label="Aumentar quantidade" onClick={() => setQuantity(q => Math.min(999, q + 1))}>+</button></div><Button className="full" disabled={product.stock === 0} busy={busy} onClick={() => void submit()}><ShoppingBag size={17}/>{product.stock === 0 ? 'Produto indisponível' : 'Adicionar ao carrinho'}</Button></div>{added && <Link className="btn outline full" href="/carrinho">Ver meu carrinho <ArrowRight size={18}/></Link>}{price === null && <Notice>Quer saber o valor antes de personalizar? Nossa equipe ajuda pelo WhatsApp.</Notice>}</>}
 <a href={whats('Olá! Vi ' + product.name + ' no site da FOTO DIGITAL e gostaria de tirar uma dúvida.')} className="product-whats" target="_blank" rel="noreferrer"><MessageCircle size={18}/> Tirar uma dúvida sobre este produto</a><div className="detail-promises"><span><MapPin size={16}/> Retirada grátis na loja</span><span><Truck size={16}/> Consulte o envio para seu CEP</span><span><ShieldCheck size={16}/> Personalização e arquivos privados</span></div><Accordion type="single" collapsible><AccordionItem value="production"><AccordionTrigger>Produção e prazo</AccordionTrigger><AccordionContent>{product.productionDays > 0 ? `${product.productionDays} dias úteis após pagamento e aprovação dos arquivos.` : 'Prazo de produção a confirmar com a loja antes da compra.'} O prazo do transporte é informado separadamente.</AccordionContent></AccordionItem><AccordionItem value="care"><AccordionTrigger>Como funciona a personalização?</AccordionTrigger><AccordionContent>Preencha as opções disponíveis e envie os arquivos solicitados. Nossa equipe confere os detalhes e entra em contato se precisar de alguma informação.</AccordionContent></AccordionItem></Accordion></div></div><section className="section"><div className="section-heading"><h2>Mais ideias para você.</h2></div><div className="product-grid">{catalog.products.filter(p => p.categoryId === product.categoryId && p.id !== product.id).slice(0, 4).map(p => <ProductCard key={p.id} product={p}/>)}</div></section></div>;
}
