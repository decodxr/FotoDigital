'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { Aperture, Focus, ScanLine } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type MutableRefObject, type PointerEvent } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

type MotionPoint = { x: number; y: number };
const chapters = [
    { index: '01', label: 'Corpo', title: 'Feita para observar.', text: 'Metal, textura e precisão em uma forma que atravessa gerações. Um convite para olhar com calma antes de guardar o instante.', Icon: ScanLine },
    { index: '02', label: 'Lente', title: 'Luz, textura, presença.', text: 'É pela lente que a luz encontra a memória. Cada reflexo, contraste e detalhe ajuda a contar uma história com verdade.', Icon: Aperture },
    { index: '03', label: 'Memória', title: 'O clique passa. A memória fica.', text: 'Há mais de duas décadas, transformamos imagens em lembranças para tocar, presentear e manter sempre por perto.', Icon: Focus },
];

function ease(current: number, target: number, speed: number, delta: number) {
    return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-speed * delta));
}

function CameraModel({ progress, pointer }: { progress: MutableRefObject<number>; pointer: MutableRefObject<MotionPoint> }) {
    const camera = useRef<THREE.Group>(null);
    const lensGlass = useRef<THREE.Mesh>(null);
    const body = useMemo(() => new RoundedBoxGeometry(3.55, 2.05, 1.02, 5, 0.13), []);
    const topPlate = useMemo(() => new RoundedBoxGeometry(3.48, 0.34, 0.96, 4, 0.08), []);

    useFrame((state, delta) => {
        if (!camera.current) return;
        const p = progress.current;
        camera.current.rotation.y = ease(camera.current.rotation.y, -0.62 + p * Math.PI * 2.12 + pointer.current.x * 0.12, 4.7, delta);
        camera.current.rotation.x = ease(camera.current.rotation.x, -0.06 + Math.sin(p * Math.PI) * 0.08 + pointer.current.y * 0.05, 4, delta);
        camera.current.rotation.z = ease(camera.current.rotation.z, Math.sin(p * Math.PI * 2) * 0.025 - pointer.current.x * 0.018, 4, delta);
        camera.current.position.y = ease(camera.current.position.y, Math.sin(state.clock.elapsedTime * 0.7) * 0.055 - pointer.current.y * 0.08, 2.4, delta);
        camera.current.position.x = ease(camera.current.position.x, (p - 0.5) * 0.16 + pointer.current.x * 0.09, 3.5, delta);
        if (lensGlass.current) lensGlass.current.rotation.z += delta * 0.06;
    });

    const metal = '#b8b9b7';
    const darkMetal = '#242525';
    return <group ref={camera} scale={1.05}>
        <mesh geometry={body} castShadow receiveShadow><meshPhysicalMaterial color="#111211" roughness={0.68} metalness={0.18} clearcoat={0.22} clearcoatRoughness={0.6} /></mesh>
        <mesh geometry={topPlate} position={[0, 0.88, 0.01]} castShadow><meshStandardMaterial color={metal} metalness={0.9} roughness={0.25} /></mesh>
        <mesh position={[0, -0.94, 0]} scale={[3.42, 0.17, 0.94]} castShadow><boxGeometry /><meshStandardMaterial color={darkMetal} metalness={0.78} roughness={0.29} /></mesh>
        <mesh position={[-0.9, 0.34, 0.555]} castShadow><boxGeometry args={[0.64, 0.38, 0.08]} /><meshPhysicalMaterial color="#151a1b" roughness={0.18} clearcoat={0.9} /></mesh>
        <mesh position={[-0.9, 0.34, 0.602]}><planeGeometry args={[0.43, 0.21]} /><meshPhysicalMaterial color="#6c9895" emissive="#133334" emissiveIntensity={0.35} roughness={0.08} clearcoat={1} /></mesh>
        <mesh position={[0.02, 0.41, 0.555]}><circleGeometry args={[0.18, 32]} /><meshPhysicalMaterial color="#403f36" emissive="#7c642a" emissiveIntensity={0.12} roughness={0.18} clearcoat={1} /></mesh>

        <group position={[0.66, -0.06, 0.68]} rotation={[Math.PI / 2, 0, 0]}>
            <mesh castShadow><cylinderGeometry args={[0.82, 0.87, 0.42, 64]} /><meshStandardMaterial color="#161716" metalness={0.78} roughness={0.24} /></mesh>
            <mesh position={[0, -0.27, 0]} castShadow><cylinderGeometry args={[0.71, 0.78, 0.18, 64]} /><meshStandardMaterial color={metal} metalness={0.94} roughness={0.17} /></mesh>
            <mesh position={[0, -0.42, 0]} castShadow><cylinderGeometry args={[0.61, 0.69, 0.18, 64]} /><meshStandardMaterial color="#111211" metalness={0.82} roughness={0.2} /></mesh>
            <mesh position={[0, -0.53, 0]} ref={lensGlass}><cylinderGeometry args={[0.52, 0.57, 0.07, 64]} /><meshPhysicalMaterial color="#142b33" emissive="#061217" emissiveIntensity={0.2} roughness={0.05} transmission={0.3} thickness={0.5} clearcoat={1} iridescence={0.4} /></mesh>
            <mesh position={[0, -0.57, 0]}><circleGeometry args={[0.27, 48]} /><meshBasicMaterial color="#050707" /></mesh>
        </group>

        <mesh position={[-1.24, 1.12, 0.03]} castShadow><cylinderGeometry args={[0.34, 0.34, 0.16, 36]} /><meshStandardMaterial color={darkMetal} metalness={0.9} roughness={0.25} /></mesh>
        <mesh position={[-1.24, 1.215, 0.03]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.24, 32]} /><meshStandardMaterial color="#8f908e" metalness={0.95} roughness={0.21} /></mesh>
        <mesh position={[1.16, 1.1, 0.01]} castShadow><cylinderGeometry args={[0.29, 0.29, 0.18, 36]} /><meshStandardMaterial color={darkMetal} metalness={0.9} roughness={0.24} /></mesh>
        <mesh position={[1.16, 1.205, 0.01]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.2, 32]} /><meshStandardMaterial color="#b9bab8" metalness={0.96} roughness={0.18} /></mesh>
        <mesh position={[0.72, 1.13, 0.12]} castShadow><cylinderGeometry args={[0.105, 0.105, 0.19, 24]} /><meshStandardMaterial color="#d2d2cf" metalness={0.98} roughness={0.16} /></mesh>
        {[-1.74, 1.74].map(x => <mesh key={x} position={[x, 0.12, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.18, 0.045, 10, 24]} /><meshStandardMaterial color={metal} metalness={0.92} roughness={0.24} /></mesh>)}
        {[-1.4, 1.42].map(x => <mesh key={x} position={[x, -0.64, 0.55]}><circleGeometry args={[0.055, 18]} /><meshStandardMaterial color="#8e8f8d" metalness={0.95} roughness={0.22} /></mesh>)}
        <mesh position={[-0.62, -0.05, -0.555]}><boxGeometry args={[1.35, 0.93, 0.05]} /><meshStandardMaterial color="#0a0b0a" roughness={0.8} /></mesh>
    </group>;
}

