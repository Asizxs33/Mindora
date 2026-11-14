import { COURSES, DESIGN_QUIZ, evaluatePoster } from './engine.js';
import { budgetCsv, budgetSession, budgetDraftKey, createBudgetDraft, evaluateBudgetSession, normalizeMinutes, readBudgetQuiz, readBudgetResume } from './budget-session.js';
import { createCloudDrafts } from './cloud-drafts.js';
import { createPlanController } from './plan-controller.js';
import { createLearningLibrary } from './learning-library.js';
import { createBuiltinSync } from './builtin-sync.js';
import { restorePlan } from './learning-plan.js';
import { normalizeRoadmap, restoreRoadmap, roadmapInput, roadmapStageStatuses, updateRoadmapStage } from './roadmap-model.js';
import { buyRewardItem, claimDailyQuest, recordCheckReward, recordLessonReward, rewardScreen } from './roadmap-rewards.js';
import { createWorkspaceStorage } from './workspace-storage.js';
import { dayKey, dailyCourse, learningStats } from './progress.js';
import { posterLayout, posterSvg } from './poster.js';
import { mountShell, renderShell } from '../ui/shell.js';
import { dashboard, coursesPage, sidePage, courseNames } from '../ui/dashboard.js';
import { pathView, lesson, result, workView } from '../ui/views.js';
import { dialogContent, resetWorkCheck, refreshPosterPreview, clearBudgetTotal } from '../ui/feedback.js';
import { learningPlanView } from '../ui/learning-plan.js';
import { languageCode } from './language.js';
import { setLanguage, t } from '../ui/language.js';
import { message } from '../ui/messages.js';
import { resumeCursor, needsRecap, certificateEligible } from './resume.js';
import { recapView, recapQuestion, builtinReviewContent } from '../ui/recap.js';
import { certificateView, refreshCertificatePreview } from '../ui/certificate.js';
import { downloadCertificate } from './certificate.js';
import { getAccountState, openAccount, closeAccount, expireAccountSession } from '../ui/account.js';
import { learningLibraryView, learningSyncView, loginRequiredView } from '../ui/learning-library.js';
import { showWorkspaceConflict } from '../ui/workspace-conflict.js';
import { guidedStartView, quietHomeView, startTopics } from '../ui/guided-start.js';
import { needsReturnReview, learningHasProgress, learningReviewQuestions, createReturnReview, restoreReturnReview } from './return-review.js';
import { returnReviewView, mountReturnReview } from '../ui/return-review.js';
import { getStarterCourse, starterCourses } from './starter-courses.js';
import { roadmapView, rewardsView } from '../ui/roadmap.js';

const $=s=>document.querySelector(s);
const LEGACY_KEY='mindora.workspace.v1';
let accountOwner = getAccountState().user?.id || null;
let accountReady = Boolean(accountOwner);
let accountEpoch = 0;
let KEY = accountOwner ? `${LEGACY_KEY}.${encodeURIComponent(accountOwner)}` : `${LEGACY_KEY}.guest`;
const makeWorkspaceStorage = () => createWorkspaceStorage({
  readValue: () => localStorage.getItem(KEY),
  writeValue: value => localStorage.setItem(KEY, value),
});
let workspaceStorage = makeWorkspaceStorage();
let legacyLesson = null;
let legacyWorkspace = null;
try {
  const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY));
  legacyLesson = restorePlan(legacy?.learningPlan);
  if (legacy?.version === 1 && (legacy.active || Object.keys(legacy.drafts || {}).length || Object.values(legacy.progress || {}).some(Boolean))) {
    legacyWorkspace = legacy;
  }
} catch { /* Old browser data is optional. */ }
const empty={version:1,minutes:10,active:null,goals:{},progress:{design:0,budget:0},drafts:{},works:{},notes:{},sessions:{},certificates:{},practiceCount:0,studyDays:[]};
function readState(){try{const v=JSON.parse(workspaceStorage.read());if(!v||v.version!==1)return structuredClone(empty);return {...empty,...v,active:['design','budget'].includes(v.active)?v.active:null,minutes:[5,10,20].includes(v.minutes)?v.minutes:10,progress:{design:Math.min(4,Math.max(0,Number(v.progress?.design)||0)),budget:Math.min(4,Math.max(0,Number(v.progress?.budget)||0))},goals:v.goals||{},drafts:v.drafts||{},works:v.works||{},notes:v.notes||{}};}catch{return structuredClone(empty);}}
const state = readState();
state.language = languageCode(state.language);
setLanguage(state.language);
const resume = readBudgetResume(state);
let view = 'discover';
let startingNew = false;
let introduction = { step: 0, name: '', topic: '', goal: '', minutes: state.minutes };
let step = resume?.step ?? 0;
let quizIndex = 0;
let quizChoice = null;
let quizFeedback = false;
let checks = null;
let challengeSeed = 0;

