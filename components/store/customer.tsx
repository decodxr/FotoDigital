'use client';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { whats } from '@/lib/shared/brand';
import { money } from '@/lib/shared/commerce';
import { Order, Photo, statusLabels } from '@/lib/shared/types';
import { ArrowRight, Check, Copy, Download, Heart, ImageIcon, KeyRound, LogOut, MapPin, Package, RefreshCw, ShieldCheck, Tag, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api, useStore } from './context';
import { PhotoImage } from './media';
import { Button, EmptyState, Loading, Notice, PageIntro } from './ui';
export function Login({ onSuccess }: {
    onSuccess?: () => void;
}) { const { refresh } = useStore(); const [mode, setMode] = useState('login'); const [data, setData] = useState({ name: '', email: '', password: '' }); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const submit = async (e: React.FormEvent) => { e.preventDefault(); setBusy(true); setError(''); try {
    await api('auth/' + mode, 'POST', data);
    await refresh();
    onSuccess?.();
}
catch (e) {
    setError((e as Error).message);
}
finally {
    setBusy(false);
} }; return <div className="auth-layout"><div className="auth-story"><span className="eyebrow">BEM-VINDO À FOTO DIGITAL</span><h2>Um lugar para<br />as suas histórias.</h2><p>Acompanhe seus pedidos, guarde seus favoritos e volte às lembranças que já criamos juntos.</p><ShieldCheck size={36} strokeWidth={1}/></div><div className="panel auth-panel"><Tabs value={mode} onValueChange={setMode}><TabsList className="auth-tabs"><TabsTrigger value="login">Entrar na minha conta</TabsTrigger><TabsTrigger value="register">Criar conta</TabsTrigger></TabsList></Tabs><form onSubmit={submit}>{mode === 'register' && <label>Seu nome<input autoComplete="name" required value={data.name} onChange={e => setData({ ...data, name: e.target.value })}/></label>}<label>E-mail<input autoComplete="email" type="email" required value={data.email} onChange={e => setData({ ...data, email: e.target.value })}/></label><label>Senha<input autoComplete={mode === 'login' ? 'current-password' : 'new-password'} type="password" minLength={10} required value={data.password} onChange={e => setData({ ...data, password: e.target.value })}/></label>{mode === 'register' && <p className="muted small">Use pelo menos 10 caracteres. Ao criar a conta, você aceita os <Link href="/termos">Termos de Uso</Link> e a <Link href="/politica-de-privacidade">Política de Privacidade</Link>.</p>}{error && <Notice error>{error}</Notice>}<Button busy={busy} className="full" type="submit">{mode === 'login' ? 'Entrar' : 'Criar minha conta'} <ArrowRight size={18}/></Button></form><a className="auth-help" href={whats('Olá! Preciso de ajuda para acessar minha conta da FOTO DIGITAL.')} target="_blank" rel="noreferrer">Precisa de ajuda para acessar? Fale com a loja.</a></div></div>; }
type SummaryOrder = Pick<Order, 'id' | 'number' | 'status' | 'total' | 'paymentStatus' | 'createdAt'>;
export function CustomerAccount({ initialTab = 'profile' }: {
    initialTab?: string;
}) { const { user, ready } = useStore(); const [tab, setTab] = useState(initialTab); if (!ready)
    return <div className="container page-space"><Loading /></div>; if (!user)
    return <div className="container page-space"><PageIntro title="Sua conta, suas lembranças."/><Login /></div>; return <div className="container page-space"><PageIntro eyebrow="Minha conta" title={'Olá, ' + user.name.split(' ')[0] + '.'} description="É bom ter você por aqui. Acompanhe tudo em um só lugar."/><div className="account-layout"><nav className="account-nav">{[['profile', 'Meu perfil', UserRound], ['orders', 'Meus pedidos', Package], ['addresses', 'Endereços', MapPin], ['photos', 'Minhas fotografias', ImageIcon], ['coupons', 'Meus cupons', Tag], ['password', 'Alterar senha', KeyRound]].map(([id, label, Icon]) => { const C = Icon as typeof UserRound; return <button key={id as string} className={tab === id ? 'active' : ''} onClick={() => setTab(id as string)}><C size={19}/>{label as string}</button>; })}<Link href="/favoritos"><Heart size={19}/> Meus favoritos</Link>{user.role === 'admin' && <Link href="/admin"><ShieldCheck size={19}/> Administração</Link>}<button onClick={async () => { const result = await api<{
    redirect: string;
}>('auth/logout', 'POST', {}); window.location.href = result.redirect; }}><LogOut size={19}/> Sair</button></nav><div className="account-main">{tab === 'profile' ? <Profile /> : tab === 'orders' ? <OrdersList /> : tab === 'photos' ? <CustomerPhotos /> : tab === 'addresses' ? <Addresses /> : tab === 'password' ? <PasswordForm /> : <div className="panel"><h2>Meus cupons</h2><p>Recebeu um cupom da FOTO DIGITAL? Aplique o código na etapa de pagamento. A validade e as condições serão verificadas para o seu pedido.</p><Link className="btn outline" href="/loja">Explorar a loja <ArrowRight size={17}/></Link></div>}</div></div></div>; }
function Profile() { const { user, refresh } = useStore(); const [data, setData] = useState({ name: user?.name ?? '', phone: user?.phone ?? '', taxId: user?.taxId ?? '' }); const [busy, setBusy] = useState(false); return <form className="panel" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try {
    await api('profile', 'PATCH', data);
    await refresh();
    toast.success('Perfil atualizado.');
}
catch (e) {
    toast.error((e as Error).message);
}
finally {
    setBusy(false);
} }}><h2>Meu perfil</h2><div className="form-grid"><label className="span-two">Nome completo<input required value={data.name} onChange={e => setData({ ...data, name: e.target.value })}/></label><label>E-mail<input value={user?.email ?? ''} readOnly/></label><label>Telefone / WhatsApp<input value={data.phone} onChange={e => setData({ ...data, phone: e.target.value })}/></label><label>CPF ou CNPJ<input value={data.taxId} onChange={e => setData({ ...data, taxId: e.target.value })}/></label></div><Button busy={busy} type="submit">Salvar alterações</Button></form>; }
export function OrdersList() { const [orders, setOrders] = useState<SummaryOrder[] | null>(null); const [error, setError] = useState(''); useEffect(() => { api<SummaryOrder[]>('orders').then(setOrders).catch(e => setError(e.message)); }, []); return error ? <Notice error>{error}</Notice> : !orders ? <Loading /> : !orders.length ? <EmptyState title="Suas histórias vão aparecer aqui." description="Depois da primeira compra, você acompanha cada etapa do seu pedido por aqui." href="/loja"/> : <div className="orders-list">{orders.map(o => <Link href={'/pedido/' + o.id} className="panel order-summary-row" key={o.id}><Package size={26}/><div><strong>Pedido #{o.number}</strong><small>{new Date(o.createdAt).toLocaleDateString('pt-BR')}</small></div><span className={'status-badge ' + o.status}>{statusLabels[o.status]}</span><strong>{money(o.total)}</strong><ArrowRight size={18}/></Link>)}</div>; }
function CustomerPhotos() { const [photos, setPhotos] = useState<Photo[] | null>(null); const [error, setError] = useState(''); useEffect(() => { api<Photo[]>('uploads').then(setPhotos).catch(e => setError(e.message)); }, []); if (error)
    return <Notice error>{error}</Notice>; if (!photos)
    return <Loading />; return <><h2>Minhas fotografias</h2><p className="muted">Arquivos privados disponíveis durante o período de retenção.</p>{photos.length ? <div className="account-photos">{photos.map(p => <article className="panel" key={p.id}>{p.thumbnail ? <PhotoImage src={p.thumbnail} alt={p.name} width={200} height={200}/> : <ImageIcon size={40}/>}<strong>{p.name}</strong><a href={'/api/files/' + p.id} className="text-link"><Download size={15}/> Baixar original</a><button className="remove-text" onClick={async () => { try {
    await api('uploads/' + p.id, 'DELETE');
    setPhotos(x => x?.filter(v => v.id !== p.id) ?? []);
    toast.success('Arquivo excluído.');
}
catch (e) {
    toast.error((e as Error).message);
} }}>Excluir arquivo</button></article>)}</div> : <EmptyState title="Suas fotos ficam guardadas aqui." description="Comece uma revelação para enviar suas lembranças com privacidade." href="/revelacao" label="Revelar minhas fotos"/>}</>; }
function Addresses() { const [addresses, setAddresses] = useState<{
    id: string;
    data: string;
}[]>([]); const [error, setError] = useState(''); const fields = ['cep', 'street', 'number', 'complement', 'district', 'city', 'state']; const labels = ['CEP', 'Rua / Avenida', 'Número', 'Complemento', 'Bairro', 'Cidade', 'UF']; const [form, setForm] = useState<Record<string, string>>({ cep: '', street: '', number: '', complement: '', district: '', city: '', state: 'PR' }); const load = useCallback(() => api<{
    id: string;
    data: string;
}[]>('addresses').then(setAddresses).catch(e => setError(e.message)), []); useEffect(() => { const start = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(start); }, [load]); return <div className="panel"><h2>Meus endereços</h2>{error && <Notice error>{error}</Notice>}{addresses.map(a => { const d = JSON.parse(a.data); return <div className="saved-address" key={a.id}><MapPin size={19}/><span>{d.street}, {d.number} · {d.city} – {d.state}</span><button className="remove-text" onClick={async () => { try {
    await api('addresses/' + a.id, 'DELETE');
    await load();
}
catch (e) {
    setError((e as Error).message);
} }}>Remover</button></div>; })}<h3>Adicionar endereço</h3><form onSubmit={async (e) => { e.preventDefault(); try {
    await api('addresses', 'POST', { ...form, cep: form.cep.replace(/\D/g, '') });
    await load();
    toast.success('Endereço salvo.');
}
catch (e) {
    setError((e as Error).message);
} }}><div className="form-grid">{fields.map((f, i) => <label key={f}>{labels[i]}<input required={f !== 'complement'} value={form[f]} onChange={e => setForm({ ...form, [f]: e.target.value })}/></label>)}</div><Button type="submit">Salvar endereço</Button></form></div>; }
function PasswordForm() { const [current, setCurrent] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [done, setDone] = useState(false); return <form className="panel" onSubmit={async (e) => { e.preventDefault(); try {
    await api('auth/password', 'POST', { current, password });
    setDone(true);
}
catch (e) {
    setError((e as Error).message);
} }}><h2>Alterar senha</h2>{done ? <Notice>Senha alterada. Entre novamente para continuar.</Notice> : <><label>Senha atual<input type="password" required autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)}/></label><label>Nova senha<input type="password" required minLength={10} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)}/></label><p className="muted small">Contas acessadas pelo ChatGPT usam a senha do próprio serviço.</p>{error && <Notice error>{error}</Notice>}<Button type="submit">Atualizar senha</Button></>}</form>; }
export function OrderPage({ id }: {
    id: string;
}) { const { refresh } = useStore(); const [order, setOrder] = useState<Order | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const load = useCallback(() => api<Order>('orders/' + id).then(setOrder).catch(e => setError(e.message)), [id]); useEffect(() => { const start = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(start); }, [load]); const run = async (fn: () => Promise<void>) => { setBusy(true); try {
    await fn();
}
catch (e) {
    setError((e as Error).message);
}
finally {
    setBusy(false);
} }; if (error && !order)
    return <div className="container page-space"><Notice error>{error}</Notice><Link href="/minha-conta" className="btn">Acessar minha conta</Link></div>; if (!order)
    return <div className="container page-space"><Loading /></div>; return <div className="container page-space"><PageIntro eyebrow="Acompanhar pedido" title={'Pedido #' + order.number} description={'Recebido em ' + new Date(order.createdAt).toLocaleString('pt-BR')}><Button variant="outline" onClick={() => void load()}><RefreshCw size={16}/> Atualizar</Button></PageIntro>{error && <Notice error>{error}</Notice>}<div className="checkout-layout"><div><div className="panel order-timeline"><h2>Uma lembrança a caminho.</h2><ol>{order.events.map((e, i) => <li key={i}><span><Check size={16}/></span><div><strong>{statusLabels[e.status]}</strong><p>{e.note}</p><small>{new Date(e.createdAt).toLocaleString('pt-BR')}</small></div></li>)}</ol></div>{order.paymentStatus === 'pending' && order.status === 'payment_pending' && <div className="panel payment-panel"><h2>{order.paymentMethod === 'pix' ? 'Pague com PIX' : 'Finalize seu pagamento'}</h2>{order.pixCode ? <><p>Copie o código e cole na opção PIX do aplicativo do seu banco. Confira o destinatário <strong>Matsumi & Matsumi Ltda.</strong> antes de confirmar.</p><textarea readOnly aria-label="Código PIX copia e cola" value={order.pixCode}/><Button onClick={() => void run(async () => { await navigator.clipboard.writeText(order.pixCode!); toast.success('Código PIX copiado.'); })}><Copy size={17}/> Copiar código PIX</Button><Notice>O pedido fica pendente até a loja confirmar o recebimento. Um comprovante, sozinho, não altera o status.</Notice></> : <><p>Você será direcionado ao ambiente seguro da operadora. A FOTO DIGITAL não recebe seus dados de cartão.</p>{order.paymentUrl ? <a href={order.paymentUrl} className="btn">Abrir pagamento seguro <ArrowRight size={17}/></a> : <Button busy={busy} onClick={() => void run(async () => { const result = await api<Order>('orders/' + id + '/pay', 'POST', {}); setOrder(result); })}>Gerar link de pagamento</Button>}</>}</div>}<div className="panel"><h2>O que estamos preparando</h2>{order.items.map(i => <div className="order-item" key={i.id}><strong>{i.product.name}</strong><span>{i.quantity} unidade(s) · {i.subtotal === null ? 'A confirmar' : money(i.subtotal)}</span>{i.photos.length > 0 && <small>{i.photos.length} fotos · {i.photos.reduce((s, p) => s + p.quantity, 0)} impressões</small>}</div>)}<Button variant="outline" busy={busy} onClick={() => void run(async () => { await api('orders/' + id + '/repeat', 'POST', {}); await refresh(); window.location.href = '/carrinho'; })}><RefreshCw size={17}/> Repetir pedido</Button><p className="muted small">Preços e disponibilidade serão atualizados. Arquivos expirados precisam ser enviados novamente.</p></div></div><aside className="panel checkout-summary"><span className={'status-badge ' + order.status}>{statusLabels[order.status]}</span><h2>Resumo do pedido</h2><div className="summary-line"><span>Produtos</span><strong>{money(order.subtotal)}</strong></div><div className="summary-line"><span>Descontos</span><strong>−{money(order.discount)}</strong></div><div className="summary-line"><span>Entrega</span><strong>{order.shipping ? money(order.shipping) : 'Grátis'}</strong></div><div className="summary-total"><span>Total</span><strong>{money(order.total)}</strong></div><h3>{order.delivery === 'pickup' ? 'Retirada na loja' : 'Endereço de entrega'}</h3><p>{order.delivery === 'pickup' ? 'Rua Brasil, 1367 · Campo Mourão – PR' : `${order.address.street}, ${order.address.number} · ${order.address.city} – ${order.address.state}`}</p>{order.tracking && <Notice>Código de rastreio: <strong>{order.tracking}</strong></Notice>}<a href={whats('Olá! Gostaria de falar sobre o pedido #' + order.number + '.')} className="text-link" target="_blank" rel="noreferrer">Precisa de ajuda? <ArrowRight size={16}/></a></aside></div></div>; }
