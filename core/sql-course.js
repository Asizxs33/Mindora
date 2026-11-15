import { PLAN_DURATIONS, restorePlan } from './learning-plan.js';
import { queryTable } from './studio-practice.js';

export const sqlCard = {
  id: 'sql-tables', mentor: 'sam', topic: 'programming', icon: 'code',
  title: ['Your first SQL report', 'Первый отчёт на SQL', 'SQL тіліндегі алғашқы есеп'],
  description: ['Query a sales table and see the rows change.', 'Сделай запрос к таблице продаж и проверь результат.', 'Сатылым кестесіне сұраныс жазып, нәтижесін тексер.'],
};

export function sqlCourse(language, minutes, lang) {
  const copy = (en, ru, kk) => [en, ru, kk][lang];
  const items = copy(['Tea','Milk','Bread'], ['Чай','Молоко','Хлеб'], ['Шай','Сүт','Нан']);
  const columns = ['item','units','price'];
  const data = { type:'sql', table:'sales', columns, rows:items.map((item,i) => [item,[4,8,3][i],[2,3,5][i]]) };
  const durations = PLAN_DURATIONS[minutes];
  const lessons = [
    {
      title:copy('Pick a column','Выбери столбец','Бағанды таңда'),
      instruction:copy('SELECT names the columns you want to see. FROM names the table that holds them.', 'После SELECT напиши нужные столбцы, а после FROM — название таблицы.', 'SELECT сөзінен кейін қажетті бағандарды, FROM сөзінен кейін кесте атауын жаз.'),
      task:copy('Return only the units column from sales.', 'Выведи из sales только столбец units.', 'sales кестесінен тек units бағанын шығар.'),
      explanation:copy('The result contains one column and keeps all three products.', 'В результате один столбец и все три товара.', 'Нәтижеде бір баған мен үш тауар қалды.'),
      takeaway:copy('Use * to inspect all columns before picking the one you need.', 'Чтобы увидеть все столбцы перед выбором, используй *.', 'Бағанды таңдамас бұрын барлығын көру үшін * белгісін қолдан.'),
      query:'SELECT item FROM sales', target:'SELECT units FROM sales',
      gap:['SELECT item ', ' sales'], accepted:'FROM',
    },
    {
      title:copy('Two columns side by side','Два столбца рядом','Екі баған қатар'),
      instruction:copy('Separate column names with a comma. Their order in SELECT determines the order of the result.', 'Разделяй имена столбцов запятой. Их порядок в SELECT задаёт порядок в результате.', 'Баған атауларын үтірмен ажырат. SELECT ішіндегі рет нәтижедегі бағандардың ретін анықтайды.'),
      task:copy('Show price first, then item, for every sale.', 'Для каждой продажи выведи сначала price, затем item.', 'Әр сатылым бойынша алдымен price, одан кейін item бағанын шығар.'),
      explanation:copy('Product names appear on the left because item came first in the query.', 'Названия товаров слева: в запросе первым указан item.', 'Тауар атауы сол жақта тұр, өйткені сұраныста item бірінші жазылған.'),
      takeaway:copy('Change the column order to put the most important value first.', 'Поставь самый важный для читателя столбец первым.', 'Есепті оқитын адамға ең маңызды бағанды бірінші қой.'),
      query:'SELECT item, units FROM sales', target:'SELECT price, item FROM sales',
      gap:['SELECT item', ' units FROM sales'], accepted:',',
    },
    {
      title:copy('Filter the rows','Отбери строки','Жолдарды сүз'),
      instruction:copy('WHERE keeps only rows that match a condition. Use > for greater than and >= to include equality.', 'WHERE оставляет строки, которые подходят под условие. Знак > означает «больше», а >= включает равенство.', 'WHERE шартқа сәйкес жолдарды қалдырады. > белгісі «үлкен», ал >= белгісі «үлкен немесе тең» дегенді білдіреді.'),
      task:copy('Return item for rows with at least 4 units.', 'Выведи item для строк, где units не меньше 4.', 'units кемінде 4 болатын жолдардың item бағанын шығар.'),
      explanation:copy('One product has eight units. The row with exactly four is excluded by >.', 'У одного товара восемь штук. Строка с четырьмя штуками не проходит условие >.', 'Бір тауар саны сегізге тең. Саны төрт болатын жол > шартынан өтпейді.'),
      takeaway:copy('Check the boundary value when filtering a report.', 'При отборе строк проверь число на границе диапазона.', 'Жолдарды сүзгенде шекарадағы мәнді тексер.'),
      query:'SELECT item FROM sales WHERE units > 4', target:'SELECT item FROM sales WHERE units >= 4',
      gap:['SELECT item FROM sales ', ' units > 4'], accepted:'WHERE',
    },
  ];
  const project = copy('Prepare the handoff', 'Подготовь отчёт', 'Есепті дайында');
  const finalTask = minutes === 5
    ? copy('Your teammate needs only the prices. Show the price column from sales.', 'Коллеге нужны только цены. Выведи столбец price из sales.', 'Әріптесіңе тек бағалар қажет. sales кестесінің price бағанын шығар.')
    : minutes === 10 ? copy('Prepare a report with units first and price second for every row.', 'Сделай отчёт для всех строк со столбцами units, затем price.', 'Барлық жолдардан алдымен units, содан соң price бағанын шығарып, есеп жаса.')
    : copy('Prepare item and price for sales with fewer than 6 units.', 'Выведи item и price для продаж, где units меньше 6.', 'units мәні 6-дан кіші сатылымдардың item және price бағандарын шығар.');
  const finalTarget = { 5:'SELECT price FROM sales', 10:'SELECT units, price FROM sales', 20:'SELECT item, price FROM sales WHERE units < 6' }[minutes];
  const source = { url: 'https://www.postgresql.org/docs/current/tutorial-select.html', title:'PostgreSQL · SELECT', images:[] };
  const steps = durations.map((_, i) => {
    if (i === durations.length-1) return { title:project, instruction:finalTask, task:finalTask, criterion:finalTask, practice:{ ...data, rows:items.map((v,j)=>[v,[2,6,5][j],[8,4,3][j]]), target:finalTarget } };
    const lesson = lessons[i], result = queryTable(data, lesson.query);
    return {
      title:lesson.title, instruction:lesson.instruction, task:lesson.task, criterion:lesson.task, practice:{ ...data, target:lesson.target }, resource:source,
      teaching:{ why:sqlCard.description[lang], example:{
        input:lesson.query, output:[result.columns.join(' | '), ...result.rows.map(row => row.join(' | '))].join('\n'),
        explanation:lesson.explanation, visual:{ type:'table', label:'sales', columns, rows:data.rows },
      }, assessment:{ type:'gap-fill', question:copy('Complete this query.', 'Дополни запрос.', 'Сұранысты толықтыр.'), before:lesson.gap[0], after:lesson.gap[1], accepted:[...new Set([lesson.accepted, lesson.accepted.toLowerCase(), lesson.accepted[0] + lesson.accepted.slice(1).toLowerCase()])], explanation:lesson.instruction }, takeaway:lesson.takeaway },
    };
  });
  return restorePlan({ plan:{ formatVersion:3, language, minutes, title:sqlCard.title[lang], goal:sqlCard.title[lang], outcome:sqlCard.description[lang], steps }, completed:0, answers:steps.map(()=>''), reviews:steps.map(()=>null), study:[] });
}
