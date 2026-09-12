'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Component, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import {
    ACESFilmicToneMapping, Box3, Color, Group, Mesh, MeshBasicMaterial,
    MeshPhysicalMaterial, MeshStandardMaterial, PlaneGeometry, PMREMGenerator,
    Scene, SRGBColorSpace, Texture, Vector3,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { cameraPose } from '@/lib/shared/camera-motion';

export type CameraStageProps = {
    progress: RefObject<number>;
    pointer: RefObject<{ x: number; y: number }>;
    invalidateRef: RefObject<(() => void) | null>;
    visible: boolean;
    paused: boolean;
    mobile: boolean;
    onReady: () => void;
    onError: () => void;
};

function disposeModel(root: Group) {
    const textures = new Set<Texture>();
    const materials = new Set<MeshStandardMaterial>();
    root.traverse(object => {
        if (!(object instanceof Mesh)) return;
        object.geometry.dispose();
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            materials.add(material);
            for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
        }
    });
    materials.forEach(material => material.dispose());
    textures.forEach(texture => {
        const image = texture.source.data;
        if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) image.close();
        texture.dispose();
    });
}

/** A captured softbox studio: reflections are sampled by every PBR material. */
function StudioEnvironment() {
    const { gl, scene, invalidate } = useThree();
    useEffect(() => {
        const environment = new Scene();
        environment.background = new Color('#34373a');
        const softboxes: [number, number, number, number, number, string, number][] = [
            [-4, 4, 5, 5, 7, '#fff5e9', 5],
            [5, 1, 3, 2, 6, '#dce8ff', 4],
            [0, 6, -1, 6, 3, '#ffffff', 6],
            [-3, 1, -5, 3, 5, '#cfdef1', 3],
        ];
        for (const [x, y, z, width, height, color, intensity] of softboxes) {
            const panel = new Mesh(new PlaneGeometry(width, height), new MeshBasicMaterial({ color: new Color(color).multiplyScalar(intensity), toneMapped: false }));
            panel.position.set(x, y, z);
            panel.lookAt(0, 0, 0);
            environment.add(panel);
        }
        const generator = new PMREMGenerator(gl);
        const target = generator.fromScene(environment, 0.05, 0.1, 40);
        const previous = scene.environment;
        // Three's external scene is intentionally mutable; this is not React state.
        // eslint-disable-next-line react-hooks/immutability
        scene.environment = target.texture;
        scene.environmentIntensity = 0.95;
        invalidate();
        environment.traverse(object => {
            if (object instanceof Mesh) { object.geometry.dispose(); (object.material as MeshBasicMaterial).dispose(); }
        });
        generator.dispose();
        return () => { scene.environment = previous; target.dispose(); };
    }, [gl, scene, invalidate]);
    return null;
}

