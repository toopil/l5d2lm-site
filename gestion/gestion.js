(() => {
  const SUPABASE_URL = 'https://gopiicysitdcmxebdiwb.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_dvhEnUhtPMPQ6-znTWXgmg_upJNaeEf';

  const state = {
    client: null,
    session: null,
    pendingFactorId: null,
    pendingChallengeId: null
  };

  const views = Array.from(document.querySelectorAll('[data-view]'));
  const status = document.querySelector('[data-status]');
  const loginForm = document.querySelector('[data-login-form]');
  const resetRequestForm = document.querySelector('[data-reset-request-form]');
  const passwordUpdateForm = document.querySelector('[data-password-update-form]');
  const showResetButton = document.querySelector('[data-show-reset]');
  const showLoginButtons = Array.from(document.querySelectorAll('[data-show-login]'));
  const enrollButton = document.querySelector('[data-enroll-mfa]');
  const qrImage = document.querySelector('[data-mfa-qr]');
  const secretText = document.querySelector('[data-mfa-secret]');
  const verifyNewMfaForm = document.querySelector('[data-verify-new-mfa]');
  const verifyMfaForm = document.querySelector('[data-verify-mfa]');
  const signOutButtons = Array.from(document.querySelectorAll('[data-sign-out]'));
  const adminSummary = document.querySelector('[data-admin-summary]');
  const tabs = Array.from(document.querySelectorAll('[data-tab]'));
  const panels = Array.from(document.querySelectorAll('[data-panel]'));

  const showView = (name) => {
    views.forEach((view) => {
      view.hidden = view.dataset.view !== name;
    });
  };

  const setStatus = (message = '', type = '') => {
    status.textContent = message;
    status.classList.toggle('is-error', type === 'error');
    status.classList.toggle('is-success', type === 'success');
  };

  const cleanCode = (value) => String(value || '').replace(/\s+/g, '');

  const getAuthFlowType = () => {
    const hashParams = new URLSearchParams(String(location.hash || '').replace(/^#/, ''));
    const searchParams = new URLSearchParams(location.search);
    return hashParams.get('type') || searchParams.get('type') || '';
  };

  const setBusy = (element, busy) => {
    if (!element) return;
    element.disabled = busy;
    element.setAttribute('aria-busy', String(busy));
  };

  const getSupabase = () => {
    if (!window.supabase?.createClient) {
      throw new Error('La librairie Supabase ne s’est pas chargée. Vérifiez la connexion internet.');
    }

    if (!state.client) {
      state.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
    }

    return state.client;
  };

  const qrToImageSource = (qrCode) => {
    const value = String(qrCode || '').trim();
    if (!value) return '';
    if (value.startsWith('data:') || value.startsWith('http')) return value;
    if (value.startsWith('<svg')) return `data:image/svg+xml;utf8,${encodeURIComponent(value)}`;
    return value;
  };

  const getAal = async () => {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) throw error;
    return data;
  };

  const getVerifiedTotpFactor = async () => {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) throw error;
    return (data?.totp || []).find((factor) => factor.status === 'verified') || null;
  };

  const beginMfaChallenge = async (factorId) => {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.mfa.challenge({ factorId });
    if (error) throw error;
    state.pendingFactorId = factorId;
    state.pendingChallengeId = data.id;
  };

  const verifyMfaCode = async (code) => {
    if (!state.pendingFactorId || !state.pendingChallengeId) {
      throw new Error('La vérification MFA n’est pas prête. Relancez la connexion.');
    }

    const supabase = getSupabase();
    const { error } = await supabase.auth.mfa.verify({
      factorId: state.pendingFactorId,
      challengeId: state.pendingChallengeId,
      code
    });

    if (error) throw error;

    state.pendingFactorId = null;
    state.pendingChallengeId = null;
    await supabase.auth.refreshSession();
  };

  const ensureAdminAccess = async () => {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('l5d2lm_can_admin');
    if (error) throw error;
    if (data !== true) {
      showView('blocked');
      setStatus('Accès refusé : ce compte n’est pas administrateur L5D2LM avec MFA validé.', 'error');
      return false;
    }

    const email = state.session?.user?.email || 'compte administrateur';
    adminSummary.textContent = `${email} est connecté avec une session MFA valide.`;
    showView('admin');
    setStatus('Accès sécurisé confirmé.', 'success');
    await loadMediaPanel();
    return true;
  };

  const routeSession = async () => {
    setStatus('');
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;

    state.session = data.session;
    if (!state.session) {
      showView('login');
      return;
    }

    const aal = await getAal();
    if (aal?.currentLevel === 'aal2') {
      await ensureAdminAccess();
      return;
    }

    const verifiedFactor = await getVerifiedTotpFactor();
    if (verifiedFactor) {
      await beginMfaChallenge(verifiedFactor.id);
      showView('mfa-challenge');
      setStatus('Code MFA demandé. Indiquez le code de votre application.');
      return;
    }

    showView('mfa-setup');
    setStatus('Aucun MFA actif : créez le QR code pour sécuriser ce compte.');
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    const submitter = event.submitter;
    setBusy(submitter, true);
    setStatus('Connexion en cours...');

    try {
      const form = new FormData(loginForm);
      const email = String(form.get('email') || '').trim();
      const password = String(form.get('password') || '');
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      state.session = data.session;
      await routeSession();
    } catch (error) {
      setStatus(error.message || 'Connexion impossible.', 'error');
    } finally {
      setBusy(submitter, false);
    }
  };

  const handleResetRequest = async (event) => {
    event.preventDefault();
    const submitter = event.submitter;
    setBusy(submitter, true);
    setStatus('Envoi du lien de réinitialisation...');

    try {
      const email = String(new FormData(resetRequestForm).get('email') || '').trim();
      const supabase = getSupabase();
      const redirectTo = `${location.origin}${location.pathname}`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      setStatus('Lien envoyé. Ouvrez l’email sur ce même navigateur, puis choisissez un nouveau mot de passe.', 'success');
    } catch (error) {
      setStatus(error.message || 'Impossible d’envoyer le lien de réinitialisation.', 'error');
    } finally {
      setBusy(submitter, false);
    }
  };

  const handlePasswordUpdate = async (event) => {
    event.preventDefault();
    const submitter = event.submitter;
    setBusy(submitter, true);
    setStatus('Enregistrement du nouveau mot de passe...');

    try {
      const form = new FormData(passwordUpdateForm);
      const password = String(form.get('password') || '');
      const passwordConfirm = String(form.get('password_confirm') || '');

      if (password !== passwordConfirm) {
        throw new Error('Les deux mots de passe ne sont pas identiques.');
      }

      const supabase = getSupabase();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      history.replaceState(null, '', location.pathname);
      passwordUpdateForm.reset();
      setStatus('Mot de passe enregistré. La suite demande maintenant la double authentification.', 'success');
      await routeSession();
    } catch (error) {
      setStatus(error.message || 'Impossible d’enregistrer le nouveau mot de passe.', 'error');
    } finally {
      setBusy(submitter, false);
    }
  };

  const handleEnrollMfa = async () => {
    setBusy(enrollButton, true);
    setStatus('Création du QR code MFA...');

    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Gestion L5D2LM'
      });
      if (error) throw error;

      state.pendingFactorId = data.id;
      qrImage.src = qrToImageSource(data.totp?.qr_code);
      qrImage.hidden = false;

      if (data.totp?.secret) {
        secretText.textContent = `Code manuel : ${data.totp.secret}`;
        secretText.hidden = false;
      }

      await beginMfaChallenge(data.id);
      setStatus('QR code prêt. Scannez-le, puis indiquez le code à 6 chiffres.', 'success');
    } catch (error) {
      setStatus(error.message || 'Impossible de créer le QR code MFA.', 'error');
      setBusy(enrollButton, false);
    }
  };

  const handleVerifyNewMfa = async (event) => {
    event.preventDefault();
    const submitter = event.submitter;
    setBusy(submitter, true);
    setStatus('Vérification du code MFA...');

    try {
      const code = cleanCode(new FormData(verifyNewMfaForm).get('code'));
      await verifyMfaCode(code);
      await routeSession();
    } catch (error) {
      setStatus(error.message || 'Code MFA refusé.', 'error');
    } finally {
      setBusy(submitter, false);
    }
  };

  const handleVerifyMfa = async (event) => {
    event.preventDefault();
    const submitter = event.submitter;
    setBusy(submitter, true);
    setStatus('Vérification du code MFA...');

    try {
      const code = cleanCode(new FormData(verifyMfaForm).get('code'));
      await verifyMfaCode(code);
      await routeSession();
    } catch (error) {
      setStatus(error.message || 'Code MFA refusé.', 'error');
    } finally {
      setBusy(submitter, false);
    }
  };

  const handleSignOut = async () => {
    setStatus('Déconnexion...');
    const supabase = getSupabase();
    await supabase.auth.signOut();
    state.session = null;
    state.pendingFactorId = null;
    state.pendingChallengeId = null;
    showView('login');
    setStatus('Déconnecté.', 'success');
  };

  const activateTab = (name) => {
    tabs.forEach((tab) => {
      const active = tab.dataset.tab === name;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    panels.forEach((panel) => {
      panel.classList.toggle('is-active', panel.dataset.panel === name);
    });
  };

  // Onglet Photos : import depuis l'appareil de l'administrateur + catalogue
  // des images déjà utilisées sur le site public. Tout arrive en brouillon
  // dans l5d2lm_media (rien n'est publié automatiquement).
  const mediaGrid = document.querySelector('[data-media-grid]');
  const mediaFilters = document.querySelector('[data-media-filters]');
  const mediaTotalEl = document.querySelector('[data-media-total]');
  const mediaImportedEl = document.querySelector('[data-media-imported]');
  const mediaSelectedEl = document.querySelector('[data-media-selected]');
  const mediaSelectVisibleButton = document.querySelector('[data-media-select-visible]');
  const mediaClearSelectionButton = document.querySelector('[data-media-clear-selection]');
  const mediaImportButton = document.querySelector('[data-media-import]');
  const mediaUploadInput = document.querySelector('[data-media-upload-input]');

  const mediaState = {
    selected: new Set(),
    importedFilenames: new Set(),
    localUploads: [],
    activeFilter: 'all',
    loaded: false,
    uploadCounter: 0
  };

  const sha256Hex = async (blob) => {
    const buffer = await blob.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  };

  // Le nom d'origine (accents, espaces, majuscules) est conservé tel quel en
  // base (original_filename) ; seul le CHEMIN de stockage doit être neutre,
  // Supabase Storage refusant certains caractères (espaces, accents) dans
  // les clés d'objet ("Invalid key").
  const sanitizeStorageSegment = (filename) => {
    const trimmed = String(filename || 'fichier').trim();
    const lastDot = trimmed.lastIndexOf('.');
    const base = lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed;
    const ext = lastDot > 0 ? trimmed.slice(lastDot + 1) : '';

    const combiningDiacritics = new RegExp('[̀-ͯ]', 'g');
    const clean = (part) => part
      .normalize('NFD').replace(combiningDiacritics, '') // accents -> lettres de base
      .replace(/[^a-zA-Z0-9._-]+/g, '-') // reste -> tiret
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    const cleanBase = clean(base) || 'fichier';
    const cleanExt = clean(ext);
    return cleanExt ? `${cleanBase}.${cleanExt}` : cleanBase;
  };

  const isHeicFile = (file) => {
    const type = String(file.type || '').toLowerCase();
    const name = String(file.name || '').toLowerCase();
    return type.includes('heic') || type.includes('heif') || name.endsWith('.heic') || name.endsWith('.heif');
  };

  const allSiteMedia = () => window.L5D2LM_SITE_MEDIA || [];
  const allSections = () => window.L5D2LM_SECTIONS || [];
  const allMedia = () => [...mediaState.localUploads, ...allSiteMedia()];

  const visibleMedia = () => {
    const items = allMedia();
    if (mediaState.activeFilter === 'all') return items;
    if (mediaState.activeFilter === 'new-upload') return items.filter((item) => item.kind === 'upload');
    return items.filter((item) => item.sectionSlug === mediaState.activeFilter);
  };

  const isItemImported = (item) => mediaState.importedFilenames.has(item.filename);

  const updateMediaCounters = () => {
    if (mediaTotalEl) mediaTotalEl.textContent = String(allMedia().length);
    if (mediaImportedEl) mediaImportedEl.textContent = String(mediaState.importedFilenames.size);
    if (mediaSelectedEl) mediaSelectedEl.textContent = String(mediaState.selected.size);
  };

  const renderMediaFilters = () => {
    if (!mediaFilters) return;
    const options = [{ slug: 'all', title: 'Toutes les pages' }];
    if (mediaState.localUploads.length) options.push({ slug: 'new-upload', title: 'Mes nouveaux imports' });
    options.push(...allSections());

    mediaFilters.innerHTML = '';
    options.forEach(({ slug, title }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = title;
      button.classList.toggle('is-active', mediaState.activeFilter === slug);
      button.addEventListener('click', () => {
        mediaState.activeFilter = slug;
        renderMediaFilters();
        renderMediaGrid();
      });
      mediaFilters.appendChild(button);
    });
  };

  const renderMediaGrid = () => {
    if (!mediaGrid) return;
    mediaGrid.innerHTML = '';

    visibleMedia().forEach((item) => {
      const isImported = isItemImported(item);
      const isUpload = item.kind === 'upload';

      const card = document.createElement('article');
      card.className = `media-item${isUpload && item.isHeic ? ' media-item--heic' : ''}`;
      card.classList.toggle('is-selected', mediaState.selected.has(item.id));

      const label = document.createElement('label');
      label.className = 'media-item__select';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = mediaState.selected.has(item.id);
      checkbox.disabled = isImported;
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) mediaState.selected.add(item.id);
        else mediaState.selected.delete(item.id);
        card.classList.toggle('is-selected', checkbox.checked);
        updateMediaCounters();
      });
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(isImported ? 'Déjà importée' : 'Sélectionner'));
      card.appendChild(label);

      const thumb = document.createElement('div');
      thumb.className = 'media-item__thumb';
      if (isUpload && item.isHeic) {
        thumb.textContent = 'HEIC — aperçu indisponible, fichier conservé tel quel';
      } else {
        const img = document.createElement('img');
        img.src = item.src;
        img.alt = '';
        img.loading = 'lazy';
        thumb.appendChild(img);
      }
      card.appendChild(thumb);

      const meta = document.createElement('div');
      meta.className = 'media-item__meta';
      const name = document.createElement('strong');
      name.textContent = item.filename;
      meta.appendChild(name);

      const badges = document.createElement('div');
      badges.className = 'media-badges';
      const originBadge = document.createElement('span');
      if (isUpload) {
        originBadge.className = 'media-badge media-badge--new';
        originBadge.textContent = 'Nouvel import';
      } else {
        const section = allSections().find((entry) => entry.slug === item.sectionSlug);
        originBadge.className = 'media-badge';
        originBadge.textContent = section ? section.title : item.sectionSlug;
      }
      badges.appendChild(originBadge);
      const statusBadge = document.createElement('span');
      statusBadge.className = `media-badge ${isImported ? 'media-badge--imported' : 'media-badge--pending'}`;
      statusBadge.textContent = isImported ? 'Importée' : 'À importer';
      badges.appendChild(statusBadge);
      meta.appendChild(badges);
      card.appendChild(meta);

      if (isUpload && !isImported) {
        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'gestion-link-button';
        removeButton.textContent = 'Retirer';
        removeButton.addEventListener('click', () => removeLocalUpload(item.id));
        card.appendChild(removeButton);
      }

      mediaGrid.appendChild(card);
    });

    updateMediaCounters();
  };

  const handleFilesSelected = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    files.forEach((file) => {
      mediaState.uploadCounter += 1;
      const heic = isHeicFile(file);
      mediaState.localUploads.unshift({
        id: `upload-${Date.now()}-${mediaState.uploadCounter}`,
        kind: 'upload',
        filename: file.name,
        file,
        src: heic ? '' : URL.createObjectURL(file),
        isHeic: heic,
        mimeType: file.type,
        bytes: file.size
      });
    });

    mediaState.activeFilter = 'new-upload';
    renderMediaFilters();
    renderMediaGrid();
    setStatus(`${files.length} photo(s) ajoutée(s) à la sélection. Cochez-les puis importez-les.`, 'success');
  };

  const removeLocalUpload = (id) => {
    const item = mediaState.localUploads.find((entry) => entry.id === id);
    if (item?.src) URL.revokeObjectURL(item.src);
    mediaState.localUploads = mediaState.localUploads.filter((entry) => entry.id !== id);
    mediaState.selected.delete(id);
    renderMediaGrid();
  };

  const refreshImportedStatus = async () => {
    const filenames = allSiteMedia().map((item) => item.filename);
    if (!filenames.length) return;
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('l5d2lm_media')
      .select('original_filename')
      .in('original_filename', filenames)
      .is('deleted_at', null);
    if (error) throw error;
    mediaState.importedFilenames = new Set((data || []).map((row) => row.original_filename));
  };

  const loadMediaPanel = async () => {
    if (!mediaGrid) return;
    try {
      await refreshImportedStatus();
    } catch (error) {
      setStatus(error.message || 'Impossible de charger l’état des photos importées.', 'error');
    }
    mediaState.loaded = true;
    renderMediaFilters();
    renderMediaGrid();
  };

  const handleSelectVisible = () => {
    visibleMedia().forEach((item) => {
      if (!isItemImported(item)) mediaState.selected.add(item.id);
    });
    renderMediaGrid();
  };

  const handleClearSelection = () => {
    mediaState.selected.clear();
    renderMediaGrid();
  };

  const handleImportSelection = async () => {
    const items = allMedia().filter((item) => mediaState.selected.has(item.id) && !isItemImported(item));

    if (!items.length) {
      setStatus('Aucune photo à importer dans la sélection.', 'error');
      return;
    }

    setBusy(mediaImportButton, true);
    setStatus(`Import de ${items.length} photo(s) en cours...`);

    const supabase = getSupabase();
    let imported = 0;
    let duplicates = 0;
    const failedItems = [];

    try {
      const { data: batch, error: batchError } = await supabase
        .from('l5d2lm_upload_batches')
        .insert({ label: `Import — ${new Date().toLocaleDateString('fr-CH')}`, media_count: items.length })
        .select()
        .single();
      if (batchError) throw batchError;

      for (const item of items) {
        try {
          let blob;
          if (item.kind === 'upload') {
            blob = item.file;
          } else {
            const response = await fetch(item.src);
            if (!response.ok) throw new Error(`Fichier introuvable sur le site : ${item.filename}`);
            blob = await response.blob();
          }

          const hash = await sha256Hex(blob);
          const storagePath = `${batch.id}/${sanitizeStorageSegment(item.filename)}`;
          const contentType = blob.type || item.mimeType || 'application/octet-stream';

          const { error: uploadError } = await supabase.storage
            .from('l5d2lm-private-originals')
            .upload(storagePath, blob, { contentType, upsert: false });
          if (uploadError) throw uploadError;

          const { error: insertError } = await supabase.from('l5d2lm_media').insert({
            original_filename: item.filename,
            original_mime_type: contentType,
            original_byte_size: blob.size,
            original_sha256: hash,
            original_private_path: storagePath,
            upload_batch_id: batch.id
          });

          if (insertError) {
            if (insertError.code === '23505') {
              duplicates += 1;
              mediaState.importedFilenames.add(item.filename);
              mediaState.selected.delete(item.id);
              continue;
            }
            throw insertError;
          }

          mediaState.importedFilenames.add(item.filename);
          mediaState.selected.delete(item.id);
          if (item.kind === 'upload' && item.src) URL.revokeObjectURL(item.src);
          imported += 1;
        } catch (itemError) {
          const reason = itemError?.message || itemError?.error_description || String(itemError);
          failedItems.push({ filename: item.filename, reason });
          console.error(`Import échoué pour ${item.filename} :`, itemError);
        }
      }

      renderMediaGrid();
      const parts = [];
      if (imported) parts.push(`${imported} photo(s) importée(s) en brouillon, droits à vérifier`);
      if (duplicates) parts.push(`${duplicates} déjà présente(s) (contenu identique)`);
      if (failedItems.length) {
        const detail = failedItems.map((f) => `${f.filename} (${f.reason})`).join(' · ');
        parts.push(`${failedItems.length} en échec — ${detail}`);
      }
      setStatus(parts.join(' — ') || 'Import terminé.', failedItems.length ? 'error' : 'success');
    } catch (error) {
      setStatus(error.message || 'Import impossible.', 'error');
    } finally {
      setBusy(mediaImportButton, false);
    }
  };

  if (mediaSelectVisibleButton) mediaSelectVisibleButton.addEventListener('click', handleSelectVisible);
  if (mediaClearSelectionButton) mediaClearSelectionButton.addEventListener('click', handleClearSelection);
  if (mediaImportButton) mediaImportButton.addEventListener('click', handleImportSelection);
  if (mediaUploadInput) {
    mediaUploadInput.addEventListener('change', () => {
      handleFilesSelected(mediaUploadInput.files);
      mediaUploadInput.value = '';
    });
  }

  const init = async () => {
    showView('loading');
    try {
      const supabase = getSupabase();
      supabase.auth.onAuthStateChange((_event, session) => {
        state.session = session;
      });

      if (getAuthFlowType() === 'recovery') {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        state.session = data.session;
        if (state.session) {
          showView('password-update');
          setStatus('Lien de réinitialisation validé. Choisissez un nouveau mot de passe.', 'success');
          return;
        }
      }

      await routeSession();
    } catch (error) {
      showView('login');
      setStatus(error.message || 'Initialisation impossible.', 'error');
    }
  };

  loginForm.addEventListener('submit', handleLogin);
  resetRequestForm.addEventListener('submit', handleResetRequest);
  passwordUpdateForm.addEventListener('submit', handlePasswordUpdate);
  showResetButton.addEventListener('click', () => {
    showView('password-reset-request');
    setStatus('');
  });
  showLoginButtons.forEach((button) => {
    button.addEventListener('click', () => {
      showView('login');
      setStatus('');
    });
  });
  enrollButton.addEventListener('click', handleEnrollMfa);
  verifyNewMfaForm.addEventListener('submit', handleVerifyNewMfa);
  verifyMfaForm.addEventListener('submit', handleVerifyMfa);
  signOutButtons.forEach((button) => button.addEventListener('click', handleSignOut));
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => activateTab(tab.dataset.tab));
  });

  init();
})();
