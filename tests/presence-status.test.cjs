const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const src = fs.readFileSync('app-principal.js', 'utf8');
const hoje = '2026-10-21';
const fn = name => {
  const match = src.match(new RegExp('        function ' + name + '\\([^]*?\\n        \\}'));
  assert(match, name);
  return match[0];
};
function setup(ponto = [], obraPontoLonga = []) {
  const dados = { ponto, obraPontoLonga, servicos: [{ id: 'os', obraId: 'obra', clienteId: 'cliente' }], obras: [{ id: 'obra', nome: 'Obra teste' }] };
  const ctx = vm.createContext({ dados, obterNomeCliente: () => 'Cliente teste' });
  vm.runInContext(fn('_estadoPresencaPessoa'), ctx);
  return { dados, estado: () => ctx._estadoPresencaPessoa('f', hoje) };
}
const geral = (entrada, saida, extra = {}) => ({ funcionarioId: 'f', data: hoje, entrada, saida, ...extra });

test('closed OS after lunch does not leave the person in service', () => {
  const { estado } = setup([geral('08:00', '12:00'), geral('13:00', '17:00', { servicoId: 'os' })]);
  assert.equal(estado().label, 'Terminou o dia');
  assert.equal(estado().ativo, false);
});
test('closed worksite after lunch does not leave the person in service', () => {
  const { estado } = setup([geral('08:00', '12:00')], [geral('13:00', '17:00', { obraId: 'obra' })]);
  assert.equal(estado().ativo, false);
});
test('latest general entry determines status regardless of storage order', () => {
  for (const reverse of [false, true]) {
    const rows = [geral('08:00', ''), geral('13:00', '17:00')];
    const { estado } = setup(reverse ? rows.reverse() : rows);
    assert.equal(estado().label, 'Terminou o dia');
    assert.equal(estado().ativo, false);
  }
  assert.equal(setup([geral('08:00', '12:00'), geral('13:00', '')]).estado().ativo, true);
});
test('open OS and worksite remain active after general lunch exit', () => {
  const rows = [geral('08:00', '12:00')];
  const os = setup([...rows, geral('13:00', '', { servicoId: 'os' })]).estado();
  assert.equal(os.label, 'Em OS — Cliente teste');
  assert.equal(os.ativo, true);
  const obra = setup(rows, [geral('13:00', '', { obraId: 'obra' })]).estado();
  assert.equal(obra.label, 'Em Obra — Obra teste');
  assert.equal(obra.ativo, true);
});
test('other people and dates do not affect presence', () => {
  const { estado } = setup([geral('08:00', '', { funcionarioId: 'other' }), geral('08:00', '', { data: '2026-10-20' })]);
  assert.equal(estado().label, 'Ainda não começou');
  assert.equal(estado().ativo, false);
});
test('rendering repeatedly preserves records, hours and ordering', () => {
  const { dados, estado } = setup([geral('08:00', '12:00'), geral('13:00', '17:00')]);
  const before = JSON.stringify(dados);
  for (let i = 0; i < 10; i++) estado();
  assert.equal(JSON.stringify(dados), before);
});
test('both dashboard panels consume the same presence result', () => {
  const calls = [...src.matchAll(/const estadoPessoa = p => ([^;]+);/g)];
  assert.equal(calls.length, 2);
  for (const [, expression] of calls) {
    const { dados } = setup([geral('08:00', '12:00'), geral('13:00', '17:00', { servicoId: 'os' })]);
    const ctx = vm.createContext({ dados, obterNomeCliente: () => 'Cliente teste', hoje, p: { id: 'f' } });
    vm.runInContext(fn('_estadoPresencaPessoa'), ctx);
    const state = vm.runInContext(expression, ctx);
    assert.equal(state.label, 'Terminou o dia');
    assert.equal(state.ativo, false);
  }
});
test('Admin sheet linked through OS counts once in worksite hours', () => {
  const ctx = vm.createContext({
    dados: {
      servicos: [{ id: 'os', obraId: 'obra' }],
      folhasObra: [{ funcionarioId: 'admin', servicoId: 'os', obraId: 'obra', descricao: 'Trabalho', horasTrabalhadas: 4 }],
      ponto: [{ funcionarioId: 'admin', servicoId: 'os', entrada: '08:00', saida: '12:00' }],
      obraPontoLonga: [{ funcionarioId: 'admin', obraId: 'obra', entrada: '08:00', saida: '12:00' }]
    },
    calcularHoras: (a, b) => { const h = t => Number(t.slice(0, 2)) + Number(t.slice(3)) / 60; return h(b) - h(a); }
  });
  vm.runInContext(fn('_horasObraPorFuncionario') + '\n' + fn('totalHorasObra'), ctx);
  assert.equal(ctx.totalHorasObra('obra'), 4);
  delete ctx.dados.folhasObra[0].obraId;
  assert.equal(ctx.totalHorasObra('obra'), 4);
});
