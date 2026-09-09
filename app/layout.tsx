import { localBusiness, origin } from '@/lib/server/seo';
import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: { default: 'FOTO DIGITAL | Revelação de fotos em Campo Mourão', template: '%s | FOTO DIGITAL' }, description: 'Desde 2003 eternizando momentos. Revele suas fotos com qualidade Fujifilm, crie presentes personalizados e conheça nossos serviços fotográficos em Campo Mourão – PR.', metadataBase: new URL(origin()), alternates: { canonical: '/' }, openGraph: { title: 'FOTO DIGITAL — Suas lembranças, fora da tela.', description: 'Revelação, fotografia e personalizados em Campo Mourão. Desde 2003 eternizando momentos.', locale: 'pt_BR', type: 'website', images: ['https://images.pexels.com/photos/7015070/pexels-photo-7015070.jpeg?auto=compress&cs=tinysrgb&w=1200'] }, icons: { icon: '/favicon.svg', shortcut: '/favicon.svg' } };
export default function RootLayout({ children }: {
    children: React.ReactNode;
}) { return <html lang="pt-BR"><body className="antialiased"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ ...localBusiness, url: origin() }).replace(/</g, '\\u003c') }}/>{children}</body></html>; }
