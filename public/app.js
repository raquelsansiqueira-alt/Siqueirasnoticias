const home = document.querySelector('#home');
const panel = document.querySelector('#panel');
const list = document.querySelector('#newsList');
const search = document.querySelector('#search');
const boletimControls = document.querySelector('#boletimControls');
const ministerFilters = document.querySelector('#ministerFilters');
const dialog = document.querySelector('#boletimDialog');
const boletimText = document.querySelector('#boletimText');
const loading = document.querySelector('#loading');
const generalControls = document.querySelector('#generalControls');
const generalEditionControls = document.querySelector('#generalEditionControls');
let currentGeneralFilter = '';


let currentModule = null;
let currentMinister = '';
let refreshTimer = null;
let config = {sources:[], ministers:[], stjMinisters:[]};

const labels = {
  stf: ['STF • CNJ • Ministros', 'Monitoramento em atualização contínua'],
  stj: ['STJ • Superior Tribunal de Justiça', '33 ministros • Presidente Luis Felipe Salomão'],
  geral: ['Giro de Notícias', 'Seleção de maior relevância do Brasil e do mundo'],
  judiciario: ['Boletins Judiciário', 'Ajufe • CNJ • STF • Ministros • STJ'],
  saude: ['Saúde', 'Saúde • Planos • OMS • SUS • Anvisa • Rede D’Or']
};

function escapeHtml(s=''){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function brDate(iso){
  try {
    return new Intl.DateTimeFormat('pt-BR',{
      dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'
    }).format(new Date(iso));
  } catch { return iso || '—'; }
}


async function loadConfig(){
  const res = await fetch('/api/config');
  config = await res.json();
  document.querySelector('#sourcesText').textContent = config.sources.join(', ') + '.';

  ministerFilters.addEventListener('click', e=>{
    const btn = e.target.closest('.filter');
    if(!btn) return;
    ministerFilters.querySelectorAll('.filter').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    currentMinister = btn.dataset.minister || '';
    ministerFilters.dataset.tag = btn.dataset.tag || '';
    loadNews();
  });
}

function renderMinisterFilters(){
  currentMinister = '';
  ministerFilters.dataset.tag = '';

  if(currentModule === 'stf'){
    ministerFilters.innerHTML = `
      <button class="filter active" data-minister="">Todos</button>
      <button class="filter" data-tag="STF">STF</button>
      <button class="filter" data-tag="CNJ">CNJ</button>
      ${config.ministers.map(m=>`<button class="filter" data-minister="${escapeHtml(m.name)}">${escapeHtml(m.name)}</button>`).join('')}
    `;
    ministerFilters.classList.remove('hidden');
    return;
  }

  if(currentModule === 'stj'){
    const president = (config.stjMinisters || []).find(m=>m.president);
    const others = (config.stjMinisters || []).filter(m=>!m.president);
    ministerFilters.innerHTML = `
      <button class="filter active" data-minister="">Todos</button>
      ${president ? `<button class="filter" data-minister="${escapeHtml(president.name)}">Presidente • ${escapeHtml(president.name)}</button>` : ''}
      ${others.map(m=>`<button class="filter" data-minister="${escapeHtml(m.name)}">${escapeHtml(m.name)}</button>`).join('')}
    `;
    ministerFilters.classList.remove('hidden');
    return;
  }

  ministerFilters.classList.add('hidden');
}


async function loadNews(){
  if(!currentModule) return;
  loading.classList.remove('hidden');
  try{
    const q = encodeURIComponent(search.value.trim());
    let res;

    if(currentModule === 'geral'){
      res = await fetch(`/api/general-news?filter=${encodeURIComponent(currentGeneralFilter)}&q=${q}`);
    }else{
      const minister = encodeURIComponent(currentMinister);
      const tag = encodeURIComponent(ministerFilters.dataset.tag || '');
      res = await fetch(`/api/news?module=${currentModule}&q=${q}&minister=${minister}&tag=${tag}`);
    }

    const items = await res.json();
    document.querySelector('#lastUpdate').textContent =
      new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'medium',timeZone:'America/Sao_Paulo'}).format(new Date());
    render(Array.isArray(items) ? items : []);
  }catch(err){
    list.innerHTML = `<div class="empty">Não foi possível buscar as notícias agora. Tente novamente em instantes.</div>`;
  }finally{
    loading.classList.add('hidden');
  }
}

