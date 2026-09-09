import { handleApi } from '@/lib/server/api';
export const dynamic = 'force-dynamic';
type Context = {
    params: Promise<{
        path: string[];
    }>;
};
async function route(req: Request, ctx: Context) { return handleApi(req, (await ctx.params).path); }
export { route as DELETE, route as GET, route as PATCH, route as POST, route as PUT };
