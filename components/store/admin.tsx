'use client';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { money, transitions } from '@/lib/shared/commerce';
import { Order, OrderStatus, statusLabels } from '@/lib/shared/types';
import { Archive, ArrowLeft, ArrowUpRight, Camera, Check, CreditCard, Download, ImageIcon, Layers, LayoutDashboard, MessageSquare, Package, PanelTop, PenLine, Plus, RefreshCw, Settings, ShieldCheck, ShoppingBag, Tag, Truck, Users } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api, useStore } from './context';
import { Login } from './customer';
import { PhotoImage } from './media';
import { Logo } from './shell';
import { Button, Choice, EmptyState, Loading, Notice } from './ui';
type Row = Record<string, unknown>;
const navigation = [['dashboard', 'Visão geral', LayoutDashboard], ['orders', 'Pedidos', Package], ['products', 'Produtos', ShoppingBag], ['printSizes', 'Revelações', ImageIcon], ['users', 'Clientes', Users], ['categories', 'Categorias', Layers], ['coupons', 'Cupons', Tag], ['testimonials', 'Depoimentos', MessageSquare], ['services', 'Serviços fotográficos', Camera], ['inquiries', 'Solicitações', MessageSquare], ['banners', 'Banners', PanelTop], ['settings', 'Configurações', Settings], ['shipping', 'Frete', Truck], ['payments', 'Pagamentos', CreditCard], ['auditLogs', 'Registro de atividades', ShieldCheck]] as const;
const initialRecords: Record<string, Row> = { products: { name: '', slug: '', description: '', categoryId: 'personalizados', kind: 'product', image: '', images: [], price: null, salePrice: null, stock: null, active: 1, featured: 0, tags: [], fields: [], variants: [], productionDays: 0, weight: null, width: null, height: null, length: null }, categories: { name: '', slug: '', description: '', image: '', active: 1 }, printSizes: { name: '', width: 10, height: 15, price: null, active: 1, finishes: ['Brilhante', 'Fosco'], tiers: [] }, coupons: { code: '', type: 'percent', value: 0, minAmount: 0, expiresAt: null, categories: [], maxUses: null, perCustomer: 1, firstPurchase: 1, active: 0 }, testimonials: { name: '', rating: 5, comment: '', active: 0 }, services: { name: '', slug: '', description: '', image: '', gallery: [], faq: [], active: 1 }, banners: { title: '', subtitle: '', image: '', link: '/loja', active: 0 } };
const labels: Record<string, string> = { name: 'Nome', slug: 'Endereço da página (slug)', description: 'Descrição', categoryId: 'Categoria', kind: 'Tipo de produto', image: 'Imagem principal (URL)', images: 'Outras imagens (uma URL por linha)', price: 'Preço (R$)', salePrice: 'Preço promocional (R$)', stock: 'Estoque (vazio = sem limite)', active: 'Ativo', featured: 'Destaque na loja', tags: 'Palavras-chave (uma por linha)', fields: 'Campos de personalização', variants: 'Variações', productionDays: 'Produção (dias úteis)', weight: 'Peso embalado (gramas)', width: 'Largura (cm)', height: 'Altura (cm)', length: 'Comprimento (cm)', finishes: 'Acabamentos (um por linha)', tiers: 'Descontos progressivos', code: 'Código do cupom', type: 'Tipo de desconto', value: 'Desconto (% ou centavos)', minAmount: 'Compra mínima (R$)', expiresAt: 'Validade', categories: 'Categorias elegíveis (IDs, uma por linha)', maxUses: 'Limite de usos (vazio = ilimitado)', perCustomer: 'Usos por cliente', firstPurchase: 'Apenas primeira compra', rating: 'Estrelas', comment: 'Comentário original do cliente', gallery: 'Galeria (uma URL por linha)', faq: 'Perguntas frequentes', title: 'Título', subtitle: 'Texto de apoio', link: 'Destino do banner', pixDiscount: 'Desconto PIX (%)', pixEnabled: 'Aceitar PIX', retentionDays: 'Guardar fotografias por (dias)', maxUploadMb: 'Limite por arquivo (MB)', maxPhotos: 'Limite de arquivos por cliente', documentBw: 'Página preto e branco (R$)', documentColor: 'Página colorida (R$)', documentDuplex: 'Oferecer frente e verso', photoSheetCount: 'Fotos em cada cartela 3x4', polaroidCaption: 'Permitir texto na Polaroid', installments: 'Máximo de parcelas', installmentText: 'Condições de parcelamento', storeOpen: 'Receber pedidos online', shippingNotice: 'Mensagem de entrega' };
const priceKeys = ['price', 'salePrice', 'minAmount', 'documentBw', 'documentColor'];
const arrayKeys = ['tags', 'images', 'finishes', 'categories', 'gallery'];
export function Admin() {
    const { user, ready, refresh } = useStore();
    const [section, setSection] = useState('dashboard');
    const [token, setToken] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    if (!ready)
        return <div className="container page-space"><Loading /></div>;
    if (!user)
        return <div className="container page-space"><Logo /><h1>Administração da loja</h1><Login /></div>;
    if (user.role !== 'admin')
        return <div className="container admin-access"><Logo /><div className="panel"><ShieldCheck size={35}/><h1>Acesso à administração</h1><p>Esta área é reservada à equipe da FOTO DIGITAL.</p><details><summary>Configurar o primeiro administrador</summary><p>Use o código de configuração entregue ao responsável pela loja.</p><form onSubmit={async (e) => { e.preventDefault(); setBusy(true); try {
            await api('admin/bootstrap', 'POST', { token });
            await refresh();
        }
        catch (e) {
            setError((e as Error).message);
        }
        finally {
            setBusy(false);
        } }}><label>Código de configuração<input type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} required/></label><Button type="submit" busy={busy}>Ativar minha administração</Button></form></details>{error && <Notice error>{error}</Notice>}<Link href="/" className="text-link">Voltar para a loja <ArrowRightIcon /></Link></div></div>;
    return <SidebarProvider><Sidebar className="admin-sidebar"><SidebarHeader><Logo /></SidebarHeader><SidebarContent><SidebarGroup><SidebarGroupLabel>GESTÃO DA LOJA</SidebarGroupLabel><SidebarMenu>{navigation.map(([id, label, Icon]) => <SidebarMenuItem key={id}><SidebarMenuButton isActive={section === id} onClick={() => setSection(id)}><Icon size={18}/><span>{label}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroup></SidebarContent><SidebarFooter><Link href="/" className="admin-view-store"><ArrowUpRight size={18}/> Ver minha loja</Link><span className="admin-user">{user.name}<small>Administrador</small></span></SidebarFooter></Sidebar><SidebarInset className="admin-inset"><header className="admin-top"><SidebarTrigger /><span>FOTO DIGITAL <b>/</b> {navigation.find(n => n[0] === section)?.[1]}</span><Link href="/" className="text-link">Abrir loja <ArrowUpRight size={16}/></Link></header><AdminSection key={section} section={section}/></SidebarInset></SidebarProvider>;
}
function ArrowRightIcon() { return <ArrowUpRight size={17}/>; }
type Dashboard = {
    metrics: {
        orders: number;
        revenue: number;
    };
    photos: {
        count: number;
    };
    pipeline: {
        status: OrderStatus;
        count: number;
    }[];
    recent: Row[];
    top: {
        name: string;
        count: number;
    }[];
};
function AdminSection({ section }: {
    section: string;
}) {
    const { refreshCatalog, payments } = useStore();
    const [data, setData] = useState<Row[] | Row | Dashboard | null>(null);
    const [error, setError] = useState('');
    const [editing, setEditing] = useState<Row | null>(null);
    const [archive, setArchive] = useState<Row | null>(null);
    const [orderId, setOrderId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [busy, setBusy] = useState(false);
    const load = useCallback(async () => { setError(''); try {
        setData(await api('admin/' + (['shipping', 'payments'].includes(section) ? 'settings' : section)));
    }
    catch (e) {
        setError((e as Error).message);
    } }, [section]);
    useEffect(() => { const start = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(start); }, [load]);
    const title = navigation.find(n => n[0] === section)?.[1] ?? section;
    const mutable = Object.hasOwn(initialRecords, section);
    if (orderId)
        return <AdminOrder id={orderId} onBack={() => { setOrderId(null); void load(); }}/>;
    return <main className="admin-main"><div className="admin-heading"><div><span className="eyebrow">ADMINISTRAÇÃO</span><h1>{title}</h1><p>{section === 'dashboard' ? 'Um olhar sobre o dia a dia da sua loja.' : section === 'products' ? 'Tudo o que a FOTO DIGITAL cria e oferece.' : 'Gerencie as informações da sua loja.'}</p></div><div><Button variant="outline" onClick={() => void load()} aria-label="Atualizar dados"><RefreshCw size={17}/></Button>{mutable && <Button onClick={() => setEditing(structuredClone(initialRecords[section]))}><Plus size={17}/> {section === 'products' ? 'Novo produto' : 'Adicionar'}</Button>}</div></div>{error && <Notice error>{error}</Notice>}{!data && !error ? <Loading /> : section === 'dashboard' && data ? <DashboardView data={data as Dashboard} openOrder={setOrderId}/> : section === 'settings' && data ? <RecordForm section="settings" value={data as Row} onSave={async (value) => { await api('admin/settings', 'PATCH', value); await load(); await refreshCatalog(); toast.success('Configurações atualizadas.'); }}/> : section === 'shipping' ? <div className="panel integration-info"><Truck size={30}/><h2>Correios e Jadlog</h2><p>As transportadoras são consultadas no checkout quando as integrações estão conectadas. Nenhum valor é estimado pela loja automaticamente.</p><p>A retirada local fica disponível sem frete. Cadastre peso e medidas dos produtos para habilitar a cotação de envio.</p><h3>Conexão segura</h3><p>As credenciais ficam nas variáveis de ambiente do servidor. O guia de configuração acompanha o projeto, em <code>docs/integrations.md</code>.</p><Button variant="outline" onClick={() => setEditing(data as Row)}>Editar mensagem e configurações</Button></div> : section === 'payments' ? <div className="panel integration-info"><CreditCard size={30}/><h2>Pagamentos da loja</h2><div className="integration-state"><span>PIX</span><strong>{payments.pix ? 'Chave configurada' : 'Não conectado'}</strong></div><div className="integration-state"><span>Cartão online</span><strong>{payments.card ? 'Integração conectada' : 'Não conectado'}</strong></div><div className="integration-state"><span>Débito online</span><strong>{payments.card && payments.debit ? 'Disponível' : 'Indisponível'}</strong></div><p>A maquininha Rede da loja não habilita automaticamente vendas online. Conecte um gateway ou uma integração contratada para receber cartões no site.</p><p>Confirme PIX manualmente somente depois de verificar o crédito na conta. O cliente não consegue aprovar o próprio pagamento.</p><Button variant="outline" onClick={() => setEditing(data as Row)}>Editar condições de pagamento</Button></div> : Array.isArray(data) ? <><div className="admin-search"><input aria-label="Buscar registros" placeholder="Buscar por nome, número ou informação..." value={search} onChange={e => setSearch(e.target.value)}/><span>{data.length} registros</span></div>{data.length ? <div className="admin-table panel"><Table><TableHeader><TableRow><TableHead>{section === 'orders' ? 'Pedido' : section === 'auditLogs' ? 'Ação' : 'Nome / título'}</TableHead><TableHead>{section === 'products' || section === 'printSizes' ? 'Preço' : section === 'users' ? 'Contato' : 'Informações'}</TableHead><TableHead>Situação</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{data.filter(r => JSON.stringify(r).toLowerCase().includes(search.toLowerCase())).map(row => <TableRow key={String(row.id)}><TableCell><div className="admin-row-name">{row.image ? <PhotoImage src={String(row.image)} alt="" width={42} height={42}/> : null}<div><strong>{String(row.name ?? row.title ?? row.code ?? (row.number ? '#' + row.number : row.action ?? row.id))}</strong><small>{String(row.email ?? row.slug ?? row.createdAt ?? '')}</small></div></div></TableCell><TableCell>{['products', 'printSizes'].includes(section) ? row.price === null ? <span className="unpriced">Preço a definir</span> : money(Number(row.price)) : section === 'orders' ? money(Number(row.total)) : section === 'users' ? String(row.phone || 'Não informado') : section === 'coupons' ? String(row.value) + (row.type === 'percent' ? '%' : ' centavos') : section === 'inquiries' ? String(row.message).slice(0, 100) : String(row.description ?? row.comment ?? row.entityId ?? '').slice(0, 80)}</TableCell><TableCell>{row.status ? <span className="status-badge">{statusLabels[row.status as OrderStatus] ?? String(row.status)}</span> : row.role ? String(row.role) : row.active === 1 ? <span className="status-badge paid">Ativo</span> : row.active === 0 ? <span className="status-badge">Arquivado / inativo</span> : '—'}</TableCell><TableCell><div className="row-actions">{section === 'orders' ? <Button variant="outline" onClick={() => setOrderId(String(row.id))}>Abrir pedido</Button> : mutable ? <><button className="icon-button" aria-label="Editar" onClick={() => setEditing(row)}><PenLine size={17}/></button><button className="icon-button" aria-label="Arquivar" onClick={() => setArchive(row)}><Archive size={17}/></button></> : section === 'inquiries' ? <><Button variant="outline" onClick={() => setEditing(row)}>Ver solicitação</Button></> : null}</div></TableCell></TableRow>)}</TableBody></Table></div> : <EmptyState title="Nenhum registro por aqui ainda." description={mutable ? 'Adicione o primeiro registro para disponibilizá-lo na loja.' : 'Os registros aparecerão conforme a loja receber atividades.'}/>}</> : null}
 {section === 'settings' && <div className="panel cleanup-panel"><h2>Retenção de fotografias</h2><p>A exclusão respeita o prazo configurado e preserva arquivos de pedidos em andamento. Cada execução processa até 20 arquivos.</p><Button variant="outline" busy={busy} onClick={async () => { setBusy(true); try {
        const r = await api<{
            removed: number;
        }>('admin/files/prune', 'POST', {});
        toast.success(r.removed + ' arquivos expirados excluídos.');
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setBusy(false);
    } }}>Excluir arquivos expirados</Button></div>}
 {editing && <Dialog open onOpenChange={v => { if (!v)
        setEditing(null); }}><DialogContent className="admin-record-dialog"><DialogTitle>{section === 'inquiries' ? 'Solicitação do cliente' : editing.id ? 'Editar registro' : 'Novo registro'}</DialogTitle><DialogDescription>{section === 'inquiries' ? 'Dados enviados pelo cliente para atendimento.' : 'As alterações salvas são aplicadas à loja.'}</DialogDescription>{section === 'inquiries' ? <div className="inquiry-detail"><h3>{String(editing.name)}</h3><p>{String(editing.phone)} · {String(editing.email ?? '')}</p><p className="preserve-lines">{String(editing.message)}</p>{editing.photoId ? <a className="btn outline" href={'/api/files/' + editing.photoId}><Download size={17}/> Baixar fotografia</a> : null}<Button onClick={async () => { await api('admin/inquiries/' + editing.id, 'PATCH', { status: 'contacted' }); setEditing(null); await load(); }}>Marcar como atendida</Button></div> : <RecordForm section={['shipping', 'payments'].includes(section) ? 'settings' : section} value={editing} onSave={async (values) => { const entity = ['shipping', 'payments'].includes(section) ? 'settings' : section; await api('admin/' + entity + (editing.id ? '/' + editing.id : ''), editing.id || entity === 'settings' ? 'PATCH' : 'POST', values); setEditing(null); await load(); await refreshCatalog(); toast.success('Salvo com sucesso.'); }}/>}</DialogContent></Dialog>}
 <AlertDialog open={!!archive} onOpenChange={v => { if (!v)
        setArchive(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Arquivar este registro?</AlertDialogTitle><AlertDialogDescription>Ele deixa de aparecer na loja, e o histórico dos pedidos é preservado.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Voltar</AlertDialogCancel><AlertDialogAction onClick={async () => { if (archive) {
        try {
            await api('admin/' + section + '/' + archive.id, 'DELETE');
            await load();
            await refreshCatalog();
        }
        catch (e) {
            setError((e as Error).message);
        }
        setArchive(null);
    } }}>Arquivar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></main>;
}
function DashboardView({ data, openOrder }: {
    data: Dashboard;
    openOrder: (id: string) => void;
}) { return <><div className="admin-metrics">{[['Faturamento aprovado', money(data.metrics.revenue), CreditCard], ['Pedidos recebidos', String(data.metrics.orders), Package], ['Fotografias enviadas', String(data.photos.count), ImageIcon], ['Aguardando produção', String(data.pipeline.filter(p => ['paid', 'files_received'].includes(p.status)).reduce((s, p) => s + p.count, 0)), Camera]].map(([label, value, Icon]) => { const C = Icon as typeof Camera; return <div className="panel" key={label as string}><span>{label as string}<C size={19}/></span><strong>{value as string}</strong></div>; })}</div><div className="admin-dashboard-grid"><section className="panel"><h2>Pedidos recentes</h2>{data.recent.length ? data.recent.map(o => <button className="dashboard-order" onClick={() => openOrder(String(o.id))} key={String(o.id)}><span><strong>#{String(o.number)}</strong><small>{new Date(String(o.createdAt)).toLocaleDateString('pt-BR')}</small></span><span className="status-badge">{statusLabels[o.status as OrderStatus]}</span><strong>{money(Number(o.total))}</strong><ArrowUpRight size={17}/></button>) : <EmptyState title="Prontos para a primeira história." description="Novos pedidos aparecerão aqui assim que forem confirmados pelos clientes."/>}</section><div><section className="panel"><h2>Na produção</h2>{(['production', 'ready', 'shipped'] as const).map(s => <div className="summary-line" key={s}><span>{statusLabels[s]}</span><strong>{data.pipeline.find(p => p.status === s)?.count ?? 0}</strong></div>)}</section><section className="panel"><h2>Produtos mais vendidos</h2>{data.top.length ? data.top.map(p => <div className="summary-line" key={p.name}><span>{p.name}</span><strong>{p.count}</strong></div>) : <p className="muted">Os produtos serão destacados após as primeiras vendas aprovadas.</p>}</section></div></div></>; }
function RecordForm({ section, value, onSave }: {
    section: string;
    value: Row;
    onSave: (value: Row) => Promise<void>;
}) { const { catalog } = useStore(); const [form, setForm] = useState<Row>(structuredClone(value)); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const keys = section === 'settings' ? Object.keys(value) : Object.keys(initialRecords[section] ?? {}); const set = (key: string, val: unknown) => setForm(p => ({ ...p, [key]: val })); return <form className="record-form" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setError(''); try {
    await onSave(form);
}
catch (e) {
    setError((e as Error).message);
}
finally {
    setBusy(false);
} }}><div className="form-grid">{keys.map(key => { const val = form[key], label = labels[key] ?? key; if (['fields', 'variants', 'tiers', 'faq'].includes(key))
    return <div className="span-two" key={key}><ArrayEditor field={key} value={(val ?? []) as Row[]} onChange={v => set(key, v)}/></div>; if (typeof val === 'boolean' || ['active', 'featured', 'firstPurchase'].includes(key))
    return <label className="switch-label" key={key}>{label}<Switch checked={typeof val === 'boolean' ? val : val === 1} onCheckedChange={v => set(key, typeof val === 'boolean' ? v : v ? 1 : 0)} aria-label={label}/></label>; if (key === 'categoryId')
    return <label key={key}>{label}<Choice value={String(val)} onChange={v => set(key, v)} label={label} options={catalog.categories.map(c => ({ value: c.id, label: c.name }))}/></label>; if (key === 'kind' || key === 'type')
    return <label key={key}>{label}<Choice value={String(val)} onChange={v => set(key, v)} label={label} options={key === 'kind' ? [{ value: 'product', label: 'Produto com compra' }, { value: 'photo', label: 'Revelação' }, { value: 'document', label: 'Documento' }, { value: 'quote', label: 'Solicitar orçamento' }] : [{ value: 'percent', label: 'Percentual' }, { value: 'fixed', label: 'Valor fixo em centavos' }]}/></label>; if (arrayKeys.includes(key))
    return <label className="span-two" key={key}>{label}<textarea value={(val as string[] ?? []).join('\n')} onChange={e => set(key, e.target.value.split('\n').filter(Boolean))}/></label>; if (['description', 'comment', 'subtitle', 'installmentText', 'shippingNotice'].includes(key))
    return <label className="span-two" key={key}>{label}<textarea rows={4} value={String(val ?? '')} onChange={e => set(key, e.target.value)}/></label>; if (key === 'expiresAt')
    return <label key={key}>{label}<input type="datetime-local" value={val ? String(val).slice(0, 16) : ''} onChange={e => set(key, e.target.value ? new Date(e.target.value).toISOString() : null)}/></label>; const isPrice = priceKeys.includes(key); const numeric = typeof val === 'number' || ['price', 'salePrice', 'stock', 'weight', 'width', 'height', 'length', 'maxUses', 'documentBw', 'documentColor'].includes(key); return <label key={key}>{label}<input type={numeric ? 'number' : 'text'} step={isPrice ? '.01' : numeric ? '1' : undefined} min={numeric ? 0 : undefined} value={val === null ? '' : isPrice ? Number(val) / 100 : String(val ?? '')} onChange={e => set(key, numeric ? (e.target.value === '' ? null : isPrice ? Math.round(Number(e.target.value) * 100) : Number(e.target.value)) : e.target.value)}/>{isPrice && <small>Deixe vazio para exibir “Sob consulta”.</small>}</label>; })}</div>{section === 'testimonials' && <Notice>Cadastre apenas avaliações reais, com autorização de publicação do cliente.</Notice>}{error && <Notice error>{error}</Notice>}<Button type="submit" busy={busy}><Check size={17}/> Salvar alterações</Button></form>; }
function ArrayEditor({ field, value, onChange }: {
    field: string;
    value: Row[];
    onChange: (v: Row[]) => void;
}) { const cols: Record<string, string[]> = { fields: ['key', 'label', 'type', 'required', 'options'], variants: ['id', 'name', 'price', 'stock'], tiers: ['quantity', 'price'], faq: ['question', 'answer'] }; const defaults: Record<string, Row> = { fields: { key: '', label: '', type: 'text', required: false, options: [] }, variants: { id: '', name: '', price: null, stock: null }, tiers: { quantity: 10, price: 0 }, faq: { question: '', answer: '' } }; const sub: Record<string, string> = { key: 'Identificador', label: 'Rótulo', type: 'Tipo', required: 'Obrigatório', options: 'Opções (separadas por vírgula)', id: 'Identificador', name: 'Nome', price: 'Preço (R$)', stock: 'Estoque', quantity: 'A partir de', question: 'Pergunta', answer: 'Resposta' }; const update = (index: number, key: string, v: unknown) => onChange(value.map((x, i) => i === index ? { ...x, [key]: v } : x)); return <div className="array-editor"><h3>{labels[field]}</h3>{value.map((row, i) => <div className="array-row" key={i}>{cols[field].map(k => <label key={k}>{sub[k]}{k === 'type' ? <Choice value={String(row[k])} onChange={v => update(i, k, v)} label="Tipo do campo" options={['text', 'textarea', 'date', 'photo', 'select'].map(t => ({ value: t, label: { text: 'Texto', textarea: 'Texto longo', date: 'Data', photo: 'Foto', select: 'Lista' }[t] ?? t }))}/> : k === 'required' ? <Switch checked={!!row[k]} onCheckedChange={v => update(i, k, v)} aria-label="Campo obrigatório"/> : <input type={['price', 'stock', 'quantity'].includes(k) ? 'number' : 'text'} step={k === 'price' ? '.01' : undefined} min={0} value={k === 'options' ? (row[k] as string[] ?? []).join(', ') : row[k] === null ? '' : k === 'price' ? Number(row[k]) / 100 : String(row[k] ?? '')} onChange={e => update(i, k, k === 'options' ? e.target.value.split(',').map(s => s.trim()) : ['price', 'stock', 'quantity'].includes(k) ? e.target.value === '' ? null : Number(e.target.value) * (k === 'price' ? 100 : 1) : e.target.value)}/>}</label>)}<button type="button" className="remove-text" onClick={() => onChange(value.filter((_, j) => j !== i))}>Remover</button></div>)}<Button type="button" variant="outline" onClick={() => onChange([...value, structuredClone(defaults[field])])}><Plus size={15}/> Adicionar</Button></div>; }
function AdminOrder({ id, onBack }: {
    id: string;
    onBack: () => void;
}) { const [order, setOrder] = useState<Order | null>(null); const [error, setError] = useState(''); const [status, setStatus] = useState(''); const [note, setNote] = useState(''); const [internal, setInternal] = useState(''); const [tracking, setTracking] = useState(''); const load = useCallback(async () => { try {
    const o = await api<Order>('admin/order/' + id);
    setOrder(o);
    setInternal(o.internalNote ?? '');
    setTracking(o.tracking ?? '');
}
catch (e) {
    setError((e as Error).message);
} }, [id]); useEffect(() => { const start = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(start); }, [load]); if (!order)
    return <main className="admin-main">{error ? <Notice error>{error}</Notice> : <Loading />}</main>; return <main className="admin-main"><Button variant="text" onClick={onBack}><ArrowLeft size={16}/> Todos os pedidos</Button><div className="admin-heading"><div><h1>Pedido #{order.number}</h1><p>{order.customer.name} · {order.customer.email} · {order.customer.phone}</p></div><span className={'status-badge ' + order.status}>{statusLabels[order.status]}</span></div>{error && <Notice error>{error}</Notice>}<div className="admin-dashboard-grid"><div><section className="panel"><h2>Produção e arquivos</h2><a className="btn outline" href={'/api/admin/order/' + id + '/zip'}><Download size={17}/> Baixar pedido em ZIP</a><p className="muted small">Originais sem recompressão, organizados por tamanho. O arquivo de instruções inclui quantidade, acabamento e enquadramento.</p>{order.items.map(item => <div className="admin-production-item" key={item.id}><h3>{item.product.name} · {item.quantity} unidade(s)</h3><div className="admin-order-photos">{item.photos.map((p, i) => <div className="admin-print" key={p.photoId + i}><PhotoImage src={'/api/files/' + p.photoId + '?thumbnail=1'} alt={'Foto ' + (i + 1) + ' do pedido'} width={140} height={140}/><div><strong>{p.sizeId} · {p.quantity} cópia(s)</strong><span>{p.finish}</span><small>Zoom {p.crop.zoom}× · Giro {p.crop.rotation}°<br />Posição: {p.crop.x.toFixed(0)}%, {p.crop.y.toFixed(0)}%<br />{p.crop.fit === 'cover' ? 'Preencher com corte' : 'Foto inteira com bordas'}</small>{p.caption && <p>Texto: {p.caption}</p>}<a href={'/api/files/' + p.photoId} className="text-link"><Download size={14}/> Original</a></div></div>)}</div>{Object.entries(item.fields).map(([k, v]) => <p className="small" key={k}><strong>{item.product.fields.find(f => f.key === k)?.label ?? k}: </strong>{k === 'fileId' || item.product.fields.some(f => f.key === k && f.type === 'photo') ? <a href={'/api/files/' + v}>Baixar arquivo original</a> : v}</p>)}</div>)}</section><section className="panel"><h2>Observação interna</h2><textarea value={internal} onChange={e => setInternal(e.target.value)}/><Button variant="outline" onClick={async () => { try {
    await api('admin/order/' + id, 'PATCH', { internalNote: internal });
    toast.success('Observação salva.');
}
catch (e) {
    setError((e as Error).message);
} }}>Salvar observação</Button></section></div><div><section className="panel"><h2>Resumo</h2><div className="summary-total"><span>Total</span><strong>{money(order.total)}</strong></div><p>Pagamento: {order.paymentMethod.toUpperCase()} · {order.paymentStatus === 'approved' ? 'Aprovado' : 'Pendente'}</p><h3>{order.delivery === 'pickup' ? 'Retirada na loja' : 'Entrega'}</h3><p>{order.delivery === 'pickup' ? 'Rua Brasil, 1367 · Campo Mourão' : Object.values(order.address).join(' · ')}</p></section><section className="panel"><h2>Atualizar andamento</h2>{transitions[order.status].length ? <><Choice value={status} onChange={setStatus} label="Novo status" options={transitions[order.status].map(v => ({ value: v, label: statusLabels[v] }))}/>{status === 'paid' && <Notice>Confirme o crédito na conta ou na operadora antes de aprovar. Esta ação libera o pedido para produção.</Notice>}{status === 'shipped' && <label>Código de rastreio<input value={tracking} onChange={e => setTracking(e.target.value)}/></label>}<label>Mensagem para o cliente<textarea value={note} onChange={e => setNote(e.target.value)}/></label><Button disabled={!status} onClick={async () => { try {
    await api('admin/order/' + id, 'PATCH', { status, note, tracking });
    setStatus('');
    await load();
    toast.success('Pedido atualizado.');
}
catch (e) {
    setError((e as Error).message);
} }}>Atualizar pedido</Button></> : <p>O pedido chegou ao status final.</p>}</section></div></div></main>; }
