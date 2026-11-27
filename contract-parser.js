(function (root) {
'use strict';
// Conservative candidates from PDF text; every detected value retains its source.
const DATE = '(?:\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[.\\-/]\\d{1,2}[.\\-/]20\\d{2}|[«"]?\\d{1,2}[»"]?\\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\\s+20\\d{2})';
const MONTHS=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const MONEY=/(?<![\d.,])([-−]?\s*\d(?:[\d \u00a0\u202f]*\d)?(?:[,.]\d{1,2})?)\s*(тыс\.?|млн\.?)?\s*(?:\([^)]{1,250}\)\s*)?(руб(?:лей|ля|ль)?\.?|₽|RUB|USD|EUR|CNY|доллар[а-я]*|евро|юан[а-я]*)/gi;
const STAGE=/^(?:Этап|Stage)\s*(?:№\s*)?(\d{1,6}(?:\.\d{1,6})*)\s*(?:[:)–—-]|\.(?=\s))?\s*(.*)$/i;
const SECTION=/^(?:\d+(?:\.\d+)*[.)]?\s+)?(?:Реквизиты|Банковские|Юридические|Адреса и|Условия (?:оплаты|при[её]мки)|Порядок (?:оплаты|расч[её]тов|при[её]мки|сдачи)|График (?:платежей|оплаты)|Плат[её]жный график|Срок действия|Ответственность сторон|Заключительные положения|Приложение\s*№?\s*\d+)/i;
const PRICE_HEAD=/^(?:\d+(?:\.\d+)*[.)]?\s+)?(?:Общая (?:стоимость|цена)(?:\s+работ|\s+договора)?|Стоимость договора|Цена договора|Стоимость работ по договору)(?=\s|[:(–—-]|$)/i;
const PAY_HEAD=/(?:аванс|предоплат|промежуточн[а-я]* плат[её]ж|окончательн[а-я]* (?:плат[её]ж|расч[её]т)|оплат[а-я]* этап|плат[её]ж\s*№?\s*\d)/i;
const RELATIVE=/после|со дня|с даты|по истечении|дней|месяц|недел|при условии/i;
const clean=v=>String(v??'').replace(/\u00ad/g,'-').replace(/\s+/g,' ').trim();
const rx=(s,flags='i')=>new RegExp(s,flags);
const unique=a=>[...new Set(a)];
function num(v){const x=Number(clean(v).replace(/ /g,'').replace(',','.').replace('−','-'));return clean(v)&&Number.isFinite(x)&&x>=0&&x<1e14?Math.round((x+Number.EPSILON)*100)/100:null;}
function parsedDate(value){const raw=clean(value).replace(/[«»"]/g,'');let y,m,d,match;if((match=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/))){[,y,m,d]=match;}else if((match=raw.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](20\d{2})$/))){[,d,m,y]=match;}else{const a=raw.toLowerCase().split(' ');if(a.length!==3||!MONTHS.includes(a[1]))return null;[d,,y]=a;m=MONTHS.indexOf(a[1])+1;}y=Number(y);m=Number(m);d=Number(d);const valueDate=new Date(Date.UTC(y,m-1,d));return valueDate.getUTCFullYear()===y&&valueDate.getUTCMonth()+1===m&&valueDate.getUTCDate()===d?`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`:null;}
function dates(text){return [...String(text).matchAll(rx(DATE,'gi'))].map(m=>parsedDate(m[0])).filter(Boolean);}
function currency(text){const found=[['RUB',/руб|₽|\bRUB\b/i],['USD',/доллар|\bUSD\b/i],['EUR',/евро|\bEUR\b/i],['CNY',/юан|\bCNY\b/i]].filter(([,r])=>r.test(text)).map(([c])=>c);return found.length===1?found[0]:'';}
function taxSignals(text){return [/НДС\s*не\s*облага|не\s*облага[а-я]*\s*НДС|освобожд[а-я]*\s*от\s*НДС/i.test(text),/без\s*НДС|НДС\s*(?:начисляется|сверх|дополнительно)/i.test(text),/(?:^|[\s,;])с\s+НДС|включая\s+НДС|в\s+том\s+числе\s+НДС|НДС\s*включ/i.test(text)];}
function basis(text){const signals=taxSignals(text),count=signals.filter(Boolean).length;return count===1?['exempt','excluded','included'][signals.indexOf(true)]:'unknown';}
function moneyValues(text,context=''){const out=[];for(const m of String(text).matchAll(MONEY)){const n=num(m[1]),mult=/тыс/i.test(m[2]||'')?1e3:/млн/i.test(m[2]||'')?1e6:1;if(n!==null&&n*mult<1e14)out.push({amount:Math.round(n*mult*100)/100,currency:currency(m[3]),end:m.index+m[0].length});}if(!out.length&&/^\s*[-−]?\d[\d \u00a0\u202f]*(?:[,.]\d{1,2})?\s*$/.test(text)&&currency(context)){const n=num(text),mult=/тыс/i.test(context)?1e3:/млн/i.test(context)?1e6:1;if(n!==null&&n*mult<1e14)out.push({amount:Math.round(n*mult*100)/100,currency:currency(context),end:null});}return out;}
function price(text,context=''){const values=moneyValues(text,context),tax=basis(text+' '+context);if(!values.length)return {amount:null,currency:currency(text+' '+context),vatBasis:tax};let valid=values.length===1;if(values.length===2&&values[0].end!==null)valid=/^[,;\s]*(?:в том числе|включая)\s+НДС/i.test(text.slice(values[0].end));return {amount:valid?values[0].amount:null,currency:unique([...values.map(x=>x.currency),currency(context)].filter(Boolean)).length===1?values[0].currency:'',vatBasis:tax};}
class Collector{
 constructor(){this.values=new Map();this.evidence=[];this.warnings=[];this.conflicts=[];this.seen=new Set();this.originals=new Map();this.evidenceLimit=false;}
 add(key,value,page,text){if(value===null||value===undefined||value==='')return;if(!this.values.has(key))this.values.set(key,[]);this.values.get(key).push(value);const e={field:key,page,text:String(this.originals.get(page+'|'+text)||text).slice(0,5000)},sig=JSON.stringify(e);if(!this.seen.has(sig)){if(this.evidence.length<1000){this.seen.add(sig);this.evidence.push(e);}else if(!this.evidenceLimit){this.evidenceLimit=true;this.warnings.push('Показаны первые 1000 фрагментов источника. Для оставшихся сведений проверьте исходный PDF.');}}}
 resolve(key){const vs=unique(this.values.get(key)||[]);if(vs.length===1)return vs[0];if(vs.length>1){if(key.endsWith('.title')&&unique(vs.map(v=>v.replace(/\s+/g,''))).length===1)return vs.sort((a,b)=>b.length-a.length)[0];if(!this.conflicts.some(x=>x.field===key)){this.conflicts.push({field:key,values:vs});this.warnings.push(`${key}: найдено несколько разных значений; выберите правильное по исходнику.`);}}return null;}
 dates(prefix,text,page){const patterns={startDate:'(?:Начало(?:\\s+(?:этапа|работ))?|Срок начала(?:\\s+работ)?)\\s*[:–—-]\\s*',dueDate:'(?:Окончание(?:\\s+(?:этапа|работ))?|Срок (?:окончания|завершения)(?:\\s+работ)?)\\s*[:–—-]\\s*'};for(const [key,pat]of Object.entries(patterns))for(const m of text.matchAll(rx(pat+'('+DATE+')','gi')))this.add(prefix+key,parsedDate(m[1]),page,text);for(const m of text.matchAll(rx('(?:Срок(?:\\s+(?:этапа|выполнения|работ))*|Период(?: выполнения)?)\\s*[:–—-]?\\s*с\\s*('+DATE+')\\s*(?:по|до|–|—|-)\\s*('+DATE+')','gi'))){this.add(prefix+'startDate',parsedDate(m[1]),page,text);this.add(prefix+'dueDate',parsedDate(m[2]),page,text);}}
}
function parse(pages){
 if(!Array.isArray(pages))throw Error('Не удалось прочитать страницы PDF.');
 const c=new Collector(),stageIds=[],paymentRows=[],partyRaw={customer:[],executor:[]},rawLines=[];
 const sourcePages=pages.slice(0,100).map((p,i)=>({...p,number:Number.isInteger(p.number)&&p.number>0?p.number:i+1,text:String(p.text||'').slice(0,500000)}));
 if(pages.length>100)c.warnings.push('Разобраны только первые 100 страниц.');
 for(const p of sourcePages)for(const raw of p.text.replace(/\u00a0/g,' ').split(/\r?\n/))if(clean(raw)){
  let line=clean(raw);
  if(['ocr','partial'].includes(p.status)){
   const normalized=line.replace(/(\d[\d ,.]*\s+)(?:py6|pуб|рyб|ру6)(?=[.,;\s]|$)/gi,'$1руб');
   if(normalized!==line){c.originals.set(p.number+'|'+normalized,line);line=normalized;c.warnings.push(`Страница ${p.number}: похожая после OCR подпись валюты «руб.» требует проверки по PDF.`);}
  }
  rawLines.push({page:p.number,line,raw});
 }
 let stage=null,party=null,payment=null,inAcceptance=false;const acceptance=[];
 const addContract=(key,value,p,line)=>c.add('contract.'+key,value,p,line);
 const startStage=(n,title,p,line)=>{if(!stageIds.includes(n)){if(stageIds.length>=100){c.warnings.push('Найдено более 100 этапов. Оставшиеся строки требуют отдельной проверки.');return null;}stageIds.push(n);}c.add(`stages.${n}.sourceNumber`,n,p,line);if(title)c.add(`stages.${n}.title`,title.replace(/^[ :–—«»"-]+|[ :–—«»"-]+$/g,''),p,line);return n;};
 const addPrice=(prefix,text,p,line,context='')=>{const v=price(text,context);for(const key of ['amount','currency','vatBasis'])if(key!=='vatBasis'||v[key]!=='unknown'||taxSignals(text+' '+context).filter(Boolean).length>1)c.add(prefix+key,v[key],p,line);if(v.currency===''&&moneyValues(text,context).length)c.warnings.push(`${prefix}валюта: несколько валют в ячейке или заголовке, проверьте исходник.`);if(taxSignals(text+' '+context).filter(Boolean).length>1)c.warnings.push(`${prefix}НДС: противоречивые налоговые условия, проверьте основу цены.`);if(v.amount===null&&moneyValues(text,context).length)c.warnings.push(`${prefix}стоимость: несколько сумм или неоднозначные единицы, нужна ручная проверка.`);};
 const paymentLimit=()=>{const message='Обработаны первые 200 строк платежей. Остальные строки требуют отдельной проверки по исходному PDF.';if(!c.warnings.includes(message))c.warnings.push(message);};
 const pushPayment=()=>{if(payment){if(paymentRows.length<200)paymentRows.push(payment);else paymentLimit();payment=null;}};
 for(const {page:p,line,raw}of rawLines){
  // Table lines are parsed by column below, never as prose or a single price.
  if(/\||\t| {2,}/.test(raw.trim())&&raw.trim().split(/\s*\|\s*|\t+| {2,}/).length>=3&&!/^(?:Стоимость(?: этапа| договора| работ)?|Цена(?: этапа| договора)?|Общая стоимость(?: договора)?|Содержание(?: работ)?|Результат(?: работ| этапа)?|Начало(?: работ| этапа)?|Окончание(?: работ| этапа)?)\s*:/i.test(line))continue;
  let m=line.match(STAGE);
  if(m&&m[2]&&!/^(?:с|до|выполн|принима|оплач|стоим|в размере)(?:\s|$)/i.test(m[2])){pushPayment();inAcceptance=false;stage=startStage(m[1],m[2],p,line);continue;}
  if(SECTION.test(line)||PRICE_HEAD.test(line)||/^(?:Заказчик|Исполнитель|Аванс|Промежуточный плат[её]ж|Окончательный плат[её]ж)\s*:/i.test(line))stage=null;
  if(/^(?:\d+[.)]?\s*)?(?:Условия|Порядок)\s+(?:при[её]мки|сдачи)/i.test(line)){pushPayment();inAcceptance=true;stage=null;}else if(inAcceptance&&SECTION.test(line))inAcceptance=false;
  if(inAcceptance){acceptance.push({p,line});continue;}
  const paymentStart=PAY_HEAD.test(line)&&!/^Срок(?:\s|$)/i.test(line)&&(moneyValues(line).length||/\d+(?:[,.]\d+)?\s*%/.test(line));
  if(paymentStart){pushPayment();stage=null;payment={text:line,page:p,source:[{page:p,text:line}]};continue;}
  if(payment&&(/^(?:Срок|Дата|Условие|Оплата|Плат[её]ж)(?:\s|:)/i.test(line)||/после|со дня|с даты|не позднее/i.test(line))){payment.text+='\n'+line;payment.source.push({page:p,text:line});continue;}
  if(payment)pushPayment();
  if(stage){const prefix=`stages.${stage}.`;c.dates(prefix,line,p);for(const [key,pat]of [['content',/^(?:Содержание(?: работ)?|Работы)\s*[:–—-]\s*(.+)/i],['expectedResult',/^(?:Результат(?: работ| этапа)?|Отч[её]тные документы)\s*[:–—-]\s*(.+)/i],['criteria',/^(?:Критерии(?: при[её]мки)?|Условия при[её]мки этапа)\s*[:–—-]\s*(.+)/i]]){m=line.match(pat);if(m)c.add(prefix+key,m[1],p,line);}if(/^(?:Стоимость|Цена)(?:\s+(?:этапа|работ))?\s*[:(]/i.test(line))addPrice(prefix,line,p,line);for(const [key,pat]of [['startCondition',/^(?:Начало(?: этапа| работ)?|Срок начала)\s*[:–—-]\s*(.+)/i],['endCondition',/^(?:Окончание(?: этапа| работ)?|Срок(?: этапа| выполнения)?|Срок (?:окончания|завершения))\s*[:–—-]\s*(.+)/i]]){m=line.match(pat);if(m&&(RELATIVE.test(m[1])||!dates(m[1]).length))c.add(prefix+key,m[1],p,line);}continue;}
  m=line.match(rx('(?:^|[\\s,;])Договор\\s*(?:№|N[оo]?[.]?)\\s*([^\\s,;]+)(?:\\s+от\\s*('+DATE+'))?'));if(m){addContract('number',m[1],p,line);if(m[2])addContract('date',parsedDate(m[2]),p,line);}
  m=line.match(rx('^Дата договора\\s*[:–—-]\\s*('+DATE+')'));if(m)addContract('date',parsedDate(m[1]),p,line);
  for(const [key,pat]of [['title',/^(?:Наименование(?:\s+(?:НИР|работы|работ|темы))?|Название(?:\s+(?:НИР|работы))?|Тема НИР)\s*[:–—]\s*(.+)/i],['subject',/^(?:Предмет(?: договора)?|Содержание договора)\s*[:–—]\s*(.+)/i]]){m=line.match(pat);if(m)addContract(key,m[1].replace(/^[ «»"]+|[ «»"]+$/g,''),p,line);}
  for(const [label,role]of [['Заказчик','customer'],['Исполнитель','executor']]){m=line.match(rx('^'+label+'\\s*[:–—]\\s*(.+)'));if(m){party=role;addContract(role,m[1],p,line);addContract(role+'Details.name',m[1],p,line);partyRaw[role].push(line);}}
  if(party){for(const [key,label]of [['inn','(?:ИНН|(?:UHH|ИHH|ИНH|INN)(?=\\s*:\\s*(?:\\d{10}|\\d{12})(?!\\d)))'],['kpp','КПП'],['ogrn','ОГРН(?:ИП)?'],['address','(?:Юридический |Почтовый |Фактический )?Адрес'],['bank','(?:Наименование )?Банк'],['account','Расч[её]тный сч[её]т|р\\s*/\\s*с'],['correspondentAccount','Корреспондентский сч[её]т|к\\s*/\\s*с'],['bik','БИК']]){m=line.match(rx('^(?:'+label+')\\s*[:–—-]?\\s*(.+)'));if(m){const v=m[1].trim();c.add('contract.'+party+'Details.'+key,v,p,line);partyRaw[party].push(line);if(key==='inn'&&!/^ИНН/i.test(line))c.warnings.push(`Страница ${p}: подпись ИНН распознана с похожими латинскими буквами, проверьте реквизит.`);}}}
  m=line.match(/(?:Количество этапов|Число этапов|Работа выполняется в)\s*[:–—]?\s*(\d{1,6})/i);if(m)c.add('stageCount',Number(m[1]),p,line);
  c.dates('contract.',line,p);
  if(/^(?:Срок(?: выполнения)? работ|Период выполнения)/i.test(line))addContract('workTerm',line.replace(/^[^:]+:/,''),p,line);
  if(/^(?:Срок действия договора|Договор (?:действует|вступает))/i.test(line)){addContract('validityTerm',line.replace(/^[^:]+:/,''),p,line);m=line.match(rx('(?:до|по)\\s*('+DATE+')'));if(m)addContract('validUntil',parsedDate(m[1]),p,line);}
  if(PRICE_HEAD.test(line)){addContract('priceTerms',line,p,line);addPrice('contract.',line,p,line);m=line.match(/(?:в том числе|включая)\s+НДС\s*(?:\d+(?:[,.]\d+)?\s*%\s*)?[:–—-]?\s*(.+)/i);if(m){const values=moneyValues(m[1]);if(values.length===1)addContract('vatAmount',values[0].amount,p,line);}}
  if(/^(?:Валюта(?: договора| платежа)?|Все суммы указаны)/i.test(line))addContract('currency',currency(line),p,line);
  if(/^(?:Условия НДС|НДС|Налог|Налогообложение)/i.test(line)){const ts=taxSignals(line).filter(Boolean).length;if(ts>0)addContract('vatBasis',basis(line),p,line);if(ts>1)c.warnings.push('Противоречивые условия НДС; проверьте налоговую основу по PDF.');}
  m=line.match(/(?:Ставка НДС|НДС)\s*[:–—-]?\s*(\d+(?:[,.]\d+)?)\s*%/i);if(m){const n=num(m[1]);if(n!==null&&n<=100)addContract('vatRate',n,p,line);}
  m=line.match(/^Сумма НДС\s*[:–—-]\s*(.+)/i);if(m){const vs=moneyValues(m[1]);if(vs.length===1)addContract('vatAmount',vs[0].amount,p,line);}
 }
 pushPayment();

 // Rows with explicit column spacing or PDF extraction coordinates.
 const tables=[];
 for(const page of sourcePages){
  for(const table of page.tables||[])if(Array.isArray(table)&&table.every(Array.isArray))tables.push({p:page.number,table,pageText:page.text});
  let spaced=[];const flush=()=>{if(spaced.length)tables.push({p:page.number,table:spaced,pageText:page.text});spaced=[];};
  for(const raw of page.text.split(/\r?\n/)){const cells=raw.trim().split(/\s*\|\s*|\t+| {2,}/).map(clean);if(cells.length>1)spaced.push(cells);else flush();}flush();
  let cellRows=[];const flushCells=()=>{if(cellRows.length)tables.push({p:page.number,table:cellRows,pageText:page.text});cellRows=[];};for(const line of page.lines||[]){if(Array.isArray(line.cells)&&line.cells.length>1)cellRows.push(line.cells.map(clean));else flushCells();}flushCells();
 }
 function headers(row){const hs=row.map(x=>clean(x).toLowerCase()),col=(...terms)=>{const n=hs.findIndex(h=>terms.some(term=>h.includes(term)));return n<0?null:n;};let title=col('наименование','название');if(title===null){const n=hs.findIndex(h=>/^(?:плат[её]ж|вид платежа|вид оплаты)$/.test(h));title=n<0?null:n;}return {hs,map:{number:col('№','номер'),title,content:col('содержание'),expectedResult:col('результат','отчет','отчёт'),criteria:col('критери'),startDate:col('начал'),dueDate:col('окончан','завершен'),period:col('срок','период'),amount:col('стоим','цена','сумма'),percent:(()=>{const i=hs.findIndex(h=>/процент|доля|^%$/.test(h));return i<0?null:i;})(),condition:col('услови','событи'),date:col('дата платежа','дата оплаты'),stageNumber:col('номер этапа','связанный этап')}};}
 let carried=null;
 for(const {p,table,pageText}of tables){
  if(!table.length)continue;const normalized=table.map(row=>row.map(clean));let headerIndex=null,kind=null,mapping=null,hs=[];
  for(let idx=0;idx<Math.min(3,normalized.length);idx++){if(normalized[idx].length<2)continue;const h=headers(normalized[idx]),joined=h.hs.join(' ');
   if(h.map.title!==null&&/этап/i.test(joined)&&(h.map.dueDate!==null||h.map.period!==null||h.map.amount!==null)){headerIndex=idx;kind='stages';hs=h.hs;mapping=h.map;carried={p,hs,mapping};break;}
   if(/плат|аванс/i.test(joined)&&(h.map.amount!==null||h.map.percent!==null)){headerIndex=idx;kind='payments';hs=h.hs;mapping=h.map;break;}
   if(h.hs.some(x=>x.includes('заказчик'))&&h.hs.some(x=>x.includes('исполнитель'))){for(const [role,label]of [['customer','заказчик'],['executor','исполнитель']]){const col=h.hs.findIndex(x=>x.includes(label));for(const row of normalized.slice(idx+1)){if(col>=row.length)continue;const cell=row[col];for(const [key,pattern]of [['inn',/ИНН\s*[: ]\s*(\d+)/i],['kpp',/КПП\s*[: ]\s*(\d+)/i],['ogrn',/ОГРН\s*[: ]\s*(\d+)/i],['bik',/БИК\s*[: ]\s*(\d+)/i],['account',/(?:р\/с|Расч[её]тный сч[её]т)\s*[: ]\s*(\d+)/i],['correspondentAccount',/(?:к\/с|Корреспондентский сч[её]т)\s*[: ]\s*(\d+)/i]]){const m=cell.match(pattern);if(m)addContract(role+'Details.'+key,m[1],p,cell);}partyRaw[role].push(cell);}}kind='parties';break;}
  }
  if(kind==='parties')continue;
  if(!kind&&carried&&(p===carried.p||p===carried.p+1)&&normalized[0].length===carried.hs.length&&carried.mapping.number!==null&&/^\d+(?:\.\d+)*$/.test(normalized[0][carried.mapping.number]||'')&&!/График платежей|Порядок оплаты/i.test(pageText)){kind='stages';headerIndex=-1;hs=carried.hs;mapping=carried.mapping;carried={p,hs,mapping};}
  if(!kind)continue;let lastNum=null;
  for(const row of normalized.slice(headerIndex+1)){const cell=key=>mapping[key]!==null&&mapping[key]<row.length?row[mapping[key]]:'',text=row.join(' | ');if(!row.some(Boolean)||/^(?:итого|всего)(?:\s|:|$)/i.test(cell('title')||row[0]))continue;
   if(kind==='payments'){const title=cell('title')||row.find(x=>PAY_HEAD.test(x))||'Платёж',header=mapping.amount!==null?hs[mapping.amount]:'';if(paymentRows.length<200)paymentRows.push({text:title+'\n'+text,page:p,source:[{page:p,text}],tableAmount:price(cell('amount'),header),tablePercent:cell('percent'),tableCondition:cell('condition'),tableDate:cell('date')||cell('period'),tableNumber:cell('number'),tableStage:cell('stageNumber')});else paymentLimit();continue;}
   let n=cell('number').replace(/[.)]$/,''),title=cell('title');
   if(!n&&lastNum){if(title){const key=`stages.${lastNum}.content`,previous=c.resolve(key)||'';c.values.set(key,[(previous+' '+title).trim()]);c.add(key,(previous+' '+title).trim(),p,text);}continue;}
   if(!n){const m=title.match(STAGE);if(m){n=m[1];title=m[2];}}
   if(!/^\d+(?:\.\d+)*$/.test(n)){c.warnings.push(`Страница ${p}: строка таблицы без уверенного номера этапа требует проверки: ${text.slice(0,200)}`);continue;}
   lastNum=startStage(n,title,p,text);if(!lastNum)continue;const prefix=`stages.${n}.`;
   for(const key of ['content','expectedResult','criteria'])c.add(prefix+key,cell(key),p,text);
   for(const key of ['startDate','dueDate']){const value=cell(key),ds=dates(value);if(ds.length===1&&!RELATIVE.test(value))c.add(prefix+key,ds[0],p,text);else if(value&&(RELATIVE.test(value)||!ds.length)&&/[A-Za-zА-Яа-яЁё]/.test(value))c.add(prefix+(key==='startDate'?'startCondition':'endCondition'),value,p,text);else if(ds.length>1)c.warnings.push(`Этап ${n}: несколько дат в одной ячейке; нужна ручная проверка.`);}
   const period=cell('period');if(period){const ds=dates(period);if(RELATIVE.test(period))c.add(prefix+'endCondition',period,p,text);else if(ds.length===2){c.add(prefix+'startDate',ds[0],p,text);c.add(prefix+'dueDate',ds[1],p,text);}else if(ds.length===1&&mapping.dueDate===null)c.add(prefix+'dueDate',ds[0],p,text);else if(!ds.length)c.add(prefix+'endCondition',period,p,text);}
   if(mapping.amount!==null)addPrice(prefix,cell('amount'),p,text,hs[mapping.amount]);
  }
 }
 if(acceptance.length){for(const {p,line}of acceptance)addContract('acceptanceTerms',line,p,line);c.values.set('contract.acceptanceTerms',[acceptance.map(x=>x.line).join('\n')]);}
 const textFields=['number','customer','executor','subject','title','currency','workTerm','validityTerm','acceptanceTerms','priceTerms'];
 const contract={};for(const key of textFields)contract[key]=c.resolve('contract.'+key)||'';
 for(const key of ['date','amount','vatRate','vatAmount','startDate','dueDate','validUntil'])contract[key]=c.resolve('contract.'+key);
 contract.vatBasis=c.resolve('contract.vatBasis')||'unknown';
 contract.reviewedAt=null;contract.reviewNotes='';
 for(const role of ['customer','executor']){const detail={};for(const key of ['name','inn','kpp','ogrn','address','bank','account','correspondentAccount','bik'])detail[key]=c.resolve('contract.'+role+'Details.'+key)||'';detail.raw=unique(partyRaw[role]).join('\n');contract[role+'Details']=detail;}
 const stages=stageIds.sort((a,b)=>{const aa=a.split('.').map(Number),bb=b.split('.').map(Number);for(let i=0;i<Math.max(aa.length,bb.length);i++){const diff=(aa[i]??-1)-(bb[i]??-1);if(diff)return diff;}return 0;}).map(n=>{const prefix=`stages.${n}.`,s={sourceNumber:n};for(const key of ['title','content','expectedResult','criteria','currency','startCondition','endCondition'])s[key]=c.resolve(prefix+key)||'';for(const key of ['startDate','dueDate','amount'])s[key]=c.resolve(prefix+key);s.vatBasis=c.resolve(prefix+'vatBasis')||'unknown';s.amountGross=s.currency==='RUB'&&['included','exempt'].includes(s.vatBasis)?s.amount:null;s.criteria=s.criteria||s.expectedResult;s.status='planned';s.forecastDate=null;s.acceptedDate=null;s.externalBudget=null;return s;});
 if(stageIds.length&&stageIds.every(n=>/^\d+$/.test(n))){const ids=stageIds.map(Number),max=Math.max(...ids),missing=[];for(let n=1;n<=Math.min(max,1000);n++)if(!ids.includes(n))missing.push(n);if(max>1000)c.warnings.push('Обнаружен номер этапа больше 1000; возможно, это номер пункта документа.');if(missing.length)c.warnings.push('Пропуски нумерации этапов: '+missing.slice(0,50).join(', ')+(missing.length>50?'… (показаны первые 50 из '+missing.length+')':'')+'. Проверьте календарный план и приложения.');}
 const payments=[],signatures=new Set();
 for(const source of paymentRows){const text=source.text,p=source.page,title=text.split('\n')[0].split(':')[0].trim(),v=source.tableAmount||price(text);const pctText=source.tablePercent||text.replace(/(?:НДС|ставк[а-я]*)\s*[:–—-]?\s*\d+(?:[,.]\d+)?\s*%/gi,'');let pcts=[...pctText.matchAll(/(?<![\d.,])([-−]?\d+(?:[,.]\d+)?)\s*%/g)].map(m=>num(m[1]));if(!pcts.length&&source.tablePercent&&/^\d+(?:[,.]\d+)?$/.test(source.tablePercent))pcts=[num(source.tablePercent)];let pct=unique(pcts).length===1?pcts[0]:null;if(pct!==null&&pct>100){pct=null;c.warnings.push('Процент платежа вне диапазона 0–100; проверьте исходник.');}if(unique(pcts).length>1)c.warnings.push('В одной строке платежа несколько процентов; проверьте долю вручную.');
  const dateText=source.tableDate||text,ds=unique(dates(dateText));let due=ds.length===1?ds[0]:null;if(RELATIVE.test(dateText)&&!rx('(?:не позднее|до|по|Дата (?:оплаты|платежа)\\s*:)\\s*'+DATE).test(dateText))due=null;
  const sm=text.match(/этап[а-я]*\s*№?\s*(\d+(?:\.\d+)*)/i),condition=source.tableCondition||text.split('\n').slice(1).join('\n')||text;
  const item={number:source.tableNumber||String(payments.length+1),title,amount:v.amount,percent:pct,currency:v.currency||'',vatBasis:v.vatBasis,dueDate:due,condition,stageNumber:source.tableStage||(sm?sm[1]:'')};const signature=JSON.stringify({...item,number:''});if(signatures.has(signature))continue;signatures.add(signature);payments.push(item);
  for(const [key,value]of Object.entries(item))if(value!==null&&value!=='')for(const e of source.source)c.add(`payments.${item.number}.${key}`,value,e.page,e.text);
  if(ds.length>1)c.warnings.push(`Платёж ${item.number}: несколько календарных дат; проверьте срок оплаты.`);
 }
 contract.payments=payments;
 const declared=c.resolve('stageCount');if(declared&&declared!==stages.length)c.warnings.push(`В договоре указано этапов: ${declared}; распознано: ${stages.length}. Проверьте полный список.`);
 const comparison={status:'not_comparable',contractAmount:contract.amount,stageTotal:null,difference:null,reason:'Не все суммы, валюты или условия НДС определены на одной основе.'};
 if(stages.length&&contract.amount!==null&&contract.currency&&contract.vatBasis!=='unknown'&&stages.every(s=>s.amount!==null&&s.currency===contract.currency&&s.vatBasis===contract.vatBasis)){const total=stages.reduce((n,s)=>n+Math.round(s.amount*100),0),difference=total-Math.round(contract.amount*100);Object.assign(comparison,{status:difference===0?'match':'mismatch',stageTotal:total/100,difference:difference/100,reason:'Суммы сопоставлены в одной валюте и на одной основе НДС.'});if(difference)c.warnings.push(`Сумма этапов ${total/100} не совпадает с ценой договора ${contract.amount}; расхождение ${difference/100} ${contract.currency}. Значения не исправлялись.`);}else if(stages.length)c.warnings.push('Сумму этапов и цену договора нельзя достоверно сверить: проверьте валюту, единицы, НДС и отсутствующие суммы.');
 const missing=[];for(const [key,label]of [['title','Название НИР'],['customer','Заказчик'],['number','Номер договора'],['date','Дата договора'],['executor','Исполнитель'],['subject','Предмет договора'],['currency','Валюта'],['amount','Стоимость договора'],['startDate','Начало работ'],['dueDate','Окончание работ'],['acceptanceTerms','Условия приёмки']])if(contract[key]===null||contract[key]==='')missing.push(label);
 if(contract.vatBasis==='unknown')missing.push('Порядок НДС');if(!stages.length)missing.push('Этапы договора');
 for(const s of stages)for(const [key,label]of [['title','название'],['amount','стоимость'],['dueDate','календарный срок завершения']])if(s[key]===null||s[key]==='')missing.push(`Этап ${s.sourceNumber}: ${label}`);
 if(!payments.length)missing.push('График платежей');
 for(const page of sourcePages)if(page.status&&!['text','ocr'].includes(page.status))c.warnings.push(`Страница ${page.number} не прочитана полностью. Проверьте её вручную.`);
 if(sourcePages.some(p=>p.status==='ocr'))c.warnings.push('Часть текста получена распознаванием изображения. Проверьте цифры, даты и реквизиты по PDF.');
 contract.evidence=c.evidence;
 return {contract,stages,warnings:unique(c.warnings),missing:unique(missing),conflicts:c.conflicts,comparison};
}
root.OTBContractParser={parse};
})(typeof window!=='undefined'?window:globalThis);
