const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('tg-dashboard-live-test.js','utf8');
const day='2026-11-12';
function environment(){
    const data={funcionarios:[{id:'e',adminId:'a'}],encarregados:[],
        servicos:[{id:'os',adminId:'a',numeroRegisto:'123',status:'em andamento'}],
        obras:[],ponto:[],obraPontoLonga:[]};
    const window={addEventListener(){}};
    const document={addEventListener(){},getElementById(){return null;}};
    const load=new Function('window','document','setInterval','usuarioLogado','dados','getDataHoje',source+';return window.TGTestLiveStatus;');
    const api=load(window,document,()=>{}, {id:'a',role:'admin'},data,()=>day);
    return {api,data,context:{tenant:'a',date:day,data}};
}
const record=(id,props={})=>({id,adminId:'a',funcionarioId:'e',servicoId:'os',data:day,entrada:'09:00',saida:null,...props});
test('Dashboard: OS follows real work events without writing OS status',()=>{
    const {api,data,context}=environment();
    data.ponto.push(record('session'));
    assert.equal(api.osState(data.servicos[0],context).label,'Em curso');
    data.ponto[0].saida='10:00';data.ponto[0].motivoSaida='pausa';
    assert.equal(api.osState(data.servicos[0],context).label,'Em pausa');
    data.ponto.push(record('returned',{entrada:'11:00'}));
    assert.equal(api.osState(data.servicos[0],context).label,'Em curso');
    data.ponto[1].saida='12:00';
    assert.equal(api.osState(data.servicos[0],context).label,'Terminado por hoje');
    data.servicos[0].status='concluído';
    assert.equal(api.osState(data.servicos[0],context).label,'Concluída');
});
test('Equipa Agora: active OS, lunch, return and end of day',()=>{
    const {api,data,context}=environment();
    data.ponto.push(record('g1',{servicoId:null,entrada:'08:00'}));
    data.ponto.push(record('os1',{entrada:'09:00'}));
    assert.match(api.personState('e',context).label,/Em serviço na OS #123/);
    data.ponto[1].saida='10:00';data.ponto[1].motivoSaida='pausa';
    data.ponto[0].saida='10:05';data.ponto[0].pausaAlmoco=true;
    assert.equal(api.personState('e',context).label,'Em almoço');
    data.ponto.push(record('g2',{servicoId:null,entrada:'11:00'}));
    assert.equal(api.personState('e',context).label,'Intervenção em pausa');
    data.ponto[2].saida='14:00';
    assert.equal(api.personState('e',context).label,'Saiu do serviço');
});
test('Other tenants never affect status and no clock does not mark absence',()=>{
    const {api,data,context}=environment();
    assert.equal(api.personState('e',context),null);
    data.ponto.push(record('foreign',{adminId:'b'}));
    assert.equal(api.personState('e',context),null);
    assert.equal(api.osState({id:'foreign',adminId:'b',status:'concluído'},context),null);
});
