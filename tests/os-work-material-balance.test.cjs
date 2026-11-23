const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('app-principal.js','utf8');
const section = source.slice(source.indexOf('        function _verOsMostrar('), source.indexOf('        function gerarRelatorioOSIndividual('));
test('OS linked to a work shows remaining/excess consumption without cross-tenant planned rows',()=>{
  assert.match(section,/m\.obraId === os\.obraId && m\.adminId === adminIdVerOs/);
  assert.match(section,/const falta = Math\.max\(0, prev - cons\), excedente = Math\.max\(0, cons - prev\)/);
  assert.match(section,/Falta: \$\{falta\}/);
});
test('direct OS material consumption does not mutate work planned quantity',()=>{
 const start=section.indexOf('        function _verOsAdicionarMaterial(');
 const body=section.slice(start);
 assert(start>=0);
 assert.match(body,/om\.qtdConsumida = \(Number\(om\.qtdConsumida\) \|\| 0\) \+ qtd/);
 assert.doesNotMatch(body,/om\.qtdPrevista\s*=/);
 assert.match(body,/qtdPrevista: 0, qtdConsumida: qtd/);
});
test('OS direct consumption requires tenant access and positive finite decimal amount',()=>{
 const body=section.slice(section.indexOf('        function _verOsAdicionarMaterial('));
 assert.match(body,/Number\.isFinite\(qtd\)/);
 assert.match(body,/s\.id === osId && s\.adminId === adminId/);
 assert.match(body,/a\.id === artigoId && a\.adminId === adminId/);
});