let pendingLearning = null;
let openingStarter = false;
let library;
let builtins;
let roadmapWizard = null;
let roadmapOperation = null;
let roadmapError = '';
let pendingRoadmapPrefill = null;
const builtinFields = ['minutes', 'active', 'goals', 'progress', 'drafts', 'works', 'notes', 'sessions', 'certificates', 'practiceCount', 'studyDays', 'budgetQuiz', 'budgetActivity', 'learningRoadmap', 'learningRewards'];
const builtinData = source => Object.fromEntries(builtinFields.filter(key => source[key] !== undefined).map(key => [key, source[key]]));
let builtinSnapshot = JSON.stringify(builtinData(state));
const plans = createPlanController({ state, save: saveLearning, render, isOpen: () => view === 'learning-plan' && Boolean(accountOwner),
    canLearn: () => ensureLearning(), beforeGenerate: () => library.flush(),
    async onGenerated(course) {
      const accepted = await library.accept(course);
      if (accepted && view === 'learning-plan') { rememberLearningVisit(); saveLocal(); }
      return accepted;
    }, onUnauthorized: expiredSession, accountId: () => accountOwner });
if (view === 'learning-plan' && !state.learningPlan) view = 'discover';

library = createLearningLibrary({
  getCurrent() {
    const meta = state.learningCourse;
    return meta && state.learningPlan ? { ...meta, saved: state.learningPlan } : null;
  },
  setCurrent(course, ownerId) {
    const saved = restorePlan(course.saved);
    if (!saved || ownerId !== accountOwner) return;
    state.learningPlan = saved;
    state.learningCourse = { id: course.id, revision: course.revision, updatedAt: course.updatedAt, ownerId, dirty: false };
    plans.reset();
    if (accountReady && saved.completed === saved.plan.steps.length) reconcileRoadmapCompletion(course.id);
    saveLocal();
    if (view === 'learning-plan') render();
  },
  updateMeta(patch) { if (state.learningCourse) { Object.assign(state.learningCourse, patch); saveLocal(); } },
  onChange() {
    if (view === 'courses') render();
    else {
      const panel = document.querySelector('[data-learning-sync-panel]');
      if (panel) panel.innerHTML = syncView();
    }
  },
  onUnauthorized: expiredSession,
});

builtins = createBuiltinSync({
  getCurrent() {
    return accountOwner ? { revision: null, dirty: false, ...state.builtinSync, ownerId: accountOwner, data: builtinData(state) } : null;
  },
  setCurrent(workspace, ownerId) {
    if (ownerId !== accountOwner) return;
    for (const field of builtinFields) delete state[field];
    Object.assign(state, builtinData(empty), workspace.data);
    builtinSnapshot = JSON.stringify(builtinData(state));
    state.builtinSync = { revision: workspace.revision, dirty: false };
    saveLocal();
  },
  updateMeta(patch) { state.builtinSync = { revision: null, ...state.builtinSync, ...patch }; saveLocal(); },
  onChange() {
    const panel = document.querySelector('[data-builtin-sync-panel]');
      if (panel) panel.innerHTML = builtinSyncView();
  },
  onUnauthorized: expiredSession,
});

function ensureLearning(resumeAction) {
  if (accountOwner && getAccountState().user?.id === accountOwner && accountReady) return true;
  if (resumeAction) pendingLearning = resumeAction;
  if (accountOwner && !accountReady) return false;
  openAccount('signup', introduction.name ? { name: introduction.name, interests: [startTopics().find(item => item.id === introduction.topic)?.label || introduction.goal].filter(Boolean) } : null);
  return false;
}

function expiredSession() {
  pendingLearning = () => go('courses');
  expireAccountSession();
  openAccount('signin');
}

function syncView() {
  const data = library.screen();
  return learningSyncView({ status: data.status, error: data.syncError, conflict: data.conflict });
}

function builtinSyncView() {
  const data = builtins.screen();
  return learningSyncView({ status: data.status, error: data.syncError, conflict: data.conflict, builtin: true });
}

function canImportBuiltin() {
  return accountReady && legacyWorkspace && !state.builtinSync?.revision && !state.builtinSync?.dirty
    && !Object.values(state.progress).some(Boolean) && !Object.keys(state.drafts).length;
}

function saveLearning(event) {
  if (event) applyLessonReward(event, state.learningCourse?.id);
  if (view === 'learning-plan') rememberLearningVisit();
  saveLocal();
  if (!workspaceStorage.conflicted) library?.changed();
}

function applyLessonReward(event, courseId) {
  if (!accountReady || !courseId) return;
  if (event.type === 'check') {
    state.learningRewards = recordCheckReward(state.learningRewards, courseId, event.index, event.correct);
  } else {
    state.learningRewards = recordLessonReward(state.learningRewards, courseId);
    reconcileRoadmapCompletion(courseId);
  }
  save();
}

function reconcileRoadmapCompletion(courseId) {
  const roadmap = restoreRoadmap(state.learningRoadmap);
  const index = roadmap?.progress.findIndex(stage => stage.courseId === courseId && !stage.completed) ?? -1;
  if (index < 0) return;
  state.learningRoadmap = updateRoadmapStage(roadmap, index, courseId, true);
  save();
}

