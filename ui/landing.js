import { languagePicker, t } from './language.js';
import { icon } from './icons.js';
import { priceLine, reportEntry, workHeadline } from './work-skills.js';

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

function startButton(text, canResume) {
  if (canResume) return `<a class="primary landing-start" href="/">${text}</a>`;
  return `<button type="button" class="primary landing-start" data-view="new-course">${text}</button>`;
}

export function landingView({ canResume = false, signedIn = false } = {}) {
  const start = canResume ? t('Continue learning', 'Продолжить обучение', 'Оқуды жалғастыру')
    : t('Build my free course', 'Создать бесплатный курс', 'Тегін курсымды құру');
  const courses = t('Mini-courses', 'Мини-курсы', 'Шағын курстар');
  const method = t('How it works', 'Как это работает', 'Қалай жұмыс істейді');
  const signIn = t('I already have an account', 'У меня уже есть аккаунт', 'Менде аккаунт бар');
  const steps = [
    ['book', t('Study an example', 'Разбери пример', 'Мысалды талда'), t('See how to use the idea in a real task.', 'Посмотри, как применить идею в реальной задаче.', 'Идеяны нақты тапсырмада қалай қолдануға болатынын көр.')],
    ['target', t('Check your understanding', 'Проверь себя', 'Өзіңді тексер'), t('Try a short exercise and get feedback on your answer.', 'Реши короткое упражнение и получи разбор ответа.', 'Қысқа жаттығу орындап, жауабыңа кері байланыс ал.')],
    ['edit', t('Make it your own', 'Сделай что-то своё', 'Өз жұмысыңды жаса'), t('Design a poster, write a short program, or try a different project.', 'Сделай постер, напиши короткую программу или попробуй другой проект.', 'Постер жаса, шағын бағдарлама жаз немесе басқа жобаны байқап көр.')],
  ];
  return `<div class="mindora-landing" id="landing-top" data-guided-step="0">
    <header class="landing-header">
      <div class="landing-container landing-header-inner">
        <a class="brand landing-brand" href="#landing-top" aria-label="Mindora"><img class="brand-mark" src="${brand}" width="40" height="40" alt=""><span class="brand-wordmark">mindora<span aria-hidden="true">.</span></span></a>
        <div class="landing-language">${languagePicker()}</div>
      </div>
    </header>
    <section class="landing-container landing-hero" aria-labelledby="landing-title">
      <div class="landing-hero-art">
        <img class="landing-mascot" src="${hero}" width="880" height="880" alt="${t('Mino the capybara holds a map surrounded by coding, drawing, and conversation tools', 'Мино держит карту, вокруг него символы кода, рисования и общения', 'Мино карта ұстап тұр, айналасында код, сурет және әңгіме белгілері бар')}" fetchpriority="high">
      </div>
      <div class="landing-hero-copy">
        <h1 id="landing-title">${workHeadline()}</h1>
        <p class="landing-intro">${t('Have five minutes between work and family? Practise a task like your weekly report. Pick up where you stopped next time.', 'Есть пять минут между работой и семейными делами? Попрактикуйся на задаче вроде недельного отчёта. В следующий раз продолжишь с того же места.', 'Жұмыс пен отбасы арасында бес минут табылды ма? Апталық есеп сияқты өзіңе керек тапсырманы орында. Келесі жолы тоқтаған жеріңнен жалғастырасың.')}</p>
        <div class="landing-actions">${startButton(start, canResume)}${signedIn ? '' : `<button type="button" class="secondary landing-signin" data-account-open="signin">${signIn}</button>`}</div>
      </div>
    </section>
    <section class="landing-topics" id="landing-topics" aria-labelledby="landing-topics-title">
      <div class="landing-container landing-topics-inner">
        <h2 id="landing-topics-title" class="visually-hidden">${courses}</h2>
        <ul>${topics().map(([name, label, action]) => `<li><button type="button" ${action}><img src="${cover(name)}" alt="" width="40" height="40" loading="lazy"><span>${label}</span></button></li>`).join('')}</ul>
      </div>
    </section>
    <section class="landing-route" id="landing-method" aria-labelledby="landing-route-title">
      <div class="landing-container landing-route-inner">
        <div class="landing-route-copy">
          <h2 id="landing-route-title">${t('A path that fits your day.', 'Учебный путь в твоём темпе.', 'Өз қарқыныңа сай оқу жолы.')}</h2>
          <p>${t('Tell Mindora what you want to learn. Get a path from your first lesson to a project you can finish on your own.', 'Расскажи, чему хочешь научиться. Mindora построит путь от первого урока до проекта, который ты сделаешь сам.', 'Не үйренгің келетінін айт. Mindora алғашқы сабақтан өзің аяқтайтын жобаға дейінгі оқу жолын құрады.')}</p>
          <ul class="landing-pace-list" aria-label="${t('Lesson lengths', 'Длительность занятий', 'Сабақ ұзақтығы')}">${[5, 10, 20].map(minutes => `<li>${icon('clock', 15)} ${t(`${minutes} min`, `${minutes} мин`, `${minutes} мин`)}</li>`).join('')}</ul>
        </div>
        <img class="landing-route-art" src="${media('landing/mino-learning-path.webp')}" width="900" height="600" alt="${t('Mino on a path with a lesson, a check mark and a trophy', 'Мино на пути со значками урока, галочкой и кубком', 'Мино сабақ, белгі және кубок бейнеленген оқу жолында')}" loading="lazy" decoding="async">
      </div>
    </section>
    <section class="landing-container landing-method" id="landing-practice" aria-labelledby="landing-method-title">
      <div class="landing-method-copy">
        <h2 id="landing-method-title">${t('Put each lesson to work.', 'Применяй знания сразу.', 'Үйренгеніңді бірден қолдан.')}</h2>
        <ol>${steps.map(([symbol, title, text]) => `<li><span class="landing-method-icon">${icon(symbol, 22)}</span><div><h3>${title}</h3><p>${text}</p></div></li>`).join('')}</ol>
      </div>
      <img class="landing-workshop" src="${media('landing/mino-workshop.webp')}" width="780" height="520" alt="${t('Mino draws a poster at a desk with a laptop and books', 'Мино рисует постер за столом с ноутбуком и книгами', 'Мино ноутбук пен кітаптар тұрған үстелде постер салып отыр')}" loading="lazy" decoding="async">
    </section>
    <section class="landing-finish" aria-labelledby="landing-finish-title"><div class="landing-container landing-finish-inner">
      <img src="${media('landing/mino-ready.webp')}" width="440" height="550" alt="" decoding="async" loading="lazy">
      <div><h2 id="landing-finish-title">${t('What will you learn first?', 'Чему научишься первым делом?', 'Алдымен нені үйренесің?')}</h2>${startButton(start, canResume)}<p class="course-price-note">${priceLine()}</p>${reportEntry()}</div>
    </div></section>
    <footer class="landing-container landing-footer">
      <a class="brand" href="#landing-top" aria-label="Mindora"><img src="${brand}" width="32" height="32" alt=""><span class="brand-wordmark">mindora<span aria-hidden="true">.</span></span></a>
      <nav class="landing-nav" aria-label="${t('Explore Mindora', 'О Mindora', 'Mindora туралы')}"><a href="#landing-topics">${courses}</a><a href="#landing-method">${method}</a></nav>
      ${signedIn ? '' : `<button class="text-link" type="button" data-account-open="signin">${t('Sign in', 'Войти', 'Кіру')}</button>`}
    </footer>
  </div>`;
}
