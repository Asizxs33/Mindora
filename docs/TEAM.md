# Работа над Mindora вдвоём

| Зона | Кто работает | Что внутри |
| --- | --- | --- |
| `ui/` | Дизайнер | Страницы, разметка, меню, стили, иконки и иллюстрации |
| `core/` | Разработчик | Учебные сценарии, задания, проверка, прогресс, черновики и выгрузка работ |
| `tests/` | Разработчик | Проверки учебной логики |

Дизайнер может полностью перестроить экраны внутри `ui/`. Страницы получают данные от контроллера и возвращают HTML. Чтобы кнопки и поля сохранили свои действия, перенеси их рабочие атрибуты в новую разметку.

## Где менять дизайн

- `ui/dashboard.js` — главная, навигация, каталог, практика, профиль, достижения и сообщество.
- `ui/views.js` — путь обучения, уроки, квизы, редакторы, результат и портфолио.
- `ui/shell.js` — шапка, боковое меню, нижнее меню, контейнеры страницы и диалога.
- `ui/feedback.js` — содержимое диалогов, обновление предпросмотра и сброс результатов проверки.
- `ui/styles.css`, `ui/adventure.css`, `ui/icons.js`, `ui/assets/` — стили, иконки и картинки. `adventure.css` подключён после `styles.css`.

## Контракт между UI и core

Сохрани существующие экспорты функций, аргументы и перечисленные атрибуты. UI читает переданные данные, а изменение состояния выполняет контроллер в `core/app.js`.

| Элемент | Атрибуты и значения |
| --- | --- |
| Контейнер приложения | `#app` в `index.html`, `#main` с `tabindex="-1"`, `#navigation`, `#top-navigation`, `#mobile-navigation`, `#top-actions`, `#toast`, `dialog#modal`, `#modal-content`, `#modal-title` |
| Логотип, переходы и курсы | `data-home`, `data-view` со старым значением, `data-course="design"` или `data-course="budget"`, `data-start` для немедленного старта |
| Поиск по цели и настройки | `form#goal-form`, `#goal-input`, `#time-select`, `#profile-minutes` |
| Язык интерфейса | `select#interface-language` со значениями `en`, `ru`, `kk`. |
| ИИ-маршрут | `form#learning-plan-form` с полями `goal`, `minutes`. `form#learning-step-form` с полем `answer`. Кнопки `data-learning-step="edit"` и `data-learning-step="continue"`. Сохрани `#learning-review-status` и `#learning-plan-complete` с `tabindex="-1"` для перехода фокуса. |
| Подробный ИИ-урок | `data-learning-page="back|next|check"` переключает экран и проверяет выбор; `data-learning-choice="0|1|2"` выбирает ответ. Сохрани `#learning-page-title` с `tabindex="-1"`, состояния `disabled`, историю выполненных работ. Разметка: `ui/learning-plan.js`, стили: `ui/ai-lesson.css`. Контроллер и состояние остаются в `core/`. Подробнее: [DETAILED-LESSONS.md](DETAILED-LESSONS.md). |
| Урок, квиз, практика | `data-step` для этапов 0–3, `data-choice` для ответа, `data-action` и `data-id` для соответствующих кнопок. Сохрани `disabled` у заблокированных этапов и состояние проверки. |
| Постер | `#poster-form` и исходные имена полей `title`, `subtitle`, `cta`, `titleSize`, `subtitleSize`, `textColor`, `data-color`, `data-poster-stage`, `data-poster-preview`, `#title-size`, `#subtitle-size` |
| Таблица и сохранённые работы | `#budget-formula`, `#budget-answer`, `data-expense`, `data-budget-total`, `#checks-container`, `data-note`, кнопки скачивания с `data-action="download"` и `data-id` |

В таблицах `#time-select` на главной и `#budget-session-minutes` в курсе принимают значения `5`, `10` и `20`. В расширенной практике поле `#budget-balance` принимает остаток после расходов, в том числе отрицательный. Для квиза используй переданное `questionCount`, чтобы последняя кнопка завершала этап при любом количестве вопросов.

Оставляй интерактивные элементы кнопками и полями. При показе пользовательского текста в HTML применяй `escapeHtml`. Форма сохранённых данных и ключ `mindora.workspace.v1` находятся в `core/`.

## Как отправлять изменения

1. Прими [приглашение в репозиторий](https://github.com/Asizxs33/Mindora/invitations), затем клонируй репозиторий и открой папку в Codex.
2. Начинай от актуальной `main`. Дизайнер создаёт ветку `design/redesign` или другую ветку с префиксом `design/`. Для задач по логике используй `feat/<название>`.
3. Запусти `npm start` и открой `http://127.0.0.1:4173/`. Node.js 22 подходит, установка пакетов не нужна.
4. Проверь сайт на компьютере и телефоне. Запусти `npm run check` и `npm test`.
5. Отправь свою ветку на GitHub и открой Pull Request в `main`. Для веток `design/` GitHub Actions проверяет, что все изменения находятся в `ui/`. Приложи снимки изменённых экранов.
6. Владелец проверяет PR, затем объединяет его с `main`. Vercel публикует `main` на [основном сайте](https://mindora-livid-eta.vercel.app/). Если GitHub Actions или предпросмотр Vercel ещё ждут разрешения или запуска, проверь результат локально перед слиянием.

GitHub выдаёт роль collaborator на весь репозиторий. Разделение работы по папкам поддерживают договорённость и проверка PR.

[Готовый промпт для Codex дизайнера](CODEX-DESIGN-PROMPT.md)
