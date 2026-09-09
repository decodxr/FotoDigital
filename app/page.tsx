import { StoreApp } from '@/components/store/app';
import { safeCatalog } from '@/lib/server/catalog';
export const dynamic = 'force-dynamic';
export default async function Home() { return <StoreApp initial={await safeCatalog()}/>; }
