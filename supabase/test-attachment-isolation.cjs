// Node 24, @electric-sql/pglite 0.6.1. Run with the two exported JSON snapshots
// and the path to tg-anexos.js from the application under test.
// The adapter models Storage with local metadata and in-memory file contents.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { db, prepareDatabase, seed, uuid } = require('./test-tenant-isolation.cjs');

const [, , , metadataPath, applicationPath] = process.argv;
assert.ok(metadataPath && applicationPath, 'Indique os dois snapshots e o caminho para tg-anexos.js.');
const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
const { criar } = require(resolve(applicationPath));
const base = 'https://testetg.example.invalid';
const bucket = 'anexos-privados';
const url = name => `${base}/storage/v1/object/public/${bucket}/${name}`;
const bytes = new Map();
const scenarios = [];

async function prepareAttachments() {
    await db.exec(`
        create schema storage;
        grant usage on schema storage to anon, authenticated;
        create table storage.objects (
            bucket_id text not null, name text not null, owner_id text,
            created_at timestamptz not null default now(), primary key (bucket_id, name)
        );
        alter table storage.objects enable row level security;
        grant select, insert, update, delete on storage.objects to anon, authenticated;
        alter table funcionarios add column foto text;
        create table ponto (id text, admin_id text, foto text);
        create table pedidos (id text, admin_id text, anexo text, anexo_admin text);
        create table requisicoes (id text, admin_id text, anexo text);
        create table veiculo_documentos (id text, admin_id text, ficheiro text);
        create table relatorios_especialidade (
            id text, admin_id text, assinatura_cliente text, assinatura_tecnico text,
            assinatura_cliente_path text, assinatura_tecnico_path text
        );
        create table encomendas (id text, admin_id text, fatura text);
        create table contratos (id text, admin_id text, documento_url text);
        create table obra_documentos (obra_id text, admin_id text, url text);
        create table locais (cliente_id text, admin_id text, passaporte_tecnico jsonb);
        grant select on ponto, pedidos, requisicoes, veiculo_documentos, relatorios_especialidade,
            encomendas, contratos, obra_documentos, locais to authenticated;
    `);
    await db.exec(`create view tg_internal.ficheiros_registos with (security_invoker = true) as ${metadata.viewSql}`);
    if (metadata.internalUsage) await db.exec('grant usage on schema tg_internal to authenticated');
    if (metadata.viewSelect) await db.exec('grant select on tg_internal.ficheiros_registos to authenticated');
    for (const definition of metadata.functions) {
        await db.exec(definition.replace(/https:\/\/[a-z]+\.supabase\.co(?=\/storage\/)/g, base));
    }
    await db.exec(`
        revoke execute on function tg_internal.ficheiro_referenciado(text,text,text) from public;
        revoke execute on function tg_internal.ficheiro_novo_por_associar(text) from public;
    `);
    if (metadata.referenceExecute) await db.exec('grant execute on function tg_internal.ficheiro_referenciado(text,text,text) to authenticated');
    if (metadata.previewExecute) await db.exec('grant execute on function tg_internal.ficheiro_novo_por_associar(text) to authenticated');
    for (const policy of metadata.policies) {
        const using = policy.using ? `using (${policy.using})` : '';
        const check = policy.check ? `with check (${policy.check})` : '';
        await db.exec(`create policy "${policy.name}" on storage.objects as ${policy.mode}
            for ${policy.operation} to authenticated ${using} ${check}`);
    }
}

async function asActor(actor, query, parameters = []) {
    await db.exec('begin');
    try {
        await db.query("select set_config('request.jwt.claim.sub', $1, true)", [actor ? uuid(actor) : '']);
        await db.exec(actor ? 'set local role authenticated' : 'set local role anon');
        const result = await db.query(query, parameters);
        await db.exec('commit');
        return result;
    } catch (error) {
        await db.exec('rollback');
        throw error;
    }
}

