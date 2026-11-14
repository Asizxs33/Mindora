import { escapeHtml as esc } from '../core/engine.js';
import { certificateSvg, certificateDate } from '../core/certificate.js';
import { icon } from './icons.js';

// Native browser modules load styles the same way as the other Mindora screens.
if (typeof document !== 'undefined' && !document.getElementById('mindora-certificate-styles')) {
  const stylesheet = document.createElement('link');
  stylesheet.id = 'mindora-certificate-styles';
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('./certificate.css', import.meta.url).href;
  document.head.append(stylesheet);
}

/** The controller decides eligibility and supplies the saved completion record. */
export function certificateView({ name = '', courseTitle = '', completedAt, certificateId = '' } = {}) {
  return `<section class="certificate-page" aria-labelledby="certificate-heading">
    <button class="back-button certificate-back" type="button" data-view="path">${icon('back', 18)} Back to my course</button>
    <header class="certificate-heading"><span class="certificate-success">${icon('check', 16)} Course complete</span><h1 id="certificate-heading">You made it.</h1><p>A little proof of the progress you’ve made.</p></header>
    <figure class="certificate-preview" aria-label="Certificate preview">${certificateSvg({ name, courseTitle, completedAt, certificateId })}<figcaption>Certificate of completion · ${esc(courseTitle || 'Your Mindora course')}</figcaption></figure>
    <div class="certificate-details"><p><span>Completed</span><strong>${esc(certificateDate(completedAt))}</strong></p><p><span>Certificate ID</span><strong>${esc(certificateId || 'Not assigned')}</strong></p></div>
    <div class="certificate-personalize"><label class="field" for="certificate-name"><span>Your name on the certificate</span><input id="certificate-name" name="certificate-name" type="text" maxlength="80" autocomplete="name" value="${esc(name)}" placeholder="Enter your name" aria-describedby="certificate-name-help"></label><p class="small-note" id="certificate-name-help">Use the name you’d like to share.</p></div>
    <div class="certificate-actions"><button class="primary" type="button" data-action="download-certificate">${icon('download', 20)} Download certificate</button><p class="small-note">A sharp SVG file you can keep or print.</p></div>
  </section>`;
}

export function refreshCertificatePreview(data) {
  const svg = document.querySelector('.certificate-preview svg');
  if (svg) svg.outerHTML = certificateSvg(data);
}
