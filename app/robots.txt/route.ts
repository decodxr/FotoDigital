import { origin, privatePaths } from '@/lib/server/seo';

export function GET() {
    return new Response([
        'User-agent: *',
        'Allow: /',
        'Disallow: /api/',
        ...privatePaths.map(path => 'Disallow: /' + path),
        'Sitemap: ' + origin() + '/sitemap.xml',
        '',
    ].join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
