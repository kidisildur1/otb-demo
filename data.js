(function (root) {
  "use strict";
  // Hand-authored synthetic examples. No database, accounts or private records
  // are exported into this file. Monetary amounts are rubles, with up to 2 decimals.
  const data = {
    schemaVersion: 1,
    today: "2026-11-12",
    labs: [
      {id: 1, shortName: "ЛМТП", name: "Лаборатория моделирования технологических процессов"},
      {id: 2, shortName: "ЛВП", name: "Лаборатория волочения и прессования"},
      {id: 3, shortName: "ЛППТ", name: "Лаборатория продольной прокатки труб"},
      {id: 4, shortName: "ЛВПТ", name: "Лаборатория винтовой прокатки труб"}
    ],
    works: [
      {
        id: 1, code: "НИР-2026-041", title: "Снижение разнотолщинности при продольной прокатке",
        kind: "nir", labId: 3, owner: "Руководитель исследования", status: "active", dueDate: "2026-12-06",
        description: "Сравнить три режима прокатки, оценить геометрию и подготовить рекомендации. Все работы, участники и суммы в этом примере вымышлены.",
        criteria: "Протокол измерений, сравнительный отчёт и согласованные рекомендации по режимам.",
        contractGross: 5760000, minReturn: 15,
        forecast: {revenueRemaining: 2400000, costRemaining: 1200000, complete: true},
        facts: {revenue: 2400000, cost: 1600000, payment: 1440000},
        stages: [
          {id: 1, title: "Исходные измерения и выборка", status: "accepted", dueDate: "2026-11-02", criteria: "Протокол измерений не менее трёх серий."},
          {id: 2, title: "Проверка режимов и рекомендации", status: "active", dueDate: "2026-11-24", criteria: "Сопоставлены три режима, рекомендации обоснованы измерениями."}
        ], history: []
      },
      {
        id: 2, code: "НИР-2026-038", title: "Моделирование и проверка нового режима деформации",
        kind: "nir", labId: 1, owner: "Координатор совместной НИР", status: "active", dueDate: "2026-11-21",
        description: "Учебный пример совместной работы лабораторий моделирования и продольной прокатки. Расчётные и экспериментальные результаты собираются в один отчёт.",
        criteria: "Сопоставление расчёта с измерениями, описание расхождений и единый отчёт двух лабораторий.",
        contractGross: 3840000, minReturn: 15,
        forecast: {revenueRemaining: 1600000, costRemaining: 1750000, complete: true},
        facts: {revenue: 1600000, cost: 1550000, payment: 960000},
        stages: [
          {id: 3, title: "Сопоставление модели и эксперимента", status: "active", dueDate: "2026-11-19", criteria: "Приняты вклады обеих лабораторий, сформирован общий отчёт."}
        ], history: []
      },
      {
        id: 3, code: "НИР-2026-045", title: "Подбор режимов винтовой прокатки заготовок",
        kind: "nir", labId: 4, owner: "Руководитель опытной серии", status: "planned", dueDate: "2027-01-01",
        description: "Подготовка программы исследования и исходных данных для условной опытной серии. Оценка затрат ещё не готова.",
        criteria: "Согласованная программа, протокол опытной серии и обоснование выбранных режимов.",
        contractGross: 4200000, minReturn: 15,
        forecast: {revenueRemaining: 3500000, costRemaining: null, complete: false},
        facts: {revenue: null, cost: null, payment: null},
        stages: [], history: []
      },
      {
        id: 4, code: "НИР-2026-032", title: "Оптимизация усилий прессования труб",
        kind: "nir", labId: 2, owner: "Руководитель исследования", status: "review", dueDate: "2026-11-10",
        description: "Пример завершённой исследовательской программы, переданной на рассмотрение. Экономическое отклонение показано отдельно от научного результата.",
        criteria: "Протокол испытаний, оценка усилий и итоговый технический отчёт.",
        contractGross: 2160000, minReturn: 15,
        forecast: {revenueRemaining: 0, costRemaining: 0, complete: true},
        facts: {revenue: 1800000, cost: 1920000, payment: 1080000},
        stages: [
          {id: 4, title: "Итоговая оценка и технический отчёт", status: "review", dueDate: "2026-11-10", criteria: "Завершена программа испытаний, выводы подтверждены протоколом."}
        ], history: []
      },
      {
        id: 5, code: "ПУБ-2026-012", title: "Влияние геометрии оправки на формирование стенки трубы",
        kind: "publication", labId: 1, owner: "Автор публикации", status: "review", dueDate: "2026-11-18",
        description: "Рукопись подготовлена для внутренней проверки. Подача в редакцию и фактическая публикация учитываются как разные события.",
        criteria: "Подтверждённый выход статьи и ссылка на опубликованный материал.",
        contractGross: null, minReturn: 15,
        forecast: {revenueRemaining: null, costRemaining: null, complete: false},
        facts: {revenue: null, cost: null, payment: null}, stages: [], history: []
      },
      {
        id: 6, code: "ПУБ-2026-017", title: "Расчёт и эксперимент: распределение деформации при прокатке",
        kind: "publication", labId: 3, owner: "Координатор публикации", status: "active", dueDate: "2026-12-15",
        description: "Учебный пример подготовки текста, иллюстраций и сопоставления результатов для сборника конференции.",
        criteria: "Материал опубликован, обязательные сведения и подтверждение выхода сохранены.",
        contractGross: null, minReturn: 15,
        forecast: {revenueRemaining: null, costRemaining: null, complete: false},
        facts: {revenue: null, cost: null, payment: null}, stages: [], history: []
      },
      {
        id: 7, code: "РИД-2026-004", title: "Способ стабилизации геометрии заготовки при прокатке",
        kind: "rid", labId: 4, owner: "Ответственный за оформление РИД", status: "active", dueDate: "2026-11-28",
        description: "Условный пример подготовки описания результата интеллектуальной деятельности и материалов профильной проверки.",
        criteria: "Подтверждённый итог выбранного маршрута оформления, проверка прав и назначенное сопровождение.",
        contractGross: null, minReturn: 15,
        forecast: {revenueRemaining: null, costRemaining: null, complete: false},
        facts: {revenue: null, cost: null, payment: null}, stages: [], history: []
      },
      {
        id: 8, code: "ПОР-2026-026", title: "Подготовить предложения по обновлению измерительного стенда",
        kind: "assignment", labId: 2, owner: "Координатор поручения", status: "active", dueDate: "2026-11-17",
        description: "Самостоятельное поручение вне НИР: собрать потребности лабораторий и подготовить перечень вариантов.",
        criteria: "Сравнительная таблица вариантов с ограничениями, стоимостью и рекомендацией для рассмотрения.",
        contractGross: null, minReturn: 15,
        forecast: {revenueRemaining: null, costRemaining: null, complete: false},
        facts: {revenue: null, cost: null, payment: null}, stages: [], history: []
      }
    ],
    tasks: [
      {id: 1, workId: 1, title: "Подготовить программу измерений", assignee: "Инженер-исследователь", reviewer: "Проверяющий результатов", dueDate: "2026-10-25", status: "done", result: "Программа составлена и проверена."},
      {id: 2, workId: 1, title: "Сверить исходную выборку", assignee: "Инженер-исследователь", reviewer: "Проверяющий результатов", dueDate: "2026-10-31", status: "done", result: "Выборка сверена, расхождений в условных данных нет."},
      {id: 3, workId: 1, title: "Сравнить результаты трёх режимов", assignee: "Инженер-исследователь", reviewer: "Проверяющий результатов", dueDate: "2026-11-15", status: "doing", result: ""},
      {id: 4, workId: 1, title: "Проверить протокол опытной серии", assignee: "Инженер-исследователь", reviewer: "Проверяющий результатов", dueDate: "2026-11-13", status: "review", result: "Протокол условной серии заполнен. Отклонения и единицы измерений проверены."},
      {id: 5, workId: 1, title: "Подготовить итоговые рекомендации", assignee: "Инженер-исследователь", reviewer: "Проверяющий результатов", dueDate: "2026-11-22", status: "todo", result: ""},
      {id: 6, workId: 2, title: "Согласовать граничные условия модели", assignee: "Исследователь моделирования", reviewer: "Координатор совместной НИР", dueDate: "2026-11-11", status: "doing", result: ""},
      {id: 7, workId: 2, title: "Сопоставить расчётные и экспериментальные кривые", assignee: "Исследователь моделирования", reviewer: "Проверяющий результатов", dueDate: "2026-11-16", status: "todo", result: ""},
      {id: 8, workId: 2, title: "Собрать общий отчёт лабораторий", assignee: "Исследователь моделирования", reviewer: "Координатор совместной НИР", dueDate: "2026-11-19", status: "todo", result: ""},
      {id: 9, workId: 4, title: "Подготовить протокол испытаний прессования", assignee: "Инженер испытаний", reviewer: "Проверяющий результатов", dueDate: "2026-11-07", status: "done", result: "Протокол и описание условной серии сохранены."},
      {id: 10, workId: 4, title: "Проверить выводы технического отчёта", assignee: "Инженер испытаний", reviewer: "Проверяющий результатов", dueDate: "2026-11-10", status: "review", result: "Выводы подготовлены, программа исследований выполнена."},
      {id: 11, workId: 6, title: "Подготовить иллюстрации к статье", assignee: "Автор иллюстраций", reviewer: "Координатор публикации", dueDate: "2026-11-20", status: "doing", result: ""},
      {id: 12, workId: 8, title: "Собрать предложения по измерительному стенду", assignee: "Инженер-исследователь", reviewer: "Координатор поручения", dueDate: "2026-11-17", status: "todo", result: ""}
    ]
  };
  // Version 2 examples are authored here, never exported from a working database.
  // Only a fresh demo/reset receives these dated examples. The model migrates old
  // browser copies without assigning new facts or dates to visitors' own works.
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2,"0");
  const selectedPeriod = currentYear + "-" + currentMonth;
  const previous = new Date(currentYear, now.getMonth() - 1, 1);
  const previousPeriod = previous.getFullYear() + "-" + String(previous.getMonth() + 1).padStart(2,"0");
  function endOfMonth(value) {
    const year=Number(value.slice(0,4)),month=Number(value.slice(5));
    return value + "-" + String(new Date(year,month,0).getDate()).padStart(2,"0");
  }
  function shift(value) { return value.replace(/^(2026|2027)-/,(_,year)=>(currentYear+Number(year)-2026)+"-"); }
  data.schemaVersion = 2;
  data.today = selectedPeriod + "-" + String(now.getDate()).padStart(2,"0");
  data.works.forEach(function(work,index) {
    work.code=work.code.replace("2026",String(currentYear));
    work.dueDate=shift(work.dueDate);
    work.customer=work.kind==="nir"?"Учебный заказчик "+String.fromCharCode(1040+index):"";
    work.startDate=work.kind==="nir"?(currentYear-1)+"-01-01":null;
    work.externalBudget=null;
    work.relatedNirId=work.kind==="publication"?(work.id===5?2:1):null;
    work.demoSource="";
    work.participations=[{labId:work.labId,revenueShare:100}];
    work.contributions=[];
    work.stages.forEach(function(stage) {
      stage.dueDate=shift(stage.dueDate);
      stage.startDate=null;stage.amountGross=null;stage.externalBudget=null;
      stage.forecastDate=null;stage.acceptedDate=null;
    });
  });
  data.tasks.forEach(task=>{task.dueDate=shift(task.dueDate);});
  const first=data.works[0];
  first.dueDate=currentYear+"-12-20";
  first.externalBudget=200000;
  first.stages[0].dueDate=endOfMonth(previousPeriod);
  first.stages[0].acceptedDate=endOfMonth(previousPeriod);
  first.stages[1].dueDate=currentYear+"-12-15";
  first.stages[1].forecastDate=currentYear+"-12-18";
  first.stages.forEach(stage=>{stage.amountGross=2880000;stage.externalBudget=100000;});
  const joint=data.works[1];
  joint.dueDate=currentYear+"-12-25";
  joint.participations=[{labId:1,revenueShare:60},{labId:3,revenueShare:40}];
  joint.stages[0].dueDate=currentYear+"-12-23";
  joint.stages[0].forecastDate=currentYear+"-12-27";
  joint.stages[0].amountGross=3840000;
  joint.contributions=[{id:1,title:"Экспериментальная проверка режима",labId:3,assignee:"Соисполнитель лаборатории",stageId:3,
    proposedAmount:450000,approvedAmount:null,status:"pending",confirmedBy:"",confirmedAt:null,revision:0,history:[]}];
  const future=data.works[2];
  future.dueDate=(currentYear+1)+"-03-31";
  future.stages=[
    {id:5,title:"Программа опытной серии",status:"planned",dueDate:(currentYear+1)+"-01-31",criteria:"Согласована программа и перечень измерений.",startDate:(currentYear+1)+"-01-10",amountGross:2100000,externalBudget:null,forecastDate:null,acceptedDate:null},
    {id:6,title:"Испытания и рекомендации",status:"planned",dueDate:(currentYear+1)+"-03-31",criteria:"Проверен отчёт и рекомендации.",startDate:(currentYear+1)+"-02-01",amountGross:2100000,externalBudget:null,forecastDate:null,acceptedDate:null}
  ];
  data.works[3].stages[0].amountGross=2160000;
  data.monthlyEntries=[];
  function entry(workId,kind,amount,labId,period,confirmed=true) {
    data.monthlyEntries.push({id:data.monthlyEntries.length+1,workId,labId,kind,period,amount,confirmed,source:"Учебная помесячная запись; реальные документы не используются"});
  }
  entry(1,"revenue",1400000,null,previousPeriod); entry(1,"revenue",1000000,null,selectedPeriod);
  entry(1,"cost",1000000,3,previousPeriod); entry(1,"cost",600000,3,selectedPeriod);
  entry(1,"payment",900000,null,previousPeriod); entry(1,"payment",540000,null,selectedPeriod);
  entry(2,"revenue",1600000,null,previousPeriod);
  entry(2,"cost",900000,1,previousPeriod); entry(2,"cost",350000,3,previousPeriod);
  entry(2,"cost",200000,1,selectedPeriod); entry(2,"cost",100000,3,selectedPeriod);
  entry(2,"payment",960000,null,previousPeriod);
  entry(4,"revenue",1000000,null,previousPeriod); entry(4,"revenue",800000,null,selectedPeriod);
  entry(4,"cost",1000000,2,previousPeriod); entry(4,"cost",920000,2,selectedPeriod);
  entry(4,"payment",1080000,null,previousPeriod);
  data.months=[];
  for(const period of [previousPeriod,selectedPeriod]) {
    for(const lab of data.labs) {
      const known=lab.id!==4;
      data.months.push({labId:lab.id,period,headcount:known?({1:8,2:6,3:10}[lab.id]):null,
        source:known?"Учебный список состава лаборатории на конец месяца":"",asOf:known?endOfMonth(period):null,
        revenueComplete:known,costComplete:known,confirmed:known,revision:0});
    }
  }
  function freeze(value) {
    Object.keys(value).forEach(function (key) {
      if (value[key] && typeof value[key] === "object") freeze(value[key]);
    });
    return Object.freeze(value);
  }
  root.OTB_DATA = freeze(data);
  if (typeof module === "object" && module.exports) module.exports = root.OTB_DATA;
})(typeof window !== "undefined" ? window : globalThis);

