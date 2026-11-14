import { COURSES, DESIGN_QUIZ, BUDGET_QUIZ, matchGoal, evaluatePoster, evaluateBudget, makeBudgetChallenge } from './engine.js';
import { dayKey, dailyCourse, learningStats } from './progress.js';
import { posterLayout, posterSvg } from './poster.js';
import { mountShell, renderShell } from '../ui/shell.js';
import { dashboard, coursesPage, sidePage } from '../ui/dashboard.js';
import { pathView, lesson, result, workView } from '../ui/views.js';
import { dialogContent, resetWorkCheck, refreshPosterPreview, clearBudgetTotal } from '../ui/feedback.js';

const $=s=>document.querySelector(s);
const KEY='mindora.workspace.v1';
const empty={version:1,minutes:10,active:null,goals:{},progress:{design:0,budget:0},drafts:{},works:{},notes:{},practiceCount:0,studyDays:[]};
function readState(){try{const v=JSON.parse(localStorage.getItem(KEY));if(!v||v.version!==1)return structuredClone(empty);return {...empty,...v,active:['design','budget'].includes(v.active)?v.active:null,minutes:[5,10,20].includes(v.minutes)?v.minutes:10,progress:{design:Math.min(4,Math.max(0,Number(v.progress?.design)||0)),budget:Math.min(4,Math.max(0,Number(v.progress?.budget)||0))},goals:v.goals||{},drafts:v.drafts||{},works:v.works||{},notes:v.notes||{}};}catch{return structuredClone(empty);}}
let state=readState(),view='discover',step=0,quizIndex=0,quizChoice=null,quizFeedback=false,checks=null,challengeSeed=0;
let saveWarning=false;
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch{if(!saveWarning){saveWarning=true;toast('Your browser could not save progress. Keep this tab open.');}}}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('visible'),4200);}
function modal(type, data) {
  $("#modal-content").innerHTML = dialogContent(type, data);
  if (!$("#modal").open) $("#modal").showModal();
}
function go(next){view=next;checks=null;render();window.scrollTo({top:0,behavior:'instant'});$('#main').focus({preventScroll:true});}
function selectCourse(id,goal){if(!COURSES[id])return;state.active=id;state.goals[id]=goal||state.goals[id]||(id==='design'?'Сделать постер для кофейни':'Собрать таблицу ежемесячных расходов');save();go('path');}
function openStep(index){if(!state.active)return go('discover');if(index>state.progress[state.active])return toast('Заверши текущий этап, чтобы открыть следующий.');step=index;quizIndex=0;quizChoice=null;quizFeedback=false;checks=null;go('lesson');}
function finishStep(){const id=state.active;const days = new Set(Array.isArray(state.studyDays) ? state.studyDays : []);days.add(dayKey());state.studyDays = [...days];state.progress[id]=Math.max(state.progress[id],step+1);save();if(step===3){state.practiceCount=(Number(state.practiceCount)||0)+1;save();go('result');}else{toast('Этап завершён. Прогресс сохранён.');go('path');}}

function render() {
  const stats = learningStats(state);
  let html;
  switch (view) {
    case 'discover': html = dashboard(state); break;
    case 'courses': html = coursesPage(state); break;
    case 'path': html = pathView(state); break;
    case 'lesson': {
      const questions = state.active === 'design' ? DESIGN_QUIZ : BUDGET_QUIZ;
      html = lesson(state, { step, question: questions[quizIndex], quizIndex, quizChoice, quizFeedback, draft: step >= 2 ? draft() : null, checks });
      break;
    }
    case 'result': html = result(state); break;
    case 'work': html = workView(state); break;
    default: html = sidePage(view, state);
  }
  renderShell(view, state, stats, html);
}

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

function invalidateCheck() { checks = null; resetWorkCheck(); }
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
    case 'programming': modal('programming'); return true;
    case 'notifications': modal('notifications', stats); return true;
    default: return false;
  }
}

document.addEventListener('submit',e=>{if(e.target.id!=='goal-form')return;e.preventDefault();const goal=$('#goal-input').value.trim();if(!goal)return;state.minutes=Number($('#time-select').value);save();const id=matchGoal(goal);if(id)selectCourse(id,goal);else modal('unsupported', { goal }); });
document.addEventListener('input',e=>{const t=e.target;if(t.closest('#poster-form')&&t.name){const d=draft();d[t.name]=['titleSize','subtitleSize'].includes(t.name)?Number(t.value):t.value;save();invalidateCheck();refreshPosterPreview(d);}else if(t.id==='budget-formula'||t.id==='budget-answer'){draft()[t.id==='budget-formula'?'formula':'answer']=t.value;save();invalidateCheck();}else if(t.dataset.expense!==undefined){draft().values[Number(t.dataset.expense)]=t.value===''?null:Number(t.value);save();invalidateCheck();clearBudgetTotal();}else if(t.dataset.note){state.notes[t.dataset.note]=t.value;save();}});
document.addEventListener('change',e=>{if(e.target.id==='profile-minutes'){state.minutes=Number(e.target.value);save();const time=$('#time-select');if(time)time.value=state.minutes;}});
document.addEventListener('click',e=>{const el=e.target.closest('button,[data-home]');if(!el)return;if(el.matches('[data-home]')){e.preventDefault();go('discover');return;}if(el.dataset.view){if($('#modal').open)$('#modal').close();go(el.dataset.view);return;}if(el.dataset.course){if($('#modal').open)$('#modal').close();selectCourse(el.dataset.course);if(el.hasAttribute('data-start'))openStep(0);return;}if(el.dataset.step!==undefined){openStep(Number(el.dataset.step));return;}if(el.dataset.choice!==undefined){quizChoice=Number(el.dataset.choice);quizFeedback=false;render();return;}if(el.dataset.color){draft().bgColor=el.dataset.color;save();invalidateCheck();refreshPosterPreview(draft());return;}if(dashboardAction(el.dataset.action, el.dataset.id))return;switch(el.dataset.action){case'about':modal('about');break;case'close-modal':$('#modal').close();break;case'finish-learn':finishStep();break;case'check-quiz':if(quizChoice!==null){quizFeedback=true;render();}break;case'next-question':if(quizIndex===2)finishStep();else{quizIndex++;quizChoice=null;quizFeedback=false;render();}break;case'check-work':checkWork();break;case'mix':mixPractice();break;case'download':download(el.dataset.id);break;}});
mountShell();

$('#modal').addEventListener('click',e=>{if(e.target===$('#modal')){const r=$('#modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('#modal').close();}});
render();
