const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
(async()=>{
 const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'app-principal.js'),'utf8');
 const pick=name=>{const m=source.match(new RegExp('        (?:async )?function '+name+'\\([^]*?\\n        \\}'));assert(m,name);return m[0]};
 const nodes={};
 function node(id){return nodes[id]||= {style:{},dataset:{},classList:{add(){},remove(){}},_html:'',get innerHTML(){return this._html},set innerHTML(value){this._html=value;if(id==='modalGenericoCampos'){for(const key of Object.keys(nodes))if(key.startsWith('verObra'))delete nodes[key];for(const m of value.matchAll(/id="([^"]+)"/g))node(m[1]);}}};}
 ['modalGenericoOverlay','modalGenericoTitulo','modalGenericoCampos','modalGenericoForm','wsClienteOverlay'].forEach(node);
 const document={getElementById:id=>nodes[id]||null,querySelector:()=>null};
 const c=vm.createContext({document,console,Promise});c.window=c;
 vm.runInContext(`
 var dados={administradores:[{id:'admin',crm:true}],obras:[{id:'work',adminId:'admin',clienteId:'client',nome:'Obra de teste',temAutosMedicao:true},{id:'disabled',adminId:'admin',clienteId:'client',nome:'Sem autos',temAutosMedicao:false},{id:'elsewhere',clienteId:'other',nome:'Outra obra',temAutosMedicao:true}],locais:[],autosMedicao:[{id:'auto1',obraId:'work',numero:1,dataFim:'2026-10-22',totalHoras:8,valorMateriais:100,valorMaoDeObra:200,valorTotal:300}],folhasObra:[]};
 var usuarioLogado={id:'admin',role:'admin'},_wsAbaAtual='obras',finishCheck;
 function moduloCrmAtivo(a){return !!a?.crm} function moduloErpAtivo(){return false}
 function escapeHtmlSimples(s){return String(s||'')} function totalHorasObra(){return 8}
 function obrasAvancadoAtivo(){return false} function obterNomeCliente(){return 'Cliente'}
 function _nomesAtribuidosObraColorido(){return 'Técnico'} function _moradaCompletaObra(){return 'Lisboa'}
 function _botaoPontoObraHTML(){return ''} function _verificarAvisoDocsObra(){return new Promise(r=>finishCheck=r)}
 function _finEur(v){return v+' €'}
 ${['_obraAutosMedicaoDisponiveis','_wsObrasHtml','_wsSairPara','abrirObraLongaDetalhe','_abrirObraLongaDetalheReal','_verObraMostrar','_renderizarAutosMedicao'].map(pick).join('\n')}
 `,c);
 let html=c._wsObrasHtml('client');
 assert.equal((html.match(/title="Autos de medição"/g)||[]).length,1);
 assert.doesNotMatch(html,/Outra obra/);
 const shortcut=html.match(/onclick="([^"]+)" title="Autos de medição"/)[1];
 // Existing client View Work and direct menu render the same measurement tab.
 c._wsSairPara('client');const opening=c.abrirObraLongaDetalhe('work');
 assert.equal(nodes.verObraBtnAutos,undefined,'Wait for document check before opening');
 c.finishCheck();await opening;assert(nodes.verObraBtnAutos);
 c._verObraMostrar('work','autos');const expected=nodes.verObraConteudo.innerHTML;assert.match(expected,/#1/);
 // Execute the actual customer button action; tab selection waits for the async check.
 const clicked=vm.runInContext(shortcut,c);c.finishCheck();await clicked;
 assert.equal(nodes.verObraConteudo.innerHTML,expected);
 assert.equal(c.window._wsVoltarCliente.id,'client');assert.equal(c.window._wsVoltarCliente.aba,'obras');
 // Direct access to the work gives the same result.
 const direct=c.abrirObraLongaDetalhe('work');c.finishCheck();await direct;c._verObraMostrar('work','autos');
 assert.equal(nodes.verObraConteudo.innerHTML,expected);
 for(const change of [()=>c.dados.administradores[0].crm=false,()=>{c.dados.administradores[0].crm=true;c.dados.obras[0].temAutosMedicao=false}]){
  change();assert.doesNotMatch(c._wsObrasHtml('client'),/title="Autos de medição"/);
  const unavailable=c.abrirObraLongaDetalhe('work','autos');c.finishCheck();await unavailable;
  assert.equal(nodes.verObraBtnAutos,undefined);assert.doesNotMatch(nodes.verObraConteudo.innerHTML,/Criar Auto de Medição/);
 }
 console.log('PASS: client View Work, measurement shortcut, async opening, existing autos, module gate, work flag and customer isolation');
})().catch(e=>{console.error(e);process.exit(1)});
