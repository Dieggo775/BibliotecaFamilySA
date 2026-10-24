# Minha Biblioteca — Etapa 1 (front + back)

## Como rodar
**Com Docker (recomendado):**
1. Nesta pasta, rode: `docker compose up -d --build`
2. Abra http://localhost:3001 (a porta 3000 que aparece no log é a de dentro do container)

**Sem Docker:**
1. Instale o Node.js (versão 18 ou mais nova): https://nodejs.org
2. Nesta pasta, rode: `npm install` e depois `npm start` (para usar outra porta: `PORT=3001 npm start`)
3. Abra http://localhost:3000 (ou a porta escolhida)

## Estrutura
- `server.js`  → API REST (GET/POST/PUT/DELETE em `/api/items`, `/api/stats`) e validação
- `schema.json` → **lista de campos**. Para incluir um dado novo, adicione uma linha aqui:
  ele aparece sozinho no formulário e no CSV (para aparecer na tabela, inclua em `COLS` no `index.html`)
- `public/index.html` → interface (busca, filtros, ordenação, cadastro/edição, exportar CSV)
- `data/items.json` → seus 261 itens da planilha (tudo salvo aqui por enquanto)
- `data/capas/` → imagens das capas (o item guarda só o nome do arquivo). Faça backup desta pasta junto com `items.json`

## Perfis e acesso
- O sistema tem **4 perfis**, cada um com a sua biblioteca e uma senha. No primeiro acesso a pessoa define o nome e a senha.
- O **Perfil 1** recebe os itens que já estavam cadastrados. Quem é dono da coleção deve fazer o primeiro acesso do Perfil 1.
- Em **Meu perfil** (canto superior direito) cada um troca nome, cor do sistema, imagem (foto, figura ou iniciais), cor de fundo da imagem e senha.
- Ao cadastrar um item novo, a caixa de busca do topo mostra o que outros perfis já cadastraram: um clique copia os dados e a capa.
  Os dados pessoais (nível, condição, localização, data de aquisição, observações) nunca são copiados.
- **Esqueceu a senha?** Abra `data/usuarios.json`, troque o valor de `"senha"` daquele perfil por `null` e reinicie o servidor: o perfil volta ao primeiro acesso (os itens são mantidos).
- **Acesso por outros aparelhos:** na mesma rede (Wi-Fi), abra `http://IP-DO-COMPUTADOR:3001` (ex.: `http://192.168.0.10:3001`; sem Docker, use a porta do `npm start`). Se não abrir, libere essa porta no firewall.
- Arquivos novos: `usuarios.js` (login e perfis), `data/usuarios.json`, `data/sessoes.json`, `data/avatares/`.

## Importar capas em lote
Coloque as imagens na pasta do seu perfil, em `importar_capas/perfil-N/` e clique em **Importar capas** na tela principal.
Nomes aceitos: `id-12.jpg` (o mais seguro), ISBN, título ou título + edição. Detalhes em `importar_capas/LEIA-ME.txt`.
O botão também baixa a lista (CSV) dos itens sem capa, já com o nome de arquivo sugerido.

## Etapa 2 (banco de dados)
Todo acesso aos dados passa pelo objeto `repo` em `server.js`. Na etapa 2 basta
trocar esse objeto por uma versão que use o banco; API e interface não mudam.
