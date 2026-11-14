import test from 'node:test';
import assert from 'node:assert/strict';
import { certificateSvg, certificateDate, downloadCertificate } from '../core/certificate.js';
import { certificateView } from '../ui/certificate.js';

const completion = { name: 'Alex Morgan', courseTitle: 'Your first poster', completedAt: '2026-11-14T18:30:00.000Z', certificateId: 'MINDORA-DESIGN-20261114' };

test('certificate is deterministic and contains the supplied completion record', () => {
  const svg = certificateSvg(completion);
  assert.equal(svg, certificateSvg({ ...completion }));
  assert.match(svg, /width="297mm" height="210mm"/);
  for (const text of ['Certificate of completion', 'Alex Morgan', 'Your first poster', 'November 14, 2026', completion.certificateId]) assert.ok(svg.includes(text), text);
  assert.doesNotMatch(svg, /<script|<foreignObject|<image|\bonload=|https?:\/\/(?!www\.w3\.org)/);
});

test('all supplied strings stay text instead of becoming SVG elements or attributes', () => {
  const malicious = `</text><script>alert("x")</script> & 'hello'`;
  const svg = certificateSvg({ name: malicious, courseTitle: malicious, certificateId: malicious, completedAt: malicious });
  assert.doesNotMatch(svg, /<script>|<\/text><script>/);
  assert.ok(svg.includes('&lt;script&gt;'));
  assert.ok(svg.includes('&quot;x&quot;'));
  assert.ok(svg.includes('&amp; &apos;hello&apos;'));
  assert.ok(svg.includes('Completion date unavailable'));
  assert.doesNotMatch(svg, /NaN|Invalid Date/);
});

test('SVG removes XML-forbidden code points and retains valid multilingual names', () => {
  const svg = certificateSvg({ ...completion, name: 'Әлия 李明 🦫\u0000\u000b\ud800' });
  assert.ok(svg.includes('Әлия 李明 🦫'));
  assert.doesNotMatch(svg, /[\u0000\u000b]|\ud800/u);
});

test('completion date is UTC-stable and never invented for missing data', () => {
  assert.equal(certificateDate('2026-11-15T00:30:00+05:00'), 'November 14, 2026');
  assert.equal(certificateDate(new Date('2026-11-14T12:00:00Z')), 'November 14, 2026');
  for (const value of [null, undefined, '', 'not a date']) assert.equal(certificateDate(value), 'Completion date unavailable');
  assert.equal(certificateSvg(), certificateSvg({}));
});

test('account input and certificate strings are escaped in the UI without removing integration hooks', () => {
  const name = `"><img src=x onerror="alert(1)">`;
  const html = certificateView({ ...completion, name, courseTitle: '<script>hello</script>' });
  assert.doesNotMatch(html, /<img src=x|<script>hello/);
  assert.match(html, /id="certificate-name"[^>]*maxlength="80"/);
  assert.match(html, /value="&quot;&gt;&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;"/);
  assert.match(html, /data-action="download-certificate"/);
  assert.match(html, /data-view="path"/);
});

test('download does not attempt browser work during server-side use', () => {
  assert.throws(() => downloadCertificate(completion), /available in the browser/);
});
