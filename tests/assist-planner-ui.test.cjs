const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('TOTALGEST_ASSIST.html','utf8');
const planner=require('../tg-planner.js');
test('assistant planner is loaded before integration handlers and keeps save confirmation',()=>{
 assert.match(html,/src="tg-planner\.js\?v=1\.0\.1"/);
 assert.match(html,/function _tgAssistSugestao\(tipo\)/);
 assert.doesNotMatch(html,/onclick="_tgAssistSugestao\('assist'\)"/);
 assert.match(html,/onclick="_tgAssistSugestao\('os'\)"/);
 assert.doesNotMatch(html,/id="assist_atribuido"/);assert.match(html,/a\.atribuidoId = funcionariosIds\[0\] \|\| null/);
 assert.match(html,/document\.getElementById\('modalGenericoForm'\)\.onsubmit = _protegerSubmit/);
});
test('overlaps block recommendations even for new unsaved jobs',()=>{
 const options={tenantId:'tenant-1',job:{start:'2026-10-14T09:00:00Z',end:'2026-10-14T10:00:00Z'},
 technicians:[{id:'t',name:'Técnico',tenantId:'tenant-1'}],
 appointments:[{id:'os',tenantId:'tenant-1',technicianId:'t',start:'2026-10-14T09:30:00Z',end:'2026-10-14T11:00:00Z'}]};
 assert.equal(planner.recommend(options)[0].eligible,false);
});
test('historical services and absences are not claimed as comprehensively validated',()=>{
 assert.match(html,/férias e as deslocações não estão totalmente validadas/);
 assert.match(html,/Duração histórica desconhecida/);
});
