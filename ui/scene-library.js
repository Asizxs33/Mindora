import { LEARNING_SCENES, renderLearningScene } from './learning-scenes.js';
import { learningSceneExamples } from './learning-scene-examples.js';
import { mentorScene } from './mentor-scenes.js';
import { mountCharacters } from './characters.js';
import { escapeHtml as esc } from '../core/engine.js';

const picker = document.getElementById('scene-picker');
let current = 0;
learningSceneExamples.forEach(({ scene }, index) => {
  const option = document.createElement('option'); option.value = index;
  option.textContent = LEARNING_SCENES[scene.type].label; picker.append(option);
});
function render() {
  const { mentor, prompt, scene } = learningSceneExamples[current];
  document.getElementById('scene-stage').innerHTML = `${mentorScene(mentor, 'explaining', `<p>${esc(prompt)}</p>`)}${renderLearningScene(scene)}`;
  document.getElementById('scene-data').textContent = JSON.stringify(scene, null, 2);
  picker.value = String(current);
}
picker.addEventListener('change', () => { current = Number(picker.value); render(); });
document.getElementById('scene-next').addEventListener('click', () => { current = (current + 1) % learningSceneExamples.length; render(); picker.focus(); });
mountCharacters(); render();
