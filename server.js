const express = require('express');
const path = require('path');
const Parser = require('rss-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const TZ = 'America/Sao_Paulo';

const parser = new Parser({
  timeout: 20000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; CentralNoticias/2.1)'
  },
  customFields: {
    item: ['source']
  }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const GOOGLE_NEWS = 'https://news.google.com/rss/search';

const SOURCES = [
  {name:'G1', aliases:['G1','g1'], domains:['g1.globo.com']},
  {name:'Globo.com', aliases:['Globo.com','Globo'], domains:['globo.com']},
  {name:'O Globo', aliases:['O Globo'], domains:['oglobo.globo.com']},
  {name:'Estadão', aliases:['Estadão','Estadao','O Estado de S. Paulo'], domains:['estadao.com.br']},
  {name:'Valor Econômico', aliases:['Valor Econômico','Valor Economico','Valor'], domains:['valor.globo.com']},
  {name:'Correio Braziliense', aliases:['Correio Braziliense'], domains:['correiobraziliense.com.br']},
  {name:'Folha de S.Paulo', aliases:['Folha de S.Paulo','Folha de S. Paulo','Folha'], domains:['folha.uol.com.br']},
  {name:'CNN Brasil', aliases:['CNN Brasil'], domains:['cnnbrasil.com.br']},
  {name:'Veja', aliases:['Veja'], domains:['veja.abril.com.br']},
  {name:'IstoÉ', aliases:['IstoÉ','ISTOÉ','IstoE'], domains:['istoe.com.br']},
  {name:'Metrópoles', aliases:['Metrópoles','Metropoles'], domains:['metropoles.com']},
  {name:'UOL', aliases:['UOL'], domains:['uol.com.br']},
  {name:'JOTA', aliases:['JOTA'], domains:['jota.info']},
  {name:'BBC News Brasil', aliases:['BBC News Brasil','BBC Brasil','BBC'], domains:['bbc.com']},
  {name:'ConJur', aliases:['Consultor Jurídico','Consultor Juridico','ConJur'], domains:['conjur.com.br']},
  {name:'Migalhas', aliases:['Migalhas'], domains:['migalhas.com.br']},
  {name:'R7', aliases:['R7'], domains:['r7.com']},
  {name:'DW Brasil', aliases:['DW Brasil','DW'], domains:['dw.com']},
  {name:'Poder360', aliases:['Poder360','Poder 360'], domains:['poder360.com.br']},
  {name:'Agência Brasil', aliases:['Agência Brasil','Agencia Brasil'], domains:['agenciabrasil.ebc.com.br']},
  {name:'O Tempo', aliases:['O Tempo'], domains:['otempo.com.br']},
  {name:'ICL Notícias', aliases:['ICL Notícias','ICL Noticias','ICL'], domains:['iclnoticias.com.br']},
  {name:'Revista Oeste', aliases:['Revista Oeste','Oeste'], domains:['revistaoeste.com']}
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

// As buscas foram divididas em blocos menores para evitar URLs gigantes e melhorar a estabilidade.
const QUERIES = {
  stf: [
    '"Supremo Tribunal Federal" OR STF OR CNJ OR "Conselho Nacional de Justiça"',
    '"Edson Fachin" OR "Cármen Lúcia" OR "Dias Toffoli" OR "Alexandre de Moraes"',
    '"Luiz Fux" OR "Nunes Marques" OR "André Mendonça"',
    '"Flávio Dino" OR "Cristiano Zanin" OR "Gilmar Mendes"'
  ],
  judiciario: [
    'AJUFE OR "Associação dos Juízes Federais" OR "Justiça Federal"',
    '"Supremo Tribunal Federal" OR STF OR CNJ OR "Conselho Nacional de Justiça"',
    'STJ OR "Superior Tribunal de Justiça"',
    '"Edson Fachin" OR "Cármen Lúcia" OR "Dias Toffoli" OR "Alexandre de Moraes"',
    '"Luiz Fux" OR "Nunes Marques" OR "André Mendonça" OR "Flávio Dino" OR "Cristiano Zanin" OR "Gilmar Mendes"'
  ],
  saude: [
    'saúde OR SUS OR Anvisa OR "Ministério da Saúde"',
    '"plano de saúde" OR "planos de saúde" OR "saúde suplementar"',
    'OMS OR "Organização Mundial da Saúde" OR hospital OR hospitais OR "rede hospitalar"',
    '"Rede D\'Or" OR "Instituto Coalizão Saúde" OR "Instituto Consenso"'
  ]
};

const CACHE_TTL_MS = 3 * 60 * 1000;
let cache = { stf: [], judiciario: [], saude: [] };
let cacheAt = { stf: 0, judiciario: 0, saude: 0 };
let refreshing = { stf: null, judiciario: null, saude: null };
let diagnostics = {
  stf:{ok:false,count:0,error:null,lastAttempt:null},
  judiciario:{ok:false,count:0,error:null,lastAttempt:null},
  saude:{ok:false,count:0,error:null,lastAttempt:null}
};

function normalize(s='') {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
}

function splitGoogleTitle(title='') {
  // O Google News normalmente usa: "Título da matéria - Nome do veículo".
  const parts = String(title).split(' - ');
  if (parts.length < 2) return {title:String(title).trim(), source:''};
  const possibleSource = parts[parts.length - 1].trim();
  return {
    title: parts.slice(0, -1).join(' - ').trim(),
    source: possibleSource
  };
}

function extractRawSource(item) {
  if (typeof item.source === 'string' && item.source.trim()) return item.source.trim();
  if (item.source && typeof item.source === 'object') {
    if (item.source._) return String(item.source._).trim();
    if (item.source.title) return String(item.source.title).trim();
  }
  return splitGoogleTitle(item.title || '').source;
}

function canonicalSource(raw='') {
  const n = normalize(raw);
  if (!n) return '';
  const found = SOURCES.find(s =>
    s.aliases.some(a => n === normalize(a) || n.includes(normalize(a)) || normalize(a).includes(n))
  );
  return found ? found.name : '';
}

function cleanTitle(itemTitle='', rawSource='') {
  const parsed = splitGoogleTitle(itemTitle);
  if (rawSource && parsed.source && normalize(parsed.source) === normalize(rawSource)) return parsed.title;
  return parsed.source ? parsed.title : String(itemTitle).trim();
}

function classify(text='') {
  const n = normalize(text);
  const tags = [];
  if (/\bstf\b|supremo tribunal federal/.test(n)) tags.push('STF');
  if (/\bcnj\b|conselho nacional de justica/.test(n)) tags.push('CNJ');
  if (/\bstj\b|superior tribunal de justica/.test(n)) tags.push('STJ');
  if (/\bajufe\b|associacao dos juizes federais/.test(n)) tags.push('Ajufe');
  if (/saude|sus|anvisa|\boms\b|hospital|plano de saude|ministerio da saude|rede d.?or/.test(n)) tags.push('Saúde');
  MINISTERS.forEach(m => {
    if (m.terms.some(t => n.includes(normalize(t)))) tags.push(m.name);
  });
  return [...new Set(tags)];
}

function moduleMatch(module, text='') {
  const n = normalize(text);
  if (module === 'stf') {
    return /\bstf\b|supremo tribunal federal|\bcnj\b|conselho nacional de justica/.test(n) ||
      MINISTERS.some(m => m.terms.some(t => n.includes(normalize(t))));
  }
  if (module === 'judiciario') {
    return /\bajufe\b|associacao dos juizes federais|justica federal|\bstf\b|supremo tribunal federal|\bcnj\b|conselho nacional de justica|\bstj\b|superior tribunal de justica/.test(n) ||
      MINISTERS.some(m => m.terms.some(t => n.includes(normalize(t))));
  }
  return /saude|sus|anvisa|\boms\b|organizacao mundial da saude|ministerio da saude|plano de saude|saude suplementar|rede hospitalar|hospital|rede d.?or|instituto coalizao saude|instituto consenso/.test(n);
}


async function resolveOriginalUrl(url) {
  if (!url || !url.includes('news.google.com')) return url;
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: {'User-Agent':'Mozilla/5.0'}
    });
    // In many Google News RSS links, following the redirect reaches the publisher.
    if (response.url && !response.url.includes('news.google.com')) return response.url;
  } catch (err) {
    console.warn('Não foi possível resolver URL original:', err.message);
  }
  return url;
}

