const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync('tg-technician.js','utf8');
function setup(){
 const w=new JSDOM(`<div id="cardsGrid"><div class="card-principal" data-card="servicos"></div></div><div id="modalGenericoOverlay"><h2 id="modalGenericoTitulo"></h2><form id="modalGenericoForm"><div id="modalGenericoCampos"></div><div class="modal-actions"><button class="btn-success">Guardar</button></div></form></div><div id="modalOverlay" class="open"><form id="modalForm"><div id="modalCampos"><div class="form-group"><textarea id="fo_descricao" required style="font-size:12px!important">Trabalho já escrito</textarea></div><div class="form-group"><input id="fo_data" type="date" value="2026-10-27" style="font-size:14px"></div><div class="form-group"><input id="check" type="checkbox"></div></div><button id="modalSubmitBtn">Guardar</button></form></div>`,{url:'https://example.com/Testetg/login.html',runScripts:'outside-only'}).window;
 w.innerWidth=390;w.usuarioLogado={id:'f',adminId:'a',role:'funcionario',nome:'Vanda Ribeiro'};
 w.dados={funcionarios:[{id:'f',adminId:'a',nome:'Vanda Ribeiro'}],encarregados:[],servicos:[{id:'os',adminId:'a',funcionariosIds:['f'],data:'2026-10-27',clienteId:'c',localId:'l',descricao:'Serviço'}],clientes:[{id:'c',adminId:'a',nome:'Cliente'}],ponto:[],obras:[],obraPontoLonga:[]};
 Object.assign(w,{expressAtivo:()=>false,adminDoUtilizador:()=>({id:'a'}),_licencaValidaTenant:()=>true,getDataHoje:()=> '2026-10-27',_pausaAlmocoPendente:()=>null});
 w.entryCalls=[];w.errors=[];w.picarPontoOS=(...args)=>w.entryCalls.push(args);w.mostrarErro=msg=>w.errors.push(msg);
 w.allowed=true;w.opened=[];w.TGPassport={scope:(c,l)=>w.allowed?{customerId:c,localId:l}:null,open:(...args)=>w.opened.push(args)};
 const instrumented=source.replace('window.TGTechnician={refresh,jobs,todayJobs,weekJobs,enabled};refresh();','window.TGTechnician={refresh,home,workList,worksList,more,enabled,jobs,focusHTML,avatarHTML,notes,openPassport,protectFieldFont,installWizard,removeWizard,wizards};');
 assert.notEqual(source,instrumented);w.eval(instrumented);return w;
}
test('header uses first name and last surname initials, including accents and a single name',()=>{
 const w=setup();try{for(const [name,initials] of [['Vanda Ribeiro','VR'],['Flávio António da Rosa','FR'],['Álvaro Évora','ÁÉ'],['Vanda','V']]){w.dados.funcionarios[0].nome=name;const host=w.document.createElement('div');host.innerHTML=w.TGTechnician.avatarHTML();assert.equal(host.querySelector('[aria-hidden]').textContent,initials);assert.equal(host.querySelector('[role=img]').getAttribute('aria-label'),name);}}finally{w.close();}
});
test('photo failure reveals initials and hostile photo schemes cannot create an image',()=>{
 const w=setup();try{w.dados.funcionarios[0].foto='https://example.com/photo.jpg';w.document.body.insertAdjacentHTML('beforeend',w.TGTechnician.avatarHTML());const img=w.document.querySelector('[data-tgt-avatar]');assert(img);img.dispatchEvent(new w.Event('error'));assert(img.hidden);assert.equal(img.previousElementSibling.textContent,'VR');for(const unsafe of ['javascript:alert(1)','data:image/svg+xml,<svg onload=alert(1)>']){w.dados.funcionarios[0].foto=unsafe;assert(!w.TGTechnician.avatarHTML().includes('<img'));}}finally{w.close();}
});
test('avatar never reads another tenant profile or outputs raw profile markup',()=>{
 const w=setup();try{w.dados.funcionarios=[{id:'f',adminId:'other',nome:'Outra pessoa',foto:'https://example.com/private.jpg'}];assert(!w.TGTechnician.avatarHTML().includes('private.jpg'));w.usuarioLogado.nome='Vanda <img src=x>';const host=w.document.createElement('div');host.innerHTML=w.TGTechnician.avatarHTML();assert.equal(host.querySelector('img'),null);}finally{w.close();}
});
test('notes links to the exact assigned installation and rechecks access when opened',()=>{
 const w=setup();try{const job=w.TGTechnician.jobs()[0];w.TGTechnician.notes(job);const b=w.document.querySelector('[data-tgt-action=passport]');assert(b);assert(b.textContent.includes('Ver passaporte de instalação'));b.click();assert.deepEqual(w.opened,[['c','l']]);assert(!w.document.getElementById('modalGenericoOverlay').classList.contains('open'));w.allowed=false;w.TGTechnician.openPassport(job);assert.equal(w.opened.length,1);w.TGTechnician.notes(job);assert.equal(w.document.querySelector('[data-tgt-action=passport]'),null);}finally{w.close();}
});
test('worksheet fields are at least 16px before focus and restoration preserves text and native styles',()=>{
 const w=setup();try{w.TGTechnician.installWizard();const form=w.document.getElementById('modalForm'),wizard=w.TGTechnician.wizards.get(form);assert(wizard);const description=w.document.getElementById('fo_descricao');assert.equal(description.style.getPropertyValue('font-size'),'16px');assert.equal(description.style.getPropertyPriority('font-size'),'important');const dynamic=w.document.createElement('input');dynamic.style.fontSize='11px';wizard.pages[1].appendChild(dynamic);dynamic.dispatchEvent(new w.Event('pointerdown',{bubbles:true}));assert.equal(dynamic.style.fontSize,'16px');w.TGTechnician.removeWizard(wizard);assert.equal(description.value,'Trabalho já escrito');assert.equal(description.style.fontSize,'12px');assert.equal(description.style.getPropertyPriority('font-size'),'important');assert.equal(w.document.getElementById('fo_data').value,'2026-10-27');}finally{w.close();}
});
test('avatar, wizard scale correction and refreshed CSS are included in both app entry points',()=>{
 const css=fs.readFileSync('tg-technician.css','utf8');assert(css.includes('.tgt-avatar'));assert(css.includes('animation:none!important;transform:none!important'));assert(source.includes('${avatarHTML()}</header>'));
 for(const file of ['index.html','login.html']){const html=fs.readFileSync(file,'utf8');assert(html.includes('tg-technician.js?v=1.5.0-teste'));assert(html.includes('tg-technician.css?v=1.5.0-teste'));const responsive=html.match(/responsive-device\.css\?v=\d+/)?.[0];assert(responsive&&fs.readFileSync('sw.js','utf8').includes(responsive));assert(!html.includes('user-scalable=no'));}
});

