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
  function normalize(input) {
    const state = record(input);
    if (state.schemaVersion !== 1) fail();
    const labs = list(state.labs, 50).map(function (item) {
      const lab = record(item);
      return {id: id(lab.id), shortName: text(lab.shortName, 30), name: text(lab.name, 180)};
    });
    if (!labs.length) fail();
    unique(labs.map(function (lab) { return lab.id; }));
    const labIds = new Set(labs.map(function (lab) { return lab.id; }));
    const works = list(state.works, 500).map(function (item) {
      const work = record(item), forecast = record(work.forecast), facts = record(work.facts);
      if (!labIds.has(work.labId) || typeof forecast.complete !== "boolean" ||
          typeof work.minReturn !== "number" || !Number.isFinite(work.minReturn) ||
          work.minReturn < 0 || work.minReturn > 1000000) fail();
      const stages = list(work.stages, 100).map(function (item) {
        const stage = record(item);
        return {id: id(stage.id), title: text(stage.title, 250),
          status: choice(stage.status, STAGE_STATUS), dueDate: date(stage.dueDate),
          criteria: text(stage.criteria, 10000, true)};
      });
      unique(stages.map(function (stage) { return stage.id; }));
      const history = list(work.history, 500).map(function (item) {
        const event = record(item);
        return {at: timestamp(event.at), action: text(event.action, 180), detail: text(event.detail, 5000, true)};
      });
      return {
        id: id(work.id), code: text(work.code, 40), title: text(work.title, 250),
        kind: choice(work.kind, KIND), labId: id(work.labId), owner: text(work.owner, 180),
        status: choice(work.status, WORK_STATUS), dueDate: date(work.dueDate),
        description: text(work.description, 10000, true), criteria: text(work.criteria, 10000, true),
        contractGross: money(work.contractGross), minReturn: work.minReturn,
        forecast: {revenueRemaining: money(forecast.revenueRemaining), costRemaining: money(forecast.costRemaining), complete: forecast.complete},
        facts: {revenue: money(facts.revenue), cost: money(facts.cost), payment: money(facts.payment)},
        stages: stages, history: history
      };
    });
    unique(works.map(function (work) { return work.id; }));
    unique(works.map(function (work) { return work.code; }));
    const workIds = new Set(works.map(function (work) { return work.id; }));
    const tasks = list(state.tasks, 5000).map(function (item) {
      const task = record(item);
      if (!workIds.has(task.workId)) fail();
      return {id: id(task.id), workId: id(task.workId), title: text(task.title, 240),
        assignee: text(task.assignee, 180), reviewer: text(task.reviewer, 180),
        dueDate: date(task.dueDate), status: choice(task.status, TASK_STATUS),
        result: text(task.result, 10000, true)};
    });
    unique(tasks.map(function (task) { return task.id; }));
    // Construct known fields explicitly. Stored __proto__ and unrelated keys are ignored.
    return {schemaVersion: 1, today: date(state.today), labs: labs, works: works, tasks: tasks};
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

  const api = Object.freeze({load: load, save: save, reset: reset, calculate: calculate,
    parseMoney: parseMoney, storageAvailable: storageAvailable});
  root.OTBModel = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

