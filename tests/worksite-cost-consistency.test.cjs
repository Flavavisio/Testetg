const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app-principal.js','utf8');
const fn=name=>source.match(new RegExp('        function '+name+'\\([^]*?\\n        \\}'))[0];
function setup(){
 const own=x=>({adminId:'admin',...x}),sheet=(id,f,h,other={})=>own({id,funcionarioId:f,horasTrabalhadas:h,descricao:'Trabalho antigo',data:'2026-10-21',...other});
 const data={obras:[own({id:'w',nome:'Instalação de bastidor',estado:'ativa',valor:1450})],servicos:[own({id:'os',obraId:'w'})],
 folhasObra:[sheet('1','m',9,{servicoId:'os'}),sheet('2','m',7,{obraId:'w',servicoId:'os'}),sheet('3','l',8,{obraId:'w'}),sheet('4','l',7.6,{obraId:'w'}),sheet('5','b',5,{obraId:'w'}),sheet('6','b',5.9,{obraId:'w'})],
 funcionarios:[own({id:'b',nome:'Bruno',ordenadoBruto:1000,horasSemanais:40})],encarregados:[own({id:'l',nome:'Luís'})],administradores:[{id:'admin',nome:'Admin'},{id:'m',adminId:'admin',nome:'Mario'}],
 ponto:[own({id:'pm',funcionarioId:'m',servicoId:'os',entrada:'08:00',saida:'15:00'}),own({id:'pl',funcionarioId:'l',servicoId:'os',entrada:'08:00',saida:'15:36'}),own({id:'pb',funcionarioId:'b',servicoId:'os',entrada:'08:00',saida:'18:54'})],
 obraPontoLonga:[own({id:'long',obraId:'w',funcionarioId:'m',entrada:'08:00',saida:'17:00'})]};
 const tables=[],texts=[],screen={innerHTML:''};let materials=[{artigo:'Material A',cons:1,prev:1,precoUnit:277.96,valorConsumido:277.96},{artigo:'Espelho',cons:1,prev:0,precoUnit:null,valorConsumido:null}];
 const doc={lastAutoTable:{finalY:20},setFontSize(){},setTextColor(){},text(t){texts.push(t)},addPage(){},autoTable(o){tables.push(o);this.lastAutoTable={finalY:(o.startY||20)+20}}};
 const ctx=vm.createContext({dados:data,usuarioLogado:{id:'admin',role:'admin'},document:{getElementById:()=>screen},calcularHoras:(a,b)=>{const h=s=>Number(s.slice(0,2))+Number(s.slice(3))/60;return h(b)-h(a)},_obraMatRows:()=>materials,_finEur:n=>Number(n).toFixed(2)+' €',escapeHtmlSimples:s=>String(s).replace(/</g,'&lt;'),_novoPdf:()=>doc,_pdfArmHeader:()=>20,_hexParaRgb:()=>[0,0,100],_tenantArmazem:()=> 'admin',_moradaCompletaObra:()=> 'Morada',obterNomeFuncionario:id=>id,obterNomeCliente:()=> 'Cliente',_estadoBadgeObra:()=>{},getDataHoje:()=> '2026-10-28',_kmPercorridosObra:()=>0,_tgGuardarPdf:()=>{},_hoje10:()=> '2026-10-28'});
 vm.runInContext(['_horasObraPorFuncionario','_horasContabilizadasObraPorPessoa','totalHorasObra','_custoHoraPessoa','_custosContabilizadosObra','gerarReportFinalObra','_renderizarFinanceiroObra'].map(fn).join('\n'),ctx);
 return {ctx,data,tables,screen,texts,setMaterials:x=>materials=x};
}
test('historic OS-only and direct sheets yield 42.5h in total, costs and final PDF table, without duplicate clock time',()=>{
 const {ctx,data,tables}=setup();const before=JSON.stringify(data);assert.equal(ctx.totalHorasObra('w'),42.5);
 const result=ctx._custosContabilizadosObra('w');assert.deepEqual(JSON.parse(JSON.stringify(result.linhas.map(x=>x.horas))),[16,15.6,10.9]);
 ctx.gerarReportFinalObra('w',false);
 const costs=tables.find(t=>t.head?.[0].includes('Horas contabilizadas'));assert.deepEqual(JSON.parse(JSON.stringify(costs.body.map(r=>r[1]))),['16.0h','15.6h','10.9h','42.5h']);
 const last=tables.at(-1);assert.deepEqual(JSON.parse(JSON.stringify(last.body.map(r=>r[1]))),['16.0h','15.6h','10.9h','42.5h']);assert.equal(JSON.stringify(data),before,'Recalculation must not rewrite historic records');
});
test('missing individual and material costs remain explicit subtotals with no invented margin',()=>{
 const {ctx,tables,screen}=setup(),r=ctx._custosContabilizadosObra('w');assert.equal(r.maoDeObra,null);assert.equal(r.total,null);assert.equal(r.semCusto.length,2);assert.equal(r.semPreco.length,1);assert(r.subtotalPessoal>62&&r.subtotalPessoal<64);
 ctx.gerarReportFinalObra('w',false);const fin=tables.find(t=>t.body?.some(r=>r[0]==='Valor faturado')).body;
 assert(fin.some(r=>r.includes('Total incompleto — faltam custos')));assert(!fin.some(r=>String(r[0]).startsWith('Margem')));assert(fin.some(r=>String(r[1]).includes('Mario, Luís')));
 const costs=tables.find(t=>t.head?.[0].includes('Horas contabilizadas'));assert.equal(costs.body.at(-1)[0],'SUBTOTAL — INCOMPLETO');
 ctx._renderizarFinanceiroObra('w');assert.match(screen.innerHTML,/Total incompleto/);assert.match(screen.innerHTML,/Subtotal mão de obra/);assert.match(screen.innerHTML,/Espelho/);
});
test('admin and supervisor rates are resolved within the tenant; configured work rate fills missing individual rates',()=>{
 const {ctx,data,setMaterials,screen}=setup();data.administradores.find(x=>x.id==='m').ordenadoBruto=2000;data.administradores.find(x=>x.id==='m').horasSemanais=40;data.encarregados[0].ordenadoBruto=1500;data.encarregados[0].horasSemanais=40;
 setMaterials([{artigo:'Material',cons:1,precoUnit:277.96,valorConsumido:277.96}]);let r=ctx._custosContabilizadosObra('w');assert.equal(r.completo,true);assert.equal(r.total,Math.round((r.subtotalPessoal+277.96)*100)/100);assert(r.linhas.every(x=>x.origem==='Ficha da pessoa'));
 ctx._renderizarFinanceiroObra('w');assert(!screen.innerHTML.includes('Total incompleto'));assert(screen.innerHTML.includes(ctx._finEur(r.total)));
 delete data.encarregados[0].ordenadoBruto;data.obras[0].custoHora=12;r=ctx._custosContabilizadosObra('w');const l=r.linhas.find(x=>x.id==='l');assert.equal(l.taxa,12);assert.equal(l.origem,'Custo/hora da obra');assert.equal(l.custo,187.2);assert.equal(r.completo,true);
 data.encarregados[0].adminId='foreign';assert.equal(ctx._custoHoraPessoa('l','admin'),null);
});
test('foreign tenant time, invalid salaries and unused unpriced materials cannot corrupt costs',()=>{
 const {ctx,data,setMaterials}=setup();data.folhasObra.push({id:'bad',adminId:'foreign',obraId:'w',funcionarioId:'b',descricao:'Other',horasTrabalhadas:999});data.ponto.push({adminId:'foreign',servicoId:'os',funcionarioId:'outsider',entrada:'00:00',saida:'23:00'});assert.equal(ctx.totalHorasObra('w'),42.5);
 for(const invalid of [-1000,'NaN',Infinity]){data.funcionarios[0].ordenadoBruto=invalid;assert.equal(ctx._custoHoraPessoa('b','admin'),null)}
 data.obras[0].custoHora=0;setMaterials([{artigo:'Planeado',prev:5,cons:0,precoUnit:null}]);const r=ctx._custosContabilizadosObra('w');assert.equal(r.semPreco.length,0);assert.equal(r.total,0);
});
test('client PDFs keep the same hours and never expose salaries, rates, costs or missing-cost warnings',()=>{
 const {ctx,tables,texts}=setup();ctx.gerarReportFinalObra('w',true);const output=JSON.stringify({tables,texts});assert(!/Custo\/hora|Subtotal|Custo em falta|Custo de mão|Ficha da pessoa|62\.93/.test(output));assert.equal(tables.at(-1).body.at(-1)[1],'42.5h');
});
