import type { Catalog } from '@/lib/shared/types';
import { photos } from '@/lib/shared/images';
import { insert, one, transaction } from './db';

export const initialShowcase: Catalog['banners'] = [
    { id: 'showcase-prints', title: 'Lembranças que saem da tela.', subtitle: 'Revele suas fotos nos tamanhos e acabamentos que combinam com a sua história.', image: photos.prints, link: '/revelacao', sortOrder: 1, illustrative: 1 },
    { id: 'showcase-polaroid', title: 'Pequenas fotos. Grandes histórias.', subtitle: 'O charme da moldura branca para presentear, decorar e guardar seus melhores dias.', image: photos.polaroid, link: '/polaroid', sortOrder: 2, illustrative: 1 },
    { id: 'showcase-gifts', title: 'Um presente com a sua assinatura.', subtitle: 'Fotos, nomes e frases que transformam objetos em presentes cheios de significado.', image: photos.mug, link: '/personalizados', sortOrder: 3, illustrative: 1 },
    { id: 'showcase-albums', title: 'Sua história, página por página.', subtitle: 'Álbuns e porta-retratos para manter os momentos importantes sempre por perto.', image: photos.album, link: '/categoria/albuns', sortOrder: 4, illustrative: 1 },
    { id: 'showcase-studio', title: 'Um novo olhar sobre você.', subtitle: 'Ensaios com direção e cuidado, do primeiro contato à escolha das fotografias.', image: photos.woman, link: '/fotografia', sortOrder: 5, illustrative: 1 },
];

let initialized = false;
export async function ensureShowcaseSeed() {
    if (initialized) return;
    if (await one('SELECT id FROM settings WHERE id=?', ['showcase-initialized'])) {
        initialized = true;
        return;
    }
    // Preserve existing merchant banners; never restore archived content on reload.
    const existing = await one('SELECT id FROM banners LIMIT 1');
    await transaction([
        ...(existing ? [] : initialShowcase.map(slide => insert('banners', { ...slide, active: 1 }, true))),
        insert('settings', { id: 'showcase-initialized', data: '{}' }, true),
    ]);
    initialized = true;
}
