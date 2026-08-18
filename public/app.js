const home = document.querySelector('#home');
const panel = document.querySelector('#panel');
const list = document.querySelector('#newsList');
const search = document.querySelector('#search');
const boletimControls = document.querySelector('#boletimControls');
const dialog = document.querySelector('#boletimDialog');
const boletimText = document.querySelector('#boletimText');
let currentModule = null;
let refreshTimer = null;

const labels = {
  stf: ['STF • CNJ • Ministros', 'Monitoramento em tempo real'],
  judiciario: ['Boletins Judiciário', 'Ajufe • CNJ • STF • Ministros • STJ'],
  saude: ['Saúde', 'Saúde • Planos • OMS • SUS • Anvisa • Rede D’Or']
};

function brDate(iso){
  return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(iso));
}

async function loadNews(){
  if(!currentModule) return;
  const moduleParam = currentModule === 'judiciario' ? 'judiciario' : currentModule;
  const q = encodeURIComponent(search.value.trim());
  const res = await fetch(`/api/news?module=${moduleParam}&q=${q}`);
  const items = await res.json();
  document.querySelector('#lastUpdate').textContent = new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'medium',timeZone:'America/Sao_Paulo'}).format(new Date());
  render(items);
}

function render(items){
  if(!items.length){ list.innerHTML = `<div class="empty">Nenhuma notícia encontrada neste módulo.</div>`; return; }
  list.innerHTML = items.map(n => `
    <article class="news-card">
      <div class="news-meta"><strong>${n.source}</strong><span>•</span><span>${brDate(n.publishedAt)}</span></div>
      <h3>${n.title}</h3>
      <div class="tags">${n.tags.map(t=>`<span class="tag">${t}</span>`).join('')}</div>
      <div class="actions">
        <a href="${n.url}" target="_blank" rel="noopener">Ler notícia</a>
        <button onclick='copyItem(${JSON.stringify(JSON.stringify({title:n.title,url:n.url}))})'>Copiar título + link</button>
        <a href="https://wa.me/?text=${encodeURIComponent(n.title+'\n'+n.url)}" target="_blank" rel="noopener">WhatsApp</a>
      </div>
    </article>`).join('');
}

window.copyItem = async payload => {
  const n = JSON.parse(payload);
  await navigator.clipboard.writeText(`${n.title}\n${n.url}`);
};

document.querySelectorAll('[data-open]').forEach(btn => btn.addEventListener('click',()=>{
  currentModule = btn.dataset.open;
  home.classList.remove('active'); panel.classList.add('active');
  document.querySelector('#panelTitle').textContent = labels[currentModule][0];
  document.querySelector('#panelEyebrow').textContent = labels[currentModule][1];
  boletimControls.classList.toggle('hidden', currentModule !== 'judiciario');
  search.value=''; loadNews();
  clearInterval(refreshTimer); refreshTimer=setInterval(loadNews,60000);
}));

document.querySelector('#back').addEventListener('click',()=>{
  clearInterval(refreshTimer); currentModule=null; panel.classList.remove('active'); home.classList.add('active');
});
search.addEventListener('input',()=>loadNews());

document.querySelectorAll('[data-edition]').forEach(btn=>btn.addEventListener('click',async()=>{
  const res=await fetch(`/api/boletim/${btn.dataset.edition}`); const data=await res.json();
  boletimText.value=data.text; dialog.showModal();
}));
document.querySelector('#closeDialog').addEventListener('click',()=>dialog.close());
document.querySelector('#copyBoletim').addEventListener('click',async()=>navigator.clipboard.writeText(boletimText.value));