function render(items){
  if(!items.length){
    list.innerHTML = `<div class="empty">Nenhuma notícia encontrada neste filtro.</div>`;
    return;
  }
  list.innerHTML = items.map((n,i) => `
    <article class="news-card">
      <div class="news-meta"><strong>${escapeHtml(n.source)}</strong><span>•</span><span>${brDate(n.publishedAt)}</span></div>
      <h3>${escapeHtml(n.title)}</h3>
      ${n.summary ? `<p class="summary">${escapeHtml(n.summary.slice(0,260))}${n.summary.length>260?'…':''}</p>` : ''}
      <div class="tags">${(n.tags||[]).map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
      <div class="actions">
        <button data-action="read" data-index="${i}">Ler notícia</button>
        <button data-action="copy" data-index="${i}">Copiar título + link</button>
        <button data-action="whatsapp" data-index="${i}">WhatsApp</button>
      </div>
    </article>`).join('');

  list._items = items;
}

list.addEventListener('click', async e=>{
  const btn = e.target.closest('[data-action]');
  if(!btn) return;
  const n = list._items?.[Number(btn.dataset.index)];
  if(!n) return;

  btn.disabled = true;
  try{
    const url = n.url;
    if(!url || url.includes('news.google.com')){
      alert('Esta matéria não possui link original disponível e foi bloqueada.');
      return;
    }
    if(btn.dataset.action === 'read'){
      window.open(url,'_blank','noopener');
    }else if(btn.dataset.action === 'copy'){
      await navigator.clipboard.writeText(`${n.title}\n${url}`);
      const old = btn.textContent;
      btn.textContent = 'Copiado!';
      setTimeout(()=>btn.textContent=old,1200);
    }else{
      window.open(`https://wa.me/?text=${encodeURIComponent(n.title+'\n'+url)}`,'_blank','noopener');
    }
  }finally{
    btn.disabled = false;
  }
});

document.querySelectorAll('[data-open]').forEach(btn => btn.addEventListener('click',()=>{
  currentModule = btn.dataset.open;
  currentMinister = '';
  ministerFilters.dataset.tag = '';
  renderMinisterFilters();
  home.classList.remove('active');
  panel.classList.add('active');
  document.querySelector('#panelTitle').textContent = labels[currentModule][0];
  document.querySelector('#panelEyebrow').textContent = labels[currentModule][1];
  boletimControls.classList.toggle('hidden', currentModule !== 'judiciario');
  generalControls.classList.toggle('hidden', currentModule !== 'geral');
  generalEditionControls.classList.toggle('hidden', currentModule !== 'geral');
  currentGeneralFilter = '';
  if(currentModule === 'geral'){
    generalControls.querySelectorAll('.filter').forEach((b,i)=>b.classList.toggle('active',i===0));
  }
  search.value='';
  updateModuleBulletinButton();
  loadNews();
  clearInterval(refreshTimer);
  refreshTimer=setInterval(loadNews,30000);
}));

document.querySelector('#back').addEventListener('click',()=>{
  clearInterval(refreshTimer);
  currentModule=null;
  updateModuleBulletinButton();
  panel.classList.remove('active');
  home.classList.add('active');
});

let searchTimer;
search.addEventListener('input',()=>{
  clearTimeout(searchTimer);
  searchTimer=setTimeout(loadNews,300);
});

document.querySelector('#refreshNow').addEventListener('click',async()=>{
  if(!currentModule) return;
  const btn = document.querySelector('#refreshNow');
  btn.disabled = true;
  btn.textContent = 'Atualizando...';
  try{
    await fetch('/api/refresh',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({module:currentModule})
    });
    await loadNews();
  }finally{
    btn.disabled = false;
    btn.textContent = 'Atualizar agora';
  }
});


generalControls?.addEventListener('click', e=>{
  const btn = e.target.closest('[data-general-filter]');
  if(!btn) return;
  generalControls.querySelectorAll('[data-general-filter]').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  currentGeneralFilter = btn.dataset.generalFilter || '';
  loadNews();
});

