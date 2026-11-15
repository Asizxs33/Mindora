/** A self-contained keepsake of a completed Mindora course, not an accreditation. */
import { languageCode } from './language.js';

const copy = {
  en: { locale: 'en-US', title: 'Certificate of completion', awarded: 'Presented to', course: 'for completing the Mindora course',
    completed: 'Date completed', number: 'Certificate ID', noDate: 'Completion date unavailable', name: 'Your name', courseName: 'Your Mindora course', noId: 'Not assigned' },
  ru: { locale: 'ru-RU', title: 'Сертификат об окончании', awarded: 'Выдан', course: 'за прохождение курса Mindora',
    completed: 'Дата окончания', number: 'Номер сертификата', noDate: 'Дата окончания недоступна', name: 'Твоё имя', courseName: 'Твой курс Mindora', noId: 'Не назначен' },
  kk: { locale: 'kk-KZ', title: 'Курсты аяқтау сертификаты', awarded: 'Марапатталады', course: 'Mindora курсын аяқтағаны үшін',
    completed: 'Аяқтаған күні', number: 'Сертификат нөмірі', noDate: 'Аяқтаған күні белгісіз', name: 'Есімің', courseName: 'Mindora курсың', noId: 'Тағайындалмаған' },
};

// SVG is XML: remove forbidden controls/unpaired surrogates before escaping text.
function safeText(value) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDFFF]/gu, '').trim();
}

