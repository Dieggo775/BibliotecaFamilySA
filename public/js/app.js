const $ = s => document.querySelector(s);
const api = (u, o = {}) => fetch(u, { headers: { 'Content-Type': 'application/json' }, ...o })
  .then(async r => {
    if (!r.ok) { const e = await r.json().catch(() => ({})); if (r.status === 401) mostrarLogin(); throw new Error(e.erro || 'Erro'); }
    return r.status === 204 ? null : r.json();
  });
let schema, itens = [], sort = { k: 'titulo', d: 1 }, sel = null, modo = 'lista', eu = null, ligado = false;
const campos = () => schema.grupos.flatMap(g => g.campos);
const COLS = [['titulo','Título'],['tipo','Tipo'],['editora','Editora'],['edicao','Nº'],['ano','Ano'],['roteiro','Roteiro'],['nivel','Nível'],['preco_capa','Preço']];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const brl = n => n == null ? '' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const celular = () => matchMedia('(max-width: 700px)').matches;

// Chamada a cada login: carrega a biblioteca do perfil que entrou
async function entrar(p) {
  eu = p; aplicarTema();
  $('#login').hidden = true; $('#app').hidden = false;
  schema ??= await api('/api/schema');
  sel = null; modo = 'lista'; $('#modo').textContent = 'Ver galeria'; $('#layout').classList.remove('aberto');
  $('#q').value = ''; ['#fTipo', '#fEditora', '#fAno', '#fCapa'].forEach(s => $(s).value = '');
  sort = { k: 'titulo', d: 1 }; filtros(false);
  await carregar();
  if (ligado) return; // os botões só precisam ser ligados uma vez
  ligado = true;
  $('#thead').innerHTML = '<tr><th></th>' + COLS.map(([k,l]) => `<th data-k="${k}">${l}<span id="s-${k}"></span></th>`).join('') + '</tr>';
  $('#thead').onclick = e => { const k = e.target.closest('th')?.dataset.k; if (!k) return; sort = { k, d: sort.k === k ? -sort.d : 1 }; render(); };
  // no celular não há cabeçalho de tabela: a ordenação fica neste seletor
  $('#ordem').innerHTML = COLS.flatMap(([k, l]) => [`<option value="${k}:1">Ordenar: ${l} ↑</option>`, `<option value="${k}:-1">Ordenar: ${l} ↓</option>`]).join('');
  $('#ordem').oninput = e => { const [k, d] = e.target.value.split(':'); sort = { k, d: +d }; render(); };
  $('#filtrosBtn').onclick = () => filtros($('#filtrosBtn').getAttribute('aria-expanded') !== 'true');
  ['#q','#fTipo','#fEditora','#fAno','#fCapa'].forEach(s => $(s).oninput = render);
  $('#novo').onclick = () => abrir();
  $('#csv').onclick = exportar;
  $('#eu').onclick = abrirPerfil;
  $('#impBtn').onclick = abrirImportar;
  $('#modo').onclick = () => { modo = modo === 'lista' ? 'galeria' : 'lista'; $('#modo').textContent = modo === 'lista' ? 'Ver galeria' : 'Ver lista'; render(); };
  $('#gal').onclick = e => { const c = e.target.closest('[data-id]'); if (c) selecionar(+c.dataset.id); };
  document.onkeydown = e => { if (e.key === 'Escape' && sel && !$('#dlg').open) fechar(); };
  window.onpopstate = () => { if (sel != null) fechar(); }; // botão "voltar" do celular fecha os detalhes
  render(); // no primeiro login o cabeçalho só existe agora, então carregar() não desenhou a lista
}

// Painel de filtros (só aparece no celular)
function filtros(abrir) {
  $('#bar').classList.toggle('aberta', abrir);
  $('#filtrosBtn').setAttribute('aria-expanded', abrir);
}

