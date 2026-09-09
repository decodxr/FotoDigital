'use client';
import type { Catalog } from '@/lib/shared/types';
import dynamic from 'next/dynamic';
import { Toaster } from 'sonner';
import { StoreProvider } from './context';
import { Home } from './home';
import { ExperienceMotion } from './motion';
import { Footer, Header, WhatsApp } from './shell';
import { Loading, Notice } from './ui';
const CatalogPage = dynamic(() => import('./catalog').then(m => m.CatalogPage), { loading: () => <Loading /> });
const Revelacao = dynamic(() => import('./revelacao').then(m => m.Revelacao), { loading: () => <Loading /> });
const ProductPage = dynamic(() => import('./product').then(m => m.ProductPage));
const Documentos = dynamic(() => import('./documentos').then(m => m.Documentos));
const CartPage = dynamic(() => import('./cart-checkout').then(m => m.CartPage));
const Checkout = dynamic(() => import('./cart-checkout').then(m => m.Checkout));
const CustomerAccount = dynamic(() => import('./customer').then(m => m.CustomerAccount));
const OrderPage = dynamic(() => import('./customer').then(m => m.OrderPage));
const About = dynamic(() => import('./institutional').then(m => m.About));
const Contact = dynamic(() => import('./institutional').then(m => m.Contact));
const Restoration = dynamic(() => import('./institutional').then(m => m.Restoration));
const Photography = dynamic(() => import('./institutional').then(m => m.Photography));
const PolicyPage = dynamic(() => import('./institutional').then(m => m.PolicyPage));
const Admin = dynamic(() => import('./admin').then(m => m.Admin), { loading: () => <Loading /> });
export function StoreApp({ initial, path = '/', query = '', productSlug = '' }: {
    initial: Catalog;
    path?: string;
    query?: string;
    productSlug?: string;
}) {
    const parts = path.split('/').filter(Boolean);
    let content: React.ReactNode;
    switch (parts[0]) {
        case undefined:
            content = <Home />;
            break;
        case 'loja':
            content = <CatalogPage query={query}/>;
            break;
        case 'categoria':
            content = <CatalogPage category={parts[1]}/>;
            break;
        case 'personalizados':
            content = <CatalogPage personalized/>;
            break;
        case 'favoritos':
            content = <CatalogPage favorites/>;
            break;
        case 'revelacao':
            content = <Revelacao productSlug={productSlug}/>;
            break;
        case 'polaroid':
            content = <Revelacao mode="polaroid" productSlug={productSlug}/>;
            break;
        case 'foto-3x4':
            content = <Revelacao mode="3x4"/>;
            break;
        case 'documentos':
            content = <Documentos />;
            break;
        case 'produto':
            content = <ProductPage slug={parts[1]}/>;
            break;
        case 'carrinho':
            content = <CartPage />;
            break;
        case 'checkout':
            content = <Checkout />;
            break;
        case 'pedido':
            content = <OrderPage id={parts[1]}/>;
            break;
        case 'minha-conta':
            content = <CustomerAccount initialTab={parts[1] === 'pedidos' ? 'orders' : 'profile'}/>;
            break;
        case 'sobre':
            content = <About />;
            break;
        case 'contato':
            content = <Contact />;
            break;
        case 'restauracao':
            content = <Restoration />;
            break;
        case 'fotografia':
            content = <Photography key={parts[1] ?? 'all'} slug={parts[1]}/>;
            break;
        case 'admin':
            content = <Admin />;
            break;
        default: content = <PolicyPage slug={parts[0]}/>;
    }
    return <StoreProvider initial={initial}><ExperienceMotion path={path}>{parts[0] === 'admin' ? content : <><a href="#conteudo" className="skip-link">Ir para o conteúdo</a><Header path={path}/><main id="conteudo">{initial.unavailable && <div className="container"><Notice>Estamos com dificuldade para consultar a loja. Tente novamente em instantes ou fale conosco pelo WhatsApp.</Notice></div>}<div className="page-transition" key={path}>{content}</div></main><Footer /><WhatsApp path={path}/></>}</ExperienceMotion><Toaster position="bottom-center" theme="light" richColors/></StoreProvider>;
}
