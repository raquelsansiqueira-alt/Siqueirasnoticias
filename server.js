const express = require('express');
const path = require('path');
const Parser = require('rss-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const TZ = 'America/Sao_Paulo';

const parser = new Parser({
  timeout: 20000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; CentralNoticias/3.9.3)',
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
    '"Ministério da Saúde" OR "plano de saúde" OR "planos de saúde" OR ANS',
    'OMS OR "Organização Mundial da Saúde" OR hospital OR hospitais OR "rede hospitalar"',
    '"Rede D\'Or" OR Hapvida OR "Instituto Consenso"',
    'semaglutida OR Ozempic OR Wegovy OR tirzepatida OR Mounjaro',
    'autismo OR TEA OR "transtorno do espectro autista"',
    'câncer OR oncologia OR tumor',
    '"canetas emagrecedoras" OR "caneta emagrecedora"',
    'Ebola OR sarampo OR "doenças transmissíveis"',
    'pandemia OR pandêmica OR pandêmico OR coronavírus OR covid OR "covid-19" OR "SARS-CoV-2"',
    'gripe OR influenza OR H1N1 OR medicina'
  ]
};

const CACHE_TTL_MS = 30 * 1000;


const DIRECT_FEEDS = {
  stf: [
    {source:'Agência Brasil', url:'https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml'},
    {source:'Poder360', url:'https://www.poder360.com.br/feed/'},
    {source:'Migalhas', url:'https://www.migalhas.com.br/rss'},
    {source:'ConJur', url:'https://www.conjur.com.br/feed/'}
  ],
  judiciario: [
    {source:'Agência Brasil', url:'https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml'},
    {source:'Poder360', url:'https://www.poder360.com.br/feed/'},
    {source:'Migalhas', url:'https://www.migalhas.com.br/rss'},
    {source:'ConJur', url:'https://www.conjur.com.br/feed/'}
  ],
  saude: [
    {source:'Agência Brasil', url:'https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml'},
    {source:'Poder360', url:'https://www.poder360.com.br/feed/'}
  ]
};

