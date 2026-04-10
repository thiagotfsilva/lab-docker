# Laboratorio Docker + Node.js + MySQL

Este projeto e um laboratorio para praticar containerizacao de uma aplicacao Node.js com banco MySQL, separando responsabilidades em:

- `Dockerfile.dev` para construir a imagem de desenvolvimento
- `docker-compose.dev.yaml` para subir app + banco
- `external-api/docker-compose-external-api.yaml` para simular uma API externa
- `start.sh` para bootstrap do container da aplicacao
- `.env` para variaveis de ambiente

Este laboratorio foi pensado para elevar seu nivel de forma progressiva: cada configuracao foi escolhida para demonstrar, na pratica, diferentes possibilidades de uso do Docker no desenvolvimento.

## Objetivo do laboratorio

Ao final, voce sera capaz de:

- construir uma imagem Node customizada para desenvolvimento
- orquestrar servicos com Docker Compose
- conectar aplicacao ao MySQL por variaveis de ambiente
- integrar com uma API externa em container separado
- entender quando usar rede padrao, rede externa e `host.docker.internal`

## Estrutura do projeto

```text
.
|- Dockerfile.dev
|- docker-compose.dev.yaml
|- start.sh
|- .env
|- src/
|  |- index.js
|- external-api/
|  |- api.json
|  |- docker-compose-external-api.yaml
```

## Etapa 1 - Dockerfile de desenvolvimento

Arquivo: `Dockerfile.dev`

### Dockerfile atual

```dockerfile
FROM node:24.11.0-slim

ARG NODEMON_VERSION=3.1.7

RUN apt update && \
   apt install -y curl && \
   npm install -g nodemon@${NODEMON_VERSION}

COPY start.sh /
RUN chmod +x /start.sh

USER node
WORKDIR /home/node/app

EXPOSE 3000
CMD [ "/start.sh" ]
```

### Estrategia de cache (como melhorar)

No estado atual, o projeto privilegia simplicidade de laboratorio. Para acelerar rebuilds, use a ordem abaixo:

1. Copiar primeiro manifestos de dependencias.
2. Rodar instalacao de dependencias.
3. Copiar o restante do codigo.

Exemplo:

```dockerfile
FROM node:24.11.0-slim

ARG NODEMON_VERSION=3.1.7

RUN apt update && \
   apt install -y curl && \
   npm install -g nodemon@${NODEMON_VERSION}

WORKDIR /home/node/app

COPY package*.json ./
RUN npm ci

COPY . .

USER node
EXPOSE 3000
CMD [ "npm", "start" ]
```

Beneficio: quando voce altera apenas codigo em `src`, a camada de `npm ci` continua em cache e o build fica bem mais rapido.

### Estrategia de seguranca com usuario dedicado

Seu Dockerfile ja usa o usuario `node`, o que e uma boa pratica. Em imagens que nao trazem esse usuario pronto, a ideia e criar um usuario sem privilegios e rodar a app com ele.

Exemplo em Debian/Ubuntu:

```dockerfile
RUN useradd -m -u 1000 appuser
USER appuser
```

Exemplo em Alpine:

```dockerfile
RUN adduser -D -u 1000 appuser
USER appuser
```

Boas praticas complementares:

- evitar executar `npm` como root
- limitar pacotes do sistema ao minimo necessario
- evitar copiar segredos para dentro da imagem

## Etapa 2 - Script de inicializacao

Arquivo: `start.sh`

```bash
#!/bin/bash

npm install

tail -f /dev/null
```

### O que ele faz hoje

- instala dependencias a cada subida do container
- mantem o container vivo com `tail -f /dev/null`

### Observacao importante

Com essa configuracao, o app **nao sobe automaticamente**. Para rodar a aplicacao dentro do container web:

```bash
docker compose -f docker-compose.dev.yaml exec web npm start
```

## Etapa 3 - Compose principal (app + banco)

