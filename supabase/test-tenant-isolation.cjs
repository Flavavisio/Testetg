// Use the JSON object returned by export-tenant-test-metadata.sql.
// With Node 24 and @electric-sql/pglite 0.6.1, run:
//   node supabase/test-tenant-isolation.cjs /path/to/snapshot.json
// All writes go to a fresh PostgreSQL instance in memory.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

const snapshotPath = process.argv[2];
assert.ok(snapshotPath, 'Indique o ficheiro JSON com os metadados das políticas.');
const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'));
const quote = value => '"' + value.replaceAll('"', '""') + '"';
const uuid = number => '00000000-0000-4000-8000-' + String(number).padStart(12, '0');
const db = new PGlite();
const results = [];

async function prepareDatabase() {
    await db.exec(`
        create role anon;
        create role authenticated;
        create schema auth;
        create schema tg_internal;
        create type public.user_role as enum ('superadmin', 'admin', 'encarregado', 'funcionario',
            'subadmin', 'vendedor', 'supervisor_vigilantes', 'vigilante');
        grant usage on schema auth to anon, authenticated;
        create function auth.uid() returns uuid language sql stable as
        $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
        create table public.encarregados (id text, admin_id text);
        create table public.encarregado_funcionarios (encarregado_id text, funcionario_id text);
        grant select on public.encarregados, public.encarregado_funcionarios
            to authenticated;
    `);
    const tables = Map.groupBy(snapshot.columns, column => column.table_name);
    for (const [table, columns] of tables) {
        const fields = columns.map(column => `${quote(column.field)} ${column.data_type}`).join(', ');
        await db.exec(`create table public.${quote(table)} (${fields}); alter table public.${quote(table)} enable row level security;`);
    }
    for (const definition of new Set([...snapshot.functions, ...snapshot.triggers.map(trigger => trigger.definition)])) {
        await db.exec(definition);
    }
    for (const policy of snapshot.policies) {
        const roles = policy.roles.slice(1, -1).split(',').map(role => role === 'public' ? 'public' : quote(role));
        const using = policy.qual ? ` using (${policy.qual})` : '';
        const check = policy.with_check ? ` with check (${policy.with_check})` : '';
        await db.exec(`create policy ${quote(policy.policyname)} on public.${quote(policy.tablename)}
            as ${policy.permissive} for ${policy.cmd} to ${roles.join(', ')}${using}${check};`);
    }
    for (const grant of snapshot.grants.filter(grant => grant.allowed)) {
        await db.exec(`grant ${grant.operation} on public.${quote(grant.table_name)} to ${quote(grant.role_name)};`);
    }
    for (const grant of snapshot.columnGrants) {
        await db.exec(`grant ${grant.operation} (${quote(grant.field)}) on public.${quote(grant.table_name)} to ${quote(grant.role_name)};`);
    }
    for (const trigger of snapshot.triggers) await db.exec(trigger.installation);
}

async function seed() {
    await db.exec(`
        insert into administradores (id,nome,email,ativo,pack_atual) values
            ('a','Empresa A','a@example.invalid',true,'pro'),
            ('b','Empresa B','b@example.invalid',true,'pro');
        insert into clientes (id,nome,admin_id,portal_ativo) values
            ('ca','Cliente A','a',true), ('ca2','Cliente A2','a',true),
            ('cb','Cliente B','b',true), ('cd','Portal desativado','a',false);
        insert into servicos (id,admin_id,cliente_id) values
            ('sa','a','ca'), ('sa2','a','ca2'), ('sb','b','cb');
        insert into obras (id,admin_id,cliente_id) values
            ('oa','a','ca'), ('oa2','a','ca2'), ('ob','b','cb');
        insert into funcionarios (id,admin_id) values ('fa','a'), ('fa2','a'), ('fb','b');
        insert into encarregados values ('ea','a');
        insert into encarregado_funcionarios values ('ea','fa');
        insert into folhas_obra (id,admin_id,servico_id,funcionario_id,obra_descricao) values
            ('fa-sheet','a','sa','fa','Ficha A'), ('fa2-sheet','a','sa2','fa2','Ficha A2'),
            ('fb-sheet','b','sb','fb','Ficha B');
        insert into licencas (admin_id,codigo,plano,data_inicio,data_expiracao,dias,max_funcionarios,ativa) values
            ('a','a-license','pro','2026-01-01','2027-01-01',365,3,true),
            ('b','b-license','pro','2026-01-01','2027-01-01',365,3,true);
        insert into config_superadmin (id,nome) values (true,'Configuração fictícia');
        insert into perfis (id,papel,admin_id,registo_id) values
            ('${uuid(1)}','admin','a','a'), ('${uuid(2)}','admin','b','b'),
            ('${uuid(3)}','subadmin','a','sa-admin'), ('${uuid(4)}','funcionario','a','fa'),
            ('${uuid(5)}','encarregado','a','ea'), ('${uuid(6)}','cliente','a','ca'),
            ('${uuid(7)}','cliente','b','cb'), ('${uuid(8)}','cliente','a','cd'),
            ('${uuid(9)}','superadmin',null,'superadmin');
    `);
}

async function scenario(actor, label, query, expected) {
    await db.exec('begin');
    try {
        await db.query("select set_config('request.jwt.claim.sub', $1, true)", [actor ? uuid(actor) : '']);
        await db.exec(actor ? 'set local role authenticated' : 'set local role anon');
        const result = await db.query(query);
        const actual = Array.isArray(expected)
            ? result.rows.map(row => Object.values(row)[0])
            : result.affectedRows;
        assert.deepEqual(actual, expected);
        results.push({ label, passed: true });
    } catch (error) {
        if (expected === '42501' && error.code === expected) {
            results.push({ label, passed: true });
        } else {
            results.push({ label, passed: false, reason: error.code ?? error.message });
        }
    } finally {
        await db.exec('rollback');
    }
}