async function carregar() {
  itens = await api('/api/items');
  const opts = (sel, vals, todos) => { const v = $(sel).value; $(sel).innerHTML = `<option value="">${todos}</option>` + vals.map(x => `<option>${esc(x)}</option>`).join(''); $(sel).value = v; };
  opts('#fTipo', schema.tipos, 'Todos os tipos');
  opts('#fEditora', [...new Set(itens.map(i => i.editora).filter(Boolean))].sort(), 'Todas as editoras');
  opts('#fAno', [...new Set(itens.map(i => i.ano).filter(Boolean))].sort((a,b) => b - a), 'Todos os anos');
  const valor = itens.reduce((s, i) => s + (i.preco_capa || 0), 0);
  const eds = new Set(itens.map(i => i.editora).filter(Boolean)).size;
  $('#stats').innerHTML = `<div><b>${itens.length}</b><span>itens</span></div><div><b>${eds}</b><span>editoras</span></div><div><b>${brl(valor)}</b><span>em preço de capa</span></div>`;
  if ($('#thead').innerHTML) render();
  if (sel) mostrarDet();
}

function filtrados() {
  const q = norm($('#q').value), t = $('#fTipo').value, e = $('#fEditora').value, a = $('#fAno').value, cp = $('#fCapa').value;
  return itens.filter(i => (!cp || (cp === 'sem') === !i.capa) && (!t || i.tipo === t) && (!e || i.editora === e) && (!a || String(i.ano) === a) &&
    (!q || norm(Object.values(i).join(' ')).includes(q)))
    .sort((x, y) => {
      const a = x[sort.k], b = y[sort.k];
      if (a == null) return 1; if (b == null) return -1;
      return (typeof a === 'number' ? a - b : String(a).localeCompare(String(b), 'pt-BR', { numeric: true })) * sort.d;
    });
}

function render() {
  const l = filtrados();
  const gal = modo === 'galeria';
  $('#wrap').hidden = gal; $('#gal').hidden = !gal;
  const n = ['#fTipo', '#fEditora', '#fAno', '#fCapa'].filter(s => $(s).value).length;
  $('#filtrosBtn').textContent = n ? `Filtros (${n})` : 'Filtros';
  $('#ordem').value = `${sort.k}:${sort.d}`;
  if (gal) {
    $('#gal').innerHTML = l.length ? l.map(i => `<figure class="card${i.id === sel ? ' sel' : ''}" data-id="${i.id}">${i.capa ? `<img loading="lazy" alt="Capa de ${esc(i.titulo)}" src="/capas/${esc(i.capa)}">` : '<div class="ph">Sem capa</div>'}<b>${esc(i.titulo)}</b><small>${esc([i.editora, i.ano, i.edicao && '#' + i.edicao].filter(Boolean).join(' · '))}</small></figure>`).join('') : '<p class="vazio">Nenhum item encontrado.</p>';
    $('#info').textContent = `Mostrando ${l.length} de ${itens.length} itens`; return;
  }
  COLS.forEach(([k]) => $('#s-' + k).textContent = sort.k === k ? (sort.d > 0 ? ' ▲' : ' ▼') : '');
  $('#tbody').innerHTML = l.length ? l.map(i => `<tr data-id="${i.id}"${i.id === sel ? ' class="sel"' : ''}>
    <td>${i.capa ? `<a href="/capas/${esc(i.capa)}" target="_blank"><img class="th" loading="lazy" alt="Capa de ${esc(i.titulo)}" src="/capas/${esc(i.capa)}"></a>` : '<div class="sem"></div>'}</td>
    <td class="t">${esc(i.titulo)}${i.subtitulo ? `<small>${esc(i.subtitulo)}</small>` : ''}</td>
    <td><span class="tag">${esc(i.tipo)}</span></td><td>${esc(i.editora)}</td><td>${esc(i.edicao)}</td><td>${esc(i.ano)}</td>
    <td>${esc(i.roteiro)}</td><td class="st" title="Nível ${i.nivel ?? '-'}">${i.nivel ? '★'.repeat(i.nivel) : ''}</td><td>${brl(i.preco_capa)}</td></tr>`).join('')
    : '<tr><td colspan="9" class="vazio">Nenhum item encontrado. Ajuste a busca ou adicione um novo item.</td></tr>';
  $('#info').textContent = `Mostrando ${l.length} de ${itens.length} itens`;
}

$('#tbody').onclick = e => {
  if (e.target.closest('a')) return;
  const tr = e.target.closest('tr[data-id]'); if (tr) selecionar(+tr.dataset.id);
};

