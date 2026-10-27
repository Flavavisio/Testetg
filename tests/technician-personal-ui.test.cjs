const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync('tg-technician.js','utf8');
function setup(){
 const w=new JSDOM(`<div id="cardsGrid"><div class="card-principal" data-card="servicos"></div></div><div id="modalGenericoOverlay"><h2 id="modalGenericoTitulo"></h2><form id="modalGenericoForm"><div id="modalGenericoCampos"></div><div class="modal-actions"><button class="btn-success">Guardar</button></div></form></div><div id="modalOverlay" class="open"><form id="modalForm"><div id="modalCampos"><div class="form-group"><textarea id="fo_descricao" required style="font-size:12px!important">Trabalho já escrito</textarea></div><div class="form-group"><input id="fo_data" type="date" value="2026-10-27" style="font-size:14px"></div><div class="form-group"><input id="check" type="checkbox"></div></div><button id="modalSubmitBtn">Guardar</button></form></div>`,{url:'https://example.com/Testetg/login.html',runScripts:'outside-only'}).window;
 w.innerWidth=390;w.usuarioLogado={id:'f',adminId:'a',role:'funcionario',nome:'Vanda Ribeiro'};
 w.dados={funcionarios:[{id:'f',adminId:'a',nome:'Vanda Ribeiro'}],encarregados:[],servicos:[{id:'os',adminId:'a',funcionariosIds:['f'],data:'2026-10-27',clienteId:'c',localId:'l',descricao:'Serviço'}],clientes:[{id:'c',adminId:'a',nome:'Cliente'}],ponto:[],obras:[],obraPontoLonga:[]};
 Object.assign(w,{expressAtivo:()=>false,adminDoUtilizador:()=>({id:'a'}),_licencaValidaTenant:()=>true,getDataHoje:()=> '2026-10-27',_pausaAlmocoPendente:()=>null});
 w.allowed=true;w.opened=[];w.TGPassport={scope:(c,l)=>w.allowed?{customerId:c,localId:l}:null,open:(...args)=>w.opened.push(args)};
 const instrumented=source.replace('window.TGTechnician={refresh,jobs,todayJobs,weekJobs,enabled};refresh();','window.TGTechnician={jobs,avatarHTML,notes,openPassport,protectFieldFont,installWizard,removeWizard,wizards};');
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
 for(const file of ['index.html','login.html']){const html=fs.readFileSync(file,'utf8');assert(html.includes('tg-technician.js?v=1.4.0-teste'));assert(html.includes('tg-technician.css?v=1.4.0-teste'));assert(html.includes('responsive-device.css?v=3'));assert(!html.includes('user-scalable=no'));}
});
