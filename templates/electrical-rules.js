/* Portuguese electrical-report validation shared by host and editable sheet. */
(function(root){
 'use strict';
 const key='Relatório de exploração';
 const value=(s,k)=>String(s?.values?.['electric-'+k]??'').trim();
 const normal=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
 const active=s=>s?.type==='RELE'&&s.modelKeys?.length===1&&s.modelKeys[0]===key;
 function validate(s,final){
  if(!active(s)||!final)return [];
  const errors=[],v=k=>value(s,k),date=t=>/^\d{4}-\d{2}-\d{2}$/.test(t)&&!Number.isNaN(Date.parse(t+'T12:00:00Z'));
  for(const k of ['period_start','period_end','report_date'])if(!date(v(k)))errors.push('Indica as datas do período e da assinatura do relatório de exploração.');
  if(v('period_start')>v('period_end'))errors.push('O fim do período não pode ser anterior ao início.');
  if(date(v('report_date'))&&v('report_date')<v('period_end'))errors.push('A data do relatório não pode ser anterior ao fim do período declarado.');
  for(const k of ['owner_nif','tech_nif'])if(!/^\d{9}$/.test(v(k)))errors.push('O NIF da entidade exploradora e do técnico deve ter nove algarismos.');
  if(!v('tech_dgeg')&&!v('tech_oe')&&!v('tech_oet'))errors.push('Indica o registo DGEG, OE ou OET do técnico responsável.');
  if(v('qualification')!=='Confirmo a habilitação e o registo aplicáveis')errors.push('Confirma a habilitação e o registo do técnico para esta instalação.');
  if(normal(v('tech_name'))!==normal(s.values?.sign_tecnico_nome))errors.push('O nome de quem assina deve corresponder ao técnico responsável pela exploração identificado.');
  if(!['A','B','C'].includes(v('installation_type')))errors.push('Seleciona o tipo de instalação A, B ou C.');
  if(v('installation_type')==='B'&&!v('ptc'))errors.push('Indica o PTC da instalação do tipo B.');
  if(!['Sim','Não'].includes(v('safety'))||!['Sim','Não'].includes(v('resignation')))errors.push('Regista as condições de segurança e a situação de responsabilidade.');
  const result=s.values?.['native-result'];
  if(v('resignation')==='Sim'&&result!=='Cessação da responsabilidade')errors.push('Seleciona a conclusão de cessação da responsabilidade.');
  if(v('resignation')==='Não'&&result!==(v('safety')==='Sim'?'Boas condições de segurança':'Condições deficientes'))errors.push('A conclusão deve corresponder às condições de segurança declaradas.');
  if(v('submission')==='Registado — indicar referência'&&!v('sriesp'))errors.push('Indica a referência do registo no SRIESP.');
  for(const [id,raw] of Object.entries(s.values||{})){
   if(!id.startsWith('electric-')||String(raw).trim()==='')continue;
   const k=id.slice(9),group=['pt','soc','seg','bt'].find(g=>k.startsWith(g+'_'));
   if(group&&v(group+'_app')==='Não')continue;
   if(/^(power|pt[1-6]|gg[1-6]|attachment_count|bt_insulation|bt_test_voltage|bt_power_factor|(?:pt|soc|seg|bt)_(?:protection|service|unique_earth)_(?:summer|winter))$/.test(k)){
    const n=Number(String(raw).replace(',','.'));if(!Number.isFinite(n)||n<0)errors.push('Regista medições numéricas válidas e não negativas; valores desconhecidos devem ser justificados nas limitações.');
    if(k==='bt_power_factor'&&n>1)errors.push('O fator de potência deve estar entre 0 e 1.');
    if(k==='attachment_count'&&!Number.isInteger(n))errors.push('O número de anexos deve ser inteiro.');
   }
   if(k.endsWith('_date')&&date(String(raw))&&(String(raw)<v('period_start')||String(raw)>v('period_end')))errors.push('As datas das medições devem pertencer ao período declarado.');
  }
  for(const g of ['pt','soc','seg','bt']){
   if(!['Sim','Não'].includes(v(g+'_app'))){errors.push('Indica que partes da instalação se aplicam: PT, geradores e BT.');continue;}
   if(v(g+'_app')!=='Sim')continue;
   const missing=[];
   if(g==='bt'){
    if(!['TT','TN','IT'].includes(v('bt_earthing')))errors.push('Seleciona o esquema de ligação à terra da instalação BT.');
    missing.push('bt_protection_summer_date','bt_protection_summer','bt_protection_winter_date','bt_protection_winter','bt_insulation','bt_test_voltage','bt_continuity','bt_rcd');
   }else{
    if(!['Sim','Não'].includes(v(g+'_unique')))errors.push('Indica se existe terra única nas partes aplicáveis da instalação.');
    for(const earth of v(g+'_unique')==='Sim'?['unique_earth']:['protection','service'])for(const season of ['summer','winter'])missing.push(g+'_'+earth+'_'+season+'_date',g+'_'+earth+'_'+season);
    missing.push(g+'_continuity');if(g==='pt')missing.push('pt_oil');
   }
   if(missing.some(k=>!v(k))&&!v(g+'_limitations'))errors.push('Regista os resultados das medições / ensaios ou justifica explicitamente os que não foram realizados na secção correspondente.');
  }
  if(Object.values(s.answers||{}).includes('NOK')&&!v('observations'))errors.push('Descreve as não conformidades no ponto 6A do relatório DGEG.');
  return [...new Set(errors)];
 }
 root.TGElectricalRules={key,active,value,validate};
})(typeof window==='object'?window:globalThis);