async function excluir(i) {
  if (!confirm(`Excluir "${i.titulo}"? Essa ação não pode ser desfeita.`)) return;
  await api('/api/items/' + i.id, { method: 'DELETE' }); fechar(); carregar();
}
function selecionar(id) {
  if (sel == null && celular()) history.pushState({ det: 1 }, ''); // detalhes em tela cheia: "voltar" deve fechá-los
  sel = id; mostrarDet(); render();
}
function fechar() {
  sel = null; $('#layout').classList.remove('aberto'); render();
  if (history.state?.det) history.back();
}

function mostrarDet() {
  const i = itens.find(x => x.id === sel);
  if (!i) return fechar();
  const fmt = (c, v) => c.k === 'preco_capa' ? brl(v) : c.k === 'nivel' ? '★'.repeat(v) + ` (${v})` : c.k === 'data_aquisicao' ? esc(String(v).split('-').reverse().join('/')) : esc(v);
  const grupos = schema.grupos.map(g => {
    const cs = g.campos.filter(c => i[c.k] != null && c.k !== 'titulo' && c.k !== 'subtitulo');
    return cs.length ? `<h3>${g.nome}</h3><dl>${cs.map(c => `<dt>${c.l}</dt><dd>${fmt(c, i[c.k])}</dd>`).join('')}</dl>` : '';
  }).join('');
  $('#det').innerHTML = `<button class="x" id="fechar" aria-label="Fechar detalhes">✕</button>
    ${i.capa ? `<a href="/capas/${esc(i.capa)}" target="_blank"><img class="big" alt="Capa de ${esc(i.titulo)}" src="/capas/${esc(i.capa)}"></a>` : `<div class="big ph">Sem capa. Salve a imagem como id-${i.id}.jpg na pasta importar_capas</div>`}
    <h2>${esc(i.titulo)}</h2>${i.subtitulo ? `<p class="sub">${esc(i.subtitulo)}</p>` : ''}
    <p class="sub">ID <b>${i.id}</b></p>
    <div class="acts"><button id="ed">Editar</button><button class="del" id="ex">Excluir</button></div>${grupos}`;
  $('#fechar').onclick = fechar; $('#ed').onclick = () => abrir(i); $('#ex').onclick = () => excluir(i);
  $('#layout').classList.add('aberto');
}

