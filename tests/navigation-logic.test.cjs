const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root=path.resolve(__dirname,'..');
function setup() {
  const source=fs.readFileSync(path.join(root,'app-principal.js'),'utf8');
  const elements=new Map();
  function element(id='') {
    const classes=new Set();
    return {id,dataset:{},style:{},innerHTML:'',scrollTop:0,classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),toggle:(c,v)=>v?classes.add(c):classes.delete(c)},after(e){elements.set(e.id,e)},setAttribute(){},removeAttribute(){}};
  }
  for(const id of ['wsClienteOverlay','wsClienteConteudo','wsClienteAbas','wsClienteSubAbas'])elements.set(id,element(id));
  const overlay=elements.get('wsClienteOverlay');overlay.dataset.clienteAtual='c1';overlay.classList.add('open');
  const context=vm.createContext({console,setTimeout,clearTimeout,document:{getElementById:id=>elements.get(id),createElement:()=>element(),querySelectorAll:()=>[],querySelector:()=>null},window:{},usuarioLogado:{role:'admin'},dados:{clientes:[{id:'c1',nome:'Cliente 1'},{id:'c2',nome:'Cliente 2'}],locais:[],contratos:[],obras:[],servicos:[],tiposTrabalhoCustom:[],relatoriosEspecialidade:[]},flags:{contratos:true,assist:true,obras:true}});
  vm.runInContext(`
    function escapeHtmlSimples(s){return String(s??'').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
    function adminAtual(){return {numeroRegistoPrevio:'RP1',numeroAnepc:'ANEPC1'}}
    function moduloContratosAtivo(){return flags.contratos}
    function moduloAssistAtivo(){return flags.assist}
    function moduloArmazemAtivo(){return flags.obras}
    function _wsResumoHtml(){return Promise.resolve('RESUMO')}
    function _wsOsHtml(){return Promise.resolve('OS')}
    function _wsLocaisHtml(){return 'LOCAIS'}
    function _wsAssistenciasHtml(){return 'ASSISTENCIAS'}
    function _wsObrasHtml(){return 'OBRAS'}
    function _wsContratosHtml(){return 'CONTRATOS'}
    function _wsEquipamentosHtml(){return 'EQUIPAMENTOS'}
    function _wsFinanceiroHtml(){return Promise.resolve('FINANCEIRO')}
    let overlayRequestSequence=0;
    ${source.match(/        const WS_CLIENTE_ABAS =[^\n]+/)[0]}
    ${source.match(/        const WS_CLIENTE_ABAS_LABEL =[^\n]+/)[0]}
    ${['_wsClienteAba','_wsClienteFechar','_wsSairPara','_wsTentarVoltar'].map(name=>source.match(new RegExp('        (?:async )?function '+name+'\\([^]*?\\n        \\}'))[0]).join('\n')}
  `,context);
  vm.runInContext(fs.readFileSync(path.join(root,'navegacao-clientes.js'),'utf8'),context);
  return {context,elements,run:code=>vm.runInContext(code,context)};
}
test('sidebar has six areas, excludes hidden cards, delegates original gates',()=>{
 const {run}=setup();
 run(`var cards=['clientes','servicos','agenda','ponto','crm'].map(sec=>({dataset:{card:sec},classList:{contains:()=>false},click(){window.clicked=sec}}));_tgCard=sec=>cards.find(c=>c.dataset.card===sec);document.querySelectorAll=()=>cards;`);
 const menu=run('_tgMenuSimplesHTML(false)');
 for(const name of ['Hoje','Clientes','Serviços','Agenda','Equipa','Mais'])assert(menu.includes('>'+name+'</span>'));
 assert.equal((menu.match(/<button/g)||[]).length,6);
 run(`_fecharSidebarMobile=()=>{};_tgAbrirOriginal('ponto')`);assert.equal(run('window.clicked'),'ponto');
 run(`window.clicked=null;cards.find(c=>c.dataset.card==='ponto').classList.contains=c=>c==='hidden-card';_tgAbrirOriginal('ponto')`);assert.equal(run('window.clicked'),null);
});
test('reports are isolated by client, category and escaped',async()=>{
 const {context,run}=setup();context.dados.relatoriosEspecialidade=[{id:'1',clienteId:'c1',tipo:'REX',numeroDocumento:'R1'},{id:'2',clienteId:'c2',tipo:'REX',numeroDocumento:'SECRET'},{id:'3',clienteId:'c1',tipo:'CUSTOM_X',numeroDocumento:'CUSTOM1'},{id:'4',clienteId:'c1',tipo:'<script>',numeroDocumento:'ESCAPED'}];
 let html=await run("_tgClienteDocumentos('c1','documentos')");assert.match(html,/R1/);assert.doesNotMatch(html,/SECRET|CUSTOM1|<script>/);
 html=await run("_tgClienteDocumentos('c1','personalizados')");assert.match(html,/CUSTOM1/);assert.doesNotMatch(html,/SECRET|R1/);
});
test('main tabs and nested tabs respect existing module flags',async()=>{
 const {run,elements}=setup();await run("_wsClienteAba('c1','assistencias')");assert.match(elements.get('wsClienteConteudo').innerHTML,/ASSISTENCIAS/);
 assert.match(elements.get('wsClienteSubAbas').innerHTML,/Manutenções/);
 run('flags.assist=false;flags.contratos=false;flags.obras=false');await run("_wsClienteAba('c1','assistencias')");assert.equal(elements.get('wsClienteConteudo').innerHTML,'RESUMO');assert.doesNotMatch(elements.get('wsClienteAbas').innerHTML,/>Obras<|>Contratos</);
});
test('a stale request cannot replace a more recently selected tab',async()=>{
 const {run,elements}=setup();const first=run("_wsOsHtml=()=>new Promise(r=>window.resolveOS=r);_wsClienteAba('c1','os')");await run("_wsClienteAba('c1','registos')");run("window.resolveOS('STALE')");await first;assert.match(elements.get('wsClienteConteudo').innerHTML,/RP1/);assert.doesNotMatch(elements.get('wsClienteConteudo').innerHTML,/STALE/);
});
test('return from form retains tab and scroll; explicit close cancels return',async()=>{
 const {run,elements}=setup();await run("_wsClienteAba('c1','personalizados')");elements.get('wsClienteConteudo').scrollTop=180;run("_wsSairPara('c1')");assert.equal(run('window._wsVoltarCliente.aba'),'personalizados');run('_wsTentarVoltar()');await new Promise(r=>setTimeout(r,380));assert(elements.get('wsClienteOverlay').classList.contains('open'));assert.equal(elements.get('wsClienteConteudo').scrollTop,180);run('_wsClienteFechar()');assert.equal(run('window._wsVoltarCliente'),null);
});
