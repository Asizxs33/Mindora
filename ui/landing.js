import { character } from './characters.js';
import { icon } from './icons.js';
import { t } from './language.js';

export function landingView() {
  return `<div class="mindora-landing">
    <section class="landing-hero" aria-labelledby="landing-title">
      <div class="landing-copy">
        <p class="landing-audience">${t('Learning for life outside the classroom', 'Учёба, для которой найдётся время', 'Күнделікті өмірге қажет дағдылар')}</p>
        <h1 id="landing-title">${t('Small steps.<br><span>Skills that stay.</span>', 'Маленькие шаги.<br><span>Настоящие навыки.</span>', 'Шағын қадам.<br><span>Үлкен мүмкіндік.</span>')}</h1>
        <p class="landing-intro">${t('A busy life still has room for something new. Turn your goal into short, practical lessons that fit the time you have.', 'Работа, семья, дела — и немного времени на себя. Преврати свою цель в короткие практические уроки в удобном темпе.', 'Жұмыс пен күнделікті тірліктің арасында өзіңе де уақыт бөл. Мақсатыңды бос уақытыңа сай қысқа, практикалық сабақтарға айналдыр.')}</p>
        <div class="landing-start"><button type="button" class="primary" data-view="new-course">${t('Find my learning path', 'Создать мой путь', 'Оқу жолымды құру')}${icon('arrow',20)}</button>
          <span>${t('5, 10 or 20 minutes. Start without an account.', '5, 10 или 20 минут. Начни без регистрации.', '5, 10 немесе 20 минут. Тіркелмей бастай аласың.')}</span></div>
      </div>
      <div class="landing-studio">
        <div class="landing-studio-caption">${icon('sheet',20)}<span>${t('Everyday spreadsheets', 'Таблицы на каждый день', 'Күнделікті кестелер')}</span></div>
        <div class="landing-example"><div class="landing-example-screen"><span class="landing-window-bar"><i></i><i></i><i></i></span>
          <div class="landing-example-grid" aria-hidden="true"><span></span><span>A</span><span>B</span><span>1</span><span>${t('Budget','Бюджет','Бюджет')}</span><span>100</span><span>2</span><span>${t('Spent','Расходы','Шығын')}</span><span>35</span><span>3</span><span>${t('Left','Осталось','Қалдық')}</span><strong>=B1-B2</strong></div>
          <p>${icon('code',18)} ${t('Understand it. Then try it.', 'Разберись. А потом попробуй.', 'Түсін. Сосын қолданып көр.')}</p>
        </div></div>
        <div class="landing-mentor">${character('mino','idea','landing-mino')}<p>${t('You bring the goal.<br>We’ll find the first step.', 'Твоя цель.<br>Наш первый шаг вместе.', 'Мақсат — сенікі.<br>Алғашқы қадамды бірге табамыз.')}</p></div>
      </div>
    </section>
    <section class="landing-benefits" aria-label="${t('Why Mindora', 'Почему Mindora', 'Неліктен Mindora')}">
      ${[
        ['target',t('Your goal comes first','Сначала твоя цель','Алдымен сенің мақсатың'),t('A personal path starts with what you want to do and what you already know.','Путь учитывает, чему ты хочешь научиться и что уже умеешь.','Оқу жолы мақсатың мен бастапқы біліміңе сай құрылады.')],
        ['edit',t('Make something useful','Сразу к практике','Бірден практика'),t('Try an example, check your understanding, then make your own result.','Разбери пример, проверь себя и сделай свою работу.','Мысалды түсініп, біліміңді тексер де, өз жұмысыңды жаса.')],
        ['path',t('A place to come back to','Вернись и продолжи','Қайтып кел де, жалғастыр'),t('Your place stays saved. After a break, a short recap helps you return.','Место в уроке сохраняется. После перерыва поможет короткое повторение.','Тоқтаған жерің сақталады. Үзілістен кейін қысқа қайталау көмектеседі.')],
      ].map(([symbol,title,copy])=>`<article><span class="landing-benefit-icon">${icon(symbol,24)}</span><h2>${title}</h2><p>${copy}</p></article>`).join('')}
    </section>
    <section class="landing-topics" aria-labelledby="landing-topics-title">
      <div class="landing-section-copy"><h2 id="landing-topics-title">${t('Start with something you’ll use.', 'Начни с того, что пригодится.', 'Өзіңе қажет нәрседен баста.')}</h2><p>${t('One small lesson can change how you approach an everyday task.', 'Один небольшой урок — новый способ решить привычную задачу.', 'Бір шағын сабақ — күнделікті тапсырманы шешудің жаңа тәсілі.')}</p></div>
      <div class="landing-topic-grid">
        <button type="button" data-course="budget" data-course-path><span class="landing-topic-icon topic-green">${icon('sheet',30)}</span><strong>${t('Make numbers work for you','Разберись с таблицами','Кестелерді меңгер')}</strong><span>${t('Build a budget and use your first formula.','Собери бюджет и примени первую формулу.','Бюджет құрып, алғашқы формулаңды қолдан.')}</span>${icon('arrow',20)}</button>
        <button type="button" data-starter-course="ai-prompts" data-starter-minutes="10"><span class="landing-topic-icon topic-purple">${icon('message',30)}</span><strong>${t('Ask AI a better question','Задай ИИ понятный вопрос','ЖИ-ге түсінікті сұрау жаз')}</strong><span>${t('Turn an unclear request into a useful instruction.','Преврати размытый запрос в точную инструкцию.','Жалпы сұрауды нақты нұсқауға айналдыр.')}</span>${icon('arrow',20)}</button>
        <button type="button" data-course="design" data-course-path><span class="landing-topic-icon topic-orange">${icon('palette',30)}</span><strong>${t('Make your first poster','Создай первый постер','Алғашқы постеріңді жаса')}</strong><span>${t('Give your idea a clear visual message.','Выдели главное и передай свою идею.','Ең маңыздысын бөліп, ойыңды жеткіз.')}</span>${icon('arrow',20)}</button>
      </div>
    </section>
    <section class="landing-closing"><div><h2>${t('A little time. A step forward.', 'Немного времени. Шаг вперёд.', 'Аз ғана уақыт. Алға бір қадам.')}</h2><p>${t('Choose a goal. We’ll take it from there.', 'Выбери цель. Дальше разберёмся вместе.', 'Мақсатыңды таңда. Әрі қарай бірге үйренеміз.')}</p></div><button type="button" class="primary" data-view="new-course">${t('Let’s begin','Начнём','Бастайық')}${icon('arrow',20)}</button></section>
    <footer class="landing-footer"><span>mindora.</span><button type="button" class="text-link" data-action="about">${t('About Mindora','О Mindora','Mindora туралы')}${icon('arrow',16)}</button></footer>
  </div>`;
}
