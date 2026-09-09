'use client';
import Link from 'next/link';
export default function ErrorPage({ reset }: {
    reset: () => void;
}) { return <main className="container page-space empty-state"><h1>Não foi possível carregar agora.</h1><p>Suas informações continuam salvas. Tente novamente em instantes.</p><button className="btn" onClick={reset}>Tentar novamente</button><Link href="/" className="text-link">Voltar ao início</Link></main>; }
