# Central de Notícias v3.0

Versão com coleta via Bing News RSS.

A aplicação extrai o link original da matéria diretamente do parâmetro `url`
dos links RSS do Bing. Assim, o painel, os botões e os boletins usam URLs
originais dos veículos e não dependem de decodificação do Google News.

## Arquivos principais
- server.js
- package.json
- public/

## Render
Build Command: npm install
Start Command: node server.js

## Diagnóstico
Abra `/api/status` no fim da URL do Render.


## v3.1 — horário original
O sistema abre a página original da matéria e procura a data/hora publicada em
`article:published_time`, `datePublished`, `date`, `pubdate` ou `dateCreated`.
O horário do RSS do Bing só é usado como fallback quando o veículo não fornece
a data de publicação em metadados acessíveis.
