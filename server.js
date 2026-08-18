const express = require('express');
const path = require('path');
const Parser = require('rss-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const TZ = 'America/Sao_Paulo';

const parser = new Parser({
  timeout: 20000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; CentralNoticias/3.4)',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*'
  },
  customFields: {
    item: ['News:Source', 'source']
  }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const BING_NEWS = 'https://www.bing.com/news/search';

const SOURCES = [
  {name:'G1', domains:['g1.globo.com']},
  {name:'Globo.com', domains:['globo.com']},
  {name:'O Globo', domains:['oglobo.globo.com']},
  {name:'Estadão', domains:['estadao.com.br']},
  {name:'Valor Econômico', domains:['valor.globo.com']},
  {name:'Correio Braziliense', domains:['correiobraziliense.com.br']},
  {name:'Folha de S.Paulo', domains:['folha.uol.com.br']},
  {name:'CNN Brasil', domains:['cnnbrasil.com.br']},
  {name:'Veja', domains:['veja.abril.com.br']},
  {name:'IstoÉ', domains:['istoe.com.br']},
  {name:'Metrópoles', domains:['metropoles.com']},
  {name:'UOL', domains:['uol.com.br']},
  {name:'JOTA', domains:['jota.info']},
  {name:'BBC News Brasil', domains:['bbc.com','bbc.co.uk']},
  {name:'ConJur', domains:['conjur.com.br']},
  {name:'Migalhas', domains:['migalhas.com.br']},
  {name:'R7', domains:['r7.com']},
  {name:'DW Brasil', domains:['dw.com']},
  {name:'Poder360', domains:['poder360.com.br']},
  {name:'Agência Brasil', domains:['agenciabrasil.ebc.com.br']},
  {name:'O Tempo', domains:['otempo.com.br']},
  {name:'ICL Notícias', domains:['iclnoticias.com.br']},
  {name:'Revista Oeste', domains:['revistaoeste.com']}
];

const MINISTERS = [
  {name:'Edson Fachin', label:'Ministro Edson Fachin', terms:['Edson Fachin','Fachin']},
  {name:'Cármen Lúcia', label:'Ministra Cármen Lúcia', terms:['Cármen Lúcia','Carmen Lucia']},
  {name:'Dias Toffoli', label:'Ministro Dias Toffoli', terms:['Dias Toffoli','Toffoli']},
  {name:'Alexandre de Moraes', label:'Ministro Alexandre de Moraes', terms:['Alexandre de Moraes','Moraes']},
  {name:'Luiz Fux', label:'Ministro Luiz Fux', terms:['Luiz Fux','Fux']},
  {name:'Nunes Marques', label:'Ministro Nunes Marques', terms:['Nunes Marques','Kassio Nunes Marques','Kássio Nunes Marques']},
  {name:'André Mendonça', label:'Ministro André Mendonça', terms:['André Mendonça','Andre Mendonca']},
  {name:'Flávio Dino', label:'Ministro Flávio Dino', terms:['Flávio Dino','Flavio Dino']},
  {name:'Cristiano Zanin', label:'Ministro Cristiano Zanin', terms:['Cristiano Zanin','Zanin']},
  {name:'Gilmar Mendes', label:'Ministro Gilmar Mendes', terms:['Gilmar Mendes']}
];

const QUERIES = {
  stf: [
    '"Supremo Tribunal Federal" OR STF',
    'CNJ OR "Conselho Nacional de Justiça"',
    '"Edson Fachin" OR "Cármen Lúcia" OR "Dias Toffoli"',
    '"Alexandre de Moraes" OR "Luiz Fux" OR "Nunes Marques"',
    '"André Mendonça" OR "Flávio Dino" OR "Cristiano Zanin" OR "Gilmar Mendes"'
  ],
  judiciario: [
    'AJUFE OR "Associação dos Juízes Federais" OR "Justiça Federal"',
    '"Supremo Tribunal Federal" OR STF',
    'CNJ OR "Conselho Nacional de Justiça"',
    'STJ OR "Superior Tribunal de Justiça"',
    '"Edson Fachin" OR "Cármen Lúcia" OR "Dias Toffoli" OR "Alexandre de Moraes"',
    '"Luiz Fux" OR "Nunes Marques" OR "André Mendonça" OR "Flávio Dino" OR "Cristiano Zanin" OR "Gilmar Mendes"'
  ],
  saude: [
    'saúde OR SUS OR Anvisa',
    '"Ministério da Saúde" OR "plano de saúde" OR "planos de saúde"',
    'OMS OR "Organização Mundial da Saúde" OR hospital OR hospitais',
    '"Rede D\'Or" OR "rede hospitalar"',
    '"Instituto Coalizão Saúde" OR "Instituto Consenso"'
  ]
};

const CACHE_TTL_MS = 3 * 60 * 1000;
let cache = {stf:[], judiciario:[], saude:[]};
let cacheAt = {stf:0, judiciario:0, saude:0};
let refreshing = {stf:null, judiciario:null, saude:null};
let diagnostics = {
  stf:{ok:false,count:0,error:null,lastAttempt:null},
  judiciario:{ok:false,count:0,error:null,lastAttempt:null},
  saude:{ok:false,count:0,error:null,lastAttempt:null}
};

const publishedTimeCache = new Map();

function decodeHtmlEntities(value='') {
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function firstValidDate(values) {
  for (const value of values) {
    if (!value) continue;
    const cleaned = decodeHtmlEntities(String(value)).trim();
    const d = new Date(cleaned);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

function extractPublishedTimeFromHtml(html='') {
  const candidates = [];

  // Metatags muito usados pelos portais jornalísticos.
  const metaPatterns = [
    /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']article:published_time["']/gi,
    /<meta[^>]+name=["']date["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']date["']/gi,
    /<meta[^>]+name=["']pubdate["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']pubdate["']/gi,
    /<meta[^>]+itemprop=["']datePublished["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+itemprop=["']datePublished["']/gi
  ];

  for (const pattern of metaPatterns) {
    let m;
    while ((m = pattern.exec(html)) !== null) candidates.push(m[1]);
  }

  // JSON-LD: datePublished é o padrão mais comum em NewsArticle/Article.
  const jsonDate = /"datePublished"\s*:\s*"([^"]+)"/gi;
  let jm;
  while ((jm = jsonDate.exec(html)) !== null) candidates.push(jm[1]);

  // Alguns portais usam dateCreated como data principal quando datePublished não existe.
  const jsonCreated = /"dateCreated"\s*:\s*"([^"]+)"/gi;
  let jc;
  while ((jc = jsonCreated.exec(html)) !== null) candidates.push(jc[1]);

  return firstValidDate(candidates);
}

async function getOriginalPublishedTime(url, fallback) {
  if (!url) return fallback;
  if (publishedTimeCache.has(url)) return publishedTimeCache.get(url);

  let published = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent':'Mozilla/5.0 (compatible; CentralNoticias/3.4)',
        'Accept':'text/html,application/xhtml+xml'
      }
    });

    clearTimeout(timer);

    if (response.ok) {
      const html = await response.text();
      published = extractPublishedTimeFromHtml(html);
    }
  } catch (err) {
    console.warn('Horário original indisponível:', url, err.message);
  }

  const result = published || fallback;
  publishedTimeCache.set(url, result);
  return result;
}

