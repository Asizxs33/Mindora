import { character, mountCharacters } from './characters.js';

// Account state is held in memory. Credentials and profile drafts are never stored locally.
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const topics = ['Design', 'Coding', 'Languages', 'Spreadsheets', 'Writing', 'Marketing', 'Photography', 'Everyday skills'];
const genders = [['', 'Choose, if you like'], ['woman', 'Woman'], ['man', 'Man'], ['nonbinary', 'Non-binary'], ['other', 'Another identity'], ['prefer_not_to_say', 'Prefer not to say']];
const emptyDraft = () => ({ name: '', age: '', gender: '', interests: [], email: '', password: '', confirm: '', custom: '' });
let mounted = false, dialog, returnFocus, sessionPromise, sessionVersion = 0;
let session = { available: null, user: null, profile: null };
let loadingSession = false;
let view = { mode: 'signup', step: 0, pending: false, error: '', notice: '', showPassword: false, showConfirm: false, draft: emptyDraft() };

function emitSession() {
  window.dispatchEvent(new CustomEvent('mindora:account-changed', { detail: { user: session.user, profile: session.profile } }));
}

async function api(method = 'GET', body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('/api/account', {
      method, credentials: 'same-origin', signal: controller.signal,
      headers: body ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    let data;
    try { data = await response.json(); } catch { throw new Error('The account service could not respond. Please try again.'); }
    if (!response.ok) {
      const message = typeof data.message === 'string' ? data.message : typeof data.error === 'string' ? data.error : 'Something went wrong. Please try again.';
      throw new Error(message);
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('This is taking longer than expected. Please try again. Your details are still here.');
    if (error instanceof TypeError) throw new Error('We couldn’t connect. Check your connection and try again. Your details are still here.');
    throw error;
  } finally { clearTimeout(timeout); }
}

function profileDraft(profile = session.profile) {
  return { ...emptyDraft(), name: profile?.name || session.user?.name || '', age: profile?.age ?? '', gender: profile?.gender || '', interests: Array.isArray(profile?.interests) ? [...profile.interests] : [], email: session.user?.email || '' };
}

async function loadSession() {
  const version = sessionVersion;
  loadingSession = true;
  try {
    const data = await api();
    if (version !== sessionVersion) return;
    session = { available: data.available !== false, user: data.user || null, profile: data.profile || null };
    emitSession();
    if (dialog?.open && session.user && !view.pending) {
      view = { ...view, mode: 'profile', step: 0, error: '', draft: profileDraft() };
      render();
    }
  } catch {
    if (version === sessionVersion) { session.available = false; emitSession(); }
  } finally {
    loadingSession = false;
    if (dialog?.open) {
      if (dialog.querySelector('[data-account-loading]')) {
        if (!session.user) view.mode = 'signup';
        render();
      } else renderStatus();
    }
  }
}

function closeAccount() {
  view.draft.password = '';
  view.draft.confirm = '';
  view.showPassword = false;
  view.showConfirm = false;
  dialog.querySelectorAll('input[name="password"],input[name="confirm"]').forEach(input => { input.value = ''; input.removeAttribute('value'); input.type = 'password'; });
  dialog.close();
  document.body.classList.remove('account-open');
  if (['#signup', '#signin'].includes(window.location.hash)) history.replaceState(null, '', `${location.pathname}${location.search}#discover`);
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  else document.querySelector('#main')?.focus({ preventScroll: true });
}

const arrow = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m14 6-6 6 6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const cross = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke-linecap="round"/></svg>';
const eye = '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';

function progress() {
  return `<div class="account-steps" aria-label="Registration: step ${view.step + 1} of 3"><div class="account-step-bars" aria-hidden="true">${[0, 1, 2].map(i => `<i class="${i <= view.step ? 'on' : ''}"></i>`).join('')}</div><span>Step ${view.step + 1} of 3 <b>· ${['About you', 'Your interests', 'Your account'][view.step]}</b></span></div>`;
}

function aboutFields() {
  const d = view.draft;
  return `<label class="account-field" for="account-name"><span>Your name</span><input id="account-name" name="name" autocomplete="given-name" maxlength="80" value="${esc(d.name)}" placeholder="What should we call you?" required></label>
    <div class="account-field-row"><label class="account-field account-age" for="account-age"><span>Age <small>optional</small></span><input id="account-age" name="age" type="number" inputmode="numeric" min="1" max="120" step="1" value="${esc(d.age)}" placeholder="Age"></label><label class="account-field" for="account-gender"><span>Gender <small>optional</small></span><select id="account-gender" name="gender">${genders.map(([value, title]) => `<option value="${value}" ${value === d.gender ? 'selected' : ''}>${title}</option>`).join('')}</select></label></div>`;
}

function interestFields() {
  const selected = view.draft.interests;
  const all = [...topics, ...selected.filter(value => !topics.some(topic => topic.toLowerCase() === value.toLowerCase()))];
  return `<fieldset class="account-interest-field"><legend class="account-sr-only">Your interests</legend><div class="account-interests">${all.map(label => {
    const active = selected.some(value => value.toLowerCase() === label.toLowerCase());
    return `<button type="button" class="account-interest ${active ? 'selected' : ''}" data-account-interest="${esc(label)}" aria-pressed="${active}"><span>${esc(label)}</span><span aria-hidden="true">${active ? '✓' : '+'}</span></button>`;
  }).join('')}</div></fieldset><p class="account-interest-count" aria-live="polite">${selected.length} of 8 selected <span>· You can skip this</span></p>
    <label class="account-field account-custom-label" for="account-custom"><span>Something else?</span></label><div class="account-custom"><input id="account-custom" name="custom" maxlength="40" value="${esc(view.draft.custom)}" placeholder="Add your own interest" autocomplete="off"><button type="button" data-account-action="add-interest" aria-label="Add your interest">Add +</button></div>`;
}

function passwordField(confirm = false) {
  const field = confirm ? 'confirm' : 'password';
  const visible = confirm ? view.showConfirm : view.showPassword;
  const signup = view.mode === 'signup';
  return `<label class="account-field" for="account-${field}"><span>${confirm ? 'Confirm password' : 'Password'}</span><span class="account-password"><input id="account-${field}" name="${field}" type="${visible ? 'text' : 'password'}" autocomplete="${signup ? 'new-password' : 'current-password'}" ${signup ? 'minlength="8"' : ''} maxlength="128" value="${esc(view.draft[field])}" placeholder="${confirm ? 'Enter it again' : signup ? 'At least 8 characters' : 'Enter your password'}" required><button type="button" data-account-action="${confirm ? 'toggle-confirm' : 'toggle-password'}" aria-label="${visible ? 'Hide' : 'Show'} ${confirm ? 'confirmation password' : 'password'}" aria-pressed="${visible}">${eye}</button></span></label>`;
}

function accountFields() {
  return `<label class="account-field" for="account-email"><span>Email</span><input id="account-email" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" maxlength="254" value="${esc(view.draft.email)}" placeholder="you@example.com" required></label>${passwordField()}${view.mode === 'signup' ? passwordField(true) : ''}`;
}

function content() {
  if (view.mode === 'profile' && loadingSession && !session.user) return `<div class="account-loading" data-account-loading role="status">${character('mino', 'thinking', 'account-mino')}<h1 id="account-heading" tabindex="-1">Finding your account…</h1><p>This will only take a moment.</p><button type="button" class="account-guest" data-account-action="close">Continue learning</button></div>`;
  const signup = view.mode === 'signup', profile = view.mode === 'profile';
  const titles = ['Let’s get to know you.', 'What interests you?', 'Your learning starts here.'];
  const descriptions = ['A name is all you need for this step.', 'Pick a few things you’d like to explore.', 'Create an account with your email and password.'];
  const title = signup ? titles[view.step] : profile ? 'Your profile' : 'Welcome back.';
  const description = signup ? descriptions[view.step] : profile ? 'A little about you. Update it whenever you like.' : 'Sign in to your Mindora account.';
  const primary = view.pending ? (profile ? 'Saving…' : signup ? 'Creating your account…' : 'Signing in…') : profile ? 'Save profile' : signup ? view.step === 2 ? 'Create account' : 'Continue' : 'Sign in';
  return `<form id="mindora-account-form" class="account-form" novalidate aria-busy="${view.pending}">
    <div class="account-form-body">${signup ? progress() : ''}
    ${signup && view.step > 0 ? `<button type="button" class="account-back" data-account-action="back" ${view.pending ? 'disabled' : ''}>${arrow} Back</button>` : ''}
    <div class="account-intro"><div><h1 id="account-heading" tabindex="-1">${title}</h1><p>${description}</p></div>${character('mino', profile ? 'explaining' : signup && view.step === 2 ? 'celebrate' : 'welcome', 'account-mino')}</div>
    <div class="account-error" id="account-error" role="alert" ${view.error ? '' : 'hidden'}>${esc(view.error)}</div><div class="account-notice" id="account-notice" role="status" ${view.notice ? '' : 'hidden'}>${esc(view.notice)}</div><div class="account-service-note" data-account-service ${session.available === false ? '' : 'hidden'}>Accounts are temporarily unavailable. You can still learn as a guest.</div>
    <fieldset class="account-inputs" ${view.pending ? 'disabled' : ''}><legend class="account-sr-only">${title}</legend>
    ${profile ? `<p class="account-email-label">${esc(session.user?.email || '')}</p>${aboutFields()}<h2 class="account-section-title">Your interests</h2>${interestFields()}` : signup ? view.step === 0 ? aboutFields() : view.step === 1 ? interestFields() : accountFields() : accountFields()}
    </fieldset></div>
    <footer class="account-footer"><button type="submit" class="account-primary" ${view.pending ? 'disabled' : ''}>${primary}${view.pending ? '<span class="account-spinner" aria-hidden="true"></span>' : ''}</button>
    ${profile ? `<button type="button" class="account-guest account-signout" data-account-action="signout" ${view.pending ? 'disabled' : ''}>Sign out</button>` : `<p class="account-switch">${signup ? 'Already have an account?' : 'New to Mindora?'} <button type="button" data-account-action="${signup ? 'signin' : 'signup'}" ${view.pending ? 'disabled' : ''}>${signup ? 'Sign in' : 'Create account'}</button></p>`}
    <button type="button" class="account-guest" data-account-action="close">${profile ? 'Back to learning' : 'Continue as a guest'}</button></footer></form>`;
}

function render(focus = true) {
  const old = document.activeElement;
  const previous = old && dialog.contains(old) ? { id: old.id, interest: old.dataset.accountInterest, selection: old.selectionStart } : null;
  dialog.innerHTML = `<div class="account-viewport"><header class="account-header"><a class="account-brand" href="#discover" data-account-action="close" aria-label="Back to Mindora"><img src="${new URL('./assets/brand-mark.svg', import.meta.url).href}" width="38" height="38" alt=""><span>mindora<span>.</span></span></a><button type="button" class="account-close" data-account-action="close" aria-label="Close account and continue learning">${cross}</button></header><main class="account-panel">${content()}</main></div>`;
  if (!dialog.open) return;
  if (focus) {
    dialog.scrollTop = 0;
    dialog.querySelector('#account-heading')?.focus({ preventScroll: true });
  } else if (previous) {
    const target = previous.id ? dialog.querySelector(`#${previous.id}`) : [...dialog.querySelectorAll('[data-account-interest]')].find(item => item.dataset.accountInterest === previous.interest);
    if (target && !target.disabled) {
      target.focus({ preventScroll: true });
      if (previous.selection !== null && typeof target.setSelectionRange === 'function' && ['text', 'password', 'email'].includes(target.type)) {
        try { target.setSelectionRange(previous.selection, previous.selection); } catch { /* Email inputs do not expose a text selection. */ }
      }
    }
  }
}

function renderStatus() {
  const note = dialog.querySelector('[data-account-service]');
  if (note) note.hidden = session.available !== false;
}

function showError(message, field) {
  view.error = message;
  const box = dialog.querySelector('#account-error');
  if (box) { box.textContent = message; box.hidden = false; }
  const input = field ? dialog.querySelector(`#account-${field}`) : null;
  if (input) { input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', 'account-error'); input.focus(); }
  else box?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
}

function clearError() {
  view.error = '';
  const box = dialog.querySelector('#account-error');
  if (box) { box.textContent = ''; box.hidden = true; }
  dialog.querySelectorAll('[aria-invalid]').forEach(input => { input.removeAttribute('aria-invalid'); input.removeAttribute('aria-describedby'); });
}

function validAbout() {
  if (!view.draft.name.trim()) { showError('Please tell us your name.', 'name'); return false; }
  const age = view.draft.age;
  if (age !== '' && (!Number.isInteger(Number(age)) || Number(age) < 1 || Number(age) > 120)) { showError('Enter a whole age from 1 to 120, or leave it empty.', 'age'); return false; }
  return true;
}

function validAccount() {
  const email = dialog.querySelector('#account-email');
  if (!view.draft.email.trim() || !email?.validity.valid) { showError('Enter a valid email address.', 'email'); return false; }
  if (!view.draft.password || (view.mode === 'signup' && view.draft.password.length < 8)) { showError(view.mode === 'signup' ? 'Choose a password with at least 8 characters.' : 'Enter your password.', 'password'); return false; }
  if (view.mode === 'signup' && view.draft.password !== view.draft.confirm) { showError('Your passwords don’t match. Try again.', 'confirm'); return false; }
  return true;
}

function profilePayload() {
  return { name: view.draft.name.trim(), age: view.draft.age === '' ? null : Number(view.draft.age), gender: view.draft.gender, interests: [...view.draft.interests] };
}

function addInterest() {
  const label = view.draft.custom.trim();
  if (!label) { dialog.querySelector('#account-custom')?.focus(); return false; }
  if (view.draft.interests.some(item => item.toLowerCase() === label.toLowerCase())) { view.draft.custom = ''; render(false); return true; }
  if (view.draft.interests.length >= 8) { showError('Choose up to 8 interests. Remove one to add another.', 'custom'); return false; }
  clearError();
  view.draft.interests.push(label);
  view.draft.custom = '';
  render(false);
  dialog.querySelector('#account-custom')?.focus({ preventScroll: true });
  return true;
}

async function submit() {
  if (view.pending) return;
  // Password managers can fill a field without firing an input event.
  for (const input of dialog.querySelectorAll('input[name],select[name]')) {
    if (Object.hasOwn(view.draft, input.name) && input.name !== 'interests') view.draft[input.name] = input.value;
  }
  clearError();
  view.notice = '';
  if (view.mode === 'signup' && view.step < 2) {
    if (view.step === 0 && !validAbout()) return;
    if (view.step === 1 && view.draft.custom.trim() && !addInterest()) return;
    view.step++;
    render();
    return;
  }
  if (view.mode === 'profile') {
    if (!validAbout()) return;
    if (view.draft.custom.trim() && !addInterest()) return;
  } else if (!validAccount()) return;
  const mode = view.mode;
  const profile = profilePayload();
  const payload = mode === 'profile' ? profile : { action: mode, email: view.draft.email.trim(), password: view.draft.password, ...(mode === 'signup' ? profile : {}) };
  const version = ++sessionVersion;
  view.pending = true;
  render(false);
  try {
    const data = await api(mode === 'profile' ? 'PUT' : 'POST', payload);
    if (version !== sessionVersion) return;
    if (data.verificationRequired && !data.user) {
      view.mode = 'signin'; view.step = 0;
      view.draft.password = ''; view.draft.confirm = '';
      view.showPassword = false; view.showConfirm = false;
      view.notice = 'Check your email to verify your account. Then come back here to sign in.';
      return;
    }
    session = { available: true, user: data.user || session.user, profile: data.profile || session.profile };
    if (!session.user) {
      const current = await api();
      session = { available: current.available !== false, user: current.user || null, profile: current.profile || null };
    }
    if (!session.user) throw new Error('Your session could not be confirmed. Please sign in again.');
    emitSession();
    view.draft.password = ''; view.draft.confirm = '';
    view.showPassword = false; view.showConfirm = false;
    view.mode = 'profile'; view.step = 0;
    view.draft = data.profilePending ? { ...profileDraft(), ...profile } : profileDraft();
    view.notice = data.profilePending ? '' : mode === 'profile' ? 'Your profile is saved.' : mode === 'signup' ? 'Your account is ready. Welcome to Mindora!' : 'You’re signed in. Welcome back!';
    view.error = data.profilePending ? 'Your account is ready, but your profile wasn’t saved. Please try Save profile again.' : '';
  } catch (error) { view.error = error.message; }
  finally {
    view.pending = false;
    if (dialog.open) { render(); if (view.error) showError(view.error); }
  }
}

async function signOut() {
  if (view.pending) return;
  view.pending = true; view.notice = ''; clearError(); render(false);
  ++sessionVersion;
  try {
    await api('POST', { action: 'signout' });
    session = { available: true, user: null, profile: null };
    emitSession();
    view = { mode: 'signin', step: 0, pending: false, error: '', notice: 'You’re signed out.', showPassword: false, showConfirm: false, draft: emptyDraft() };
  } catch (error) { view.error = error.message; }
  finally { view.pending = false; if (dialog.open) render(); }
}

function switchMode(mode) {
  view.mode = mode;
  view.step = 0;
  view.error = ''; view.notice = '';
  view.draft.password = ''; view.draft.confirm = '';
  view.showPassword = false; view.showConfirm = false;
  render();
}

export function openAccount(mode = 'signup') {
  mountAccount();
  if (view.pending) { if (!dialog.open) { dialog.showModal(); document.body.classList.add('account-open'); } return; }
  returnFocus = document.activeElement;
  mode = ['signup', 'signin', 'profile'].includes(mode) ? mode : 'signup';
  if (session.user) mode = 'profile';
  else if (mode === 'profile' && !loadingSession) mode = 'signup';
  view = { ...view, mode, step: 0, error: '', notice: '', showPassword: false, showConfirm: false, draft: mode === 'profile' && session.user ? profileDraft() : { ...view.draft, password: '', confirm: '' } };
  render();
  if (!dialog.open) dialog.showModal();
  document.body.classList.add('account-open');
  dialog.scrollTop = 0;
  dialog.querySelector('#account-heading')?.focus({ preventScroll: true });
}

export function getAccountState() {
  return { user: session.user ? { ...session.user } : null, profile: session.profile ? { ...session.profile, ...(Array.isArray(session.profile.interests) ? { interests: [...session.profile.interests] } : {}) } : null, available: session.available };
}

export function mountAccount() {
  if (mounted) return sessionPromise;
  mounted = true;
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet'; stylesheet.href = new URL('./account.css', import.meta.url).href;
  stylesheet.id = 'mindora-account-styles'; document.head.append(stylesheet);
  dialog = document.createElement('dialog');
  dialog.id = 'mindora-account'; dialog.className = 'account-dialog'; dialog.setAttribute('aria-labelledby', 'account-heading');
  document.body.append(dialog);
  mountCharacters();
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeAccount(); });
  dialog.addEventListener('close', () => { document.body.classList.remove('account-open'); });
  dialog.addEventListener('submit', event => { event.preventDefault(); event.stopPropagation(); submit(); });
  dialog.addEventListener('input', event => {
    const field = event.target.name;
    if (field && Object.hasOwn(view.draft, field) && field !== 'interests') view.draft[field] = event.target.value;
    if (view.error) clearError();
  });
  dialog.addEventListener('change', event => {
    const field = event.target.name;
    if (field && Object.hasOwn(view.draft, field) && field !== 'interests') view.draft[field] = event.target.value;
  });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.target.id === 'account-custom') { event.preventDefault(); addInterest(); }
  });
  dialog.addEventListener('click', event => {
    const control = event.target.closest('[data-account-action],[data-account-interest]');
    if (!control) return;
    event.preventDefault();
    const action = control.dataset.accountAction;
    if (action === 'close') { closeAccount(); return; }
    if (view.pending) return;
    if (control.hasAttribute('data-account-interest')) {
      const label = control.dataset.accountInterest;
      const index = view.draft.interests.findIndex(item => item.toLowerCase() === label.toLowerCase());
      if (index >= 0) view.draft.interests.splice(index, 1);
      else if (view.draft.interests.length < 8) view.draft.interests.push(label);
      else { showError('Choose up to 8 interests. Remove one to add another.'); return; }
      clearError(); render(false);
    } else if (action === 'back') { view.step = Math.max(0, view.step - 1); clearError(); render(); }
    else if (action === 'signin' || action === 'signup') switchMode(action);
    else if (action === 'add-interest') addInterest();
    else if (action === 'signout') signOut();
    else if (action === 'toggle-password' || action === 'toggle-confirm') {
      const confirm = action === 'toggle-confirm';
      const key = confirm ? 'showConfirm' : 'showPassword';
      view[key] = !view[key];
      const input = dialog.querySelector(confirm ? '#account-confirm' : '#account-password');
      input.type = view[key] ? 'text' : 'password';
      control.setAttribute('aria-pressed', String(view[key]));
      control.setAttribute('aria-label', `${view[key] ? 'Hide' : 'Show'} ${confirm ? 'confirmation password' : 'password'}`);
    }
  });
  document.addEventListener('click', event => {
    const control = event.target.closest('[data-account-open]');
    if (!control) return;
    event.preventDefault();
    openAccount(control.dataset.accountOpen);
  });
  sessionPromise = loadSession();
  const initialMode = window.location.hash.slice(1);
  if (initialMode === 'signup' || initialMode === 'signin') queueMicrotask(() => openAccount(initialMode));
  return sessionPromise;
}
