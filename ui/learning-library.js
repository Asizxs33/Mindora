import { escapeHtml as esc } from '../core/engine.js';
import { currentLanguage, t } from './language.js';
import { icon } from './icons.js';

function courseCard(course, loading) {
  const total = Number.isInteger(course.totalSteps) && course.totalSteps > 0 ? course.totalSteps : 0;
  const completed = Number.isInteger(course.completed) ? Math.min(total, Math.max(0, course.completed)) : 0;
  const done = total > 0 && completed === total;
  return `<li class="learning-library-card">
    <div class="learning-library-card-meta"><span>${icon(done ? 'check' : 'book', 17)} ${done ? t('Completed', 'Завершено', 'Аяқталды') : completed ? t('In progress', 'В процессе', 'Орындалуда') : t('Ready to start', 'Можно начинать', 'Бастауға дайын')}</span><span>${icon('clock', 16)} ${esc(course.minutes)} ${t('min', 'мин', 'мин')}</span></div>
    <h3 lang="${esc(course.language || currentLanguage())}">${esc(course.title)}</h3>
    <p lang="${esc(course.language || currentLanguage())}">${esc(course.goal)}</p>
    ${total ? `<div class="learning-library-progress"><progress max="${total}" value="${completed}" aria-label="${t('Completed tasks', 'Выполненные задания', 'Орындалған тапсырмалар')}"></progress><span>${t(`${completed} of ${total} tasks`, `${completed} из ${total} заданий`, `${total} тапсырманың ${completed}-і`)}</span></div>` : ''}
    <button type="button" class="secondary" data-learning-open="${esc(course.id)}"${loading ? ' disabled' : ''}>${done ? t('View my work', 'Посмотреть работу', 'Жұмысымды көру') : completed ? t('Continue lesson', 'Продолжить занятие', 'Сабақты жалғастыру') : t('Open lesson', 'Открыть занятие', 'Сабақты ашу')} ${icon('arrow', 18)}</button>
  </li>`;
}

export function loginRequiredView({ available = true } = {}) {
  return `<section class="learning-library learning-library-gate" aria-labelledby="learning-library-title">
    <span class="learning-library-symbol" aria-hidden="true">${icon('lock', 23)}</span>
    <div><h2 id="learning-library-title">${t('Sign in to start learning', 'Войди, чтобы начать учиться', 'Оқуды бастау үшін кір')}</h2>
      <p>${t('Your lessons and progress will stay in your account, ready on any device.', 'Занятия и прогресс будут сохраняться в аккаунте и доступны на любом устройстве.', 'Сабақтарың мен үлгерімің аккаунтыңда сақталып, кез келген құрылғыда қолжетімді болады.')}</p>
      ${available === false ? `<p class="learning-library-status is-error" role="status">${t('Sign-in is temporarily unavailable. Please try again shortly.', 'Вход временно недоступен. Попробуй чуть позже.', 'Кіру уақытша қолжетімсіз. Біраздан кейін қайталап көр.')}</p>` : ''}
      <div class="learning-library-actions"><button type="button" class="primary" data-account-open="signup">${t('Create account', 'Создать аккаунт', 'Аккаунт ашу')}</button><button type="button" class="secondary" data-account-open="signin">${t('Sign in', 'Войти', 'Кіру')}</button></div>
    </div>
  </section>`;
}

