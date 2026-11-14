import {COURSES,DESIGN_QUIZ,BUDGET_QUIZ,matchGoal,evaluatePoster,evaluateBudget,makeBudgetChallenge,escapeHtml as esc} from './engine.js';
import { dashboard, coursesPage, brandNav, dayKey, dailyCourse, learningStats, courseNames, lessonNames, pageBanner, sidePage } from './dashboard.js';
import { icon } from './icons.js';

const $=s=>document.querySelector(s);
const KEY='mindora.workspace.v1';
const empty={version:1,minutes:10,active:null,goals:{},progress:{design:0,budget:0},drafts:{},works:{},notes:{},practiceCount:0,studyDays:[]};
function readState(){try{const v=JSON.parse(localStorage.getItem(KEY));if(!v||v.version!==1)return structuredClone(empty);return {...empty,...v,active:['design','budget'].includes(v.active)?v.active:null,minutes:[5,10,20].includes(v.minutes)?v.minutes:10,progress:{design:Math.min(4,Math.max(0,Number(v.progress?.design)||0)),budget:Math.min(4,Math.max(0,Number(v.progress?.budget)||0))},goals:v.goals||{},drafts:v.drafts||{},works:v.works||{},notes:v.notes||{}};}catch{return structuredClone(empty);}}
let state=readState(),view='discover',step=0,quizIndex=0,quizChoice=null,quizFeedback=false,checks=null,challengeSeed=0;
let saveWarning=false;
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch{if(!saveWarning){saveWarning=true;toast('Your browser could not save progress. Keep this tab open.');}}}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('visible'),4200);}
function modal(title,html){$('#modal-content').innerHTML=`<h2 id="modal-title">${esc(title)}</h2>${html}`;if(!$('#modal').open)$('#modal').showModal();}
function go(next){view=next;checks=null;render();window.scrollTo({top:0,behavior:'instant'});$('#main').focus({preventScroll:true});}
function selectCourse(id,goal){if(!COURSES[id])return;state.active=id;state.goals[id]=goal||state.goals[id]||(id==='design'?'Сделать постер для кофейни':'Собрать таблицу ежемесячных расходов');save();go('path');}
function openStep(index){if(!state.active)return go('discover');if(index>state.progress[state.active])return toast('Заверши текущий этап, чтобы открыть следующий.');step=index;quizIndex=0;quizChoice=null;quizFeedback=false;checks=null;go('lesson');}
function finishStep(){const id=state.active;const days = new Set(Array.isArray(state.studyDays) ? state.studyDays : []);days.add(dayKey());state.studyDays = [...days];state.progress[id]=Math.max(state.progress[id],step+1);save();if(step===3){state.practiceCount=(Number(state.practiceCount)||0)+1;save();go('result');}else{toast('Этап завершён. Прогресс сохранён.');go('path');}}
function render() {
  const id = state.active;
  const stats = learningStats(state);
  $('#navigation').innerHTML = brandNav(icon, view, 'side');
  $('#top-navigation').innerHTML = brandNav(icon, view, 'top');
  $('#mobile-navigation').innerHTML = brandNav(icon, view, 'bottom');
  $('#top-actions').innerHTML = `
    <button class="header-icon" data-action="notifications" aria-label="Уведомления">${icon('bell', 23)}</button>
    <span class="mobile-stat streak">${icon('flame', 15)} ${stats.streak} дн.</span>
    <span class="mobile-stat">${icon('zap', 15)} ${stats.xp} XP</span>
    <button class="header-profile" data-view="profile" aria-label="Профиль"><span class="brand-mascot"></span><span>Гость</span>${icon('chevron', 15)}</button>`;
  const main = $('#main');
  main.classList.toggle('dashboard-main', view === 'discover');
  main.classList.toggle('inside-main', view !== 'discover');
  main.dataset.page = view;
  const views = { discover: () => dashboard(state, icon), courses: () => coursesPage(state, icon), path: pathView, lesson, result, work: workView };
  main.innerHTML = views[view] ? views[view]() : sidePage(view, state, icon);
  const titles = { discover: 'Главная', courses: 'Курсы', practice: 'Практика', path: 'Путь обучения', lesson: courseNames[id], result: 'Результат', work: 'Мои работы', achievements: 'Достижения', community: 'Сообщество', profile: 'Профиль' };
  document.title = `${titles[view]} · Mindora`;
}

