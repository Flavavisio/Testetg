// Run with Node 24, pg and @electric-sql/pglite 0.6.1 installed.
// TG_TEST_PG_BIN points to the PostgreSQL bin directory; TG_TEST_STORAGE_SOURCE
// points to a checkout of supabase/storage v1.39.3 with npm ci completed.
// Arguments: tenant snapshot JSON, attachment snapshot JSON, path to tg-anexos.js.
// Starts a fresh loopback-only database and Storage API, with a new local JWT key.
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { execFileSync, spawn } = require('node:child_process');
const { createHmac, randomBytes } = require('node:crypto');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { Client } = require('pg');
const { db, prepareDatabase, seed, uuid } = require('./test-tenant-isolation.cjs');
const { attachmentReferences, prepareAttachments, url } = require('./test-attachment-isolation.cjs');
const { criar } = require(resolve(process.argv[4]));

const bin = process.env.TG_TEST_PG_BIN;
const storage = process.env.TG_TEST_STORAGE_SOURCE;
assert.ok(bin && storage, 'Defina TG_TEST_PG_BIN e TG_TEST_STORAGE_SOURCE.');
const origin = 'http://127.0.0.1:55139';
const databaseUrl = 'postgresql://postgres@127.0.0.1:55439/postgres';
const secret = randomBytes(32).toString('hex');
const children = [];
const checks = [];
const bucket = 'anexos-privados';
let temp;

function jwt(actor) {
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const payload = { role: actor ? 'authenticated' : 'anon', exp: Math.floor(Date.now() / 1000) + 600 };
    if (actor) payload.sub = uuid(actor);
    const message = encode({ alg: 'HS256', typ: 'JWT' }) + '.' + encode(payload);
    return message + '.' + createHmac('sha256', secret).update(message).digest('base64url');
}

async function retry(action, tries = 40) {
    for (let i = 0; i < tries; i++) {
        try { return await action(); }
        catch (error) {
            if (i + 1 === tries) throw error;
            await delay(200);
        }
    }
}

function launch(command, args, options) {
    const child = spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    for (const stream of [child.stdout, child.stderr]) stream.on('data', block => {
        log = (log + String(block)).slice(-16000);
    });
    children.push(child);
    return () => log;
}

function request(actor, path, options = {}) {
    return fetch(origin + path, {
        ...options,
        headers: { authorization: 'Bearer ' + jwt(actor), ...options.headers }
    });
}

async function check(label, action) {
    try {
        await action();
        checks.push(true);
    } catch (error) {
        console.error(label, error.message);
        checks.push(false);
    }
}

