'use client';

import type { Catalog } from '@/lib/shared/types';
import { ArrowLeft, ArrowRight, ArrowUpRight, Pause, Play, Upload } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { PhotoImage } from './media';

type Slide = Catalog['banners'][number];
const duration = 6500;

export function PhotoShowcase({ slides }: { slides: Slide[] }) {
    const router = useRouter();
    const [position, setPosition] = useState(0);
    const [paused, setPaused] = useState(false);
    const [reduced, setReduced] = useState(true);
    const [visible, setVisible] = useState(true);
    const root = useRef<HTMLElement>(null);
    const touch = useRef<{ x: number; y: number } | null>(null);
    const inView = useRef(true);
    const suppressClickUntil = useRef(0);
    const count = slides.length;
    const active = count ? ((position % count) + count) % count : 0;
    const slide = slides[active];
    const running = count > 1 && !paused && !reduced && visible;
    const move = useCallback((step: number, manual = true) => {
        setPosition(p => p + step);
        if (manual) setPaused(true);
    }, []);

    useEffect(() => {
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        const sync = () => setReduced(media.matches);
        sync();
        media.addEventListener('change', sync);
        const visibility = () => setVisible(inView.current && !document.hidden);
        document.addEventListener('visibilitychange', visibility);
        const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => { inView.current = entry.isIntersecting; visibility(); }, { threshold: .15 });
        if (root.current) observer?.observe(root.current);
        return () => { media.removeEventListener('change', sync); document.removeEventListener('visibilitychange', visibility); observer?.disconnect(); };
    }, []);
    useEffect(() => {
        if (!running) return;
        const timer = window.setTimeout(() => move(1, false), duration);
        return () => window.clearTimeout(timer);
    }, [running, position, move]);

    return <section ref={root} className={'photo-showcase container' + (!count ? ' showcase-empty' : '')} aria-labelledby="home-title"
        onFocusCapture={event => { if (!(event.target as HTMLElement).closest('.showcase-pause')) setPaused(true); }}>
        <div className="showcase-copy">
            <span className="eyebrow hero-enter">FOTO DIGITAL · DESDE 2003</span>
            <h1 id="home-title" className="hero-enter">A vida acontece.<br /><span>A foto fica.</span></h1>
            <p className="hero-enter">Suas melhores lembranças merecem sair da tela. Revele, presenteie e guarde o que faz a sua história.</p>
            <div className="hero-buttons hero-enter"><Link href="/revelacao" className="btn"><Upload size={18} /> Revelar minhas fotos</Link><Link href="/loja" className="text-link">Conhecer produtos <ArrowUpRight size={18} /></Link></div>
            <div className="showcase-signature"><span>QUALIDADE FUJIFILM</span><span>Produção em Campo Mourão, PR</span></div>
        </div>
        {!!count && <div className="showcase-gallery" role="region" aria-roledescription="carrossel" aria-label="Fotografias e produtos em destaque">
            <div className="photo-orbit" tabIndex={0} aria-label="Vitrine de fotos. Use as setas para navegar."
                onKeyDown={event => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); move(event.key === 'ArrowRight' ? 1 : -1); } }}
                onTouchStart={event => { touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }}
                onTouchCancel={() => { touch.current = null; }}
                onTouchEnd={event => { if (!touch.current) return; const dx = event.changedTouches[0].clientX - touch.current.x; const dy = event.changedTouches[0].clientY - touch.current.y; if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) { suppressClickUntil.current = Date.now() + 500; move(dx < 0 ? 1 : -1); } touch.current = null; }}>
                {slides.map((photo, index) => {
                    // Continuous angles avoid a jump when the last photo wraps to the first.
                    const angle = (index - position) * (360 / count);
                    const normalized = ((index - active + count * 1.5) % count) - count / 2;
                    const theta = normalized * 2 * Math.PI / count;
                    const depth = Math.cos(theta);
                    const style = { '--angle': angle + 'deg', '--counter-angle': -angle + 'deg', '--photo-opacity': .64 + (depth + 1) * .18, '--tilt': -Math.sin(theta) * 24 + 'deg', zIndex: Math.round((depth + 1) * 10) } as CSSProperties;
                    return <button key={photo.id} className={'orbit-photo' + (index === active ? ' is-active' : '')} style={style} tabIndex={index === active ? 0 : -1} aria-hidden={index !== active} aria-label={index === active ? photo.title + '. Abrir detalhes.' : undefined}
                        onClick={() => { if (Date.now() < suppressClickUntil.current) return; if (index === active) router.push(photo.link); else move(Math.round(normalized)); }}>
                        <span className="orbit-print"><PhotoImage src={photo.image} alt={photo.title + (photo.illustrative ? ' — imagem ilustrativa' : '')} width={560} height={700} sizes="(max-width: 720px) 62vw, 360px" fetchPriority={index === 0 ? 'high' : undefined} loading={index > 2 ? 'lazy' : 'eager'} /><span className="orbit-photo-label">FOTO DIGITAL<span>{String(index + 1).padStart(2, '0')}</span></span></span>
                    </button>;
                })}
            </div>
            <div className="showcase-caption" aria-live={paused || reduced ? 'polite' : 'off'} aria-atomic="true"><div key={slide.id} className="showcase-caption-content"><span className="eyebrow">{String(active + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}{slide.illustrative ? ' · IMAGEM ILUSTRATIVA' : ''}</span><h2><Link href={slide.link}>{slide.title}<ArrowUpRight size={19} /></Link></h2><p>{slide.subtitle}</p></div></div>
            {count > 1 && <div className="showcase-controls"><div className="showcase-dots" aria-label="Escolher destaque">{slides.map((photo, index) => <button type="button" key={photo.id} aria-label={'Mostrar: ' + photo.title} aria-current={index === active ? 'true' : undefined} onClick={() => move(index - active)}><span /></button>)}</div><div className="showcase-arrows"><button type="button" aria-label="Foto anterior" onClick={() => move(-1)}><ArrowLeft size={19} /></button>{!reduced && <button type="button" className="showcase-pause" aria-label={paused ? 'Retomar apresentação automática' : 'Pausar apresentação automática'} onClick={() => setPaused(p => !p)}>{paused ? <Play size={16} /> : <Pause size={16} />}</button>}<button type="button" aria-label="Próxima foto" onClick={() => move(1)}><ArrowRight size={19} /></button></div></div>}
        </div>}
    </section>;
}
