const {test}=require('node:test');
const assert=require('node:assert/strict');
const planner=require('../tg-planner.js');
test('isolates tenant, exclusions, absences and overlapping appointments',()=>{
 const technicians=[{id:'a',name:'Ana',tenantId:'1',skills:['CCTV']},{id:'b',name:'Bruno',tenantId:'1',skills:['CCTV']},{id:'x',name:'Outro cliente',tenantId:'2',skills:['CCTV']}];
 const job={start:'2026-10-14T09:00:00+01:00',end:'2026-10-14T10:00:00+01:00',skills:['CCTV']};
 const result=planner.recommend({technicians,job,tenantId:'1',appointments:[{id:'os1',tenantId:'1',technicianId:'a',start:'2026-10-14T09:30:00+01:00',end:'2026-10-14T11:00:00+01:00'}]});
 assert.deepEqual(result.map(x=>x.id),['b','a']);assert.equal(result[0].eligible,true);assert.equal(result[1].eligible,false);
 assert.equal(planner.recommend({technicians,job,tenantId:'1',absences:[{tenantId:'1',technicianId:'b',start:job.start,end:job.end}]}).find(x=>x.id==='b').eligible,false);
});
test('rejects invalid ranges, missing tenant, missing skills, and does not modify input',()=>{
 const tech={id:'x',name:'X',tenantId:'1',skills:[]};
 const input={technicians:[tech],tenantId:'1',job:{start:'2026-10-14T09:00:00Z',end:'2026-10-14T10:00:00Z',skills:['SCIE']}};
 assert.equal(planner.recommend(input)[0].eligible,false);
 assert.deepEqual(tech,{id:'x',name:'X',tenantId:'1',skills:[]});
 assert.throws(()=>planner.recommend({...input,tenantId:null}));
 assert.throws(()=>planner.recommend({...input,job:{start:input.job.end,end:input.job.start}}));
});
test('offline drafts never require network, enforce scope and permitted draft types',()=>{
 const offline=require('../tg-offline.js');
 assert.deepEqual(Object.keys(offline).sort(),['clearAccount','list','remove','save']);
 return assert.rejects(()=>offline.save({tenantId:'1',userId:'u',id:'1',type:'invalid',data:{}}));
});
test('service worker forbids blanket runtime data caching',()=>{
 const fs=require('node:fs'),s=fs.readFileSync('sw.js','utf8');
 assert.match(s,/staticPaths\.has\(u\.pathname\)/);
 assert.match(s,/authorization/);
 assert.match(s,/res\.headers\.has\('set-cookie'\)/);
 assert.doesNotMatch(s,/caches\.open\(CACHE\)\.then\(c => c\.put\(req, copy\)\)/);
});
