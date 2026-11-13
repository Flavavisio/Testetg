/* TesteTG — Mini mapa Leaflet da equipa no Dashboard principal.
   Only GPS coordinates obtained from the logged-in tenant's clock data. */
(function(root){
 'use strict';
 if(root.TGDashboardMapTest)return;
 let map=null,container=null,loading=null;
 const URL_JS='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
 const URL_CSS='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
 function dispose(){
  if(map){try{map.remove();}catch(_){ }map=null;}
  container=null;
 }
 function library(){
  if(root.L?.map)return Promise.resolve(root.L);
  if(loading)return loading;
  loading=new Promise((resolve,reject)=>{
   if(!document.querySelector('[data-tgd-leaflet-css]')){
    const style=document.createElement('link');style.rel='stylesheet';style.href=URL_CSS;style.dataset.tgdLeafletCss='1';document.head.append(style);
   }
   const existing=document.querySelector('[data-tgd-leaflet-js]');
   if(existing){existing.addEventListener('load',()=>resolve(root.L),{once:true});existing.addEventListener('error',()=>reject(Error('Mapa indisponível')),{once:true});return;}
   const script=document.createElement('script');script.src=URL_JS;script.async=true;script.dataset.tgdLeafletJs='1';
   script.addEventListener('load',()=>root.L?.map?resolve(root.L):reject(Error('Mapa indisponível')),{once:true});
   script.addEventListener('error',()=>reject(Error('Mapa indisponível')),{once:true});
   document.head.append(script);
  }).catch(error=>{loading=null;throw error});
  return loading;
 }
 async function render(target,points){
  dispose();
  if(!target||!Array.isArray(points)||!points.length)return;
  const valid=points.filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180);
  if(!valid.length)return;
  container=target;
  try{
   const L=await library();
   if(!target.isConnected||container!==target)return;
   map=L.map(target,{scrollWheelZoom:false,zoomControl:true,attributionControl:true});
   L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:18,attribution:'© OpenStreetMap contributors'
   }).addTo(map);
   const bounds=[];
   for(const person of valid){
    const color=person.type==='active'?'#10876f':person.type==='pause'?'#d79a13':'#64748b';
    const marker=L.circleMarker([person.lat,person.lng],{radius:8,color:'#fff',weight:2,fillColor:color,fillOpacity:.95}).addTo(map);
    // Text is never interpolated as HTML (technician names may contain symbols).
    const panel=document.createElement('div'),title=document.createElement('strong'),description=document.createElement('div');
    title.textContent=person.name||'Técnico';description.textContent=person.detail||'GPS registado';
    panel.append(title,description);marker.bindPopup(panel);
    bounds.push([person.lat,person.lng]);
   }
   if(bounds.length===1)map.setView(bounds[0],13);else map.fitBounds(bounds,{padding:[22,22],maxZoom:13});
   // The Dashboard may be inside an initially hidden tab.
   requestAnimationFrame(()=>{if(map&&target.isConnected)map.invalidateSize();});
  }catch(err){
   if(target.isConnected&&container===target){
    target.replaceChildren();
    const message=document.createElement('p');message.className='tgd-empty';
    message.textContent='Mapa temporariamente indisponível. Usa «Ver mapa completo».';
    target.append(message);
   }
  }
 }
 root.TGDashboardMapTest={render,dispose};
})(window);
