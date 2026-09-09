import { safeCatalog } from '@/lib/server/catalog';
import { origin, privatePaths, titles } from '@/lib/server/seo';

export const dynamic = 'force-dynamic';

export async function GET() {
    const catalog = await safeCatalog();
    const paths = [
        '',
        ...Object.keys(titles).filter(path => !privatePaths.includes(path)),
        ...catalog.products.map(product => 'produto/' + product.slug),
        ...catalog.categories.map(category => 'categoria/' + category.slug),
        ...catalog.services.map(service => 'fotografia/' + service.slug),
    ];
    const escape = (value: string) => value.replace(/[<>&"']/g, character => ({
        '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
    })[character]!);
    const urls = [...new Set(paths)].map(path =>
        `<url><loc>${escape(origin() + '/' + path)}</loc><changefreq>${path ? 'monthly' : 'weekly'}</changefreq><priority>${path ? '0.7' : '1.0'}</priority></url>`
    ).join('');
    return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, {
        headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
    });
}
