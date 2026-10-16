// Perfis, senhas e sessões (login). Dados em data/usuarios.json e data/sessoes.json.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');

const DATA = path.join(__dirname, 'data');
const F_USU = path.join(DATA, 'usuarios.json'), F_SES = path.join(DATA, 'sessoes.json'), AV = path.join(DATA, 'avatares');
fs.mkdirSync(AV, { recursive: true });
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const HEX = /^#[0-9a-f]{6}$/i;

const ler = (f, pad) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return pad; } };
const gravar = (f, d) => { fs.writeFileSync(f + '.tmp', JSON.stringify(d, null, 1)); fs.renameSync(f + '.tmp', f); };

// Primeira execução: cria 4 perfis ainda sem senha (cada pessoa define a sua no primeiro acesso)
const PADRAO = [['#ffc83d', '📚'], ['#e63946', '🦸'], ['#2a9d8f', '🚀'], ['#6a4c93', '🦇']];
let lista = ler(F_USU, null);
if (!lista) {
  lista = PADRAO.map(([cor, emoji], i) => ({ id: i + 1, nome: `Perfil ${i + 1}`, cor, foto: null, senha: null, avatar: { tipo: 'emoji', valor: emoji, fundo: cor } }));
  gravar(F_USU, lista);
}
let sessoes = ler(F_SES, {});

const publico = u => ({ id: u.id, nome: u.nome, cor: u.cor, avatar: u.avatar, foto: u.foto, temSenha: !!u.senha });
const limpoNome = s => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, 30);

// Senhas nunca são guardadas em texto: salvamos "sal:hash" (scrypt)
const hash = (s, sal = crypto.randomBytes(16).toString('hex')) => `${sal}:${crypto.scryptSync(s, sal, 32).toString('hex')}`;
const confere = (s, h) => { const [sal, k] = String(h).split(':'); return crypto.timingSafeEqual(Buffer.from(k, 'hex'), crypto.scryptSync(s, sal, 32)); };

// Após 5 erros seguidos, o perfil fica 1 minuto bloqueado
const falhas = {};
const bloqueado = id => (falhas[id]?.ate || 0) > Date.now();
const errou = id => { const f = falhas[id] ||= { n: 0 }; if (++f.n >= 5) { f.ate = Date.now() + 60000; f.n = 0; } };

const cookies = req => Object.fromEntries((req.headers.cookie || '').split(';').map(c => c.trim().split('=')).filter(p => p[0]));
function abrirSessao(res, uid) {
  const t = crypto.randomBytes(32).toString('hex');
  sessoes[t] = uid; gravar(F_SES, sessoes);
  res.setHeader('Set-Cookie', `sid=${t}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}`);
}
function auth(req, res, next) {
  const u = lista.find(x => x.id === sessoes[cookies(req).sid]);
  if (!u) return res.status(401).json({ erro: 'Entre com o seu perfil' });
  req.uid = u.id; req.usuario = u; next();
}
const apagarFoto = u => { if (u.foto) fs.rmSync(path.join(AV, u.foto), { force: true }); };

function rotas(app) {
  app.use('/avatares', express.static(AV));

  // ---- públicas: escolher perfil, entrar, sair ----
  app.get('/api/perfis', (_, res) => res.json(lista.map(publico)));
  app.post('/api/login', (req, res) => {
    const u = lista.find(x => x.id === +req.body.id);
    if (!u) return res.status(404).json({ erro: 'Perfil não encontrado' });
    if (!u.senha) return res.status(409).json({ erro: 'Primeiro acesso: defina nome e senha' });
    if (bloqueado(u.id)) return res.status(429).json({ erro: 'Muitas tentativas. Aguarde 1 minuto.' });
    if (!confere(String(req.body.senha ?? ''), u.senha)) { errou(u.id); return res.status(403).json({ erro: 'Senha incorreta' }); }
    abrirSessao(res, u.id); res.json(publico(u));
  });
  app.post('/api/primeiro-acesso', (req, res) => {
    const u = lista.find(x => x.id === +req.body.id);
    if (!u || u.senha) return res.status(400).json({ erro: 'Este perfil já foi configurado' });
    const nome = limpoNome(req.body.nome), senha = String(req.body.senha ?? '');
    if (!nome) return res.status(400).json({ erro: 'Informe um nome' });
    if (senha.length < 4) return res.status(400).json({ erro: 'A senha deve ter pelo menos 4 caracteres' });
    u.nome = nome; u.senha = hash(senha); gravar(F_USU, lista);
    abrirSessao(res, u.id); res.json(publico(u));
  });
  app.post('/api/logout', (req, res) => {
    delete sessoes[cookies(req).sid]; gravar(F_SES, sessoes);
    res.setHeader('Set-Cookie', 'sid=; HttpOnly; Path=/; Max-Age=0'); res.status(204).end();
  });

  // ---- tudo abaixo (e todo o resto de /api) exige login ----
  app.use('/api', auth);
  app.get('/api/me', (req, res) => res.json(publico(req.usuario)));
  app.put('/api/me', (req, res) => {
    const u = req.usuario, b = req.body, a = b.avatar || {}, nome = limpoNome(b.nome);
    if (!nome) return res.status(400).json({ erro: 'Informe um nome' });
    if (!HEX.test(b.cor) || !HEX.test(a.fundo)) return res.status(400).json({ erro: 'Cor inválida' });
    if (!['foto', 'emoji', 'iniciais'].includes(a.tipo)) return res.status(400).json({ erro: 'Tipo de imagem inválido' });
    if (a.tipo === 'foto' && !u.foto) return res.status(400).json({ erro: 'Envie uma foto primeiro' });
    if (a.tipo === 'emoji' && !(typeof a.valor === 'string' && a.valor && a.valor.length <= 8)) return res.status(400).json({ erro: 'Figura inválida' });
    u.nome = nome; u.cor = b.cor.toLowerCase();
    u.avatar = { tipo: a.tipo, valor: a.tipo === 'foto' ? u.foto : a.tipo === 'emoji' ? a.valor : null, fundo: a.fundo.toLowerCase() };
    gravar(F_USU, lista); res.json(publico(u));
  });
  app.post('/api/me/foto', express.raw({ type: Object.keys(EXT), limit: '3mb' }), (req, res) => {
    const ext = EXT[req.headers['content-type']], u = req.usuario;
    if (!ext || !Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ erro: 'Envie uma imagem JPEG, PNG ou WebP' });
    const nome = `${u.id}-${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(AV, nome), req.body);
    apagarFoto(u); u.foto = nome; u.avatar = { ...u.avatar, tipo: 'foto', valor: nome };
    gravar(F_USU, lista); res.json(publico(u));
  });
  app.put('/api/me/senha', (req, res) => {
    const u = req.usuario, nova = String(req.body.nova ?? '');
    if (!confere(String(req.body.atual ?? ''), u.senha)) return res.status(403).json({ erro: 'Senha atual incorreta' });
    if (nova.length < 4) return res.status(400).json({ erro: 'A nova senha deve ter pelo menos 4 caracteres' });
    u.senha = hash(nova); gravar(F_USU, lista); res.status(204).end();
  });
}

module.exports = { rotas, auth, ids: () => lista.map(u => u.id), nome: id => lista.find(u => u.id === id)?.nome };
