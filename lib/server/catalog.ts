import type { Catalog, Category, Field, PrintSize, Product, Service, StoreSettings } from '@/lib/shared/types';
import { insert, json, one, query, transaction } from './db';
export const photos = { hero: 'https://images.pexels.com/photos/7015070/pexels-photo-7015070.jpeg?auto=compress&cs=tinysrgb&w=1400', prints: 'https://images.pexels.com/photos/9219062/pexels-photo-9219062.jpeg?auto=compress&cs=tinysrgb&w=800', polaroid: 'https://images.pexels.com/photos/8266758/pexels-photo-8266758.jpeg?auto=compress&cs=tinysrgb&w=800', mug: 'https://images.pexels.com/photos/11075707/pexels-photo-11075707.jpeg?auto=compress&cs=tinysrgb&w=800', album: 'https://images.pexels.com/photos/8057030/pexels-photo-8057030.jpeg?auto=compress&cs=tinysrgb&w=800', woman: 'https://images.pexels.com/photos/3791554/pexels-photo-3791554.jpeg?auto=compress&cs=tinysrgb&w=1000', child: 'https://images.pexels.com/photos/17049390/pexels-photo-17049390.jpeg?auto=compress&cs=tinysrgb&w=900', corporate: 'https://images.pexels.com/photos/30468636/pexels-photo-30468636.jpeg?auto=compress&cs=tinysrgb&w=900' };
export const defaultSettings: StoreSettings = { pixDiscount: 5, pixEnabled: true, retentionDays: 90, maxUploadMb: 25, maxPhotos: 200, documentBw: null, documentColor: null, documentDuplex: false, photoSheetCount: 8, polaroidCaption: true, installments: 1, installmentText: 'Parcelamento disponível com juros conforme condições da operadora.', storeOpen: true, shippingNotice: 'Consulte a disponibilidade de envio para o seu CEP.' };
const photoField: Field = { key: 'photo', label: 'Envie sua foto', type: 'photo', required: true };
export const seedCategories: Category[] = [['revelacao', 'Revelação de fotos', 'Suas lembranças, sempre por perto.', photos.prints], ['personalizados', 'Presentes personalizados', 'Um presente que só você poderia dar.', photos.mug], ['impressoes', 'Impressões', 'Cuidado em cada página.', ''], ['fotografia', 'Fotografia', 'Seu melhor momento, sob um novo olhar.', photos.woman], ['albuns', 'Álbuns e decoração', 'Um lugar especial para a sua história.', photos.album]].map(([slug, name, description, image]) => ({ id: slug, slug, name, description, image, active: 1 }));
const productSeed: [
    string,
    string,
    string,
    Product['kind'],
    string,
    string,
    Field[]?
][] = [
    ['fotos-tradicionais', 'Fotos tradicionais', 'revelacao', 'photo', photos.prints, 'A beleza de ter suas lembranças nas mãos. Impressão fotográfica com qualidade Fujifilm, em diferentes tamanhos e acabamentos.'],
    ['polaroid', 'Fotos estilo Polaroid', 'revelacao', 'photo', photos.polaroid, 'Pequenas fotografias, grandes histórias. Suas fotos com a clássica borda branca e espaço para uma mensagem.'],
    ['foto-3x4', 'Cartela de fotos 3x4', 'revelacao', 'photo', '', 'Sua fotografia em cartela 3x4. Envie um retrato nítido e confira o enquadramento. A adequação às exigências do documento deve ser confirmada com a loja.'],
    ['foto-montagem', 'Foto montagem', 'revelacao', 'quote', photos.prints, 'Reúna pessoas e lembranças em uma composição especial. Solicite uma avaliação da sua ideia.'],
    ['restauracao', 'Restauração de fotos antigas', 'revelacao', 'quote', photos.album, 'Recupere detalhes de fotografias com manchas, rasgos e desbotamento. Cada imagem é avaliada individualmente.'],
    ['caneca-personalizada', 'Caneca personalizada', 'personalizados', 'product', photos.mug, 'Um café, uma pausa e uma lembrança de quem você ama. Personalize sua caneca com foto, nome ou uma frase especial.', [{ key: 'name', label: 'Nome', type: 'text', required: false }, { key: 'phrase', label: 'Frase especial', type: 'textarea', required: false }, photoField]],
    ['camiseta-personalizada', 'Camiseta personalizada', 'personalizados', 'product', '', 'Vista a sua ideia. Conte o que deseja estampar e envie a sua arte.', [{ key: 'size', label: 'Tamanho', type: 'select', required: true, options: ['P', 'M', 'G', 'GG'] }, photoField]],
    ['almofada-personalizada', 'Almofada personalizada', 'personalizados', 'product', '', 'Transforme um cantinho da casa com uma lembrança feita para você.', [photoField]],
    ['chaveiro-com-foto', 'Chaveiro com foto', 'personalizados', 'product', '', 'Carregue um pedacinho da sua história com você.', [photoField]],
    ['bottons', 'Bottons personalizados', 'personalizados', 'product', '', 'Pequenos detalhes para grandes ideias, eventos e presentes.', [{ key: 'phrase', label: 'Texto ou tema', type: 'textarea', required: true }]],
    ['imas', 'Ímãs com foto', 'personalizados', 'product', photos.polaroid, 'Aquelas fotos que merecem ser vistas todos os dias.', [photoField]],
    ['polaroid-com-ima', 'Polaroid com ímã', 'revelacao', 'photo', photos.polaroid, 'Suas fotos favoritas em formato Polaroid com verso magnético.'],
    ['broches', 'Broches personalizados', 'personalizados', 'product', '', 'Uma lembrança delicada para presentear.', [{ key: 'phrase', label: 'Texto ou tema', type: 'text', required: true }]],
    ['adesivos', 'Adesivos personalizados', 'personalizados', 'product', '', 'Dê a sua identidade a embalagens, lembranças e projetos.', [{ key: 'description', label: 'Tamanho e ideia', type: 'textarea', required: true }]],
    ['porta-retratos', 'Porta-retratos', 'albuns', 'product', photos.prints, 'Escolha uma lembrança para fazer parte da sua decoração.'],
    ['album-fotografico', 'Álbum fotográfico', 'albuns', 'product', photos.album, 'Histórias que merecem ser revisitadas. Um álbum para guardar o que importa.'],
    ['album-polaroid', 'Álbum para Polaroid', 'albuns', 'product', photos.album, 'O lugar das suas pequenas grandes lembranças.'],
    ['scrapbook', 'Álbum scrapbook', 'albuns', 'product', photos.album, 'Construa a sua história com fotografias, bilhetes e criatividade.'],
    ['livro-de-colorir', 'Livro de colorir', 'personalizados', 'product', '', 'Um presente criativo para dar cor à imaginação.', [{ key: 'name', label: 'Nome', type: 'text', required: true }, { key: 'theme', label: 'Tema', type: 'text', required: true }]],
    ['varal-polaroid', 'Varal de fotos Polaroid', 'albuns', 'product', photos.polaroid, 'Uma forma leve e afetiva de decorar com suas melhores lembranças.', [photoField]],
    ['topo-de-bolo', 'Topo de bolo personalizado', 'personalizados', 'product', '', 'O toque final de uma celebração especial.', [{ key: 'name', label: 'Nome', type: 'text', required: true }, { key: 'age', label: 'Idade', type: 'text', required: false }, { key: 'theme', label: 'Tema', type: 'text', required: true }]],
    ['convites', 'Convites personalizados', 'personalizados', 'product', '', 'Toda celebração começa com um convite especial.', [{ key: 'names', label: 'Nomes', type: 'text', required: true }, { key: 'date', label: 'Data do evento', type: 'date', required: true }, { key: 'details', label: 'Local e informações', type: 'textarea', required: true }]],
    ['lembrancinhas', 'Lembrancinhas personalizadas', 'personalizados', 'product', '', 'Um carinho para continuar lembrando de um dia especial.', [{ key: 'theme', label: 'Tema e ocasião', type: 'textarea', required: true }]],
    ['documentos', 'Impressão de documentos', 'impressoes', 'document', '', 'Seus documentos impressos com praticidade. Envie PDF ou imagem e escolha preto e branco ou colorido.'],
    ['impressao-fotografica', 'Impressão fotográfica', 'impressoes', 'photo', photos.prints, 'Cor, definição e cuidado em cada detalhe da sua imagem.']
];
export const seedProducts: Product[] = productSeed.map(([slug, name, categoryId, kind, image, description, fields = []], i) => ({ id: slug, name, slug, description, categoryId, category: seedCategories.find(c => c.id === categoryId)!.name, kind, image, images: image ? [image] : [], price: null, salePrice: null, stock: null, active: 1, featured: [0, 1, 5, 15].includes(i) ? 1 : 0, tags: [name, categoryId], fields, variants: [], productionDays: 0, weight: null, width: null, height: null, length: null, createdAt: '2026-09-08T00:00:00.000Z' }));
export const seedSizes: PrintSize[] = [[10, 15], [13, 18], [15, 21], [20, 25], [20, 30]].map(([width, height]) => ({ id: `${width}x${height}`, name: `${width} × ${height} cm`, width, height, price: null, active: 1, finishes: ['Brilhante', 'Fosco'], tiers: [] }));
seedSizes.push({ id: 'polaroid-ima', name: 'Polaroid com ímã 9 × 11 cm', width: 9, height: 11, price: null, active: 1, finishes: ['Brilhante', 'Fosco'], tiers: [] });
export const seedServices: Service[] = [['corporativo', 'Ensaio corporativo', photos.corporate, 'Mostre quem está por trás do seu trabalho. Retratos para LinkedIn, currículo, redes sociais e equipes.'], ['feminino', 'Ensaio feminino', photos.woman, 'Um tempo para você. Um ensaio acolhedor, com direção e cuidado para registrar a sua essência.'], ['infantil', 'Ensaio infantil', photos.child, 'A infância acontece depressa. Guarde as descobertas, os sorrisos e o jeitinho de cada fase.'], ['eventos', 'Eventos fotográficos', photos.prints, 'A emoção de um encontro, registrada com atenção aos detalhes e às pessoas.'], ['estudio', 'Ensaios em estúdio', photos.woman, 'Luz, direção e um ambiente preparado para contar a sua história.']].map(([slug, name, image, description]) => ({ id: slug, slug, name, image, description, gallery: [image], active: 1, faq: [{ question: 'Como agendar?', answer: 'Fale com a nossa equipe pelo WhatsApp para consultar datas e receber uma proposta.' }, { question: 'Preciso saber posar?', answer: 'Você recebe orientação durante o ensaio. Vamos construir as fotos juntos, respeitando o seu ritmo.' }] }));
let seeded = false;
export async function ensureSeed() {
    if (seeded)
        return;
    const exists = await one<{
        id: string;
    }>('SELECT id FROM settings WHERE id=?', ['store']);
    if (exists) {
        seeded = true;
        return;
    }
    const stmts = seedCategories.map(c => insert('categories', c, true));
    for (const { category, ...p } of seedProducts) {
        void category;
        stmts.push(insert('products', { ...p, images: JSON.stringify(p.images), tags: JSON.stringify(p.tags), fields: JSON.stringify(p.fields), variants: JSON.stringify(p.variants) }, true));
    }
    for (const s of seedSizes)
        stmts.push(insert('printSizes', { ...s, finishes: JSON.stringify(s.finishes), tiers: JSON.stringify(s.tiers) }, true));
    for (const s of seedServices)
        stmts.push(insert('services', { ...s, gallery: JSON.stringify(s.gallery), faq: JSON.stringify(s.faq) }, true));
    stmts.push(insert('coupons', { id: 'first-purchase', code: 'PRIMEIRACOMPRA', type: 'percent', value: 0, active: 0, firstPurchase: 1, perCustomer: 1 }, true), insert('settings', { id: 'store', data: JSON.stringify(defaultSettings) }, true));
    await transaction(stmts);
    seeded = true;
}
export async function getSettings() { await ensureSeed(); const row = await one<{
    data: string;
}>('SELECT data FROM settings WHERE id=?', ['store']); return { ...defaultSettings, ...json<Partial<StoreSettings>>(row?.data, {}) }; }
export function productRow(r: Record<string, unknown>): Product { return { ...r, images: json(r.images, []), tags: json(r.tags, []), fields: json(r.fields, []), variants: json(r.variants, []) } as unknown as Product; }
export async function catalog(): Promise<Catalog> { await ensureSeed(); const [products, categories, sizes, services, testimonials, settings, inventory, banners] = await Promise.all([query<Record<string, unknown>>('SELECT p.*,c.name AS category,(SELECT COUNT(*) FROM "orderItems" i JOIN orders o ON o.id=i."orderId" WHERE i."productId"=p.id AND o."paymentStatus"=\'approved\') AS "soldCount" FROM products p JOIN categories c ON c.id=p."categoryId" WHERE p.active=1 AND c.active=1 ORDER BY p.featured DESC,p."createdAt" DESC'), query<Category>('SELECT * FROM categories WHERE active=1'), query<Record<string, unknown>>('SELECT * FROM "printSizes" WHERE active=1 ORDER BY width,height'), query<Record<string, unknown>>('SELECT * FROM services WHERE active=1'), query<Catalog['testimonials'][number]>('SELECT id,name,rating,comment FROM testimonials WHERE active=1'), getSettings(), query<{
        id: string;
        available: number;
    }>('SELECT id,available FROM inventory'), query<Catalog['banners'][number]>('SELECT id,title,subtitle,image,link FROM banners WHERE active=1 ORDER BY id LIMIT 4')]); return { products: products.map(r => { const p = productRow(r); return { ...p, variants: p.variants.map(v => ({ ...v, stock: v.stock === null ? null : inventory.find(i => i.id === p.id + ':' + v.id)?.available ?? 0 })) }; }), categories, sizes: sizes.map(s => ({ ...s, finishes: json(s.finishes, []), tiers: json(s.tiers, []) } as unknown as PrintSize)), services: services.map(s => ({ ...s, gallery: json(s.gallery, []), faq: json(s.faq, []) } as unknown as Service)), testimonials, settings, banners }; }
export async function safeCatalog(): Promise<Catalog> { try {
    return await catalog();
}
catch (error) {
    console.error('catalog_unavailable', error instanceof Error ? error.message : 'unknown');
    return { products: seedProducts, categories: seedCategories, sizes: seedSizes, services: seedServices, testimonials: [], banners: [], settings: defaultSettings, unavailable: true };
} }
