const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const code=fs.readFileSync('tg-os-photos.js','utf8');
function setup({role='funcionario',assigned=true,tenant='tenant'}={}){
 let modal=null;
 const document={
  getElementById(id){
   if(id==='tg-os-photo-gallery')return {replaceChildren(){}};
   if(id==='tg-os-photo-count')return {textContent:''};
   return null;
  },
  createElement(){
   return {
    style:{},innerHTML:'',listeners:{},
    addEventListener(event,handler){this.listeners[event]=handler},
    querySelector(){return {addEventListener(){},focus(){}}},
    remove(){modal=null},
    setAttribute(){}
   };
  },
  body:{append(element){modal=element}},
  addEventListener(){}
 };
 const user={id:role==='admin'?'tenant':'technician',adminId:'tenant',role};
 const dados={servicos:[{id:'os',adminId:tenant,funcionariosIds:assigned?['technician']:['someone-else'],tiposTrabalho:[],fotos:[]}],encarregados:[]};
 const w={};vm.runInNewContext(code,{window:w,document,usuarioLogado:user,dados,console});
 return {w,getModal:()=>modal};
}
test('OS photos do not require any report or specialty work type',()=>{
 const {w,getModal}=setup();assert.equal(w.TGOSPhotos.open('os'),true);
 assert.match(getModal().innerHTML,/Tirar fotografia/);
 assert.match(getModal().innerHTML,/Escolher da galeria/);
 assert.match(getModal().innerHTML,/sem ser necessário criar relatórios/);
});
test('unassigned technicians and other tenant OS cannot open photo gallery',()=>{
 for(const [label,opts] of [
  ['unassigned',{assigned:false}],
  ['foreign',{tenant:'different-tenant'}],
 ]){
  const {w,getModal}=setup(opts);
  assert.equal(w.TGOSPhotos.open('os'),false,label);
  assert.equal(getModal(),null,label);
 }
});
test('tenant administrator can access own OS photos',()=>{
 const {w,getModal}=setup({role:'admin'});
 assert.equal(w.TGOSPhotos.open('os'),true);
 assert(getModal());
});
test('uploads use private tenant folder and scoped OS update rather than reports',()=>{
 assert.match(code,/const BUCKET='relatorios-especialidade'/);
 assert.match(code,/context\.tenant\+'\/os\/'\+context\.id/);
 assert.match(code,/supa\.from\('servicos'\)\.update\(\{fotos:updated\}\)/);
 assert.doesNotMatch(code,/from\('relatorios_especialidade'\)/);
 assert.match(code,/if\(!stored\)try\{await storage\.remove/);
});

test('photo dialog keeps both camera and gallery actions and close control',()=>{
 const {w,getModal}=setup();
 assert.equal(w.TGOSPhotos.open('os'),true);
 const markup=getModal().innerHTML;
 assert.match(markup,/tg-os-photo-dialog/);
 assert.match(markup,/data-photo-source="camera"/);
 assert.match(markup,/data-photo-source="gallery"/);
 assert.match(markup,/data-photo-close/);
});
test('native OS photo button is routed only after matching an authorized OS number',()=>{
 assert.match(code,/osFromNativePhotoButton/);
 assert.match(code,/os\.numeroRegisto===number&&osFor\(os\.id\)/);
 assert.match(code,/if\(!os\)return;/);
 assert.match(code,/event\.stopImmediatePropagation\(\)/);
});
