const home = document.querySelector('#home');
const panel = document.querySelector('#panel');
const list = document.querySelector('#newsList');
const search = document.querySelector('#search');
const boletimControls = document.querySelector('#boletimControls');
const ministerFilters = document.querySelector('#ministerFilters');
const dialog = document.querySelector('#boletimDialog');
const boletimText = document.querySelector('#boletimText');
const loading = document.querySelector('#loading');

let currentModule = null;
let currentMinister = '';
let refreshTimer = null;
let config = {sources:[], ministers:[]};

const labels = {
  stf: ['STF • CNJ • Ministros', 'Monitoramento em atualização contínua'],
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

async function getOriginalUrl(url){
  if(!url.includes('news.google.com')) return url;
  try{
    const r = await fetch(`/api/link?url=${encodeURIComponent(url)}`);
    const d = await r.json();
    return d.url || url;
  }catch{ return url; }
}

async function loadConfig(){
  const res = await fetch('/api/config');
  config = await res.json();
  document.querySelector('#sourcesText').textContent = config.sources.join(', ') + '.';

  ministerFilters.innerHTML = `
    <button class="filter active" data-minister="">Todos</button>
    <button class="filter" data-tag="STF">STF</button>
    <button class="filter" data-tag="CNJ">CNJ</button>
    ${config.ministers.map(m=>`<button class="filter" data-minister="${escapeHtml(m.name)}">${escapeHtml(m.name)}</button>`).join('')}
  `;
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

async function loadNews(){
  if(!currentModule) return;
  loading.classList.remove('hidden');
  try{
    const q = encodeURIComponent(search.value.trim());
    const minister = encodeURIComponent(currentMinister);
    const tag = encodeURIComponent(ministerFilters.dataset.tag || '');
    const res = await fetch(`/api/news?module=${currentModule}&q=${q}&minister=${minister}&tag=${tag}`);
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
    const url = await getOriginalUrl(n.url);
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
  ministerFilters.querySelectorAll('.filter').forEach((b,i)=>b.classList.toggle('active',i===0));
  home.classList.remove('active');
  panel.classList.add('active');
  document.querySelector('#panelTitle').textContent = labels[currentModule][0];
  document.querySelector('#panelEyebrow').textContent = labels[currentModule][1];
  boletimControls.classList.toggle('hidden', currentModule !== 'judiciario');
  ministerFilters.classList.toggle('hidden', currentModule !== 'stf');
  search.value='';
  loadNews();
  clearInterval(refreshTimer);
  refreshTimer=setInterval(loadNews,60000);
}));

document.querySelector('#back').addEventListener('click',()=>{
  clearInterval(refreshTimer);
  currentModule=null;
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