function storage(actor) {
    async function visible(name) {
        const { rows } = await asActor(actor, 'select name from storage.objects where bucket_id=$1 and name=$2', [bucket, name]);
        return rows.length === 1;
    }
    return {
        async upload(name, content) {
            await asActor(actor, 'insert into storage.objects (bucket_id, name, owner_id) values ($1, $2, $3)', [bucket, name, actor ? uuid(actor) : null]);
            bytes.set(name, new Blob([content], { type: 'image/jpeg' }));
        },
        from(requestedBucket) {
            assert.equal(requestedBucket, bucket);
            return {
                async createSignedUrl(name, lifetime) {
                    assert.equal(lifetime, 60);
                    return await visible(name)
                        ? { data: { signedUrl: `${base}/local-signed/${name}` } }
                        : { error: new Error('Anexo indisponível') };
                },
                async download(name) {
                    return await visible(name) && bytes.has(name)
                        ? { data: bytes.get(name) } : { error: new Error('Anexo indisponível') };
                }
            };
        }
    };
}

async function check(label, action) {
    try {
        await action();
        scenarios.push({ label, passed: true });
    } catch (error) {
        scenarios.push({ label, passed: false });
        console.error(label, error.message);
    }
}

async function main() {
    await prepareDatabase();
    await seed();
    await prepareAttachments();
    const a = 'a/os_fotos/sa/foto.jpg';
    const b = 'b/os_fotos/sb/foto.jpg';
    const a2 = 'a/os_fotos/sa2/foto.jpg';
    const client = actor => criar({ storage: storage(actor) }, base);
    const cannotOpen = (actor, name) => assert.rejects(client(actor).assinar(url(name)), /Não foi possível abrir/);

    await check('Bucket privado em Produção', () => assert.equal(metadata.bucketPublic, false));
    for (const [actor, name] of [[1, a], [2, b], [1, a2]]) {
        await check(`Carregamento da própria empresa ${name}`, () => storage(actor).upload(name, name));
        await check(`Pré-visualização pelo autor ${name}`, async () => assert.equal(await client(actor).assinar(url(name)), `${base}/local-signed/${name}`));
    }
    await check('Pré-visualização só pelo autor antes de associar', () => cannotOpen(3, a));
    await check('Pré-visualização interempresas bloqueada', () => cannotOpen(2, a));
    await check('Portal bloqueado antes de associar', () => cannotOpen(6, a));
    await check('Carregamento do Portal bloqueado', () => assert.rejects(storage(6).upload('a/os_fotos/sa/extra.jpg', 'fixture'), { code: '42501' }));
    await check('Carregamento entre empresas bloqueado', () => assert.rejects(storage(2).upload('a/os_fotos/sa/extra.jpg', 'fixture'), { code: '42501' }));
    await check('Carregamento sem sessão bloqueado', () => assert.rejects(storage(0).upload('a/os_fotos/sa/extra.jpg', 'fixture'), { code: '42501' }));
    for (const [actor, id, name] of [[1, 'sa', a], [2, 'sb', b], [1, 'sa2', a2]]) {
        await check(`Associação à ordem de serviço ${id}`, async () => {
            const result = await asActor(actor, 'update servicos set fotos=$1::jsonb where id=$2', [JSON.stringify([url(name)]), id]);
            assert.equal(result.affectedRows, 1);
        });
    }
    for (const [actor, name] of [[1, a], [2, b], [3, a], [6, a], [7, b], [9, a]]) {
        await check(`Abertura autorizada para perfil ${actor}`, async () => assert.equal(await client(actor).assinar(url(name)), `${base}/local-signed/${name}`));
        await check(`Conteúdo descarregado pelo perfil ${actor}`, async () => assert.equal(await (await client(actor).descarregar(url(name))).text(), name));
    }
    for (const [actor, name] of [[0, a], [1, b], [2, a], [6, a2], [6, b], [7, a], [8, a]]) {
        await check(`Abertura bloqueada para perfil ${actor} em ${name}`, () => cannotOpen(actor, name));
        await check(`Download bloqueado para perfil ${actor} em ${name}`, () => assert.rejects(client(actor).descarregar(url(name)), /Não foi possível descarregar/));
    }
    await check('Remover a associação revoga o acesso do Portal', async () => {
        await asActor(1, "update servicos set fotos='[]' where id='sa'");
        await cannotOpen(6, a);
    });
    console.log(JSON.stringify({ total: scenarios.length, passed: scenarios.filter(s => s.passed).length }));
    if (scenarios.some(s => !s.passed)) process.exitCode = 1;
}

main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
}).finally(() => db.close());
