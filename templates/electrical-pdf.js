/* Fills the current four-page DGEG model; no certification or SRIESP submission. */
(function(root){
 'use strict';
 const layout=__ELECTRICAL_MAP__;
 const safeImage=s=>/^data:image\/(png|jpeg);base64,[a-z0-9+/=]+$/i.test(s||'');
 const clean=s=>String(s??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/Ω/g,'ohm').replace(/[φϕ]/g,'phi').replace(/Δ/g,'Delta').replace(/[−–—]/g,'-').replace(/[^\x20-\x7e\xa0-\xff\n\r\t]/g,'?');
 const bytes=s=>Uint8Array.from(atob(s.split(',').pop()),c=>c.charCodeAt(0));
 function wrap(text,font,size,width){
  const lines=[];
  for(const paragraph of clean(text).split(/\r?\n/)){
   let line='';for(const word of paragraph.split(/\s+/)){
    if(font.widthOfTextAtSize((line?line+' ':'')+word,size)<=width){line+=(line?' ':'')+word;continue;}
    if(line){lines.push(line);line='';}
    let part='';for(const char of word){if(part&&font.widthOfTextAtSize(part+char,size)>width){lines.push(part);part='';}part+=char;}line=part;
   }lines.push(line);
  }return lines;
 }
 let template,fontFiles;
 async function exportPDF(state,{final=false}={}){
  const rules=root.TGElectricalRules;if(!rules?.active(state))throw Error('Este relatório não usa o modelo de exploração DGEG.');
  if(!root.PDFLib)throw Error('A biblioteca PDF ainda não está disponível. Atualiza a aplicação.');
  if(final){const errors=rules.validate(state,true);if(errors.length)throw Error(errors.join(' '));}
  if(!template){const response=await fetch(new URL(layout.template,location.href).href,{cache:'force-cache'});if(!response.ok)throw Error('Não foi possível carregar o modelo DGEG. Mantém a app ligada para preparar a cache.');template=new Uint8Array(await response.arrayBuffer());}
  const {PDFDocument,rgb,degrees,setCharacterSpacing,setWordSpacing,setCharacterSqueeze}=root.PDFLib,doc=await PDFDocument.load(template.slice());
  if(!root.fontkit)throw Error('O módulo de fontes PDF ainda não está disponível. Atualiza a aplicação.');doc.registerFontkit(root.fontkit);
  if(!fontFiles)fontFiles=await Promise.all(['vendor/Vera.ttf','vendor/VeraBd.ttf'].map(async path=>{const r=await fetch(new URL(path,location.href).href,{cache:'force-cache'});if(!r.ok)throw Error('Não foi possível carregar as fontes do relatório.');return new Uint8Array(await r.arrayBuffer());}));
  const font=await doc.embedFont(fontFiles[0],{subset:true}),bold=await doc.embedFont(fontFiles[1],{subset:true}),pages=doc.getPages(),annexes=[];
  const resetText=page=>page.pushOperators(setCharacterSpacing(0),setWordSpacing(0),setCharacterSqueeze(100));pages.forEach(resetText);
  const v=k=>rules.value(state,k),labelFor=k=>k.replace(/_/g,' ');
  const decodedDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)?s.slice(8)+'/'+s.slice(5,7)+'/'+s.slice(0,4):s;
  const annex=(label,text)=>{const n=annexes.length+1;annexes.push({number:n,label,text:clean(text)});return 'Ver anexo '+n;};
  const drawBox=(field,text)=>{
   if(text==null||String(text)==='')return;
   const page=pages[field.page],width=field.width-3,height=field.height-2;let size=9,lines;
   while(size>=7){lines=wrap(text,font,size,width);if(lines.length*(size+1)<=height)break;size-=.5;}
   if(size<7){text=annex(field.label||labelFor(field.key),text);size=7;lines=wrap(text,font,size,width);}
   page.drawRectangle({x:field.x,y:page.getHeight()-field.top-field.height,width:field.width,height:field.height,color:rgb(1,1,1)});
   lines.forEach((line,i)=>page.drawText(line,{x:field.x+1,y:page.getHeight()-field.top-size-i*(size+1),size,font,color:rgb(0,0,0)}));
  };
  const checks=Object.keys(state.answers||{}).filter(k=>/^check_RELE_5_9_\d+$/.test(k));
  for(const field of layout.fields){
   if(field.key==='signature')continue;
   if(field.group&&v(field.group+'_app')!=='Sim')continue;
   if(field.earth){const unique=v(field.group+'_unique')==='Sim';if(unique!==(field.earth==='unique_earth'))continue;}
   let text=v(field.key);
   if(field.key.startsWith('check_')){const number=Number(field.key.slice(6)),answer=state.answers?.['check_RELE_5_9_'+(number-1)];text=({OK:'C',NOK:'NC','N/A':'NA'})[answer]||'';}
   if(field.key==='observations'){
    const notes=checks.map(id=>{const note=state.values?.['obs_'+id];return note?'6.'+(Number(id.split('_').pop())+1)+': '+note:'';}).filter(Boolean);
    text=[text,...notes,state.values?.['native-observations']].filter(Boolean).join('\n');
   }
   if(field.key.endsWith('_date')||['period_start','period_end','responsibility_start'].includes(field.key))text=decodedDate(text);
   if(field.choices)text=field.choices[text]||'';
   drawBox(field,text);
  }
  for(const [group,pos] of Object.entries(layout.groups))if(v(group+'_app')==='Não'){
   pages[pos.page].drawText('NA',{x:pos.x,y:pages[pos.page].getHeight()-pos.top-8,size:8,font:bold});
  }
  const signature=layout.fields.find(f=>f.key==='signature');if(safeImage(state.techSignature)){
   const image=state.techSignature.startsWith('data:image/png')?await doc.embedPng(bytes(state.techSignature)):await doc.embedJpg(bytes(state.techSignature));
   const scale=Math.min(signature.width/image.width,signature.height/image.height);pages[3].drawImage(image,{x:signature.x,y:pages[3].getHeight()-signature.top-signature.height,width:image.width*scale,height:image.height*scale});
  }
  pages[3].drawText(clean(v('tech_name')).slice(0,70),{x:325,y:pages[3].getHeight()-568,size:8,font});
  const details=[
   ['Inspeções efetuadas',v('visit_dates')],['Instrumentos e métodos',v('instruments')],['Registo no SRIESP',[v('submission'),v('sriesp')].filter(Boolean).join(' — ')],['Documentos anexos / arquivo',v('attachments')],
   ...['pt','soc','seg','bt'].map(g=>['Limitações — '+({pt:'PT / subestações',soc:'geradores de socorro',seg:'geradores de segurança',bt:'instalação BT'})[g],v(g+'_app')==='Sim'?v(g+'_limitations'):'']),
   ['Trabalhos efetuados',state.values?.['native-work']],['Materiais e peças',state.values?.['native-materials']]
  ].filter(([,text])=>text);
  details.forEach(([label,text])=>annex(label,text));
  const photoRows=(state.photos||[]).filter(p=>safeImage(p.src));
  const attached=Number(v('attachment_count')||0)+(annexes.length||photoRows.length?1:0);
  drawBox({key:'attachment_count',page:3,x:102,top:546,width:90,height:13},String(attached));
  const footer=[state.values?.['native-company-name'],state.values?.['native-company-fiscal'],state.values?.['native-numero'],state.values?.['native-os']].filter(Boolean).join(' | ');
  let annexPage,y;
  const newPage=()=>{annexPage=doc.addPage([595.32,841.92]);resetText(annexPage);y=790;annexPage.drawText('Anexo ao relatório de exploração',{x:45,y,size:14,font:bold});y-=24;};
  for(const item of annexes){
   if(!annexPage||y<100)newPage();
   const heading=item.number+'. '+item.label;for(const line of wrap(heading,bold,10,505)){if(y<70)newPage();annexPage.drawText(line,{x:45,y,size:10,font:bold});y-=14;}
   for(const line of wrap(item.text,font,9,505)){if(y<60)newPage();annexPage.drawText(line,{x:45,y,size:9,font});y-=12;}y-=12;
  }
  for(const photo of photoRows){if(!annexPage||y<285)newPage();const img=photo.src.startsWith('data:image/png')?await doc.embedPng(bytes(photo.src)):await doc.embedJpg(bytes(photo.src)),scale=Math.min(470/img.width,220/img.height);annexPage.drawImage(img,{x:45,y:y-img.height*scale,width:img.width*scale,height:img.height*scale});y-=img.height*scale+15;for(const line of wrap(photo.caption||'Fotografia',font,9,505)){annexPage.drawText(line,{x:45,y,size:9,font});y-=12;}y-=15;}
  const all=doc.getPages();for(let p=0;p<all.length;p++){
   const page=all[p],line=clean(footer);let size=7;while(font.widthOfTextAtSize(line,size)>500&&size>5)size-=.25;page.drawText(line,{x:45,y:17,size,font});
   if(p>=4)page.drawText('Anexo TG — '+(p-3)+' / '+(all.length-4),{x:420,y:30,size:8,font});
   if(!final)page.drawText('RASCUNHO',{x:140,y:300,size:58,font:bold,rotate:degrees(45),color:rgb(.65,.65,.65),opacity:.2});
  }
  doc.setTitle('Relatório de exploração — '+(state.values?.['native-numero']||v('nip')));doc.setSubject(layout.approvedBy+' — '+layout.model);doc.setProducer('Total Gest — modelo DGEG preenchido pelo técnico responsável');
  return {dataUri:await doc.saveAsBase64({dataUri:true}),filename:'Relatorio_Exploracao_'+String(state.values?.['native-numero']||v('nip')||'DGEG').replace(/[^a-z0-9_-]/gi,'_')+'.pdf',pages:all.length,source:layout.source,model:layout.model};
 }
 async function download(state,options){const pdf=await exportPDF(state,options),a=document.createElement('a');a.href=pdf.dataUri;a.download=pdf.filename;document.body.append(a);a.click();a.remove();return pdf;}
 root.TGElectricalLegal={exportPDF,download,layout};
})(typeof window==='object'?window:globalThis);