function CameraScene({ progress, pointer }: { progress: MutableRefObject<number>; pointer: MutableRefObject<MotionPoint> }) {
    return <><ambientLight intensity={0.46} color="#d9e2e0" /><directionalLight position={[-4, 5, 5]} intensity={3.1} color="#fff7e8" /><directionalLight position={[4, 1, 2]} intensity={2.3} color="#b9dfe4" /><pointLight position={[0, -2, 3]} intensity={8} distance={7} color="#ab7651" /><CameraModel progress={progress} pointer={pointer} /><mesh position={[0, -1.63, -0.1]} rotation={[-Math.PI / 2, 0, 0]} scale={[2.9, 1.2, 1]}><circleGeometry args={[1, 48]} /><meshBasicMaterial color="#000000" transparent opacity={0.27} depthWrite={false} /></mesh></>;
}

export function CameraStory() {
    const sectionRef = useRef<HTMLElement>(null);
    const progress = useRef(0);
    const pointer = useRef<MotionPoint>({ x: 0, y: 0 });
    const frame = useRef<number | null>(null);
    const [active, setActive] = useState(0);
    const [visible, setVisible] = useState(false);
    const [reducedMotion, setReducedMotion] = useState(false);

    useEffect(() => {
        const query = window.matchMedia('(prefers-reduced-motion: reduce)');
        const sync = () => setReducedMotion(query.matches);
        sync(); query.addEventListener('change', sync);
        return () => query.removeEventListener('change', sync);
    }, []);
    useEffect(() => {
        const element = sectionRef.current;
        if (!element) return;
        const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '30% 0px' });
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    useEffect(() => {
        if (reducedMotion) return;
        const update = () => {
            frame.current = null;
            const element = sectionRef.current;
            if (!element) return;
            const rect = element.getBoundingClientRect();
            const next = THREE.MathUtils.clamp(-rect.top / Math.max(1, rect.height - window.innerHeight), 0, 1);
            progress.current = next;
            setActive(Math.min(chapters.length - 1, Math.floor(next * chapters.length)));
        };
        const onScroll = () => { if (frame.current === null) frame.current = requestAnimationFrame(update); };
        update(); window.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('resize', onScroll);
        return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); if (frame.current !== null) cancelAnimationFrame(frame.current); };
    }, [reducedMotion]);

    const onPointerMove = (event: PointerEvent<HTMLElement>) => {
        if (reducedMotion) return;
        const rect = event.currentTarget.getBoundingClientRect();
        pointer.current = { x: ((event.clientX - rect.left) / rect.width - 0.5) * 2, y: ((event.clientY - rect.top) / Math.min(rect.height, window.innerHeight) - 0.5) * 2 };
    };

    return <section className={`camera-story${reducedMotion ? ' is-reduced' : ''}`} ref={sectionRef} onPointerMove={onPointerMove} onPointerLeave={() => { pointer.current = { x: 0, y: 0 }; }} aria-labelledby="camera-story-title">
        <div className="camera-story-sticky"><div className="camera-story-glow" aria-hidden="true" /><div className="camera-story-grid container">
            <div className="camera-story-visual" aria-label="Modelo tridimensional autoral de uma câmera fotográfica vintage">
                <Canvas camera={{ position: [0, 0.08, 6.6], fov: 34 }} dpr={[1, 1.5]} frameloop={visible ? 'always' : 'demand'} gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}><CameraScene progress={progress} pointer={pointer} /></Canvas>
                <div className="camera-story-orbit" aria-hidden="true"><span /></div><p className="camera-story-caption">Modelo 3D autoral · inspirado em câmeras clássicas</p>
            </div>
            <div className="camera-story-copy"><div className="camera-story-intro"><span className="camera-story-kicker">O OLHAR POR TRÁS DE CADA MEMÓRIA</span><h2 id="camera-story-title">Uma câmera.<br />Mil maneiras de lembrar.</h2></div>
                <div className="camera-story-chapters">{chapters.map(({ index, label, title, text, Icon }, chapterIndex) => <article className={`camera-story-chapter${active === chapterIndex ? ' is-active' : ''}`} key={index} aria-hidden={!reducedMotion && active !== chapterIndex}><div className="camera-story-meta"><span>{index}</span><Icon size={18} strokeWidth={1.35} /><span>{label}</span></div><h3>{title}</h3><p>{text}</p>{chapterIndex === chapters.length - 1 && <Link href="/fotografia" className="camera-story-link">Conheça nosso olhar <span aria-hidden="true">↗</span></Link>}</article>)}</div>
                <div className="camera-story-progress" aria-label={`Capítulo ${active + 1} de ${chapters.length}`}>{chapters.map((chapter, index) => <span key={chapter.index} className={index <= active ? 'is-filled' : ''} />)}</div>
            </div>
        </div><div className="camera-story-scroll" aria-hidden="true"><span>↓</span><span>Role para explorar</span></div></div>
    </section>;
}
