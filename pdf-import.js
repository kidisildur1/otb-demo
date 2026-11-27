(() => {
  'use strict';
  let busy=false,controller=null,progress={message:'',page:0,total:0},error='',ready=false,selectedName='';
  const select = s => document.querySelector(s);
  function status(c){return `<div class="pdf-progress" role="status" aria-live="polite"><strong>${c.esc(progress.message)}</strong>${progress.total?`<progress value="${progress.page}" max="${progress.total}" aria-label="Обработка страниц"></progress>`:''}</div>`;}
  function render(c){
    return c.pageHead('Импорт договора из PDF','Добавьте свой документ, проверьте найденные поля и сохраните НИР в этом браузере.',c.button('Посмотреть учебный пример','#/contract-example','',true),'Договоры')+
      `<div class="pdf-import-grid"><section class="card"><div class="card-body"><h2>Выберите PDF</h2><p>Договор, календарный план и график платежей — в одном файле. До 50 МБ и 100 страниц.</p>
      ${busy?`<p>${c.esc(selectedName)}</p><div id="pdf-progress">${status(c)}</div><button class="button secondary" type="button" data-action="pdf-import-cancel">Отменить распознавание</button>`:
        `<form data-form="pdf-import"><label class="pdf-file-label">Файл договора<input type="file" name="pdf" accept=".pdf,application/pdf" required></label><label class="check-field pdf-ocr-option"><input type="checkbox" name="forceOCR"><span>Распознать все страницы как сканы<br><small>Если текстовый слой PDF неполный или повреждён. Обработка займёт больше времени.</small></span></label><p class="muted text-small">Текст извлекается сразу. Страницы без читаемого текста распознаются автоматически на русском и английском.</p><button class="button" type="submit" data-action="pdf-import-start">Прочитать PDF</button></form>`}
      ${error?`<div class="message warning section-spacer" role="alert">${c.esc(error)}</div>`:''}
      ${ready&&!busy?`<p class="section-spacer">Последний обработанный документ доступен до перезагрузки страницы.</p>${c.button('Продолжить проверку','#/contract-import/review','arrow',true)}`:''}
      </div></section><aside class="stack"><section class="card"><div class="card-body"><h2>Как проходит проверка</h2><ol class="pdf-steps"><li>Прочитаем все страницы, включая приложения.</li><li>Покажем реквизиты, этапы, платежи и фрагменты источника.</li><li>Проверьте и исправьте поля перед сохранением.</li></ol><p>Неизвестные суммы и сроки останутся пустыми. Относительные сроки сохранятся как условия; календарные даты автоматически не выдумываются.</p></div></section><div class="information"><strong>PDF остаётся на вашем устройстве.</strong><p>Файл не отправляется на сервер. Для чтения и распознавания браузер загружает программы и языковые модули с этого же сайта.</p><p>После сохранения поля карточки останутся только в этом браузере. Сам PDF не сохраняется; для повторного просмотра используйте исходный файл. Общей базы и защиты входом в тестовой версии нет.</p></div></aside></div>`;
  }
  function update(c,value){progress=value;const node=select('#pdf-progress');if(node)node.innerHTML=status(c);}
  async function start(c,file,forceOCR){
    if(busy)return;
    if(!file){error='Выберите файл PDF.';c.render();return;}
    busy=true;error='';selectedName=file.name;controller=new AbortController();const current=controller;progress={message:'Подготавливаем файл…',page:0,total:0};c.render();
    try{
      const {readPDF}=await import('./pdf-reader.mjs?v=20261127-pdf2');
      const result=await readPDF(file,{signal:current.signal,forceOCR,onProgress:value=>update(c,value)});
      if(current.signal.aborted)throw new DOMException('Отменено','AbortError');
      update(c,{message:'Собираем карточку, этапы и график платежей…',page:result.source.pageCount,total:result.source.pageCount});
      const parsed=window.OTBContractParser.parse(result.pages);
      parsed.warnings=[...result.warnings,...(parsed.warnings||[])];
      if(!result.source.complete)parsed.warnings.unshift('Обработка неполная. Проверьте отмеченные страницы исходного PDF и дополните поля вручную.');
      window.OTBContracts.setImportDraft({...parsed,source:result.source});ready=true;busy=false;
      if(c.route.path==='/contract-import')location.hash='#/contract-import/review';
      else {c.announce('PDF обработан. Проверка доступна в разделе «Импорт PDF».');c.render();}
    }catch(e){
      error=e.name==='AbortError'?'Распознавание отменено. Новая карточка не сохранена.':('Не удалось обработать файл. '+String(e.message||e));
      busy=false;if(c.route.path==='/contract-import')c.render();else{c.announce(error,'warning');c.render();}
    }finally{if(controller===current)controller=null;}
  }
  function handleSubmit(c,form){
    if(form.dataset.form!=='pdf-import')return false;
    const file=form.querySelector('input[name="pdf"]').files[0],forceOCR=form.elements.forceOCR.checked;
    void start(c,file,forceOCR);return true;
  }
  function handleClick(c,control){
    if(control.dataset.action==='pdf-import-cancel'){controller?.abort();return true;}
    return false;
  }
  window.OTBPDFImport={render,handleSubmit,handleClick};
})();
