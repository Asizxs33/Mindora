import { languageCode } from './language.js';
import { PLAN_DURATIONS, restorePlan } from './learning-plan.js';

// Examples of the same tool contract used by generated lessons, not a separate
// demo player. Answers, feedback and resume use the normal course controller.
const definitions = {
  'capy-code': {
    mentor: 'sam', topic: 'programming', icon: 'code', source: 'https://developer.mozilla.org/en-US/docs/Glossary/Algorithm',
    title: ['Code a path for Mino', 'Управляй Мино с помощью кода', 'Миноны кодпен басқар'],
    description: ['Write instructions and watch Mino follow them.', 'Пиши команды и наблюдай за движением Мино.', 'Команда жазып, Миноның қозғалысын бақыла.'],
    instruction: ['An algorithm is a sequence of precise instructions. forward(n) moves n cells in the current direction. left() and right() turn a quarter turn. repeat(n) { ... } repeats a group. Mino starts facing right. Walls cannot be crossed.', 'Алгоритм — последовательность точных команд. forward(n) проходит n клеток. left() и right() поворачивают на четверть оборота. repeat(n) { ... } повторяет группу. Мино начинает вправо и не проходит через стены.', 'Алгоритм — нақты командалар тізбегі. forward(n) бағыты бойынша n ұяшық жүреді. left() пен right() ширек бұрылыс жасайды. repeat(n) { ... } топты қайталайды. Мино оңға қарап бастайды, қабырғадан өте алмайды.'],
    input: 'forward(3)\nleft()\nforward(3)', output: '(0,3) → (3,3) → (3,0)',
    question: ['What does left() change?', 'Что меняет left()?', 'left() нені өзгертеді?'],
    options: [['The direction Mino faces', 'The number of cells in the board', 'The flag position'], ['Направление Мино', 'Число клеток на поле', 'Положение флага'], ['Миноның бағытын', 'Алаңдағы ұяшық санын', 'Жалаудың орнын']],
    explanation: ['Turning changes direction without moving to another cell.', 'Поворот меняет направление, но не клетку.', 'Бұрылу бағытты өзгертеді, бірақ ұяшықты ауыстырмайды.'],
    tasks: [
      ['Reach the flag in the top-right corner. Run your instructions, then explain one turn.', 'Дойди до флага справа вверху. Запусти команды и объясни один поворот.', 'Жоғарғы оң жақтағы жалауға жет. Командаларды орындап, бір бұрылысты түсіндір.'],
      ['Reach the same flag using repeat to express repeated forward steps.', 'Дойди до того же флага, используя repeat для повторяющихся шагов.', 'Қайталанатын қадамдарға repeat қолданып, сол жалауға жет.'],
      ['The flag moved to the top-left corner. Write a new route and explain why it works.', 'Флаг теперь слева вверху. Напиши новый маршрут и объясни его.', 'Жалау енді жоғарғы сол жақта. Жаңа жол жазып, оны түсіндір.'],
    ],
    practice: final => ({ type: 'code', language: 'capy', challenge: final ? 'north' : 'path', starter: 'forward(1)' }),
  },
  'drawing-studio': {
    mentor: 'artist', topic: 'art', icon: 'palette', source: 'https://www.tate.org.uk/art/art-terms/d/drawing',
    title: ['Build a drawing from shapes', 'Собери рисунок из простых форм', 'Пішіндерден сурет құрастыр'],
    description: ['Draw with a brush, lines, rectangles and circles.', 'Рисуй кистью, линиями, прямоугольниками и кругами.', 'Қылқалам, сызық, тіктөртбұрыш пен шеңберді қолдан.'],
    instruction: ['Break a complex subject into simple shapes. A rectangle can form a house, two diagonal lines a roof, and a circle a sun. Choose a tool, drag on the canvas, then add detail with the brush. Keep the main subject recognizable.', 'Разложи сложный предмет на простые формы. Прямоугольник станет домом, две наклонные линии — крышей, круг — солнцем. Выбери инструмент, проведи по холсту, затем добавь детали кистью.', 'Күрделі нысанды қарапайым пішіндерге бөл. Тіктөртбұрыш — үй, екі қиғаш сызық — шатыр, шеңбер — күн. Құралды таңдап, кенепке сал, кейін қылқаламмен бөлшектер қос.'],
    input: '▭ + △ + ○', output: 'House + roof + sun',
    question: ['Which tool draws the body of a house in one gesture?', 'Каким инструментом можно одним движением нарисовать основу дома?', 'Үйдің негізін бір қимылмен қай құралмен салуға болады?'],
    options: [['Rectangle', 'Undo', 'Color picker'], ['Прямоугольник', 'Отменить', 'Выбор цвета'], ['Тіктөртбұрыш', 'Қайтару', 'Түсті таңдау']],
    explanation: ['A rectangle provides a clear main shape; details can come later.', 'Прямоугольник задаёт основную форму. Детали можно добавить позже.', 'Тіктөртбұрыш негізгі пішінді береді. Бөлшектерді кейін қосуға болады.'],
    tasks: [
      ['Draw a house using a rectangle, a roof and at least one detail. Explain your main shape.', 'Нарисуй дом: прямоугольная основа, крыша и хотя бы одна деталь. Объясни выбор основной формы.', 'Үй сал: тіктөртбұрыш негіз, шатыр және кемінде бір бөлшек. Негізгі пішінді түсіндір.'],
      ['Add a foreground object and use a different color to make it stand out.', 'Добавь предмет на переднем плане и выдели его другим цветом.', 'Алдыңғы көрініске нысан қосып, оны басқа түспен ерекшеле.'],
      ['Draw a different scene: a tree and the sun. Build the tree from a line and a circle. Explain what makes it recognizable.', 'Нарисуй другую сцену: дерево и солнце. Собери дерево из линии и круга. Объясни, как его можно узнать.', 'Басқа көрініс сал: ағаш пен күн. Ағашты сызық пен шеңберден құрастыр. Оның қалай танылатынын түсіндір.'],
    ],
    practice: () => ({ type: 'drawing' }),
  },
  'logarithm-lab': {
    mentor: 'sam', topic: 'math', icon: 'chart', source: 'https://openstax.org/books/algebra-and-trigonometry-2e/pages/6-3-logarithmic-functions',
    title: ['See how logarithms work', 'Логарифмы на графике', 'Логарифмді графиктен түсіну'],
    description: ['Move a point and connect powers to logarithms.', 'Двигай точку и свяжи степени с логарифмами.', 'Нүктені қозғап, дәреже мен логарифмді байланыстыр.'],
    instruction: ['A logarithm asks for an exponent: log_b(x) = y means b^y = x. For example, log_2(8) = 3 because 2^3 = 8. For real logarithms, the base is positive and not 1, and x is positive. In the explorer, change the base and exponent and compare the equation with the point.', 'Логарифм ищет показатель степени: log_b(x) = y означает b^y = x. Например, log_2(8) = 3, потому что 2^3 = 8. Основание положительно и не равно 1, аргумент положителен. Меняй параметры и сравнивай уравнение с точкой.', 'Логарифм дәреже көрсеткішін табады: log_b(x) = y дегеніміз b^y = x. Мысалы, log_2(8) = 3, себебі 2^3 = 8. Негіз оң, 1-ге тең емес; аргумент оң болуы керек. Параметрлерді өзгертіп, теңдеуді нүктемен салыстыр.'],
    input: '2³ = 8', output: 'log₂(8) = 3',
    question: ['What is log₂(8)?', 'Чему равен log₂(8)?', 'log₂(8) неге тең?'],
    options: [['3', '4', '8'], ['3', '4', '8'], ['3', '4', '8']],
    explanation: ['2 × 2 × 2 = 8, so the exponent is 3.', '2 × 2 × 2 = 8, значит показатель равен 3.', '2 × 2 × 2 = 8, сондықтан дәреже көрсеткіші 3.'],
    tasks: [
      ['Explore base 2. Calculate log₂(4) and show the corresponding power.', 'Исследуй основание 2. Вычисли log₂(4) и запиши соответствующую степень.', '2 негізін зертте. log₂(4) мәнін есептеп, сәйкес дәрежені жаз.'],
      ['Calculate log₄(16). Verify your answer by writing a power.', 'Вычисли log₄(16). Проверь ответ записью степени.', 'log₄(16) мәнін есепте. Жауапты дәреже арқылы тексер.'],
      ['Now change the base: calculate log₃(27) and justify your answer with an exponential equation.', 'Теперь смени основание: вычисли log₃(27) и обоснуй ответ уравнением со степенью.', 'Енді негізді өзгерт: log₃(27) мәнін есептеп, жауабыңды дәрежелі теңдеумен түсіндір.'],
    ],
    practice: () => ({ type: 'calculation', visual: 'logarithm' }),
  },
};
const languages = { en: 0, ru: 1, kk: 2 };