Arquivo: `docker-compose.dev.yaml`

### Servico `web`

- build local com `Dockerfile.dev`
- argumento de build: `NODEMON_VERSION`
- bind mount do codigo: `.:/home/node/app`
- porta publicada: `3000:3000`
- le variaveis de `.env`
- depende do `db` com `condition: service_healthy`

### Servico `db`

- imagem `mysql:8.0.30-debian`
- variaveis:
  - `MYSQL_ROOT_PASSWORD=root`
  - `MYSQL_DATABASE=mydb`
- healthcheck com `mysqladmin ping`

### Conceitos praticados

- dependencia com healthcheck
- variaveis de ambiente por arquivo
- volume de codigo para desenvolvimento

## Etapa 4 - Variaveis de ambiente

Arquivo: `.env`

```env
DB_HOST=db
DB_USER=root
DB_PASSWORD=root
DB_NAME=mydb
```

### Como sao usadas

No endpoint `/test-db`, o Node usa essas variaveis para abrir conexao MySQL:

- host: `DB_HOST`
- usuario: `DB_USER`
- senha: `DB_PASSWORD`
- database: `DB_NAME`

## Etapa 5 - API externa simulada

Arquivo: `external-api/docker-compose-external-api.yaml`

Esse compose sobe um container Node com `json-server` na porta `9000`:

```bash
npx json-server --watch api.json --host 0.0.0.0 --port 9000
```

Isso permite testar integracao sem depender de API real.

## Etapa 6 - Subindo o laboratorio

### 1. Subir app + banco

Na raiz do projeto:

```bash
docker compose -f docker-compose.dev.yaml up --build -d
```

### 2. Subir API externa

Entrar na pasta `external-api` e subir:

```bash
cd external-api
docker compose -f docker-compose-external-api.yaml up -d
```

### 3. Iniciar app Node no container web

De volta a raiz:

```bash
cd ..
docker compose -f docker-compose.dev.yaml exec web npm start
```

## Etapa 7 - Testes dos endpoints

Com tudo em execucao:

- App online:

```bash
curl http://localhost:3000/
```

- Teste de banco:

```bash
curl http://localhost:3000/test-db
```

- Teste de API externa:

```bash
curl http://localhost:3000/external-api
```

## Etapa 8 - Rede entre projetos (compose separados)

Atualmente, o endpoint `/external-api` usa:

```js
const address = 'http://external-api:9000/products';
```

Esse host so funciona se os containers estiverem na mesma rede Docker.

Voce tem duas abordagens:

### Opcao A - Rede externa compartilhada (recomendada para laboratorio)

1. Criar rede:

```bash
docker network create my-external-network
```

2. Descomentar e ajustar os blocos `networks` nos dois arquivos compose para usar essa rede.

3. Subir novamente os dois ambientes.

### Opcao B - Acessar via host

No `src/index.js`, trocar para:

```js
const address = 'http://host.docker.internal:9000/products';
```

Essa opcao depende de suporte ao `host.docker.internal` no seu ambiente.

## Comandos uteis

- Ver containers:

```bash
docker ps
```

- Ver logs do web:

```bash
docker compose -f docker-compose.dev.yaml logs -f web
```

- Entrar no container web:

```bash
docker compose -f docker-compose.dev.yaml exec web bash
```

- Derrubar ambiente principal:

```bash
docker compose -f docker-compose.dev.yaml down
```

- Derrubar API externa:

```bash
cd external-api
docker compose -f docker-compose-external-api.yaml down
```

## Desafios sugeridos (proximos passos)

1. Alterar `start.sh` para iniciar automaticamente com `npm start`.
2. Persistir dados do MySQL com volume nomeado.
3. Criar endpoint que faz insert/select em tabela real.
4. Unificar tudo em um unico compose com profiles (`app`, `external-api`).
5. Adicionar `healthcheck` para o servico `web`.