async function resolveUrls(items, limit=30) {
  const slice = items.slice(0, limit);
  const resolved = await Promise.all(slice.map(async n => ({
    ...n,
    url: await resolveOriginalUrl(n.url)
  })));
  return resolved.concat(items.slice(limit));
}

function feedUrl(query) {
  const params = new URLSearchParams({
    q: query,
    hl: 'pt-BR',
    gl: 'BR',
    ceid: 'BR:pt-419'
  });
  return `${GOOGLE_NEWS}?${params.toString()}`;
}

async function loadFeed(query) {
  // Usar fetch + parseString dá mensagens de erro mais claras que parseURL.
  const response = await fetch(feedUrl(query), {
    headers: {
      'User-Agent':'Mozilla/5.0 (compatible; CentralNoticias/2.1)',
      'Accept':'application/rss+xml, application/xml, text/xml, */*'
    }
  });
  if (!response.ok) throw new Error(`Google News respondeu HTTP ${response.status}`);
  const xml = await response.text();
  if (!xml.includes('<rss') && !xml.includes('<feed')) throw new Error('Resposta recebida não parece ser RSS/Atom');
  return parser.parseString(xml);
}

async function fetchModule(module, force=false) {
  const now = Date.now();
  if (!force && cache[module].length && now - cacheAt[module] < CACHE_TTL_MS) return cache[module];
  if (refreshing[module]) return refreshing[module];

  diagnostics[module].lastAttempt = new Date().toISOString();
  diagnostics[module].error = null;

  refreshing[module] = (async () => {
    const results = await Promise.allSettled(QUERIES[module].map(loadFeed));
    const successful = results.filter(r => r.status === 'fulfilled');
    const failures = results.filter(r => r.status === 'rejected');

    if (!successful.length) {
      const errors = failures.map(f => f.reason?.message || String(f.reason)).join(' | ');
      throw new Error(errors || 'Nenhum feed respondeu');
    }

    const allItems = successful.flatMap(r => r.value.items || []);
    const mapped = allItems.map((item, idx) => {
      const rawSource = extractRawSource(item);
      const source = canonicalSource(rawSource);
      const title = cleanTitle(item.title || 'Sem título', rawSource);
      const summary = String(item.contentSnippet || item.content || '')
        .replace(/<[^>]+>/g,' ')
        .replace(/\s+/g,' ')
        .trim();
      const text = `${title} ${summary}`;
      return {
        id: item.guid || item.id || `${module}-${idx}-${item.link}`,
        module,
        title,
        source,
        rawSource,
        url: item.link,
        publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
        summary,
        tags: classify(text)
      };
    }).filter(n => n.source && moduleMatch(module, `${n.title} ${n.summary}`));

    const seen = new Set();
    const unique = mapped.filter(n => {
      const key = normalize(`${n.source}|${n.title}`);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a,b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    cache[module] = unique;
    cacheAt[module] = Date.now();
    diagnostics[module] = {
      ok:true,
      count:unique.length,
      error:failures.length ? failures.map(f => f.reason?.message || String(f.reason)).join(' | ') : null,
      lastAttempt:new Date().toISOString()
    };
    return unique;
  })().catch(err => {
    console.error(`Erro ao atualizar ${module}:`, err);
    diagnostics[module] = {
      ok:false,
      count:cache[module].length,
      error:err.message,
      lastAttempt:new Date().toISOString()
    };
    return cache[module] || [];
  }).finally(() => {
    refreshing[module] = null;
  });

  return refreshing[module];
}

function filterNews(items, q, minister, tag) {
  let out = items;
  if (q) {
    const term = normalize(q);
    out = out.filter(n => normalize(`${n.title} ${n.source} ${n.summary} ${n.tags.join(' ')}`).includes(term));
  }
  if (minister) out = out.filter(n => n.tags.some(t => normalize(t) === normalize(minister)));
  if (tag) out = out.filter(n => n.tags.some(t => normalize(t) === normalize(tag)));
  return out;
}

app.get('/api/config', (_, res) => {
  res.json({
    sources: SOURCES.map(s => s.name),
    ministers: MINISTERS.map(m => ({name:m.name, label:m.label}))
  });
});

app.get('/api/news', async (req, res) => {
  const module = ['stf','judiciario','saude'].includes(req.query.module) ? req.query.module : 'stf';
  const items = await fetchModule(module, false);
  res.json(filterNews(items, req.query.q, req.query.minister, req.query.tag));
});

app.post('/api/refresh', async (req, res) => {
  const module = ['stf','judiciario','saude'].includes(req.body.module) ? req.body.module : 'stf';
  const items = await fetchModule(module, true);
  res.json({ok:diagnostics[module].ok, module, count:items.length, updatedAt:new Date().toISOString(), diagnostics:diagnostics[module]});
});

app.get('/api/status', (_, res) => {
  res.json({
    version:'2.2',
    now:new Date().toISOString(),
    modules:diagnostics
  });
});

function formatDate(now) {
  const weekday = new Intl.DateTimeFormat('pt-BR',{weekday:'long', timeZone:TZ}).format(now);
  const date = new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'long',year:'numeric', timeZone:TZ}).format(now);
  return `${weekday.charAt(0).toUpperCase()+weekday.slice(1)}, ${date}`;
}