test('the intervention toolbar opens the installation passport directly without a notes dialog',()=>{
 const w=setup();try{const job=w.TGTechnician.jobs()[0];job.open={entrada:'09:00',data:'2026-10-27'};const host=w.document.createElement('div');host.innerHTML=w.TGTechnician.focusHTML(job);w.document.body.append(host);const b=host.querySelector('[data-tgt-action=passport]');assert(b);assert(b.textContent.includes('Passaporte'));assert.equal(host.querySelector('[data-tgt-action=notes]'),null);b.click();assert.deepEqual(w.opened,[['c','l']]);assert(!w.document.getElementById('modalGenericoOverlay').classList.contains('open'));w.allowed=false;assert(!w.TGTechnician.focusHTML(job).includes('data-tgt-action="passport"'));}finally{w.close();}
});

test('employee has the same home, four navigation items, works and profile on phone and PC',()=>{
 const snapshots=[];
 for(const width of [390,1440]){const w=setup();try{
  w.innerWidth=width;w.document.getElementById('modalOverlay').classList.remove('open');
  w.document.getElementById('cardsGrid').insertAdjacentHTML('beforeend','<div id="omeudia"></div>'+['obras-longa','pedidos','folhas'].map(id=>'<div class="card-principal" data-card="'+id+'"></div>').join(''));
  w.document.body.insertAdjacentHTML('beforeend','<div id="menuInferiorMobile"></div><div id="painelGrupoMobile"><div id="painelGrupoMobileConteudo"></div></div>');
  Object.assign(w,{_fecharSecaoAbertaMobile(){},pontoAssiduidadeAtivo:()=>false,scrollTo(){}});
  w.dados.obras=[{id:'obra',adminId:'a',nome:'Obra atribuída',responsaveisIds:['f'],estado:'ativa'}];
  w.TGTechnician.refresh();w.eval(fs.readFileSync('tg-navigation.js','utf8'));w.TGNavigation.refresh();assert.equal(w.document.querySelectorAll('[data-tgn-nav]').length,0);assert(w.TGTechnician.enabled());assert(w.document.body.classList.contains('tgt-active'));
  const nav=[...w.document.querySelectorAll('[data-tgt-nav]')].map(b=>b.textContent.trim());assert.deepEqual(nav,['Hoje','Trabalhos','Obras','Perfil']);
  const home=w.document.getElementById('omeudia').innerHTML;
  w.TGTechnician.workList();const week=w.document.getElementById('painelGrupoMobileConteudo').innerHTML;
  w.TGTechnician.worksList();const works=w.document.getElementById('painelGrupoMobileConteudo').textContent;
  w.TGTechnician.more();const profile=w.document.getElementById('painelGrupoMobileConteudo').textContent;assert(profile.includes('Férias e faltas'));assert(profile.includes('As minhas folhas de obra'));
  snapshots.push({home,week,works,profile});
  w.picarPontoOS('os','entrada');assert.equal(w.entryCalls.length,1);w.dados.servicos[0].data='2026-10-28';w.picarPontoOS('os','entrada');assert.equal(w.entryCalls.length,1);assert.equal(w.errors.length,1);
 }finally{w.close();}}
 assert.deepEqual(snapshots[0],snapshots[1]);
});
test('desktop management roles keep their existing UI and Express remains separate',()=>{
 const w=setup();try{w.innerWidth=1440;for(const role of ['admin','subadmin','encarregado','cliente','superadmin']){w.usuarioLogado.role=role;assert.equal(w.TGTechnician.enabled(),false,role);}w.usuarioLogado.role='encarregado';w.innerWidth=390;assert(w.TGTechnician.enabled());w.usuarioLogado.role='funcionario';w.innerWidth=1440;assert(w.TGTechnician.enabled());w.expressAtivo=()=>true;assert.equal(w.TGTechnician.enabled(),false);}finally{w.close();}
});