async function loadDirectFeed(feed) {
  try {
    const response = await fetch(feed.url, {
      headers: {
        'User-Agent':'Mozilla/5.0 (compatible; CentralNoticias/3.9.3)',
        'Accept':'application/rss+xml, application/xml, text/xml, */*'
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return parser.parseString(await response.text());
  } catch (err) {
    console.warn(`Feed direto falhou (${feed.source}):`, err.message);
    return {items:[]};
  }
}

function mapDirectItem(item, module, sourceName, idx) {
  const url = item.link || item.guid;
  if (!url || !/^https?:\/\//i.test(url)) return null;

  const title = String(item.title || 'Sem título').trim();
  const summary = String(item.contentSnippet || item.content || item.description || '')
    .replace(/<[^>]+>/g,' ')
    .replace(/\s+/g,' ')
    .trim();

  if (!moduleMatch(module, `${title} ${summary}`)) return null;

  return {
    id:item.guid || item.id || `direct-${module}-${idx}-${url}`,
    module,
    title,
    source:sourceName,
    url,
    publishedAt:item.isoDate || item.pubDate || new Date().toISOString(),
    summary,
    tags:classify(`${title} ${summary}`)
  };
}

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


function brasiliaIsoFromLocalDate(value='') {
  const text = decodeHtmlEntities(String(value)).trim();

  let m = text.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const [, y, mo, d, h, mi, sec='00'] = m;
    return `${y}-${mo}-${d}T${h}:${mi}:${sec}-03:00`;
  }

  m = text.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s*-\s*|\s+|,\s*|\s+às\s+|\s+as\s+)(\d{2}):(\d{2})(?::(\d{2}))?$/i);
  if (m) {
    const [, d, mo, y, h, mi, sec='00'] = m;
    return `${y}-${mo}-${d}T${h}:${mi}:${sec}-03:00`;
  }

  return null;
}

function extractAgenciaBrasilPublishedTime(html='') {
  // Para a Agência Brasil, prioriza o horário que aparece VISIVELMENTE na matéria.
  // Exemplo: "Publicado em 21/08/2026 - 16:16".
  const plainText = decodeHtmlEntities(
    String(html)
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
  ).trim();

  const visible = plainText.match(
    /Publicado\s+em\s+(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}):(\d{2})(?::(\d{2}))?/i
  );

  if (visible) {
    const [, datePart, hour, minute, second='00'] = visible;
    const [day, month, year] = datePart.split('/');
    const isoBrasilia = `${year}-${month}-${day}T${hour}:${minute}:${second}-03:00`;
    const d = new Date(isoBrasilia);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }

  // Fallback: tenta padrões estruturados somente se o texto visível não estiver disponível.
  const candidates = [];
  const patterns = [
    /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']article:published_time["']/gi,
    /<meta[^>]+itemprop=["']datePublished["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+itemprop=["']datePublished["']/gi,
    /"datePublished"\s*:\s*"([^"]+)"/gi,
    /"dateCreated"\s*:\s*"([^"]+)"/gi
  ];

  for (const pattern of patterns) {
    let m;
    while ((m = pattern.exec(html)) !== null) candidates.push(m[1]);
  }

  for (const candidate of candidates) {
    const raw = decodeHtmlEntities(candidate).trim();

    if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(raw)) {
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }

    const local = brasiliaIsoFromLocalDate(raw);
    if (local) {
      const d = new Date(local);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
  }

  return null;
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
        'User-Agent':'Mozilla/5.0 (compatible; CentralNoticias/3.9.3)',
        'Accept':'text/html,application/xhtml+xml'
      }
    });

    clearTimeout(timer);

    if (response.ok) {
      const html = await response.text();
      published = url.includes('agenciabrasil.ebc.com.br')
        ? extractAgenciaBrasilPublishedTime(html)
        : extractPublishedTimeFromHtml(html);
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
  if (/saude|sus|anvisa|\boms\b|hospital|plano de saude|ministerio da saude|rede d.?or|hapvida|\bans\b|semaglutida|ozempic|wegovy|tirzepatida|mounjaro|autismo|\btea\b|cancer|oncologia|tumor|ebola|sarampo|doencas? transmissiveis?|pandemi|coronavirus|covid|sars-cov-2|gripe|influenza|h1n1|medicina/.test(n)) tags.push('Saúde');
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
  return /saude|sus|anvisa|\boms\b|organizacao mundial da saude|ministerio da saude|plano de saude|saude suplementar|rede hospitalar|hospital|rede d.?or|instituto coalizao saude|instituto consenso|hapvida|\bans\b|agencia nacional de saude suplementar|semaglutida|ozempic|wegovy|tirzepatida|mounjaro|autismo|\btea\b|transtorno do espectro autista|cancer|oncologia|tumor|canetas? emagrecedoras?|ebola|sarampo|doencas? transmissiveis?|pandemi|coronavirus|covid|sars-cov-2|gripe|influenza|h1n1|medicina/.test(n);
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
      'User-Agent':'Mozilla/5.0 (compatible; CentralNoticias/3.9.3)',
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
    const [bingResults, directResults] = await Promise.all([
      Promise.allSettled(QUERIES[module].map(loadFeed)),
      Promise.all((DIRECT_FEEDS[module] || []).map(loadDirectFeed))
    ]);

    const ok = bingResults.filter(r=>r.status==='fulfilled');
    const failed = bingResults.filter(r=>r.status==='rejected');

    if (!ok.length && !(directResults || []).some(r => (r.items || []).length)) {
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

    const directMapped = [];
    (DIRECT_FEEDS[module] || []).forEach((feed, feedIndex) => {
      const parsed = directResults[feedIndex] || {items:[]};
      (parsed.items || []).slice(0,100).forEach((item, idx) => {
        const mappedItem = mapDirectItem(item, module, feed.source, idx);
        if (mappedItem) directMapped.push(mappedItem);
      });
    });

    const merged = [...directMapped, ...mapped];

    const seen = new Set();
    const unique = merged.filter(n=>{
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


const HEALTH_FILTERS = {
  'Hapvida':['hapvida'],
  'Semaglutida':['semaglutida','ozempic','wegovy'],
  'Autismo':['autismo','tea','transtorno do espectro autista'],
  'ANS':['ans','agencia nacional de saude suplementar'],
  'Câncer':['cancer','oncologia','tumor'],
  'Canetas Emagrecedoras':['caneta emagrecedora','canetas emagrecedoras','semaglutida','ozempic','wegovy','tirzepatida','mounjaro'],
  'Ebola':['ebola'],
  'Sarampo':['sarampo'],
  'Doenças Transmissíveis':['doenca transmissivel','doencas transmissiveis'],
  'Pandemias':['pandemia','pandemica','pandemico'],
  'Covid-19':['covid','covid-19','coronavirus','sars-cov-2'],
  'Gripe':['gripe','influenza','h1n1'],
  'Medicina':['medicina'],
  'Ministério da Saúde':['ministerio da saude'],
  'SUS':['sus','sistema unico de saude'],
  'Anvisa':['anvisa','agencia nacional de vigilancia sanitaria'],
  'Planos de Saúde':['plano de saude','planos de saude','saude suplementar'],
  'OMS':['oms','organizacao mundial da saude'],
  'Rede Hospitalar':['hospital','hospitais','rede hospitalar'],
  'Rede D’Or':['rede d or','rede dor'],
  'Instituto Consenso':['instituto consenso']
};

function matchHealthFilter(item, filterName) {
  if (!filterName || !HEALTH_FILTERS[filterName]) return true;
  const hay = normalize(`${item.title} ${item.source} ${item.summary || ''}`);
  return HEALTH_FILTERS[filterName].some(term => hay.includes(normalize(term)));
}

function filterNews(items,q,minister,tag,health) {
  let out = items;
  if (q) {
    const term = normalize(q);
    out = out.filter(n=>normalize(`${n.title} ${n.source} ${n.summary} ${n.tags.join(' ')}`).includes(term));
  }
  if (minister) out = out.filter(n=>n.tags.some(t=>normalize(t)===normalize(minister)));
  if (tag) out = out.filter(n=>n.tags.some(t=>normalize(t)===normalize(tag)));
  if (health) out = out.filter(n=>matchHealthFilter(n,health));
  return out;
}

app.get('/api/config',(_,res)=>{
  res.json({
    sources:SOURCES.map(s=>s.name),
    ministers:MINISTERS.map(m=>({name:m.name,label:m.label})),
    healthFilters:Object.keys(HEALTH_FILTERS)
  });
});

app.get('/api/news',async(req,res)=>{
  const module = ['stf','judiciario','saude'].includes(req.query.module) ? req.query.module : 'stf';
  const items = await fetchModule(module,false);
  const filtered = filterNews(items,req.query.q,req.query.minister,req.query.tag,req.query.health).slice(0,40);
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
  res.json({version:'3.9.3',now:new Date().toISOString(),modules:diagnostics});
});


const FIRST_EDITION_QUERIES = {
  momento: [
    '"política brasileira" OR política Brasil',
    'Lula OR Planalto OR Presidência OR "governo federal"',
    'Congresso OR Senado OR Câmara OR eleições',
    'STF OR "Supremo Tribunal Federal" OR TSE',
    'crise política OR investigação OR "três poderes"'
  ],
  tresPoderes: [
    'STF OR "Supremo Tribunal Federal"',
    '"Alexandre de Moraes" OR "Edson Fachin" OR "Cármen Lúcia"',
    '"Dias Toffoli" OR "Luiz Fux" OR "Gilmar Mendes"',
    '"Flávio Dino" OR "Cristiano Zanin" OR "Nunes Marques" OR "André Mendonça"',
    'STF OR Supremo OR ministro OR ministros',
    'Planalto OR Presidência OR Lula OR Congresso OR Senado OR Câmara'
  ],
  judiciario: [
    'STJ OR "Superior Tribunal de Justiça"',
    'TSE OR "Tribunal Superior Eleitoral"',
    'CNJ OR "Conselho Nacional de Justiça"',
    '"Justiça Federal" OR tribunal OR Judiciário',
    'advocacia OR PGR OR "Ministério Público"'
  ],
  economia: [
    '"economia brasileira" OR inflação OR juros OR Selic',
    'dólar OR Bolsa OR Ibovespa OR mercado',
    'PIB OR emprego OR desemprego OR Tesouro',
    'petróleo OR ouro OR bancos OR crédito'
  ]
};

async function fetchEditorialQueries(queries) {
  const results = await Promise.allSettled(queries.map(loadFeed));
  const feeds = results.filter(r => r.status === 'fulfilled');
  const rawItems = feeds.flatMap(r => r.value.items || []);

  const mapped = rawItems.map((item, idx) => {
    const originalUrl = originalFromBing(item.link);
    if (!originalUrl) return null;

    const source = sourceFromUrl(originalUrl);
    if (!source) return null;

    const title = String(item.title || 'Sem título').trim();
    const summary = String(item.contentSnippet || item.content || item.description || '')
      .replace(/<[^>]+>/g,' ')
      .replace(/\s+/g,' ')
      .trim();

    return {
      id: item.guid || item.id || `editorial-${idx}-${originalUrl}`,
      title,
      source,
      url: originalUrl,
      publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
      summary,
      tags: classify(`${title} ${summary}`)
    };
  }).filter(Boolean);

  const seen = new Set();
  const unique = mapped.filter(n => {
    const key = normalize(`${n.source}|${n.title}`);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const enriched = await enrichPublishedTimes(unique.slice(0,60),60);
  enriched.sort((a,b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  return enriched;
}

function recentEnough(items, hours=24) {
  const now = Date.now();
  const recent = items.filter(n => now - new Date(n.publishedAt).getTime() <= hours*60*60*1000);
  return recent.length ? recent : items;
}

function headlineWords(text='') {
  return normalize(text)
    .replace(/[^a-z0-9\s]/g,' ')
    .split(/\s+/)
    .filter(w => w.length >= 5 && ![
      'sobre','entre','depois','antes','brasil','brasileiro','brasileira',
      'noticia','noticias','governo','afirma','segundo','contra','pode',
      'para','pela','pelos','pelas','mais','como','esta','esse','essa'
    ].includes(w));
}


const POLITICAL_TERMS = [
  'stf','supremo','moraes','fachin','carmen lucia','toffoli','fux','nunes marques',
  'andre mendonca','flavio dino','zanin','gilmar mendes','lula','planalto',
  'presidencia','governo federal','congresso','senado','camara','deputado',
  'deputados','senador','senadores','eleicao','eleicoes','tse','politica',
  'partido','pt','pl','pgr','procuradoria','bolsonaro','ministerio','ministro',
  'ministra','impeachment','constituicao','emenda','veto','sancao','investigacao'
];

const EXCLUDED_MOMENT_TERMS = [
  'futebol','campeonato','brasileirao','libertadores','copa do brasil','gol ',
  'jogador','tecnico','flamengo','corinthians','palmeiras','vasco','botafogo',
  'sao paulo fc','gremio','internacional','cruzeiro','atletico mineiro',
  'celebridade','famoso','famosa','atriz','ator','cantor','cantora','influencer',
  'reality','big brother','bbb','novela','show','cinema','serie','streaming',
  'casamento','namoro','separacao','fofoca'
];

const STF_PRIORITY_TERMS = [
  'stf','supremo','supremo tribunal federal','moraes','fachin','carmen lucia',
  'toffoli','fux','nunes marques','andre mendonca','flavio dino','zanin','gilmar mendes'
];

function containsAny(text, terms) {
  const value = normalize(text);
  return terms.some(term => value.includes(normalize(term)));
}

function isPoliticalMoment(item) {
  const text = `${item.title} ${item.summary || ''}`;
  if (containsAny(text, EXCLUDED_MOMENT_TERMS)) return false;
  return containsAny(text, POLITICAL_TERMS);
}

function stfPriorityScore(item) {
  const text = `${item.title} ${item.summary || ''}`;
  let score = 0;
  for (const term of STF_PRIORITY_TERMS) {
    if (normalize(text).includes(normalize(term))) score += 20;
  }
  const ageHours = Math.max(0, (Date.now() - new Date(item.publishedAt).getTime()) / 3600000);
  score += Math.max(0, 24 - ageHours);
  return score;
}

function selectTresPoderes(items, max, used) {
  const sorted = [...items].sort((a,b) => stfPriorityScore(b) - stfPriorityScore(a));
  return selectEditorial(sorted, max, used);
}

function momentScore(item, allItems) {
  const ageHours = Math.max(0, (Date.now() - new Date(item.publishedAt).getTime()) / 3600000);
  const recency = Math.max(0, 30 - ageHours);

  const words = new Set(headlineWords(item.title));
  let relatedSources = new Set([item.source]);
  let relatedCount = 1;

  for (const other of allItems) {
    if (other === item) continue;
    const otherWords = new Set(headlineWords(other.title));
    let common = 0;
    for (const w of words) if (otherWords.has(w)) common++;
    if (common >= 2) {
      relatedCount++;
      relatedSources.add(other.source);
    }
  }

  // Repercussão em mais veículos pesa bastante; recência desempata.
  return recency + relatedCount*8 + relatedSources.size*10;
}

function selectMoment(items, max, used) {
  const sorted = [...items].sort((a,b) => momentScore(b,items) - momentScore(a,items));
  const selected = [];
  const sources = new Set();

  for (const n of sorted) {
    const key = normalize(`${n.source}|${n.title}`);
    if (used.has(key)) continue;

    // Para os destaques gerais, prioriza variedade de veículos.
    if (sources.has(n.source) && selected.length < max-1) continue;

    selected.push(n);
    sources.add(n.source);
    used.add(key);
    if (selected.length >= max) break;
  }

  return selected;
}

function selectEditorial(items, max, used) {
  const selected = [];
  for (const n of items) {
    const key = normalize(`${n.source}|${n.title}`);
    if (used.has(key)) continue;
    selected.push(n);
    used.add(key);
    if (selected.length >= max) break;
  }
  return selected;
}

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

  const now=new Date();
  let text=`*BOLETIM - ${edition}ª EDIÇÃO*\n_${formatDate(now)}_\n-`;

  // A estrutura editorial especial existe SOMENTE na 1ª edição.
  if (edition===1) {
    const used=new Set();

    const [momentoRaw,tresRaw,judRaw,economiaRaw] = await Promise.all([
      fetchEditorialQueries(FIRST_EDITION_QUERIES.momento),
      fetchEditorialQueries(FIRST_EDITION_QUERIES.tresPoderes),
      fetchEditorialQueries(FIRST_EDITION_QUERIES.judiciario),
      fetchEditorialQueries(FIRST_EDITION_QUERIES.economia)
    ]);

    const momento=recentEnough(momentoRaw,24).filter(isPoliticalMoment);
    const tres=recentEnough(tresRaw,24);
    const jud=recentEnough(judRaw,24);
    const economia=recentEnough(economiaRaw,24);

    const hot=selectMoment(momento,3,used);
    if (hot.length) {
      text+=`\n*Assunto do Momento:*\n${hot.map(newsLine).join('\n')}`;
    }

    const tresSel=selectTresPoderes(tres,5,used);
    if (tresSel.length) {
      text+=`\n*TRÊS PODERES*\n-\n${tresSel.map(newsLine).join('\n')}`;
    }

    const judSel=selectEditorial(jud,5,used);
    if (judSel.length) {
      text+=`\n*ADVOCACIA E JUDICIÁRIO*\n-\n${judSel.map(newsLine).join('\n')}`;
    }

    const ecoSel=selectEditorial(economia,3,used);
    if (ecoSel.length) {
      text+=`\n*ECONOMIA E MERCADO*\n-\n${ecoSel.map(newsLine).join('\n')}`;
    }

    return res.json({edition,text,generatedAt:now.toISOString()});
  }

  // 2ª e 3ª edições: boletins mais robustos, com pelo menos 20 notícias
  // sempre que houver material suficiente disponível.
  const rawItems=await fetchModule('judiciario',false);
  const items=await enrichPublishedTimes(rawItems.slice(0,80),80);
  items.sort((a,b)=>new Date(b.publishedAt)-new Date(a.publishedAt));

  const used=new Set();

  // Primeiro tenta priorizar notícias mais recentes das últimas 12 horas.
  const recent=items.filter(n=>now-new Date(n.publishedAt)<=12*60*60*1000);

  // Se houver menos de 20 recentes, completa com as demais mais novas.
  const recentKeys=new Set(recent.map(n=>normalize(`${n.source}|${n.title}`)));
  const older=items.filter(n=>!recentKeys.has(normalize(`${n.source}|${n.title}`)));

  const pool=[...recent,...older];

  text+=`\n*AJUFE, CNJ, STF, MINISTROS DO STF E STJ*\n-\n`;

  // Meta de 25 matérias, garantindo pelo menos 20 quando disponíveis.
  const selected=selectDiverse(pool,25,used);
  text+=selected.map(newsLine).join('\n');

  res.json({
    edition,
    text,
    generatedAt:now.toISOString(),
    count:selected.length,
    targetMinimum:20
  });
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

app.get('/health',(_,res)=>res.json({ok:true,version:'3.9.3',now:new Date().toISOString()}));
app.get('*',(_,res)=>res.sendFile(path.join(__dirname,'public','index.html')));

app.listen(PORT,()=>{
  console.log(`Central de Notícias v3.9.3 ativa na porta ${PORT}`);
  ['stf','judiciario','saude'].forEach(m=>fetchModule(m,true));
  setInterval(()=>['stf','judiciario','saude'].forEach(m=>fetchModule(m,true)),CACHE_TTL_MS);
});