function newsLine(n) {
  return `*${n.source}* - ${n.title}
${n.url}
-`;
}

function selectDiverse(items, max, used=new Set()) {
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

app.get('/api/boletim/:edition', async (req, res) => {
  const edition = Number(req.params.edition);
  if (![1,2,3].includes(edition)) return res.status(400).json({error:'Edição inválida'});

  const rawItems = await fetchModule('judiciario', false);
  const items = await resolveUrls(rawItems, 40);
  const now = new Date();
  const used = new Set();
  const cutoffHours = edition === 1 ? 24 : 8;
  const recent = items.filter(n => now - new Date(n.publishedAt) <= cutoffHours*60*60*1000);
  const pool = recent.length >= 5 ? recent : items;

  let text = `*BOLETIM - ${edition}ª EDIÇÃO*\n_${formatDate(now)}_\n-`;

  if (edition === 1) {
    const hot = selectDiverse(pool, 3, used);
    if (hot.length) text += `\n*ASSUNTO DO MOMENTO*\n-\n${hot.map(newsLine).join('\n')}`;

    const tres = selectDiverse(pool.filter(n => n.tags.includes('STF') || n.tags.includes('CNJ') || n.tags.some(t => MINISTERS.some(m => m.name === t))), 5, used);
    if (tres.length) text += `\n*TRÊS PODERES*\n-\n${tres.map(newsLine).join('\n')}`;

    const jud = selectDiverse(pool.filter(n => n.tags.includes('STJ') || n.tags.includes('Ajufe') || n.tags.includes('CNJ')), 5, used);
    if (jud.length) text += `\n*ADVOCACIA E JUDICIÁRIO*\n-\n${jud.map(newsLine).join('\n')}`;
  } else {
    text += `\n*AJUFE, CNJ, STF, MINISTROS DO STF E STJ*\n-\n`;
    text += selectDiverse(pool, 12, used).map(newsLine).join('\n');
  }

  res.json({edition, text, generatedAt:now.toISOString()});
});

app.get('/api/clipping/ministers', async (_, res) => {
  const items = await fetchModule('stf', false);
  res.json(MINISTERS.map(m => ({
    minister:m.name,
    title:`Clipping - ${m.label}`,
    items:items.filter(n => n.tags.includes(m.name)).slice(0,20)
  })));
});

app.get('/health', (_, res) => res.json({ok:true,version:'2.2',now:new Date().toISOString()}));
app.get('*', (_, res) => res.sendFile(path.join(__dirname,'public','index.html')));

app.listen(PORT, () => {
  console.log(`Central de Notícias v2.2 ativa na porta ${PORT}`);
  ['stf','judiciario','saude'].forEach(m => fetchModule(m, true));
  setInterval(() => ['stf','judiciario','saude'].forEach(m => fetchModule(m, true)), CACHE_TTL_MS);
});