async function enrichPublishedTimes(items, maxItems=40) {
  const selected = items.slice(0, maxItems);
  const output = [];

  // Pequenos lotes para não sobrecarregar os veículos nem o Render.
  for (let i = 0; i < selected.length; i += 5) {
    const batch = selected.slice(i, i + 5);
    const enriched = await Promise.all(batch.map(async item => ({
      ...item,
      publishedAt: await getOriginalPublishedTime(item.url, item.publishedAt)
    })));
    output.push(...enriched);
  }

  return output;
}

function normalize(s='') {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
}

function sourceFromUrl(url='') {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./,'');
    // Ordem importa: domínios mais específicos primeiro.
    const ordered = [...SOURCES].sort((a,b) =>
      Math.max(...b.domains.map(d=>d.length)) - Math.max(...a.domains.map(d=>d.length))
    );
    for (const source of ordered) {
      for (const domain of source.domains) {
        const d = domain.toLowerCase().replace(/^www\./,'');
        if (host === d || host.endsWith('.'+d)) return source.name;
      }
    }
  } catch {}
  return '';
}

function originalFromBing(link='') {
  try {
    const u = new URL(link);
    const host = u.hostname.toLowerCase();
    if (host.endsWith('bing.com') && u.pathname.toLowerCase().includes('/news/apiclick.aspx')) {
      const original = u.searchParams.get('url');
      if (original && /^https?:\/\//i.test(original)) return original;
    }
    if (!host.endsWith('bing.com') && /^https?:\/\//i.test(link)) return link;
  } catch {}
  return null;
}

function classify(text='') {
  const n = normalize(text);
  const tags = [];
  if (/\bstf\b|supremo tribunal federal/.test(n)) tags.push('STF');
  if (/\bcnj\b|conselho nacional de justica/.test(n)) tags.push('CNJ');
  if (/\bstj\b|superior tribunal de justica/.test(n)) tags.push('STJ');
  if (/\bajufe\b|associacao dos juizes federais/.test(n)) tags.push('Ajufe');
  if (/saude|sus|anvisa|\boms\b|hospital|plano de saude|ministerio da saude|rede d.?or/.test(n)) tags.push('Saúde');
  MINISTERS.forEach(m=>{
    if (m.terms.some(t=>n.includes(normalize(t)))) tags.push(m.name);
  });
  return [...new Set(tags)];
}

function moduleMatch(module, text='') {
  const n = normalize(text);
  if (module === 'stf') {
    return /\bstf\b|supremo tribunal federal|\bcnj\b|conselho nacional de justica/.test(n) ||
      MINISTERS.some(m=>m.terms.some(t=>n.includes(normalize(t))));
  }
  if (module === 'judiciario') {
    return /\bajufe\b|associacao dos juizes federais|justica federal|\bstf\b|supremo tribunal federal|\bcnj\b|conselho nacional de justica|\bstj\b|superior tribunal de justica/.test(n) ||
      MINISTERS.some(m=>m.terms.some(t=>n.includes(normalize(t))));
  }
  return /saude|sus|anvisa|\boms\b|organizacao mundial da saude|ministerio da saude|plano de saude|saude suplementar|rede hospitalar|hospital|rede d.?or|instituto coalizao saude|instituto consenso/.test(n);
}

function feedUrl(query) {
  const p = new URLSearchParams({
    q: query,
    format: 'RSS',
    setmkt: 'pt-BR',
    qft: 'interval="7"'
  });
  return `${BING_NEWS}?${p.toString()}`;
}

async function loadFeed(query) {
  const response = await fetch(feedUrl(query), {
    headers: {
      'User-Agent':'Mozilla/5.0 (compatible; CentralNoticias/3.4)',
      'Accept':'application/rss+xml, application/xml, text/xml, */*'
    }
  });
  if (!response.ok) throw new Error(`Bing News respondeu HTTP ${response.status}`);
  const xml = await response.text();
  if (!xml.includes('<rss')) throw new Error('Resposta do Bing não parece ser RSS');
  return parser.parseString(xml);
}

async function fetchModule(module, force=false) {
  const now = Date.now();
  if (!force && cache[module].length && now-cacheAt[module] < CACHE_TTL_MS) return cache[module];
  if (refreshing[module]) return refreshing[module];

  diagnostics[module].lastAttempt = new Date().toISOString();
  diagnostics[module].error = null;

  refreshing[module] = (async()=>{
    const results = await Promise.allSettled(QUERIES[module].map(loadFeed));
    const ok = results.filter(r=>r.status==='fulfilled');
    const failed = results.filter(r=>r.status==='rejected');

    if (!ok.length) {
      throw new Error(failed.map(f=>f.reason?.message || String(f.reason)).join(' | ') || 'Nenhum feed respondeu');
    }

    const rawItems = ok.flatMap(r=>r.value.items || []);
    const mapped = rawItems.map((item, idx)=>{
      const originalUrl = originalFromBing(item.link);
      if (!originalUrl) return null;

      const source = sourceFromUrl(originalUrl);
      if (!source) return null;

      const title = String(item.title || 'Sem título').trim();
      const summary = String(item.contentSnippet || item.content || item.description || '')
        .replace(/<[^>]+>/g,' ')
        .replace(/\s+/g,' ')
        .trim();
      const text = `${title} ${summary}`;

      return {
        id: item.guid || item.id || `${module}-${idx}-${originalUrl}`,
        module,
        title,
        source,
        url: originalUrl,
        publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
        summary,
        tags: classify(text)
      };
    }).filter(Boolean).filter(n=>moduleMatch(module, `${n.title} ${n.summary}`));

    const seen = new Set();
    const unique = mapped.filter(n=>{
      const key = normalize(`${n.source}|${n.title}`);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a,b)=>new Date(b.publishedAt)-new Date(a.publishedAt));

    cache[module] = unique;
    cacheAt[module] = Date.now();
    diagnostics[module] = {
      ok:true,
      count:unique.length,
      error:failed.length ? failed.map(f=>f.reason?.message || String(f.reason)).join(' | ') : null,
      lastAttempt:new Date().toISOString()
    };
    return unique;
  })().catch(err=>{
    console.error(`Erro ao atualizar ${module}:`, err);
    diagnostics[module] = {
      ok:false,
      count:cache[module].length,
      error:err.message,
      lastAttempt:new Date().toISOString()
    };
    return cache[module] || [];
  }).finally(()=>{
    refreshing[module] = null;
  });

  return refreshing[module];
}

function filterNews(items,q,minister,tag) {
  let out = items;
  if (q) {
    const term = normalize(q);
    out = out.filter(n=>normalize(`${n.title} ${n.source} ${n.summary} ${n.tags.join(' ')}`).includes(term));
  }
  if (minister) out = out.filter(n=>n.tags.some(t=>normalize(t)===normalize(minister)));
  if (tag) out = out.filter(n=>n.tags.some(t=>normalize(t)===normalize(tag)));
  return out;
}

app.get('/api/config',(_,res)=>{
  res.json({
    sources:SOURCES.map(s=>s.name),
    ministers:MINISTERS.map(m=>({name:m.name,label:m.label}))
  });
});

app.get('/api/news',async(req,res)=>{
  const module = ['stf','judiciario','saude'].includes(req.query.module) ? req.query.module : 'stf';
  const items = await fetchModule(module,false);
  const filtered = filterNews(items,req.query.q,req.query.minister,req.query.tag).slice(0,40);
  const enriched = await enrichPublishedTimes(filtered,40);
  enriched.sort((a,b)=>new Date(b.publishedAt)-new Date(a.publishedAt));
  res.json(enriched);
});

app.post('/api/refresh',async(req,res)=>{
  const module = ['stf','judiciario','saude'].includes(req.body.module) ? req.body.module : 'stf';
  const items = await fetchModule(module,true);
  res.json({ok:diagnostics[module].ok,module,count:items.length,diagnostics:diagnostics[module]});
});

app.get('/api/status',(_,res)=>{
  res.json({version:'3.4',now:new Date().toISOString(),modules:diagnostics});
});

function formatDate(now) {
  const weekday = new Intl.DateTimeFormat('pt-BR',{weekday:'long',timeZone:TZ}).format(now);
  const date = new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'long',year:'numeric',timeZone:TZ}).format(now);
  return `${weekday.charAt(0).toUpperCase()+weekday.slice(1)}, ${date}`;
}

