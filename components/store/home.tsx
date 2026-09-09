'use client';

import { ArrowRight, ArrowUpRight, Camera, Gift, ImageIcon, MapPin, Printer, ShieldCheck, Star, Truck, Upload } from 'lucide-react';
import Link from 'next/link';
import { useStore } from './context';
import { PhotoImage } from './media';
import { ProductCard } from './ui';

const images = {
    memories: 'https://images.pexels.com/photos/7015070/pexels-photo-7015070.jpeg?auto=compress&cs=tinysrgb&w=1400',
    prints: 'https://images.pexels.com/photos/9219062/pexels-photo-9219062.jpeg?auto=compress&cs=tinysrgb&w=800',
    polaroid: 'https://images.pexels.com/photos/8266758/pexels-photo-8266758.jpeg?auto=compress&cs=tinysrgb&w=800',
    gift: 'https://images.pexels.com/photos/11075707/pexels-photo-11075707.jpeg?auto=compress&cs=tinysrgb&w=800',
    album: 'https://images.pexels.com/photos/8057030/pexels-photo-8057030.jpeg?auto=compress&cs=tinysrgb&w=1000',
};

const categories = [
    { href: '/revelacao', name: 'Revelação de fotos', text: 'Seus instantes favoritos, por perto.', image: images.prints, icon: ImageIcon, index: '01' },
    { href: '/polaroid', name: 'Fotos Polaroid', text: 'Pequenas fotos. Grandes histórias.', image: images.polaroid, icon: Camera, index: '02' },
    { href: '/personalizados', name: 'Presentes personalizados', text: 'Tem um pouco de você em cada detalhe.', image: images.gift, icon: Gift, index: '03' },
];