async function main() {
    await prepareDatabase();
    await seed();
    const reads = [
        ['administradores', 'id', [[], ['a'], ['b'], ['a'], ['a'], ['a'], [], [], [], ['a', 'b']]],
        ['clientes', 'id', [[], ['ca', 'ca2', 'cd'], ['cb'], ['ca', 'ca2', 'cd'], ['ca', 'ca2', 'cd'], ['ca', 'ca2', 'cd'], ['ca'], ['cb'], [], ['ca', 'ca2', 'cb', 'cd']]],
        ['servicos', 'id', [[], ['sa', 'sa2'], ['sb'], ['sa', 'sa2'], ['sa', 'sa2'], ['sa', 'sa2'], ['sa'], ['sb'], [], ['sa', 'sa2', 'sb']]],
        ['obras', 'id', [[], ['oa', 'oa2'], ['ob'], ['oa', 'oa2'], ['oa', 'oa2'], ['oa', 'oa2'], ['oa'], ['ob'], [], ['oa', 'oa2', 'ob']]],
        ['folhas_obra', 'id', [[], ['fa-sheet', 'fa2-sheet'], ['fb-sheet'], ['fa-sheet', 'fa2-sheet'], ['fa-sheet'], ['fa-sheet'], ['fa-sheet'], ['fb-sheet'], [], ['fa-sheet', 'fa2-sheet', 'fb-sheet']]],
        ['licencas', 'admin_id', [[], ['a'], ['b'], ['a'], ['a'], ['a'], [], [], [], ['a', 'b']]],
        ['config_superadmin', 'id', [[], [], [], [], [], [], [], [], [], [true]]],
        ['perfis', 'id', [[], [uuid(1)], [uuid(2)], [uuid(3)], [uuid(4)], [uuid(5)], [uuid(6)], [uuid(7)], [uuid(8)], Array.from({ length: 9 }, (_, index) => uuid(index + 1))]],
    ];
    for (const [table, key, expectations] of reads) {
        for (const [actor, expected] of expectations.entries()) {
            const collation = table === 'perfis' || table === 'config_superadmin' ? '' : ' collate "C"';
            await scenario(actor, `SELECT ${table} perfil ${actor}`, `select ${key} from ${table} order by ${key}${collation}`, expected);
        }
    }
    const operationCases = [
        ['clientes', 'id', 'ca', 'cb', "(id,nome,admin_id) values ('novo','Novo',", "nome='Revisto'"],
        ['servicos', 'id', 'sa', 'sb', "(id,admin_id) values ('novo',", "descricao='Revista'"],
        ['obras', 'id', 'oa', 'ob', "(id,admin_id) values ('novo',", "observacoes='Revista'"],
        ['folhas_obra', 'id', 'fa-sheet', 'fb-sheet', "(id,obra_descricao,admin_id) values ('novo','Nova',", "descricao='Revista'"],
    ];
    for (const [table, key, own, other, insert, update] of operationCases) {
        await scenario(1, `INSERT próprio ${table}`, `insert into ${table} ${insert}'a')`, 1);
        await scenario(1, `INSERT outra empresa ${table}`, `insert into ${table} ${insert}'b')`, '42501');
        await scenario(1, `UPDATE próprio ${table}`, `update ${table} set ${update} where ${key}='${own}'`, 1);
        await scenario(1, `UPDATE outra empresa ${table}`, `update ${table} set ${update} where ${key}='${other}'`, 0);
        await scenario(1, `DELETE próprio ${table}`, `delete from ${table} where ${key}='${own}'`, 1);
        await scenario(1, `DELETE outra empresa ${table}`, `delete from ${table} where ${key}='${other}'`, 0);
        if (table !== 'folhas_obra') {
            await scenario(6, `INSERT Portal ${table}`, `insert into ${table} ${insert}'a')`, '42501');
            await scenario(6, `UPDATE Portal ${table}`, `update ${table} set ${update} where ${key}='${own}'`, 0);
        }
        await scenario(6, `DELETE Portal ${table}`, `delete from ${table} where ${key}='${own}'`, 0);
    }
    await scenario(1, 'UPDATE direitos da empresa', "update administradores set pack_atual='enterprise' where id='a'", '42501');
    await scenario(1, 'UPDATE licença própria', "update licencas set plano='enterprise' where admin_id='a'", '42501');
    await scenario(9, 'UPDATE licença pelo superadmin', "update licencas set plano='enterprise' where admin_id='a'", 1);
    await scenario(1, 'UPDATE configuração superadmin', "update config_superadmin set nome='Revisto' where id", 0);
    await scenario(9, 'UPDATE configuração pelo superadmin', "update config_superadmin set nome='Revisto' where id", 1);
    await scenario(1, 'UPDATE campos do próprio perfil', "update perfis set email='revisto@example.invalid' where id='" + uuid(1) + "'", '42501');
    for (const result of results.filter(result => !result.passed)) console.error(result);
    console.log(JSON.stringify({ total: results.length, passed: results.filter(result => result.passed).length }));
    if (results.some(result => !result.passed)) process.exitCode = 1;
}

if (require.main === module) {
    main().catch(error => {
        console.error(error.message);
        process.exitCode = 1;
    }).finally(() => db.close());
}

module.exports = { db, prepareDatabase, seed, uuid };
