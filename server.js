const express = require('express');
const path = require('path');
const Parser = require('rss-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; CentralNoticias/2.0; +https://render.com)'
  }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const TZ = 'America/Sao_Paulo';
const GOOGLE_NEWS = 'https://news.google.com/rss/search';

const SOURCES = [
  {name:'G1', aliases:['G1','g1'], domains:['g1.globo.com']},
  {name:'Globo.com', aliases:['Globo.com','Globo'], domains:['globo.com']},
  {name:'O Globo', aliases:['O Globo'], domains:['oglobo.globo.com']},
  {name:'Estadão', aliases:['Estadão','Estadão.com','O Estado de S. Paulo'], domains:['estadao.com.br']},
  {name:'Valor Econômico', aliases:['Valor Econômico','Valor'], domains:['valor.globo.com']},
  {name:'Correio Braziliense', aliases:['Correio Braziliense'], domains:['correiobraziliense.com.br']},
  {name:'Folha de S.Paulo', aliases:['Folha de S.Paulo','Folha de S. Paulo','Folha'], domains:['folha.uol.com.br']},
  {name:'CNN Brasil', aliases:['CNN Brasil'], domains:['cnnbrasil.com.br']},
  {name:'Veja', aliases:['Veja'], domains:['veja.abril.com.br']},
  {name:'IstoÉ', aliases:['IstoÉ','ISTOÉ'], domains:['istoe.com.br']},
  {name:'Metrópoles', aliases:['Metrópoles','Metropoles'], domains:['metropoles.com']},
  {name:'UOL', aliases:['UOL'], domains:['uol.com.br']},
  {name:'JOTA', aliases:['JOTA'], domains:['jota.info']},
  {name:'BBC News Brasil', aliases:['BBC News Brasil','BBC Brasil'], domains:['bbc.com']},
  {name:'ConJur', aliases:['Consultor Jurídico','ConJur'], domains:['conjur.com.br']},
  {name:'Migalhas', aliases:['Migalhas'], domains:['migalhas.com.br']},
  {name:'R7', aliases:['R7'], domains:['r7.com']},
  {name:'DW Brasil', aliases:['DW Brasil','DW'], domains:['dw.com']},
  {name:'Poder360', aliases:['Poder360','Poder 360'], domains:['poder360.com.br']},
  {name:'Agência Brasil', aliases:['Agência Brasil','Agencia Brasil'], domains:['agenciabrasil.ebc.com.br']},
  {name:'O Tempo', aliases:['O Tempo'], domains:['otempo.com.br']},
  {name:'ICL Notícias', aliases:['ICL Notícias','ICL Noticias'], domains:['iclnoticias.com.br']},
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

const TOPICS = {
  stf: [
    '"Supremo Tribunal Federal"', 'STF', 'CNJ', '"Conselho Nacional de Justiça"',
    ...MINISTERS.flatMap(m => m.terms.map(t => `"${t}"`))
  ],
  judiciario: [
    'AJUFE', '"Associação dos Juízes Federais"', '"Justiça Federal"',
    '"Supremo Tribunal Federal"', 'STF', 'CNJ', '"Conselho Nacional de Justiça"',
    'STJ', '"Superior Tribunal de Justiça"',
    ...MINISTERS.flatMap(m => m.terms.map(t => `"${t}"`))
  ],
  saude: [
    'saúde', '"plano de saúde"', '"planos de saúde"', 'OMS',
    '"Organização Mundial da Saúde"', '"Ministério da Saúde"', 'SUS',
    'Anvisa', '"Rede D\'Or"', '"rede hospitalar"', 'hospital', 'hospitais',
    '"Instituto Coalizão Saúde"', '"Instituto Consenso"'
  ]
};

const CACHE_TTL_MS = 3 * 60 * 1000;
let cache = { stf: [], judiciario: [], saude: [] };
let cacheAt = { stf: 0, judiciario: 0, saude: 0 };
let refreshing = { stf: null, judiciario: null, saude: null };

function normalize(s='') {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
}

function canonicalSource(raw='') {
  const n = normalize(raw);
  const found = SOURCES.find(s => s.aliases.some(a => n === normalize(a) || n.includes(normalize(a))));
  return found ? found.name : raw || 'Fonte';
}

function allowedSource(raw='') {
  const n = normalize(raw);
  return SOURCES.some(s => s.aliases.some(a => n === normalize(a) || n.includes(normalize(a))));
}

function classify(text='') {
  const n = normalize(text);
  const tags = [];
  if (/\bstf\b|supremo tribunal federal/.test(n)) tags.push('STF');
  if (/\bcnj\b|conselho nacional de justica/.test(n)) tags.push('CNJ');
  if (/\bstj\b|superior tribunal de justica/.test(n)) tags.push('STJ');
  if (/\bajufe\b|associacao dos juizes federais/.test(n)) tags.push('Ajufe');
  if (/saude|sus|anvisa|oms|hospital|plano de saude|ministerio da saude|rede d.?or/.test(n)) tags.push('Saúde');
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
  return /saude|sus|anvisa|\boms\b|organizacao mundial da saude|ministerio da saude|plano de saude|rede hospitalar|hospital|rede d.?or|instituto coalizao saude|instituto consenso/.test(n);
}

function buildFeedUrl(module) {
  const q = TOPICS[module].join(' OR ');
  const params = new URLSearchParams({
    q,
    hl: 'pt-BR',
    gl: 'BR',
    ceid: 'BR:pt-419'
  });
  return `${GOOGLE_NEWS}?${params.toString()}`;
}

function cleanTitle(title='', source='') {
  const suffix = ` - ${source}`;
  return title.endsWith(suffix) ? title.slice(0, -suffix.length).trim() : title.trim();
}

async function resolveOriginalUrl(url) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 7000);
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {'User-Agent':'Mozilla/5.0'}
    });
    clearTimeout(timer);
    if (res.url && !res.url.includes('news.google.com')) return res.url;
  } catch {}
  return url;
}

