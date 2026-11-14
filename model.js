(function (root) {
  "use strict";

  /*
   * Public API:
   * load() -> {state, warning}; independent validated seed or browser-local state.
   * save(state) -> {ok, warning}; only this demo's localStorage key is written.
   * reset() -> state; removes only this demo's key and returns a fresh seed.
   * calculate(work) -> lifetime revenue/cost/profit, percentages and separate payment.
   * parseMoney(text) -> rubles|null; empty means unknown, never an assumed zero.
   * storageAvailable() -> boolean; tests browser storage without changing its data.
   *
   * validate(state) -> normalized schema-2 copy, or Error. Schema 1 migrates without invented facts.
   * monthly(state, "YYYY-MM") -> confirmed monthly facts, allocated once, separate from lifetime forecast.
   * State is the documented OTB_DATA schema. History entries are
   * {at: ISO UTC timestamp, action: string, detail: string}, at most 500 per work.
   * Percentages are unrounded numbers; money arithmetic uses integer kopeks.
   * This is a private browser demo: localStorage is not shared access or a database.
   */
  const KEY = "otb-pages-demo-v1";
  const MAX_MONEY = 1e12;
  const MAX_JSON_LENGTH = 5000000;
  const KIND = ["nir", "publication", "rid", "assignment"];
  const WORK_STATUS = ["planned", "active", "review", "closed"];
  const TASK_STATUS = ["todo", "doing", "review", "done"];
  const STAGE_STATUS = ["planned", "active", "review", "accepted"];
  const UNAVAILABLE = "Браузер не сохранил изменения. Они доступны только в этой открытой вкладке; проверьте разрешение на хранение данных и свободное место.";

  function fail() { throw new Error("Некорректный формат учебных данных."); }
  function record(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) fail();
    return value;
  }
  function list(value, maximum) {
    if (!Array.isArray(value) || value.length > maximum) fail();
    return value;
  }
  function text(value, maximum, allowEmpty) {
    if (typeof value !== "string" || value.length > maximum ||
        (!allowEmpty && !value.trim()) || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value)) fail();
    return value;
  }
  function id(value) {
    if (!Number.isSafeInteger(value) || value < 1 || value > 1000000000) fail();
    return value;
  }
  function choice(value, choices) {
    if (!choices.includes(value)) fail();
    return value;
  }
  function date(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail();
    const parsed = new Date(value + "T00:00:00Z");
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) fail();
    return value;
  }
  function timestamp(value) {
    if (typeof value !== "string" || value.length > 30 ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) ||
        !Number.isFinite(Date.parse(value))) fail();
    return value;
  }
  function isMoney(value) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 &&
      value <= MAX_MONEY && Math.round(value * 100) / 100 === value;
  }
  function money(value) {
    if (value === null) return null;
    if (!isMoney(value)) fail();
    return value === 0 ? 0 : value;
  }
  function unique(values) {
    if (new Set(values).size !== values.length) fail();
  }
  function optional(value, parser, fallback = null) {
    return value === undefined || value === null ? fallback : parser(value);
  }
  function boolean(value) { if (typeof value !== "boolean") fail(); return value; }
  function integer(value, maximum = 1000000) {
    if (!Number.isSafeInteger(value) || value < 0 || value > maximum) fail();
    return value;
  }
  function period(value) {
    if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) fail();
    date(value + "-01"); return value;
  }
  function monthEnd(value) {
    period(value);
    const end = new Date(value + "-01T00:00:00Z");
    end.setUTCMonth(end.getUTCMonth() + 1, 0);
    const last = end.getUTCDate();
    return value + "-" + String(last).padStart(2,"0");
  }
  function history(input) {
    return list(input, 500).map(function (item) {
      const event = record(item);
      return {at: timestamp(event.at), action: text(event.action, 180), detail: text(event.detail, 5000, true)};
    });
  }
  function normalize(input) {
    const state = record(input);
    if (![1,2].includes(state.schemaVersion)) fail();
    const legacy = state.schemaVersion === 1;
    const labs = list(state.labs, 50).map(function (item) {
      const lab = record(item);
      return {id: id(lab.id), shortName: text(lab.shortName, 30), name: text(lab.name, 180)};
    });
    if (!labs.length) fail();
    unique(labs.map(lab => lab.id));
    const labIds = new Set(labs.map(lab => lab.id));
    const works = list(state.works, 500).map(function (item) {
      const work = record(item), forecast = record(work.forecast), facts = record(work.facts);
      if (!labIds.has(work.labId) || typeof forecast.complete !== "boolean" ||
          typeof work.minReturn !== "number" || !Number.isFinite(work.minReturn) ||
          work.minReturn < 0 || work.minReturn > 1000000) fail();
      const startDate = legacy ? null : optional(work.startDate, date);
      const dueDate = date(work.dueDate);
      if (startDate && startDate > dueDate) fail();
      const stages = list(work.stages, 100).map(function (item) {
        const stage = record(item);
        const result = {id: id(stage.id), title: text(stage.title, 250),
          status: choice(stage.status, STAGE_STATUS), dueDate: date(stage.dueDate),
          criteria: text(stage.criteria, 10000, true),
          startDate: legacy ? null : optional(stage.startDate, date),
          amountGross: legacy ? null : optional(stage.amountGross, money),
          externalBudget: legacy ? null : optional(stage.externalBudget, money),
          forecastDate: legacy ? null : optional(stage.forecastDate, date),
          acceptedDate: legacy ? null : optional(stage.acceptedDate, date)};
        if (result.startDate && result.startDate > result.dueDate) fail();
        if (startDate && (result.dueDate < startDate || (result.startDate && result.startDate < startDate))) fail();
        if (!legacy && result.dueDate > dueDate) fail();
        if (result.startDate && result.forecastDate && result.forecastDate < result.startDate) fail();
        if (result.acceptedDate && result.status !== "accepted") fail();
        return result;
      });
      unique(stages.map(stage => stage.id));
      const stageIds = new Set(stages.map(stage => stage.id));
      const participations = list(legacy || work.participations === undefined ? [{labId:work.labId,revenueShare:100}] : work.participations, 50).map(function (item) {
        const participation = record(item);
        if (!labIds.has(participation.labId) || !isMoney(participation.revenueShare) || participation.revenueShare > 100) fail();
        return {labId:id(participation.labId),revenueShare:participation.revenueShare};
      });
      unique(participations.map(item => item.labId));
      const contributions = list(legacy || work.contributions === undefined ? [] : work.contributions, 500).map(function (item) {
        const contribution = record(item);
        if (!labIds.has(contribution.labId) || contribution.labId === work.labId) fail();
        const stageId = optional(contribution.stageId, id);
        if (stageId !== null && !stageIds.has(stageId)) fail();
        const result = {id:id(contribution.id),title:text(contribution.title,250),
          labId:id(contribution.labId),assignee:text(contribution.assignee,180),stageId,
          proposedAmount:money(contribution.proposedAmount),approvedAmount:optional(contribution.approvedAmount,money),
          status:choice(contribution.status,["pending","approved","rejected"]),
          confirmedBy:optional(contribution.confirmedBy,value=>text(value,180,true),""),
          confirmedAt:optional(contribution.confirmedAt,timestamp),revision:integer(contribution.revision),
          history:history(contribution.history || [])};
        if (result.proposedAmount === null) fail();
        if (result.status === "approved" && (result.approvedAmount !== result.proposedAmount || !result.confirmedBy.trim() || !result.confirmedAt)) fail();
        if (result.status !== "approved" && result.approvedAmount !== null) fail();
        if (result.status === "pending" && (result.confirmedBy || result.confirmedAt)) fail();
        if (!participations.some(item=>item.labId === result.labId)) fail();
        return result;
      });
      unique(contributions.map(item=>item.id));
      const result = {
        id:id(work.id),code:text(work.code,40),title:text(work.title,250),
        kind:choice(work.kind,KIND),labId:id(work.labId),owner:text(work.owner,180),
        status:choice(work.status,WORK_STATUS),dueDate,startDate,
        customer:legacy ? "" : optional(work.customer,value=>text(value,180,true),""),
        externalBudget:legacy ? null : optional(work.externalBudget,money),
        relatedNirId:legacy ? null : optional(work.relatedNirId,id),
        demoSource:legacy ? "" : optional(work.demoSource,value=>choice(value,["","contract-example-v1"]),""),
        description:text(work.description,10000,true),criteria:text(work.criteria,10000,true),
        contractGross:money(work.contractGross),minReturn:work.minReturn,
        forecast:{revenueRemaining:money(forecast.revenueRemaining),costRemaining:money(forecast.costRemaining),complete:forecast.complete},
        facts:{revenue:money(facts.revenue),cost:money(facts.cost),payment:money(facts.payment)},
        stages,history:history(work.history),participations,contributions
      };
      if (result.kind !== "nir" && (result.contributions.length || result.demoSource)) fail();
      for (const [stageField,workField] of [["amountGross","contractGross"],["externalBudget","externalBudget"]]) {
        const values=stages.map(stage=>stage[stageField]);
        const known=values.reduce((sum,value)=>sum+(value === null ? 0 : Math.round(value*100)),0);
        if (!Number.isSafeInteger(known)) fail();
        if (values.length && result[workField] !== null && (known > Math.round(result[workField]*100) || (values.every(value=>value!==null) && known !== Math.round(result[workField]*100)))) fail();
      }
      return result;
    });
    unique(works.map(work=>work.id));
    unique(works.map(work=>work.code));
    const workIds=new Set(works.map(work=>work.id));
    const workMap=new Map(works.map(work=>[work.id,work]));
    for (const work of works) {
      if (work.relatedNirId !== null && (work.kind === "nir" || !workMap.has(work.relatedNirId) || workMap.get(work.relatedNirId).kind !== "nir")) fail();
    }
    const tasks=list(state.tasks,5000).map(function(item) {
      const task=record(item);
      if (!workIds.has(task.workId)) fail();
      return {id:id(task.id),workId:id(task.workId),title:text(task.title,240),assignee:text(task.assignee,180),reviewer:text(task.reviewer,180),dueDate:date(task.dueDate),status:choice(task.status,TASK_STATUS),result:text(task.result,10000,true)};
    });
    unique(tasks.map(task=>task.id));
    const monthlyEntries=list(legacy || state.monthlyEntries === undefined ? [] : state.monthlyEntries,20000).map(function(item) {
      const entry=record(item),work=workMap.get(entry.workId);
      const labId=optional(entry.labId,id);
      if (!work || (labId!==null && !labIds.has(labId))) fail();
      const result={id:id(entry.id),workId:id(entry.workId),labId,kind:choice(entry.kind,["revenue","cost","payment"]),period:period(entry.period),amount:money(entry.amount),confirmed:boolean(entry.confirmed),source:text(entry.source,500,true)};
      if (result.amount===null || (result.kind==="cost" && result.labId===null)) fail();
      return result;
    });
    unique(monthlyEntries.map(entry=>entry.id));
    if (!Number.isSafeInteger(monthlyEntries.reduce((sum,entry)=>sum+Math.round(entry.amount*100),0))) fail();
    const months=list(legacy || state.months === undefined ? [] : state.months,5000).map(function(item) {
      const month=record(item);
      if (!labIds.has(month.labId)) fail();
      const result={labId:id(month.labId),period:period(month.period),headcount:optional(month.headcount,integer),source:text(month.source,500,true),asOf:optional(month.asOf,date),revenueComplete:boolean(month.revenueComplete),costComplete:boolean(month.costComplete),confirmed:boolean(month.confirmed),revision:integer(month.revision)};
      if (result.headcount!==null && (!result.source.trim() || result.asOf!==monthEnd(result.period))) fail();
      return result;
    });
    unique(months.map(month=>month.labId+":"+month.period));
    // Known fields only: no prototype or unrecognized browser-storage keys survive.
    return {schemaVersion:2,today:date(state.today),labs,works,tasks,monthlyEntries,months};
  }
  function seed() {
    let data = root.OTB_DATA;
    if (!data && typeof module === "object" && module.exports && typeof require === "function") data = require("./data.js");
    if (!data) throw new Error("Сначала загрузите data.js.");
    return normalize(data);
  }
  function storage() {
    const candidate = root.localStorage;
    if (!candidate || typeof candidate.getItem !== "function" || typeof candidate.setItem !== "function") throw new Error("Storage unavailable");
    return candidate;
  }
  function load() {
    const initial = seed();
    let raw;
    try { raw = storage().getItem(KEY); }
    catch (error) { return {state: initial, warning: UNAVAILABLE}; }
    if (raw === null) return {state: initial, warning: null};
    try {
      if (typeof raw !== "string" || raw.length > MAX_JSON_LENGTH) fail();
      return {state: normalize(JSON.parse(raw)), warning: null};
    } catch (error) {
      return {state: initial, warning: "Сохранённый пример повреждён или имеет другой формат. Загружены исходные учебные данные; прежняя запись в браузере не изменена."};
    }
  }
  function save(state) {
    let encoded;
    try {
      encoded = JSON.stringify(normalize(state));
      if (encoded.length > MAX_JSON_LENGTH) fail();
    } catch (error) {
      return {ok: false, warning: "Изменения не сохранены: проверьте формат, суммы и связи учебных данных."};
    }
    try {
      storage().setItem(KEY, encoded);
      return {ok: true, warning: null};
    } catch (error) { return {ok: false, warning: UNAVAILABLE}; }
  }
  function reset() {
    try { storage().removeItem(KEY); } catch (error) { /* The caller can still use the fresh in-memory demo. */ }
    return seed();
  }
  function storageAvailable() {
    let target, probe;
    try {
      target = storage();
      do { probe = KEY + ":probe:" + Math.random().toString(36).slice(2); }
      while (target.getItem(probe) !== null);
      target.setItem(probe, "1");
      target.removeItem(probe);
      return true;
    } catch (error) {
      if (target && probe) { try { target.removeItem(probe); } catch (ignored) { /* Storage remains unavailable. */ } }
      return false;
    }
  }
  function parseMoney(value) {
    if (typeof value !== "string") throw new Error("Введите сумму текстом.");
    const trimmed = value.trim();
    if (!trimmed) return null;
    const compact = trimmed.replace(/[\s\u00a0\u202f]/g, "");
    if (!/^(?:\d+(?:[.,]\d{1,2})?|[.,]\d{1,2})$/.test(compact)) {
      throw new Error("Введите неотрицательную сумму с точностью до двух знаков после запятой.");
    }
    const parsed = Number(compact.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed > MAX_MONEY) throw new Error("Сумма не должна превышать 1 000 000 000 000 ₽.");
    return Math.round(parsed * 100) / 100;
  }
  function cents(value) { return isMoney(value) ? Math.round(value * 100) : null; }
  function calculate(work) {
    const object = work && typeof work === "object" ? work : {};
    const forecast = object.forecast || {}, facts = object.facts || {};
    function fact(value) {
      if ((value === null || value === undefined) && forecast.complete === true) return 0;
      return cents(value);
    }
    const revenueFact = fact(facts.revenue), costFact = fact(facts.cost), paid = fact(facts.payment);
    const revenueRemaining = cents(forecast.revenueRemaining), costRemaining = cents(forecast.costRemaining);
    const revenue = revenueFact !== null && revenueRemaining !== null ? revenueFact + revenueRemaining : null;
    const cost = costFact !== null && costRemaining !== null ? costFact + costRemaining : null;
    const profit = revenue !== null && cost !== null ? revenue - cost : null;
    const contract = cents(object.contractGross);
    const remaining = contract !== null && paid !== null ? Math.max(0, contract - paid) : null;
    function rubles(value) { return value === null ? null : value / 100; }
    return {
      revenue: rubles(revenue), cost: rubles(cost), profit: rubles(profit),
      returnOnCost: profit !== null && cost > 0 ? profit / cost * 100 : null,
      margin: profit !== null && revenue > 0 ? profit / revenue * 100 : null,
      payment: rubles(paid), remainingContractPayment: rubles(remaining)
    };
  }

  function monthly(input, selectedPeriod) {
    const state=normalize(input);
    period(selectedPeriod);
    const workMap=new Map(state.works.filter(work=>work.kind==="nir").map(work=>[work.id,work]));
    const allEntries=state.monthlyEntries.filter(entry=>entry.period===selectedPeriod && workMap.has(entry.workId));
    const entries=allEntries.filter(entry=>entry.confirmed);
    const revenue=new Map(),cost=new Map(),invalidLabs=new Set();
    let unallocated=0,totalRevenue=0,totalCost=0,payment=0;
    let hasRevenue=false,hasCost=false,hasPayment=false;
    function add(map,key,amount){map.set(key,(map.get(key)||0)+amount);}
    for (const entry of entries) {
      const amount=Math.round(entry.amount*100),work=workMap.get(entry.workId);
      if(entry.kind==="cost"){add(cost,entry.labId,amount);totalCost+=amount;hasCost=true;continue;}
      if(entry.kind==="payment"){payment+=amount;hasPayment=true;continue;}
      totalRevenue+=amount;hasRevenue=true;
      const shares=work.participations;
      if(!shares.length || shares.reduce((sum,share)=>sum+Math.round(share.revenueShare*100),0)!==10000){
        unallocated+=amount;invalidLabs.add(work.labId);shares.forEach(share=>invalidLabs.add(share.labId));continue;
      }
      const allocated=shares.map(share=>{
        const numerator=BigInt(amount)*BigInt(Math.round(share.revenueShare*100));
        return {labId:share.labId,amount:Number(numerator/10000n),residual:Number(numerator%10000n)};
      });
      const remainder=amount-allocated.reduce((sum,item)=>sum+item.amount,0);
      const ordered=allocated.slice().sort((a,b)=>b.residual-a.residual || a.labId-b.labId);
      for(let i=0;i<remainder;i++)ordered[i].amount++;
      allocated.forEach(item=>add(revenue,item.labId,item.amount));
    }
    function amounts(r,c,h){
      const profit=r!==null && c!==null ? r-c : null;
      return {revenue:r===null?null:r/100,cost:c===null?null:c/100,profit:profit===null?null:profit/100,
        returnOnCost:profit!==null&&c>0?profit/c*100:null,margin:profit!==null&&r>0?profit/r*100:null,
        outputPerPerson:r!==null&&h!==null&&h>0?r/100/h:null};
    }
    const rows=state.labs.map(lab=>{
      const record=state.months.find(month=>month.labId===lab.id&&month.period===selectedPeriod);
      const confirmed=Boolean(record&&record.confirmed);
      const pendingRevenue=allEntries.some(entry=>!entry.confirmed&&entry.kind==="revenue"&&workMap.get(entry.workId).participations.some(share=>share.labId===lab.id));
      const pendingCost=allEntries.some(entry=>!entry.confirmed&&entry.kind==="cost"&&entry.labId===lab.id);
      const revenueComplete=Boolean(confirmed&&record.revenueComplete&&!pendingRevenue&&!invalidLabs.has(lab.id));
      const costComplete=Boolean(confirmed&&record.costComplete&&!pendingCost);
      const r=invalidLabs.has(lab.id)?null:(revenue.has(lab.id)?revenue.get(lab.id):(revenueComplete?0:null));
      const c=cost.has(lab.id)?cost.get(lab.id):(costComplete?0:null);
      const h=confirmed?record.headcount:null;
      let reason="";
      if(!record||record.headcount===null)reason="Численность за месяц не указана.";
      else if(!confirmed)reason="Численность ожидает подтверждения в учебном сценарии.";
      else if(h===0)reason="Численность равна нулю: деление невозможно.";
      else if(r===null)reason="Нет подтверждённой выручки или корректного распределения за месяц.";
      return Object.assign({labId:lab.id,headcount:h,reason,complete:revenueComplete&&costComplete,revenueComplete,costComplete,invalidAllocation:invalidLabs.has(lab.id),record},amounts(r,c,h));
    });
    const allRevenue=rows.length>0&&rows.every(row=>row.revenueComplete);
    const allCost=rows.length>0&&rows.every(row=>row.costComplete);
    const headcount=rows.length&&rows.every(row=>row.headcount!==null)?rows.reduce((sum,row)=>sum+row.headcount,0):null;
    const department=Object.assign({headcount,complete:allRevenue&&allCost,payment:hasPayment?payment/100:null},amounts(hasRevenue||allRevenue?totalRevenue:null,hasCost||allCost?totalCost:null,headcount));
    return {rows,department,unallocatedRevenue:unallocated/100,hasUnconfirmedEntries:allEntries.some(entry=>!entry.confirmed)};
  }

  const api = Object.freeze({load:load,save:save,reset:reset,calculate:calculate,
    parseMoney:parseMoney,storageAvailable:storageAvailable,validate:normalize,monthly:monthly,monthEnd:monthEnd});
  root.OTBModel = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

