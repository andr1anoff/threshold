# Threshold v17 — hardening pass (2026-07-02)

## 1. Классификация: свежее — первым
`run_classification_pipeline` теперь выбирает unknown/none инциденты `ORDER BY date DESC`.
Если квота LLM умирает посреди прогона, сегодняшние инциденты уже классифицированы
и EI считается по свежим данным; старый бэклог ждёт следующего цикла.

## 2. Resweep «unclassifiable»
- Новая функция `resweep_unclassifiable()` в classifier.py: инциденты с текстом,
  застрявшие в `unclassifiable` (обычно из-за давно починенного constraint),
  возвращаются в `unknown` и переклассифицируются.
- `POST /api/admin/resweep` (требует ключ) + `scripts/resweep.py`
- Новый workflow `.github/workflows/resweep.yml` — каждое воскресенье 05:00 UTC.
- `GET /api/admin/stats/categories` — счётчики по категориям, чёрная дыра теперь видима.

## 3. LLM fallback chain
Новый `app/llm/providers.py`: Groq (primary) → OpenRouter free-tier (fallback).
- При исчерпании Groq TPD пайплайн НЕ абортится, если задан `OPENROUTER_API_KEY`.
- classifier.py и exercise_classifier.py переведены на единый `call_llm(tier=...)`.
- Без `OPENROUTER_API_KEY` поведение идентично старому (abort на TPD).

## 4. Фронт: конец синтетики
- `SPARKLINES` (псевдослучайная генерация) удалены; seed `ei/prev/trend` = null.
- Новый endpoint `GET /api/di/overview`: реальный EI + 7-дневная дельта + 30 дней
  истории на регион — один запрос для всей главной.
- Home: тренды/спарклайны из API; нет данных → «—», не выдуманное число.
- Region: спарклайн из реальной history; фейковый «ranked N/20» (считался из
  захардкоженных seed-значений) убран.
- Incidents / WarRoom: seed-инциденты и seed-учения больше не показываются как
  начальное состояние или при падении API.
- Patterns: локальный fallback-brief больше не выдумывает цифры EI и «STEADFAST»-
  формулировки — честный unavailable-state.

## 5. deterrence_index → escalation_index
- Миграция: `backend/migrations/2026-07-02_escalation_index.sql`
  (rename таблицы + колонки, compatibility view для старого кода).
- Весь backend пишет/читает `escalation_index.ei_score`; ремапинг di_score→ei_score
  в роутерах удалён. schema.sql обновлена.
- **ПОРЯДОК ДЕПЛОЯ: сначала SQL в Supabase, потом deploy backend.**

## 6. Тесты
`backend/tests/` — 25 тестов (pytest): event_grouper (дедуп-кластеризация),
calculator (границы GZ, convexity severity, recency, корроборация, синхронность
списков регионов), regions (canonicalize/resolve), deduplicator (хэши).
CI: `.github/workflows/tests.yml` на каждый push/PR.
Бонус: тест поймал реальный пробел — «Odesa/Mykolaiv/Sumy/Lviv/Dnipro» отсутствовали
в COUNTRY_MAP (инциденты уходили в Unknown). Добавлены.

## 7. Admin auth
- Все POST-эндпоинты /api/admin/* и /test-llm требуют заголовок `X-Admin-Key`
  == env `ADMIN_API_KEY`. Ключ не задан → 503 (fail closed).
- GET /narrative остаётся открытым (его зовёт фронт), но `force=true`
  (регенерация, жжёт LLM-квоту) выполняется только с валидным ключом.
- Пример: `curl -X POST -H "X-Admin-Key: $KEY" $API/api/admin/scrape`

## Деплой-чеклист
1. Supabase SQL Editor → выполнить `migrations/2026-07-02_escalation_index.sql`
2. Railway → env vars: добавить `ADMIN_API_KEY` (сгенерируй: `openssl rand -hex 24`),
   опционально `OPENROUTER_API_KEY`
3. GitHub → Secrets: ничего нового для scraper.yml; resweep.yml использует
   существующие SUPABASE_URL/KEY
4. push → Railway redeploy, Vercel redeploy
5. Проверка: `GET /api/di/overview`, `GET /api/admin/stats/categories`,
   `POST /api/admin/scrape` без ключа → 401/503