async function fetchModule(module, force=false) {
  const now = Date.now();
  if (!force && cache[module].length && now - cacheAt[module] < CACHE_TTL_MS) return cache[module];
  if (refreshing[module]) return refreshing[module];

  refreshing[module] = (async () => {
    const feed = await parser.parseURL(buildFeedUrl(module));
    const raw = (feed.items || []).slice(0, 200);

    const mapped = raw.map((item, idx) => {
      const rawSource = item.source || item.creator || '';
      const source = canonicalSource(rawSource);
      const title = cleanTitle(item.title || 'Sem título', rawSource);
      const summary = item.contentSnippet || item.content || '';
      const text = `${title} ${summary}`;
      return {
        id: item.guid || item.id || `${module}-${idx}-${item.link}`,
        module,
        title,
        source,
        rawSource,
        url: item.link,
        publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
        summary: summary.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim(),
        tags: classify(text)
      };
    }).filter(n => allowedSource(n.rawSource || n.source) && moduleMatch(module, `${n.title} ${n.summary}`));

    const seen = new Set();
    const unique = mapped.filter(n => {
      const k = normalize(`${n.source}|${n.title}`);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).sort((a,b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    cache[module] = unique;
    cacheAt[module] = Date.now();
    return unique;
  })().catch(err => {
    console.error(`Erro ao atualizar ${module}:`, err.message);
    return cache[module] || [];
  }).finally(() => {
    refreshing[module] = null;
  });

  return refreshing[module];
}

async function ensureFresh(module) {
  return fetchModule(module, false);
}

function filterNews(items, q, minister, tag) {
  let out = items;
  if (q) {
    const term = normalize(q);
    out = out.filter(n => normalize(`${n.title} ${n.source} ${n.summary} ${n.tags.join(' ')}`).includes(term));
  }
  if (minister) {
    out = out.filter(n => n.tags.some(t => normalize(t) === normalize(minister)));
  }
  if (tag) {
    out = out.filter(n => n.tags.some(t => normalize(t) === normalize(tag)));
  }
  return out;
}

app.get('/api/config', (_, res) => {
  res.json({
    sources: SOURCES.map(s => s.name),
    ministers: MINISTERS.map(m => ({name:m.name, label:m.label}))
  });
});

app.get('/api/news', async (req, res) => {
  try {
    const module = ['stf','judiciario','saude'].includes(req.query.module) ? req.query.module : 'stf';
    const items = await ensureFresh(module);
    res.json(filterNews(items, req.query.q, req.query.minister, req.query.tag));
  } catch (err) {
    res.status(500).json({error:'Falha ao carregar notícias', detail:err.message});
  }
});

app.post('/api/refresh', async (req, res) => {
  const module = ['stf','judiciario','saude'].includes(req.body.module) ? req.body.module : 'stf';
  const items = await fetchModule(module, true);
  res.json({ok:true, module, count:items.length, updatedAt:new Date().toISOString()});
});

app.get('/api/link', async (req, res) => {
  const url = String(req.query.url || '');
  if (!url.startsWith('https://news.google.com/')) return res.json({url});
  res.json({url: await resolveOriginalUrl(url)});
});

function formatDate(now) {
  const weekday = new Intl.DateTimeFormat('pt-BR',{weekday:'long', timeZone:TZ}).format(now);
  const date = new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'long',year:'numeric', timeZone:TZ}).format(now);
  return `${weekday.charAt(0).toUpperCase()+weekday.slice(1)}, ${date}`;
}

function newsLine(n) {
  const note = n.summary ? `\n_${n.summary.slice(0,180).trim()}${n.summary.length>180?'…':''}_` : '';
  return `*${n.source}* - ${n.title}${note}\n${n.url}\n\n-`;
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

  const items = await ensureFresh('judiciario');
  const now = new Date();
  const used = new Set();

  const cutoffHours = edition === 1 ? 24 : 8;
  const recent = items.filter(n => now - new Date(n.publishedAt) <= cutoffHours*60*60*1000);
  const pool = recent.length >= 5 ? recent : items;

  let text = `*BOLETIM - ${edition}ª EDIÇÃO*\n\n_${formatDate(now)}_\n\n-\n`;

  if (edition === 1) {
    const hot = selectDiverse(pool, 3, used);
    if (hot.length) {
      text += `\n*ASSUNTO DO MOMENTO*\n\n${hot.map(newsLine).join('\n\n')}\n`;
    }

    const tres = selectDiverse(pool.filter(n => n.tags.includes('STF') || n.tags.includes('CNJ') || n.tags.some(t => MINISTERS.some(m => m.name===t))), 5, used);
    if (tres.length) text += `\n\n*TRÊS PODERES*\n\n-\n\n${tres.map(newsLine).join('\n\n')}`;

    const jud = selectDiverse(pool.filter(n => n.tags.includes('STJ') || n.tags.includes('Ajufe') || n.tags.includes('CNJ')), 5, used);
    if (jud.length) text += `\n\n*ADVOCACIA E JUDICIÁRIO*\n\n-\n\n${jud.map(newsLine).join('\n\n')}`;

    const extra = selectDiverse(pool, 3, used);
    if (extra.length) text += `\n\n*ECONOMIA E MERCADO*\n\n-\n\n${extra.map(newsLine).join('\n\n')}`;
  } else {
    text += `\n*AJUFE, CNJ, STF, MINISTROS DO STF E STJ*\n\n-\n\n`;
    text += selectDiverse(pool, 12, used).map(newsLine).join('\n\n');
  }

  res.json({edition, text, generatedAt:now.toISOString()});
});

app.get('/api/clipping/ministers', async (_, res) => {
  const items = await ensureFresh('stf');
  const result = MINISTERS.map(m => ({
    minister: m.name,
    title: `Clipping - ${m.label}`,
    items: items.filter(n => n.tags.includes(m.name)).slice(0,20)
  }));
  res.json(result);
});

app.get('/health', (_, res) => res.json({ok:true, now:new Date().toISOString()}));

app.get('*', (_, res) => res.sendFile(path.join(__dirname,'public','index.html')));

app.listen(PORT, () => {
  console.log(`Central de Notícias v2 ativa na porta ${PORT}`);
  ['stf','judiciario','saude'].forEach(m => fetchModule(m, true));
  setInterval(() => {
    ['stf','judiciario','saude'].forEach(m => fetchModule(m, true));
  }, CACHE_TTL_MS);
});