export function learningLibraryView({ user, available = true, loading = false, error = '', courses = [], hasLocalLesson = false, hasLocalBuiltin = false } = {}) {
  if (!user) return loginRequiredView({ available });

  return `<section class="learning-library" aria-labelledby="learning-library-title" aria-busy="${Boolean(loading)}">
    <header class="learning-library-heading"><div><h2 id="learning-library-title">${t('Your saved lessons', 'Сохранённые занятия', 'Сақталған сабақтар')}</h2><p>${t('Pick up where you left off, on any device.', 'Продолжай с того места, где остановился, на любом устройстве.', 'Кез келген құрылғыда тоқтаған жеріңнен жалғастыр.')}</p></div><button type="button" class="secondary" data-learning-refresh${loading ? ' disabled' : ''}>${t('Refresh', 'Обновить', 'Жаңарту')}</button></header>
    ${loading ? `<p class="learning-library-status" role="status">${t('Loading your lessons…', 'Загружаем занятия…', 'Сабақтар жүктеліп жатыр…')}</p>` : error ? `<p class="learning-library-status is-error" role="status">${t('We couldn’t load your lessons. Try refreshing in a moment.', 'Не удалось загрузить занятия. Попробуй обновить список чуть позже.', 'Сабақтарды жүктеу мүмкін болмады. Біраздан кейін тізімді жаңартып көр.')}</p>` : ''}
    ${hasLocalLesson ? `<div class="learning-library-import"><h3>${t('A lesson from this browser', 'Занятие из этого браузера', 'Осы браузердегі сабақ')}</h3><p>${t('This lesson is saved only on this device. Add it to your account to keep learning on other devices.', 'Это занятие сохранено только на этом устройстве. Добавь его в аккаунт, чтобы продолжать на других устройствах.', 'Бұл сабақ тек осы құрылғыда сақталған. Басқа құрылғыларда жалғастыру үшін оны аккаунтыңа қос.')}</p><button type="button" class="secondary" data-learning-import${loading ? ' disabled' : ''}>${t('Save to my account', 'Сохранить в аккаунт', 'Аккаунтқа сақтау')}</button></div>` : ''}
    ${hasLocalBuiltin ? `<div class="learning-library-import"><h3>${t('Course progress from this browser', 'Прогресс курсов из этого браузера', 'Осы браузердегі курс үлгерімі')}</h3><button type="button" class="secondary" data-builtin-import>${t('Save course progress to my account', 'Сохранить прогресс курсов в аккаунте', 'Курс үлгерімін аккаунтқа сақтау')}</button></div>` : ''}
    ${courses.length ? `<ul class="learning-library-list">${courses.map(course => courseCard(course, loading)).join('')}</ul>` : !loading && !error ? `<div class="learning-library-empty">${icon('book', 24)}<p>${t('Your first personal lesson will appear here when you create it.', 'Первое персональное занятие появится здесь, когда ты его создашь.', 'Алғашқы жеке сабағыңды жасағаннан кейін ол осы жерде пайда болады.')}</p></div>` : ''}
  </section>`;
}

export function learningSyncView({ status = 'idle', error = '', conflict = false, builtin = false } = {}) {
  if (status === 'idle' && !error && !conflict) return '';
  const busy = status === 'loading' || status === 'saving';
  const needsChoice = !busy && (status === 'conflict' || conflict);
  const failed = !busy && !needsChoice && (status === 'offline' || error);
  const text = needsChoice && builtin
    ? t('Course progress changed on another device. Opening the account version replaces the progress in this browser.', 'Прогресс курсов изменился на другом устройстве. Если открыть версию из аккаунта, она заменит прогресс в этом браузере.', 'Курс үлгерімі басқа құрылғыда өзгерді. Аккаунттағы нұсқаны ашсаң, ол осы браузердегі үлгерімді ауыстырады.')
    : busy ? status === 'loading'
    ? t('Opening your saved lesson…', 'Открываем сохранённое занятие…', 'Сақталған сабақ ашылып жатыр…')
    : t('Saving your progress…', 'Сохраняем прогресс…', 'Үлгерім сақталып жатыр…')
    : needsChoice ? t('This lesson changed on another device. Opening the account version replaces this browser’s copy. Saving your work as a new lesson keeps both versions.', 'Занятие изменилось на другом устройстве. Версия из аккаунта заменит копию в этом браузере. Если сохранить свою работу отдельным занятием, обе версии останутся.', 'Сабақ басқа құрылғыда өзгерді. Аккаунттағы нұсқа осы браузердегі көшірмені ауыстырады. Жұмысыңды бөлек сабақ ретінде сақтасаң, екі нұсқа да қалады.')
      : failed ? t('Your latest changes haven’t reached your account. Try saving again.', 'Последние изменения ещё не сохранены в аккаунте. Попробуй сохранить ещё раз.', 'Соңғы өзгерістер аккаунтта әлі сақталмады. Қайта сақтап көр.')
        : t('Saved to your account.', 'Сохранено в аккаунте.', 'Аккаунтта сақталды.');
  return `<aside class="learning-sync${needsChoice || failed ? ' needs-attention' : ''}" aria-label="${t('Lesson saving', 'Сохранение занятия', 'Сабақты сақтау')}" aria-busy="${busy}">
    <p role="status">${icon(needsChoice || failed ? 'clock' : busy ? 'clock' : 'check', 18)} <span>${text}</span></p>
    ${needsChoice ? `<div class="learning-sync-actions"><button type="button" class="secondary" data-${builtin ? 'builtin' : 'learning'}-sync="load-latest">${t('Open account version', 'Открыть версию из аккаунта', 'Аккаунттағы нұсқаны ашу')}</button>${builtin ? '' : `<button type="button" class="primary" data-learning-sync="save-copy">${t('Save my copy', 'Сохранить мою копию', 'Көшірмемді сақтау')}</button>`}</div>` : failed ? `<button type="button" class="secondary" data-${builtin ? 'builtin' : 'learning'}-sync="retry">${t('Try syncing again', 'Повторить синхронизацию', 'Синхрондауды қайталау')}</button>` : ''}
  </aside>`;
}