function abrir(it = null) {
  const v = it || { tipo: schema.tipos[0] };
  const dl = campos().filter(c => c.sug).map(c => `<datalist id="dl-${c.k}">${[...new Set(itens.map(i => i[c.k]).filter(Boolean))].sort().map(x => `<option value="${esc(x)}">`).join('')}</datalist>`).join('');
  const campo = c => {
    const val = esc(v[c.k]);
    let el;
    if (c.t === 'select') el = `<select name="${c.k}">${schema[c.opcoes].map(o => `<option${o === v[c.k] ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    else if (c.t === 'textarea') el = `<textarea name="${c.k}" rows="3">${val}</textarea>`;
    else el = `<input name="${c.k}" type="${c.t}" value="${val}" ${c.req ? 'required' : ''} ${c.sug ? `list="dl-${c.k}"` : ''} ${c.step ? `step="${c.step}"` : ''} ${c.min ? `min="${c.min}" max="${c.max}"` : ''}>`;
    return `<label${c.t === 'textarea' ? ' class="full"' : ''}>${c.l}${el}</label>`;
  };
  let novaCapa = null, tirarCapa = false;
  const capaHtml = `<div class="capa">${it?.capa ? `<img id="prev" alt="Capa" src="/capas/${esc(it.capa)}">` : '<div class="sem" id="prev"></div>'}<div><input type="file" id="arq" accept="image/*"><button type="button" id="rm">Remover capa</button></div></div>`;
  $('#form').innerHTML = `<h2>${it ? 'Editar item' : 'Novo item'}</h2>${it ? '' : CAT}${capaHtml}${dl}` +
    schema.grupos.map(g => `<fieldset><legend>${g.nome}</legend><div class="g">${g.campos.map(campo).join('')}</div></fieldset>`).join('') +
    `<div class="fim"><span id="msg"></span><button type="button" id="cancelar">Cancelar</button><button class="pri" type="submit">Salvar</button></div>`;
  $('#cancelar').onclick = () => $('#dlg').close();
  const mostrar = url => $('#prev').replaceWith(Object.assign(url ? document.createElement('img') : document.createElement('div'), url ? { src: url, id: 'prev', alt: 'Capa' } : { id: 'prev', className: 'sem' }));
  $('#arq').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { novaCapa = await reduzir(f); tirarCapa = false; mostrar(URL.createObjectURL(novaCapa)); }
    catch { $('#msg').textContent = 'Não foi possível ler essa imagem'; }
  };
  $('#rm').onclick = () => { novaCapa = null; tirarCapa = true; $('#arq').value = ''; mostrar(null); };
  if (!it) { // busca no catálogo: copia dados (e capa) do que outra pessoa já cadastrou
    let t, achados = [];
    $('#cq').onkeydown = e => { if (e.key === 'Enter') e.preventDefault(); };
    $('#cq').oninput = e => {
      clearTimeout(t); const q = e.target.value.trim();
      t = setTimeout(async () => {
        if (q.length < 2) { $('#cres').innerHTML = ''; return; }
        achados = await api('/api/catalogo?q=' + encodeURIComponent(q)).catch(() => []);
        $('#cres').innerHTML = achados.length ? achados.map((c, n) => `<button type="button" data-n="${n}"${c.jaTenho ? ' disabled' : ''}>
          ${c.capa ? `<img src="/capas/${esc(c.capa)}" alt="">` : '<span class="sem"></span>'}
          <span><b>${esc(c.titulo)}</b>${c.subtitulo ? ' · ' + esc(c.subtitulo) : ''}<small>${esc([c.editora, c.ano, c.edicao && 'nº ' + c.edicao].filter(Boolean).join(' · '))}
          — cadastrado por ${esc(c.quem.join(', '))}${c.jaTenho ? ' (já está na sua biblioteca)' : ''}</small></span></button>`).join('')
          : '<small>Ninguém cadastrou nada parecido. Preencha normalmente abaixo.</small>';
      }, 250);
    };
    $('#cres').onclick = async e => {
      const b = e.target.closest('button[data-n]'); if (!b) return;
      const c = achados[+b.dataset.n];
      campos().filter(f => !f.pessoal).forEach(f => { const el = $('#form').elements[f.k]; if (el) el.value = c[f.k] ?? ''; });
      if (c.capa) { try { novaCapa = await (await fetch('/capas/' + c.capa)).blob(); tirarCapa = false; mostrar(URL.createObjectURL(novaCapa)); } catch { /* segue sem capa */ } }
      $('#cres').innerHTML = `<small class="okm">Dados copiados de ${esc(c.quem.join(', '))}. Confira, preencha os dados pessoais (nível, condição, localização…) e salve.</small>`;
      $('#cq').value = '';
    };
  }
  $('#form').onsubmit = async e => {
    e.preventDefault();
    try {
      const dados = Object.fromEntries([...new FormData(e.target)].filter(([k]) => k !== 'arq'));
      const salvo = await api(it ? '/api/items/' + it.id : '/api/items', { method: it ? 'PUT' : 'POST', body: JSON.stringify(dados) });
      if (novaCapa) {
        const r = await fetch(`/api/items/${salvo.id}/capa`, { method: 'POST', headers: { 'Content-Type': novaCapa.type }, body: novaCapa });
        if (!r.ok) throw new Error('Item salvo, mas a capa não foi enviada');
      } else if (tirarCapa && it?.capa) await api(`/api/items/${salvo.id}/capa`, { method: 'DELETE' });
      $('#dlg').close(); carregar();
    } catch (err) { $('#msg').textContent = err.message; }
  };
  $('#dlg').showModal();
}

