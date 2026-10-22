import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0';
import webpush from 'https://esm.sh/web-push@3.6.7';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (req.method !== 'POST') return reply({ erro: 'Método não permitido.' }, 405);
    try {
        const body = await req.json();
        // This is the public VAPID key; private key and subscription secrets never leave the server.
        if (body.acao === 'config') return reply({ chave_publica: publicKey, atraso_segundos: 10 });
        if (body.acao !== 'teste') return reply({ erro: 'Ação inválida.' }, 400);
        const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
        if (!token) return reply({ erro: 'É necessário iniciar sessão.' }, 401);
        const { data: auth, error: authError } = await admin.auth.getUser(token);
        if (authError || !auth?.user) return reply({ erro: 'Sessão inválida. Volte a entrar na app.' }, 401);
        const { data: profile, error: profileError } = await admin.from('perfis').select('registo_id').eq('id', auth.user.id).single();
        if (profileError || !profile?.registo_id) return reply({ erro: 'Perfil não encontrado.' }, 403);
        if (typeof body.endpoint !== 'string' || body.endpoint.length > 4096) return reply({ erro: 'Dispositivo não indicado.' }, 400);
        // A test can only target this authenticated user's already registered device.
        // Ignore any supplied utilizador_id, admin_id, title or content.
        const { data: sub, error } = await admin.from('push_subscriptions')
            .select('id,endpoint,p256dh,auth').eq('utilizador_id', profile.registo_id).eq('endpoint', body.endpoint).maybeSingle();
        if (error) return reply({ erro: 'Não foi possível consultar o registo do dispositivo.' }, 500);
        if (!sub) return reply({ erro: 'Este dispositivo não está registado. Volte a ativar as notificações.' }, 409);
        const target = new URL(sub.endpoint);
        const host = target.hostname.toLowerCase();
        const provider = host === 'fcm.googleapis.com' || host.endsWith('.push.apple.com')
            || host.endsWith('.notify.windows.com') || host === 'updates.push.services.mozilla.com'
            || host.endsWith('.push.services.mozilla.com');
        if (target.protocol !== 'https:' || target.username || target.password || (target.port && target.port !== '443') || !provider)
            return reply({ erro: 'Serviço de notificações inválido.' }, 400);
        webpush.setVapidDetails('mailto:geral@totalgest.pt', publicKey, Deno.env.get('VAPID_PRIVATE_KEY')!);
        EdgeRuntime.waitUntil((async () => {
            await new Promise(resolve => setTimeout(resolve, 10000));
            try {
                await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                    JSON.stringify({ titulo: 'Total Gest — teste de notificações', corpo: 'O teste foi enviado pelo servidor, mesmo com a app fechada.', tag: 'totalgest-teste', url: './login.html' }));
                console.info(JSON.stringify({ evento: 'push_teste', resultado: 'aceite_pelo_servico' }));
            } catch (error: any) {
                const status = Number(error?.statusCode) || 0;
                console.warn(JSON.stringify({ evento: 'push_teste', resultado: 'falhou', status }));
                if (status === 404 || status === 410) await admin.from('push_subscriptions').delete().eq('id', sub.id).eq('utilizador_id', profile.registo_id);
            }
        })());
        return reply({ ok: true, agendado: true, atraso_segundos: 10 }, 202);
    } catch {
        return reply({ erro: 'Não foi possível preparar o teste.' }, 500);
    }
});
