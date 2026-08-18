const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const newsPath = path.join(__dirname, 'data', 'news.json');

function readNews() {
  try { return JSON.parse(fs.readFileSync(newsPath, 'utf8')); }
  catch { return []; }
}

app.get('/api/news', (req, res) => {
  const { module, q } = req.query;
  let items = readNews();
  if (module) items = items.filter(n => n.module === module);
  if (q) {
    const term = q.toLowerCase();
    items = items.filter(n => `${n.title} ${n.source} ${n.tags.join(' ')}`.toLowerCase().includes(term));
  }
  items.sort((a,b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  res.json(items);
});

app.get('/api/boletim/:edition', (req, res) => {
  const edition = Number(req.params.edition);
  if (![1,2,3].includes(edition)) return res.status(400).json({error:'Edição inválida'});
  const all = readNews();
  const judicial = all.filter(n => n.module === 'judiciario');
  const now = new Date();
  const weekday = new Intl.DateTimeFormat('pt-BR',{weekday:'long', timeZone:'America/Sao_Paulo'}).format(now);
  const date = new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'long',year:'numeric', timeZone:'America/Sao_Paulo'}).format(now);
  const cap = s => s.charAt(0).toUpperCase()+s.slice(1);
  let text = `*BOLETIM - ${edition}ª EDIÇÃO*\n\n_${cap(weekday)}, ${date}_\n\n-\n`;
  if (edition === 1) text += `\n*ASSUNTO DO MOMENTO*\n\n`;
  judicial.slice(0, edition === 1 ? 10 : 8).forEach(n => {
    text += `*${n.source}* - ${n.title}\n${n.url}\n\n-\n`;
  });
  res.json({edition, text});
});

app.get('*', (_, res) => res.sendFile(path.join(__dirname,'public','index.html')));

app.listen(PORT, () => console.log(`Central de Notícias: http://localhost:${PORT}`));
