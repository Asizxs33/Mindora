import { languagePicker, t } from './language.js';
import { icon } from './icons.js';

const media = name => new URL(`./assets/${name}`, import.meta.url).href;
const brand = new URL('./assets/brand-mark.svg', import.meta.url).href;
const cover = name => new URL(`./assets/design-pack/course-${name}.png`, import.meta.url).href;
const hero = media('landing/mino-welcome.webp');

const topics = () => [
  ['python', t('Python', 'Python', 'Python'), 'data-starter-course="python-basics"'],
  ['everyday-english', t('English', 'Английский', 'Ағылшын тілі'), 'data-starter-course="everyday-english"'],
  ['graphic-design', t('Design', 'Дизайн', 'Дизайн'), 'data-course="design" data-course-path'],
  ['spreadsheets', t('Spreadsheets', 'Таблицы', 'Кестелер'), 'data-course="budget" data-course-path'],
  ['ai-literacy', t('AI prompts', 'Запросы к ИИ', 'ЖИ-ге сұрау'), 'data-starter-course="ai-prompts"'],
  ['copywriting', t('Clear writing', 'Ясные тексты', 'Анық мәтін'), 'data-starter-course="clear-writing"'],
];

function startButton(text) {
  return `<button type="button" class="primary landing-start" data-view="new-course">${text}</button>`;
}

export function landingView() {
  const start = t('Start learning', 'Начать обучение', 'Оқуды бастау');
  const courses = t('Mini-courses', 'Мини-курсы', 'Шағын курстар');
  const method = t('How it works', 'Как это работает', 'Қалай жұмыс істейді');
  const signIn = t('I already have an account', 'У меня уже есть аккаунт', 'Менде аккаунт бар');
  const steps = [
    ['flag', t('Choose a goal', 'Выбери цель', 'Мақсатыңды таңда'), t('Tell Mindora what you want to be able to do.', 'Расскажи Mindora, что хочешь научиться делать.', 'Mindora-ға не істеуді үйренгің келетінін айт.')],
    ['clock', t('Find your pace', 'Выбери темп', 'Қарқыныңды таңда'), t('Make room for a 5, 10 or 20 minute lesson.', 'Выдели на занятие 5, 10 или 20 минут.', 'Сабаққа 5, 10 немесе 20 минут бөл.')],
    ['target', t('Try it yourself', 'Попробуй сам', 'Өзің байқап көр'), t('See an example, do an exercise, and build something of your own.', 'Разбери пример, выполни упражнение и сделай что-то своё.', 'Мысалды талда, жаттығу орында және өз жұмысыңды жаса.')],
  ];
  return `<div class="mindora-landing" data-guided-step="0">
    <header class="landing-header">
      <div class="landing-container landing-header-inner">
        <a class="brand landing-brand" href="#discover" data-home aria-label="Mindora"><img src="${brand}" width="42" height="42" alt=""><span class="brand-wordmark">mindora<span aria-hidden="true">.</span></span></a>
        <div class="landing-language">${languagePicker()}</div>
      </div>
    </header>
    <section class="landing-container landing-hero" aria-labelledby="landing-title">
      <div class="landing-hero-art">
        <img class="landing-mascot" src="${hero}" width="720" height="900" alt="${t('Mino the capybara waves and holds a map', 'Капибара Мино машет лапой и держит карту', 'Капибара Мино қол бұлғап, карта ұстап тұр')}" fetchpriority="high">
      </div>
      <div class="landing-hero-copy">
        <h1 id="landing-title">${t('Learn a new skill in a few minutes a day.', 'Осваивай новые навыки за несколько минут в день.', 'Күніне бірнеше минутта жаңа дағды үйрен.')}</h1>
        <div class="landing-actions">${startButton(start)}<button type="button" class="secondary landing-signin" data-account-open="signin">${signIn}</button></div>
      </div>
    </section>
    <section class="landing-topics" id="landing-topics" aria-labelledby="landing-topics-title">
      <div class="landing-container landing-topics-inner">
        <h2 id="landing-topics-title" class="visually-hidden">${courses}</h2>
        <ul>${topics().map(([name, label, action]) => `<li><button type="button" ${action}><img src="${cover(name)}" alt="" width="40" height="40" loading="lazy"><span>${label}</span></button></li>`).join('')}</ul>
      </div>
    </section>
    <section class="landing-container landing-method" id="landing-method" aria-labelledby="landing-method-title">
      <div class="landing-method-copy">
        <h2 id="landing-method-title">${t('A little practice every day.', 'Немного практики каждый день.', 'Күн сайын аздап жаттық.')}</h2>
        <p>${t('Pick a skill and Mindora will build a path with short lessons, examples and practice.', 'Выбери навык. Mindora соберёт путь из коротких уроков, примеров и практики.', 'Дағдыны таңда. Mindora қысқа сабақтар, мысалдар мен жаттығулардан оқу жолын құрады.')}</p>
        <ol>${steps.map(([symbol, title, text]) => `<li><span class="landing-method-icon">${icon(symbol, 22)}</span><div><h3>${title}</h3><p>${text}</p></div></li>`).join('')}</ol>
      </div>
      <img class="landing-workshop" src="${media('landing/mino-workshop.webp')}" width="780" height="520" alt="${t('Mino draws a poster at a desk with a laptop and books', 'Мино рисует постер за столом с ноутбуком и книгами', 'Мино ноутбук пен кітаптар тұрған үстелде постер салып отыр')}" loading="lazy" decoding="async">
    </section>
    <section class="landing-finish" aria-labelledby="landing-finish-title"><div class="landing-container landing-finish-inner">
      <img src="${media('landing/mino-ready.webp')}" width="440" height="550" alt="" decoding="async" loading="lazy">
      <div><h2 id="landing-finish-title">${t('What will you learn first?', 'Чему научишься первым делом?', 'Алдымен нені үйренесің?')}</h2>${startButton(start)}</div>
    </div></section>
    <footer class="landing-container landing-footer">
      <a class="brand" href="#discover" data-home aria-label="Mindora"><img src="${brand}" width="32" height="32" alt=""><span class="brand-wordmark">mindora<span aria-hidden="true">.</span></span></a>
      <nav class="landing-nav" aria-label="${t('Explore Mindora', 'О Mindora', 'Mindora туралы')}"><a href="#landing-topics">${courses}</a><a href="#landing-method">${method}</a></nav>
      <button class="text-link" type="button" data-account-open="signin">${t('Sign in', 'Войти', 'Кіру')}</button>
    </footer>
  </div>`;
}
