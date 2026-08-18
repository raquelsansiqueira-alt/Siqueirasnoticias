# Central de Notícias v2

Painel com três módulos:

1. STF / CNJ / Ministros — atualização automática.
2. Boletins do Judiciário — 08h, 13h e 18h.
3. Saúde — SUS, Anvisa, OMS, planos, hospitais, Rede D'Or etc.

## Como atualizar o GitHub

Substitua os arquivos antigos pelos arquivos desta pasta, mantendo:
- `package.json`
- `server.js`
- pasta `public/`

Não envie o ZIP para dentro do repositório. Descompacte primeiro.

## Render

Build Command:
`npm install`

Start Command:
`node server.js`

## Como a coleta funciona

A aplicação consulta o Google News RSS, filtra pelos veículos cadastrados e pelos assuntos dos três módulos.
O servidor mantém cache por 3 minutos e o navegador atualiza a lista a cada 60 segundos.

Observação: alguns links do Google News podem abrir primeiro uma página de redirecionamento do Google. O painel tenta resolver o link original antes de abrir/copiar/compartilhar.

## Ministros monitorados

- Edson Fachin
- Cármen Lúcia
- Dias Toffoli
- Alexandre de Moraes
- Luiz Fux
- Nunes Marques
- André Mendonça
- Flávio Dino
- Cristiano Zanin
- Gilmar Mendes