generalEditionControls?.addEventListener('click', async e=>{
  const btn = e.target.closest('[data-general-period]');
  if(!btn) return;

  btn.disabled = true;
  const old = btn.textContent;
  btn.textContent = 'Gerando...';

  try{
    const res = await fetch(`/api/general-highlight/${btn.dataset.generalPeriod}`);
    if(!res.ok) throw new Error('Não foi possível gerar os destaques.');

    const data = await res.json();

    moduleBulletinTitle.textContent = 'Giro de Notícias';
    moduleBulletinGenerated.textContent = `${data.count || 0} matéria(s)`;
    moduleBulletinText.value = data.text || '';
    moduleBulletinModal.hidden = false;
  }catch(err){
    alert(err.message || 'Não foi possível gerar os destaques.');
  }finally{
    btn.disabled = false;
    btn.textContent = old;
  }
});

document.querySelectorAll('[data-edition]').forEach(btn=>btn.addEventListener('click',async()=>{
  btn.disabled = true;
  try{
    const res=await fetch(`/api/boletim/${btn.dataset.edition}`);
    const data=await res.json();
    boletimText.value=data.text || '';
    dialog.showModal();
  }finally{
    btn.disabled = false;
  }
}));

document.querySelector('#closeDialog').addEventListener('click',()=>dialog.close());
document.querySelector('#copyBoletim').addEventListener('click',async()=>{
  await navigator.clipboard.writeText(boletimText.value);
});

loadConfig();

const generateModuleBulletinBtn=document.getElementById('generateModuleBulletinBtn');
const stjAfternoonBulletinBtn=document.getElementById('stjAfternoonBulletinBtn');
const moduleBulletinModal=document.getElementById('moduleBulletinModal');
const moduleBulletinText=document.getElementById('moduleBulletinText');
const moduleBulletinTitle=document.getElementById('moduleBulletinTitle');
const moduleBulletinGenerated=document.getElementById('moduleBulletinGenerated');

function updateModuleBulletinButton(){
  if(generateModuleBulletinBtn){
    generateModuleBulletinBtn.hidden = !['stf','stj','saude'].includes(currentModule);
  }
  if(stjAfternoonBulletinBtn){
    stjAfternoonBulletinBtn.hidden = currentModule !== 'stj';
  }
}

function bulletinDate(d){
  let w=new Intl.DateTimeFormat('pt-BR',{weekday:'long',timeZone:'America/Sao_Paulo'}).format(d);
  let x=new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'long',year:'numeric',timeZone:'America/Sao_Paulo'}).format(d);
  return w.charAt(0).toUpperCase()+w.slice(1)+', '+x;
}

async function generateModuleBulletin(){
  const module=currentModule;
  if(!['stf','stj','saude'].includes(module)) return;

  generateModuleBulletinBtn.disabled=true;
  const old=generateModuleBulletinBtn.textContent;
  generateModuleBulletinBtn.textContent='Gerando...';

  try{
    const p=new URLSearchParams({module});
    const q=search.value.trim();
    if(q) p.set('q',q);
    if(currentMinister) p.set('minister',currentMinister);
    if(ministerFilters.dataset.tag) p.set('tag',ministerFilters.dataset.tag);

    const r=await fetch('/api/news?'+p.toString());
    if(!r.ok) throw new Error('Não foi possível carregar as notícias.');
    const items=await r.json();

    const now=new Date();
    const label=module==='saude'?'SAÚDE':module.toUpperCase();

    moduleBulletinTitle.textContent='Boletim '+label;
    moduleBulletinGenerated.textContent='Gerado às '+new Intl.DateTimeFormat('pt-BR',{
      hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'
    }).format(now);

    const lines=['*BOLETIM '+label+'*','_'+bulletinDate(now)+'_','-'];
    if(!items.length) lines.push('Nenhuma notícia disponível com os filtros atuais.');
    items.forEach(n=>{
      lines.push('*'+n.source+'* - '+n.title);
      lines.push(n.url);
      lines.push('-');
    });

    moduleBulletinText.value=lines.join('\n');
    moduleBulletinModal.hidden=false;
  }catch(e){
    alert(e.message||'Não foi possível gerar o boletim.');
  }finally{
    generateModuleBulletinBtn.disabled=false;
    generateModuleBulletinBtn.textContent=old;
  }
}