// Reduz a imagem (máx. 900 px) e converte para JPEG antes de enviar
async function reduzir(file) {
  const bmp = await createImageBitmap(file), s = Math.min(1, 900 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
}

function baixar(nome, lin) {
  const csv = lin.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = nome; a.click();
}
function exportar() {
  const cs = campos(), lin = [['id', ...cs.map(c => c.l)]];
  filtrados().forEach(i => lin.push([i.id, ...cs.map(c => i[c.k] ?? '')]));
  baixar('biblioteca.csv', lin);
}

// Importação de capas em lote (pasta importar_capas)
async function abrirImportar() {
  const { arquivos, pasta } = await api('/api/capas/pendentes');
  const sem = itens.filter(i => !i.capa);
  $('#impc').innerHTML = `<h2>Importar capas</h2>
    <p>1. Coloque as imagens (JPG, PNG ou WebP) na pasta <code>${esc(pasta)}</code>.</p>
    <p>2. Nomeie cada arquivo com <code>id-NÚMERO</code> (ex.: <code>id-12.jpg</code>) ou com o título exato da revista.</p>
    <p>3. Clique em Importar agora.</p>
    <p><b>${arquivos.length}</b> imagem(ns) esperando na pasta. <b>${sem.length}</b> item(ns) sem capa.</p>
    <div id="res"></div>
    <div class="fim"><button type="button" id="lista">Baixar lista de itens sem capa (CSV)</button><button type="button" id="fecharImp">Fechar</button><button type="button" class="pri" id="go">Importar agora</button></div>`;
  $('#fecharImp').onclick = () => $('#imp').close();
  $('#lista').onclick = () => baixar('itens_sem_capa.csv', [['id', 'nome do arquivo', 'titulo', 'subtitulo', 'edicao', 'editora', 'ano'],
    ...sem.map(i => [i.id, `id-${i.id}.jpg`, i.titulo, i.subtitulo ?? '', i.edicao ?? '', i.editora ?? '', i.ano ?? ''])]);
  $('#go').onclick = async () => {
    $('#go').disabled = true; $('#go').textContent = 'Importando…';
    try {
      const r = await api('/api/capas/importar', { method: 'POST' });
      $('#res').innerHTML = `<p class="ok"><b>${r.ok.length}</b> capa(s) importada(s).</p>` +
        (r.falhas.length ? `<p class="no"><b>${r.falhas.length}</b> arquivo(s) não importado(s), continuam na pasta:</p><ul>${r.falhas.map(f => `<li>${esc(f.arquivo)}: ${esc(f.motivo)}</li>`).join('')}</ul>` : '');
      carregar();
    } catch (e) { $('#res').innerHTML = `<p class="no">${esc(e.message)}</p>`; }
    $('#go').disabled = false; $('#go').textContent = 'Importar agora';
  };
  $('#imp').showModal();
}

// ================= Perfis, login e tema =================
const CAT = `<div class="cat"><label>Já está cadastrado na biblioteca de outra pessoa? Busque para copiar os dados<input id="cq" type="search" placeholder="Digite título, ISBN ou editora…" autocomplete="off"></label><div id="cres"></div></div>`;
const CORES = ['#ffc83d', '#ff9f1c', '#e63946', '#e5589b', '#6a4c93', '#3a6ea5', '#2a9d8f', '#7cb518', '#1a2038', '#8d99ae'];
const FIGURAS = ['📚', '📖', '🦸', '🦹', '🦇', '🕷️', '⚡', '🔥', '🚀', '👾', '🤖', '🐉', '🦊', '🐱', '🐶', '🌟', '🎭', '🗡️', '🛡️', '🧙', '🧛', '🦄', '🌈', '☕'];

// Escolhe texto claro ou escuro conforme o brilho da cor de fundo
const tinta = h => { const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#1a2038' : '#ffffff'; };
function avatar(p, t = 40) {
  const a = p.avatar || {}, fundo = a.fundo || p.cor;
  const ini = String(p.nome || '?').trim().split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase();
  const dentro = a.tipo === 'foto' && (a.url || a.valor) ? `<img src="${esc(a.url || '/avatares/' + a.valor)}" alt="">` : a.tipo === 'emoji' ? esc(a.valor) : esc(ini);
  return `<span class="av" style="width:${t}px;height:${t}px;font-size:${Math.round(t * .5)}px;background:${esc(fundo)};color:${tinta(fundo)}">${dentro}</span>`;
}
function aplicarTema() {
  const r = document.documentElement.style;
  if (eu) { r.setProperty('--acc', eu.cor); r.setProperty('--acc-ink', tinta(eu.cor)); } else { r.removeProperty('--acc'); r.removeProperty('--acc-ink'); }
  if (eu) { $('#eu').innerHTML = `${avatar(eu, 32)}<span>${esc(eu.nome)}</span>`; document.title = `Biblioteca de ${eu.nome}`; }
  document.querySelector('meta[name=theme-color]').content = eu ? eu.cor : '#ffc83d'; // barra do navegador no celular
}

async function mostrarLogin() {
  eu = null; aplicarTema(); $('#app').hidden = true; $('#login').hidden = false;
  const ps = await api('/api/perfis');
  $('#login').innerHTML = `<h1>Minha Biblioteca</h1><p>Quem vai usar agora?</p><div class="perfis">${ps.map(p =>
    `<button class="pf" style="--c:${esc(p.cor)}" data-id="${p.id}">${avatar(p, 84)}<b>${esc(p.nome)}</b>${p.temSenha ? '' : '<small>Primeiro acesso</small>'}</button>`).join('')}</div>`;
  $('#login').onclick = e => { const b = e.target.closest('.pf'); if (b) pedirSenha(ps.find(p => p.id == b.dataset.id), ps); };
}
function pedirSenha(p, ps) {
  const novo = !p.temSenha;
  $('#login').innerHTML = `<form class="lg" id="lf">${avatar(p, 72)}<h2>${novo ? 'Primeiro acesso' : 'Olá, ' + esc(p.nome)}</h2>
    ${novo ? `<label>Seu nome<input name="nome" maxlength="30" value="${esc(p.nome)}" required></label>` : ''}
    <label>${novo ? 'Crie uma senha (mínimo 4 caracteres)' : 'Senha'}<input name="senha" type="password" required autofocus></label>
    ${novo ? '<label>Repita a senha<input name="senha2" type="password" required></label>' : ''}
    <div class="err" id="lerr"></div>
    <button class="pri">${novo ? 'Criar acesso' : 'Entrar'}</button><button type="button" id="volta">Voltar</button></form>`;
  $('#volta').onclick = mostrarLogin;
  $('#lf').onsubmit = async e => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
    if (novo && f.senha !== f.senha2) { $('#lerr').textContent = 'As senhas não conferem'; return; }
    try { await entrar(await api(novo ? '/api/primeiro-acesso' : '/api/login', { method: 'POST', body: JSON.stringify({ id: p.id, nome: f.nome, senha: f.senha }) })); }
    catch (err) { $('#lerr').textContent = err.message; }
  };
}

// Foto de perfil: recorta o centro em quadrado de 256 px
async function quadrada(file, t = 256) {
  const b = await createImageBitmap(file), l = Math.min(b.width, b.height), c = document.createElement('canvas');
  c.width = c.height = t;
  c.getContext('2d').drawImage(b, (b.width - l) / 2, (b.height - l) / 2, l, l, 0, 0, t, t);
  return new Promise(r => c.toBlob(r, 'image/jpeg', 0.88));
}

function abrirPerfil() {
  const r = { nome: eu.nome, cor: eu.cor, avatar: { tipo: eu.avatar.tipo, valor: eu.avatar.valor, fundo: eu.avatar.fundo || eu.cor } };
  let foto = null, fotoUrl = eu.foto ? '/avatares/' + eu.foto : null;
  $('#pform').innerHTML = `<h2>Meu perfil</h2>
    <div class="pv"><span id="pv"></span><label>Nome<input name="nome" maxlength="30" value="${esc(eu.nome)}" required></label></div>
    <fieldset><legend>Cor do perfil</legend><div class="sw" id="swCor"></div></fieldset>
    <fieldset><legend>Imagem do perfil</legend>
      <div class="sw modos" id="modos"></div>
      <div id="mfoto"><p class="sub2">Escolha uma foto do seu computador ou celular:</p><input type="file" id="pfoto" accept="image/*"></div>
      <div class="emo" id="emo"></div>
      <p class="sub2">Cor de fundo da imagem</p><div class="sw" id="swFundo"></div>
    </fieldset>
    <fieldset><legend>Trocar senha (opcional)</legend><div class="g"><label>Senha atual<input name="atual" type="password" autocomplete="current-password"></label><label>Nova senha<input name="nova" type="password" autocomplete="new-password"></label></div></fieldset>
    <div class="fim"><span class="err" id="pmsg"></span><button type="button" class="del" id="sair">Sair</button><button type="button" id="pcancel">Cancelar</button><button class="pri">Salvar</button></div>`;

  const prev = () => {
    const a = { ...r.avatar, url: fotoUrl }, semFoto = a.tipo === 'foto' && !fotoUrl;
    $('#pv').innerHTML = avatar({ nome: $('#pform').elements.nome.value || r.nome, cor: r.cor, avatar: semFoto ? { ...a, tipo: 'iniciais' } : a }, 96);
  };
  const paleta = (el, get, set) => {
    const desenhar = () => { el.innerHTML = CORES.map(c => `<button type="button" aria-label="Cor ${c}" style="background:${c}" class="${get() === c ? 'on' : ''}" data-c="${c}"></button>`).join('') + `<input type="color" value="${get()}" aria-label="Outra cor">`; };
    el.onclick = e => { const c = e.target.closest('[data-c]')?.dataset.c; if (c) { set(c); desenhar(); prev(); } };
    el.oninput = e => { if (e.target.type === 'color') { set(e.target.value); prev(); } };
    desenhar();
  };
  const modos = () => {
    const t = r.avatar.tipo;
    $('#modos').innerHTML = [['foto', 'Foto'], ['emoji', 'Figura'], ['iniciais', 'Iniciais']].map(([k, l]) => `<button type="button" data-m="${k}" class="${t === k ? 'on' : ''}">${l}</button>`).join('');
    $('#mfoto').hidden = t !== 'foto'; $('#emo').hidden = t !== 'emoji';
    $('#emo').innerHTML = FIGURAS.map(f => `<button type="button" data-f="${f}" class="${r.avatar.valor === f ? 'on' : ''}">${f}</button>`).join('');
    prev();
  };
  $('#modos').onclick = e => { const m = e.target.closest('[data-m]')?.dataset.m; if (m) { r.avatar.tipo = m; if (m === 'emoji' && !FIGURAS.includes(r.avatar.valor)) r.avatar.valor = FIGURAS[0]; modos(); } };
  $('#emo').onclick = e => { const f = e.target.closest('[data-f]')?.dataset.f; if (f) { r.avatar.valor = f; modos(); } };
  $('#pfoto').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { foto = await quadrada(f); fotoUrl = URL.createObjectURL(foto); prev(); } catch { $('#pmsg').textContent = 'Não foi possível ler essa imagem'; }
  };
  $('#pform').elements.nome.oninput = prev;
  paleta($('#swCor'), () => r.cor, c => { r.cor = c; });
  paleta($('#swFundo'), () => r.avatar.fundo, c => { r.avatar.fundo = c; });
  modos();

  $('#pcancel').onclick = () => $('#perfil').close();
  $('#sair').onclick = async () => { await api('/api/logout', { method: 'POST' }); $('#perfil').close(); mostrarLogin(); };
  $('#pform').onsubmit = async e => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); r.nome = f.nome;
    try {
      if (r.avatar.tipo === 'foto' && !foto && !eu.foto) throw new Error('Escolha uma foto ou outro tipo de imagem');
      if (foto) {
        const up = await fetch('/api/me/foto', { method: 'POST', headers: { 'Content-Type': foto.type }, body: foto });
        if (!up.ok) throw new Error('Não foi possível enviar a foto');
      }
      eu = await api('/api/me', { method: 'PUT', body: JSON.stringify(r) });
      aplicarTema();
      if (f.nova) await api('/api/me/senha', { method: 'PUT', body: JSON.stringify({ atual: f.atual, nova: f.nova }) });
      $('#perfil').close();
    } catch (err) { $('#pmsg').textContent = err.message; }
  };
  $('#perfil').showModal();
}

// Ao abrir a página: se já houver login válido entra direto; senão mostra a escolha de perfil
api('/api/me').then(entrar).catch(() => {});