export function labCourseCards(language, minutes) {
  const lang = languages[languageCode(language)];
  return Object.entries(definitions).map(([id, d]) => ({ id, title: d.title[lang], description: d.description[lang], minutes, durations: [5, 10, 20], stepCount: PLAN_DURATIONS[minutes].length, mentor: d.mentor, topic: d.topic, icon: d.icon }));
}

export function getLabCourse(id, language, minutes) {
  const d = Object.hasOwn(definitions, id) && definitions[id];
  if (!d || !Number.isInteger(minutes) || !PLAN_DURATIONS[minutes]) return null;
  const code = languageCode(language), lang = languages[code], count = PLAN_DURATIONS[minutes].length;
  const steps = Array.from({ length: count }, (_, index) => {
    const final = index === count - 1;
    const extra = {
      'capy-code': ['Debug forward(4), which hits the board edge. Replace it with a safe route and explain the correction.', 'Исправь forward(4): эта команда выходит за край поля. Напиши безопасный маршрут и объясни исправление.', 'forward(4) алаң шетінен шығады. Қауіпсіз жол жазып, түзетуді түсіндір.'],
      'drawing-studio': ['Draw a large circle and two smaller shapes. Use their sizes to make the circle the focus.', 'Нарисуй большой круг и две маленькие формы. Размером выдели главный объект.', 'Үлкен шеңбер мен екі кішкентай пішін сал. Өлшем арқылы негізгі нысанды ерекшеле.'],
      'logarithm-lab': ['Calculate log₂(1). Explain why any valid base to power zero gives one.', 'Вычисли log₂(1). Объясни, почему нулевая степень допустимого основания равна единице.', 'log₂(1) мәнін есепте. Жарамды негіздің нөлінші дәрежесі неге бірге тең екенін түсіндір.'],
    };
    let task = final ? d.tasks[2][lang] : index === 2 ? extra[id][lang] : d.tasks[index][lang];
    if (final && minutes > 5) task += ' ' + (minutes === 10
      ? ['Also explain one possible mistake and how to fix it.', 'Также объясни одну возможную ошибку и её исправление.', 'Сондай-ақ бір ықтимал қате мен оны түзетуді түсіндір.']
      : ['Compare two ways to solve the task. Explain your choice and verify the result.', 'Сравни два способа выполнения. Объясни свой выбор и проверь результат.', 'Орындаудың екі жолын салыстыр. Таңдауыңды түсіндіріп, нәтижені тексер.'])[lang];
    const examples = { 'capy-code': ['forward(3)\nleft()\nforward(3)', 'repeat(3) { forward(1) }', 'forward(4) → blocked'], 'drawing-studio': ['▭ + △ + ○', 'Large circle + small rectangle', 'Large circle + two small shapes'], 'logarithm-lab': ['2³ = 8', '4² = 16', '2⁰ = 1'] };
    return { title: `${index + 1}. ${d.title[lang]}`, instruction: index === 0 ? d.instruction[lang] : task, task,
      criterion: task, practice: d.practice(final),
      ...(!final ? { resource: { url: d.source, title: d.title[lang], images: [] }, teaching: {
        why: d.description[lang], example: { input: examples[id][index], output: id === 'logarithm-lab' ? ['log₂(8) = 3', 'log₄(16) = 2', 'log₂(1) = 0'][index] : d.output, explanation: index === 0 ? d.explanation[lang] : task },
        assessment: { type: 'choice', question: d.question[lang], options: d.options[lang], answer: 0, explanation: d.explanation[lang] }, takeaway: d.explanation[lang],
      } } : {}),
    };
  });
  return restorePlan({ plan: { formatVersion: 3, language: code, minutes, title: d.title[lang], goal: d.title[lang], outcome: d.description[lang], steps }, completed: 0, answers: Array(count).fill(''), reviews: Array(count).fill(null), study: [] });
}
