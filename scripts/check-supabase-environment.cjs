const { execFileSync } = require('node:child_process');
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const productionRef = 'rfniufasivfnrqfntzog';
const [mode, testRef] = process.argv.slice(2);
const projectRefPattern = /^[a-z]{19,20}$/;

if (mode !== '--maintenance' && (mode !== '--release' || !projectRefPattern.test(testRef ?? '') || testRef === productionRef)) {
    console.error('Uso: node scripts/check-supabase-environment.cjs --maintenance | --release <referência TesteTG>');
    process.exit(1);
}

const files = execFileSync('git', ['ls-files', '-z', '--', '*.html', '*.js', '*.mjs'], {
    cwd: root,
    encoding: 'utf8',
}).split('\0').filter(file => file && !/^(tests|scripts|supabase)\//.test(file));
const errors = [];
let hasTestProject = false;
const cnamePath = path.join(root, 'CNAME');
if (mode === '--release' && existsSync(cnamePath)) {
    const hostname = readFileSync(cnamePath, 'utf8').trim().toLowerCase().replace(/\.$/, '');
    if (hostname === 'totalgest.pt' || hostname === 'www.totalgest.pt') {
        errors.push('O CNAME do GitHub Pages ainda aponta para o domínio de Produção.');
    }
}

for (const file of files) {
    const source = readFileSync(path.join(root, file), 'utf8');
    if (source.toLowerCase().includes(productionRef)) {
        errors.push(`${file}: contém uma referência ao Supabase de Produção`);
        continue;
    }

    for (const match of source.matchAll(/https?:\/\/([a-z]{19,20})\.supabase\.co\b/gi)) {
        const ref = match[1].toLowerCase();
        if (mode !== '--release' || ref !== testRef) {
            errors.push(`${file}: contém um URL de Supabase fora do ambiente autorizado`);
        } else {
            hasTestProject = true;
        }
    }

    for (const match of source.matchAll(/\beyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+\b/g)) {
        let claims;
        try {
            claims = JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8'));
        } catch {
            continue;
        }
        if (claims?.role === 'service_role' || (claims?.ref && (mode !== '--release' || claims.ref !== testRef))) {
            errors.push(`${file}: contém um token que não pertence ao cliente do TesteTG`);
        }
    }
}

if (mode === '--release' && !hasTestProject) {
    errors.push('Os ficheiros publicados ainda não apontam para o projeto Supabase do TesteTG.');
}

if (errors.length) {
    for (const error of new Set(errors)) console.error(error);
    process.exitCode = 1;
} else {
    console.log(`Configuração verificada em ${files.length} ficheiros (${mode.slice(2)}).`);
}
