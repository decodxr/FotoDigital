-- The application authorizes every request on the server. These tables must
-- never be exposed through the Supabase Data API, even with a publishable key.
-- Keep the PostgreSQL owner/BYPASSRLS connection exclusively on the server.
DO $private_access$
DECLARE
    table_name text;
    api_role text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'users','sessions','addresses','categories','products','printSizes',
        'favorites','carts','cartItems','uploads','coupons','orders','orderItems',
        'photoConfigurations','orderEvents','payments','shipments','testimonials',
        'services','inquiries','settings','banners','auditLogs','rateLimits',
        'couponUses','firstPurchaseClaims','inventory','couponInventory','storeMedia',
        '_migrations'
    ] LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', table_name);
        FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
                EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', table_name, api_role);
            END IF;
        END LOOP;
    END LOOP;
END
$private_access$;