const cloud = createCloudDrafts({
  expectedOwner: () => accountOwner,
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
  rememberPosition();
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
// These fields are additive; old workspace saves remain readable.
for (const field of ['sessions', 'certificates']) if (!state[field] || typeof state[field] !== 'object' || Array.isArray(state[field])) state[field] = {};
let recap = { phase: 0, choice: null, checked: false }, pendingCursor = null, pendingPractice = false;

function rememberPosition(page, touch = true) {
  if (view !== 'lesson' || !state.active) return;
  const readingPage = page ?? Number(document.querySelector('[data-learn-deck]')?.dataset.index || 0);
  state.sessions[state.active] = { lastSeen: touch ? Date.now() : state.sessions[state.active]?.lastSeen, cursor: { step, page: readingPage, minutes: state.minutes, quizIndex, quizChoice, quizFeedback } };
  save();
}

function restoreLesson(cursor) {
  step = cursor.step; quizIndex = cursor.quizIndex; quizChoice = cursor.quizChoice; quizFeedback = cursor.quizFeedback; checks = null;
  // UI paging reads only this presentation hint. The persisted cursor lives in core.
  try { sessionStorage.setItem(`mindora.reading.${state.active}.v1`, String(cursor.page)); } catch { /* Storage may be disabled. */ }
  if (state.active === 'budget' && step === 1 && !state.budgetQuiz?.[state.minutes]) {
    state.budgetQuiz = { ...state.budgetQuiz, [state.minutes]: { index: cursor.quizIndex, choice: cursor.quizChoice, feedback: cursor.quizFeedback } };
  }
  go('lesson', cursor); rememberPosition(cursor.page);
}

function resumeCourse(id = state.active, requestedStep = null) {
  if (!ensureLearning(() => resumeCourse(id, requestedStep))) return;
  if (!COURSES[id]) return go('discover');
  pendingPractice = false;
  state.active = id;
  let cursor = resumeCursor(state, id);
  if (requestedStep !== null && requestedStep !== cursor.step) {
    cursor = { step: requestedStep, page: 0, quizIndex: 0, quizChoice: null, quizFeedback: false };
  }
  const key = `builtin:${id}`;
  const interrupted = restoreReturnReview(state.returnReview, key);
  if (interrupted && interrupted.phase !== 'complete') {
    state.returnReview = interrupted; go('return-review');
  } else if (needsRecap(state, id)) {
    state.returnReview = createReturnReview({ key, ...builtinReviewContent(id), cursor });
    saveLocal(); go('return-review');
  } else restoreLesson(cursor);
}

function learningVisitKey() {
  if (!state.learningPlan) return null;
  const plan = state.learningPlan.plan;
  return `ai:${state.learningCourse?.id || `${plan.goal}:${plan.minutes}:${plan.language}:${plan.title}`}`.slice(0, 500);
}

function rememberLearningVisit() {
  const key = learningVisitKey();
  if (!key || !accountReady) return;
  const visits = state.learningVisits && typeof state.learningVisits === 'object' && !Array.isArray(state.learningVisits) ? state.learningVisits : {};
  state.learningVisits = Object.fromEntries([...Object.entries(visits).filter(([id]) => id !== key).slice(-99), [key, Date.now()]]);
  state.lastLearningType = state.learningRoadmap?.progress?.some(stage => stage.courseId && stage.courseId === state.learningCourse?.id) ? 'roadmap' : 'ai';
}

function reviewLearningPlan() {
  const key = learningVisitKey();
  if (!key) return false;
  const interrupted = restoreReturnReview(state.returnReview, key);
  if (interrupted && interrupted.phase !== 'complete') state.returnReview = interrupted;
  else {
    const lastSeen = state.learningVisits?.[key] || Date.parse(state.learningCourse?.updatedAt || '');
    if (!needsReturnReview(lastSeen, learningHasProgress(state.learningPlan))) return false;
    const saved = state.learningPlan;
    state.returnReview = createReturnReview({ key, title: saved.plan.title,
      questions: learningReviewQuestions(saved), reminder: saved.plan.steps[Math.min(saved.completed, saved.plan.steps.length - 1)]?.instruction || saved.plan.outcome });
  }
  saveLocal(); go('return-review'); return true;
}

function certificateData(id) {
  if (!certificateEligible(state, id)) return null;
  if (!state.certificates[id]) {
    const account = getAccountState();
    state.certificates[id] = { name: account.profile?.name || account.user?.name || '', completedAt: state.works[id].savedAt, certificateId: `MD-${id.toUpperCase()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}` };
    save();
  }
  return { ...state.certificates[id], courseTitle: courseNames[id] };
}

function openCertificate(id = state.active) {
  if (!certificateData(id)) return toast('Finish the course and final challenge to earn your certificate.');
  state.active = id; save(); go('certificate');
}
let saveWarning=false;
function saveLocal() {
  try {
    if (!workspaceStorage.write(JSON.stringify(state))) showWorkspaceConflict($('#main'));
  } catch {
    if (!saveWarning) {
      saveWarning = true;
      toast('Your browser could not save progress. Keep this tab open.');
    }
  }
}
function save() {
  saveLocal();
  if (!accountReady || workspaceStorage.conflicted) return;
  const snapshot = JSON.stringify(builtinData(state));
  if (snapshot === builtinSnapshot) return;
  builtinSnapshot = snapshot;
  builtins.changed();
}
function toast(value){$('#toast').textContent=message(value);$('#toast').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('visible'),4200);}
function modal(type, data) {
  $("#modal-content").innerHTML = dialogContent(type, data);
  if (!$("#modal").open) $("#modal").showModal();
}
function go(next, cursor = null, newCourse = false) {
  if (['path', 'lesson', 'learning-plan', 'recap', 'return-review', 'result', 'work', 'certificate', 'roadmap', 'quests', 'shop'].includes(next)
    && !ensureLearning(() => go(next, cursor, newCourse))) return;
  if (next === 'learning-plan' && !newCourse && view !== next && reviewLearningPlan()) return;
  if (view === 'learning-plan' && next !== view && next !== 'return-review') { rememberLearningVisit(); saveLocal(); }
  view = next;
  if (next !== 'discover') startingNew = false;
  if (next === 'roadmap' && state.learningRoadmap) { state.lastLearningType = 'roadmap'; saveLocal(); }
  const learningPlanOpen = next === 'learning-plan';
  if (Boolean(state.learningPlanOpen) !== learningPlanOpen) {
    state.learningPlanOpen = learningPlanOpen;
    save();
  }
  if (next === 'lesson') {
    state.lastLearningType = 'builtin';
    loadLessonState();
    if (cursor && state.active !== 'budget') {
      quizIndex = cursor.quizIndex; quizChoice = cursor.quizChoice; quizFeedback = cursor.quizFeedback;
    }
  }
  else checks = null;
  if (next === 'learning-plan') { rememberLearningVisit(); saveLocal(); }

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
function selectCourse(id,goal){if(!COURSES[id]||!ensureLearning(()=>selectCourse(id,goal)))return;state.active=id;state.goals[id]=goal||state.goals[id]||(id==='design'?'Сделать постер для кофейни':'Собрать таблицу ежемесячных расходов');save();go('path');}
function openStep(index){if(!state.active)return go('discover');if(!Number.isInteger(index)||index<0||index>3||index>state.progress[state.active])return toast('Finish this step to unlock the next one.');resumeCourse(state.active,index);}
function finishStep(){const id=state.active;const days = new Set(Array.isArray(state.studyDays) ? state.studyDays : []);days.add(dayKey());state.studyDays = [...days];state.progress[id]=Math.max(state.progress[id],step+1);rememberPosition();save();if(step===3){state.practiceCount=(Number(state.practiceCount)||0)+1;certificateData(id);save();go('result');}else{openStep(step+1);}}

function render() {
  const stats = learningStats(state);
  const rewards = accountOwner ? rewardScreen(state.learningRewards) : null;
  const roadmap = accountOwner ? restoreRoadmap(state.learningRoadmap) : null;
  const roadmapProps = { roadmap, wizard: roadmapWizard, active: roadmap ? roadmapStageStatuses(roadmap) : [],
    busy: roadmapOperation?.kind, error: roadmapError, rewards, quests: rewards?.quests ?? [], items: rewards?.items ?? [] };
  let html;
  switch (view) {
    case 'discover': html = !accountOwner || startingNew || (!state.active && !state.learningPlan && !roadmap)
      ? guidedStartView({ ...introduction, signedIn: Boolean(accountOwner) }) : roadmap && (state.lastLearningType === 'roadmap' || (!state.active && !state.learningPlan)) ? roadmapView({ ...roadmapProps, wizard: null }) : quietHomeView(state); break;
    case 'courses': {
      const collection = library.screen();
      const represented = collection.courses.some(course => course.id === state.learningCourse?.id);
      html = learningLibraryView({ ...collection, available: getAccountState().available,
        hasLocalLesson: Boolean(legacyLesson) && !state.importedLegacyLesson, hasLocalBuiltin: canImportBuiltin() }, { primaryHeading: true, showEmpty: false })
        + coursesPage(state, { showHeading: false, showCurrentLesson: !represented, showReadyCourses: true, readyCourses: starterCourses(state.language, state.minutes) });
      break;
    }
    case 'learning-plan': html = accountOwner ? `<div data-learning-sync-panel>${syncView()}</div>` + learningPlanView({ ...plans.screen(), accountSaved: Boolean(state.learningCourse), onRoadmap: roadmap?.progress.some(stage => !!stage.courseId && stage.courseId === state.learningCourse?.id) }) : loginRequiredView(); break;
    case 'roadmap': html = roadmapView(roadmapProps); break;
    case 'quests':
    case 'shop': html = rewardsView(view, roadmapProps); break;
    case 'profile': html = sidePage(view, state, rewards ? rewardsView('profile', roadmapProps) : ''); break;
    case 'path': html = pathView(state); break;
    case 'recap': html = recapView(state.active, recap); break;
    case 'return-review': html = returnReviewView(state.returnReview); break;
    case 'certificate': html = certificateView(certificateData(state.active)); break;
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
  renderShell(view, state, stats, html, rewards);
  if (accountOwner && ['courses', 'path', 'lesson', 'recap', 'result', 'work', 'certificate', 'roadmap', 'quests', 'shop', 'profile'].includes(view)) {
    const main = $('#main');
    if (main.insertAdjacentHTML) main.insertAdjacentHTML(view === 'lesson' ? 'beforeend' : 'afterbegin', `<div data-builtin-sync-panel>${builtinSyncView()}</div>`);
  }
  if (workspaceStorage.conflicted) showWorkspaceConflict($('#main'));
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
  if (!ensureLearning(mixPractice)) return;
  const interrupted = restoreReturnReview(state.returnReview, `builtin:${state.active}`);
  if (state.active && (needsRecap(state, state.active) || interrupted && interrupted.phase !== 'complete')) {
    resumeCourse();
    if (view === 'return-review') { state.returnReview.intent = 'practice'; saveLocal(); }
    return;
  }
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
  rememberPosition();
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
  if (!ensureLearning(() => startCurrentStep(practice, id))) return;
  if (state.active !== id) selectCourse(id);
  const current = Math.min(state.progress[id], 3);
  if (practice && current >= 2) mixPractice();
  else resumeCourse(id);
}

function dashboardAction(action, id) {
  const stats = learningStats(state);
  switch (action) {
    case 'reload-workspace': if (workspaceStorage.conflicted) window.location.reload(); break;
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
  rememberQuiz();
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

function beginRoadmap(goal = '', minutes = state.minutes) {
  if (roadmapOperation) return;
  roadmapWizard = { step: goal ? 1 : 0, goal, minutes, experience: '', evidence: '', motivation: '' };
  roadmapError = '';
  go('roadmap');
}

function roadmapErrorText(kind) {
  return kind === 'stage'
    ? t('We couldn’t open the lesson. Try again.', 'Не удалось открыть занятие. Попробуй ещё раз.', 'Сабақты ашу мүмкін болмады. Қайта байқап көр.')
    : t('We couldn’t build your path. Your answers are still here. Try again.', 'Не удалось построить путь. Твои ответы сохранились в форме. Попробуй ещё раз.', 'Оқу жолы құрылмады. Жауаптарың сақталды. Қайта байқап көр.');
}

function runRoadmapOperation(kind, work) {
  if (roadmapOperation || !ensureLearning()) return;
  const operation = { kind, owner: accountOwner };
  const isCurrent = () => roadmapOperation === operation && accountOwner === operation.owner;
  roadmapOperation = operation;
  roadmapError = '';
  render();
  void (async () => {
    try { await work(isCurrent, operation.owner); }
    catch (error) {
      if (isCurrent()) roadmapError = error.message || roadmapErrorText(kind);
    } finally {
      if (isCurrent()) {
        roadmapOperation = null;
        if (view === 'roadmap' || (view === 'discover' && !startingNew)) render();
      }
    }
  })();
}

function captureRoadmapAnswers(form) {
  if (!form || !roadmapWizard || roadmapOperation) return;
  const fields = new FormData(form);
  const wizard = roadmapWizard;
  if (wizard.step === 0) wizard.goal = String(fields.get('goal') || '').trim();
  if (wizard.step === 1) {
    wizard.experience = String(fields.get('experience') || '');
    wizard.evidence = String(fields.get('evidence') || '').trim();
  }
  if (wizard.step === 2) wizard.motivation = String(fields.get('motivation') || '');
  if (wizard.step === 3) wizard.minutes = Number(fields.get('minutes'));
}

function submitRoadmap(form) {
  if (!roadmapWizard || roadmapOperation) return;
  captureRoadmapAnswers(form);
  const wizard = roadmapWizard;
  const valid = [
    wizard.goal.length >= 3 && wizard.goal.length <= 180,
    ['new', 'some', 'comfortable'].includes(wizard.experience),
    ['work', 'personal', 'career', 'curiosity'].includes(wizard.motivation),
    [5, 10, 20].includes(wizard.minutes),
  ];
  if (!valid[wizard.step]) {
    roadmapError = t('Answer this question to continue.', 'Ответь на вопрос, чтобы продолжить.', 'Жалғастыру үшін сұраққа жауап бер.');
    render();
    return;
  }
  roadmapError = '';
  if (wizard.step < 3) {
    wizard.step++;
    go('roadmap');
    return;
  }
  const input = roadmapInput({ ...wizard, language: state.language });
  if (!input) {
    roadmapError = t('Check your answers and try again.', 'Проверь ответы и попробуй снова.', 'Жауаптарыңды тексеріп, қайта байқап көр.');
    render();
    return;
  }
  runRoadmapOperation('roadmap', async (isCurrent, owner) => {
    let response;
    try {
      response = await fetch('/api/learning-roadmap', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Mindora-Account': owner },
        body: JSON.stringify(input), signal: AbortSignal.timeout(38000),
      });
    } catch {
      throw new Error(roadmapErrorText('roadmap'));
    }
    if (!isCurrent()) return;
    if (response.status === 401) { expiredSession(); return; }
    if (!response.ok) throw new Error(roadmapErrorText('roadmap'));
    const data = await response.json().catch(() => null);
    if (!isCurrent()) return;
    const roadmap = normalizeRoadmap(data?.roadmap, input);
    if (!roadmap) throw new Error(roadmapErrorText('roadmap'));
    state.learningRoadmap = restoreRoadmap(roadmap);
    state.minutes = input.minutes;
    roadmapWizard = null;
    save();
    if (view === 'roadmap') go('roadmap');
  });
}

function startRoadmapStage(index) {
  if (roadmapWizard && view !== 'discover') return;
  const roadmap = restoreRoadmap(state.learningRoadmap);
  const selected = roadmap && roadmapStageStatuses(roadmap)[index];
  if (!selected || selected.status === 'locked') return;
  // The saved path also renders as home. Give its async operation the same
  // route/error handling as a path opened from navigation.
  if (view === 'discover') { roadmapWizard = null; go('roadmap'); }
  runRoadmapOperation('stage', async isCurrent => {
    if (selected.courseId) {
      if (!await library.load(selected.courseId)) throw new Error(roadmapErrorText('stage'));
    } else {
      const { title, objective } = roadmap.stages[index];
      const { goal, level, levelReason } = roadmap;
      const stageGoal = `${title} — ${goal}`.slice(0, 180);
      const generated = await plans.generate(stageGoal, roadmap.minutes, { language: roadmap.language, roadmapStage: { goal, title, objective, level, levelReason } });
      if (!isCurrent()) return;
      if (!generated || !state.learningCourse?.id) {
        throw new Error(roadmapErrorText('stage'));
      }
      state.learningRoadmap = updateRoadmapStage(roadmap, index, state.learningCourse.id);
      save();
    }
    if (isCurrent() && view === 'roadmap') go('learning-plan');
  });
}

document.addEventListener('submit', event => {
  if (event.target.id === 'intro-name-form') { event.preventDefault(); advanceIntroduction(); return; }
  if (event.target.id === 'roadmap-form') {
    event.preventDefault();
    submitRoadmap(event.target);
    return;
  }
  if (event.target.id !== 'goal-form') return;
  event.preventDefault();
  const goal = $('#goal-input').value.trim();
  if (!goal) return;
  const minutes = normalizeMinutes($('#time-select')?.value ?? state.minutes);
  if (!accountOwner) pendingRoadmapPrefill = { goal, minutes };
  const start = () => { pendingRoadmapPrefill = null; beginRoadmap(goal, minutes); };
  if (ensureLearning(start)) start();
});

function advanceIntroduction() {
  if (introduction.step === 1 && !introduction.name.trim()) return;
  if (introduction.step === 2 && (!introduction.topic || (introduction.topic === 'custom' && introduction.goal.trim().length < 3))) return;
  introduction.step = Math.min(3, introduction.step + 1);
  render();
  $('#guided-prompt')?.focus({ preventScroll: true });
}

function beginIntroductionCourse() {
  const selected = startTopics().find(item => item.id === introduction.topic);
  if (!selected || (selected.id === 'custom' && introduction.goal.trim().length < 3)) return;
  const goal = selected.id === 'custom' ? introduction.goal.trim() : selected.goal;
  const minutes = introduction.minutes;
  const start = () => {
    startingNew = false;
    changeMinutes(minutes);
    if (['design', 'budget'].includes(selected.id)) {
      selectCourse(selected.id, goal);
      state.lastLearningType = 'builtin'; saveLocal(); go('discover');
    } else if (selected.id === 'english') { void startReadyCourse('everyday-english', minutes); }
    else beginRoadmap(goal, minutes);
  };
  if (ensureLearning(start)) start();
}

async function startReadyCourse(id, minutes = state.minutes) {
  const duration = normalizeMinutes(minutes);
  if (!ensureLearning(() => { void startReadyCourse(id, duration); }) || openingStarter) return;
  const saved = getStarterCourse(id, state.language, duration);
  if (!saved) return;
  openingStarter = true;
  const owner = accountOwner;
  try {
    const existing = library.screen().courses.find(course => course.goal === saved.plan.goal && course.title === saved.plan.title && course.language === saved.plan.language && course.minutes === duration);
    // Importing switches the active copy. Save the old answer before replacing it;
    // load() already performs this check for an existing account course.
    const mayImport = existing || await library.flush();
    if (owner !== accountOwner) return;
    const accepted = existing ? await library.load(existing.id) : mayImport && await library.importLocal(saved);
    if (accepted && owner === accountOwner) {
      state.lastLearningType = 'ai'; changeMinutes(duration); saveLocal(); go('discover');
    } else if (owner === accountOwner) go('courses');
  } finally { openingStarter = false; }
}

document.addEventListener('input', event => {
  if (event.target.id === 'intro-name') introduction.name = event.target.value.slice(0, 80);
  else if (event.target.id === 'intro-goal') introduction.goal = event.target.value.slice(0, 180);
  else return;
  const next = $('[data-intro-action="next"]');
  if (next) next.disabled = introduction.step === 1 ? !introduction.name.trim() : introduction.goal.trim().length < 3;
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
  if (event.target.id === 'interface-language') {
    captureRoadmapAnswers($('#roadmap-form'));
    const goal = $('#goal-input')?.value;
    const planForm = $('#learning-plan-form');
    const inputs = planForm ? [planForm.elements.goal.value, planForm.elements.minutes.value] : null;
    state.language = languageCode(event.target.value);
    setLanguage(state.language);
    save();
    render();
    if (goal !== undefined) $('#goal-input').value = goal;
    if (inputs) {
      $('#learning-plan-form').elements.goal.value = inputs[0];
      $('#learning-plan-form').elements.minutes.value = inputs[1];
    }
    $('#interface-language')?.focus();
    return;
  }
  if (['time-select', 'profile-minutes', 'budget-session-minutes'].includes(event.target.id)) {
    changeMinutes(event.target.value);
  }
});

document.addEventListener('click', event => {
  const button = event.target.closest('button,[data-home]');
  if (!button || button.disabled) return;
  if (button.dataset.introAction) {
    const action = button.dataset.introAction;
    if (action === 'next') advanceIntroduction();
    else if (action === 'back') { introduction.step = Math.max(0, introduction.step - 1); render(); }
    else if (action === 'start') beginIntroductionCourse();
    else if (action === 'new') { startingNew = true; introduction = { step: 2, name: getAccountState().profile?.name || '', topic: '', goal: '', minutes: state.minutes }; view = 'discover'; render(); }
    return;
  }
  if (button.dataset.introTopic) { introduction.topic = button.dataset.introTopic; render(); document.querySelector(`[data-intro-topic="${introduction.topic}"]`)?.focus({ preventScroll: true }); return; }
  if (button.dataset.introMinutes) { introduction.minutes = normalizeMinutes(button.dataset.introMinutes); render(); document.querySelector(`[data-intro-minutes="${introduction.minutes}"]`)?.focus({ preventScroll: true }); return; }
  if (button.dataset.courseMinutes) { changeMinutes(button.dataset.courseMinutes); render(); document.querySelector(`[data-course-minutes="${state.minutes}"]`)?.focus({ preventScroll: true }); return; }
  if (button.dataset.starterCourse) { void startReadyCourse(button.dataset.starterCourse); return; }
  const { roadmapAction, roadmapStage, roadmapBuy, roadmapClaim } = button.dataset;
  if (roadmapAction || roadmapBuy || roadmapClaim) {
    if (!ensureLearning() || roadmapOperation) return;
    if (roadmapAction === 'setup') beginRoadmap();
    else if (roadmapAction === 'skip' && roadmapWizard) {
      roadmapWizard = null;
      roadmapError = '';
      go(state.learningRoadmap ? 'roadmap' : 'discover');
    } else if (roadmapAction === 'back' && roadmapWizard?.step > 0) {
      captureRoadmapAnswers($('#roadmap-form'));
      roadmapWizard.step--;
      roadmapError = '';
      go('roadmap');
    } else if (roadmapAction === 'start' && /^[0-3]$/.test(roadmapStage)) {
      startRoadmapStage(Number(roadmapStage));
    } else if (roadmapBuy || roadmapClaim) {
      state.learningRewards = roadmapBuy ? buyRewardItem(state.learningRewards, roadmapBuy)
        : claimDailyQuest(state.learningRewards, roadmapClaim);
      save();
      render();
    }
    return;
  }
  const { view: destination, course, step: requestedStep, choice, color, action, id } = button.dataset;
  if (button.dataset.learningOpen) {
    if (ensureLearning()) void library.load(button.dataset.learningOpen).then(ok => { if (ok) go('learning-plan'); });
    return;
  }
  if (button.hasAttribute('data-learning-refresh')) { if (ensureLearning()) void library.refresh(); return; }
  if (button.hasAttribute('data-learning-import')) {
    if (legacyLesson && ensureLearning()) void library.importLocal(legacyLesson).then(ok => {
      if (ok) { state.importedLegacyLesson = true; saveLocal(); go('learning-plan'); }
    });
    return;
  }
  if (button.hasAttribute('data-builtin-import')) {
    if (ensureLearning() && canImportBuiltin()) {
      Object.assign(state, builtinData(legacyWorkspace));
      save();
      render();
      void builtins.flush();
    }
    return;
  }
  if (button.dataset.builtinSync) {
    if (!ensureLearning()) return;
    if (button.dataset.builtinSync === 'retry') void builtins.retry();
    if (button.dataset.builtinSync === 'load-latest') void builtins.loadLatest().then(ok => { if (ok) go('courses'); });
    return;
  }
  if (button.dataset.learningSync) {
    if (!ensureLearning()) return;
    const methods = { retry: 'flush', 'load-latest': 'loadLatest', 'save-copy': 'saveCopy' };
    const method = methods[button.dataset.learningSync];
    if (method) void library[method]();
    return;
  }
  if (button.matches('[data-home]')) {
    event.preventDefault();
    startingNew = false;
    captureRoadmapAnswers($('#roadmap-form'));
    rememberPosition();
    return go('discover');
  }
  if (destination || course) {
    captureRoadmapAnswers($('#roadmap-form'));
    const openCourse = () => {
      selectCourse(course);
      if (button.hasAttribute('data-course-path')) { state.lastLearningType = 'builtin'; saveLocal(); go('discover'); }
      else if (button.hasAttribute('data-start')) resumeCourse(course);
    };
    if (course && !ensureLearning(openCourse)) return;
    rememberPosition();
    if ($('#modal').open) $('#modal').close();
    if (destination) return go(destination);
    openCourse();
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
  if (button.dataset.recapChoice !== undefined && view === 'recap') { recap.choice = Number(button.dataset.recapChoice); recap.checked = false; render(); return; }
  if (dashboardAction(action, id)) return;
  switch (action) {
    case 'resume-course': resumeCourse(id); break;
    case 'certificate': openCertificate(id); break;
    case 'download-certificate': {
      const data = certificateData(state.active);
      const name = $('#certificate-name')?.value.trim();
      if (!data) return;
      if (!name) { $('#certificate-name')?.focus(); return toast('Add your name for your certificate.'); }
      state.certificates[state.active].name = name.slice(0, 80); save();
      downloadCertificate(certificateData(state.active)); toast('Your certificate is ready to download.'); break;
    }
    case 'recap-check': if (recap.choice !== null) { recap.checked = true; render(); } break;
    case 'recap-next':
      if (recap.phase && (!recap.checked || recap.choice !== recapQuestion(state.active, recap.phase - 1).answer)) return;
      if (recap.phase === 2) { const cursor = pendingCursor || resumeCursor(state, state.active); const practice = pendingPractice; pendingCursor = null; pendingPractice = false; restoreLesson(cursor); if (practice) mixPractice(); }
      else { recap = { phase: recap.phase + 1, choice: null, checked: false }; go('recap'); }
      break;
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

window.addEventListener('mindora:learn-page', event => {
  if (event.detail?.courseId === state.active) rememberPosition(event.detail.page);
});
window.addEventListener('pagehide', () => {
  rememberPosition(undefined, false);
  if (view === 'learning-plan' && !document.hidden) { rememberLearningVisit(); saveLocal(); }
  if (accountReady) { void library.flush(); void builtins.flush(); }
});
window.addEventListener('storage', event => {
  if (event.key !== KEY && event.key !== null) return;
  try {
    if (event.storageArea && event.storageArea !== localStorage) return;
    if (workspaceStorage.hasConflict()) showWorkspaceConflict($('#main'));
  } catch { /* The existing save warning handles unavailable browser storage. */ }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    rememberPosition();
    if (view === 'learning-plan') { rememberLearningVisit(); saveLocal(); }
    if (accountReady) { void library.flush(); void builtins.flush(); }
  }
  else if (view === 'lesson' && needsRecap(state, state.active)) resumeCourse();
  else if (view === 'learning-plan') reviewLearningPlan();
});
document.addEventListener('input', event => {
  if (view === 'lesson' && event.target.closest('#main')) rememberPosition();
  if (view === 'certificate' && event.target.id === 'certificate-name' && certificateEligible(state, state.active)) {
    state.certificates[state.active].name = event.target.value.slice(0, 80); save();
    refreshCertificatePreview(certificateData(state.active));
  }
});
window.addEventListener('mindora:account-changed', event => {
  const account = getAccountState();
  const owner = account.user?.id || null;
  const reason = event.detail?.reason;
  if (reason === 'signout') { pendingLearning = null; pendingRoadmapPrefill = null; }
  const signupComplete = reason === 'signup-complete';
  if (owner === accountOwner && accountReady && !signupComplete) { void cloud.init(); return; }
  const version = ++accountEpoch;
  accountReady = false;
  if (owner !== accountOwner) {
    const language = state.language;
    accountOwner = owner;
    roadmapWizard = null;
    roadmapOperation = null;
    roadmapError = '';
    KEY = owner ? `${LEGACY_KEY}.${encodeURIComponent(owner)}` : `${LEGACY_KEY}.guest`;
    workspaceStorage = makeWorkspaceStorage();
    const restored = readState();
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, restored, { language });
    builtinSnapshot = JSON.stringify(builtinData(state));
    for (const field of ['sessions', 'certificates']) if (!state[field] || typeof state[field] !== 'object' || Array.isArray(state[field])) state[field] = {};
    plans.reset();
    view = 'discover';
    startingNew = false;
    if (!pendingLearning) introduction = { step: owner ? 2 : 0, name: account.profile?.name || '', topic: '', goal: '', minutes: state.minutes };
    checks = null;
    quizIndex = 0; quizChoice = null; quizFeedback = false; step = 0;
    saveWarning = false;
    render();
  }
  if (owner && signupComplete && !pendingLearning) go('discover');
  void Promise.all([library.setUser(account.user), builtins.setUser(account.user)]).then(() => {
    if (version !== accountEpoch || owner !== accountOwner) return;
    accountReady = Boolean(owner);
    if (owner && state.learningPlan?.completed === state.learningPlan?.plan.steps.length && state.learningCourse?.id) {
      reconcileRoadmapCompletion(state.learningCourse.id);
    }
    if (reason === 'signup-profile-pending') return;
    if (owner && pendingLearning) {
      const next = pendingLearning;
      pendingLearning = null;
      if (!signupComplete) closeAccount();
      next();
    } else render();
  });
  void cloud.init();
});
mountShell();
mountReturnReview({
  getReview: () => state.returnReview,
  isActive: () => view === 'return-review' && accountReady,
  onChange(review, options) { state.returnReview = review; saveLocal(); if (options.render && review.phase !== 'complete') render(); },
  onComplete(review) {
    delete state.returnReview;
    if (review.key.startsWith('builtin:')) {
      const id = review.key.slice(8);
      if (!COURSES[id]) return go('discover');
      state.active = id;
      state.sessions[id] = { ...state.sessions[id], lastSeen: Date.now() };
      save(); restoreLesson(review.cursor || resumeCursor(state, id));
      if (review.intent === 'practice') mixPractice();
    } else if (review.key === learningVisitKey()) {
      rememberLearningVisit(); saveLocal(); go('learning-plan');
    } else { saveLocal(); go('courses'); }
  },
});

$('#modal').addEventListener('click',e=>{if(e.target===$('#modal')){const r=$('#modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('#modal').close();}});
if (view === 'lesson') resumeCourse(state.active, step);
else render();
void cloud.init();
if (accountOwner) {
  void library.setUser(getAccountState().user);
  void builtins.setUser(getAccountState().user);
}
