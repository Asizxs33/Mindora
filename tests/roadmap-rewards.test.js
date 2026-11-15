import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBuiltinWorkspace } from '../backend/builtin-workspace.js';
import { normalizeRoadmap, roadmapInput, roadmapStageStatuses, restoreRoadmap, updateRoadmapStage } from '../core/roadmap-model.js';
import { buyRewardItem, claimDailyQuest, recordCheckReward, recordLessonReward, rewardScreen } from '../core/roadmap-rewards.js';

const date = (day, hour = 12) => new Date(2026, 10, day, hour).getTime();
const id = number => `10000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const input = {
  goal: 'Make a useful spreadsheet',
  minutes: 5,
  language: 'en',
  experience: 'some',
  evidence: 'I can add values manually.',
  motivation: 'work',
};
const provider = {
  level: 'intermediate', levelReason: 'You already know how to enter and add numbers.',
  title: 'Build a spreadsheet', outcome: 'Finish a small spending report with formulas.',
  stages: [
    { title: 'Set up the data', objective: 'Enter and label three expense categories.' },
    { title: 'Sum up totals', objective: 'Add expense amounts with SUM.' },
    { title: 'Calculate remaining funds', objective: 'Subtract those expenses from the monthly budget.' },
    { title: 'Build an independent report', objective: 'Make a report for a new month and verify the balance.' },
  ],
};

test('roadmap input retains prior work to inform placement; saved maps retain only structured content and progress', () => {
  assert.deepEqual(roadmapInput({ ...input, evidence: '   ' }), { ...input, evidence: '' });
  assert.equal(roadmapInput({ ...input, evidence: 'x'.repeat(361) }), null);
  assert.equal(roadmapInput({ ...input, experience: 'expert' }), null);
  const map = normalizeRoadmap({ ...provider, goal: 'Wrong goal from model', minutes: 20, private: 'ignored' }, input);
  assert.equal(map.goal, input.goal);
  assert.equal(map.minutes, input.minutes);
  assert.equal(map.evidence, undefined);
  assert.equal(map.private, undefined);
  assert.equal(normalizeRoadmap({ ...provider, stages: [...provider.stages.slice(0, 3), provider.stages[0]] }, input), null);
});

test('gem shop top-up preserves the current recharge and never overspends', () => {
  const now = date(14), inTenMinutes = now + 600000;
  const oneLost = recordCheckReward(undefined, id(1), 0, false, now);
  const twoLost = recordCheckReward(oneLost, id(1), 0, false, now);
  const purchase = buyRewardItem(twoLost, 'one-heart', inTenMinutes);
  assert.equal(purchase.hearts, 4);
  assert.equal(purchase.gems, 16);
  assert.equal(purchase.heartAt, now);
  assert.equal(rewardScreen(purchase, date(14,13)).hearts, 5);
  for (const item of ['hearts','one-heart','freeze','mistake-shield','lesson-bonus','unknown']) {
    const poor = { ...twoLost, gems:0 };
    assert.deepEqual(buyRewardItem(poor, item, now), poor);
  }
  const top = buyRewardItem(purchase,'one-heart', now);
  assert.equal(top.heartAt,0);
  assert.deepEqual(buyRewardItem(top,'one-heart', now),top);
});

test('a second chance survives sync and protects one mistake on a scored lesson', () => {
  const now = date(14);
  const purchase = buyRewardItem(undefined, 'mistake-shield', now);
  assert.deepEqual([purchase.gems,purchase.shields],[16,1]);
  assert.deepEqual(buyRewardItem(purchase,'mistake-shield',now), purchase);
  const saved = validateBuiltinWorkspace({learningRewards:purchase}).learningRewards;
  assert.deepEqual(saved,purchase);
  const protectedCheck = recordCheckReward(saved,id(1),0,false,now);
  assert.deepEqual([protectedCheck.hearts,protectedCheck.shields],[5,0]);
  const missed = recordCheckReward(protectedCheck,id(1),0,false,now);
  assert.deepEqual([missed.hearts,missed.heartAt],[4,now]);
  assert.equal(rewardScreen(missed,now).items.find(it=>it.id==='mistake-shield').available,true);
});

test('lesson bonus rewards exactly three distinct completions and legacy records have no active items', () => {
  const now = date(14);
  let state = buyRewardItem(undefined,'lesson-bonus',now);
  assert.deepEqual([state.gems,state.bonusLessons],[12,3]);
  assert.deepEqual(buyRewardItem(state,'lesson-bonus',now),state);
  for (let i=1;i<=4;i++) {
    state=recordLessonReward(state,id(i),now);
    assert.equal(state.bonusLessons,Math.max(0,3-i));
    assert.deepEqual(recordLessonReward(state,id(i),now),state);
    state=validateBuiltinWorkspace({learningRewards:state}).learningRewards;
  }
  assert.equal(state.gems,44);
  assert.equal(rewardScreen(state,now).items.find(it=>it.id==='lesson-bonus').available,true);
  const {shields,bonusLessons,...legacy}=state;
  const migrated=validateBuiltinWorkspace({learningRewards:legacy}).learningRewards;
  assert.deepEqual([migrated.gems,migrated.shields,migrated.bonusLessons],[44,0,0]);
});

test('roadmap supports studying stages in any order and restores linked courses through workspace storage', () => {
  const fresh = restoreRoadmap(normalizeRoadmap(provider, input));
  assert.deepEqual(roadmapStageStatuses(fresh).map(stage => stage.status), ['ready', 'available', 'available', 'available']);
  const skipped = updateRoadmapStage(fresh, 1, id(2), true);
  assert.deepEqual(restoreRoadmap(skipped).progress.map(p => p.completed), [false, true, false, false]);
  const started = updateRoadmapStage(fresh, 0, id(1));
  assert.deepEqual(roadmapStageStatuses(started).map(stage => stage.status), ['active', 'available', 'available', 'available']);
  assert.equal(updateRoadmapStage(started, 0, id(2), true), started, 'a different course cannot complete the stage');
  const finished = updateRoadmapStage(started, 0, id(1), true);
  assert.deepEqual(roadmapStageStatuses(finished).map(stage => stage.status), ['completed', 'ready', 'available', 'available']);
  assert.equal(updateRoadmapStage(finished, 1, id(1)), finished, 'one course cannot be linked twice');
  const rewards = recordLessonReward(undefined, id(1), date(14));
  const data = validateBuiltinWorkspace({ learningRoadmap: finished, learningRewards: rewards });
  assert.deepEqual(data.learningRoadmap, finished);
  assert.deepEqual(data.learningRewards, rewards);
  assert.equal(validateBuiltinWorkspace({ learningRewards: { ...rewards, gems: -1 } }), null);
  assert.equal(validateBuiltinWorkspace({ learningRoadmap: { ...fresh, progress: [started.progress[0], started.progress[0], ...fresh.progress.slice(2)] } }), null);
});

test('a narrowed path retains its original subject through account workspace save and restore', () => {
  const context = { ...input, goal: 'Summarize a short list of expenses', originalGoal: ' Python ' };
  const map = normalizeRoadmap({ ...provider, originalGoal: 'Wrong model topic' }, context);
  assert.equal(map.goal, context.goal);
  assert.equal(map.originalGoal, 'Python', 'the original subject comes from the validated request, not model output');
  const saved = restoreRoadmap(JSON.parse(JSON.stringify(map)));
  assert.equal(saved.originalGoal, 'Python');
  assert.deepEqual(validateBuiltinWorkspace({ learningRoadmap: saved }).learningRoadmap, saved);
  assert.equal(normalizeRoadmap({ ...provider, originalGoal: 'Injected topic' }, input).originalGoal, undefined);
  assert.equal(restoreRoadmap(normalizeRoadmap(provider, input)).originalGoal, undefined, 'old paths need no migration');
  for (const originalGoal of ['', 'x'.repeat(181), null, 'Python\u0000']) {
    assert.equal(normalizeRoadmap(provider, { ...context, originalGoal }), null);
    assert.equal(restoreRoadmap({ ...map, originalGoal }), null);
  }
});

test('game actions spend and refill hearts, deduplicate quiz and lesson rewards, and allow one daily quest claim', () => {
  const now = date(14);
  const loss = recordCheckReward(undefined, id(1), 0, false, now);
  assert.equal(rewardScreen(loss, now).hearts, 4);
  assert.equal(rewardScreen(loss, date(14, 13)).hearts, 5);
  const refill = buyRewardItem(loss, 'hearts', now);
  assert.equal(rewardScreen(refill, now).hearts, 5);
  assert.equal(refill.gems, 8);
  assert.deepEqual(buyRewardItem(refill, 'hearts', now), refill);
  const correct = recordCheckReward(refill, id(1), 0, true, now);
  assert.deepEqual(recordCheckReward(correct, id(1), 0, true, now), correct);
  const twoChecks = recordCheckReward(correct, id(1), 1, true, now);
  assert.equal(rewardScreen(twoChecks, now).quests[1].claimable, true);
  const claimed = claimDailyQuest(twoChecks, 'correct-check', now);
  assert.equal(claimed.gems, 16);
  assert.deepEqual(claimDailyQuest(claimed, 'correct-check', now), claimed);
  const finished = recordLessonReward(claimed, id(1), now);
  assert.equal(finished.gems, 21);
  assert.deepEqual(recordLessonReward(finished, id(1), now), finished);
  assert.equal(rewardScreen(finished, date(15)).quests.some(quest => quest.claimable), false);
  assert.equal(rewardScreen(finished, date(15)).quests[0].progress, 0);
});

test('a streak grows on different days and spends a purchased freeze across one missed day', () => {
  const first = recordLessonReward(undefined, id(1), date(10));
  const claimed = claimDailyQuest(first, 'finish-lesson', date(10));
  const second = recordLessonReward(claimed, id(2), date(11));
  assert.equal(rewardScreen(second, date(11)).streak, 2);
  const frozen = buyRewardItem(second, 'freeze', date(11));
  assert.equal(frozen.gems, second.gems - 25);
  assert.deepEqual(buyRewardItem(frozen, 'freeze', date(11)), frozen);
  assert.equal(rewardScreen(frozen, date(13)).streak, 2);
  const restored = recordLessonReward(frozen, id(3), date(13));
  assert.equal(rewardScreen(restored, date(13)).streak, 3);
  assert.equal(restored.freezes, 0);
  assert.equal(rewardScreen(restored, date(15)).streak, 0);
});
