const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const pages=['index.html','login.html'];
const files=pages.map(p=>fs.readFileSync(path.join(root,p),'utf8'));
const scripts=html=>[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(m=>m[1]);
const lists=files.map(scripts);
for(const name of ['app-principal.js','tg-supervisor-home.js','tg-push.js','tg-work-sheets.js','pwa-service-worker.js'])test(name+' loads the same version once on public and installed app entries',()=>{
 const entries=lists.map(list=>list.filter(src=>src.split('?')[0]===name));
 for(let i=0;i<entries.length;i++)assert.equal(entries[i].length,1,pages[i]);
 assert.equal(entries[0][0],entries[1][0]);assert(fs.existsSync(path.join(root,name)));
});
test('supervisor home loads after the main code and its assets are available offline',()=>{
 const worker=fs.readFileSync(path.join(root,'sw.js'),'utf8');
 for(const list of lists){const locate=n=>list.findIndex(src=>src.split('?')[0]===n);assert(locate('tg-supervisor-home.js')>locate('app-principal.js'));assert(worker.includes("'./"+list.find(src=>src.startsWith('tg-supervisor-home.js?'))+"'"));}
 for(const html of files){const css=html.match(/href="(tg-supervisor-home\.css\?[^\"]+)"/);assert(css);assert(worker.includes("'./"+css[1]+"'"));}
});
test('push runs after main code and before the PWA bootstrap on both entries',()=>{
 for(const list of lists){const locate=n=>list.findIndex(src=>src.split('?')[0]===n);assert(locate('tg-push.js')>locate('app-principal.js'));assert(locate('tg-push.js')<locate('pwa-service-worker.js'));}
});
test('installed app start URL contains the same daily panel and push module',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
 assert.equal(manifest.start_url.split('?')[0].replace(/^\.\//,''),'login.html');
 assert.match(files[1],/id="omeudia"/);
});
test('both entry points and the current push module are covered by the service worker',()=>{
 const worker=fs.readFileSync(path.join(root,'sw.js'),'utf8');
 for(const name of ['index.html','login.html'])assert(worker.includes("'./"+name+"'"));
 for(const list of lists)assert(worker.includes("'./"+list.find(src=>src.startsWith('tg-push.js?'))+"'"));
});
