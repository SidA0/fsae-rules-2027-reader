(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const order = ['00','GR','AD','PS','V','F','T','VE','IC','EV','IN','S','D','D0','DA','DT','DO','DI','DS','DD'];
  const els = { list:$('section-list'), article:$('document'), outline:$('outline'), search:$('search'), sort:$('sort'), dialog:$('update-dialog'), status:$('update-status') };
  let data, activeId = 'GR', vehicleClass = 'combustion', query = '';
  let ruleIndex = new Map(), currentQuickRef = null, quickTrigger = null;
  const ruleCitation = /\b(?:GR|AD|PS|VE|IC|EV|IN|DA|DT|DO|DI|DS|DD|V|F|T|S|D)\.\d+(?:\.\d+)*(?:\.[a-z])?\b/g;
  const params = new URLSearchParams(location.search);
  if (params.get('section')) activeId = params.get('section').toUpperCase();
  if (['combustion','electric','all'].includes(params.get('class'))) vehicleClass = params.get('class');

  const escapeHTML = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const plainText = s => s.replace(/<!--[^]*?-->/g,'').replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\[[^\]]*\]\([^)]*\)/g,'').replace(/[#*`>|_]/g,' ');
  const ruleCount = docs => docs.reduce((n,d) => n + (d.markdown.match(/\*\*[A-Z]{1,3}\.\d+(?:\.\d+)*\*\*/g) || []).length,0);
  const visibleForClass = d => vehicleClass === 'all' || d.id === '00' || d.group === 'main' && (vehicleClass === 'combustion' ? d.id !== 'EV' : d.id !== 'IC');
  const matches = d => !query || `${d.id} ${d.title} ${plainText(d.markdown)}`.toLowerCase().includes(query);
  const docUrl = d => `https://github.com/${data.repo}/blob/${encodeURIComponent(data.branch)}/${d.path.split('/').map(encodeURIComponent).join('/')}`;
  const rawBase = () => `https://raw.githubusercontent.com/${data.repo}/${encodeURIComponent(data.branch)}/`;
  const setStatus = (message, error=false) => { els.status.textContent = message; els.status.classList.toggle('error', error); };
  function saveUrl() {
    const u = new URL(location.href); u.searchParams.set('section',activeId); u.searchParams.set('class',vehicleClass);
    history.replaceState(null,'',u);
  }
  function choose(id) { closeQuick(false); activeId = id; saveUrl(); render(); window.scrollTo({top:0,behavior:'instant'}); $('sidebar').classList.remove('open'); }
  function buildRuleIndex() {
    ruleIndex = new Map();
    for (const doc of data.docs) {
      const lines = doc.markdown.split(/\r?\n/);
      let current = null, context = doc.title;
      const finish = end => {
        if (!current) return;
        current.markdown = lines.slice(current.start + 1, end).join('\n').trim();
        if (current.kind === 'item') current.markdown = [current.firstLine, current.markdown].filter(Boolean).join('\n\n');
        delete current.firstLine; delete current.start;
        ruleIndex.set(current.code, current);
      };
      for (let i = 0; i < lines.length; i++) {
        const heading = lines[i].match(/^#{2,4}\s+([A-Z]{1,3}\.\d+(?:\.\d+)*)(?:\s+(.+))?\s*$/);
        const item = lines[i].match(/^\*\*([A-Z]{1,3}\.\d+(?:\.\d+)*)\*\*\s*(.*)$/);
        if (!heading && !item) continue;
        finish(i);
        if (heading) {
          context = heading[2] || doc.title;
          current = { code:heading[1], title:context, doc, line:i+1, start:i, kind:'heading' };
        } else {
          current = { code:item[1], title:context, doc, line:i+1, start:i, kind:'item', firstLine:item[2] };
        }
      }
      finish(lines.length);
    }
  }
  function resolveImages(markdown, doc) {
    return markdown.replace(/!\[([^\]]*)\]\((?!https?:\/\/)([^)]+)\)/g, (_, alt, path) => `![${alt}](${rawBase()}${doc.path.slice(0,doc.path.lastIndexOf('/')+1)}${path.split('/').map(encodeURIComponent).join('/')})`);
  }
  function linkRuleCitations(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.parentElement.closest('a,button,code,pre,script,style')) continue;
      if ([...node.textContent.matchAll(ruleCitation)].some(m => ruleIndex.has(m[0].replace(/\.[a-z]$/, '')))) nodes.push(node);
    }
    for (const node of nodes) {
      const text = node.textContent, fragment = document.createDocumentFragment();
      let cursor = 0;
      for (const match of text.matchAll(ruleCitation)) {
        const code = match[0].replace(/\.[a-z]$/, '');
        if (!ruleIndex.has(code)) continue;
        fragment.append(document.createTextNode(text.slice(cursor, match.index)));
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'rule-ref'; button.dataset.rule = code; button.dataset.citation = match[0];
        button.setAttribute('aria-label', `Quick reference for ${match[0]}`);
        button.textContent = match[0]; fragment.append(button);
        cursor = match.index + match[0].length;
      }
      fragment.append(document.createTextNode(text.slice(cursor)));
      node.replaceWith(fragment);
    }
  }
  function closeQuick(restoreFocus = true) {
    $('quick-panel').hidden = true; $('quick-shade').hidden = true;
    if (restoreFocus && quickTrigger?.isConnected) quickTrigger.focus();
    currentQuickRef = null;
  }
  function showQuick(code, trigger) {
    const entry = ruleIndex.get(code);
    if (!entry) return;
    currentQuickRef = entry; quickTrigger = trigger;
    const citation = trigger?.dataset.citation || entry.code;
    const subpart = citation.startsWith(`${entry.code}.`) ? citation.slice(entry.code.length + 1) : '';
    $('quick-code').textContent = citation;
    $('quick-context').textContent = `${entry.doc.title} · ${entry.title}${subpart ? ` · Parent rule ${entry.code}` : ''}`;
    const body = $('quick-body');
    if (entry.markdown) body.innerHTML = DOMPurify.sanitize(marked.parse(resolveImages(entry.markdown, entry.doc), {gfm:true}));
    else {
      const children = [...ruleIndex.values()].filter(x => x.doc === entry.doc && x.code.startsWith(`${entry.code}.`)).slice(0,6);
      body.innerHTML = `<p>This section contains ${children.length ? 'the following related rules' : 'no separate rule text'}. Open it in the rulebook for the full context.</p>${children.length ? `<ul>${children.map(x => `<li><button type="button" class="rule-ref" data-rule="${escapeHTML(x.code)}">${escapeHTML(x.code)}</button> ${escapeHTML(x.title)}</li>`).join('')}</ul>` : ''}`;
    }
    linkRuleCitations(body);
    if (subpart) for (const item of body.querySelectorAll('li')) {
      if (item.textContent.trim().startsWith(`${subpart}.`)) { item.classList.add('selected-subpart'); break; }
    }
    $('quick-source').href = `${docUrl(entry.doc)}#L${entry.line}`;
    $('quick-scroll').scrollTop = 0;
    $('quick-panel').hidden = false; $('quick-shade').hidden = false;
    $('quick-close').focus();
  }
  function renderNav() {
    const docs = data.docs.filter(visibleForClass).filter(matches);
    if (els.sort.value === 'az') docs.sort((a,b) => a.title.localeCompare(b.title));
    else docs.sort((a,b) => order.indexOf(a.id) - order.indexOf(b.id));
    els.list.replaceChildren();
    let lastGroup = '';
    for (const d of docs) {
      if (d.group !== lastGroup && els.sort.value !== 'az') {
        const label = document.createElement('div'); label.className = 'nav-group'; label.textContent = d.group === 'driverless' ? 'DRIVERLESS SUPPLEMENT' : 'FORMULA SAE RULES'; els.list.append(label); lastGroup = d.group;
      }
      const b = document.createElement('button'); b.type = 'button'; b.className = `section-link${d.id===activeId?' active':''}`;
      b.innerHTML = `<span class="code">${escapeHTML(d.id)}</span><span>${escapeHTML(d.title)}</span>`;
      b.onclick = () => choose(d.id); els.list.append(b);
    }
    if (!docs.length) els.list.innerHTML = '<p style="padding:12px;color:#7b8583;font-size:13px">No matching sections.</p>';
    $('section-count').textContent = `${docs.length} sections`;
    if (query) { $('search-summary').hidden = false; $('search-summary').textContent = `${docs.length} section${docs.length===1?'':'s'} matching “${query}”`; }
    else $('search-summary').hidden = true;
    if (!docs.some(d => d.id === activeId) && docs.length) activeId = docs[0].id;
  }
  function renderDoc() {
    if (query && !data.docs.filter(visibleForClass).some(matches)) {
      $('current-title').textContent = 'No matching rules';
      $('mobile-section').textContent = '';
      els.outline.replaceChildren();
      els.article.innerHTML = '<h1>No matching sections</h1><p>Try another rule number or search term, or change the vehicle class.</p>';
      return;
    }
    const d = data.docs.find(x => x.id === activeId);
    if (!d) { els.article.textContent = 'No section selected.'; return; }
    $('current-title').textContent = `${d.id} · ${d.title}`;
    $('mobile-section').textContent = d.id;
    $('view-source').href = docUrl(d);
    let markdown = d.markdown.replace(/<!--[^]*?-->/g,'');
    markdown = resolveImages(markdown, d);
    const html = marked.parse(markdown, { gfm:true, breaks:false });
    els.article.innerHTML = DOMPurify.sanitize(html, { ADD_ATTR:['target','rel'] });
    els.outline.replaceChildren();
    let number = 0;
    for (const h of els.article.querySelectorAll('h2,h3')) {
      const id = `rule-${activeId.toLowerCase()}-${number++}`; h.id = id;
      const a = document.createElement('a'); a.href = `#${id}`; a.textContent = h.textContent; if (h.tagName === 'H3') a.className = 'sub'; els.outline.append(a);
    }
    for (const a of els.article.querySelectorAll('a[href]')) { if (a.href.startsWith('http')) { a.target = '_blank'; a.rel = 'noopener noreferrer'; } }
    for (const h of els.article.querySelectorAll('h2,h3,h4')) {
      const code = h.textContent.match(/^([A-Z]{1,3}\.\d+(?:\.\d+)*)\b/)?.[1];
      if (code && ruleIndex.has(code)) h.dataset.ruleId = code;
    }
    for (const strong of els.article.querySelectorAll('strong')) {
      const code = strong.textContent.trim();
      if (ruleIndex.has(code)) (strong.closest('p,li') || strong).dataset.ruleId = code;
    }
    linkRuleCitations(els.article);
    saveUrl();
  }
  function render() {
    for (const b of document.querySelectorAll('[data-class]')) b.setAttribute('aria-pressed', String(b.dataset.class === vehicleClass));
    $('doc-count').textContent = data.docs.length;
    $('rule-count').textContent = ruleCount(data.docs).toLocaleString();
    $('revision-label').textContent = `Commit ${data.sha.slice(0,7)}`;
    $('source-date').textContent = data.sha.slice(0,7);
    renderNav(); renderDoc();
  }
  function openDB() { return new Promise((resolve,reject) => { const r = indexedDB.open('fsae-rules-reader',1); r.onupgradeneeded=()=>r.result.createObjectStore('data'); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); }); }
  async function readSaved() { const db=await openDB(); return new Promise((resolve,reject)=>{ const r=db.transaction('data').objectStore('data').get('current'); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); }); }
  async function saveData(value) { const db=await openDB(); return new Promise((resolve,reject)=>{ const tx=db.transaction('data','readwrite'); tx.objectStore('data').put(value,'current'); tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error); }); }
  async function fetchJSON(url) { const response = await fetch(url, {headers:{Accept:'application/vnd.github+json'}}); if (!response.ok) throw new Error(`GitHub returned ${response.status}${response.status===403?' (rate limit may be reached)':''}.`); return response.json(); }
  async function fetchText(url) { const response=await fetch(url); if (!response.ok) throw new Error(`Could not load a rules file (${response.status}).`); return response.text(); }
  function parseRepo(value) { const u = new URL(value); if (u.hostname !== 'github.com') throw new Error('Use a github.com repository link.'); const parts=u.pathname.split('/').filter(Boolean); if (parts.length<2) throw new Error('Link must include an owner and repository.'); const owner=parts[0], repo=parts[1].replace(/\.git$/,''); if (!/^[\w.-]+$/.test(owner)||!/^[\w.-]+$/.test(repo)) throw new Error('Invalid repository link.'); return `${owner}/${repo}`; }
  async function checkUpdates() {
    const button=$('update-submit'); button.disabled=true; setStatus('Checking the repository…');
    try {
      const repo=parseRepo($('repo-url').value.trim());
      const info=await fetchJSON(`https://api.github.com/repos/${repo}`);
      const branch=info.default_branch;
      const commit=await fetchJSON(`https://api.github.com/repos/${repo}/commits/${encodeURIComponent(branch)}`);
      const sha=commit.sha;
      if (repo.toLowerCase()===data.repo.toLowerCase() && sha===data.sha) { setStatus('Already using the latest commit from this repository.'); return; }
      setStatus('Finding rule files…');
      const tree=await fetchJSON(`https://api.github.com/repos/${repo}/git/trees/${encodeURIComponent(sha)}?recursive=1`);
      if (tree.truncated) throw new Error('Repository is too large for a complete file listing.');
      const files=tree.tree.filter(x => x.type==='blob' && /^FSAE_(Rules|Driverless)_\d+_V\d+\/[^/]+\.md$/i.test(x.path) && !x.path.includes('Implementation_Roadmap'));
      if (!files.some(x=>/\/GR - /i.test(x.path))) throw new Error('No Formula SAE rules Markdown sections were found at the repository root.');
      const docs=[];
      for (let i=0;i<files.length;i+=4) {
        setStatus(`Loading rules… ${Math.min(i+4,files.length)} of ${files.length}`);
        const part=await Promise.all(files.slice(i,i+4).map(async file => {
          const markdown=await fetchText(`https://raw.githubusercontent.com/${repo}/${sha}/${file.path.split('/').map(encodeURIComponent).join('/')}`);
          const name=file.path.split('/').pop().replace(/\.md$/,'');
          const id=name.startsWith('00')?(file.path.includes('Driverless')?'D0':'00'):name.split(' - ')[0];
          return { id, title:name.replace(/^[^-]+ - /,''), path:file.path, group:file.path.includes('Driverless')?'driverless':'main', markdown };
        })); docs.push(...part);
      }
      docs.sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));
      const updated={repo,branch:sha,sha,fetchedAt:new Date().toISOString(),docs};
      await saveData(updated);
      data=updated; buildRuleIndex(); closeQuick(false); activeId='GR'; query=''; els.search.value=''; render();
      setStatus(`Updated to commit ${sha.slice(0,7)} with ${docs.length} sections. Saved in this browser.`);
      setTimeout(()=>els.dialog.close(),1400);
    } catch(e) { setStatus(e.message || 'Update failed.',true); }
    finally { button.disabled=false; }
  }
  document.querySelectorAll('[data-class]').forEach(b=>b.onclick=()=>{vehicleClass=b.dataset.class;render();});
  els.search.addEventListener('input',()=>{query=els.search.value.trim().toLowerCase();render();});
  els.sort.onchange=render;
  $('update-open').onclick=()=>{ $('repo-url').value=`https://github.com/${data.repo}`; setStatus(''); els.dialog.showModal(); };
  $('update-submit').onclick=checkUpdates;
  $('copy-link').onclick=async()=>{await navigator.clipboard.writeText(location.href);const b=$('copy-link');b.textContent='Copied';setTimeout(()=>b.textContent='Copy link',1600);};
  $('sidebar-open').onclick=()=>$('sidebar').classList.add('open');
  $('sidebar-close').onclick=()=>$('sidebar').classList.remove('open');
  for (const root of [els.article, $('quick-body')]) root.addEventListener('click', e => { const ref=e.target.closest('.rule-ref'); if (ref) showQuick(ref.dataset.rule, ref); });
  $('quick-close').onclick=()=>closeQuick();
  $('quick-shade').onclick=()=>closeQuick();
  $('quick-open').onclick=()=>{
    if (!currentQuickRef) return;
    const code=currentQuickRef.code, doc=currentQuickRef.doc;
    if (doc.group === 'driverless') vehicleClass = 'all';
    else if (doc.id === 'EV') vehicleClass = 'electric';
    else if (doc.id === 'IC') vehicleClass = 'combustion';
    query = ''; els.search.value = '';
    choose(doc.id);
    requestAnimationFrame(()=>{ const target=els.article.querySelector(`[data-rule-id="${code}"]`); target?.scrollIntoView({behavior:'smooth',block:'start'}); });
  };
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('quick-panel').hidden){closeQuick();return;} if(e.key==='/'&&!els.dialog.open&&$('quick-panel').hidden&&document.activeElement!==els.search){e.preventDefault();els.search.focus();}});
  (async()=>{try{ const response=await fetch('data.json'); if(!response.ok)throw new Error('Could not load the rules snapshot.'); const snapshot=await response.json(); data=await readSaved().catch(()=>null)||snapshot; buildRuleIndex(); render(); }catch(e){els.article.textContent=e.message; $('current-title').textContent='Unable to load rules';}})();
})();
