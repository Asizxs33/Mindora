import { t } from './language.js';

// Insert without redrawing the lesson so a just-typed answer stays copyable.
export function showWorkspaceConflict(main) {
  if (!main || main.querySelector('#workspace-conflict')) return;
  main.insertAdjacentHTML('afterbegin', `<section id="workspace-conflict" class="hint-box" role="alert" aria-labelledby="workspace-conflict-title">
    <h2 id="workspace-conflict-title">${t('Saving is paused in this tab', 'Сохранение в этой вкладке приостановлено', 'Бұл қойындыда сақтау тоқтатылды')}</h2>
    <p>${t('Another tab saved newer progress. Your text is still here, but changes in this tab will not be saved. Copy any new text before reloading the saved progress.', 'В другой вкладке сохранён более новый прогресс. Твой текст остаётся здесь, но изменения в этой вкладке не сохраняются. Скопируй новый текст перед загрузкой сохранённого прогресса.', 'Басқа қойындыда жаңа ілгерілеу сақталған. Мәтінің осында қалады, бірақ осы қойындыдағы өзгерістер сақталмайды. Сақталған ілгерілеуді жүктемес бұрын жаңа мәтінді көшіріп ал.')}</p>
    <button class="secondary" type="button" data-action="reload-workspace">${t('Reload saved progress', 'Загрузить сохранённый прогресс', 'Сақталған ілгерілеуді жүктеу')}</button>
  </section>`);
}
