import * as pdfjs from './vendor/pdfjs/build/pdf.min.mjs';
const asset = path => new URL(path, import.meta.url).href;
pdfjs.GlobalWorkerOptions.workerSrc = asset('./vendor/pdfjs/build/pdf.worker.min.mjs');
const MAX_BYTES = 50 * 1024 * 1024, MAX_PAGES = 100;
const cancelled = () => new DOMException('Распознавание отменено.', 'AbortError');
function check(signal) { if (signal?.aborted) throw cancelled(); }
function bounded(promise, ms, message, signal) {
  return new Promise((resolve,reject) => {
    const timer = setTimeout(() => { cleanup(); reject(Error(message)); }, ms);
    const abort = () => { cleanup(); reject(cancelled()); };
    function cleanup() { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
    signal?.addEventListener('abort', abort, {once:true});
    if(signal?.aborted) { abort(); return; }
    Promise.resolve(promise).then(v => {cleanup();resolve(v);},e => {cleanup();reject(e);});
  });
}
export function groupLines(items) {
  const rows=[];
  for(const item of [...items].sort((a,b)=>a.y-b.y||a.x-b.x)) {
    if(!item.text.trim()) continue;
    let row=rows.findLast(r=>Math.abs((r.y+r.height)-(item.y+item.height))<=Math.max(3,Math.min(r.height,item.height)*.5));
    if(!row){row={y:item.y,height:item.height,items:[]};rows.push(row);}
    row.items.push(item);
  }
  return rows.sort((a,b)=>a.y-b.y).map(row=>{
    const words=row.items.sort((a,b)=>a.x-b.x), cells=[];let text='',previous=null;
    for(const word of words){
      const gap=previous?word.x-previous.x-previous.width:0;
      const separator=previous?(gap>Math.max(9,row.height*.9)?'\t':' '):'';
      text+=separator+word.text.trim();previous=word;
    }
    return {text,x:words[0].x,y:row.y,width:Math.max(...words.map(w=>w.x+w.width))-words[0].x,height:row.height,cells:text.split('\t')};
  });
}
function fromPDF(items,viewport) {
  return groupLines(items.filter(i=>typeof i.str==='string').map(i=>{
    const t=pdfjs.Util.transform(viewport.transform,i.transform),h=Math.hypot(t[2],t[3])||i.height||10;
    return {text:i.str,x:t[4],y:t[5]-h,width:i.width*viewport.scale,height:h};
  }));
}
function fromTSV(tsv) {
  const items=[];
  for(const line of String(tsv||'').split('\n').slice(1)){
    const p=line.split('\t'); if(p[0]!=='5'||!p[11]?.trim())continue;
    items.push({text:p.slice(11).join('\t'),x:Number(p[6]),y:Number(p[7]),width:Number(p[8]),height:Number(p[9])});
  }
  return groupLines(items);
}
function readable(text){return (text.match(/[А-Яа-яЁёA-Za-z]/g)||[]).length>=25 && (text.match(/\uFFFD/g)||[]).length<Math.max(3,text.length*.03);}
let tessPromise;
function loadTesseract(){
  if(window.Tesseract)return Promise.resolve(window.Tesseract);
  if(!tessPromise)tessPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=asset('./vendor/tesseract/tesseract.min.js');
    script.onload=()=>resolve(window.Tesseract);script.onerror=()=>{tessPromise=null;script.remove();reject(Error('Не удалось загрузить модуль распознавания. Проверьте соединение и повторите.'));};document.head.append(script);
  });
  return tessPromise;
}
export async function readPDF(file,{onProgress=()=>{},signal,forceOCR=false}={}) {
  check(signal);
  if(!file||file.size===0)throw Error('Выберите непустой файл PDF.');
  if(file.size>MAX_BYTES)throw Error('Файл больше 50 МБ. Для проверки выберите PDF меньшего размера.');
  const bytes=new Uint8Array(await file.arrayBuffer());check(signal);
  if(!new TextDecoder('latin1').decode(bytes.slice(0,1024)).includes('%PDF-'))throw Error('В выбранном файле не найден формат PDF.');
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
  onProgress({message:'Открываем PDF…',page:0,total:0});
  let loadingTask,doc,ocr,ocrPending=null,stopped=false;
  const stop=()=>{stopped=true;try{loadingTask?.destroy().catch(()=>{});}catch{}try{ocr?.terminate().catch(()=>{});}catch{}};
  signal?.addEventListener('abort',stop,{once:true});
  const pages=[], warnings=[]; const started=Date.now(); let ocrPage=0,ocrTotal=0;
  async function getOCR(page,total){
    if(ocr)return ocr;
    onProgress({message:'Подготавливаем распознавание сканов. Первый запуск загружает языковые модули…',page,total});
    const T=await bounded(loadTesseract(),60000,'Не удалось загрузить распознавание.',signal);
    ocrPending=T.createWorker('rus+eng',1,{workerPath:asset('./vendor/tesseract/worker.min.js'),corePath:asset('./vendor/tesseract-core/'),langPath:asset('./vendor/tessdata'),workerBlobURL:false,cacheMethod:'none',logger:m=>{if(m.status==='recognizing text')onProgress({message:`Распознаём скан ${ocrPage} из ${ocrTotal} · ${Math.round(m.progress*100)}%`,page:ocrPage,total:ocrTotal});},errorHandler:()=>{}});
    let abandoned=false;ocrPending.then(w=>{if(stopped||abandoned)w.terminate().catch(()=>{});},()=>{});
    try{ocr=await bounded(ocrPending,120000,'Подготовка распознавания заняла больше двух минут. Повторите импорт.',signal);}catch(e){abandoned=true;throw e;}
    check(signal);await ocr.setParameters({preserve_interword_spaces:'1',user_defined_dpi:'200',tessedit_pageseg_mode:'3'});return ocr;
  }
  try{
    loadingTask=pdfjs.getDocument({data:bytes,isEvalSupported:false,enableXfa:false,cMapUrl:asset('./vendor/pdfjs/cmaps/'),cMapPacked:true,standardFontDataUrl:asset('./vendor/pdfjs/standard_fonts/'),wasmUrl:asset('./vendor/pdfjs/wasm/'),useWorkerFetch:true,maxImageSize:24000000,canvasMaxAreaInBytes:48000000});
    doc=await bounded(loadingTask.promise,45000,'Не удалось открыть PDF за 45 секунд.',signal);check(signal);
    if(doc.numPages>MAX_PAGES)throw Error('В PDF больше 100 страниц. Разделите документ на меньшие файлы для тестирования.');
    for(let n=1;n<=doc.numPages;n++){
      ocrPage=n;ocrTotal=doc.numPages;check(signal);
      if(Date.now()-started>12*60*1000){for(let k=n;k<=doc.numPages;k++)pages.push({number:k,text:'',lines:[],status:'unprocessed',message:'Достигнут предел 12 минут на один документ.'});break;}
      onProgress({message:`Читаем страницу ${n} из ${doc.numPages}…`,page:n,total:doc.numPages});
      let page,canvas,lines=[],text='',status='text',message='';
      try{
        page=await bounded(doc.getPage(n),30000,'Не удалось открыть страницу.',signal);
        const content=await bounded(page.getTextContent(),30000,'Не удалось извлечь текст страницы.',signal);
        lines=fromPDF(content.items,page.getViewport({scale:1}));text=lines.map(l=>l.text).join('\n');
        if(forceOCR||!readable(text)){
          const original={lines,text};
          try{
            const worker=await getOCR(n,doc.numPages);check(signal);
            const natural=page.getViewport({scale:1});const scale=Math.min(200/72,Math.sqrt(6500000/(natural.width*natural.height)));
            const viewport=page.getViewport({scale});canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
            onProgress({message:`Распознаём скан ${n} из ${doc.numPages}…`,page:n,total:doc.numPages});
            await bounded(page.render({canvasContext:canvas.getContext('2d'),viewport}).promise,45000,'Не удалось отобразить страницу для распознавания.',signal);
            const result=await bounded(worker.recognize(canvas,{}, {text:true,tsv:true}),90000,'Распознавание страницы заняло больше 90 секунд.',signal);
            const found=fromTSV(result.data.tsv),foundText=found.length?found.map(l=>l.text).join('\n'):result.data.text||'';
            if(readable(foundText)){lines=found;text=foundText;status=Number(result.data.confidence)<50?'partial':'ocr';message=status==='partial'?'Низкая уверенность распознавания; обязательно сверить с PDF.':'';}
            else if(readable(original.text)){lines=original.lines;text=original.text;status='partial';message='Скан не распознан уверенно. Сохранён только доступный текстовый слой.';}
            else{lines=found;text=foundText;status='unreadable';message='Не удалось получить читаемый текст. Проверьте страницу в PDF.';}
          }catch(e){
            check(signal);try{await ocr?.terminate();}catch{}ocr=null;
            lines=original.lines;text=original.text;status=readable(text)?'partial':'error';message='Распознавание скана не завершено: '+e.message;
          }
        }
      }catch(e){check(signal);status='error';message='Страница не прочитана: '+e.message;}
      finally{if(canvas){canvas.width=0;canvas.height=0;}page?.cleanup();}
      if(text.length>150000){text=text.slice(0,150000);lines=[];status='partial';message='Текст страницы превышает допустимый объём; часть не обработана.';}
      pages.push({number:n,text,lines,status,message});
      if(message)warnings.push(`Страница ${n}: ${message}`);
    }
    check(signal);
    const complete=pages.length===doc.numPages && pages.every(p=>['text','ocr'].includes(p.status));
    return {pages,warnings,source:{sha256:hash,fileName:file.name.slice(0,255),size:file.size,pageCount:doc.numPages,complete,pageStatus:pages.map(p=>({page:p.number,status:p.status,message:p.message||''})),method:'browser-pdf'}};
  }catch(e){
    if(e.name==='PasswordException')throw Error('PDF защищён паролем. Для теста выберите копию без защиты.');
    if(e.name==='InvalidPDFException')throw Error('PDF повреждён или имеет неподдерживаемый формат.');
    throw e;
  }finally{
    signal?.removeEventListener('abort',stop);stopped=true;try{await ocr?.terminate();}catch{}try{await loadingTask?.destroy();}catch{}
  }
}
