import { COURSES, DESIGN_QUIZ, matchGoal, evaluatePoster } from './engine.js';
import { budgetCsv, budgetSession, budgetDraftKey, createBudgetDraft, evaluateBudgetSession, normalizeMinutes, readBudgetQuiz, readBudgetResume } from './budget-session.js';
import { createCloudDrafts } from './cloud-drafts.js';
import { createPlanController } from './plan-controller.js';
import { dayKey, dailyCourse, learningStats } from './progress.js';
import { posterLayout, posterSvg } from './poster.js';
import { mountShell, renderShell } from '../ui/shell.js';
import { dashboard, coursesPage, sidePage } from '../ui/dashboard.js';
import { pathView, lesson, result, workView } from '../ui/views.js';
import { dialogContent, resetWorkCheck, refreshPosterPreview, clearBudgetTotal } from '../ui/feedback.js';
import { learningPlanView } from '../ui/learning-plan.js';

const $=s=>document.querySelector(s);
const KEY='mindora.workspace.v1';
const empty={version:1,minutes:10,active:null,goals:{},progress:{design:0,budget:0},drafts:{},works:{},notes:{},practiceCount:0,studyDays:[]};
function readState(){try{const v=JSON.parse(localStorage.getItem(KEY));if(!v||v.version!==1)return structuredClone(empty);return {...empty,...v,active:['design','budget'].includes(v.active)?v.active:null,minutes:[5,10,20].includes(v.minutes)?v.minutes:10,progress:{design:Math.min(4,Math.max(0,Number(v.progress?.design)||0)),budget:Math.min(4,Math.max(0,Number(v.progress?.budget)||0))},goals:v.goals||{},drafts:v.drafts||{},works:v.works||{},notes:v.notes||{}};}catch{return structuredClone(empty);}}
const state = readState();
const resume = readBudgetResume(state);
let view = state.learningPlanOpen && state.learningPlan ? 'learning-plan' : resume?.view || 'discover';
let step = resume?.step ?? 0;
let quizIndex = 0;
let quizChoice = null;
let quizFeedback = false;
let checks = null;
let challengeSeed = 0;

const plans = createPlanController({ state, save, render, isOpen: () => view === 'learning-plan' });
if (view === 'learning-plan' && !state.learningPlan) view = 'discover';

const cloud = createCloudDrafts({
  getWorkspace() {
    if (view !== 'lesson' || state.active !== 'budget' || step < 2) return null;
    const drafts = Object.fromEntries(Object.entries(state.drafts).filter(([key]) => key.startsWith('budget-')));
    return { minutes: state.minutes, goal: state.goals.budget || '', step, progress: Math.min(state.progress.budget, 3), drafts };
  },
  hasLocalDraft() {
    return Object.keys(state.drafts).some(key => key.startsWith('budget-'));
  },
  restoreWorkspace(workspace) {
    for (const key of Object.keys(state.drafts)) {
      if (key.startsWith('budget-')) delete state.drafts[key];
    }
    Object.assign(state.drafts, workspace.drafts);
    state.active = 'budget';
    state.minutes = workspace.minutes;
    state.goals.budget = workspace.goal;
    state.progress.budget = Math.max(state.progress.budget, workspace.progress);
    step = workspace.step;
    go('lesson');
  },
});

function quizQuestions() {
  return state.active === 'budget' ? budgetSession(state.minutes).questions : DESIGN_QUIZ;
}

function rememberQuiz() {
  if (state.active !== 'budget' || view !== 'lesson' || step !== 1) return;
  state.budgetQuiz = {
    ...state.budgetQuiz,
    [state.minutes]: { index: quizIndex, choice: quizChoice, feedback: quizFeedback },
  };
  save();
}

