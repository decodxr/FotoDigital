'use client';
import { Checkbox } from '@/components/ui/checkbox';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { money } from '@/lib/shared/commerce';
import type { Product } from '@/lib/shared/types';
import { ArrowRight, Camera, Heart, LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { ReactNode } from 'react';
import { useStore } from './context';
import { PhotoImage } from './media';
export function Choice({ value, onChange, options, label, id }: {
    value: string;
    onChange: (v: string) => void;
    options: {
        value: string;
        label: string;
    }[];
    label: string;
    id?: string;
}) { return <Select value={value} onValueChange={onChange}><SelectTrigger id={id} aria-label={label} className="choice"><SelectValue placeholder={label}/></SelectTrigger><SelectContent>{options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>; }
export function Check({ checked, onChange, children, id }: {
    checked: boolean;
    onChange: (v: boolean) => void;
    children: ReactNode;
    id: string;
}) { return <label className="check-line" htmlFor={id}><Checkbox id={id} checked={checked} onCheckedChange={v => onChange(v === true)}/><span>{children}</span></label>; }
export function Button({ children, busy = false, variant = '', className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    busy?: boolean;
    variant?: string;
}) { return <button {...props} disabled={props.disabled || busy} className={`btn ${variant} ${className}`}>{busy && <LoaderCircle className="spin" size={18}/>} {children}</button>; }
export function PageIntro({ eyebrow, title, description, children }: {
    eyebrow?: string;
    title: string;
    description?: string;
    children?: ReactNode;
}) { return <div className="page-intro"><div><div className="breadcrumb"><Link href="/">Início</Link><span>/</span>{eyebrow ?? title}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{children}</div>; }
export function Loading() { return <div className="loading-grid" aria-label="Carregando"><Skeleton className="h-12 w-2/3"/><Skeleton className="h-6 w-1/2"/><div className="product-grid">{[1, 2, 3, 4].map(x => <Skeleton key={x} className="h-72 w-full"/>)}</div></div>; }
export function EmptyState({ title, description, href, label, icon }: {
    title: string;
    description: string;
    href?: string;
    label?: string;
    icon?: ReactNode;
}) { return <Empty className="empty-state"><EmptyHeader><EmptyMedia variant="icon">{icon ?? <Camera />}</EmptyMedia><EmptyTitle>{title}</EmptyTitle><EmptyDescription>{description}</EmptyDescription></EmptyHeader>{href && <EmptyContent><Link className="btn" href={href}>{label ?? 'Conhecer produtos'}<ArrowRight size={18}/></Link></EmptyContent>}</Empty>; }
export function ProductCard({ product }: {
    product: Product;
}) { const { favorites, favorite } = useStore(); const href = product.kind === 'photo' ? (product.slug === 'polaroid' || product.slug === 'polaroid-com-ima' ? '/polaroid?produto=' + product.slug : product.slug === 'foto-3x4' ? '/foto-3x4' : '/revelacao?produto=' + product.slug) : product.kind === 'document' ? '/documentos' : '/produto/' + product.slug; return <article className="product-card"><div className="product-image"><Link href={href} aria-label={product.name}>{product.image ? <PhotoImage src={product.image} alt={product.name + ' — imagem ilustrativa'} loading="lazy" width={600} height={650}/> : <div className="product-symbol"><Camera size={48} strokeWidth={1}/><span>Feito para você</span></div>}</Link>{product.kind === 'photo' && <span className="product-tag">Suas fotos, do seu jeito</span>}<button className={'heart-button ' + (favorites.includes(product.id) ? 'is-favorite' : '')} onClick={() => void favorite(product.id)} aria-label={(favorites.includes(product.id) ? 'Desfavoritar ' : 'Favoritar ') + product.name}><Heart size={19} fill={favorites.includes(product.id) ? 'currentColor' : 'none'}/></button></div><div className="product-meta"><span>{product.category}</span><Link href={href}><h3>{product.name}</h3></Link><div className="product-bottom"><span>{product.price === null ? 'Consulte as opções' : <>{product.salePrice !== null && <del>{money(product.price)}</del>}{money(product.salePrice ?? product.price)}</>}</span><Link href={href} aria-label={'Ver ' + product.name}><ArrowRight size={20}/></Link></div></div></article>; }
export function Notice({ children, error = false }: {
    children: ReactNode;
    error?: boolean;
}) { return <div role={error ? 'alert' : 'status'} className={'notice ' + (error ? 'error' : '')}>{children}</div>; }
