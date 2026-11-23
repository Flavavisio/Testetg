const {test}=require('node:test');
const assert=require('node:assert/strict');
const {resolvePlanOwner,summarizePlan,validateImportRows}=require('../tg-material-planning.js');
const works=[{id:'w',adminId:'a'},{id:'foreign',adminId:'b'}];
const articles=[{id:'c',adminId:'a',nome:'Cabo',referencia:'CB',unidade:'m'},{id:'x',adminId:'b',nome:'Privado',referencia:'PR',unidade:'un'}];
test('OS ligada a obra resolve um único plano da obra',()=>{
  assert.deepEqual(resolvePlanOwner({id:'os',adminId:'a',obraId:'w'},works,'a'),{type:'obra',id:'w'});
  assert.deepEqual(resolvePlanOwner({id:'os',adminId:'a'},works,'a'),{type:'os',id:'os'});
  assert.equal(resolvePlanOwner({id:'os',adminId:'a',obraId:'foreign'},works,'a'),null);
  assert.equal(resolvePlanOwner({id:'os',adminId:'b',obraId:'w'},works,'a'),null);
});
test('previsto, consumido, em falta e excedente; isolamento por empresa',()=>{
  assert.deepEqual(summarizePlan([{id:'p',adminId:'a',artigoId:'c',qtdPrevista:10,qtdConsumida:3.5},
     {id:'p2',adminId:'a',artigoId:'c',qtdPrevista:2,qtdConsumida:3},
     {id:'p3',adminId:'b',artigoId:'x',qtdPrevista:5,qtdConsumida:1}],articles,'a'),[
      {id:'p',artigoId:'c',nome:'Cabo',unidade:'m',previsto:10,consumido:3.5,falta:6.5,excedente:0},
      {id:'p2',artigoId:'c',nome:'Cabo',unidade:'m',previsto:2,consumido:3,falta:0,excedente:1}
     ]);
});
test('importação só confirma artigos existentes com unidades e quantidades válidas',()=>{
  const result=validateImportRows([{referencia:'CB',quantidade:'2,5',unidade:'m'},
    {referencia:'PR',quantidade:1},{referencia:'CB',quantidade:-2},
    {referencia:'CB',quantidade:1,unidade:'un'}],articles,'a');
  assert.equal(result.canConfirm,false);
  assert.deepEqual(result.accepted,[{artigoId:'c',qtdPrevista:2.5,linha:2}]);
  assert.deepEqual(result.errors.map(x=>x.linha),[3,4,5]);
  assert.deepEqual(validateImportRows([{nome:'Cabo',qtd:4}],articles,'a'),{
     accepted:[{artigoId:'c',qtdPrevista:4,linha:2}],errors:[],canConfirm:true});
});