function loadLessonState() {
  const saved = state.active === 'budget' && step === 1
    ? readBudgetQuiz(state.budgetQuiz?.[state.minutes], state.minutes)
    : { index: 0, choice: null, feedback: false };
  quizIndex = saved.index;
  quizChoice = saved.choice;
  quizFeedback = saved.feedback;
  checks = null;
  if (state.active === 'budget' && step >= 2) {
    const work = draft();
    if (work.checked) checks = evaluateBudgetSession(work, state.minutes);
  }
}
let saveWarning=false;
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch{if(!saveWarning){saveWarning=true;toast('Your browser could not save progress. Keep this tab open.');}}}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('visible'),4200);}
function modal(type, data) {
  $("#modal-content").innerHTML = dialogContent(type, data);
  if (!$("#modal").open) $("#modal").showModal();
}
function go(next) {
  view = next;
  const learningPlanOpen = next === 'learning-plan';
  if (Boolean(state.learningPlanOpen) !== learningPlanOpen) {
    state.learningPlanOpen = learningPlanOpen;
    save();
  }
  if (next === 'lesson') loadLessonState();
  else checks = null;

  if (state.active === 'budget' && ['path', 'lesson', 'result'].includes(view)) {
    state.budgetActivity = { view, step };
    save();
  } else if (!learningPlanOpen && state.budgetActivity) {
    delete state.budgetActivity;
    save();
  }

  render();
  window.scrollTo({top:0,behavior:'instant'});
  $('#main').focus({preventScroll:true});
}
function selectCourse(id,goal){if(!COURSES[id])return;state.active=id;state.goals[id]=goal||state.goals[id]||(id==='design'?'Сделать постер для кофейни':'Собрать таблицу ежемесячных расходов');save();go('path');}
function openStep(index) {
  if (!state.active) return go('discover');
  if (!Number.isInteger(index) || index < 0 || index >= 4 || index > state.progress[state.active]) {
    return toast('Заверши текущий этап, чтобы открыть следующий.');
  }
  step = index;
  go('lesson');
}
function finishStep(){const id=state.active;const days = new Set(Array.isArray(state.studyDays) ? state.studyDays : []);days.add(dayKey());state.studyDays = [...days];state.progress[id]=Math.max(state.progress[id],step+1);save();if(step===3){state.practiceCount=(Number(state.practiceCount)||0)+1;save();go('result');}else{toast('Этап завершён. Прогресс сохранён.');go('path');}}

function render() {
  const stats = learningStats(state);
  let html;
  switch (view) {
    case 'discover': html = dashboard(state); break;
    case 'courses': html = coursesPage(state); break;
    case 'learning-plan': html = learningPlanView(plans.screen()); break;
    case 'path': html = pathView(state); break;
    case 'lesson': {
      const questions = quizQuestions();
      html = lesson(state, {
        step,
        question: questions[quizIndex],
        questionCount: questions.length,
        quizIndex,
        quizChoice,
        quizFeedback,
        draft: step >= 2 ? draft() : null,
        checks,
      });
      break;
    }
    case 'result': html = result(state); break;
    case 'work': html = workView(state); break;
    default: html = sidePage(view, state);
  }
  renderShell(view, state, stats, html);
  cloud.render();
}

function draftKey() {
  if (state.active === 'budget') return budgetDraftKey(step, state.minutes);
  return step === 3 ? 'design-challenge' : 'design-practice';
}
function draft(){
  const key=draftKey();let changed=false;
  if(!state.drafts[key]){
    state.drafts[key]=state.active==='design'
      ?{title:'',subtitle:'',cta:'',titleSize:34,subtitleSize:16,textColor:'#263c31',bgColor:'#f7d667'}
      :createBudgetDraft(step, state.minutes, step === 3 ? challengeSeed : 0);
    state.drafts[key].seed=step===3?challengeSeed:0;changed=true;
  }
  if(!Number.isInteger(state.drafts[key].seed)||state.drafts[key].seed<0){state.drafts[key].seed=0;changed=true;}
  if(changed)save();
  return state.drafts[key];
}