function emptyView(title,text,button='Выбрать курс'){return `<div class="empty-state"><div class="empty-icon">${icon('path',31)}</div><h2>${title}</h2><p>${text}</p><button class="primary large" data-view="discover">${button}${icon('arrow',16)}</button></div>`;}
function pathView(){if(!state.active)return emptyView('Твой путь начинается здесь','Выбери проект на главной или открой список курсов.','Найти свой путь');const id=state.active,c=COURSES[id],p=state.progress[id];return `<button class="back-button" data-view="courses">${icon('back',14)} Все курсы</button><section class="path-summary"><div class="path-copy"><span class="tag">${icon('spark',12)} ${id === 'design' ? 'Дизайн' : 'Электронные таблицы'}</span><h1>${courseNames[id]}</h1><p>Твоя цель: ${esc(state.goals[id])}</p></div><div class="progress-block"><div class="progress-top"><span>${p} из 4 этапов пройдено</span><strong>${p*25}%</strong></div><div class="progress-bar" role="progressbar" aria-label="Прогресс курса" aria-valuenow="${p*25}" aria-valuemin="0" aria-valuemax="100"><i style="width:${p*25}%"></i></div><button class="primary" data-step="${Math.min(p,3)}">${p===4?'Повторить практику':p?'Продолжить путь':'Начать урок'} ${icon('arrow',14)}</button></div></section><div class="path-layout"><section class="path-steps" aria-label="Четыре этапа обучения">${c.steps.map((s,i)=>`<div class="path-step"><div class="step-dot ${i<p?'done':i===p?'current':''}">${i<p?icon('check',19):i+1}</div><button class="step-card ${i===p?'current':''}" data-step="${i}" ${i>p?'disabled':''}><div><span class="step-type">${['Основы','Проверка знаний','Практика','Самостоятельная работа'][i]} · ${i<2?'Около 3 мин':'В своём темпе'}</span><h3>${lessonNames[id][i]}</h3><p>${esc(s.description)}</p></div><span class="step-arrow">${icon(i>p?'lock':i<p?'check':'arrow',17)}</span></button></div>`).join('')}</section><aside class="path-sidebar"><div class="side-panel"><div class="outcome-icon">${icon(id==='design'?'edit':'layers',37)}</div><h3>Что получится</h3><p>${esc(c.outcome)}</p><div class="mini-stat"><span>Время на день</span><strong>${state.minutes} мин</strong></div><div class="mini-stat"><span>Начальный уровень</span><strong>С нуля</strong></div></div><div class="side-panel"><h3>Полезные материалы</h3><p>Источники для дополнительного чтения.</p>${c.sources.map(s=>`<a class="source-link" href="${s.url}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗<small>Открыть источник</small></a>`).join('')}</div></aside></div><div class="bottom-banner"><div class="banner-icon">${icon('shuffle',18)}</div><div><h3>Готов к новой задаче?</h3><p>Попробуй другой вариант на уже пройденную тему.</p></div><button class="text-link" data-action="mix">Новое задание ${icon('shuffle',14)}</button></div>`;}

function lesson(){const id=state.active,c=COURSES[id];if(!c)return emptyView('Выбери свой первый курс','Начни с проекта, который хочешь сделать сам.');return `<div class="lesson-top"><button class="back-button" data-view="path">${icon('back',14)} Мой путь обучения</button><div class="lesson-steps" aria-label="Этап ${step+1} из 4">${[0,1,2,3].map(i=>`<span class="${i<=step?'on':''}"></span>`).join('')}</div></div><div class="lesson-heading page-banner"><span class="page-mascot mascot-study" aria-hidden="true"></span><div><span class="tag">Step ${step+1} of 4 · ${esc(c.category)}</span><h1>${lessonNames[id][step]}</h1><p>${esc(c.steps[step].description)}</p></div></div>${step===0?learnContent(id):step===1?quizContent(id):practiceContent(id)}`;}
function learnContent(id){return `<section class="lesson-card"><div class="learn-grid"><div><h2>${id==='design'?'С чего начать постер':'Как сложить числа в таблице'}</h2><p>${id==='design'?'Постер привлекает внимание, сообщает важную деталь и подсказывает, что делать дальше.':'Формула связывает значения в ячейках с итогом. Если изменить сумму расхода, итог пересчитается.'}</p><ol class="principle-list">${(id==='design'?[['Выдели главное','Сделай заголовок крупнее остального текста. Так читатель быстрее заметит главное.'],['Позаботься о читаемости','Начни с тёмного текста на светлом фоне. Сильный контраст облегчает чтение.'],['Предложи следующий шаг','Укажи, куда прийти, что попробовать или когда зайти.']]:[['Найди ячейки','Буквы обозначают столбцы, числа — строки. Ячейка B2 находится в столбце B на второй строке.'],['Выбери диапазон','Диапазон B2:B4 включает три ячейки: B2, B3 и B4.'],['Сложи значения','Формула =SUM(B2:B4) складывает числа в этом диапазоне.']]).map(([title,text],i)=>`<li><span class="principle-number">${i+1}</span><div><strong>${title}</strong>${text}</div></li>`).join('')}</ol></div>${id==='design'?`<div class="sample-poster"><div class="sample-flower"></div><div class="poster-label">КОФЕЙНЯ У ДОМА</div><h2>Доброе утро<br>начинается здесь.</h2><p class="sample-copy">Свежий кофе и тёплая компания.</p><div class="sample-cta">Заходи в субботу с 10 до 16</div></div>`:`<div><div class="sheet-example">${sheetTable([48,125,24],false,'197')}</div><div class="hint-box"><strong>=SUM(B2:B4)</strong><br>48 + 125 + 24 = 197. Измени расход, и сумма обновится.</div></div>`}</div><div class="lesson-actions"><p class="small-note">Дальше — три вопроса по уроку.</p><button class="primary large" data-action="finish-learn">Перейти к вопросам ${icon('arrow',16)}</button></div></section>`;}
function quizContent(id){const questions=id==='design'?DESIGN_QUIZ:BUDGET_QUIZ,q=questions[quizIndex],correct=quizChoice===q.correctIndex;return `<section class="lesson-card quiz-layout"><div class="quiz-count">Вопрос ${quizIndex+1} из ${questions.length}</div><h2>${esc(q.question)}</h2><div class="quiz-options">${q.choices.map((text,i)=>`<button class="quiz-option ${quizChoice===i?'selected':''} ${quizFeedback&&quizChoice===i?(correct?'correct':'wrong'):''}" data-choice="${i}" ${quizFeedback&&correct?'disabled':''}><span class="option-letter">${String.fromCharCode(65+i)}</span>${esc(text)}</button>`).join('')}</div>${quizFeedback?`<div class="feedback ${correct?'success':'warning'}"><strong>${correct?'Верно!':'Попробуй другой вариант.'}</strong><br>${esc(q.explanation)}</div>`:''}<div class="lesson-actions"><p class="small-note">Можно попробовать ещё раз.</p><button class="primary" data-action="${quizFeedback&&correct?'next-question':'check-quiz'}" ${quizChoice===null?'disabled':''}>${quizFeedback&&correct?(quizIndex===2?'Завершить этап':'Следующий вопрос'):'Проверить ответ'} ${icon('arrow',14)}</button></div></section>`;}
function draftKey(){return `${state.active}-${step===3?'challenge':'practice'}`;}
function draft(){
  const key=draftKey();let changed=false;
  if(!state.drafts[key]){
    state.drafts[key]=state.active==='design'
      ?{title:'',subtitle:'',cta:'',titleSize:34,subtitleSize:16,textColor:'#263c31',bgColor:'#f7d667'}
      :{values:step===3?makeBudgetChallenge(challengeSeed):[48,125,24],formula:'',answer:''};
    state.drafts[key].seed=step===3?challengeSeed:0;changed=true;
  }
  if(!Number.isInteger(state.drafts[key].seed)||state.drafts[key].seed<0){state.drafts[key].seed=0;changed=true;}
  if(changed)save();
  return state.drafts[key];
}

// Preview and downloaded SVG share exactly the same measured layout.
// Fit each text block inside a fixed region, including single unbroken words.
const posterMeasure=document.createElement('canvas').getContext('2d');
function wrapPosterText(text,size,width,weight){
  if(posterMeasure)posterMeasure.font=`${weight} ${size}px Arial, sans-serif`;
  const measure=value=>posterMeasure?posterMeasure.measureText(value).width:Array.from(value).length*size*.65;
  const words=String(text??'').trim().split(/\s+/).filter(Boolean),lines=[];let line='';
  for(const word of words){
    if(measure(word)>width){
      if(line){lines.push(line);line='';}
      for(const char of Array.from(word)){
        if(line&&measure(line+char)>width){lines.push(line);line=char;}else line+=char;
      }
    }else if(line&&measure(`${line} ${word}`)>width){lines.push(line);line=word;}
    else line=line?`${line} ${word}`:word;
  }
  if(line)lines.push(line);
  return lines;
}
function fitPosterText(text,requestedSize,height,weight,lineSpacing){
  let size=requestedSize,lines=wrapPosterText(text,size,330,weight);
  while(size>6&&lines.length*size*lineSpacing>height){size--;lines=wrapPosterText(text,size,330,weight);}
  return {lines,size,lineHeight:size*lineSpacing,height:lines.length*size*lineSpacing};
}
function posterLayout(p,placeholder=false){
  const titleSize=Math.min(56,Math.max(20,Number(p.titleSize)||34));
  const subtitleSize=Math.min(24,Math.max(10,Number(p.subtitleSize)||16));
  return {
    color:/^#[a-f0-9]{6}$/i.test(p.textColor)?p.textColor:'#263c31',
    bg:/^#[a-f0-9]{6}$/i.test(p.bgColor)?p.bgColor:'#f7d667',
    title:fitPosterText(p.title||(placeholder?'Заголовок постера':''),titleSize,190,800,1.13),
    subtitle:fitPosterText(p.subtitle||(placeholder?'Добавь важную деталь.':''),subtitleSize,78,400,1.45),
    cta:fitPosterText(p.cta||(placeholder?'Подскажи, что делать дальше':''),12,32,700,1.25),
  };
}
function posterSvg(p,placeholder=false){
  const l=posterLayout(p,placeholder);
  const block=(text,top,weight)=>`<text font-size="${text.size}" font-weight="${weight}">${text.lines.map((line,i)=>`<tspan x="35" y="${top+text.size+i*text.lineHeight}">${esc(line)}</tspan>`).join('')}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 400 500" role="img" aria-label="${esc(p.title||'Предпросмотр постера')}"><rect width="400" height="500" fill="${l.bg}"/><circle cx="390" cy="30" r="75" fill="none" stroke="${l.color}" stroke-width="38" opacity=".08"/><g font-family="Arial,sans-serif" fill="${l.color}"><text x="35" y="45" font-size="9" letter-spacing="1">СОЗДАНО В MINDORA</text>${block(l.title,100,800)}${block(l.subtitle,315,400)}${block(l.cta,435,700)}</g></svg>`;
}
function posterHtml(p){return `<div class="poster-preview poster-svg">${posterSvg(p,true)}</div>`;}
const briefs=['Сделай постер для субботнего обмена растениями. Укажи событие, важную деталь и что нужно сделать.','Сделай постер для воскресного обмена книгами. Укажи событие, важную деталь и что нужно сделать.','Сделай постер для пятничного мастер-класса по керамике. Укажи событие, важную деталь и что нужно сделать.'];
function practiceContent(id){const d=draft(),challenge=step===3;return `${challenge?`<div class="hint-box"><strong>Самостоятельное задание</strong><br>${id==='design'?briefs[d.seed%briefs.length]:'Посмотри на новые расходы. Запиши формулу для диапазона B2:B4 и посчитай итог.'}</div>`:''}${id==='design'?`<section class="workspace"><form id="poster-form" class="controls"><label class="field"><span>Заголовок</span><input name="title" maxlength="48" value="${esc(d.title)}" placeholder="Заголовок твоего постера" required></label><label class="field"><span>Детали</span><textarea name="subtitle" maxlength="100" placeholder="Что важно знать читателю?" required>${esc(d.subtitle)}</textarea></label><label class="field"><span>Призыв к действию</span><input name="cta" maxlength="55" value="${esc(d.cta)}" placeholder="Где, когда или что сделать" required></label><label class="field"><span class="range-label">Размер заголовка <output id="title-size">${Number(d.titleSize)||34}px</output></span><input type="range" name="titleSize" min="20" max="56" value="${Number(d.titleSize)||34}"></label><label class="field"><span class="range-label">Размер текста <output id="subtitle-size">${Number(d.subtitleSize)||16}px</output></span><input type="range" name="subtitleSize" min="10" max="24" value="${Number(d.subtitleSize)||16}"></label><div class="field"><span>Цвет фона</span><div class="palette">${[['#f7d667','Жёлтый'],['#e3ecf7','Голубой'],['#d6eadd','Зелёный'],['#f3d9d1','Персиковый']].map(([color,name])=>`<button type="button" class="color-swatch ${d.bgColor===color?'selected':''}" data-color="${color}" aria-label="${name} фон" aria-pressed="${d.bgColor===color}" style="background:${color}"></button>`).join('')}</div></div><label class="field"><span>Цвет текста</span><select name="textColor"><option value="#263c31" ${d.textColor==='#263c31'?'selected':''}>Тёмно-зелёный</option><option value="#243e6a" ${d.textColor==='#243e6a'?'selected':''}>Тёмно-синий</option><option value="#ffffff" ${d.textColor==='#ffffff'?'selected':''}>Белый</option></select></label></form><div class="editor-stage">${posterHtml(d)}<div class="canvas-caption">${icon('edit',11)} Предпросмотр постера</div></div></section>`:budgetEditor(d,challenge)}${!challenge?`<div class="hint-box">${id==='design'?'<strong>Подсказка:</strong> увеличь заголовок хотя бы в 1,5 раза относительно текста. Проверь контраст и добавь призыв к действию.':'<strong>Подсказка:</strong> формула SUM использует первую и последнюю ячейку диапазона. Включи B2, B3 и B4 и посчитай итог.'}</div>`:''}<div id="checks-container">${checks?renderChecks(checks,id):''}</div><div class="lesson-actions"><p class="small-note">${id==='design'?'Проверка оценивает наличие текста, размеры и контраст.':'В упражнении используется формула SUM(B2:B4).'}</p><button class="primary large" data-action="check-work">${checks?.passed?'Сохранить и завершить этап':'Проверить работу'} ${icon(checks?.passed?'check':'arrow',16)}</button></div>`;}
function sheetTable(values,editable=false,total='?'){return `<table class="sheet-table"><thead><tr><th aria-label="Строка"></th><th scope="col">A</th><th scope="col">B</th></tr></thead><tbody><tr class="sheet-heading"><th class="row-num" scope="row">1</th><td>Расход</td><td>Сумма ($)</td></tr>${['Транспорт','Продукты','Подписки'].map((name,i)=>`<tr><th class="row-num" scope="row">${i+2}</th><td>${name}</td><td>${editable?`<input class="formula-input" type="number" min="0" max="1000000" step="0.01" data-expense="${i}" aria-label="${name} — ячейка B${i+2}" value="${Number.isFinite(values[i])?values[i]:''}">`:esc(values[i])}</td></tr>`).join('')}<tr class="total-row"><th class="row-num" scope="row">5</th><td>Итого</td><td class="active-cell">${esc(total)}</td></tr></tbody></table>`;}
function budgetEditor(d,challenge){return `<section class="spreadsheet-wrap"><div class="sheet-toolbar"><span>${icon('layers',18)}</span><strong>${challenge?'Новый месяц':'Моя первая таблица расходов'}</strong><span style="margin-left:auto;background:#f5f7fa;color:#8795a9;font-size:9px">${challenge?'Самостоятельно':'Расходы можно изменить'}</span></div>${sheetTable(d.values,!challenge,checks?.passed?d.values.reduce((a,b)=>a+b,0).toFixed(2):'?')}<div class="budget-answer"><label class="field"><span>Формула в ячейке B5</span><input id="budget-formula" maxlength="50" autocomplete="off" spellcheck="false" placeholder="Введи формулу" value="${esc(d.formula)}"></label><label class="field"><span>Какая получится сумма?</span><input id="budget-answer" type="number" min="0" step="0.01" placeholder="Итоговая сумма" value="${esc(d.answer)}"></label></div><p class="small-note">${challenge?'Реши эту задачу самостоятельно.':'Попробуй изменить расходы. Формула должна охватывать все три ячейки.'}</p></section>`;}
function renderChecks(r,id){return `<section class="check-panel"><h3>${r.passed?'Все проверки пройдены':id==='design'?'Проверка постера':'Проверка формулы'}</h3><div class="checks">${r.checks.map(c=>`<div class="check-row ${c.passed?'pass':''}"><span class="check-symbol">${icon(c.passed ? 'check' : 'close', 14)}</span><div><strong>${esc(c.label)}</strong><p>${esc(c.detail)}</p></div></div>`).join('')}</div>${step===3&&id==='design'?'<p class="small-note" style="margin-top:16px">Перед сохранением сверь содержание постера с заданием.</p>':''}</section>`;}
function result(){const id=state.active;if(!id)return emptyView('Сделай свой проект','Выбери первый курс.');return `<section class="result-screen"><div class="result-mark">${icon('check',40)}</div><span class="tag">Самостоятельное задание завершено</span><span class="result-mascot mascot-cheer" aria-hidden="true"></span><h1 style="margin-top:15px">У тебя получилось!</h1><p>Ты закончил самостоятельное задание и сохранил свою работу.</p><div class="result-card"><h3>Твой результат</h3><p>${id==='design'?'Готовый постер с понятным заголовком, контрастным текстом и призывом к действию.':'Рабочая таблица расходов и практика с ячейками, диапазонами и формулой SUM.'}</p><div class="achievement-row"><div><strong>4 / 4</strong><small>Этапы обучения</small></div><div><strong>1</strong><small>Готовый проект</small></div><div><strong>1</strong><small>Новая задача</small></div></div></div><div class="result-actions"><button class="primary large" data-action="download" data-id="${id}">${icon('download',16)}Скачать ${id==='design'?'постер':'таблицу'}</button><button class="secondary" data-view="work">Мои работы ${icon('arrow',14)}</button></div><p class="small-note">Твоя работа сохранена в этом браузере.</p><button class="text-link" data-action="mix">Попробовать другое задание ${icon('shuffle',14)}</button></section>`;}
function workView(){const entries=Object.entries(state.works).filter(([id])=>COURSES[id]);return `${pageBanner('Мои работы', 'Здесь хранятся твои постеры, таблицы и заметки.')}${!entries.length?emptyView('Создай свой первый проект','Заверши практику, чтобы сохранить постер или таблицу расходов.','Начать проект'):`<div class="stats-strip"><div><strong>${entries.length}</strong><span>Сохранено работ</span></div><div><strong>${Object.values(state.progress).reduce((a,b)=>a+b,0)}</strong><span>Пройдено этапов</span></div><div><strong>${state.practiceCount||0}</strong><span>Решено задач</span></div></div><div class="work-grid">${entries.map(([id,w])=>`<article class="work-item"><div class="work-thumb">${id==='design'?posterHtml(w.data):sheetTable(w.data.values,false,w.data.values.reduce((a,b)=>a+b,0).toFixed(2))}</div><div class="work-item-body"><span class="category">${esc(COURSES[id].category)}</span><h3>${id==='design'?esc(w.data.title):'Моя таблица расходов'}</h3><p>${esc(w.challenge?'Самостоятельная работа':'Практика с подсказками')} · ${new Date(w.savedAt).toLocaleDateString('ru-RU',{month:'short',day:'numeric'})}</p><button class="secondary" data-action="download" data-id="${id}">${icon('download',14)}Скачать ${id==='design'?'SVG':'CSV'}</button><button class="ghost" data-course="${id}">Продолжить обучение</button><label class="field" style="margin-top:18px;margin-bottom:0"><span>Чему ты научился?</span><textarea class="notes-area" data-note="${id}" maxlength="600" placeholder="Запиши то, что хочешь запомнить…">${esc(state.notes[id]||'')}</textarea></label></div></article>`).join('')}</div>`}`;}

function about() {
  modal('Как устроена Mindora', '<p>Выбери цель, пройди урок и потренируйся без подсказок. Готовые проекты появятся в разделе «Мои работы».</p><p>В демоверсии доступны дизайн постера и таблицы расходов. Прогресс сохраняется в этом браузере.</p>');
}
function invalidateCheck(){checks=null;const target=$('#checks-container');if(target)target.innerHTML='';const button=$('[data-action="check-work"]');if(button)button.innerHTML=`Проверить работу ${icon('arrow',16)}`;}
function checkWork(){
  const d=draft();
  if(checks?.passed){state.works[state.active]={data:structuredClone(d),challenge:step===3,savedAt:new Date().toISOString()};finishStep();return;}
  if(state.active==='design'){
    const layout=posterLayout(d);
    checks=evaluatePoster({...d,titleSize:layout.title.size,subtitleSize:layout.subtitle.size});
    checks.checks[1].detail=`На постере заголовок — ${layout.title.size} px, текст — ${layout.subtitle.size} px. Заголовок должен быть как минимум в 1,5 раза крупнее.`;
    checks.checks.push({label:'Текст помещается',passed:layout.title.height<=190&&layout.subtitle.height<=78&&layout.cta.height<=32,detail:'Текст переносится и остаётся в границах макета.'});
    checks.passed=checks.checks.every(check=>check.passed);
  }else checks=evaluateBudget(d,d.values);
  render();$('#checks-container')?.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function mixPractice(){if(!state.active||state.progress[state.active]<2)return toast('Пройди урок и ответь на вопросы, чтобы открыть практику.');challengeSeed=Math.max(challengeSeed,Number(state.drafts[`${state.active}-challenge`]?.seed)||0)+1;if(state.progress[state.active]>=3){step=3;delete state.drafts[`${state.active}-challenge`];}else{step=2;if(state.active==='budget'){state.drafts['budget-practice']={values:makeBudgetChallenge(challengeSeed),formula:'',answer:'',seed:challengeSeed};}else{const d=state.drafts['design-practice'];if(d){d.bgColor=['#f7d667','#e3ecf7','#d6eadd','#f3d9d1'][challengeSeed%4];}}}save();go('lesson');toast('Открыт новый вариант задания.');}
function download(id){const work=state.works[id];if(!work)return toast('Заверши этап практики, чтобы сохранить первую работу.');let content,type,name;if(id==='design'){content=posterSvg(work.data);type='image/svg+xml';name='mindora-poster.svg';}else{const d=work.data;content=`Expense,Amount\r\nTransport,${d.values[0]}\r\nGroceries,${d.values[1]}\r\nSubscriptions,${d.values[2]}\r\nTotal,=SUM(B2:B4)\r\n`;type='text/csv;charset=utf-8';name='mindora-expenses.csv';}const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Файл готов к скачиванию.');}

function startCurrentStep(practice = false, id = state.active || 'design') {
  if (state.active !== id) selectCourse(id);
  const current = Math.min(state.progress[id], 3);
  if (practice && current >= 2) mixPractice();
  else openStep(current);
}

function dashboardAction(action, id) {
  const stats = learningStats(state);
  switch (action) {
    case 'daily': {
      const id = dailyCourse(state);
      startCurrentStep(state.progress[id] === 4, id);
      return true;
    }
    case 'practice': startCurrentStep(true, id); return true;
    case 'achievements': go('achievements'); return true;
    case 'programming': modal('Программирование', '<p>Курс по программированию в планах. Сейчас можно сделать постер или таблицу расходов.</p>'); return true;
    case 'notifications': modal('Уведомления', `<p>${stats.today ? 'Сегодняшняя задача уже выполнена.' : 'Сегодняшняя задача: пройди следующий этап своего курса.'}</p>`); return true;
    default: return false;
  }
}

document.addEventListener('submit',e=>{if(e.target.id!=='goal-form')return;e.preventDefault();const goal=$('#goal-input').value.trim();if(!goal)return;state.minutes=Number($('#time-select').value);save();const id=matchGoal(goal);if(id)selectCourse(id,goal);else modal('Выбери учебный путь',`<p>Твоя цель: <strong>${esc(goal)}</strong></p><p>Сейчас доступны два практикума. Выбери один, чтобы начать.</p><div class="modal-buttons"><button class="primary" data-course="design">Сделать постер</button><button class="secondary" data-course="budget">Собрать таблицу</button></div>`);});
document.addEventListener('input',e=>{const t=e.target;if(t.closest('#poster-form')&&t.name){const d=draft();d[t.name]=['titleSize','subtitleSize'].includes(t.name)?Number(t.value):t.value;save();invalidateCheck();$('.editor-stage .poster-preview').outerHTML=posterHtml(d);if($('#title-size'))$('#title-size').textContent=d.titleSize+'px';if($('#subtitle-size'))$('#subtitle-size').textContent=d.subtitleSize+'px';}else if(t.id==='budget-formula'||t.id==='budget-answer'){draft()[t.id==='budget-formula'?'formula':'answer']=t.value;save();invalidateCheck();}else if(t.dataset.expense!==undefined){draft().values[Number(t.dataset.expense)]=t.value===''?null:Number(t.value);save();invalidateCheck();const total=$('.total-row .active-cell');if(total)total.textContent='?';}else if(t.dataset.note){state.notes[t.dataset.note]=t.value;save();}});
document.addEventListener('change',e=>{if(e.target.id==='profile-minutes'){state.minutes=Number(e.target.value);save();const time=$('#time-select');if(time)time.value=state.minutes;}});
document.addEventListener('click',e=>{const el=e.target.closest('button,a.brand');if(!el)return;if(el.classList.contains('brand')){e.preventDefault();go('discover');return;}if(el.dataset.view){if($('#modal').open)$('#modal').close();go(el.dataset.view);return;}if(el.dataset.course){if($('#modal').open)$('#modal').close();selectCourse(el.dataset.course);if(el.hasAttribute('data-start'))openStep(0);return;}if(el.dataset.step!==undefined){openStep(Number(el.dataset.step));return;}if(el.dataset.choice!==undefined){quizChoice=Number(el.dataset.choice);quizFeedback=false;render();return;}if(el.dataset.color){draft().bgColor=el.dataset.color;save();invalidateCheck();$('.editor-stage .poster-preview').outerHTML=posterHtml(draft());document.querySelectorAll('[data-color]').forEach(b=>{b.classList.toggle('selected',b.dataset.color===el.dataset.color);b.setAttribute('aria-pressed',b.dataset.color===el.dataset.color);});return;}if(dashboardAction(el.dataset.action, el.dataset.id))return;switch(el.dataset.action){case'about':about();break;case'close-modal':$('#modal').close();break;case'finish-learn':finishStep();break;case'check-quiz':if(quizChoice!==null){quizFeedback=true;render();}break;case'next-question':if(quizIndex===2)finishStep();else{quizIndex++;quizChoice=null;quizFeedback=false;render();}break;case'check-work':checkWork();break;case'mix':mixPractice();break;case'download':download(el.dataset.id);break;}});
$('#modal').addEventListener('click',e=>{if(e.target===$('#modal')){const r=$('#modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('#modal').close();}});
render();
