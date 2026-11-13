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
  function freeze(value) {
    Object.keys(value).forEach(function (key) {
      if (value[key] && typeof value[key] === "object") freeze(value[key]);
    });
    return Object.freeze(value);
  }
  root.OTB_DATA = freeze(data);
  if (typeof module === "object" && module.exports) module.exports = root.OTB_DATA;
})(typeof window !== "undefined" ? window : globalThis);

