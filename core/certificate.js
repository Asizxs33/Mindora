/** A self-contained keepsake of a completed Mindora course, not an accreditation. */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

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

export function certificateDate(completedAt) {
  if (completedAt == null || completedAt === '') return 'Completion date unavailable';
  const date = new Date(completedAt);
  if (!Number.isFinite(date.getTime())) return 'Completion date unavailable';
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
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

export function certificateSvg({ name, courseTitle, completedAt, certificateId } = {}) {
  const learner = safeText(name) || 'Your name';
  const course = safeText(courseTitle) || 'Your Mindora course';
  const id = safeText(certificateId) || 'Not assigned';
  const nameLines = wrapText(learner, 38);
  const courseLines = wrapText(course, 52);
  const nameSize = Math.min(58, 100 / nameLines.length);
  const courseSize = Math.min(36, 82 / courseLines.length);
  const textLines = (lines, y, size, color, weight = 600) => lines.map((line, index) => `<text x="700" y="${y + index * size * 1.2}" text-anchor="middle" fill="${color}" font-size="${size}" font-weight="${weight}">${escapeXml(line)}</text>`).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="297mm" height="210mm" viewBox="0 0 1400 990" role="img" aria-label="Mindora certificate of completion">
<title>Certificate of completion — ${escapeXml(course)}</title>
<desc>${escapeXml(learner)} completed ${escapeXml(course)}. ${escapeXml(certificateDate(completedAt))}. Certificate ID: ${escapeXml(id)}.</desc>
<rect width="1400" height="990" fill="#ffffff"/>
<rect x="23" y="23" width="1354" height="944" rx="28" fill="#ffffff" stroke="#5B4CFF" stroke-width="8"/>
<rect x="48" y="48" width="1304" height="894" rx="12" fill="none" stroke="#E4DFFF" stroke-width="2"/>
<path d="M1208 48H1352V191Z" fill="#F1EEFF"/><path d="M48 797V942H193Z" fill="#F1EEFF"/>
<g font-family="Arial, Helvetica, sans-serif">
  <g transform="translate(112 94) scale(.7)">${BRAND_MARK}</g>
  <text x="198" y="145" fill="#29243F" font-size="44" font-weight="700" letter-spacing="-1.8">mindora<tspan fill="#5B4CFF">.</tspan></text>
  <text x="1288" y="136" text-anchor="end" fill="#6B647C" font-size="16" letter-spacing="2">SMALL STEPS. REAL PROGRESS.</text>
  <text x="700" y="248" text-anchor="middle" fill="#5B4CFF" font-size="16" font-weight="700" letter-spacing="5">A MOMENT TO BE PROUD OF</text>
  <text x="700" y="321" text-anchor="middle" fill="#29243F" font-size="58" font-weight="700" letter-spacing="-2">Certificate of completion</text>
  <text x="700" y="394" text-anchor="middle" fill="#6B647C" font-size="22">This celebrates</text>
  ${textLines(nameLines, nameLines.length > 1 ? 464 : 490, nameSize, '#5B4CFF', 700)}
  <path d="M370 565H1030" stroke="#E4DFFF" stroke-width="2"/>
  <text x="700" y="618" text-anchor="middle" fill="#6B647C" font-size="22">for completing the Mindora course</text>
  ${textLines(courseLines, 680, courseSize, '#29243F', 700)}
  <text x="700" y="782" text-anchor="middle" fill="#6B647C" font-size="20">You learned something new. Now make it your own.</text>
  <text x="116" y="849" fill="#6B647C" font-size="14" letter-spacing="1.5">COMPLETED</text>
  <text x="116" y="881" fill="#29243F" font-size="20" font-weight="600">${escapeXml(certificateDate(completedAt))}</text>
  <text x="1284" y="849" text-anchor="end" fill="#6B647C" font-size="14" letter-spacing="1.5">CERTIFICATE ID</text>
  <text x="1284" y="881" text-anchor="end" fill="#29243F" font-size="${Math.min(17, 680 / Math.max([...id].length, 1))}" font-family="monospace">${escapeXml(id)}</text>
</g>
<g transform="translate(700 872)"><circle r="38" fill="#F1EEFF"/><circle r="29" fill="#5B4CFF"/><path d="M-12 0L-3 9L14-10" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></g>
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