function CameraAsset({ progress, pointer, invalidateRef, visible, paused, mobile, onReady, onError }: CameraStageProps) {
    const { gl, camera, scene, invalidate, size } = useThree();
    const pivot = useRef<Group>(null);
    const [model, setModel] = useState<Group | null>(null);
    const displayedProgress = useRef(0);
    const awake = useRef(true);
    const docVisible = useRef(true);
    const src = mobile ? '/models/camera/camera-mobile.glb' : '/models/camera/camera-studio.glb';

    useEffect(() => {
        const controller = new AbortController();
        let destroyed = false;
        let asset: Group | null = null;
        const deadline = setTimeout(() => controller.abort(), 25000);
        fetch(src, { signal: controller.signal, cache: 'force-cache' })
            .then(response => {
                if (!response.ok) throw new Error('Camera asset unavailable');
                return response.arrayBuffer();
            })
            .then(bytes => new GLTFLoader().parseAsync(bytes, '/models/camera/'))
            .then(gltf => {
                asset = gltf.scene;
                if (destroyed) { disposeModel(asset); return; }
                // The source includes a loose strap laid behind the camera.
                // Keep the detailed camera body and its mounted parts as the hero.
                const looseStrap = asset.getObjectByName('Camera_01_strap');
                if (looseStrap) {
                    looseStrap.visible = false;
                }
                const cameraBody = asset.getObjectByName('Camera_01') ?? asset;
                const bounds = new Box3().setFromObject(cameraBody);
                const center = bounds.getCenter(new Vector3());
                const extent = bounds.getSize(new Vector3());
                asset.position.copy(center).multiplyScalar(-1);
                const normalized = new Group();
                normalized.add(asset);
                normalized.scale.setScalar(3.8 / extent.x);
                normalized.traverse(object => {
                    if (!(object instanceof Mesh)) return;
                    const materials = Array.isArray(object.material) ? object.material : [object.material];
                    for (const material of materials) {
                        if (!(material instanceof MeshStandardMaterial)) continue;
                        material.envMapIntensity = 1.05;
                        if (material.name === 'Camera_01_lens' && material instanceof MeshPhysicalMaterial) {
                            material.color.set('#d5e6ea');
                            material.roughness = 0.075;
                            material.transmission = 0.92;
                            material.thickness = 0.025;
                            material.ior = 1.52;
                            material.clearcoat = 1;
                            material.clearcoatRoughness = 0.045;
                        }
                        for (const value of Object.values(material)) {
                            if (value instanceof Texture) value.anisotropy = Math.min(4, gl.capabilities.getMaxAnisotropy());
                        }
                    }
                });
                setModel(normalized);
            })
            .catch(() => { if (!destroyed) onError(); })
            .finally(() => clearTimeout(deadline));
        return () => { destroyed = true; clearTimeout(deadline); controller.abort(); if (asset) disposeModel(asset); };
    }, [src, gl, onError]);

    useEffect(() => {
        if (!model) return;
        let stopped = false;
        let frame = 0;
        gl.compileAsync(scene, camera).then(() => {
            if (stopped) return;
            invalidate();
            frame = requestAnimationFrame(() => { if (!stopped) onReady(); });
        }).catch(onError);
        return () => { stopped = true; cancelAnimationFrame(frame); };
    }, [model, gl, scene, camera, invalidate, onReady, onError]);

    useEffect(() => {
        const wake = () => {
            if (!docVisible.current || !visible || paused) return;
            awake.current = true;
            invalidate();
        };
        invalidateRef.current = wake;
        const visibility = () => { docVisible.current = !document.hidden; wake(); };
        const lost = () => onError();
        document.addEventListener('visibilitychange', visibility);
        gl.domElement.addEventListener('webglcontextlost', lost);
        wake();
        return () => {
            invalidateRef.current = null;
            document.removeEventListener('visibilitychange', visibility);
            gl.domElement.removeEventListener('webglcontextlost', lost);
        };
    }, [invalidateRef, visible, paused, onError, invalidate, gl]);

    useFrame((_, elapsed) => {
        if (!pivot.current || !model || paused) return;
        const delta = Math.min(elapsed, 0.05);
        const target = progress.current;
        displayedProgress.current += (target - displayedProgress.current) * (1 - Math.exp(-5.5 * delta));
        const pose = cameraPose(displayedProgress.current);
        const x = pointer.current.x;
        const y = pointer.current.y;
        const targetX = pose.pitch + y * 0.045;
        const targetY = pose.yaw + x * 0.11;
        const alpha = 1 - Math.exp(-7 * delta);
        pivot.current.rotation.x += (targetX - pivot.current.rotation.x) * alpha;
        pivot.current.rotation.y += (targetY - pivot.current.rotation.y) * alpha;
        pivot.current.rotation.z += (pose.roll - pivot.current.rotation.z) * alpha;
        pivot.current.position.y += (-y * 0.065 - pivot.current.position.y) * alpha;
        // Maintain full framing in portrait and wide aspect ratios.
        const framing = Math.min(1, size.width / Math.max(1, size.height) / 1.1);
        pivot.current.scale.setScalar(pose.scale * framing);
        const settling = Math.abs(target - displayedProgress.current) + Math.abs(targetY - pivot.current.rotation.y) + Math.abs(targetX - pivot.current.rotation.x) + Math.abs(-y * 0.065 - pivot.current.position.y);
        awake.current = settling > 0.0001;
        if (awake.current && visible && docVisible.current) invalidate();
    });

    return <group ref={pivot} rotation={[0.13, -0.42, -0.055]}>{model && <primitive object={model} />}</group>;
}

class StageBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    componentDidCatch() { this.props.onError(); }
    render() { return this.state.failed ? null : this.props.children; }
}

function Unavailable({ onError }: { onError: () => void }) {
    useEffect(onError, [onError]);
    return null;
}

export default function CameraStage(props: CameraStageProps) {
    return <StageBoundary onError={props.onError}>
        <Canvas
            frameloop="demand"
            camera={{ position: [0, 0.15, 7.7], fov: 34, near: 0.1, far: 60 }}
            dpr={props.mobile ? [1, 1.25] : [1, 1.75]}
            gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
            fallback={<Unavailable onError={props.onError} />}
            onCreated={({ gl }) => {
                gl.toneMapping = ACESFilmicToneMapping;
                gl.toneMappingExposure = 1.08;
                gl.outputColorSpace = SRGBColorSpace;
                gl.setClearAlpha(0);
            }}
            style={{ touchAction: 'pan-y', pointerEvents: 'none' }}
        >
            <StudioEnvironment />
            <ambientLight intensity={0.22} />
            <directionalLight position={[-3, 5, 4]} intensity={2.3} color="#fff7ec" />
            <directionalLight position={[4, 1, -2]} intensity={1.8} color="#d4e4ff" />
            <CameraAsset {...props} />
        </Canvas>
    </StageBoundary>;
}
