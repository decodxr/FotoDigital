import type { Crop, OrderStatus } from './types';
export const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
export const defaultCrop: Crop = { x: 50, y: 50, zoom: 1, rotation: 0, fit: 'cover' };
export function photoQuality(width: number, height: number, cmWidth: number, cmHeight: number, crop: Crop = defaultCrop) {
    if (!width || !height)
        return { dpi: 0, label: 'Resolução não identificada', level: 'unknown' };
    const rotated = Math.abs(crop.rotation % 180) === 90;
    const w = rotated ? height : width, h = rotated ? width : height;
    const densities = [w / (cmWidth / 2.54), h / (cmHeight / 2.54)];
    const dpi = Math.round((crop.fit === 'contain' ? Math.max(...densities) : Math.min(...densities)) / crop.zoom);
    return { dpi, label: dpi >= 300 ? 'Qualidade excelente' : dpi >= 180 ? 'Qualidade boa' : 'Resolução baixa para este tamanho', level: dpi >= 300 ? 'excellent' : dpi >= 180 ? 'good' : 'low' };
}
export function tierPrice(base: number | null, tiers: {
    quantity: number;
    price: number;
}[], quantity: number) {
    return [...tiers].filter(t => quantity >= t.quantity).sort((a, b) => b.quantity - a.quantity)[0]?.price ?? base;
}
export function totals(subtotal: number, couponDiscount: number, shipping: number, pixPercent: number) {
    const coupon = Math.min(subtotal, Math.max(0, Math.round(couponDiscount)));
    const pix = Math.round((subtotal - coupon) * Math.max(0, Math.min(100, pixPercent)) / 100);
    return { subtotal, discount: coupon + pix, shipping, total: subtotal - coupon - pix + shipping };
}
export function validCep(value: string) { return /^\d{8}$/.test(value.replace(/\D/g, '')); }
export function validTaxId(value: string) {
    const s = value.replace(/\D/g, '');
    if (![11, 14].includes(s.length) || /^(\d)\1+$/.test(s))
        return false;
    const digit = (v: string, weights: number[]) => { const n = v.split('').reduce((a, b, i) => a + Number(b) * weights[i], 0) % 11; return n < 2 ? 0 : 11 - n; };
    if (s.length === 11)
        return digit(s.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]) === +s[9] && digit(s.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]) === +s[10];
    return digit(s.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === +s[12] && digit(s.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === +s[13];
}
export function parsePages(value: string, count: number) {
    if (!Number.isInteger(count) || count < 1 || count > 2000)
        throw Error('Informe o total de páginas do documento.');
    if (!value.trim() || value.trim() === 'todas')
        return Array.from({ length: count }, (_, i) => i + 1);
    const result = new Set<number>();
    for (const part of value.split(',')) {
        if (!/^\s*\d+(\s*-\s*\d+)?\s*$/.test(part))
            throw Error('Use páginas como 1-3, 5, 8.');
        const [a, b = a] = part.split('-').map(Number);
        if (a < 1 || b < a || b > count)
            throw Error('As páginas devem estar dentro do documento.');
        for (let i = a; i <= b; i++)
            result.add(i);
    }
    return [...result].sort((a, b) => a - b);
}
export const transitions: Record<OrderStatus, OrderStatus[]> = { received: ['payment_pending', 'cancelled'], payment_pending: ['paid', 'cancelled'], paid: ['files_received', 'production', 'cancelled'], files_received: ['production', 'cancelled'], production: ['ready', 'shipped', 'cancelled'], ready: ['delivered', 'cancelled'], shipped: ['delivered'], delivered: [], cancelled: [] };
export function safeFilename(name: string) { return name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '').slice(0, 100) || 'arquivo'; }
export function detectMime(bytes: Uint8Array): string | null {
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
        return 'image/jpeg';
    if ([137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b))
        return 'image/png';
    const s = new TextDecoder().decode(bytes.slice(0, 32));
    if (s.startsWith('%PDF-'))
        return 'application/pdf';
    if (s.slice(4, 8) === 'ftyp' && /heic|heix|hevc|hevx|mif1/.test(s.slice(8)))
        return 'image/heic';
    if (s.startsWith('RIFF') && s.slice(8, 12) === 'WEBP')
        return 'image/webp';
    return null;
}
