const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('app-principal.js','utf8');
const fn=name=>src.match(new RegExp('        (?:async )?function '+name+'\\([^]*?\\n        \\}'))[0];
function setup(){
 const c={console,window:null,TIPOS_ESPECIALIDADE:['REX','RBI','RSI','RCM','RIE','RCP','RCCTV','RIN','RDI','RAVAC','RLIM','RELE'],dados:{servicos:[],relatoriosEspecialidade:[],ponto:[],obraPontoLonga:[],obras:[]},document:{addEventListener(){}},opened:[],completed:[],confirm:()=>true,usuarioLogado:{role:'admin'},_gerarPDFRelatorioOS(){},_concluirOS(os){c.completed.push(os.id);os.status='concluído';},escapeHtmlSimples:s=>String(s),obterNomeFuncionario:()=> 'Técnico',obterNomeCliente:()=> 'Cliente',_kmPercorridosOS:()=>0,_tempoAcumuladoServicoHTML:()=>''};
 c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync('tg-equipment-reports.js','utf8'),c);
 for(const name of ['_tiposEspecialidadePendentes','_requisitosEspecialidadePorIniciar','_tiposEspecialidadePorIniciar','_osComRelatoriosPorTerminar','abrirFilaRelatoriosEspecialidade','finalizarEGerarReportOS','_acaoPendenciasAlerta','_htmlResumoEquipaHoje'])vm.runInContext(fn(name),c);
 c._abrirModalRelatorioEspecialidade=(id,tipo,cb,equipamentoId)=>c.opened.push({id,tipo,cb,equipamentoId});return c;
}
for(const tipo of ['REX','RBI','RSI','RCM','RIE','RCP','RCCTV','RIN','RDI','RAVAC','RLIM','RELE','TRSI','TRSM','CUSTOM'])test(tipo+': saved draft allows OS completion while pending until report completion',()=>{
 const c=setup(),os={id:'os',adminId:'a',status:'em andamento',tiposTrabalho:[tipo],data:'2026-11-01'};c.dados.servicos.push(os);
 c.dados.relatoriosEspecialidade.push({id:'draft',adminId:'a',servicoId:'os',tipo,rascunho:true,assinaturaCliente:'signature'});
 c.finalizarEGerarReportOS('os');assert.equal(os.status,'concluído');assert.equal(c.opened.length,0);assert.equal(c._osComRelatoriosPorTerminar('a').length,1);
 assert.match(c._htmlResumoEquipaHoje('a','2026-11-02'),/OS com relatórios por terminar/);assert.equal(c.dados.relatoriosEspecialidade[0].assinaturaCliente,'signature');
 c.dados.relatoriosEspecialidade[0].rascunho=false;assert.equal(c._osComRelatoriosPorTerminar('a').length,0);assert.equal(os.status,'concluído');
});
test('queue saves draft for each equipment, ignores foreign drafts, and never loops on saved drafts',()=>{
 const c=setup(),os={id:'os',adminId:'a',status:'em andamento',planoManutencao:{relatoriosEquipamentos:[{tipo:'REX',equipamentoId:'e1'},{tipo:'REX',equipamentoId:'e2'}]}};c.dados.servicos.push(os);
 c.dados.relatoriosEspecialidade.push({adminId:'other',servicoId:'os',tipo:'REX',campos:{equipamentoId:'e1'},rascunho:true});let done=0;c.abrirFilaRelatoriosEspecialidade('os',[],()=>done++);
 assert.equal(c.opened.at(-1).equipamentoId,'e1');c.opened.at(-1).cb();assert.equal(done,0);assert.equal(c.opened.length,1);
 for(const equipment of ['e1','e2']){assert.equal(c.opened.at(-1).equipamentoId,equipment);c.dados.relatoriosEspecialidade.push({adminId:'a',servicoId:'os',tipo:'REX',rascunho:true,campos:{equipamentoId:equipment}});c.opened.at(-1).cb();}
 assert.equal(done,1);assert.equal(c.opened.length,2);assert.equal(c._tiposEspecialidadePendentes('os').length,2);assert.equal(c._tiposEspecialidadePorIniciar('os').length,0);assert.equal(c._osComRelatoriosPorTerminar('other').length,0);
});
test('fallback without equipment module accepts draft and completed OS remains pending for missing reports',()=>{
 const c=setup();delete c.TGEquipmentReports;const os={id:'os',adminId:'a',status:'concluído',tiposTrabalho:['RIN']};c.dados.servicos.push(os);assert.equal(c._osComRelatoriosPorTerminar('a').length,1);assert.equal(c._tiposEspecialidadePorIniciar('os').length,1);
 c.dados.relatoriosEspecialidade.push({adminId:'a',servicoId:'os',tipo:'RIN',rascunho:true});assert.equal(c._tiposEspecialidadePorIniciar('os').length,0);assert.equal(c._tiposEspecialidadePendentes('os').length,1);
});

test('explicit SCIE terms participate in normal OS report queue without being duplicated',()=>{
 const c=setup();
 assert.equal(c.TIPOS_ESPECIALIDADE.filter(x=>x==='TRSI').length,1);
 assert.equal(c.TIPOS_ESPECIALIDADE.filter(x=>x==='TRSM').length,1);
 const os={id:'os2',adminId:'a',status:'concluído',tiposTrabalho:['TRSI','TRSM']};
 c.dados.servicos.push(os);
 delete c.TGEquipmentReports;
 assert.equal(c._tiposEspecialidadePorIniciar('os2').length,2);
 c.dados.relatoriosEspecialidade.push({adminId:'a',servicoId:'os2',tipo:'TRSI',rascunho:true});
 assert.equal(c._tiposEspecialidadePorIniciar('os2').length,1);
 assert.equal(c._osComRelatoriosPorTerminar('a').length,1);
});
