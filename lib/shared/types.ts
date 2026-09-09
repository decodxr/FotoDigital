export type Category = {
    id: string;
    name: string;
    slug: string;
    description: string;
    image: string;
    active: number;
};
export type Field = {
    key: string;
    label: string;
    type: 'text' | 'date' | 'textarea' | 'photo' | 'select';
    required: boolean;
    options?: string[];
};
export type Product = {
    id: string;
    name: string;
    slug: string;
    description: string;
    categoryId: string;
    category: string;
    kind: 'product' | 'photo' | 'document' | 'quote';
    image: string;
    images: string[];
    price: number | null;
    salePrice: number | null;
    stock: number | null;
    active: number;
    featured: number;
    tags: string[];
    fields: Field[];
    variants: {
        id: string;
        name: string;
        price: number | null;
        stock: number | null;
    }[];
    productionDays: number;
    weight: number | null;
    width: number | null;
    height: number | null;
    length: number | null;
    createdAt: string;
};
export type PrintSize = {
    id: string;
    name: string;
    width: number;
    height: number;
    price: number | null;
    active: number;
    finishes: string[];
    tiers: {
        quantity: number;
        price: number;
    }[];
};
export type Crop = {
    x: number;
    y: number;
    zoom: number;
    rotation: number;
    fit: 'cover' | 'contain';
};
export type Photo = {
    id: string;
    name: string;
    mime: string;
    bytes: number;
    width: number;
    height: number;
    thumbnail: string | null;
    pageCount: number;
    status: string;
    createdAt: string;
};
export type PhotoConfig = {
    photoId: string;
    sizeId: string;
    quantity: number;
    finish: string;
    crop: Crop;
    caption?: string;
    qualityAccepted?: boolean;
};
export type CartItem = {
    id: string;
    productId: string;
    product: Product;
    quantity: number;
    variantId?: string;
    fields: Record<string, string>;
    photos: PhotoConfig[];
    thumbnails: string[];
    unitPrice: number | null;
    subtotal: number | null;
};
export type CartData = {
    items: CartItem[];
    subtotal: number;
    ready: boolean;
    count: number;
};
export type Customer = {
    id: string;
    name: string;
    email: string;
    phone: string;
    taxId: string;
    role: string;
};
export type Quote = {
    id: string;
    carrier: string;
    service: string;
    cents: number;
    days: number;
    expiresAt: string;
};
export type StoreSettings = {
    pixDiscount: number;
    pixEnabled: boolean;
    retentionDays: number;
    maxUploadMb: number;
    maxPhotos: number;
    documentBw: number | null;
    documentColor: number | null;
    documentDuplex: boolean;
    photoSheetCount: number;
    polaroidCaption: boolean;
    installments: number;
    installmentText: string;
    storeOpen: boolean;
    shippingNotice: string;
};
export type OrderStatus = 'received' | 'payment_pending' | 'paid' | 'files_received' | 'production' | 'ready' | 'shipped' | 'delivered' | 'cancelled';
export const statusLabels: Record<OrderStatus, string> = { received: 'Pedido recebido', payment_pending: 'Pagamento pendente', paid: 'Pagamento aprovado', files_received: 'Arquivos recebidos', production: 'Em produção', ready: 'Pronto para retirada', shipped: 'Enviado', delivered: 'Entregue', cancelled: 'Cancelado' };
export type Order = {
    id: string;
    number: number;
    userId: string;
    status: OrderStatus;
    subtotal: number;
    discount: number;
    shipping: number;
    total: number;
    delivery: string;
    address: Record<string, string>;
    customer: Record<string, string>;
    paymentMethod: string;
    paymentStatus: string;
    paymentUrl: string | null;
    pixCode: string | null;
    tracking: string | null;
    createdAt: string;
    items: CartItem[];
    events: {
        status: OrderStatus;
        note: string;
        createdAt: string;
    }[];
    internalNote?: string;
};
export type Service = {
    id: string;
    name: string;
    slug: string;
    description: string;
    image: string;
    gallery: string[];
    faq: {
        question: string;
        answer: string;
    }[];
    active: number;
};
export type Catalog = {
    products: Product[];
    categories: Category[];
    sizes: PrintSize[];
    services: Service[];
    testimonials: {
        id: string;
        name: string;
        rating: number;
        comment: string;
    }[];
    banners: {
        id: string;
        title: string;
        subtitle: string;
        image: string;
        link: string;
    }[];
    settings: StoreSettings;
    unavailable?: boolean;
};