export function Home() {
    const { catalog } = useStore();
    return <>
        <section className="memory-hero container" aria-labelledby="home-title">
            <div className="memory-hero-copy">
                <span className="eyebrow hero-enter">FOTO DIGITAL · DESDE 2003</span>
                <h1 id="home-title" className="hero-enter">Tem lembrança<br />que merece<br /><em>sair da tela.</em></h1>
                <p className="hero-enter">O abraço, a viagem, aquele sorriso.<br />Transforme seus momentos em fotografias para guardar e presentes para emocionar.</p>
                <div className="hero-buttons hero-enter">
                    <Link className="btn" href="/revelacao"><Upload size={18} strokeWidth={1.6} /> Revelar minhas fotos <ArrowRight size={18} /></Link>
                    <Link className="text-link" href="/loja">Explorar a loja <ArrowUpRight size={18} /></Link>
                </div>
                <div className="hero-care hero-enter"><ShieldCheck size={19} strokeWidth={1.5} /><span>Dos seus arquivos às suas mãos.<br /><strong>Cuidado em cada etapa.</strong></span></div>
            </div>
            <div className="memory-hero-visual">
                <figure className="memory-main-photo">
                    <PhotoImage src={images.memories} alt="Fotografias impressas sendo organizadas com cuidado sobre uma mesa" width={900} height={1100} sizes="(max-width: 720px) 85vw, 42vw" fetchPriority="high" />
                    <figcaption><span>COISAS BOAS MERECEM FICAR.</span><span>FOTO DIGITAL</span></figcaption>
                </figure>
                <figure className="memory-detail-photo">
                    <PhotoImage src={images.polaroid} alt="Fotografias instantâneas com moldura branca — inspiração" width={350} height={400} sizes="(max-width: 720px) 32vw, 16vw" />
                    <figcaption>para guardar com carinho.</figcaption>
                </figure>
                <div className="memory-side-caption" aria-hidden="true">CAMPO MOURÃO, PR — FEITO DE MEMÓRIAS</div>
                <div className="memory-photo-caption"><span className="caption-rule" /><p>A vida passa.<br /><em>O que a gente sente, fica.</em></p></div>
            </div>
        </section>

        <section className="care-ribbon" aria-label="Cuidado em cada pedido"><div className="container care-ribbon-inner">
            <div><Camera strokeWidth={1.4} /><span><strong>Desde 2003</strong>Mais de duas décadas de cuidado</span></div>
            <div><ImageIcon strokeWidth={1.4} /><span><strong>Qualidade Fujifilm</strong>Cor e definição nas suas fotos</span></div>
            <div><Truck strokeWidth={1.4} /><span><strong>Retire ou receba</strong>Do nosso cuidado para sua casa</span></div>
            <div><span className="pix-percent">5%</span><span><strong>Desconto no PIX</strong>Mais motivos para revelar</span></div>
        </div></section>

        <section className="section container creation-section">
            <div className="section-heading" data-reveal><div><span className="eyebrow">PARA CADA JEITO DE GUARDAR</span><h2>O que vamos <em>criar hoje?</em></h2></div><Link className="text-link" href="/loja">Conheça todas as possibilidades <ArrowRight size={18} /></Link></div>
            <div className="memory-categories">{categories.map(category => <Link className="memory-category" href={category.href} key={category.href} data-reveal>
                <div className="memory-category-image"><PhotoImage src={category.image} alt={category.name + ' — imagem ilustrativa'} loading="lazy" width={650} height={750} sizes="(max-width: 720px) 82vw, 30vw" /><span className="category-number">{category.index}</span><span className="category-open"><ArrowUpRight size={22} /></span></div>
                <div className="memory-category-copy"><category.icon size={21} strokeWidth={1.4} /><div><h3>{category.name}</h3><p>{category.text}</p></div></div>
            </Link>)}</div>
            <div className="category-shortcuts" data-reveal><Link href="/documentos"><Printer size={23} strokeWidth={1.4} /><div><strong>Precisou imprimir?</strong><span>Documentos com praticidade.</span></div><ArrowUpRight size={20} /></Link><Link href="/fotografia"><Camera size={23} strokeWidth={1.4} /><div><strong>Um novo olhar sobre você.</strong><span>Conheça nossos ensaios fotográficos.</span></div><ArrowUpRight size={20} /></Link></div>
        </section>

        {catalog.banners.length > 0 && <section className="container campaign-banners" aria-label="Novidades da loja">{catalog.banners.map(banner => <Link href={banner.link} key={banner.id} className="campaign-banner" data-reveal>{banner.image && <PhotoImage src={banner.image} alt="" width={400} height={280} loading="lazy" />}<div><span className="eyebrow">NA FOTO DIGITAL</span><h2>{banner.title}</h2><p>{banner.subtitle}</p><span className="text-link">Conheça <ArrowRight size={18} /></span></div></Link>)}</section>}

        <section className="section container favorites-section">
            <div className="section-heading" data-reveal><div><span className="eyebrow">ESCOLHIDOS PARA INSPIRAR</span><h2>Pequenos detalhes.<br /><em>Grandes afetos.</em></h2></div><Link href="/loja" className="text-link">Ver todos os produtos <ArrowRight size={18} /></Link></div>
            <div className="product-grid">{catalog.products.filter(product => product.featured).slice(0, 4).map(product => <ProductCard key={product.id} product={product} />)}</div>
            <p className="image-disclosure">Imagens ilustrativas. Cada criação ganha a sua história.</p>
        </section>

        <section className="memory-how"><div className="container memory-how-grid">
            <div className="how-intro" data-reveal><span className="eyebrow">DO CELULAR PARA AS SUAS MÃOS</span><h2>É fácil dar<br /><em>vida às suas fotos.</em></h2><p>Escolha os momentos.<br />A gente cuida do resto com você.</p><Link href="/revelacao" className="btn light">Começar minha revelação <ArrowRight size={18} /></Link></div>
            <div className="how-steps">{[
                ['01', 'Envie suas melhores fotos', 'Escolha as imagens do celular ou computador. Seus arquivos originais são preservados.'],
                ['02', 'Deixe do seu jeito', 'Tamanho, acabamento e quantidade. Ajuste o enquadramento até ficar como você imaginou.'],
                ['03', 'Pronto para virar lembrança', 'Finalize o pedido e escolha retirar na FOTO DIGITAL ou receber no seu endereço.'],
            ].map(([number, title, description]) => <div className="how-step" key={number} data-reveal><span>{number}</span><div><h3>{title}</h3><p>{description}</p></div></div>)}</div>
        </div></section>

        <section className="section container story-teaser"><div className="story-image" data-reveal><PhotoImage src={images.album} alt="Mãos folheando um álbum de fotografias — imagem ilustrativa" loading="lazy" width={800} height={900} /><span>HISTÓRIAS QUE A GENTE GUARDA.</span></div><div className="story-copy" data-reveal><span className="eyebrow">DE CAMPO MOURÃO, COM CARINHO</span><h2>A sua história<br />faz parte<br /><em>da nossa.</em></h2><p>Há mais de duas décadas, acompanhamos os momentos de quem vive por aqui. Os primeiros dias, as grandes conquistas, a família que cresce.</p><p>Para nós, cada foto é uma história que merece atenção. E cada cliente, alguém que queremos ver voltar.</p><Link href="/sobre" className="text-link">Conheça a FOTO DIGITAL <ArrowRight size={18} /></Link><div className="story-signature"><span>Desde 2003</span>Tradicional na confiança.<br />Moderna na experiência.</div></div></section>

        {catalog.testimonials.length > 0 && <section className="section container"><div className="section-heading" data-reveal><div><span className="eyebrow">HISTÓRIAS COMPARTILHADAS</span><h2>O que nossos <em>clientes dizem</em></h2></div></div><div className="testimonial-grid">{catalog.testimonials.map(testimonial => <blockquote key={testimonial.id} data-reveal><div aria-label={testimonial.rating + ' estrelas'}>{Array.from({ length: testimonial.rating }, (_, index) => <Star key={index} size={15} fill="currentColor" />)}</div><p>“{testimonial.comment}”</p><cite>{testimonial.name}</cite></blockquote>)}</div></section>}
        <section className="local-strip container" data-reveal><div className="local-strip-icon"><MapPin size={28} strokeWidth={1.3} /></div><div><span className="eyebrow">PERTINHO DE VOCÊ</span><h3>Pode entrar. A casa é sua.</h3><p>Rua Brasil, 1367 · Campo Mourão – PR</p></div><Link href="/contato" className="btn outline">Visite nossa loja <ArrowUpRight size={18} /></Link></section>
    </>;
}