async function generateStjAfternoonBulletin(){
  if(currentModule !== 'stj') return;

  stjAfternoonBulletinBtn.disabled = true;
  const old = stjAfternoonBulletinBtn.textContent;
  stjAfternoonBulletinBtn.textContent = 'Gerando edição da tarde...';

  try{
    const response = await fetch('/api/stj/boletim-tarde');
    if(!response.ok) throw new Error('Não foi possível gerar a edição da tarde.');

    const data = await response.json();

    moduleBulletinTitle.textContent = 'Edição da tarde • STJ';
    moduleBulletinGenerated.textContent =
      `${data.count || 0} matéria(s) • ${data.sources || 0} veículo(s)`;

    moduleBulletinText.value = data.text || '';
    moduleBulletinModal.hidden = false;
  }catch(err){
    alert(err.message || 'Não foi possível gerar a edição da tarde.');
  }finally{
    stjAfternoonBulletinBtn.disabled = false;
    stjAfternoonBulletinBtn.textContent = old;
  }
}

stjAfternoonBulletinBtn?.addEventListener('click',generateStjAfternoonBulletin);

generateModuleBulletinBtn?.addEventListener('click',generateModuleBulletin);
function closeMB(){moduleBulletinModal.hidden=true}
document.getElementById('closeModuleBulletin')?.addEventListener('click',closeMB);
document.getElementById('closeModuleBulletinBottom')?.addEventListener('click',closeMB);
moduleBulletinModal?.addEventListener('click',e=>{if(e.target===moduleBulletinModal)closeMB()});
document.getElementById('copyModuleBulletin')?.addEventListener('click',async e=>{
  await navigator.clipboard.writeText(moduleBulletinText.value);
  const old=e.target.textContent;
  e.target.textContent='Copiado!';
  setTimeout(()=>e.target.textContent=old,1200);
});



const coversPanel=document.querySelector('#coversPanel'),openCovers=document.querySelector('#openCovers'),backFromCovers=document.querySelector('#backFromCovers'),coversGrid=document.querySelector('#coversGrid'),coversDate=document.querySelector('#coversDate');
async function loadCovers(){
  coversGrid.innerHTML='<div class="empty">Carregando...</div>';
  try{
    const res=await fetch('/api/covers'),data=await res.json();
    coversDate.textContent=`Edições de ${data.date}`;
    coversGrid.innerHTML=data.newspapers.map(n=>`
      <article class="cover-card cover-card-clean">
        <h3>${escapeHtml(n.name)}</h3>
        <button class="cover-open" type="button" data-cover-url="${escapeHtml(n.official)}">Abrir edição oficial</button>
      </article>`).join('');
  }catch(e){coversGrid.innerHTML='<div class="empty">Não foi possível carregar agora.</div>'}
}
if(openCovers)openCovers.addEventListener('click',()=>{
  clearInterval(refreshTimer);
  panel.classList.remove('active');
  home.classList.remove('active');
  coversPanel.classList.add('active');
  loadCovers();
});

if(backFromCovers)backFromCovers.addEventListener('click',()=>{
  coversPanel.classList.remove('active');
  panel.classList.remove('active');
  home.classList.add('active');
});


coversGrid?.addEventListener('click', e=>{
  const target = e.target.closest('[data-cover-url]');
  if(!target) return;
  const url = target.dataset.coverUrl;
  if(url) window.location.assign(url);
});

coversGrid?.addEventListener('keydown', e=>{
  if(e.key !== 'Enter' && e.key !== ' ') return;
  const target = e.target.closest('[data-cover-url]');
  if(!target) return;
  e.preventDefault();
  const url = target.dataset.coverUrl;
  if(url) window.location.assign(url);
});