async function run() {
    temp = await mkdtemp(join(tmpdir(), 'tg-storage-fixture-'));
    execFileSync(join(bin, 'initdb'), ['-D', join(temp, 'pg'), '-A', 'trust', '-U', 'postgres', '--no-locale', '-E', 'UTF8']);
    const pgLog = launch(join(bin, 'postgres'), ['-D', join(temp, 'pg'), '-h', '127.0.0.1', '-p', '55439', '-k', '']);
    let pg;
    try {
        pg = await retry(async () => {
            const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 500 });
            try { await client.connect(); return client; }
            catch (error) { await client.end(); throw error; }
        });
    } catch (error) {
        throw new Error('PostgreSQL local: ' + pgLog() + error.message);
    }
    try {
        db.exec = sql => pg.query(sql);
        db.query = async (sql, args) => {
            const result = await pg.query(sql, args);
            return { rows: result.rows, affectedRows: result.rowCount };
        };
        await prepareDatabase();
        await seed();
        const storageLog = launch(process.execPath, ['--import', 'tsx', 'src/start/server.ts'], {
            cwd: storage,
            env: {
                PATH: process.env.PATH, HOME: process.env.HOME,
                SERVER_HOST: '127.0.0.1', SERVER_PORT: '55139', SERVER_ADMIN_PORT: '55140',
                DATABASE_URL: databaseUrl, AUTH_JWT_SECRET: secret, STORAGE_BACKEND: 'file',
                FILE_STORAGE_BACKEND_PATH: join(temp, 'bodies'), TENANT_ID: 'tg-fixture',
                STORAGE_S3_BUCKET: 'local-fixture', DB_INSTALL_ROLES: 'true'
            }
        });
        try {
            await retry(async () => {
                const response = await fetch(origin + '/status');
                assert.ok(response.ok, 'Serviço ainda indisponível');
            }, 70);
        } catch (error) {
            throw new Error('Storage local: ' + storageLog() + error.message);
        }
        await prepareAttachments({ service: true });
        await pg.query('insert into storage.buckets (id,name,public) values ($1,$1,false)', [bucket]);
        const name = 'a/os_fotos/sa/fixture.jpg';
        const other = 'b/os_fotos/sb/fixture.jpg';
        const fixture = Buffer.from('fixture-storage-supabase-2026');
        const upload = (actor, path) => request(actor, `/object/${bucket}/${path}`, {
            method: 'POST', headers: { 'content-type': 'image/jpeg' }, body: fixture
        });
        const attachments = actor => criar({ storage: { from: requestedBucket => ({
            async createSignedUrl(path, expiresIn) {
                const response = await request(actor, `/object/sign/${requestedBucket}/${path}`, {
                    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expiresIn })
                });
                const body = await response.json();
                if (!response.ok) assert.ok(response.status < 500, JSON.stringify(body));
                return response.ok ? { data: { signedUrl: origin + body.signedURL } } : { error: body };
            },
            async download(path) {
                const response = await request(actor, `/object/${requestedBucket}/${path}`);
                assert.ok(response.status < 500, 'Erro interno ao descarregar no Storage');
                return response.ok ? { data: await response.blob() } : { error: await response.json() };
            }
        }) } }, 'https://testetg.example.invalid');
        async function expectUpload(actor, path, allowed) {
            const response = await upload(actor, path);
            const message = await response.text();
            assert.equal(response.ok, allowed, message);
            if (!allowed) assert.ok([400, 401, 403, 404].includes(response.status), message);
        }
        await check('Empresa A carrega ficheiro', () => expectUpload(1, name, true));
        await check('Empresa B carrega ficheiro', () => expectUpload(2, other, true));
        async function signedBytes(actor, path) {
            const link = await attachments(actor).assinar(url(path));
            const response = await fetch(link);
            if (!response.ok) assert.fail(await response.text());
            assert.deepEqual(Buffer.from(await response.arrayBuffer()), fixture);
        }
        await check('Pré-visualização real pelo autor', () => signedBytes(1, name));
        await check('Carregamento interempresas bloqueado', () => expectUpload(2, 'a/os_fotos/sa/another.jpg', false));
        await check('Carregamento do Portal bloqueado', () => expectUpload(6, 'a/os_fotos/sa/another.jpg', false));
        await pg.query('update servicos set fotos=$1::jsonb where id=$2', [JSON.stringify([url(name)]), 'sa']);
        await pg.query('update servicos set fotos=$1::jsonb where id=$2', [JSON.stringify([url(other)]), 'sb']);
        await check('Portal A abre fotografia da sua OS', () => signedBytes(6, name));
        await check('Portal B abre fotografia da sua OS', () => signedBytes(7, other));
        await check('Portal A descarrega fotografia da sua OS', async () => {
            const response = await attachments(6).descarregar(url(name));
            assert.deepEqual(Buffer.from(await response.arrayBuffer()), fixture);
        });
        for (const actor of [0, 2, 7, 8]) {
            await check(`Assinatura recusada ao perfil ${actor}`, () => assert.rejects(attachments(actor).assinar(url(name)), /Não foi possível abrir/));
            await check(`Download recusado ao perfil ${actor}`, () => assert.rejects(attachments(actor).descarregar(url(name)), /Não foi possível descarregar/));
        }
        await check('URL pública recusada', async () => {
            const response = await fetch(`${origin}/object/public/${bucket}/${name}`);
            assert.ok([400, 403, 404].includes(response.status), await response.text());
        });
        await pg.query("update servicos set fotos='[]' where id='sa'");
        await check('Sem associação, novos links recusados ao Portal', () => assert.rejects(attachments(6).assinar(url(name)), /Não foi possível abrir/));
        for (const [type, record, file, associate, id, portalAllowed] of attachmentReferences()) {
            const path = `a/${type}/${record}/${file}`;
            await check(`Carregamento ${type}/${file}`, () => expectUpload(1, path, true));
            await check(`Associação ${type}/${file}`, async () => {
                const result = await pg.query(associate, [url(path), id]);
                assert.equal(result.rowCount, 1);
            });
            await check(`Abertura por gestor ${type}/${file}`, () => signedBytes(3, path));
            await check(`Bloqueio interempresas ${type}/${file}`, () => assert.rejects(attachments(2).assinar(url(path)), /Não foi possível abrir/));
            await check(`Permissão do Portal ${type}/${file}`, async () => {
                if (portalAllowed) await signedBytes(6, path);
                else await assert.rejects(attachments(6).assinar(url(path)), /Não foi possível abrir/);
            });
        }
        console.log(JSON.stringify({ storage: 'v1.39.3', total: checks.length, passed: checks.filter(Boolean).length }));
        if (checks.some(result => !result)) {
            console.error(storageLog().split('\n').filter(line => /"level":50|InternalError|permission denied/.test(line)).slice(0,3).join('\n'));
            process.exitCode = 1;
        }
    } finally {
        await pg.end();
    }
}

run().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
}).finally(async () => {
    for (const child of children.reverse()) {
        if (child.exitCode !== null || child.signalCode !== null) continue;
        child.kill('SIGTERM');
        await Promise.race([once(child, 'exit'), delay(1500)]);
        if (child.exitCode === null && child.signalCode === null) {
            child.kill('SIGKILL');
            await once(child, 'exit');
        }
    }
    if (temp) await rm(temp, { recursive: true, force: true });
});
