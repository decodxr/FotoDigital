'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowDown, ArrowUpRight, Pause, Play, RotateCw } from 'lucide-react';
import { Component, useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { cameraChapters, chapterAt, scrollProgress } from '@/lib/shared/camera-motion';
import type { CameraStageProps } from './camera-stage';
import { PhotoImage } from './media';

const CameraStage = dynamic<CameraStageProps>(() => import('./camera-stage'), { ssr: false });

class CameraLoadBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    componentDidCatch() { this.props.onError(); }
    render() { return this.state.failed ? null : this.props.children; }
}

export function CameraStory() {
    const section = useRef<HTMLElement>(null);
    const sticky = useRef<HTMLDivElement>(null);
    const progress = useRef(0);
    const pointer = useRef({ x: 0, y: 0 });
    const invalidate = useRef<(() => void) | null>(null);
    const activeRef = useRef(0);
    const [active, setActive] = useState(0);
    const [nearby, setNearby] = useState(false);
    const [visible, setVisible] = useState(false);
    const [reduced, setReduced] = useState(false);
    const [paused, setPaused] = useState(false);
    const [mobile, setMobile] = useState(false);
    const [ready, setReady] = useState(false);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        const motion = matchMedia('(prefers-reduced-motion: reduce)');
        const small = matchMedia('(max-width: 760px)');
        const sync = () => { setReduced(motion.matches); setMobile(small.matches); };
        sync();
        motion.addEventListener('change', sync);
        small.addEventListener('change', sync);
        return () => { motion.removeEventListener('change', sync); small.removeEventListener('change', sync); };
    }, []);

    useEffect(() => {
        if (!section.current) return;
        const preload = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) { setNearby(true); preload.disconnect(); }
        }, { rootMargin: '450px 0px' });
        const visibility = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
        preload.observe(section.current);
        visibility.observe(section.current);
        return () => { preload.disconnect(); visibility.disconnect(); };
    }, []);

    useEffect(() => {
        const element = section.current;
        const stage = sticky.current;
        if (!element || !stage) return;
        const header = document.querySelector<HTMLElement>('.site-header');
        let frame = 0;
        const update = () => {
            frame = 0;
            const rect = element.getBoundingClientRect();
            const inset = header?.getBoundingClientRect().height ?? 0;
            element.style.setProperty('--camera-top', inset + 'px');
            const next = scrollProgress(rect.top, rect.height, stage.offsetHeight, inset, innerHeight);
            progress.current = reduced ? 0 : next;
            element.style.setProperty('--camera-progress', String(next));
            const chapter = chapterAt(next);
            if (chapter !== activeRef.current) { activeRef.current = chapter; setActive(chapter); }
            invalidate.current?.();
        };
        const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
        const observer = new ResizeObserver(schedule);
        observer.observe(element);
        if (header) observer.observe(header);
        update();
        addEventListener('scroll', schedule, { passive: true });
        addEventListener('resize', schedule);
        return () => {
            removeEventListener('scroll', schedule);
            removeEventListener('resize', schedule);
            observer.disconnect();
            cancelAnimationFrame(frame);
        };
    }, [reduced]);

    const move = (event: PointerEvent<HTMLDivElement>) => {
        if (reduced || paused || event.pointerType === 'touch') return;
        const rect = event.currentTarget.getBoundingClientRect();
        pointer.current = { x: (event.clientX - rect.left) / rect.width * 2 - 1, y: (event.clientY - rect.top) / rect.height * 2 - 1 };
        invalidate.current?.();
    };
    const resetPointer = () => { pointer.current = { x: 0, y: 0 }; invalidate.current?.(); };
    const revealChapter = (index: number) => {
        const element = section.current;
        const stage = sticky.current;
        if (!element || !stage) return;
        const inset = Number.parseFloat(getComputedStyle(element).getPropertyValue('--camera-top')) || 0;
        if (reduced || matchMedia('(max-height: 620px)').matches) {
            document.getElementById('camera-chapter-' + index)?.scrollIntoView({ block: 'center', behavior: 'auto' });
            return;
        }
        const ratio = [0.04, 0.5, 0.96][index];
        scrollTo({ top: scrollY + element.getBoundingClientRect().top - inset + ratio * (element.offsetHeight - stage.offsetHeight), behavior: 'smooth' });
    };
    const onReady = useCallback(() => setReady(true), []);
    const onError = useCallback(() => { setFailed(true); setReady(false); }, []);

    return <section ref={section} className={'camera-story' + (reduced ? ' is-reduced' : '')} aria-labelledby="camera-story-title">
        <div className="camera-story-sticky" ref={sticky}>
            <div className="camera-story-panel">
                <div className="camera-story-masthead"><span>A ESSÊNCIA DE FOTOGRAFAR</span><span>FOTO DIGITAL <b> / </b> DESDE 2003</span></div>
                <div className="camera-story-composition">
                    <div className="camera-story-visual" onPointerMove={move} onPointerLeave={resetPointer}>
                        <span className="camera-story-watermark" aria-hidden="true">MEMÓRIAS</span>
                        <div className={'camera-story-poster' + (ready && !reduced ? ' is-hidden' : '')}>
                            <PhotoImage src="/models/camera/camera-poster.webp" alt="Câmera fotográfica vintage em metal e couro, com lente de vidro" width={1200} height={960} loading="lazy" />
                        </div>
                        {nearby && !reduced && !failed && <div className="camera-story-canvas" aria-hidden="true">
                            <CameraLoadBoundary key={attempt} onError={onError}><CameraStage progress={progress} pointer={pointer} invalidateRef={invalidate} visible={visible} paused={paused} mobile={mobile} onReady={onReady} onError={onError} /></CameraLoadBoundary>
                        </div>}
                        <div className="camera-story-visual-footer"><span>CÂMERA ANALÓGICA <span className="camera-story-dot">·</span> ESTUDO DE LUZ</span>
                            {!reduced && <button type="button" className="camera-story-motion" onClick={() => { setPaused(value => !value); resetPointer(); }} aria-label={paused ? 'Retomar movimento da câmera' : 'Pausar movimento da câmera'} aria-pressed={paused}>{paused ? <Play size={15} /> : <Pause size={15} />}</button>}
                        </div>
                        {nearby && !ready && !failed && !reduced && <span className="camera-story-loading-note" role="status">Preparando a câmera em 3D…</span>}
                        {failed && <button type="button" className="camera-story-retry" onClick={() => { setFailed(false); setAttempt(value => value + 1); }}><RotateCw size={15} /> Recarregar visualização 3D</button>}
                    </div>
                    <div className="camera-story-copy">
                        <div className="camera-story-intro"><span className="camera-story-kicker">UM OUTRO TEMPO. A MESMA EMOÇÃO.</span><h2 id="camera-story-title">O tempo passa.<br /><span>O olhar fica.</span></h2></div>
                        <div className="camera-story-chapters">{cameraChapters.map((chapter, index) => <article id={'camera-chapter-' + index} className={'camera-story-chapter' + (index === active ? ' is-active' : '')} key={chapter.label}>
                            <span className="camera-story-chapter-number" aria-hidden="true">0{index + 1} <span>/</span> 03</span>
                            <h3>{chapter.title}</h3><p>{chapter.text}</p>
                        </article>)}</div>
                        <Link className="camera-story-link" href="/revelacao">Dê vida às suas lembranças <ArrowUpRight size={19} /></Link>
                        <nav className="camera-story-navigation" aria-label="Explorar a câmera">{cameraChapters.map((chapter, index) => <button type="button" key={chapter.label} aria-current={active === index ? 'step' : undefined} onClick={() => revealChapter(index)}><span>0{index + 1}</span>{chapter.label}</button>)}</nav>
                    </div>
                </div>
                <div className="camera-story-footer"><span className="camera-story-scroll"><ArrowDown size={14} /> Role e descubra cada detalhe</span><a href="https://polyhaven.com/a/Camera_01" target="_blank" rel="noreferrer">Modelo: Rajil Jose Macatangay / Poly Haven · CC0</a></div>
                <div className="camera-story-progress" aria-hidden="true"><span /></div>
            </div>
        </div>
    </section>;
}
