# KWF — production deploy (кратко)

## 1. Переменные окружения

Скопируй нужные из `KWF-backend/backend/.env.example`:

```text
DJANGO_SECRET_KEY=<long-random, обязательно!>
DJANGO_DEBUG=0
DJANGO_ALLOWED_HOSTS=fed.example.com
DATABASE_URL=postgres://kwf:***@db:5432/kwf
CORS_EXTRA_ORIGINS=https://fed.example.com
CSRF_TRUSTED_ORIGINS=https://fed.example.com
NEXT_PUBLIC_API_URL=https://api.fed.example.com
PASSWORD_RESET_FRONTEND_URL=https://fed.example.com
POSTGRES_PASSWORD=<long-random>
```

Без `DJANGO_SECRET_KEY` backend не стартует в compose (fail-fast).
`DEBUG=1` и встроенный SECRET — только для локалки.

Смена URL API без пересборки фронтенда (M8): задай `KWF_API_URL`
(приоритет над запечённым `NEXT_PUBLIC_API_URL`):

```text
KWF_API_URL=https://api.fed.example.com
```

## 1.1. Куки и кросс-доменность (важно для авторизации)

Авторизация — HttpOnly cookies. Если фронт и API на **разных** хостах
(напр. `fed.example.com` → `api.fed.example.com`), дефолтный
`SameSite=Lax` заставит браузер молча не отправлять куки — каждый запрос
будет 401, включая refresh. Для кросс-доменного деплоя задай:

```text
JWT_COOKIE_SAMESITE=None
JWT_COOKIE_SECURE=1
JWT_COOKIE_DOMAIN=.fed.example.com
CSRF_TRUSTED_ORIGINS=https://fed.example.com
CORS_EXTRA_ORIGINS=https://fed.example.com
```

`SameSite=None` без `Secure` backend отклонит при старте (fail-fast).
На одном хосте (фронт и API рядом) ничего менять не нужно — оставь `Lax`.
Окно прощения гонки refresh между вкладками: `JWT_REFRESH_GRACE_SECONDS`
(по умолчанию 30, `0` — строгий режим).

## 2. Запуск (docker compose)

```bash
docker compose up -d --build
docker compose exec backend python backend/manage.py createsuperuser
```

Миграции применяются автоматически при старте backend.
Health: `GET /api/health/` → `{"ok": true, "db": "up"}`.

## 3. Бэкапы Postgres

```bash
# backup
docker compose exec db pg_dump -U kwf kwf | gzip > backup-$(date +%F).sql.gz
# restore
gunzip -c backup-YYYY-MM-DD.sql.gz | docker compose exec -T db psql -U kwf kwf
```

Храни бэкапы вне сервера. Проверяй restore раз в месяц.

Uploads (`/media/`, картинки новостей) лежат на persistent volume `media`
и раздаются backend (`DJANGO_SERVE_MEDIA=1` в compose). Бэкапь и его:

```bash
docker run --rm -v kwf-product-main_media:/media -v "$PWD":/b alpine \
  tar czf /b/media-$(date +%F).tar.gz -C /media .
```

Правильное решение на будущее — вынести `/media/` на nginx/S3 и снять
`DJANGO_SERVE_MEDIA`.

## 4. Обновление / rollback

```bash
docker compose pull || docker compose build
docker compose up -d
```

Откат: предыдущий образ/тег + `manage.py migrate <app> <prev>` при необходимости.
Миграции в проекте только additive (проверено `makemigrations --check` в CI).

## 5. Мониторинг

- Backend пишет структурированные логи в stdout (`DJANGO_LOG_LEVEL`).
- Sentry: следующий шаг — добавить DSN (см. roadmap).
- Метрики: `events`-поллинг и `tatami_queue` — первые кандидаты на алерты latency.
- M10 — realtime SLA: push/WS нет, только tail-polling (`events/?after=`
  каждые 2с, backoff до 30с при ошибках). Объявления на табло и ETA
  опаздывают на величину опроса — это контракт, а не баг; при росте
  нагрузки/клиентов планировать SSE/WS.

## 6. Retention ленты событий

```bash
docker compose exec backend python backend/manage.py prune_events --days 30
```

Повесить на cron/еженедельно.
