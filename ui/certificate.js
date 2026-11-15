import { currentLanguage, t } from './language.js';
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

export function courseCertificateButton(kind) {
  return `<button type="button" class="primary" data-action="certificate" data-certificate-kind="${esc(kind)}">${icon('cap', 19)} ${t('Course certificate', 'Сертификат курса', 'Курс сертификаты')}</button>`;
}

/** The controller decides eligibility and supplies the saved completion record. */
export function certificateView({ name = '', courseTitle = '', completedAt, certificateId = '', back = 'path' } = {}) {
  const language = currentLanguage();
  return `<section class="certificate-page" aria-labelledby="certificate-heading">
    <button class="back-button certificate-back" type="button" data-view="${esc(back)}">${icon('back', 18)} ${t("Back to my course", "Вернуться к курсу", "Курсқа оралу")}</button>
    <header class="certificate-heading"><h1 id="certificate-heading">${t("Certificate of completion", "Сертификат об окончании", "Аяқтау сертификаты")}</h1><p>${esc(courseTitle)}</p></header>
    <figure class="certificate-preview" aria-label="${t("Certificate preview", "Предпросмотр сертификата", "Сертификатты алдын ала көру")}">${certificateSvg({ name, courseTitle, completedAt, certificateId, language })}</figure>
    <div class="certificate-details"><p><span>${t("Completed", "Завершён", "Аяқталды")}</span><strong>${esc(certificateDate(completedAt, language))}</strong></p><p><span>${t("Certificate ID", "Номер сертификата", "Сертификат нөмірі")}</span><strong>${esc(certificateId || t("Not assigned", "Не назначен", "Тағайындалмаған"))}</strong></p></div>
    <div class="certificate-personalize"><label class="field" for="certificate-name"><span>${t("Your name on the certificate", "Твоё имя на сертификате", "Сертификаттағы есімің")}</span><input id="certificate-name" name="certificate-name" type="text" maxlength="80" autocomplete="name" value="${esc(name)}" placeholder="${t("Enter your name", "Введи имя", "Есіміңді енгіз")}" aria-describedby="certificate-name-help"></label><p class="small-note" id="certificate-name-help">${t("Use the name you’d like to share.", "Укажи имя, которое хочешь видеть на сертификате.", "Сертификатта көрінетін есіміңді жаз.")}</p></div>
    <div class="certificate-actions"><button class="primary" type="button" data-action="download-certificate">${icon('download', 20)} ${t("Download certificate", "Скачать сертификат", "Сертификатты жүктеу")}</button><p class="small-note">${t("A sharp SVG file you can keep or print.", "Файл SVG можно сохранить или распечатать.", "SVG файлын сақтауға немесе басып шығаруға болады.")}</p></div>
  </section>`;
}

export function refreshCertificatePreview(data) {
  const svg = document.querySelector('.certificate-preview svg');
  if (svg) svg.outerHTML = certificateSvg({ ...data, language: currentLanguage() });
}
