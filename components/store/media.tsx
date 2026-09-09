'use client';
/* eslint-disable @next/next/no-img-element -- Private thumbnails require session cookies; public catalog images use CDN variants. */
import { Camera } from 'lucide-react';
import type { ImgHTMLAttributes } from 'react';
import { useState } from 'react';
export function PhotoImage({ src, alt = '', className = '', ...props }: ImgHTMLAttributes<HTMLImageElement>) { const [failed, setFailed] = useState(false); if (failed || !src)
    return <span className={'image-fallback ' + className} role="img" aria-label={alt || 'Imagem indisponível'}><Camera size={28} strokeWidth={1.2}/><small>Imagem indisponível</small></span>; let srcSet: string | undefined; if (typeof src === 'string' && src.startsWith('https://images.pexels.com/')) {
    srcSet = [360, 640, 960, 1400].map(w => { const u = new URL(src); u.searchParams.set('w', String(w)); return u.toString() + ' ' + w + 'w'; }).join(', ');
} return <img {...props} src={src} alt={alt} className={className} srcSet={srcSet} sizes={srcSet ? '(max-width: 640px) 92vw, (max-width: 1024px) 45vw, 45vw' : undefined} decoding="async" onError={() => setFailed(true)}/>; }