function invalidateCheck() { checks = null; resetWorkCheck(); }
function checkWork(){
  const d=draft();
  if (checks?.passed) {
    const data = structuredClone(d);
    if (state.active === 'budget') data.limit = budgetSession(state.minutes).limit;
    state.works[state.active] = {data, challenge:step===3, savedAt:new Date().toISOString()};
    finishStep();
    return;
  }
  if(state.active==='design'){
    const layout=posterLayout(d);
    checks=evaluatePoster({...d,titleSize:layout.title.size,subtitleSize:layout.subtitle.size});
    checks.checks[1].detail=`На постере заголовок — ${layout.title.size} px, текст — ${layout.subtitle.size} px. Заголовок должен быть как минимум в 1,5 раза крупнее.`;
    checks.checks.push({label:'Текст помещается',passed:layout.title.height<=190&&layout.subtitle.height<=78&&layout.cta.height<=32,detail:'Текст переносится и остаётся в границах макета.'});
    checks.passed=checks.checks.every(check=>check.passed);
  } else {
    checks = evaluateBudgetSession(d, state.minutes);
    d.checked = true;
    save();
  }
  render();$('#checks-container')?.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function mixPractice() {
  if (!state.active || state.progress[state.active] < 2) {
    return toast('Пройди урок и ответь на вопросы, чтобы открыть практику.');
  }
  step = state.progress[state.active] >= 3 ? 3 : 2;
  const key = draftKey();
  challengeSeed = Math.max(challengeSeed, Number(state.drafts[key]?.seed) || 0) + 1;
  if (state.active === 'budget') {
    state.drafts[key] = createBudgetDraft(step, state.minutes, challengeSeed);
  } else if (step === 3) {
    delete state.drafts[key];
  } else if (state.drafts[key]) {
    state.drafts[key].bgColor = ['#f7d667', '#e3ecf7', '#d6eadd', '#f3d9d1'][challengeSeed % 4];
  }
  save();
  go('lesson');
  toast('Открыт новый вариант задания.');
}
function download(id) {
  const work = state.works[id];
  if (!work) return toast('Заверши этап практики, чтобы сохранить первую работу.');
  const isPoster = id === 'design';
  const content = isPoster ? posterSvg(work.data) : budgetCsv(work.data);
  const type = isPoster ? 'image/svg+xml' : 'text/csv;charset=utf-8';
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = isPoster ? 'mindora-poster.svg' : 'mindora-expenses.csv';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Файл готов к скачиванию.');
}

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

function changeMinutes(value) {
  const minutes = normalizeMinutes(value);
  if (state.minutes === minutes) return;
  state.minutes = minutes;
  save();
  if (view === 'lesson' && state.active === 'budget') loadLessonState();
  const other = $('#time-select');
  if (other) other.value = minutes;
  // Keep the goal text and focus while the user changes time in the form.
  if (view === 'path' || view === 'lesson') {
    const control = document.activeElement?.id;
    render();
    if (control) document.getElementById(control)?.focus();
  }
}

document.addEventListener('submit', event => {
  if (event.target.id !== 'goal-form') return;
  event.preventDefault();
  const goal = $('#goal-input').value.trim();
  if (!goal) return;
  changeMinutes($('#time-select')?.value ?? state.minutes);
  const id = matchGoal(goal);
  if (id) selectCourse(id, goal);
  else {
    go('learning-plan');
    void plans.generate(goal, state.minutes);
  }
});

function updateBudgetDraft(field, value) {
  const work = draft();
  work[field] = value;
  work.checked = false;
  save();
  invalidateCheck();
  clearBudgetTotal();
}

document.addEventListener('input', event => {
  const input = event.target;
  if (input.dataset.note) {
    state.notes[input.dataset.note] = input.value;
    save();
    return;
  }
  if (view !== 'lesson' || step < 2) return;
  if (state.active === 'design' && input.closest('#poster-form') && input.name) {
    const work = draft();
    work[input.name] = ['titleSize', 'subtitleSize'].includes(input.name) ? Number(input.value) : input.value;
    save();
    invalidateCheck();
    refreshPosterPreview(work);
  } else if (state.active === 'budget') {
    const field = { 'budget-formula': 'formula', 'budget-answer': 'answer', 'budget-balance': 'balance' }[input.id];
    if (field) updateBudgetDraft(field, input.value);
    else if (input.dataset.expense !== undefined && !input.readOnly && !input.disabled) {
      const values = [...draft().values];
      values[Number(input.dataset.expense)] = input.value === '' ? null : Number(input.value);
      updateBudgetDraft('values', values);
    }
  }
});

document.addEventListener('change', event => {
  if (['time-select', 'profile-minutes', 'budget-session-minutes'].includes(event.target.id)) {
    changeMinutes(event.target.value);
  }
});

document.addEventListener('click', event => {
  const button = event.target.closest('button,[data-home]');
  if (!button) return;
  const { view: destination, course, step: requestedStep, choice, color, action, id } = button.dataset;
  if (button.matches('[data-home]')) {
    event.preventDefault();
    return go('discover');
  }
  if (destination || course) {
    if ($('#modal').open) $('#modal').close();
    if (destination) return go(destination);
    selectCourse(course);
    if (button.hasAttribute('data-start')) openStep(0);
    return;
  }
  if (requestedStep !== undefined) return openStep(Number(requestedStep));
  if (choice !== undefined && view === 'lesson' && step === 1) {
    quizChoice = Number(choice);
    quizFeedback = false;
    rememberQuiz();
    render();
    return;
  }
  if (color && view === 'lesson' && state.active === 'design' && step >= 2) {
    const work = draft();
    work.bgColor = color;
    save();
    invalidateCheck();
    refreshPosterPreview(work);
    return;
  }
  if (dashboardAction(action, id)) return;
  switch (action) {
    case 'about': modal('about'); break;
    case 'close-modal': $('#modal').close(); break;
    case 'finish-learn': finishStep(); break;
    case 'check-quiz':
      if (view === 'lesson' && step === 1 && quizChoice !== null) {
        quizFeedback = true;
        rememberQuiz();
        render();
      }
      break;
    case 'next-question': {
      const questions = quizQuestions();
      if (view !== 'lesson' || step !== 1 || !quizFeedback || quizChoice !== questions[quizIndex].correctIndex) break;
      if (quizIndex === questions.length - 1) {
        if (state.active === 'budget' && state.budgetQuiz) delete state.budgetQuiz[state.minutes];
        finishStep();
      } else {
        quizIndex += 1;
        quizChoice = null;
        quizFeedback = false;
        rememberQuiz();
        render();
      }
      break;
    }
    case 'check-work': checkWork(); break;
    case 'mix': mixPractice(); break;
    case 'download': download(id); break;
  }
});

mountShell();

$('#modal').addEventListener('click',e=>{if(e.target===$('#modal')){const r=$('#modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('#modal').close();}});
if (view === 'lesson') loadLessonState();
render();
void cloud.init();
