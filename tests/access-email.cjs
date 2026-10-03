const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const {JSDOM}=require(process.env.JSDOM_PATH || 'jsdom');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const index=new JSDOM(read('index.html')).window.document,login=new JSDOM(read('login.html')).window.document;
assert(!index.querySelector('#landEmail'));assert(login.querySelector('#landEmail'));assert.equal(login.querySelector('#tgSidebar').outerHTML,index.querySelector('#tgSidebar').outerHTML);
const email=read('supabase/functions/super-function/enviar-email.ts').replace(/^import .*$/gm,'').split('Deno.serve(')[0];const ctx={};vm.createContext(ctx);vm.runInContext(email,ctx);
for(const type of ['pagamento','boas_vindas_demo','renovacao','vencida','renovacao_aprovada','pedido_renovacao_consolidado','boas_vindas_equipa','aviso_novo_trial','confirmar_trial','definir_password_trial','recuperar_password','cancelamento_licenca','cancelamento_licenca_interno','lembrete_pagamento']) {
 const msg=ctx.montarEmail(type,{to_name:'<script>alert(1)</script>',empresa:'Empresa & Filhos',link_confirmacao:'https://example.invalid/recovery?token=a&b=c',valor:'42,49 €',iban:'PT50 TEST',itens:[]});assert(msg.html.includes('<h1'));assert(!msg.html.includes('<script>'));assert(msg.html.includes('role="presentation"'));if(type==='recuperar_password'){assert(msg.html.includes('token=a&amp;b=c'));fs.writeFileSync('/tmp/tg-email-preview.html',msg.html);}
}
const rec=read('supabase/functions/recuperar-password-cliente/index.ts');let handler,body,opts;
const client={from:()=>({select:()=>({eq:async()=>({data:[{portal_ativo:true,email:'test@example.invalid',nome:'Teste',admin_id:'abc'}]})})}),auth:{admin:{generateLink:async o=>{opts=o;return {data:{properties:{action_link:'https://example.invalid/token'}}}}}}};
vm.runInNewContext(rec.replace(/^import .*$/gm,''),{Deno:{env:{get:()=> 'test'},serve:fn=>handler=fn},createClient:()=>client,Response,console,fetch:async(url,o)=>{body=JSON.parse(o.body);return {ok:true}}});
(async()=>{await handler({method:'POST',json:async()=>({nif:'123456789',email:'test@example.invalid'})});assert.equal(body.tipo,'recuperar_password');assert.equal(body.to_email,'test@example.invalid');assert(body.link_confirmacao);assert(opts.options.redirectTo.endsWith('redefinir-password.html'));console.log('PASS: page separation, shared app shell, 14 email templates escaped and recovery payload/redirect (no emails sent).')})();
