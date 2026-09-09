'use client';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { whats } from '@/lib/shared/brand';
import { money, totals, validTaxId } from '@/lib/shared/commerce';
import type { CartItem, Order, Quote } from '@/lib/shared/types';
import { ArrowLeft, ArrowRight, Check, Copy, CreditCard, ImageIcon, MapPin, PenLine, ShieldCheck, ShoppingBag, Tag, Trash2, Truck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { api, useStore } from './context';
import { Login } from './customer';
import { PhotoImage } from './media';
import { Button, Choice, Check as Consent, EmptyState, Loading, Notice, PageIntro } from './ui';
export function CartPage() { const { cart, ready, refresh, addItem, catalog } = useStore(); const [editing, setEditing] = useState<CartItem | null>(null); const [busy, setBusy] = useState(false); const perform = async (fn: () => Promise<unknown>) => { setBusy(true); try {
    await fn();
    await refresh();
}
catch (e) {
    toast.error((e as Error).message);
}
finally {
    setBusy(false);
} }; return <div className="container page-space"><PageIntro eyebrow="Meu carrinho" title="Quase nas suas mãos." description="Confira os detalhes das suas próximas lembranças."/>{!ready ? <Loading /> : !cart.items.length ? <EmptyState title="Seu carrinho está esperando por boas histórias." description="Comece pelas suas fotos favoritas ou escolha um presente especial." href="/loja" icon={<ShoppingBag />}/> : <div className="checkout-layout"><div className="cart-items">{cart.items.map(item => <article className="cart-item" key={item.id}><div className="cart-thumbnail">{item.thumbnails.length ? <div className="cart-photo-stack">{item.thumbnails.map((t, i) => <PhotoImage key={t + i} src={t} alt="Miniatura da sua fotografia" width={100} height={120}/>)}</div> : item.product.image ? <PhotoImage src={item.product.image} alt={item.product.name} width={120} height={130}/> : <ImageIcon size={32}/>}</div><div className="cart-item-description"><Link href={'/produto/' + item.product.slug}><h2>{item.product.name}</h2></Link>{item.photos.length > 0 && <p>{item.photos.length} fotos · {item.photos.reduce((s, p) => s + p.quantity, 0) * item.quantity} impressões<br />{[...new Set(item.photos.map(p => p.sizeId))].join(' · ')}</p>}{item.variantId && <p>{item.product.variants.find(v => v.id === item.variantId)?.name}</p>}{Object.entries(item.fields).filter(([k]) => !['photo', 'fileId', 'sheetCount', 'pageCount'].includes(k)).slice(0, 3).map(([k, v]) => <small key={k}>{item.product.fields.find(f => f.key === k)?.label ?? (k === 'notes' ? 'Observações' : k)}: {v}</small>)}<div className="cart-item-actions"><button onClick={() => setEditing(structuredClone(item))}><PenLine size={14}/> Editar</button><button disabled={busy} onClick={() => void perform(() => addItem(item))}><Copy size={14}/> Duplicar</button><button disabled={busy} onClick={() => void perform(() => api('cart/' + item.id, 'DELETE'))}><Trash2 size={14}/> Remover</button></div></div><div className="cart-item-price"><strong>{item.subtotal === null ? 'Sob consulta' : money(item.subtotal)}</strong><span>{item.quantity} × {item.unitPrice === null ? 'a definir' : money(item.unitPrice)}</span></div></article>)}<Link className="text-link" href="/loja"><ArrowLeft size={17}/> Continuar escolhendo</Link></div><aside className="panel cart-summary"><h2>Resumo do pedido</h2><div className="summary-line"><span>Subtotal ({cart.count} itens)</span><strong>{cart.ready ? money(cart.subtotal) : 'Sob consulta'}</strong></div><div className="summary-line"><span>Entrega</span><span>No próximo passo</span></div><div className="summary-total"><span>Total dos produtos</span><strong>{cart.ready ? money(cart.subtotal) : 'A confirmar'}</strong></div><div className="pix-benefit"><Tag size={17}/><span>{catalog.settings.pixDiscount}% de desconto no PIX</span></div>{cart.ready ? <Link href="/checkout" className="btn full">Continuar para entrega <ArrowRight size={18}/></Link> : <><Notice>Há produtos aguardando definição de preço. Nossa equipe pode ajudar a finalizar seu pedido.</Notice><a className="btn full" href={whats('Olá! Montei meu carrinho no site da FOTO DIGITAL e gostaria de confirmar os valores de: ' + cart.items.map(i => i.product.name).join(', '))} target="_blank" rel="noreferrer">Consultar valores <ArrowRight size={18}/></a></>}<p className="secure-caption"><ShieldCheck size={15}/> Seus dados e arquivos são protegidos.</p></aside></div>}{editing && <Dialog open onOpenChange={v => { if (!v)
    setEditing(null); }}><DialogContent className="cart-edit-dialog"><DialogTitle>Editar {editing.product.name}</DialogTitle><DialogDescription>As alterações serão recalculadas ao salvar.</DialogDescription><label>Quantidade<input type="number" min={1} max={999} value={editing.quantity} onChange={e => setEditing({ ...editing, quantity: Math.max(1, Number(e.target.value)) })}/></label>{editing.photos.map((p, i) => <div className="edit-photo-row" key={p.photoId + i}><span>Foto {i + 1}</span><Choice value={p.sizeId} onChange={v => setEditing({ ...editing, photos: editing.photos.map((c, j) => j === i ? { ...c, sizeId: v } : c) })} label="Tamanho" options={catalog.sizes.map(s => ({ value: s.id, label: s.name }))}/><input type="number" aria-label={'Quantidade da foto ' + (i + 1)} min={1} value={p.quantity} onChange={e => setEditing({ ...editing, photos: editing.photos.map((c, j) => j === i ? { ...c, quantity: Math.max(1, Number(e.target.value)) } : c) })}/></div>)}{editing.product.fields.filter(f => f.type !== 'photo').map(f => <label key={f.key}>{f.label}<input value={editing.fields[f.key] ?? ''} onChange={e => setEditing({ ...editing, fields: { ...editing.fields, [f.key]: e.target.value } })}/></label>)}<label>Observações<textarea value={editing.fields.notes ?? ''} onChange={e => setEditing({ ...editing, fields: { ...editing.fields, notes: e.target.value } })}/></label><Button busy={busy} onClick={() => void perform(async () => { await api('cart/' + editing.id, 'PATCH', editing); setEditing(null); })}>Salvar alterações</Button></DialogContent></Dialog>}</div>; }
type Address = {
    cep: string;
    street: string;
    number: string;
    complement: string;
    district: string;
    city: string;
    state: string;
};
export function Checkout() {
    const { cart, user, ready, catalog, payments, refresh } = useStore();
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [personal, setPersonal] = useState({ name: user?.name ?? '', email: user?.email ?? '', phone: user?.phone ?? '', taxId: user?.taxId ?? '' });
    const [delivery, setDelivery] = useState('pickup');
    const [address, setAddress] = useState<Address>({ cep: '', street: '', number: '', complement: '', district: '', city: '', state: 'PR' });
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [quoteId, setQuoteId] = useState('');
    const [method, setMethod] = useState('pix');
    const [coupon, setCoupon] = useState('');
    const [applied, setApplied] = useState<{
        code: string;
        discount: number;
    } | null>(null);
    const [consent, setConsent] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const key = useRef<string | null>(null);
    const selectedQuote = quotes.find(q => q.id === quoteId);
    const total = totals(cart.subtotal, applied?.discount ?? 0, delivery === 'pickup' ? 0 : selectedQuote?.cents ?? 0, method === 'pix' ? catalog.settings.pixDiscount : 0);
    const changeAddress = (key: keyof Address, value: string) => { setAddress(v => ({ ...v, [key]: value })); if (key === 'cep') {
        setQuoteId('');
        setQuotes([]);
    } };
    const run = async (fn: () => Promise<unknown>) => { setBusy(true); setError(''); try {
        await fn();
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setBusy(false);
    } };
    const next = () => { setError(''); if (step === 1) {
        if (personal.name.trim().length < 3 || !/^\S+@\S+\.\S+$/.test(personal.email) || personal.phone.replace(/\D/g, '').length < 10 || !validTaxId(personal.taxId)) {
            setError('Confira seu nome, e-mail, telefone e CPF/CNPJ para continuar.');
            return;
        }
        setStep(2);
    }
    else if (step === 2) {
        if (delivery === 'shipping' && (!selectedQuote || !address.street || !address.number || !address.district || !address.city || address.state.length !== 2)) {
            setError('Preencha o endereço e escolha um frete.');
            return;
        }
        setStep(3);
    } };
    const finalize = () => run(async () => { if (!consent)
        throw Error('Aceite os termos e a política de privacidade.'); key.current ??= crypto.randomUUID(); const order = await api<Order>('orders', 'POST', { customer: personal, delivery, address: delivery === 'shipping' ? { ...address, cep: address.cep.replace(/\D/g, '') } : undefined, quoteId: delivery === 'shipping' ? quoteId : undefined, paymentMethod: method, coupon: applied?.code, consent, idempotencyKey: key.current }); await refresh(); router.push('/pedido/' + order.id); });
    if (!ready)
        return <div className="container page-space"><Loading /></div>;
    if (!user)
        return <div className="container page-space"><PageIntro title="Uma conta para cuidar do seu pedido." description="Entre ou crie sua conta para acompanhar a produção e guardar suas escolhas."/><Login onSuccess={() => { void refresh(); }}/></div>;
    if (!cart.items.length)
        return <div className="container page-space"><EmptyState title="Adicione algo especial ao seu carrinho." description="Depois, volte para escolher a entrega e o pagamento." href="/loja"/></div>;
    return <div className="container page-space"><PageIntro eyebrow="Finalizar pedido" title="Vamos cuidar dos últimos detalhes."/><ol className="flow-steps checkout-steps">{['Seus dados', 'Entrega', 'Pagamento'].map((t, i) => <li className={step >= i + 1 ? 'active' : ''} key={t}><span>{step > i + 1 ? <Check size={15}/> : i + 1}</span>{t}</li>)}</ol><div className="checkout-layout"><div className="panel checkout-form"><h2>{step === 1 ? 'Como podemos falar com você?' : step === 2 ? 'Como você quer receber?' : 'Escolha a forma de pagamento'}</h2>{step === 1 && <div className="form-grid">{[['name', 'Nome completo', 'name'], ['email', 'E-mail', 'email'], ['phone', 'Telefone / WhatsApp', 'tel'], ['taxId', 'CPF ou CNPJ', 'off']].map(([k, label, ac]) => <label key={k} className={k === 'name' ? 'span-two' : ''}>{label}<input value={personal[k as keyof typeof personal]} autoComplete={ac} type={k === 'email' ? 'email' : k === 'phone' ? 'tel' : 'text'} onChange={e => setPersonal(p => ({ ...p, [k]: e.target.value }))} required/></label>)}</div>}{step === 2 && <><RadioGroup value={delivery} onValueChange={setDelivery} className="delivery-options"><label className={'radio-card ' + (delivery === 'pickup' ? 'selected' : '')}><RadioGroupItem value="pickup"/><MapPin size={24}/><span><strong>Retirar na FOTO DIGITAL</strong><small>Rua Brasil, 1367 · Campo Mourão – PR</small></span><b>Grátis</b></label><label className={'radio-card ' + (delivery === 'shipping' ? 'selected' : '')}><RadioGroupItem value="shipping"/><Truck size={24}/><span><strong>Receber em casa</strong><small>Consulte as opções para seu CEP</small></span></label></RadioGroup>{delivery === 'pickup' ? <div className="pickup-info"><strong>Vamos avisar quando estiver pronto.</strong><p>Aguarde o status “Pronto para retirada” antes de vir à loja. CEP 87302-230 · Telefone (44) 3523-0433.</p></div> : <><div className="cep-field"><label>CEP<input inputMode="numeric" autoComplete="postal-code" maxLength={9} value={address.cep} placeholder="00000-000" onChange={e => changeAddress('cep', e.target.value)}/></label><Button variant="outline" busy={busy} onClick={() => void run(async () => { const data = await api<{
        quotes: Quote[];
        errors: string[];
    }>('shipping', 'POST', { cep: address.cep.replace(/\D/g, '') }); setQuotes(data.quotes); if (!data.quotes.length)
        throw Error(data.errors.join(' ')); })}>Calcular frete</Button></div><div className="form-grid">{[['street', 'Rua / Avenida'], ['number', 'Número'], ['complement', 'Complemento (opcional)'], ['district', 'Bairro'], ['city', 'Cidade'], ['state', 'Estado (UF)']].map(([k, label]) => <label key={k}>{label}<input value={address[k as keyof Address]} onChange={e => changeAddress(k as keyof Address, k === 'state' ? e.target.value.toUpperCase() : e.target.value)} maxLength={k === 'state' ? 2 : 160}/></label>)}</div><RadioGroup value={quoteId} onValueChange={setQuoteId}>{quotes.map(q => <label className="radio-card" key={q.id}><RadioGroupItem value={q.id}/><span><strong>{q.carrier} · {q.service}</strong><small>Até {q.days} dias úteis após a produção</small></span><b>{money(q.cents)}</b></label>)}</RadioGroup></>}</>}{step === 3 && <><RadioGroup value={method} onValueChange={setMethod}><label className={'radio-card ' + (method === 'pix' ? 'selected' : '')}><RadioGroupItem value="pix" disabled={!payments.pix || !catalog.settings.pixEnabled}/><span className="pix-logo">PIX</span><span><strong>PIX <i>{catalog.settings.pixDiscount}% OFF</i></strong><small>{payments.pix && catalog.settings.pixEnabled ? 'Código copia e cola após confirmar o pedido.' : 'Temporariamente indisponível.'}</small></span></label><label className="radio-card"><RadioGroupItem value="credit" disabled={!payments.card}/><CreditCard /><span><strong>Cartão de crédito</strong><small>{payments.card ? 'Continue no ambiente seguro da operadora.' : 'Pagamento online temporariamente indisponível.'}</small></span></label><label className="radio-card"><RadioGroupItem value="debit" disabled={!payments.card || !payments.debit}/><CreditCard /><span><strong>Cartão de débito</strong><small>{payments.card && payments.debit ? 'Conforme condições da operadora.' : 'Indisponível para este pedido.'}</small></span></label></RadioGroup><p className="muted small">{catalog.settings.installmentText}</p><div className="coupon-field"><label>Cupom de desconto<input value={coupon} onChange={e => { setCoupon(e.target.value.toUpperCase()); setApplied(null); }} placeholder="Seu cupom"/></label><Button variant="outline" busy={busy} onClick={() => void run(async () => { setApplied(await api('coupon', 'POST', { code: coupon })); })}>Aplicar</Button></div>{applied && <p className="green">Cupom {applied.code} aplicado: −{money(applied.discount)}</p>}<Consent id="checkout-consent" checked={consent} onChange={setConsent}>Li e aceito os <Link href="/termos" target="_blank">Termos de Uso</Link> e a <Link href="/politica-de-privacidade" target="_blank">Política de Privacidade</Link>.</Consent></>}{error && <Notice error>{error}</Notice>}<div className="checkout-navigation">{step > 1 && <Button variant="text" onClick={() => setStep(s => s - 1)}><ArrowLeft size={17}/> Voltar</Button>}{step < 3 ? <Button onClick={next}>Continuar <ArrowRight size={17}/></Button> : <Button busy={busy} disabled={!cart.ready || !consent} onClick={() => void finalize()}>Confirmar pedido <ArrowRight size={17}/></Button>}</div></div><aside className="panel checkout-summary"><h2>Seu pedido</h2>{cart.items.map(i => <div className="checkout-mini-item" key={i.id}><div>{i.product.image ? <PhotoImage src={i.product.image} alt="" width={50} height={55}/> : <ImageIcon size={22}/>}</div><span><strong>{i.product.name}</strong><small>Quantidade: {i.quantity}</small></span><b>{i.subtotal === null ? 'A definir' : money(i.subtotal)}</b></div>)}<div className="summary-line"><span>Produtos</span><strong>{money(total.subtotal)}</strong></div><div className="summary-line"><span>Descontos</span><strong>−{money(total.discount)}</strong></div><div className="summary-line"><span>{delivery === 'pickup' ? 'Retirada na loja' : 'Frete'}</span><strong>{delivery === 'pickup' ? 'Grátis' : selectedQuote ? money(total.shipping) : 'A calcular'}</strong></div><div className="summary-total"><span>Total</span><strong>{money(total.total)}</strong></div><p className="secure-caption"><ShieldCheck size={16}/> Confirmação segura do seu pedido.</p></aside></div></div>;
}
