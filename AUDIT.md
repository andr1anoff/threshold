# THRESHOLD — HARDCODE AUDIT (v14-fix)

> Аудит выполнен автоматически + вручную. Ничего не правилось — только зафиксировано.

---

## frontend/src/data/seed.js

- `seed.js:1–20` — **REGIONS array захардкожен**: все 20 регионов с EI, trend, lat/lng. EI и trend — статичные значения из seed, не из БД. Частично решено в v14-fix (Home.jsx теперь мержит live EI из `/api/di/global`), но trend всё ещё из seed.
- `seed.js:22–48` — **SPARKLINES захардкожены**: генерируются псевдослучайно на основе seed EI при загрузке. Не из API.
- `seed.js:109–117` — **EXERCISES захардкожены**: 8 упражнений (STEADFAST DEFENDER, RIMPAC, AURORA и т.д.) с конкретными датами, scale, rhetoric_score. Используются в WarRoom.jsx как fallback (`useState(EXERCISES)`).
- `seed.js:62–87` — **INCIDENTS захардкожены**: 24 тестовых инцидента (i1–i24). Используются в Home и Incidents как начальный state до fetch.

---

## frontend/src/pages/Home.jsx

- `Home.jsx:16` — `useState(1247)` — начальное значение "incidents indexed" захардкожено как 1247. Перезаписывается fetch'ом, но мелькает при первом рендере.

---

## frontend/src/pages/WarRoom.jsx

- `WarRoom.jsx:16–34` — **VIEWPORTS и MARKER_POS захардкожены**: географические bounds/координаты для конкретных упражнений (STEADFAST DETERRENCE, RIMPAC, AURORA и т.д.). Если упражнение приходит из БД с новым именем — маркер упадёт на дефолтные координаты `[30,15]`.
- `WarRoom.jsx:36–43` — **THEATRES захардкожены**: 5 театров с конкретными geo-полигонами. Не из API, не обновляются.

---

## frontend/src/pages/Patterns.jsx

- `Patterns.jsx:290–350` — **`buildLocalBrief()`**: локальная функция генерирует brief из seed REGIONS без LLM. Текст про "STEADFAST-series" и "US-Pacific exercises" — захардкожен в разделе "Exercise activity". Используется как fallback при недоступности backend.
- `Patterns.jsx:322` — `"Cross-theatre signalling from NATO STEADFAST-series..."` — конкретные названия упражнений захардкожены в шаблонном тексте brief.

---

## frontend/src/components/Layout.jsx

- `Layout.jsx:14` — **SOURCES array захардкожен**: `["ReliefWeb/OCHA","UCDP Uppsala","Wikipedia","UN News","GDELT","DeepState","CIT Leviev","SHAPE NATO"]` — список источников в футере, статичный.

---

## backend/app/di/calculator.py

- `calculator.py:10–17` — **REGIONS list захардкожен**: список 20 регионов дублирует frontend seed. При добавлении нового региона нужно обновлять в двух местах.
- `calculator.py:18–23` — **CONFLICT_BASELINE захардкожен**: baseline-веса для каждого региона. Не хранятся в БД.

---

## backend/app/routers/admin.py

- `admin.py:20` — `model="llama-3.1-8b-instant"` захардкожен в `/test-llm` endpoint. Не критично.

---

## Приоритеты для следующих версий

| Приоритет | Файл | Что сделать |
|---|---|---|
| HIGH | `seed.js` REGIONS | Убрать EI/trend из seed, тянуть только из `/api/di/global` |
| HIGH | `seed.js` EXERCISES | Удалить, WarRoom полностью на `/api/exercises/` |
| MEDIUM | `WarRoom.jsx` VIEWPORTS/MARKER_POS | Добавить поля `lat`/`lng`/`bounds` в exercises таблицу |
| MEDIUM | `calculator.py` CONFLICT_BASELINE | Перенести в отдельную таблицу `region_config` в Supabase |
| LOW | `seed.js` INCIDENTS | Удалить после стабилизации scraper pipeline |
| LOW | `Home.jsx:16` | `useState(null)` + skeleton пока не пришёл fetch |
