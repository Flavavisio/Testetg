const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const main=fs.readFileSync('app-principal.js','utf8');
const context={};vm.createContext(context);vm.runInContext(main.match(/        function _estadoStockArtigo\([^]*?\n        \}/)[0],context);
const status=context._estadoStockArtigo;
test('negative stock is urgent without configured minimum or optional alerts',()=>{
 for(const stockMinimo of [null,undefined,'',0,5]) for(const alertaStock of [false,true]){
  const s=status({stockMinimo,alertaStock},-3);assert(s.negativo);assert(s.baixo);assert(s.alerta);assert.match(s.label,/negativo/);
 }
});
test('threshold includes equality and does not turn an unset threshold into zero',()=>{
 assert(!status({stockMinimo:null},0).baixo);assert(!status({stockMinimo:''},0).baixo);
 assert(status({stockMinimo:5,alertaStock:true},5).alerta);assert(!status({stockMinimo:5,alertaStock:false},5).alerta);
 assert(!status({stockMinimo:5,alertaStock:true},6).baixo);
});
test('Teco includes negative balances without leaking other tenants',()=>{
 const E=require('../tg-smart-engine');const s=E.snapshot({artigos:[{id:'a',adminId:'a',stockInicial:-65},{id:'b',adminId:'b',stockInicial:-9}]},{id:'a',role:'admin'},['artigos']);
 const alert=E.alerts(s).find(x=>x.kind==='stock');assert.equal(alert.items.length,1);assert.equal(alert.items[0].quantity,-65);
});
