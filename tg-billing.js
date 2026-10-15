/* TotalGest pack payments: opt-in sandbox UI, isolated from legacy licence writes. */
(() => {
  'use strict';
  const labels={express:'Express',expert:'Expert',pro:'Pro',supreme:'Supreme'};
  const states={pending:'A aguardar pagamento',processing:'Em processamento',paid:'Confirmado em teste — ativação simulada',failed:'Pagamento falhado',expired:'Pedido expirado'};
  const money=cents=>new Intl.NumberFormat('pt-PT',{style:'currency',currency:'EUR'}).format(cents/100);
  function node(tag,text){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;}
  async function call(body){
    const {data,error}=await supa.functions.invoke('billing-checkout',{body});
    if(error||data?.error)throw new Error(data?.error||'Não foi possível contactar os pagamentos de teste.');
    return data;
  }
  function mount(container){
    if(window.TG_BILLING_SANDBOX_ENABLED!==true||usuarioLogado?.role!=='admin'||!container||container.querySelector('#tgBillingSandbox'))return;
    const actorId=usuarioLogado.id;
    const panel=node('section');panel.id='tgBillingSandbox';panel.className='report-card';
    panel.append(node('h4','Pagamentos de teste'));
    panel.append(node('p','Ambiente de teste: não cobra dinheiro nem altera a licença. Apenas os quatro packs; sem add-ons.'));
    const form=node('form');form.style.cssText='display:flex;gap:12px;flex-wrap:wrap;align-items:end';
    function select(title,values){
      const label=node('label',title+' '),field=node('select');
      for(const [value,text]of values){const option=node('option',text);option.value=value;field.append(option);}
      label.append(field);form.append(label);return field;
    }
    const pack=select('Pack',Object.entries(labels));
    const tier=select('Funcionários',[5,10,25,50].map(n=>[String(n),String(n)]));
    const period=select('Período',[['mensal','Mensal'],['anual','Anual — desconto de 10%']]);
    const method=select('Pagamento',[['card','Cartão'],['sepa_debit','Débito direto SEPA'],['multibanco','Referência Multibanco'],['bank_transfer','Transferência bancária']]);
    const pay=node('button','Continuar para checkout de teste');pay.type='submit';pay.className='btn btn-primary';form.append(pay);
    const status=node('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const orders=node('div'),refresh=node('button','Atualizar pagamentos');refresh.type='button';refresh.className='btn btn-outline';
    async function load(){
      refresh.disabled=true;
      try{
        const list=await call({action:'list'});
        if(usuarioLogado?.id!==actorId||!panel.isConnected)return;
        orders.replaceChildren();
        if(!list.length)orders.append(node('p','Sem pagamentos de teste.'));
        for(const order of list){
          const row=node('p',`${labels[order.pack]||order.pack} · ${order.tier} funcionários · ${order.period} · ${money(order.amount)} — ${states[order.state]||order.state}`);
          orders.append(row);
        }
      }catch(error){status.textContent=error.message;}finally{refresh.disabled=false;}
    }
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(pay.disabled)return;
      pay.disabled=true;status.textContent='A preparar checkout seguro de teste…';
      try{
        const data=await call({action:'checkout',pack:pack.value,tier:Number(tier.value),period:period.value,method:method.value});
        if(usuarioLogado?.id!==actorId||!panel.isConnected)return;
        const url=new URL(data.url);
        if(data.test_mode!==true||url.origin!=='https://checkout.stripe.com')throw new Error('Endereço de pagamento inválido.');
        window.location.assign(url.href);
      }catch(error){status.textContent=error.message;}finally{pay.disabled=false;}
    });
    refresh.addEventListener('click',load);
    panel.append(form,status,refresh,orders);container.prepend(panel);
    const returned=new URLSearchParams(location.search).get('billing_order');
    if(returned)status.textContent='Regressou do checkout. O estado abaixo depende da confirmação do prestador; esta página não confirma pagamentos.';
    load();
  }
  window.TGBilling={mount};
})();
