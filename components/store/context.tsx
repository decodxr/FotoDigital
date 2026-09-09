'use client';
import type { CartData, CartItem, Catalog, Customer } from '@/lib/shared/types';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { toast } from 'sonner';
export async function api<T>(url: string, method = 'GET', data?: unknown): Promise<T> { let response: Response; try {
    response = await fetch('/api/' + url, { method, headers: data ? { 'Content-Type': 'application/json' } : undefined, body: data ? JSON.stringify(data) : undefined, credentials: 'same-origin' });
}
catch {
    throw Error('Você parece estar sem conexão. Tente novamente quando a internet voltar.');
} const result = await response.json(); if (!response.ok)
    throw Error(result.error ?? 'Não foi possível concluir.'); return result as T; }
type Store = {
    catalog: Catalog;
    user: Customer | null;
    cart: CartData;
    favorites: string[];
    ready: boolean;
    payments: {
        pix: boolean;
        card: boolean;
        debit: boolean;
    };
    refresh: () => Promise<void>;
    refreshCatalog: () => Promise<void>;
    favorite: (id: string) => Promise<void>;
    addItem: (item: Partial<CartItem>) => Promise<void>;
};
const StoreContext = createContext<Store | null>(null);
const emptyCart: CartData = { items: [], subtotal: 0, ready: false, count: 0 };
export function StoreProvider({ initial, children }: {
    initial: Catalog;
    children: ReactNode;
}) {
    const [catalog, setCatalog] = useState(initial);
    const [user, setUser] = useState<Customer | null>(null);
    const [cart, setCart] = useState(emptyCart);
    const [favorites, setFavorites] = useState<string[]>([]);
    const [ready, setReady] = useState(false);
    const [payments, setPayments] = useState({ pix: false, card: false, debit: false });
    const refresh = useCallback(async () => { try {
        const session = await api<{
            user: Customer | null;
            payments: Store['payments'];
        }>('session');
        setUser(session.user);
        setPayments(session.payments);
        const c = await api<CartData>('cart');
        setCart(c);
        let local: string[] = [];
        try {
            local = JSON.parse(localStorage.getItem('fd-favorites') ?? '[]');
        }
        catch { }
        if (session.user) {
            if (local.length) {
                await api('favorites', 'POST', { productIds: local });
                localStorage.removeItem('fd-favorites');
            }
            setFavorites(await api<string[]>('favorites'));
        }
        else
            setFavorites(local);
    }
    catch (e) {
        console.error('store_load', e instanceof Error ? e.message : 'unavailable');
    }
    finally {
        setReady(true);
    } }, []);
    useEffect(() => { const start = window.setTimeout(() => void refresh(), 0); const offline = () => toast.error('Sem conexão. Suas escolhas continuam nesta tela.'); window.addEventListener('offline', offline); return () => { window.clearTimeout(start); window.removeEventListener('offline', offline); }; }, [refresh]);
    const favorite = async (id: string) => { const next = favorites.includes(id) ? favorites.filter(f => f !== id) : [...favorites, id]; try {
        if (user) {
            if (favorites.includes(id))
                await api('favorites/' + id, 'DELETE');
            else
                await api('favorites', 'POST', { productIds: [id] });
        }
        else
            localStorage.setItem('fd-favorites', JSON.stringify(next));
        setFavorites(next);
        toast.success(next.includes(id) ? 'Guardado nos seus favoritos.' : 'Produto removido dos favoritos.');
    }
    catch (e) {
        toast.error((e as Error).message);
    } };
    const addItem = async (item: Partial<CartItem>) => { const result = await api<CartData>('cart', 'POST', item); setCart(result); toast.success('Adicionado ao seu carrinho.'); };
    const refreshCatalog = async () => setCatalog(await api<Catalog>('catalog'));
    return <StoreContext.Provider value={{ catalog, user, cart, favorites, ready, payments, refresh, refreshCatalog, favorite, addItem }}>{children}</StoreContext.Provider>;
}
export function useStore() { const context = useContext(StoreContext); if (!context)
    throw Error('StoreProvider ausente'); return context; }
