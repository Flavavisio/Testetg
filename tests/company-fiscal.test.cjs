const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app-principal.js'),'utf8');
const migration=fs.readFileSync(path.join(root,'migrations/20261020_nome_fiscal_empresa.sql'),'utf8');
test('fiscal company identity mapped and guarded in onboarding and profile',()=>{
  assert.match(app,/nomeFiscal: r\.nome_fiscal/);
  assert.match(app,/nome_fiscal: o\.nomeFiscal/);
  assert.match(app,/\['admin','subadmin'\]\.includes\(usuarioLogado\?\.role\)/);
  assert.match(app,/id="perf_nome_fiscal"/);
  assert.match(app,/admin\.nomeFiscal = nomeFiscal/);
  for(const file of ['index.html','login.html'])
    assert.match(fs.readFileSync(path.join(root,file),'utf8'),/id="onb_nome_fiscal"/);
});
test('fiscal name displays separately below trade name in report and PDF headers',()=>{
  assert.match(app,/empresaNomeFiscal: adminRec\?\.nomeFiscal/);
  assert.match(app,/id="empresaNomeFiscalTxt"/);
  assert.match(app,/function _tgNomeFiscalNoIframe/);
  assert.match(app,/doc\.text\(adminRec\.nomeFiscal\.trim\(\), 14, y\)/);
  assert.match(migration,/ADD COLUMN IF NOT EXISTS nome_fiscal text/);
});