function escapeXml(value) {
  return safeText(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
}

function wrapText(value, width) {
  const words = safeText(value).split(/\s+/u);
  const lines = [];
  let line = '';
  for (let word of words) {
    if (line && [...`${line} ${word}`].length > width) { lines.push(line); line = ''; }
    while ([...word].length > width) {
      const letters = [...word];
      lines.push(letters.slice(0, width).join(''));
      word = letters.slice(width).join('');
    }
    line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

export function certificateDate(completedAt, language) {
  const { locale, noDate } = copy[languageCode(language)];
  if (completedAt == null || completedAt === '') return noDate;
  const date = new Date(completedAt);
  if (!Number.isFinite(date.getTime())) return noDate;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(date);
}

export function restoreCertificateRecord(value) {
  const { name, completedAt, certificateId } = value ?? {};
  if (typeof name !== 'string' || name.length > 80 || /[\u0000\u000b\u000c\u007f]/u.test(name)
    || typeof certificateId !== 'string' || !/^[A-Za-z0-9-]{1,80}$/.test(certificateId)) return null;
  if (completedAt !== null && (typeof completedAt !== 'string' || completedAt.length > 40
    || !/^\d{4}-\d\d-\d\dT/.test(completedAt) || !Number.isFinite(Date.parse(completedAt)))) return null;
  return { name, completedAt, certificateId };
}

// Same original Mino mark as ui/assets/brand-mark.svg, embedded for offline printing.
const BRAND_MARK = `<g stroke="#422C24" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M24 29C15 23 18 9 25 10C33 11 33 22 31 29M69 28C66 17 69 9 76 10C84 12 83 23 77 29" fill="#F5B66B"/>
  <path d="M17 43C17 28 29 22 48 22C70 21 83 28 84 44L85 65C84 80 71 88 51 88C30 88 17 81 15 66Z" fill="#F5B66B"/>
  <path d="M43 72L44 82Q50 87 57 82L58 72" fill="#FFFCF3" stroke-width="4"/><path d="M51 76V83" stroke-width="3"/>
  <path d="M8 42H4M92 42H96" stroke-width="7"/>
  <path d="M11 35Q27 29 43 35L44 55Q42 66 27 66Q13 66 11 55L9 44Q8 38 11 35Z" fill="#FFE4B4"/>
  <path d="M58 35Q74 29 90 35Q94 39 91 48L89 57Q87 66 73 66Q60 66 57 56L56 43Q55 38 58 35Z" fill="#FFE4B4"/>
  <path d="M44 41Q50 37 56 41" stroke-width="6"/>
  <path d="M39 52Q41 44 50 44Q60 44 62 52L65 65Q63 74 51 75Q38 75 35 67Z" fill="#B98D76" stroke-width="4.5"/>
</g><ellipse cx="27" cy="47" rx="3.8" ry="6" fill="#422C24"/><ellipse cx="74" cy="47" rx="3.8" ry="6" fill="#422C24"/>
<path d="M43 61V64M56 61V64" stroke="#422C24" stroke-width="3.5" stroke-linecap="round"/>
<path d="M16 43L22 39M18 49L29 39M62 43L68 39M65 49L76 38" stroke="#FFFCF3" stroke-width="3.8" stroke-linecap="round"/>`;

export function certificateSvg({ name, courseTitle, completedAt, certificateId, language } = {}) {
  const lang = languageCode(language);
  const labels = copy[lang];
  const learner = safeText(name) || labels.name;
  const course = safeText(courseTitle) || labels.courseName;
  const id = safeText(certificateId) || labels.noId;
  const date = certificateDate(completedAt, lang);
  const nameLines = wrapText(learner, 38);
  const courseLines = wrapText(course, 52);
  const maxLine = lines => Math.max(1, ...lines.map(line => [...line].length));
  const nameSize = Math.min(60, 100 / nameLines.length, 1120 / maxLine(nameLines));
  const courseSize = Math.min(36, 82 / courseLines.length, 1120 / maxLine(courseLines));
  const textLines = (lines, y, size, color) => lines.map((line, index) => `<text x="700" y="${y + index * size * 1.2}" text-anchor="middle" fill="${color}" font-size="${size}" font-weight="700">${escapeXml(line)}</text>`).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="297mm" height="210mm" viewBox="0 0 1400 990" role="img" xml:lang="${lang}" aria-label="${labels.title} · Mindora">
<title>${labels.title} — ${escapeXml(course)}</title>
<desc>${escapeXml(learner)} · ${escapeXml(course)} · ${escapeXml(date)} · ${labels.number} ${escapeXml(id)}</desc>
<rect width="1400" height="990" fill="#fffaf2"/>
<rect x="24" y="24" width="1352" height="942" rx="24" fill="none" stroke="#865133" stroke-width="3"/>
<rect x="45" y="45" width="1310" height="900" rx="14" fill="none" stroke="#d9b997" stroke-width="1.5"/>
<path d="M72 128V72h56m1144 0h56v56m0 734v56h-56m-1144 0H72v-56" fill="none" stroke="#a96837" stroke-width="3"/>
<g font-family="Arial, Helvetica, sans-serif">
  <g transform="translate(580 104) scale(.73)">${BRAND_MARK}</g>
  <text x="664" y="153" fill="#2d201b" font-size="44" font-weight="700" letter-spacing="-1.7">mindora<tspan fill="#a65122">.</tspan></text>
  <path d="M622 209h59m38 0h59" stroke="#c49973" stroke-width="1.5"/><path d="m700 203 6 6-6 6-6-6z" fill="#a96837"/>
  <g font-family="Georgia, 'Times New Roman', serif">
    <text x="700" y="311" text-anchor="middle" fill="#2d201b" font-size="57" font-weight="700">${labels.title}</text>
    ${textLines(nameLines, nameLines.length > 1 ? 426 : 472, nameSize, '#92421b')}
  </g>
  <text x="700" y="373" text-anchor="middle" fill="#674d3b" font-size="22">${labels.awarded}</text>
  <path d="M460 557H940" stroke="#d9b997" stroke-width="1.5"/>
  <text x="700" y="610" text-anchor="middle" fill="#674d3b" font-size="22">${labels.course}</text>
  ${textLines(courseLines, 670, courseSize, '#2d201b')}
  <path d="M130 793H1270" stroke="#d9b997" stroke-width="1.5"/>
  <text x="130" y="838" fill="#674d3b" font-size="16">${labels.completed}</text>
  <text x="130" y="872" fill="#2d201b" font-size="21" font-weight="600">${escapeXml(date)}</text>
  <text x="1270" y="838" text-anchor="end" fill="#674d3b" font-size="16">${labels.number}</text>
  <text x="1270" y="872" text-anchor="end" fill="#2d201b" font-size="${Math.min(17, 680 / Math.max([...id].length, 1))}" font-family="monospace">${escapeXml(id)}</text>
</g>
<g transform="translate(700 855)"><circle r="33" fill="none" stroke="#bc8d62" stroke-width="1.5"/><circle r="27" fill="#f0ddc5"/><path d="M-11 0l7 7 15-15" fill="none" stroke="#8f421d" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g>
</svg>`;
}

export function downloadCertificate(data) {
  if (typeof document === 'undefined') throw new Error('Certificate downloads are available in the browser.');
  const fileName = 'mindora-certificate.svg';
  const blob = new Blob([certificateSvg(data)], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  try {
    document.body.append(link);
    link.click();
  } finally {
    link.remove();
    // Give Safari time to consume the Blob before releasing it.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return fileName;
}
