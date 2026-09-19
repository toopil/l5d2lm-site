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
    await loadCategoriesPanel();
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
  const mediaRightsFilters = document.querySelector('[data-media-rights-filters]');
  const mediaTotalEl = document.querySelector('[data-media-total]');
  const mediaImportedEl = document.querySelector('[data-media-imported]');
  const mediaSelectedEl = document.querySelector('[data-media-selected]');
  const mediaSelectVisibleButton = document.querySelector('[data-media-select-visible]');
  const mediaClearSelectionButton = document.querySelector('[data-media-clear-selection]');
  const mediaImportButton = document.querySelector('[data-media-import]');
  const mediaUploadInput = document.querySelector('[data-media-upload-input]');
  const mediaBulkPanel = document.querySelector('[data-media-bulk-panel]');
  const mediaBulkCountEl = document.querySelector('[data-media-bulk-count]');
  const rightsButtonsContainer = document.querySelector('[data-rights-buttons]');
  const bulkCategoryChecks = document.querySelector('[data-bulk-category-checks]');

  // Catégories (onglet Catégories, et cases à cocher réutilisées dans Photos)
  const categoriesTree = document.querySelector('[data-categories-tree]');
  const categoryNewButton = document.querySelector('[data-category-new]');
  const categorySeedButton = document.querySelector('[data-category-seed]');
  const categoryForm = document.querySelector('[data-category-form]');
  const categoryParentSelect = document.querySelector('[data-category-parent-select]');
  const categoryCancelButton = document.querySelector('[data-category-cancel]');

  const RIGHTS_STATUSES = [
    { value: 'authorized', label: 'Autorisation OK' },
    { value: 'faces_to_blur', label: 'Visages à flouter' },
    { value: 'needs_review', label: 'À vérifier' },
    { value: 'do_not_publish', label: 'Ne pas publier' }
  ];

  const CATEGORY_STATUS_LABEL = { draft: 'Brouillon', published: 'Publié', hidden: 'Masqué' };

  // Regex partagée (diacritiques Unicode) pour le nom de fichier de stockage
  // et pour les identifiants (slugs) de catégorie.
  const COMBINING_DIACRITICS = new RegExp('[̀-ͯ]', 'g');

  const slugify = (text) => String(text || '')
    .normalize('NFD').replace(COMBINING_DIACRITICS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const mediaState = {
    selected: new Set(),
    importedFilenames: new Set(),
    importedByFilename: new Map(),
    mediaSections: new Map(),
    localUploads: [],
    activeFilter: 'all',
    rightsFilter: 'all',
    loaded: false,
    uploadCounter: 0
  };

  const sectionsState = { items: [] };

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

    const clean = (part) => part
      .normalize('NFD').replace(COMBINING_DIACRITICS, '') // accents -> lettres de base
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
    let items = allMedia();
    if (mediaState.activeFilter === 'new-upload') items = items.filter((item) => item.kind === 'upload');
    else if (mediaState.activeFilter !== 'all') items = items.filter((item) => item.sectionSlug === mediaState.activeFilter);

    if (mediaState.rightsFilter !== 'all') {
      items = items.filter((item) => {
        const info = mediaState.importedByFilename.get(item.filename);
        return info && info.rights_status === mediaState.rightsFilter;
      });
    }
    return items;
  };

  const isItemImported = (item) => mediaState.importedByFilename.has(item.filename);

  const selectedImportedInfos = () => {
    const infos = [];
    allMedia().forEach((item) => {
      if (!mediaState.selected.has(item.id)) return;
      const info = mediaState.importedByFilename.get(item.filename);
      if (info) infos.push(info);
    });
    return infos;
  };

  const updateBulkPanel = () => {
    const count = selectedImportedInfos().length;
    if (mediaBulkCountEl) mediaBulkCountEl.textContent = String(count);
    if (mediaBulkPanel) mediaBulkPanel.hidden = count === 0;
  };

  const updateMediaCounters = () => {
    if (mediaTotalEl) mediaTotalEl.textContent = String(allMedia().length);
    if (mediaImportedEl) mediaImportedEl.textContent = String(mediaState.importedByFilename.size);
    if (mediaSelectedEl) mediaSelectedEl.textContent = String(mediaState.selected.size);
    updateBulkPanel();
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

  const renderRightsFilters = () => {
    if (!mediaRightsFilters) return;
    const options = [{ value: 'all', label: 'Tous les droits' }, ...RIGHTS_STATUSES];
    mediaRightsFilters.innerHTML = '';
    options.forEach(({ value, label }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.classList.toggle('is-active', mediaState.rightsFilter === value);
      button.addEventListener('click', () => {
        mediaState.rightsFilter = value;
        renderRightsFilters();
        renderMediaGrid();
      });
      mediaRightsFilters.appendChild(button);
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
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) mediaState.selected.add(item.id);
        else mediaState.selected.delete(item.id);
        card.classList.toggle('is-selected', checkbox.checked);
        updateMediaCounters();
      });
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(isImported ? 'Sélectionner (déjà importée)' : 'Sélectionner'));
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

      if (isImported) {
        const info = mediaState.importedByFilename.get(item.filename);

        const rightsRow = document.createElement('div');
        rightsRow.className = 'media-item__rights';

        const rightsBadge = document.createElement('span');
        const rightsDef = RIGHTS_STATUSES.find((entry) => entry.value === info.rights_status);
        rightsBadge.className = `media-badge media-badge--rights-${info.rights_status}`;
        rightsBadge.textContent = rightsDef ? rightsDef.label : info.rights_status;
        rightsRow.appendChild(rightsBadge);

        const favoriteButton = document.createElement('button');
        favoriteButton.type = 'button';
        favoriteButton.className = 'media-item__favorite';
        favoriteButton.textContent = info.favorite ? '★' : '☆';
        favoriteButton.setAttribute('aria-label', info.favorite ? 'Retirer des favoris' : 'Marquer comme favori');
        favoriteButton.addEventListener('click', () => toggleFavorite(info));
        rightsRow.appendChild(favoriteButton);

        meta.appendChild(rightsRow);

        const assignments = mediaState.mediaSections.get(info.id) || new Map();
        if (assignments.size) {
          const sectionsRow = document.createElement('div');
          sectionsRow.className = 'media-item__sections';
          Array.from(assignments.entries())
            .sort((a, b) => a[1] - b[1])
            .forEach(([sectionId, order]) => {
              const section = sectionsState.items.find((entry) => entry.id === sectionId);
              if (!section) return;
              const chip = document.createElement('span');
              chip.className = 'media-badge media-item__section-chip';

              const label = document.createElement('span');
              label.textContent = `${section.title} · ordre ${order}`;
              chip.appendChild(label);

              const upButton = document.createElement('button');
              upButton.type = 'button';
              upButton.className = 'media-item__chip-move';
              upButton.textContent = '▲';
              upButton.setAttribute('aria-label', `Faire remonter dans ${section.title}`);
              upButton.addEventListener('click', () => moveMediaInSection(info.id, sectionId, -1));
              chip.appendChild(upButton);

              const downButton = document.createElement('button');
              downButton.type = 'button';
              downButton.className = 'media-item__chip-move';
              downButton.textContent = '▼';
              downButton.setAttribute('aria-label', `Faire descendre dans ${section.title}`);
              downButton.addEventListener('click', () => moveMediaInSection(info.id, sectionId, 1));
              chip.appendChild(downButton);

              sectionsRow.appendChild(chip);
            });
          meta.appendChild(sectionsRow);
        }
      }

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
      .select('id, original_filename, rights_status, favorite, publish_status')
      .in('original_filename', filenames)
      .is('deleted_at', null);
    if (error) throw error;
    mediaState.importedByFilename = new Map((data || []).map((row) => [row.original_filename, row]));
    mediaState.importedFilenames = new Set(mediaState.importedByFilename.keys());
    await fetchMediaSections((data || []).map((row) => row.id));
  };

  const fetchMediaSections = async (mediaIds) => {
    mediaState.mediaSections = new Map();
    if (!mediaIds.length) return;
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('l5d2lm_media_sections')
      .select('media_id, section_id, sort_order')
      .in('media_id', mediaIds);
    if (error) throw error;
    (data || []).forEach(({ media_id: mediaId, section_id: sectionId, sort_order: order }) => {
      if (!mediaState.mediaSections.has(mediaId)) mediaState.mediaSections.set(mediaId, new Map());
      mediaState.mediaSections.get(mediaId).set(sectionId, order);
    });
  };

  const fetchSections = async () => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('l5d2lm_sections')
      .select('id, parent_id, slug, title, status, sort_order')
      .is('deleted_at', null)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    sectionsState.items = data || [];
  };

  const fetchSectionMediaCounts = async () => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('l5d2lm_media_sections').select('section_id');
    if (error) throw error;
    const counts = new Map();
    (data || []).forEach(({ section_id: sectionId }) => counts.set(sectionId, (counts.get(sectionId) || 0) + 1));
    return counts;
  };

  const renderBulkCategoryChecks = () => {
    if (!bulkCategoryChecks) return;
    bulkCategoryChecks.innerHTML = '';
    if (!sectionsState.items.length) {
      bulkCategoryChecks.textContent = 'Créez d’abord une catégorie dans l’onglet Catégories.';
      return;
    }
    sectionsState.items.forEach((section) => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = section.id;
      label.appendChild(input);
      label.appendChild(document.createTextNode(section.title));
      bulkCategoryChecks.appendChild(label);
    });
  };

  const toggleFavorite = async (info) => {
    const supabase = getSupabase();
    const newValue = !info.favorite;
    const { error } = await supabase.from('l5d2lm_media').update({ favorite: newValue }).eq('id', info.id);
    if (error) {
      setStatus(error.message || 'Impossible de mettre à jour le favori.', 'error');
      return;
    }
    info.favorite = newValue;
    renderMediaGrid();
  };

  // Ordre d'apparition d'une photo au sein d'une catégorie (du haut de page
  // vers le bas). Limité aux photos actuellement connues dans cette session
  // (catalogue du site + imports récents), pas une vue complète de la base.
  const moveMediaInSection = async (mediaId, sectionId, direction) => {
    const entries = [];
    mediaState.mediaSections.forEach((sections, mid) => {
      if (sections.has(sectionId)) entries.push({ mediaId: mid, order: sections.get(sectionId) });
    });
    entries.sort((a, b) => a.order - b.order);

    const index = entries.findIndex((entry) => entry.mediaId === mediaId);
    const targetIndex = index + direction;
    if (index === -1 || targetIndex < 0 || targetIndex >= entries.length) return;

    const current = entries[index];
    const target = entries[targetIndex];
    const supabase = getSupabase();

    try {
      const { error: error1 } = await supabase
        .from('l5d2lm_media_sections')
        .update({ sort_order: target.order })
        .eq('media_id', current.mediaId)
        .eq('section_id', sectionId);
      if (error1) throw error1;

      const { error: error2 } = await supabase
        .from('l5d2lm_media_sections')
        .update({ sort_order: current.order })
        .eq('media_id', target.mediaId)
        .eq('section_id', sectionId);
      if (error2) throw error2;

      await fetchMediaSections(Array.from(mediaState.importedByFilename.values()).map((info) => info.id));
      renderMediaGrid();
    } catch (error) {
      setStatus(error.message || 'Impossible de réordonner cette photo.', 'error');
    }
  };

  const handleBulkRightsChange = async (status) => {
    const infos = selectedImportedInfos();
    if (!infos.length) {
      setStatus('Sélectionnez au moins une photo déjà importée.', 'error');
      return;
    }
    const supabase = getSupabase();
    const { error } = await supabase.from('l5d2lm_media').update({ rights_status: status }).in('id', infos.map((info) => info.id));
    if (error) {
      setStatus(error.message || 'Impossible de mettre à jour les droits.', 'error');
      return;
    }
    infos.forEach((info) => { info.rights_status = status; });
    renderMediaGrid();
    setStatus(`Droits mis à jour pour ${infos.length} photo(s).`, 'success');
  };

  const handleBulkFavorite = async (value) => {
    const infos = selectedImportedInfos();
    if (!infos.length) {
      setStatus('Sélectionnez au moins une photo déjà importée.', 'error');
      return;
    }
    const supabase = getSupabase();
    const { error } = await supabase.from('l5d2lm_media').update({ favorite: value }).in('id', infos.map((info) => info.id));
    if (error) {
      setStatus(error.message || 'Impossible de mettre à jour les favoris.', 'error');
      return;
    }
    infos.forEach((info) => { info.favorite = value; });
    renderMediaGrid();
    setStatus(`Favori ${value ? 'ajouté' : 'retiré'} pour ${infos.length} photo(s).`, 'success');
  };

  const handleBulkCategoryApply = async (mode) => {
    const infos = selectedImportedInfos();
    const checkedSectionIds = bulkCategoryChecks
      ? Array.from(bulkCategoryChecks.querySelectorAll('input:checked')).map((el) => el.value)
      : [];

    if (!infos.length || !checkedSectionIds.length) {
      setStatus('Sélectionnez des photos importées et au moins une catégorie.', 'error');
      return;
    }

    const supabase = getSupabase();

    if (mode === 'add') {
      // sort_order place la photo en fin de catégorie (ordre d'apparition,
      // du haut de page vers le bas) : on compte combien de photos sont déjà
      // dans CETTE catégorie, pas combien de catégories a cette photo.
      const countInSection = (sectionId) => {
        let count = 0;
        mediaState.mediaSections.forEach((sections) => { if (sections.has(sectionId)) count += 1; });
        return count;
      };
      const sectionCounters = new Map(checkedSectionIds.map((sectionId) => [sectionId, countInSection(sectionId)]));

      const rows = [];
      infos.forEach((info) => {
        checkedSectionIds.forEach((sectionId) => {
          if (mediaState.mediaSections.get(info.id)?.has(sectionId)) return; // déjà dans cette catégorie
          const order = sectionCounters.get(sectionId) * 10;
          sectionCounters.set(sectionId, sectionCounters.get(sectionId) + 1);
          rows.push({ media_id: info.id, section_id: sectionId, sort_order: order });
        });
      });
      const { error } = await supabase
        .from('l5d2lm_media_sections')
        .upsert(rows, { onConflict: 'media_id,section_id', ignoreDuplicates: true });
      if (error) {
        setStatus(error.message || 'Impossible d’ajouter les catégories.', 'error');
        return;
      }
    } else {
      const { error } = await supabase
        .from('l5d2lm_media_sections')
        .delete()
        .in('media_id', infos.map((info) => info.id))
        .in('section_id', checkedSectionIds);
      if (error) {
        setStatus(error.message || 'Impossible de retirer les catégories.', 'error');
        return;
      }
    }

    await fetchMediaSections(Array.from(mediaState.importedByFilename.values()).map((info) => info.id));
    renderMediaGrid();
    setStatus(`Catégories ${mode === 'add' ? 'ajoutées' : 'retirées'} pour ${infos.length} photo(s).`, 'success');
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
    renderRightsFilters();
    renderMediaGrid();
  };

  const handleSelectVisible = () => {
    // Sélectionne tout ce qui est visible : les photos pas encore importées
    // (pour "Importer la sélection") et celles déjà importées (pour les
    // actions groupées droits/favori/catégories, qui ignorent les autres).
    visibleMedia().forEach((item) => mediaState.selected.add(item.id));
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

          const { data: insertedRow, error: insertError } = await supabase
            .from('l5d2lm_media')
            .insert({
              original_filename: item.filename,
              original_mime_type: contentType,
              original_byte_size: blob.size,
              original_sha256: hash,
              original_private_path: storagePath,
              upload_batch_id: batch.id
            })
            .select('id, original_filename, rights_status, favorite, publish_status')
            .single();

          if (insertError) {
            if (insertError.code === '23505') {
              duplicates += 1;
              const { data: existingRow } = await supabase
                .from('l5d2lm_media')
                .select('id, original_filename, rights_status, favorite, publish_status')
                .eq('original_sha256', hash)
                .is('deleted_at', null)
                .limit(1)
                .maybeSingle();
              if (existingRow) mediaState.importedByFilename.set(item.filename, existingRow);
              mediaState.importedFilenames.add(item.filename);
              mediaState.selected.delete(item.id);
              continue;
            }
            throw insertError;
          }

          mediaState.importedByFilename.set(item.filename, insertedRow);
          mediaState.importedFilenames.add(item.filename);
          mediaState.selected.delete(item.id);
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
  if (rightsButtonsContainer) {
    RIGHTS_STATUSES.forEach(({ value, label }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn';
      button.textContent = label;
      button.addEventListener('click', () => handleBulkRightsChange(value));
      rightsButtonsContainer.appendChild(button);
    });
  }
  document.querySelectorAll('[data-bulk-favorite]').forEach((button) => {
    button.addEventListener('click', () => handleBulkFavorite(button.dataset.bulkFavorite === 'true'));
  });
  document.querySelectorAll('[data-bulk-category-apply]').forEach((button) => {
    button.addEventListener('click', () => handleBulkCategoryApply(button.dataset.bulkCategoryApply));
  });

  // Onglet Catégories : créer/modifier/ordonner/publier-masquer/supprimer
  // les propositions (l5d2lm_sections), jusqu'à ~3 niveaux via parent_id.
  let editingCategoryId = null;

  const openCategoryForm = (category = null) => {
    if (!categoryForm) return;
    editingCategoryId = category ? category.id : null;
    categoryForm.hidden = false;
    categoryForm.querySelector('[name="title"]').value = category ? category.title : '';
    categoryForm.querySelector('[name="slug"]').value = category ? category.slug : '';
    categoryForm.querySelector('[name="parent_id"]').value = category?.parent_id || '';
  };

  const closeCategoryForm = () => {
    if (!categoryForm) return;
    categoryForm.hidden = true;
    categoryForm.reset();
    editingCategoryId = null;
  };

  const renderCategoryParentOptions = () => {
    if (!categoryParentSelect) return;
    const current = categoryParentSelect.value;
    categoryParentSelect.innerHTML = '<option value="">— Aucune (premier niveau) —</option>';
    sectionsState.items.forEach((section) => {
      if (section.id === editingCategoryId) return; // une catégorie ne peut pas être son propre parent
      const option = document.createElement('option');
      option.value = section.id;
      option.textContent = section.title;
      categoryParentSelect.appendChild(option);
    });
    categoryParentSelect.value = current;
  };

  const moveCategory = async (section, siblings, index, direction) => {
    const target = siblings[index + direction];
    if (!target) return;
    const supabase = getSupabase();
    const a = section.sort_order;
    const b = target.sort_order;
    try {
      const { error: error1 } = await supabase.from('l5d2lm_sections').update({ sort_order: b }).eq('id', section.id);
      if (error1) throw error1;
      const { error: error2 } = await supabase.from('l5d2lm_sections').update({ sort_order: a }).eq('id', target.id);
      if (error2) throw error2;
      await loadCategoriesPanel();
    } catch (error) {
      setStatus(error.message || 'Impossible de réordonner les catégories.', 'error');
    }
  };

  const changeCategoryStatus = async (section, status) => {
    const supabase = getSupabase();
    const { error } = await supabase.from('l5d2lm_sections').update({ status }).eq('id', section.id);
    if (error) {
      setStatus(error.message || 'Impossible de changer le statut.', 'error');
      return;
    }
    setStatus(`« ${section.title} » : ${CATEGORY_STATUS_LABEL[status] || status}.`, 'success');
    await loadCategoriesPanel();
  };

  const deleteCategory = async (section) => {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('l5d2lm_sections')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', section.id);
    if (error) {
      setStatus(error.message || 'Impossible de supprimer la catégorie.', 'error');
      return;
    }
    setStatus(`« ${section.title} » mise à la corbeille.`, 'success');
    await loadCategoriesPanel();
  };

  const renderCategoryTree = async () => {
    if (!categoriesTree) return;
    categoriesTree.innerHTML = '';

    let counts = new Map();
    try {
      counts = await fetchSectionMediaCounts();
    } catch (error) {
      // Le compte de photos reste indicatif : une erreur ici n'empêche pas de gérer les catégories.
    }

    if (!sectionsState.items.length) {
      const empty = document.createElement('p');
      empty.textContent = 'Aucune catégorie pour l’instant. Créez-en une, ou reprenez celles déjà utilisées sur le site.';
      categoriesTree.appendChild(empty);
      return;
    }

    const renderLevel = (parentId, depth) => {
      const siblings = sectionsState.items
        .filter((section) => (section.parent_id || null) === parentId)
        .sort((a, b) => a.sort_order - b.sort_order);

      siblings.forEach((section, index) => {
        const node = document.createElement('div');
        node.className = `category-node category-node--status-${section.status}`;
        node.style.marginLeft = `${depth * 1.5}rem`;

        const head = document.createElement('div');
        head.className = 'category-node__head';

        const title = document.createElement('span');
        title.className = 'category-node__title';
        title.textContent = section.title;
        head.appendChild(title);

        const statusBadge = document.createElement('span');
        statusBadge.className = 'media-badge';
        statusBadge.textContent = CATEGORY_STATUS_LABEL[section.status] || section.status;
        head.appendChild(statusBadge);

        const count = counts.get(section.id) || 0;
        const meta = document.createElement('span');
        meta.className = 'category-node__meta';
        meta.textContent = `${count} photo(s)`;
        head.appendChild(meta);

        node.appendChild(head);

        if (section.status === 'published' && count === 0) {
          const warning = document.createElement('p');
          warning.className = 'category-node__warning';
          warning.textContent = 'Publiée sans aucune photo : elle n’apparaîtra pas correctement publiquement.';
          node.appendChild(warning);
        }

        const actions = document.createElement('div');
        actions.className = 'category-node__actions';

        const upButton = document.createElement('button');
        upButton.type = 'button';
        upButton.textContent = '↑ Monter';
        upButton.disabled = index === 0;
        upButton.addEventListener('click', () => moveCategory(section, siblings, index, -1));
        actions.appendChild(upButton);

        const downButton = document.createElement('button');
        downButton.type = 'button';
        downButton.textContent = '↓ Descendre';
        downButton.disabled = index === siblings.length - 1;
        downButton.addEventListener('click', () => moveCategory(section, siblings, index, 1));
        actions.appendChild(downButton);

        Object.keys(CATEGORY_STATUS_LABEL)
          .filter((status) => status !== section.status)
          .forEach((status) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = { draft: 'Mettre en brouillon', published: 'Publier', hidden: 'Masquer' }[status];
            button.addEventListener('click', () => changeCategoryStatus(section, status));
            actions.appendChild(button);
          });

        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.textContent = 'Modifier';
        editButton.addEventListener('click', () => {
          renderCategoryParentOptions();
          openCategoryForm(section);
        });
        actions.appendChild(editButton);

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.textContent = 'Supprimer';
        deleteButton.addEventListener('click', () => deleteCategory(section));
        actions.appendChild(deleteButton);

        node.appendChild(actions);
        categoriesTree.appendChild(node);

        renderLevel(section.id, depth + 1);
      });
    };

    renderLevel(null, 0);
  };

  const handleCategorySubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(categoryForm);
    const title = String(form.get('title') || '').trim();
    const slug = String(form.get('slug') || '').trim() || slugify(title);
    const parentId = String(form.get('parent_id') || '') || null;

    if (!title || !slug) {
      setStatus('Le titre et l’identifiant sont obligatoires.', 'error');
      return;
    }

    const supabase = getSupabase();
    try {
      if (editingCategoryId) {
        const { error } = await supabase
          .from('l5d2lm_sections')
          .update({ title, slug, parent_id: parentId })
          .eq('id', editingCategoryId);
        if (error) throw error;
        setStatus(`Catégorie « ${title} » modifiée.`, 'success');
      } else {
        const siblings = sectionsState.items.filter((section) => (section.parent_id || null) === parentId);
        const maxOrder = siblings.reduce((max, section) => Math.max(max, section.sort_order || 0), 0);
        const { error } = await supabase.from('l5d2lm_sections').insert({
          title,
          slug,
          parent_id: parentId,
          status: 'draft',
          sort_order: maxOrder + 10
        });
        if (error) throw error;
        setStatus(`Catégorie « ${title} » créée en brouillon.`, 'success');
      }
      closeCategoryForm();
      await loadCategoriesPanel();
    } catch (error) {
      setStatus(error.message || 'Impossible d’enregistrer la catégorie.', 'error');
    }
  };

  const handleCategorySeed = async () => {
    const supabase = getSupabase();
    const existingSlugs = new Set(sectionsState.items.map((section) => section.slug));
    const toCreate = allSections().filter((section) => !existingSlugs.has(section.slug));
    if (!toCreate.length) {
      setStatus('Les catégories du site existent déjà.', 'error');
      return;
    }
    const rows = toCreate.map((section) => ({
      title: section.title,
      slug: section.slug,
      status: 'published',
      sort_order: section.sortOrder || 0
    }));
    const { error } = await supabase.from('l5d2lm_sections').insert(rows);
    if (error) {
      setStatus(error.message || 'Impossible de créer les catégories.', 'error');
      return;
    }
    setStatus(`${rows.length} catégorie(s) créée(s) depuis le catalogue du site.`, 'success');
    await loadCategoriesPanel();
  };

  const loadCategoriesPanel = async () => {
    if (!categoriesTree) return;
    try {
      await fetchSections();
    } catch (error) {
      setStatus(error.message || 'Impossible de charger les catégories.', 'error');
      return;
    }
    renderCategoryParentOptions();
    await renderCategoryTree();
    renderBulkCategoryChecks();
  };

  if (categoryNewButton) {
    categoryNewButton.addEventListener('click', () => {
      renderCategoryParentOptions();
      openCategoryForm();
    });
  }
  if (categorySeedButton) categorySeedButton.addEventListener('click', handleCategorySeed);
  if (categoryCancelButton) categoryCancelButton.addEventListener('click', closeCategoryForm);
  if (categoryForm) {
    categoryForm.addEventListener('submit', handleCategorySubmit);
    const titleInput = categoryForm.querySelector('[name="title"]');
    if (titleInput) {
      titleInput.addEventListener('input', (event) => {
        if (editingCategoryId) return; // ne pas re-générer le slug en modification
        const slugField = categoryForm.querySelector('[name="slug"]');
        if (slugField) slugField.value = slugify(event.target.value);
      });
    }
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