const newsletterPanel=document.querySelector('#newsletterPanel'),openNewsletter=document.querySelector('#openNewsletter'),backFromNewsletter=document.querySelector('#backFromNewsletter'),newsletterLogin=document.querySelector('#newsletterLogin'),newsletterClients=document.querySelector('#newsletterClients'),newsletterClientGrid=document.querySelector('#newsletterClientGrid'),newsletterPassword=document.querySelector('#newsletterPassword'),newsletterLoginBtn=document.querySelector('#newsletterLoginBtn'),newsletterLoginError=document.querySelector('#newsletterLoginError');
const getNewsletterToken=()=>localStorage.getItem('newsletterToken')||'';
function setNewsletterToken(t){t?localStorage.setItem('newsletterToken',t):localStorage.removeItem('newsletterToken')}
const newsletterHeaders=()=>getNewsletterToken()?{'Authorization':`Bearer ${getNewsletterToken()}`}:{};
function showNewsletterLogin(m=''){newsletterLogin.classList.remove('hidden');newsletterClients.classList.add('hidden');newsletterLoginError.textContent=m;newsletterPassword.value=''}

async function loadNewsletterClients(){
  try{
    const r=await fetch('/api/newsletter/clients',{headers:newsletterHeaders()});
    if(r.status===401){setNewsletterToken('');showNewsletterLogin();return}
    const d=await r.json().catch(()=>null);
    if(!r.ok){showNewsletterLogin(d?.error||'Não foi possível carregar o painel.');return}
    newsletterLogin.classList.add('hidden');newsletterClients.classList.remove('hidden');
    newsletterClientGrid.innerHTML=d.map(c=>`<article class="newsletter-client-card"><h3>${escapeHtml(c.title)}</h3><p>${c.sections.map(escapeHtml).join(' • ')}</p><div class="newsletter-actions"><button class="outline" data-newsletter-client="${escapeHtml(c.id)}" data-newsletter-period="manha">Newsletter da manhã</button><button class="outline" data-newsletter-client="${escapeHtml(c.id)}" data-newsletter-period="tarde">Newsletter da tarde</button></div></article>`).join('');
  }catch(e){showNewsletterLogin('Não foi possível carregar o painel Newsletter.')}
}
openNewsletter?.addEventListener('click',()=>{clearInterval(refreshTimer);home.classList.remove('active');panel.classList.remove('active');document.querySelector('#coversPanel')?.classList.remove('active');newsletterPanel.classList.add('active');getNewsletterToken()?loadNewsletterClients():showNewsletterLogin()});
backFromNewsletter?.addEventListener('click',()=>{newsletterPanel.classList.remove('active');home.classList.add('active')});
newsletterLoginBtn?.addEventListener('click',async()=>{newsletterLoginBtn.disabled=true;newsletterLoginError.textContent='';try{const r=await fetch('/api/newsletter/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:newsletterPassword.value})});const d=await r.json().catch(()=>({}));if(!r.ok){newsletterLoginError.textContent=d.error||'Não foi possível entrar.';return}setNewsletterToken(d.token);await loadNewsletterClients()}catch(e){newsletterLoginError.textContent='Não foi possível entrar agora.'}finally{newsletterLoginBtn.disabled=false}});
newsletterPassword?.addEventListener('keydown',e=>{if(e.key==='Enter')newsletterLoginBtn?.click()});
newsletterClientGrid?.addEventListener('click',async e=>{const b=e.target.closest('[data-newsletter-client]');if(!b)return;b.disabled=true;const old=b.textContent;b.textContent='Gerando...';try{const r=await fetch(`/api/newsletter/${encodeURIComponent(b.dataset.newsletterClient)}/${encodeURIComponent(b.dataset.newsletterPeriod)}`,{headers:newsletterHeaders()});if(r.status===401){setNewsletterToken('');showNewsletterLogin('Sua sessão expirou. Digite a senha novamente.');return}const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Não foi possível gerar a newsletter.');moduleBulletinTitle.textContent=`Newsletter • ${d.clientName}`;moduleBulletinGenerated.textContent=`${d.count||0} matéria(s)`;moduleBulletinText.value=d.text||'';moduleBulletinModal.hidden=false}catch(err){alert(err.message||'Não foi possível gerar a newsletter.')}finally{b.disabled=false;b.textContent=old}});
