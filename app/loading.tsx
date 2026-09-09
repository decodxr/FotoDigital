import { Skeleton } from '@/components/ui/skeleton';
export default function Loading() { return <div className="container page-space" role="status" aria-label="Carregando"><Skeleton className="h-12 w-1/2"/><div className="loading-grid">{[1, 2, 3, 4].map(n => <Skeleton key={n} className="h-72"/>)}</div></div>; }
