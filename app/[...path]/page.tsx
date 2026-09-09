import { StoreApp } from '@/components/store/app';
import { safeCatalog } from '@/lib/server/catalog';
import { pageMetadata, structuredData, titles } from '@/lib/server/seo';
import { notFound } from 'next/navigation';
type Props = {
    params: Promise<{
        path: string[];
    }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};
export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: Props) { return pageMetadata((await params).path, await safeCatalog()); }
export default async function Page({ params, searchParams }: Props) { const { path } = await params; const q = await searchParams; const c = await safeCatalog(); const ok = path.length === 1 && Object.hasOwn(titles, path[0]) || path[0] === 'produto' && path.length === 2 && c.products.some(p => p.slug === path[1]) || path[0] === 'categoria' && path.length === 2 && c.categories.some(p => p.slug === path[1]) || path[0] === 'fotografia' && path.length === 2 && c.services.some(p => p.slug === path[1]) || path[0] === 'pedido' && path.length === 2 && /^[a-f0-9-]{36}$/.test(path[1]) || path[0] === 'minha-conta' && path[1] === 'pedidos' && path.length === 2; if (!ok)
    notFound(); const structured = structuredData(path, c); return <>{structured && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, '\\u003c') }}/>}<StoreApp initial={c} path={'/' + path.join('/')} query={typeof q.q === 'string' ? q.q : ''} productSlug={typeof q.produto === 'string' ? q.produto : ''}/></>; }