function newsLine(n) {
  return `*${n.source}* - ${n.title}\n${n.url}\n-`;
}

function selectDiverse(items,max,used=new Set()) {
  const selected=[];
  for (const n of items) {
    const key=normalize(`${n.source}|${n.title}`);
    if (used.has(key)) continue;
    selected.push(n);
    used.add(key);
    if (selected.length>=max) break;
  }
  return selected;
}

app.get('/api/boletim/:edition',async(req,res)=>{
  const edition=Number(req.params.edition);
  if (![1,2,3].includes(edition)) return res.status(400).json({error:'Edição inválida'});

  const rawItems=await fetchModule('judiciario',false);
  const items=await enrichPublishedTimes(rawItems.slice(0,40),40);
  items.sort((a,b)=>new Date(b.publishedAt)-new Date(a.publishedAt));
  const now=new Date();
  const used=new Set();
  const cutoffHours=edition===1?24:8;
  const recent=items.filter(n=>now-new Date(n.publishedAt)<=cutoffHours*60*60*1000);
  const pool=recent.length>=5?recent:items;

  let text=`*BOLETIM - ${edition}ª EDIÇÃO*\n_${formatDate(now)}_\n-`;

  if (edition===1) {
    const hot=selectDiverse(pool,3,used);
    if (hot.length) text+=`\n*ASSUNTO DO MOMENTO*\n-\n${hot.map(newsLine).join('\n')}`;

    const tres=selectDiverse(pool.filter(n=>n.tags.includes('STF')||n.tags.includes('CNJ')||n.tags.some(t=>MINISTERS.some(m=>m.name===t))),5,used);
    if (tres.length) text+=`\n*TRÊS PODERES*\n-\n${tres.map(newsLine).join('\n')}`;

    const jud=selectDiverse(pool.filter(n=>n.tags.includes('STJ')||n.tags.includes('Ajufe')||n.tags.includes('CNJ')),5,used);
    if (jud.length) text+=`\n*ADVOCACIA E JUDICIÁRIO*\n-\n${jud.map(newsLine).join('\n')}`;
  } else {
    text+=`\n*AJUFE, CNJ, STF, MINISTROS DO STF E STJ*\n-\n`;
    text+=selectDiverse(pool,12,used).map(newsLine).join('\n');
  }

  res.json({edition,text,generatedAt:now.toISOString()});
});

app.get('/api/clipping/ministers',async(_,res)=>{
  const items=await fetchModule('stf',false);
  const result=[];
  for (const m of MINISTERS) {
    const ministerItems=items.filter(n=>n.tags.includes(m.name)).slice(0,20);
    const enriched=await enrichPublishedTimes(ministerItems,20);
    enriched.sort((a,b)=>new Date(b.publishedAt)-new Date(a.publishedAt));
    result.push({
      minister:m.name,
      title:`Clipping - ${m.label}`,
      items:enriched
    });
  }
  res.json(result);
});

app.get('/health',(_,res)=>res.json({ok:true,version:'3.4',now:new Date().toISOString()}));
app.get('*',(_,res)=>res.sendFile(path.join(__dirname,'public','index.html')));

app.listen(PORT,()=>{
  console.log(`Central de Notícias v3.4 ativa na porta ${PORT}`);
  ['stf','judiciario','saude'].forEach(m=>fetchModule(m,true));
  setInterval(()=>['stf','judiciario','saude'].forEach(m=>fetchModule(m,true)),CACHE_TTL_MS);
});
