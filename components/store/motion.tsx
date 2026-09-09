'use client';

import { type ReactNode, useEffect, useRef } from 'react';

/** Progressive enhancement: content remains visible without JavaScript or observer support. */
export function ExperienceMotion({ children, path }: { children: ReactNode; path: string }) {
    const root = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const surface = root.current;
        const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (!surface || !('IntersectionObserver' in window) || preference.matches) return;
        const known = new WeakSet<Element>();
        let frame = 0;
        const show = (element: HTMLElement) => {
            element.dataset.revealState = 'visible';
            observer.unobserve(element);
        };
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => { if (entry.isIntersecting) show(entry.target as HTMLElement); });
        }, { threshold: 0.06, rootMargin: '0px 0px -20px 0px' });
        const discover = () => {
            surface.querySelectorAll<HTMLElement>('[data-reveal], .service-card, .about-hero, .values-grid > div, .cart-item, .admin-metrics .panel').forEach((element, index) => {
                if (known.has(element)) return;
                known.add(element);
                if (element.getBoundingClientRect().top < window.innerHeight * 0.94) {
                    if (element.dataset.revealState) show(element);
                    return;
                }
                element.style.setProperty('--reveal-delay', `${(index % 3) * 60}ms`);
                element.dataset.revealState = 'pending';
                observer.observe(element);
            });
        };
        const mutations = new MutationObserver(() => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(discover);
        });
        const onFocus = (event: FocusEvent) => {
            const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-reveal-state="pending"]') : null;
            if (target) show(target);
        };
        const onPreference = () => {
            if (preference.matches) surface.querySelectorAll<HTMLElement>('[data-reveal-state]').forEach(show);
        };
        discover();
        mutations.observe(surface, { childList: true, subtree: true });
        surface.addEventListener('focusin', onFocus);
        preference.addEventListener('change', onPreference);
        return () => {
            cancelAnimationFrame(frame);
            observer.disconnect();
            mutations.disconnect();
            surface.removeEventListener('focusin', onFocus);
            preference.removeEventListener('change', onPreference);
        };
    }, [path]);
    return <div className="experience-root" ref={root}>{children}</div>;
}
