/* Native work types shared by onboarding, OS requirements and specialty editors. */
(function(){
 'use strict';
 const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
 const list=[
  {type:'RAVAC',area:'avac',title:'Intervenção e Manutenção AVAC',icon:'fa-wind',
   work:[['Manutenção AC','Manutenção de ar condicionado'],['Instalação AVAC','Instalação'],['Recarga de gás','Recarga de gás refrigerante'],['Limpeza de filtros','Limpeza de filtros/condutas'],['Diagnóstico AVAC','Diagnóstico de avaria']],
   operations:['Manutenção preventiva','Instalação / colocação em serviço','Recarga de gás refrigerante','Limpeza de filtros / condutas','Diagnóstico de avaria','Reparação','Desativação'],
   note:'Registo técnico de intervenção AVAC. Não substitui inspeções regulamentares, registos oficiais de gases fluorados, avaliações de qualidade do ar ou registos de Legionella.'},
  {type:'RLIM',area:'limpeza',title:'Limpeza e Desinfeção',icon:'fa-broom',
   work:[['Limpeza regular','Limpeza regular'],['Limpeza profunda','Limpeza profunda'],['Limpeza pós-obra','Limpeza pós-obra'],['Desinfeção','Desinfeção']],
   operations:['Limpeza regular','Limpeza profunda','Limpeza pós-obra','Desinfeção'],results:['Serviço realizado','Realizado com pendências','Não realizado'],
   checks:['Zonas e superfícies previstas','Instalações sanitárias','Pavimentos','Pontos de contacto frequente','Resíduos e consumíveis','Estado final e segurança da zona'],
   sections:[{title:'Zonas e tarefas',fields:['zones','planned','done','method']},{title:'Produtos e segurança',fields:['products','dilution','contact','biocide','ppe','waste']},{title:'Verificação e pendências',fields:['before','after','unavailable','supervisor']}],
   labels:{zones:'Zonas / divisões e superfícies intervencionadas',planned:'Tarefas previstas',done:'Tarefas executadas por zona',method:'Métodos e equipamentos utilizados',products:'Produtos utilizados — nome comercial e referência / lote',dilution:'Diluição / concentração aplicada e instruções do fabricante',contact:'Tempo de contacto aplicado (minutos) e superfícies',biocide:'Autorização / registo do biocida, quando aplicável',ppe:'Proteção individual, sinalização e medidas adotadas',waste:'Recolha e destino dos resíduos',before:'Estado anterior / sujidade',after:'Estado final e verificação',unavailable:'Zonas não intervencionadas e motivo',supervisor:'Responsável pela verificação / observações'},
   required:['zones','done','method'],
   note:'Registo do serviço de limpeza. Na desinfeção, usar produtos autorizados e cumprir o rótulo e a ficha de segurança, incluindo diluição e tempo de contacto. Não constitui certificação microbiológica.'},
  {type:'RELE',area:'eletricidade',title:'Intervenção e Verificação Elétrica',icon:'fa-bolt',
   work:[['Instalação elétrica','Instalação elétrica'],['Certificação elétrica','Certificação / vistoria'],['Quadro elétrico','Quadro elétrico'],['Iluminação','Iluminação'],['Avaria elétrica','Avaria elétrica']],
   operations:['Instalação elétrica','Verificação técnica / preparação para inspeção','Quadro elétrico','Iluminação','Diagnóstico / reparação de avaria'],
   checks:['Seccionamento e identificação de circuitos','Condutores de proteção / equipotencialidade','Quadro, invólucros e acessibilidade','Proteção contra sobreintensidades','Proteção diferencial','Ligação à terra','Isolamento e estado das canalizações','Ensaios funcionais e identificação de riscos'],
   sections:[{title:'Instalação e responsável',fields:['installation','cpe','supply','earthing','qualification','isolation']},{title:'Circuitos e proteções',fields:['circuits','protection','changes']},{title:'Medições e ensaios',fields:['instrument','calibration','voltage','earth','insulation','rcdCurrent','rcdTime','continuity','tests']},{title:'Anomalias e medidas',fields:['faults','danger','measures','inspection']}],
   labels:{installation:'Identificação da instalação / quadro e localização',cpe:'CPE / referência da instalação (se disponível)',supply:'Alimentação — fases, tensão nominal e potência',earthing:'Esquema de ligação à terra (TT / TN / IT / por confirmar)',qualification:'Habilitação / identificação profissional do técnico',isolation:'Consignação, ausência de tensão e medidas de segurança executadas',circuits:'Por circuito: identificação, utilização e secção dos condutores (mm²)',protection:'Por circuito: disjuntor / fusível (A, curva) e diferencial (tipo, mA)',changes:'Alterações e materiais instalados',instrument:'Instrumentos — marca, modelo e número de série',calibration:'Verificação / calibração dos instrumentos e data',voltage:'Tensão medida (V)',earth:'Resistência de terra medida (Ω)',insulation:'Resistência de isolamento medida (MΩ)',rcdCurrent:'Corrente do ensaio diferencial (mA)',rcdTime:'Tempo de atuação medido (ms)',continuity:'Continuidade do condutor de proteção — circuito e valor (Ω)',tests:'Ensaios por circuito: método, condições, valor medido, unidade e resultado',faults:'Anomalias detetadas e circuitos afetados',danger:'Riscos / situações perigosas identificados',measures:'Medidas corretivas e circuitos retirados de serviço',inspection:'Necessidade de inspeção / entidade competente / referência do documento oficial'},
   numeric:['voltage','earth','insulation','rcdCurrent','rcdTime'],required:['installation','qualification','tests'],
   note:'Relatório técnico dos trabalhos e ensaios efetuados. O técnico habilitado avalia os requisitos aplicáveis às condições da instalação. Este documento não emite certificação nem substitui termos de responsabilidade, declarações ou inspeções oficiais.'}
 ];
 const areaEnabled=(config,admin)=>Array.isArray(admin?.areasNegocio)&&admin.areasNegocio.includes(config.area);
 for(const config of list){
  config.matches=os=>(os?.tiposTrabalho||[]).some(t=>t===config.type||(config.type==='RAVAC'&&t==='AVAC')||config.work.some(([code,label])=>[norm(code),norm(label)].includes(norm(t))));
  config.operationFor=os=>{const work=config.work.find(([code,label])=>(os?.tiposTrabalho||[]).some(t=>[norm(code),norm(label)].includes(norm(t))));return config.operations[work?config.work.indexOf(work):0];};
 }
 function currentAdmin(){try{return typeof adminDoUtilizador==='function'?adminDoUtilizador():null}catch{return null}}
 function available(){return list.filter(c=>areaEnabled(c,currentAdmin()));}
 function workType(code){return list.find(c=>c.work.some(([v,l])=>[norm(v),norm(l)].includes(norm(code))));}
 function nativeCustom(t){const config=workType(t.codigo);return !!config&&areaEnabled(config,currentAdmin())&&(t.criadoPorOnboarding===true||!(t.campos||[]).length);}
 window.TGSpecialtyCatalog={list,available,workType,nativeCustom,canonical:t=>t==='AVAC'?'RAVAC':t};
})();
