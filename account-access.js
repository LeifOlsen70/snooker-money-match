(() => {
  'use strict';
  const activeKey = 'snooker-active-account-v1';
  const pendingKey = 'snooker-account-next-mode-v1';
  const legacyOwner = 'SRx2kZD2jzdM3Q6RVVOjioAuHuw1';
  const keys = [
    'snookerMoneyMatchState', 'snookerSwissTournamentV1', 'snookerSwissPendingSyncV1',
    'snookerSwissPlayerNamesV1', 'snookerSwissRosterPendingV1', 'snookerSinglePendingSyncV1'
  ];
  const raw = window.localStorage;
  const uid = raw.getItem(activeKey);
  const prefix = account => 'snooker-account-v1:' + account + ':';
  window.snookerStorage = Object.freeze({
    uid,
    getItem(key) { return uid ? raw.getItem(prefix(uid) + key) : null; },
    setItem(key, value) {
      if (!uid) throw new Error('Bitte zuerst anmelden.');
      raw.setItem(prefix(uid) + key, value);
    },
    removeItem(key) { if (uid) raw.removeItem(prefix(uid) + key); }
  });

  const e = id => document.getElementById(id);
  const dialog = e('accountDialog');
  let actions = null, user = null, ready = false, registering = false, busy = false;
  function status(text) { e('accountMessage').textContent = text; }
  function pendingMode() { return window.sessionStorage.getItem(pendingKey); }
  function openMode(mode) {
    window.sessionStorage.removeItem(pendingKey);
    if (dialog.open) dialog.close();
    const deliver = () => window.dispatchEvent(new CustomEvent('snooker-account-enter', {detail:mode}));
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', deliver, {once:true});
    else deliver();
  }
  function setBusy(value) {
    busy = value;
    dialog.querySelectorAll('button,input').forEach(control => { control.disabled = value; });
    e('accountSubmit').disabled = value || !actions;
  }
  function setRegister(value) {
    registering = value;
    e('accountTitle').textContent = value ? 'Konto erstellen' : 'Anmelden';
    e('accountSubmit').textContent = value ? 'Registrieren' : 'Anmelden';
    e('accountRegister').textContent = value ? 'Ich habe bereits ein Konto' : 'Neues Konto registrieren';
    e('accountRepeatLabel').hidden = !value;
    e('accountRepeat').required = value;
    e('accountPassword').autocomplete = value ? 'new-password' : 'current-password';
    e('accountReset').hidden = value;
    status('');
  }
  function request(mode) {
    if (ready && user) { openMode(mode); return; }
    window.sessionStorage.setItem(pendingKey, mode);
    setRegister(false);
    if (!dialog.open) dialog.showModal();
    if (!actions) status('Anmeldung wird geladen. Für die erste Anmeldung ist eine Internetverbindung erforderlich.');
    else if (user) status('Dein Konto wird verbunden …');
    setBusy(false);
  }
  function finishLogin(account, message) {
    user = account;
    ready = Boolean(account);
    e('accountEmailLabel').textContent = account?.email || '';
    e('accountBar').hidden = !account;
    if (account) raw.setItem(prefix(account.uid) + 'email', account.email || '');
    if (message) status(message);
    if (ready && pendingMode()) openMode(pendingMode());
  }
  function switchUser(account) {
    const next = account?.uid || null;
    if (next === uid) return false;
    ready = false;
    if (next === legacyOwner && !raw.getItem(prefix(next) + 'legacy-migrated')) {
      for (const key of keys) {
        const value = raw.getItem(key);
        if (value !== null && raw.getItem(prefix(next) + key) === null) raw.setItem(prefix(next) + key, value);
      }
      raw.setItem(prefix(next) + 'legacy-migrated', '1');
    }
    if (next) raw.setItem(activeKey, next);
    else {
      raw.removeItem(activeKey);
      window.sessionStorage.removeItem(pendingKey);
    }
    window.location.reload();
    return true;
  }
  const errors = {
    'auth/invalid-email':'Bitte eine gültige E-Mail-Adresse eingeben.',
    'auth/invalid-credential':'E-Mail-Adresse oder Passwort stimmen nicht.',
    'auth/user-not-found':'E-Mail-Adresse oder Passwort stimmen nicht.',
    'auth/wrong-password':'E-Mail-Adresse oder Passwort stimmen nicht.',
    'auth/email-already-in-use':'Für diese E-Mail-Adresse gibt es bereits ein Konto. Bitte anmelden.',
    'auth/weak-password':'Bitte ein stärkeres Passwort mit mindestens sechs Zeichen wählen.',
    'auth/password-does-not-meet-requirements':'Das Passwort erfüllt die Anforderungen noch nicht. Bitte ein stärkeres Passwort wählen.',
    'auth/too-many-requests':'Zu viele Versuche. Bitte später erneut versuchen.',
    'auth/network-request-failed':'Verbindung fehlgeschlagen. Bitte Internetverbindung prüfen.',
    'auth/operation-not-allowed':'Die Registrierung ist noch nicht freigeschaltet. Der App-Betreiber muss E-Mail/Passwort in Firebase aktivieren.',
    'auth/unauthorized-domain':'Diese App-Adresse muss für die Anmeldung noch in Firebase freigegeben werden.'
  };
  e('accountForm').onsubmit = async event => {
    event.preventDefault();
    if (busy || !actions) return;
    const email = e('accountEmail').value.trim();
    const password = e('accountPassword').value;
    if (registering && password !== e('accountRepeat').value) {
      status('Die beiden Passwörter stimmen nicht überein.'); return;
    }
    setBusy(true);
    status(registering ? 'Konto wird erstellt …' : 'Anmeldung läuft …');
    try {
      if (registering) await actions.register(email,password);
      else await actions.login(email,password);
      e('accountPassword').value = '';
      e('accountRepeat').value = '';
    } catch (error) {
      status(errors[error.code] || 'Anmeldung fehlgeschlagen. Bitte erneut versuchen.');
    } finally { setBusy(false); }
  };
  e('accountRegister').onclick = () => setRegister(!registering);
  e('accountCancel').onclick = () => {
    window.sessionStorage.removeItem(pendingKey);
    e('accountPassword').value = ''; e('accountRepeat').value = '';
    dialog.close();
  };
  dialog.oncancel = () => {
    window.sessionStorage.removeItem(pendingKey);
    e('accountPassword').value = ''; e('accountRepeat').value = '';
  };
  e('accountReset').onclick = async () => {
    if (busy || !actions) return;
    const email = e('accountEmail').value.trim();
    if (!email || !e('accountEmail').checkValidity()) {
      status('Bitte zuerst deine E-Mail-Adresse eingeben.'); return;
    }
    setBusy(true);
    try {
      await actions.reset(email);
      status('Falls für diese Adresse ein Konto besteht, erhältst du eine E-Mail zum Zurücksetzen des Passworts.');
    } catch (error) { status(errors[error.code] || 'Die Anfrage konnte nicht gesendet werden.'); }
    finally { setBusy(false); }
  };
  e('accountLogout').onclick = async () => {
    if (!actions || !confirm('Von diesem Konto abmelden? Deine gespeicherten Kontodaten bleiben für die nächste Anmeldung erhalten.')) return;
    e('accountLogout').disabled = true;
    try { await actions.logout(); }
    catch { e('accountLogout').disabled = false; alert('Abmelden fehlgeschlagen. Bitte erneut versuchen.'); }
  };
  window.addEventListener('storage', event => {
    if (event.key === activeKey && event.newValue !== uid) window.location.reload();
  });
  window.snookerAccount = Object.freeze({
    request, switchUser,
    bind(next) { actions = next; setBusy(false); status(''); },
    ready: finishLogin,
    connectionError(message) { status(message); e('fbStatus').textContent = message; },
    block() { ready=false; document.body.classList.remove('snookerFullscreenScore','snookerFullscreenTournament','compactTournament'); document.body.classList.add('modeHome'); e('singleMode').classList.add('hidden'); e('tournamentMode').classList.add('hidden'); e('modeStart').classList.remove('hidden'); },
  });
  // Previously authenticated account data remains available on this device offline.
  if (!navigator.onLine && uid) finishLogin({uid,email:raw.getItem(prefix(uid)+'email') || ''});
})();
