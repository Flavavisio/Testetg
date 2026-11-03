const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app-principal.js','utf8');
const fn=name=>source.match(new RegExp('        (?:async )?function '+name+'\\([^]*?\\n        \\}'))[0];
const own=x=>({adminId:'a',...x});
const clock=(id,person,date,entry,exit,extra={})=>own({id,funcionarioId:person,data:date,entrada:entry,saida:exit,...extra});
const sheet=(id,person,date,hours,extra={})=>own({id,funcionarioId:person,data:date,horasTrabalhadas:hours,descricao:'Trabalho',obraId:'w',...extra});
const plain=x=>JSON.parse(JSON.stringify(x));
function setup(extra={}){
 class Now extends Date {constructor(...args){super(...(args.length?args:['2026-11-03T17:00:00']));}}
 const dados={obras:[own({id:'w',nome:'Obra',valor:1000})],servicos:[own({id:'os',obraId:'w'})],funcionarios:[own({id:'r',nome:'Responsável',ordenadoBruto:1732,horasSemanais:40}),own({id:'f',nome:'Colega',ordenadoBruto:2078.4,horasSemanais:40})],encarregados:[],administradores:[],folhasObra:[],obraPontoLonga:[],ponto:[],...extra};
 const tables=[],texts=[],screen={innerHTML:''};
 const doc={lastAutoTable:{finalY:20},setFontSize(){},setTextColor(){},text(t){texts.push(t)},addPage(){},autoTable(o){tables.push(o);this.lastAutoTable={finalY:(o.startY||20)+20}}};
 const context={dados,Date:Now,getDataHoje:()=> '2026-11-03',_folhasSuspeitasUltimoCalculo:[],usuarioLogado:{id:'a',role:'admin'},document:{getElementById:()=>screen},_obraMatRows:()=>[],_finEur:n=>Number(n).toFixed(2)+' €',escapeHtmlSimples:s=>String(s).replace(/</g,'&lt;'),_novoPdf:()=>doc,_pdfArmHeader:()=>20,_hexParaRgb:()=>[0,0,100],_tenantArmazem:()=> 'a',_moradaCompletaObra:()=> 'Morada',obterNomeFuncionario:id=>id,obterNomeCliente:()=> 'Cliente',_estadoBadgeObra:()=>{},_kmPercorridosObra:()=>0,_tgGuardarPdf:()=>{},_hoje10:()=> '2026-11-03'};
 const ctx=vm.createContext(context);
 vm.runInContext(['_somarIntervalosPicagem','_horasObraPorFuncionario','_horasContabilizadasObraPorPessoa','_horasObraPorFuncionarioNoPeriodo','totalHorasObra','_custoHoraPessoa','_custosContabilizadosObra','gerarReportFinalObra','_renderizarFinanceiroObra'].map(fn).join('\n'),ctx);
 return {ctx,dados,tables,texts,screen};
}
test('kiosk morning and afternoon count for responsible and colleague, without adding the afternoon sheet again',()=>{
 const ponto=['r','f'].flatMap(p=>[clock(p+'am',p,'2026-11-02','08:00','12:00',{servicoId:'os'}),clock(p+'pm',p,'2026-11-02','13:00','17:00',{servicoId:'os'})]);
 const {ctx}=setup({ponto,folhasObra:[sheet('afternoon','r','2026-11-02',4,{servicoId:'os',obraId:null,origem:'quiosque_agenda_responsavel'})]});
 assert.deepEqual(plain(ctx._horasContabilizadasObraPorPessoa('w')),{r:8,f:8});
 const c=ctx._custosContabilizadosObra('w');assert.equal(c.horas,16);assert.equal(c.maoDeObra,176);assert.equal(c.total,176);
});
test('direct work clocks count for colleagues with no sheets and for closed lunch sessions',()=>{
 const {ctx}=setup({obraPontoLonga:[clock('am','f','2026-11-02','08:00','12:00',{obraId:'w',motivoSaida:'almoco'}),clock('pm','f','2026-11-02','13:00','17:00',{obraId:'w'})]});
 assert.equal(ctx.totalHorasObra('w'),8);
});
test('a sheet on one day never hides clocks on another day',()=>{
 const {ctx}=setup({folhasObra:[sheet('old','r','2026-10-30',8)],ponto:[clock('new','r','2026-11-02','08:00','12:00',{servicoId:'os'})]});
 assert.equal(ctx.totalHorasObra('w'),12);
});
test('complete daily clock history overrides erroneous or cumulative sheets, without rewriting them',()=>{
 const {ctx,dados}=setup({folhasObra:[sheet('wrong','r','2026-11-02',12.9),sheet('duplicate','r','2026-11-02',4)],ponto:[clock('am','r','2026-11-02','10:55','12:55',{servicoId:'os'}),clock('pm','r','2026-11-02','14:19','17:12',{servicoId:'os'})]});
 const before=JSON.stringify(dados);assert.equal(ctx.totalHorasObra('w'),293/60);assert.equal(JSON.stringify(dados),before);
});
test('overlapping and duplicate intervals across OS and direct work count only once',()=>{
 const {ctx}=setup({ponto:[clock('1','f','2026-11-02','14:29','17:25',{servicoId:'os'}),clock('2','f','2026-11-02','14:29','17:48',{servicoId:'os'})],obraPontoLonga:[clock('3','f','2026-11-02','16:00','18:00',{obraId:'w'})]});
 assert.equal(ctx.totalHorasObra('w'),3+31/60);
});
test('today open session counts with the morning; stale open sessions never grow using another day clock',()=>{
 const {ctx}=setup({obraPontoLonga:[clock('am','r','2026-11-03','08:00','12:00',{obraId:'w'}),clock('pm','r','2026-11-03','13:00',null,{obraId:'w'}),clock('stale','f','2026-11-02','08:00',null,{obraId:'w'})],folhasObra:[sheet('am','r','2026-11-03',4)]});
 assert.deepEqual(plain(ctx._horasContabilizadasObraPorPessoa('w')),{r:8,f:0});
});
test('period boundaries match the work ledger; historic OS-only sheets remain included',()=>{
 const {ctx}=setup({ponto:[clock('1','r','2026-11-02','08:00','12:00',{servicoId:'os'})],folhasObra:[sheet('old','r','2026-10-30',8,{obraId:null,servicoId:'os'})]});
 assert.equal(ctx.totalHorasObra('w'),12);
 assert.deepEqual(plain(ctx._horasObraPorFuncionarioNoPeriodo('w','2026-10-30','2026-11-02')),{r:4});
 assert.deepEqual(plain(ctx._horasObraPorFuncionarioNoPeriodo('w',null,'2026-10-30')),{r:8});
});
test('general attendance, lunch intervals, invalid clocks and another tenant cannot add hours',()=>{
 const {ctx}=setup({ponto:[clock('general','r','2026-11-02','07:00','19:00'),clock('good','r','2026-11-02','08:00','12:00',{servicoId:'os'}),clock('lunch','r','2026-11-02','12:00','13:00',{servicoId:'os',pausaAlmoco:true}),clock('bad','r','2026-11-02','17:00','08:00',{servicoId:'os'}),clock('foreign','r','2026-11-02','00:00','23:00',{servicoId:'os',adminId:'other'})],folhasObra:[sheet('foreign','r','2026-11-01',99,{adminId:'other'})]});
 assert.equal(ctx.totalHorasObra('w'),4);
});
test('Financeiro, PDF summary and both per-person PDF tables consume the same recalculation and costs',()=>{
 const {ctx,tables,screen}=setup({ponto:[clock('1','r','2026-11-02','08:00','12:00',{servicoId:'os'}),clock('2','f','2026-11-02','08:00','12:00',{servicoId:'os'})],folhasObra:[sheet('wrong','r','2026-11-02',15)]});
 ctx._renderizarFinanceiroObra('w');assert.match(screen.innerHTML,/8\.00h/);assert.match(screen.innerHTML,/88\.00 €/);assert.match(screen.innerHTML,/Responsável/);assert.match(screen.innerHTML,/Colega/);
 ctx.gerarReportFinalObra('w',false);
 assert.equal(tables.find(t=>t.body?.some(r=>r[0]==='Total de horas trabalhadas')).body.find(r=>r[0]==='Total de horas trabalhadas')[1],'8.00h');
 const cost=tables.find(t=>t.head?.[0].includes('Horas contabilizadas')).body;assert.equal(cost.at(-1)[1],'8.00h');assert.equal(cost.at(-1)[4],'88.00 €');
 assert.equal(tables.at(-1).body.at(-1)[1],'8.00h');
});
test('missing salary is explicit, weekly-hours errors cannot silently produce a zero total, and current salary edits recalculate',()=>{
 const {ctx,dados}=setup({ponto:[clock('1','r','2026-11-02','08:00','12:00',{servicoId:'os'})]});
 assert.equal(ctx._custosContabilizadosObra('w').total,40);dados.funcionarios[0].ordenadoBruto=3464;assert.equal(ctx._custosContabilizadosObra('w').total,80);
 dados.funcionarios[0].horasSemanais=null;let c=ctx._custosContabilizadosObra('w');assert.equal(c.total,null);assert.match(c.avisos.join(' '),/Responsável/);
 dados.obras[0].custoHora=15;assert.equal(ctx._custosContabilizadosObra('w').total,60);
});
test('kiosk responsible sheet stores the whole working day after lunch and does not count another person or tenant',async()=>{
 const {ctx,dados}=setup({ponto:[clock('am','r','2026-11-03','08:00','12:00',{servicoId:'os'}),clock('pm','r','2026-11-03','13:00',null,{servicoId:'os'}),clock('other','f','2026-11-03','08:00',null,{servicoId:'os'}),clock('foreign','r','2026-11-03','00:00',null,{servicoId:'os',adminId:'other'})]});
 Object.assign(ctx,{_quiosqueAgendaSessaoAtual:{id:'os',tipo:'servico'},_quiosqueAgendaPessoaSelecionada:{id:'r'},_tenantQuiosque:()=> 'a',_quiosqueAgendaMateriaisTemp:[],_quiosqueAgendaAberto:()=>dados.ponto[1],document:{getElementById:()=>({value:'Trabalho concluído'})},gerarId:()=> 'new-sheet',guardarDados:()=>{},_quiosqueObterLocalizacaoAgora:async()=>null,_quiosqueAgendaFecharSaida:()=>{dados.ponto[1].saida='17:00'},alert:msg=>assert.fail(msg)});
 vm.runInContext(fn('_quiosqueAgendaConfirmarFolha'),ctx);await ctx._quiosqueAgendaConfirmarFolha('terminar_hoje');
 assert.equal(dados.folhasObra[0].horasTrabalhadas,8);assert.equal(ctx.totalHorasObra('w'),17);
});
test('creating a supervisor preserves the entered salary and uses it in the work cost calculation',async()=>{
 const {ctx,dados}=setup();
 const values={f_nome:'Supervisor teste',f_cargo:'Encarregado',f_telefone:'',f_email:'',f_senha:'',f_morada:'Rua',f_cp:'',f_nasc:'',f_horas:'40',f_role_tipo:'encarregado',f_ordenado:'1732'};
 Object.assign(ctx,{entidadeAtual:'funcionario',idEditando:null,document:{getElementById:id=>id in values?{value:values[id]}:null,querySelectorAll:()=>[]},usuarioLogado:{id:'a',role:'admin'},verificarLimiteFuncionarios:()=>({permitido:true}),gerarId:()=> 'supervisor',guardarDados:()=>{},registarAuditoria:()=>{},fecharModal:()=>{},renderizarTudo:()=>{}});
 vm.runInContext(fn('_salvarFormularioInterno'),ctx);await ctx._salvarFormularioInterno({});
 assert.equal(dados.encarregados[0].ordenadoBruto,'1732');assert.equal(ctx._custoHoraPessoa('supervisor','a'),10);
 dados.obraPontoLonga.push(clock('supervisor','supervisor','2026-11-02','08:00','12:00',{obraId:'w'}));assert.equal(ctx._custosContabilizadosObra('w').total,40);
});
test('anonymized historic bastidor example: overlaps, inflated sheets and missing days yield 22h33 and explicit incomplete costs',()=>{
 const {ctx,dados}=setup({folhasObra:[sheet('r1','r','2026-10-25',0.03),sheet('r2','r','2026-10-25',5),sheet('r3','r','2026-10-25',11),sheet('f1','f','2026-10-21',2.7),sheet('f2','f','2026-10-22',12.9)],ponto:[
  clock('r1','r','2026-10-24','14:00','19:00',{servicoId:'os'}),clock('r2','r','2026-10-25','09:30','11:30',{servicoId:'os'}),
  clock('f1','f','2026-10-21','14:29','17:11',{servicoId:'os'}),clock('f2','f','2026-10-22','10:55','12:55',{servicoId:'os'}),clock('f3','f','2026-10-22','14:19','17:12',{servicoId:'os'}),
  clock('b1','b','2026-10-21','14:29','17:25',{servicoId:'os'}),clock('b2','b','2026-10-21','14:29','17:48',{servicoId:'os'}),clock('b3','b','2026-10-22','10:55','12:55',{servicoId:'os'}),clock('b4','b','2026-10-22','14:19','16:58',{servicoId:'os'})]});
 dados.funcionarios[0].ordenadoBruto=null;dados.funcionarios[1].ordenadoBruto=1100;dados.funcionarios.push(own({id:'b',nome:'Técnico',ordenadoBruto:1000,horasSemanais:40}));
 const before=JSON.stringify(dados),cost=ctx._custosContabilizadosObra('w');assert.equal(cost.horas,22.55);assert.equal(cost.subtotalPessoal,94.16);assert.equal(cost.total,null);assert.equal(cost.semCusto.length,1);
 assert(cost.avisos.some(x=>x.includes('12.90h')));assert(cost.avisos.some(x=>x.includes('Responsável')));assert.equal(JSON.stringify(dados),before);
});
