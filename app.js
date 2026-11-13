(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const kinds = {nir:'НИР',publication:'Публикации',rid:'РИД',assignment:'Поручения'};
  const workStatuses = {planned:'Запланировано',active:'В работе',review:'На проверке',closed:'Закрыто'};
  const taskStatuses = {todo:'Назначено',doing:'Выполняется',review:'На приёмке',done:'Принято'};
  const stageStatuses = {planned:'Запланирован',active:'В работе',review:'На приёмке',accepted:'Принят'};
  const moneyFormatter = new Intl.NumberFormat('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2});
  const wholeFormatter = new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0});
  const percentFormatter = new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1});
  let state, storageWarning = '', message = null, route = {}, dialogInvoker = null;
  const model = window.OTBModel;
  const view = $('#app-view');
  const dialog = $('#action-dialog');
  const money = (value, exact = false) => value === null || value === undefined ? 'Неизвестно' : (exact ? moneyFormatter : wholeFormatter).format(value);
  const currency = (value, exact = false) => value === null || value === undefined ? 'Неизвестно' : money(value,exact) + ' ₽';
  const percent = value => value === null || value === undefined ? 'Не рассчитывается' : percentFormatter.format(value) + '%';
  const date = value => value ? new Date(value + 'T12:00:00').toLocaleDateString('ru-RU') : 'Не указан';
  const dateLong = value => value ? new Date(value + 'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'}) : '';
  const dateTime = value => new Date(value).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
  const labFor = id => state.labs.find(lab => lab.id === id) || {shortName:'—',name:'Лаборатория не указана'};
  const workFor = id => state.works.find(work => work.id === Number(id));
  const workTasks = work => state.tasks.filter(task => task.workId === work.id);
  const overdue = item => item.dueDate < state.today && !['done','closed','accepted'].includes(item.status);
  const progress = work => {const tasks = workTasks(work); return tasks.length ? Math.round(tasks.filter(task => task.status === 'done').length / tasks.length * 100) : 0;};
  const complete = work => work.forecast.complete && work.forecast.revenueRemaining !== null && work.forecast.costRemaining !== null;
  const fact = (work, key) => work.facts[key] === null && work.forecast.complete ? 0 : work.facts[key];
  const badge = (status, labels) => `<span class="badge ${esc(status)}">${esc(labels[status] || status)}</span>`;
  const queryLink = (path, params) => {const query = new URLSearchParams(Object.entries(params).filter(([,value]) => value !== '' && value !== null && value !== undefined)).toString(); return '#' + path + (query ? '?' + query : '');};
  const workLink = work => '#/works/' + work.id;
  const button = (label, href, symbol = '', secondary = false) => `<a class="button ${secondary ? 'secondary' : ''}" href="${esc(href)}">${symbol ? icon(symbol) : ''}${esc(label)}</a>`;
  const empty = (title, text, action = '') => `<div class="empty-state">${icon('folder')}<h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`;
  const options = (labels, selected) => Object.entries(labels).map(([value,label]) => `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(label)}</option>`).join('');
  const pageHead = (title, subtitle, actions = '', eyebrow = '', crumb = title) => `<div class="breadcrumb"><a href="#/">Рабочий кабинет</a>${icon('chevron')}<span>${esc(crumb)}</span></div><div class="page-heading"><div>${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ''}<h1 tabindex="-1" id="page-title">${esc(title)}</h1><p>${esc(subtitle)}</p></div><div class="heading-actions">${actions}</div></div>`;
  const cardHead = (title, subtitle = '', action = '') => `<div class="card-head"><div><h2>${esc(title)}</h2>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>${action}</div>`;

  function announce(text, type = 'success') { message = {text,type}; }
  function showNotices() {
    $('#storage-notice').innerHTML = storageWarning ? `<div class="message warning">${icon('info')}<span>${esc(storageWarning)}</span></div>` : '';
    $('#app-message').innerHTML = message ? `<div class="message ${esc(message.type)}">${icon('info')}<span>${esc(message.text)}</span><button class="notice-dismiss" type="button" data-action="dismiss-message" aria-label="Скрыть сообщение">×</button></div>` : '';
  }
  function clone() { return JSON.parse(JSON.stringify(state)); }
  function log(work, action, detail) { work.history.unshift({at:new Date().toISOString(),action,detail}); work.history = work.history.slice(0,500); }
  function commit(next, text, destination) {
    const result = model.save(next);
    state = next;
    storageWarning = result.ok ? '' : (result.warning || 'Изменения доступны только до закрытия страницы: браузер не разрешил сохранение.');
    announce(result.ok ? text : text + ' Пока только в памяти страницы.', result.ok ? 'success' : 'warning');
    if (destination && location.hash !== destination) location.hash = destination;
    else render();
  }
  function setMenu(open, restore = false) {
    const sidebar = $('#sidebar');
    sidebar.classList.toggle('open',open);
    $('.sidebar-backdrop').classList.toggle('open',open);
    $('[data-menu-toggle]').setAttribute('aria-expanded',String(open));
    sidebar.inert = matchMedia('(max-width:760px)').matches && !open;
    document.body.classList.toggle('menu-is-open',open);
    if (open) sidebar.querySelector('button,a').focus();
    else if (restore) $('[data-menu-toggle]').focus();
  }
  function readRoute() {
    const hash = location.hash.slice(1) || '/';
    const divider = hash.indexOf('?');
    return {path: divider < 0 ? hash : hash.slice(0,divider), params:new URLSearchParams(divider < 0 ? '' : hash.slice(divider+1))};
  }
  function render() {
    route = readRoute();
    setMenu(false);
    let content, nav = '', title = '';
    const detailMatch = route.path.match(/^\/works\/(\d+)$/);
    const forecastMatch = route.path.match(/^\/works\/(\d+)\/forecast$/);
    if (route.path === '/') {content = renderOverview(); nav='overview'; title='Обзор отдела';}
    else if (route.path === '/works') {content=renderWorks(); nav=route.params.get('kind') || ''; title=kinds[nav] || 'Все работы';}
    else if (route.path === '/works/new') {content=renderNewWork(); nav=route.params.get('kind') || ''; title='Новая учебная работа';}
    else if (detailMatch && workFor(detailMatch[1])) {const work=workFor(detailMatch[1]); content=renderWork(work); nav=work.kind; title=work.code;}
    else if (forecastMatch && workFor(forecastMatch[1])) {const work=workFor(forecastMatch[1]); content=renderForecast(work); nav=work.kind; title='Изменить прогноз';}
    else if (route.path === '/tasks') {content=renderTasks(); nav='tasks'; title='Задания';}
    else if (route.path === '/guide') {content=renderGuide(); nav='guide'; title='Как попробовать';}
    else {content=pageHead('Страница не найдена','Возможно, работа была удалена при сбросе учебных данных.')+empty('Вернитесь к работам','Все доступные карточки находятся в реестре.',button('Открыть реестр','#/works'));title='Страница не найдена';}
    view.innerHTML = content;
    document.title = title + ' · ОТБ';
    $$('.nav-link').forEach(link => {const active=link.dataset.nav === nav;link.classList.toggle('active',active); if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
    $$('[data-count]').forEach(node => {node.textContent=String(state.works.filter(work=>work.kind===node.dataset.count).length);});
    $('#demo-date').textContent = 'Учебная дата: ' + date(state.today);
    showNotices();
    if ($('#forecast-form')) updatePreview();
    $('#page-title')?.focus({preventScroll:true});
    window.scrollTo(0,0);
  }

  function workTable(works, compact = false) {
    if (!works.length) return empty('Работы не найдены','Измените запрос или фильтры.',button('Все работы','#/works','',true));
    return `<div class="table-scroll" tabindex="0" role="region" aria-label="Таблица работ"><table class="data-table"><thead><tr><th>Работа / ответственный</th><th>Лаборатория</th><th>Срок</th>${compact?'':'<th>Задания</th>'}<th>Статус</th></tr></thead><tbody>${works.map(work => `<tr><td><span class="work-code">${esc(work.code)}${compact?'':` <span class="work-kind">· ${esc(kinds[work.kind])}</span>`}</span><a class="work-title" href="${workLink(work)}">${esc(work.title)}</a><div class="meta-text">${esc(work.owner)}</div></td><td><span class="lab-chip" title="${esc(labFor(work.labId).name)}">${esc(labFor(work.labId).shortName)}</span></td><td class="nowrap"><span class="deadline ${overdue(work)?'overdue':''}">${date(work.dueDate)}</span>${overdue(work)?'<div class="meta-text">Срок истёк</div>':''}</td>${compact?'':`<td class="progress-cell"><div class="progress-label"><span>Принято</span><span>${progress(work)}%</span></div><div class="progress" role="progressbar" aria-label="Принятые задания" aria-valuenow="${progress(work)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${progress(work)}%"></span></div></td>`}<td>${badge(work.status,workStatuses)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function renderOverview() {
    const active=state.works.filter(work=>work.status!=='closed');
    const review=state.tasks.filter(task=>task.status==='review');
    const late=state.tasks.filter(overdue);
    const done=state.tasks.filter(task=>task.status==='done');
    const stats=[['Незакрытые работы',active.length,'Действующий портфель отдела','folder','','#/works?status=open'],['Ожидают приёмки',review.length,'Задания переданы на проверку','checklist','blue','#/tasks?status=review'],['Просроченные задания',late.length,late.length?'Требуют внимания':'Сроки под контролем','clock','amber','#/tasks?overdue=1'],['Принятые результаты',done.length,'Завершённые задания','check','purple','#/tasks?status=done']];
    const focus=active.slice().sort((a,b)=>a.dueDate.localeCompare(b.dueDate)).slice(0,6);
    const focusTasks=state.tasks.filter(task=>task.status!=='done').sort((a,b)=>a.dueDate.localeCompare(b.dueDate)).slice(0,5);
    return pageHead('Обзор отдела','Работы, требующие внимания, ближайшие сроки и результаты лабораторий.',button('Новая работа','#/works/new','plus'),'Рабочий ритм отдела')+
      `<div class="metrics-grid">${stats.map(([label,count,foot,symbol,color,href])=>`<a class="card metric" href="${href}"><div class="metric-top">${label}<span class="metric-icon ${color}">${icon(symbol)}</span></div><div class="metric-value">${count}</div><div class="metric-foot ${color==='amber'?'amber':''}">${foot}</div></a>`).join('')}</div>
      <div class="grid-main"><section class="card">${cardHead('Работы в фокусе','От ближайшего срока к следующим',`<a class="button ghost" href="#/works">Весь реестр${icon('arrow')}</a>`)}${workTable(focus,true)}<div class="table-footer"><span>Учебный портфель · показано ${focus.length} работ</span>${icon('shield')}</div></section>
      <div class="stack"><section class="card">${cardHead('Ближайшие действия','Что важно сделать следующим',icon('checklist'))}<div class="card-body">${focusTasks.map(task=>`<a class="task-mini" href="${esc(queryLink('/tasks',{q:task.title}))}"><span class="task-status-icon ${task.status==='review'?'review':''}">${icon(task.status==='review'?'check':'clock')}</span><div class="task-mini-body"><div class="task-mini-title">${esc(task.title)}</div><div class="task-mini-meta">${esc(task.assignee)} · <span class="${overdue(task)?'negative':''}">${date(task.dueDate)}</span></div></div>${icon('chevron')}</a>`).join('') || '<p class="muted text-small">Открытых заданий пока нет.</p>'}<a class="button secondary full" href="#/tasks">Все задания${icon('arrow')}</a></div></section><section class="card">${cardHead('Попробуйте свой сценарий','Учебная копия в вашем браузере')}<div class="card-body"><p class="text-small muted">Откройте НИР, измените остаточный прогноз и посмотрите, как изменится рентабельность. Ваши изменения не затронут других посетителей.</p><a class="button ghost" href="#/guide">Краткая инструкция${icon('arrow')}</a></div></section></div></div>
      <section class="section-spacer"><div class="section-heading"><div><h2>Лаборатории</h2><p>Нагрузка и принятые результаты</p></div><span class="card-label">Учебный портфель</span></div><div class="lab-grid">${state.labs.map(lab=>{const works=state.works.filter(work=>work.labId===lab.id);const ids=new Set(works.map(work=>work.id));const tasks=state.tasks.filter(task=>ids.has(task.workId));const count=tasks.filter(task=>task.status==='done').length;return `<a class="card lab-card" href="${queryLink('/works',{lab:lab.id})}"><div class="lab-card-top"><span class="lab-code">${esc(lab.shortName)}</span>${icon('users')}</div><h3>${esc(lab.name)}</h3><div class="lab-card-bottom"><span><strong>${works.filter(work=>work.status!=='closed').length}</strong> активных работ</span><span>${count} / ${tasks.length} заданий</span></div><div class="progress"><span style="width:${tasks.length?Math.round(count/tasks.length*100):0}%"></span></div></a>`;}).join('')}</div></section>`;
  }
  function renderWorks() {
    const kind=route.params.get('kind')||'',query=route.params.get('q')||'',lab=route.params.get('lab')||'',status=route.params.get('status')||'';
    const matches=state.works.filter(work=>(!kind||work.kind===kind)&&(!lab||work.labId===Number(lab))&&(!status||(status==='open'?work.status!=='closed':work.status===status))&&(!query||[work.code,work.title,work.owner].join(' ').toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru')))).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
    return pageHead(kinds[kind]||'Все работы','Сроки, участники и результаты учебных работ.',button('Новая работа',queryLink('/works/new',{kind}),'plus'),'','Реестр работ')+`<section class="card"><div class="filter-tabs">${[['','Все работы'],...Object.entries(kinds)].map(([value,label])=>`<a href="${queryLink('/works',{kind:value})}" class="${kind===value?'active':''}">${esc(label)}<span class="count">${state.works.filter(work=>!value||work.kind===value).length}</span></a>`).join('')}</div><form class="filters" data-form="work-filter"><input type="hidden" name="kind" value="${esc(kind)}"><label class="search-field"><span class="sr-only">Найти работу</span>${icon('search')}<input type="search" name="q" value="${esc(query)}" maxlength="200" placeholder="Название, код или ответственный"></label><label class="sr-only" for="filter-lab">Лаборатория</label><select name="lab" id="filter-lab"><option value="">Все лаборатории</option>${state.labs.map(item=>`<option value="${item.id}"${String(item.id)===lab?' selected':''}>${esc(item.shortName)}</option>`).join('')}</select><label class="sr-only" for="filter-status">Статус</label><select name="status" id="filter-status"><option value="">Все статусы</option>${options({open:'Все незакрытые',...workStatuses},status)}</select><button class="button secondary" type="submit">Найти</button>${query||lab||status?`<a class="button ghost" href="${queryLink('/works',{kind})}">Сбросить фильтры</a>`:''}</form>${workTable(matches)}<div class="table-footer"><span>Найдено работ: ${matches.length}</span><span>Демонстрационные данные</span></div></section>`;
  }

  function historyMarkup(work) {
    return work.history.length ? `<div class="timeline">${work.history.map(entry=>`<div class="timeline-event"><div class="timeline-title">${esc(entry.action)}</div><div class="timeline-detail">${esc(entry.detail)}</div><div class="timeline-meta">${esc(dateTime(entry.at))} · Учебная копия браузера</div></div>`).join('')}</div>` : '<div class="card-body"><p class="muted text-small">Здесь появятся изменения, сделанные в вашей учебной копии.</p></div>';
  }
  function taskCard(task) {
    const work=workFor(task.workId), closed=work?.status==='closed';
    let actions='';
    if (!closed) {
      if(task.status==='todo') actions=`<button class="button small" data-action="task-start" data-id="${task.id}">Начать выполнение</button>`;
      if(task.status==='doing') actions=`<button class="button small" data-action="task-submit" data-id="${task.id}">Передать на приёмку</button>`;
      if(task.status==='review') actions=`<button class="button small" data-action="task-accept" data-id="${task.id}">${icon('check')}Принять результат</button><button class="button secondary small" data-action="task-return" data-id="${task.id}">Вернуть на доработку</button>`;
    }
    return `<article class="task-card" id="task-${task.id}"><div class="task-card-head"><div><h3 class="task-card-title">${esc(task.title)}</h3><a class="task-card-subtitle" href="${workLink(work)}">${esc(work.code)} · ${esc(work.title)}</a></div>${badge(task.status,taskStatuses)}</div><div class="task-card-meta"><span>Исполнитель: <strong>${esc(task.assignee)}</strong></span><span>Принимает: <strong>${esc(task.reviewer)}</strong></span><span>Срок: <strong class="${overdue(task)?'negative':''}">${date(task.dueDate)}</strong></span></div>${task.result?`<div class="result-box"><strong>Результат</strong><br>${esc(task.result)}</div>`:''}${actions?`<div class="task-actions">${actions}<span class="demo-action-caption">Учебные действия</span></div>`:''}${closed?'<p class="chart-caption">Работа закрыта. Задание доступно для просмотра.</p>':''}</article>`;
  }
  function renderTasks() {
    const status=route.params.get('status')||'',query=route.params.get('q')||'',onlyLate=route.params.get('overdue')==='1';
    const matches=state.tasks.filter(task=>(!status||task.status===status)&&(!onlyLate||overdue(task))&&(!query||[task.title,task.assignee,workFor(task.workId)?.code].join(' ').toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru')))).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
    return pageHead('Задания','Попробуйте выполнение и приёмку результатов. Все действия здесь демонстрационные.',button('К работам','#/works','folder',true))+`<section class="card"><div class="filter-tabs"><a href="#/tasks" class="${!status&&!onlyLate?'active':''}">Все задания</a>${Object.entries(taskStatuses).map(([value,label])=>`<a href="${queryLink('/tasks',{status:value})}" class="${status===value?'active':''}">${label}</a>`).join('')}<a href="#/tasks?overdue=1" class="${onlyLate?'active':''}">Просроченные</a></div><form class="filters" data-form="task-filter"><input type="hidden" name="status" value="${esc(status)}">${onlyLate?'<input type="hidden" name="overdue" value="1">':''}<label class="search-field"><span class="sr-only">Найти задание</span>${icon('search')}<input type="search" name="q" value="${esc(query)}" maxlength="200" placeholder="Название задания, код работы или исполнитель"></label><button class="button secondary" type="submit">Найти</button>${query?'<a class="button ghost" href="#/tasks">Сбросить</a>':''}</form>${matches.map(taskCard).join('')||empty('Заданий не найдено','Измените фильтр или создайте учебное задание в карточке работы.')}<div class="table-footer"><span>Заданий в списке: ${matches.length}</span><span>Учебная дата: ${date(state.today)}</span></div></section>`;
  }
  function renderEconomy(work) {
    const calculation=model.calculate(work);
    const unknown=value=>value===null?'<span class="unknown-value">Неизвестно</span>':money(value,true);
    const metrics=[['Прогноз прибыли',currency(calculation.profit,true)],['Рентабельность затрат · основной показатель',percent(calculation.returnOnCost)],['Маржа · дополнительный показатель',percent(calculation.margin)],['Полученная оплата',currency(calculation.payment,true)]];
    const maxBar=Math.max(calculation.revenue||0,calculation.cost||0);
    const bars=maxBar>0&&calculation.revenue!==null&&calculation.cost!==null?`<div class="chart-bars compact-chart" role="img" aria-label="Прогноз выручки ${esc(currency(calculation.revenue))}; прогноз затрат ${esc(currency(calculation.cost))}"><div class="bar-top"><span>Выручка на весь срок</span><span>${currency(calculation.revenue)}</span></div><div class="bar-track"><div class="bar-fill" style="width:${calculation.revenue/maxBar*100}%"></div></div><div class="bar-top"><span>Затраты на весь срок</span><span>${currency(calculation.cost)}</span></div><div class="bar-track"><div class="bar-fill cost" style="width:${calculation.cost/maxBar*100}%"></div></div></div>`:'';
    return `<section class="card section-spacer" id="economy">${cardHead('Экономика НИР','Факт и прогноз · на весь срок работы',work.status!=='closed'?button('Изменить прогноз',workLink(work)+'/forecast','chart',true):'<span class="badge closed">Только просмотр</span>')}<div class="economy-grid"><div class="economy-number"><div class="label">Подтверждённая выручка</div><strong>${currency(fact(work,'revenue'))}</strong></div><div class="economy-number"><div class="label">Подтверждённые затраты</div><strong>${currency(fact(work,'cost'))}</strong></div><div class="economy-number"><div class="label">Остаток к оплате по договору</div><strong>${currency(calculation.remainingContractPayment)}</strong><div class="label">С учётом НДС; срок оплаты здесь не оценивается</div></div></div><div class="card-body"><div class="chart-summary"><span class="card-label">Факт + остаток = прогноз на весь срок</span></div><div class="forecast-calculation table-scroll"><table aria-label="Расчёт прогноза, рубли"><thead><tr><th>Суммы, ₽</th><th>Подтверждённый факт</th><th>+ Остаток до завершения</th><th>= Прогноз</th></tr></thead><tbody><tr><td>Выручка</td><td>${unknown(fact(work,'revenue'))}</td><td>${unknown(work.forecast.revenueRemaining)}</td><td>${unknown(calculation.revenue)}</td></tr><tr><td>Затраты</td><td>${unknown(fact(work,'cost'))}</td><td>${unknown(work.forecast.costRemaining)}</td><td>${unknown(calculation.cost)}</td></tr></tbody></table></div>${complete(work)?`<div class="forecast-status complete">${icon('check')}Полнота данных подтверждена, оба остатка известны.</div>`:'<div class="information warning">Прогноз неполный. Показатели предварительные: проверьте полноту данных и неизвестные остатки. Неизвестное значение отличается от нуля.</div>'}${bars}${metrics.map(([label,value])=>`<div class="summary-line"><span>${label}</span><strong>${esc(value)}</strong></div>`).join('')}${calculation.returnOnCost!==null&&calculation.returnOnCost<work.minReturn?`<div class="information warning" style="margin-top:15px">Прогнозная рентабельность ниже учебного ориентира ${esc(percent(work.minReturn))}.</div>`:''}<p class="chart-caption">Выручка — без НДС. Затраты включают невозмещаемый НДС. Оплата и остаток по договору учитываются отдельно от выручки и приёмки. При неизвестной или нулевой базе процент не рассчитывается.</p></div></section>`;
  }
  function renderWork(work) {
    const tasks=workTasks(work),lab=labFor(work.labId);
    const actions=(work.kind==='nir'?'<button class="button secondary" type="button" data-action="jump-economy">'+icon('chart')+'Экономика</button>':'')+(work.status!=='closed'?`<button class="button" type="button" data-action="new-task" data-id="${work.id}">${icon('plus')}Новое задание</button>`:'');
    return pageHead(work.title,'Учебная карточка работы',actions,kinds[work.kind]+' · '+work.code,work.code)+`<div class="detail-grid"><div><section class="card detail-intro"><div class="detail-status-line">${badge(work.status,workStatuses)}<span class="deadline ${overdue(work)?'overdue':''}">${icon('clock')}До ${dateLong(work.dueDate)}</span></div><p>${esc(work.description)||'Описание пока не добавлено.'}</p><dl class="detail-meta wide"><div><dt>Руководитель работы</dt><dd>${esc(work.owner)}</dd></div><div><dt>Ведущая лаборатория</dt><dd>${esc(lab.shortName)}</dd></div><div><dt>Плановый срок</dt><dd>${date(work.dueDate)}</dd></div><div><dt>Принятые задания</dt><dd>${tasks.filter(task=>task.status==='done').length} из ${tasks.length}</dd></div></dl><div class="criteria-box"><strong>Критерии результата</strong><p>${esc(work.criteria)||'Критерии пока не указаны.'}</p></div></section><section class="card section-spacer">${cardHead('Этапы работы','Результат этапа принимается отдельно от оплаты',`<span class="card-label">Принято заданий: ${progress(work)}%</span>`)}${work.stages.map((stage,index)=>`<article class="stage ${esc(stage.status)}"><div class="stage-head"><span class="stage-number">${stage.status==='accepted'?icon('check'):String(index+1).padStart(2,'0')}</span><div class="stage-content"><div class="stage-title">${esc(stage.title)}</div><div class="stage-meta">До ${date(stage.dueDate)}</div></div>${badge(stage.status,stageStatuses)}</div><div class="stage-tasks"><p class="stage-criteria"><strong>Критерии приёмки:</strong> ${esc(stage.criteria)}</p></div></article>`).join('')||empty('Этапы пока не выделены','В этой учебной работе можно начать с задания.')}<div class="table-footer"><span>Этапы показаны для знакомства с моделью работы.</span></div></section><section class="card section-spacer">${cardHead('Задания по работе','Действия в заданиях демонстрационные')}${tasks.map(taskCard).join('')||empty('Заданий пока нет','Нажмите «Новое задание», чтобы попробовать рабочий цикл.')}</section>${work.kind==='nir'?renderEconomy(work):''}</div><aside class="stack"><section class="card">${cardHead('Лаборатория','Ответственное подразделение',icon('users'))}<div class="card-body"><span class="lab-chip">${esc(lab.shortName)}</span><p class="text-small muted">${esc(lab.name)}</p><a class="button ghost" href="${queryLink('/works',{lab:lab.id})}">Работы лаборатории${icon('arrow')}</a></div></section><section class="card">${cardHead('История изменений','Действия в вашей копии')}${historyMarkup(work)}</section><div class="information"><strong>Приёмка и оплата — отдельные события.</strong><br>Учебная закрытая работа может иметь остаток к оплате по договору.</div></aside></div>`;
  }
  function renderForecast(work) {
    if(work.kind!=='nir'||work.status==='closed') return pageHead('Прогноз доступен только для просмотра','Изменение остаточного прогноза предусмотрено для незакрытых НИР.',button('К карточке',workLink(work),'arrow',true))+renderEconomy(work);
    return pageHead('Изменить остаточный прогноз',work.code+' · '+work.title,button('К карточке',workLink(work),'',true),'Экономика НИР')+`<div class="form-layout forecast-layout"><section class="card form-card forecast-form-card"><div class="forecast-section-title"><h2>Подтверждённый факт</h2><span class="card-label">Учебные данные</span></div><dl class="forecast-facts"><div><dt>Выручка без НДС</dt><dd>${currency(fact(work,'revenue'),true)}</dd></div><div><dt>Затраты с невозмещаемым НДС</dt><dd>${currency(fact(work,'cost'),true)}</dd></div></dl><p class="forecast-note">Подтверждённые суммы здесь не изменяются. Отсутствующие записи считаются нулевыми только после подтверждения полноты.</p><form id="forecast-form" data-form="forecast" data-id="${work.id}"><div class="form-errors" role="alert" hidden></div><div class="forecast-section-title forecast-section-separator"><h2>Оценка до завершения</h2></div><div class="information forecast-instruction">${icon('info')}<span>Укажите только то, что ещё не вошло в подтверждённый факт.</span></div><div class="forecast-fields"><div class="forecast-field"><label for="revenue-remaining">Оставшаяся выручка без НДС, ₽</label><input type="text" inputmode="decimal" id="revenue-remaining" name="revenueRemaining" value="${esc(work.forecast.revenueRemaining??'')}" maxlength="24" placeholder="Неизвестно" autocomplete="off"><p class="helptext">Пусто — неизвестно. 0 — новой выручки не ожидается.</p></div><div class="forecast-field"><label for="cost-remaining">Оставшиеся затраты с невозмещаемым НДС, ₽</label><input type="text" inputmode="decimal" id="cost-remaining" name="costRemaining" value="${esc(work.forecast.costRemaining??'')}" maxlength="24" placeholder="Неизвестно" autocomplete="off"><p class="helptext">Пусто — неизвестно. 0 — дополнительных затрат не ожидается.</p></div></div><div class="forecast-completeness"><label for="forecast-complete"><input type="checkbox" name="complete" id="forecast-complete"${work.forecast.complete?' checked':''}><span>Подтверждаю полноту исходных экономических данных</span></label><p>Учтены все известные выручка, затраты и оплата. Отсутствующие записи становятся нулевыми; неизвестный остаток по-прежнему делает прогноз неполным.</p></div><div class="forecast-field forecast-reason"><label for="forecast-reason">Причина изменения <span class="required-mark">обязательно</span></label><textarea id="forecast-reason" name="reason" required maxlength="1000" rows="4" placeholder="Что изменилось в оценке и почему"></textarea></div><div class="form-footer"><button class="button" type="submit">Сохранить прогноз${icon('check')}</button><a class="button secondary" href="${workLink(work)}">Отмена</a></div><p class="chart-caption">Сохранится только в этом браузере. Причина и предыдущие значения попадут в историю.</p></form></section><aside class="card form-aside forecast-aside live-forecast"><div class="eyebrow">Предварительный расчёт</div><h3>На весь срок НИР</h3><p>Факт + остаток = прогноз. Суммы ниже меняются по мере ввода; сохранение выполняется отдельно.</p><dl class="preview-metrics"><div><dt>Выручка</dt><dd data-preview="revenue"></dd></div><div><dt>Затраты</dt><dd data-preview="cost"></dd></div><div><dt>Прибыль</dt><dd data-preview="profit"></dd></div><div><dt>Рентабельность затрат</dt><dd data-preview="returnOnCost"></dd></div><div><dt>Маржа</dt><dd data-preview="margin"></dd></div></dl><p id="preview-status" aria-live="polite"></p><div class="information">Ноль и неизвестное различаются. При нулевых затратах рентабельность не определена; при нулевой выручке не определена маржа.</div></aside></div>`;
  }
  function updatePreview() {
    const form=$('#forecast-form');if(!form)return;
    const work=JSON.parse(JSON.stringify(workFor(form.dataset.id)));
    try {
      work.forecast={revenueRemaining:model.parseMoney(form.elements.revenueRemaining.value),costRemaining:model.parseMoney(form.elements.costRemaining.value),complete:form.elements.complete.checked};
      const calculation=model.calculate(work);
      $$('[data-preview]').forEach(node=>{const key=node.dataset.preview;node.textContent=['returnOnCost','margin'].includes(key)?percent(calculation[key]):currency(calculation[key],true);});
      $('#preview-status').textContent=complete(work)?'Исходные данные полные.':'Прогноз неполный: есть неизвестные остатки или не подтверждена полнота данных.';
    } catch(error) {
      $$('[data-preview]').forEach(node=>{node.textContent='—';});
      $('#preview-status').textContent='Для расчёта введите неотрицательные суммы, до двух знаков после запятой, либо оставьте поле пустым.';
    }
  }
  function renderNewWork() {
    const kind=Object.hasOwn(kinds,route.params.get('kind'))?route.params.get('kind'):'nir';
    return pageHead('Новая учебная работа','Созданная карточка сохранится только в этом браузере.',button('К реестру','#/works','',true))+`<div class="form-layout"><section class="card form-card"><form data-form="new-work"><div class="form-errors" role="alert" hidden></div><p><label for="new-title">Название работы</label><input id="new-title" name="title" type="text" required maxlength="200" placeholder="Например: Проверка нового режима прокатки"></p><div class="form-two"><p><label for="new-kind">Вид работы</label><select id="new-kind" name="kind">${options(kinds,kind)}</select></p><p><label for="new-code">Код работы</label><input id="new-code" name="code" type="text" required maxlength="40" value="УЧ-${Math.max(...state.works.map(work=>work.id),0)+1}"></p></div><div class="form-two"><p><label for="new-lab">Лаборатория</label><select id="new-lab" name="labId">${state.labs.map(lab=>`<option value="${lab.id}">${esc(lab.shortName)}</option>`).join('')}</select></p><p><label for="new-owner">Ответственный</label><input id="new-owner" name="owner" type="text" required maxlength="120" placeholder="Имя и фамилия"></p></div><div class="form-two"><p><label for="new-date">Плановый срок</label><input id="new-date" name="dueDate" type="date" required max="9999-12-31" value="${state.today}"></p><p><label for="new-status">Начальный статус</label><select id="new-status" name="status">${options({planned:'Запланировано',active:'В работе'},'planned')}</select></p></div><p><label for="new-description">Описание</label><textarea id="new-description" name="description" maxlength="2000" rows="3"></textarea></p><p><label for="new-criteria">Критерии результата</label><textarea id="new-criteria" name="criteria" required maxlength="2000" rows="3" placeholder="По каким признакам можно принять результат"></textarea></p><div class="form-footer"><button class="button" type="submit">Создать работу${icon('plus')}</button><a class="button secondary" href="#/works">Отмена</a></div></form></section><aside class="card form-aside"><div class="eyebrow">Учебный сценарий</div><h3>От карточки к результату</h3><p>После создания добавьте задание, попробуйте передать его на приёмку и принять результат.</p><p>Для НИР доступно изменение остаточного прогноза. При создании экономические суммы неизвестны, а полнота данных не подтверждена.</p><p>Учётные записи и реальные полномочия в этой демонстрации не моделируются.</p></aside></div>`;
  }
  function renderGuide() {
    return pageHead('Попробуйте рабочий цикл','Учебная версия без входа. Все суммы, участники и работы вымышлены.')+`<div class="guide-grid"><section class="card guide-card"><div class="guide-step">01 · Обзор и реестр</div><h2>Найдите нужную работу</h2><p>Откройте НИР, публикации, РИД или поручения. Используйте поиск, лабораторию и статус. Карточка объединяет сроки, критерии, этапы и задания.</p>${button('Открыть реестр','#/works','arrow',true)}</section><section class="card guide-card"><div class="guide-step">02 · Учебные действия</div><h2>Проведите задание через статусы</h2><p>Начните выполнение, опишите результат и передайте его на приёмку. Затем примите результат или верните на доработку. Это демонстрация процесса без проверки реальных полномочий.</p>${button('Открыть задания','#/tasks','arrow',true)}</section><section class="card guide-card"><div class="guide-step">03 · Экономика НИР</div><h2>Измените оценку до завершения</h2><p>В незакрытой НИР нажмите «Изменить прогноз». Укажите оставшиеся выручку и затраты, полноту данных и причину. Предварительный расчёт покажет результат ещё до сохранения.</p><p><strong>Факт + остаток = прогноз на весь срок.</strong> Пустое поле означает неизвестное; ноль — отсутствие остатка. Оплата учитывается отдельно.</p>${button('Открыть НИР','#/works?kind=nir','arrow',true)}</section><section class="card guide-card"><div class="guide-step">04 · Ваша копия</div><h2>Сохранение в этом браузере</h2><p>Изменения остаются на этом устройстве и в этом браузере. Они не отправляются на сервер и не появляются у других посетителей. История доступна в карточке каждой работы.</p><p>Очистка данных сайта или приватный режим могут удалить вашу копию. Не вводите рабочие или конфиденциальные сведения.</p></section></div><section class="card guide-card section-spacer"><div class="guide-step">Начать заново</div><h2>Вернуть исходные учебные данные</h2><p>Сброс удалит созданные здесь работы, изменения заданий и прогнозов. У других посетителей ничего не изменится.</p><button class="button danger" type="button" data-action="reset">Сбросить учебные данные</button></section><div class="information section-spacer">Замечания передайте человеку, который прислал ссылку: укажите код работы или страницу, что ожидали увидеть и что оказалось непонятным.</div>`;
  }
  function formError(form, text) {const box=$('.form-errors',form);box.textContent=text;box.hidden=false;box.setAttribute('tabindex','-1');box.focus();}
  function readText(form,name,max,required=false) {const text=String(new FormData(form).get(name)||'').trim();if(required&&!text)throw Error('Заполните все обязательные поля, включая описание результата или причину.');if(text.length>max)throw Error('Текст слишком длинный. Сократите его и повторите сохранение.');return text;}
  function validDate(value) {return /^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;}
  function nextId(items) {const id=Math.max(...items.map(item=>item.id),0)+1;if(id>1e9)throw Error('Достигнут предел учебной копии. Начните заново через сброс данных.');return id;}
  function closeDialog() {dialog.close();if(dialogInvoker?.isConnected)dialogInvoker.focus();else $('#page-title')?.focus();}
  function openDialog(html,invoker) {dialogInvoker=invoker;dialog.innerHTML=html;dialog.showModal();$('input,textarea',dialog)?.focus();}
  function dialogShell(title,subtitle,form) {return `<div class="dialog-heading"><div><div class="eyebrow">Демонстрационное действие</div><h2 id="dialog-title">${esc(title)}</h2><p>${esc(subtitle)}</p></div><button class="notice-dismiss" type="button" data-action="close-dialog" aria-label="Закрыть окно">×</button></div>${form}`;}
  function taskDialog(task,action,invoker) {
    const returning=action==='return';
    openDialog(dialogShell(returning?'Вернуть на доработку':'Передать результат на приёмку',task.title,`<form data-form="task-result" data-id="${task.id}" data-transition="${action}"><div class="form-errors" role="alert" hidden></div><label class="dialog-label" for="task-result">${returning?'Что необходимо исправить':'Результат выполнения'}</label><textarea id="task-result" name="result" rows="5" maxlength="2000" required placeholder="${returning?'Опишите замечания':'Что выполнено и чем подтверждён результат'}">${returning?'':esc(task.result)}</textarea><div class="form-footer"><button class="button" type="submit">${returning?'Вернуть на доработку':'Передать на приёмку'}</button><button class="button secondary" type="button" data-action="close-dialog">Отмена</button></div></form>`),invoker);
  }
  function newTaskDialog(work,invoker) {
    openDialog(dialogShell('Новое учебное задание',work.code+' · '+work.title,`<form data-form="new-task" data-id="${work.id}"><div class="form-errors" role="alert" hidden></div><p><label class="dialog-label" for="task-title">Название задания</label><input id="task-title" type="text" name="title" required maxlength="200"></p><div class="form-two"><p><label class="dialog-label" for="task-assignee">Исполнитель</label><input id="task-assignee" type="text" name="assignee" required maxlength="120"></p><p><label class="dialog-label" for="task-reviewer">Принимающий</label><input id="task-reviewer" type="text" name="reviewer" required maxlength="120"></p></div><p><label class="dialog-label" for="task-date">Срок</label><input id="task-date" type="date" name="dueDate" value="${work.dueDate}" required max="9999-12-31"></p><div class="form-footer"><button class="button" type="submit">Создать задание${icon('plus')}</button><button class="button secondary" type="button" data-action="close-dialog">Отмена</button></div></form>`),invoker);
  }
  function transitionTask(id,action,result='') {
    const next=clone(),task=next.tasks.find(item=>item.id===Number(id));
    if(!task)throw Error('Задание не найдено. Обновите страницу.');
    const work=next.works.find(item=>item.id===task.workId);
    if(work.status==='closed')throw Error('Работа закрыта. Изменение задания недоступно.');
    const allowed={start:['todo','doing'],submit:['doing','review'],accept:['review','done'],return:['review','doing']};
    if(!allowed[action]||task.status!==allowed[action][0])throw Error('Статус задания уже изменился. Проверьте карточку.');
    task.status=allowed[action][1];
    if(action==='submit')task.result=result;
    const labels={start:'Задание начато',submit:'Задание передано на приёмку',accept:'Результат задания принят',return:'Задание возвращено на доработку'};
    log(work,'Учебное действие: '+labels[action].toLowerCase(),task.title+(result?'\n'+(action==='return'?'Замечания: ':'Результат: ')+result:''));
    commit(next,labels[action]+'. Изменение добавлено в историю.');
  }
  document.addEventListener('submit',event=>{
    const form=event.target.closest('form[data-form]');if(!form)return;event.preventDefault();
    try {
      const data=new FormData(form),type=form.dataset.form;
      if(type==='work-filter'||type==='task-filter') {location.hash=queryLink(type==='work-filter'?'/works':'/tasks',Object.fromEntries([...data.entries()].map(([key,value])=>[key,String(value).trim()])));return;}
      if(type==='forecast') {
        const next=clone(),work=next.works.find(item=>item.id===Number(form.dataset.id));
        if(!work||work.kind!=='nir'||work.status==='closed')throw Error('Изменение прогноза этой работы недоступно.');
        const reason=readText(form,'reason',1000,true),before=work.forecast;
        const after={revenueRemaining:model.parseMoney(String(data.get('revenueRemaining'))),costRemaining:model.parseMoney(String(data.get('costRemaining'))),complete:data.has('complete')};
        work.forecast=after;
        log(work,'Изменён остаточный прогноз',`Остаток выручки: ${currency(before.revenueRemaining,true)} → ${currency(after.revenueRemaining,true)}.\nОстаток затрат: ${currency(before.costRemaining,true)} → ${currency(after.costRemaining,true)}.\nПолнота: ${before.complete?'подтверждена':'не подтверждена'} → ${after.complete?'подтверждена':'не подтверждена'}.\nПричина: ${reason}`);
        commit(next,'Прогноз сохранён. Показатели пересчитаны, причина добавлена в историю.',workLink(work));return;
      }
      if(type==='new-work') {
        const next=clone(),kind=String(data.get('kind')),status=String(data.get('status')),labId=Number(data.get('labId')),dueDate=String(data.get('dueDate'));
        if(!Object.hasOwn(kinds,kind)||!['planned','active'].includes(status)||!next.labs.some(lab=>lab.id===labId)||!validDate(dueDate))throw Error('Проверьте вид работы, лабораторию, статус и дату.');
        const code=readText(form,'code',40,true);if(next.works.some(work=>work.code.toLocaleLowerCase('ru')===code.toLocaleLowerCase('ru')))throw Error('Такой код уже используется. Укажите другой код работы.');
        const work={id:nextId(next.works),code,title:readText(form,'title',200,true),kind,labId,owner:readText(form,'owner',120,true),status,dueDate,description:readText(form,'description',2000),criteria:readText(form,'criteria',2000,true),contractGross:null,minReturn:15,forecast:{revenueRemaining:null,costRemaining:null,complete:false},facts:{revenue:null,cost:null,payment:null},stages:[],history:[]};
        log(work,'Создана учебная работа','Карточка добавлена в вашей копии браузера.');next.works.push(work);commit(next,'Учебная работа создана. Теперь можно добавить задание.',workLink(work));return;
      }
      if(type==='task-result') {const result=readText(form,'result',2000,true);transitionTask(form.dataset.id,form.dataset.transition,result);closeDialog();return;}
      if(type==='new-task') {
        const next=clone(),work=next.works.find(item=>item.id===Number(form.dataset.id)),dueDate=String(data.get('dueDate'));
        if(!work||work.status==='closed'||!validDate(dueDate))throw Error('Проверьте работу и срок задания.');
        const task={id:nextId(next.tasks),workId:work.id,title:readText(form,'title',200,true),assignee:readText(form,'assignee',120,true),reviewer:readText(form,'reviewer',120,true),dueDate,status:'todo',result:''};
        if(task.assignee.toLocaleLowerCase('ru')===task.reviewer.toLocaleLowerCase('ru'))throw Error('Исполнитель и принимающий должны быть разными участниками.');
        if(task.dueDate>work.dueDate)throw Error('Срок задания не может быть позже планового срока работы: '+date(work.dueDate)+'.');
        next.tasks.push(task);log(work,'Создано учебное задание',task.title+'\nИсполнитель: '+task.assignee+'; принимает: '+task.reviewer+'.');commit(next,'Учебное задание создано.');closeDialog();return;
      }
    } catch(error) {formError(form,error.message||'Проверьте введённые данные.');}
  });
  document.addEventListener('input',event=>{if(event.target.closest('#forecast-form'))updatePreview();});
  document.addEventListener('click',event=>{
    const skip=event.target.closest('[data-skip]');if(skip){event.preventDefault();$('#page-title')?.focus();return;}
    if(event.target.closest('[data-menu-toggle]')){setMenu(!$('#sidebar').classList.contains('open'));return;}
    if(event.target.closest('[data-close-menu]')){setMenu(false,true);return;}
    const control=event.target.closest('[data-action]');if(!control)return;
    const action=control.dataset.action;
    try {
      if(action==='dismiss-message'){message=null;showNotices();return;}
      if(action==='close-dialog'){closeDialog();return;}
      if(action==='jump-economy'){$('#economy')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'});return;}
      if(action==='reset') {if(confirm('Удалить изменения в этом браузере и вернуть исходные учебные данные? У других посетителей ничего не изменится.')){commit(model.reset(),'Исходные учебные данные восстановлены.','#/');}return;}
      const work=workFor(control.dataset.id);
      if(action==='new-task'&&work&&work.status!=='closed'){newTaskDialog(work,control);return;}
      const task=state.tasks.find(item=>item.id===Number(control.dataset.id));
      if(!task)return;
      if(action==='task-start'){transitionTask(task.id,'start');return;}
      if(action==='task-submit'){taskDialog(task,'submit',control);return;}
      if(action==='task-return'){taskDialog(task,'return',control);return;}
      if(action==='task-accept'&&confirm('Принять учебный результат задания? Действие сохранится только в вашем браузере.'))transitionTask(task.id,'accept');
    } catch(error) {announce(error.message||'Не удалось выполнить действие.','error');showNotices();}
  });
  document.addEventListener('keydown',event=>{
    const sidebar=$('#sidebar');
    if(event.key==='Escape'&&sidebar.classList.contains('open')){event.preventDefault();setMenu(false,true);}
    if(event.key==='Tab'&&sidebar.classList.contains('open')&&matchMedia('(max-width:760px)').matches){const links=$$('a,button:not([disabled])',sidebar);const first=links[0],last=links[links.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
  });
  dialog.addEventListener('click',event=>{if(event.target===dialog){const bounds=dialog.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)closeDialog();}});
  dialog.addEventListener('cancel',()=>{if(dialogInvoker?.isConnected)dialogInvoker.focus();});
  window.addEventListener('hashchange',render);
  matchMedia('(max-width:760px)').addEventListener('change',()=>setMenu(false));
  try {
    if(!model)throw Error('Не удалось загрузить учебные данные. Обновите страницу или повторно откройте ссылку.');
    const loaded=model.load();state=loaded.state;storageWarning=loaded.warning||'';
    if(!model.storageAvailable()&&!storageWarning)storageWarning='Браузер не разрешает постоянное хранение. Изменения будут доступны только до закрытия или обновления страницы.';
    render();
  } catch(error) {view.innerHTML=empty('Не удалось открыть учебную версию',error.message||'Обновите страницу.');}
})();
