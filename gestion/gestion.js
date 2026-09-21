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

  const gestionShell = document.querySelector('.gestion-shell');
  const preLoginHeader = document.querySelector('[data-pre-login-header]');
  const adminTopbar = document.querySelector('[data-admin-topbar]');

  const showView = (name) => {
    views.forEach((view) => {
      view.hidden = view.dataset.view !== name;
    });
    const isAdmin = name === 'admin';
    if (gestionShell) gestionShell.classList.toggle('is-admin-view', isAdmin);
    if (preLoginHeader) preLoginHeader.hidden = isAdmin;
    if (adminTopbar) adminTopbar.hidden = !isAdmin;
  };

  // Sous-navigations génériques (Site > Structure/Textes/Publication,
  // Plus > Corbeille/Historique/Sécurité) : chaque .subnav ne pilote que
  // les .subpanel de son propre article[data-panel].
  document.querySelectorAll('.subnav').forEach((nav) => {
    const container = nav.closest('[data-panel]');
    if (!container) return;
    nav.querySelectorAll('[data-subtab]').forEach((tabButton) => {
      tabButton.addEventListener('click', () => {
        nav.querySelectorAll('[data-subtab]').forEach((btn) => {
          btn.classList.toggle('is-active', btn === tabButton);
        });
        container.querySelectorAll('[data-subpanel]').forEach((panel) => {
          const active = panel.dataset.subpanel === tabButton.dataset.subtab;
          panel.hidden = !active;
          panel.classList.toggle('is-active', active);
        });
      });
    });
  });

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
    adminSummary.textContent = email;
    const securityEmail = document.querySelector('[data-security-email]');
    if (securityEmail) securityEmail.textContent = `${email} · double authentification active`;
    showView('admin');
    setStatus('Accès sécurisé confirmé.', 'success');
    await loadCategoriesPanel();
    await loadMediaPanel();
    await loadSlotsPanel();
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
  const mediaSearchInput = document.querySelector('[data-media-search]');
  const filtersDetails = document.querySelector('[data-filters-details]');
  const filterCategorySelect = document.querySelector('[data-filter-category]');
  const filterRightsSelect = document.querySelector('[data-filter-rights]');
  const filterStateSelect = document.querySelector('[data-filter-state]');
  const filterBatchSelect = document.querySelector('[data-filter-batch]');
  const activeFilterChipsEl = document.querySelector('[data-active-filter-chips]');
  const mediaTotalEl = document.querySelector('[data-media-total]');
  const mediaSelectedEl = document.querySelector('[data-media-selected]');
  const mediaSelectVisibleButton = document.querySelector('[data-media-select-visible]');
  const mediaClearSelectionButton = document.querySelector('[data-media-clear-selection]');
  const mediaImportBar = document.querySelector('[data-media-import-bar]');
  const mediaImportCountEl = document.querySelector('[data-media-import-count]');
  const mediaImportButton = document.querySelector('[data-media-import]');
  const mediaUploadInput = document.querySelector('[data-media-upload-input]');
  const mediaBulkPanel = document.querySelector('[data-media-bulk-panel]');
  const mediaBulkCountEl = document.querySelector('[data-media-bulk-count]');
  const rightsButtonsContainer = document.querySelector('[data-rights-buttons]');
  const bulkCategoryChecks = document.querySelector('[data-bulk-category-checks]');
  const bulkTrashButton = document.querySelector('[data-bulk-trash]');
  const pageNavEl = document.querySelector('[data-page-nav]');
  const photosAllView = document.querySelector('[data-photos-all-view]');
  const photosSectionView = document.querySelector('[data-photos-section-view]');
  const sectionViewTitle = document.querySelector('[data-section-view-title]');
  const sectionViewCount = document.querySelector('[data-section-view-count]');
  const sectionOrderList = document.querySelector('[data-section-order-list]');
  const sectionAddPhotoButton = document.querySelector('[data-section-add-photo]');
  const mediaPicker = document.querySelector('[data-media-picker]');
  const mediaPickerTitle = document.querySelector('[data-media-picker-title]');
  const mediaPickerGrid = document.querySelector('[data-media-picker-grid]');
  const mediaPickerSearch = document.querySelector('[data-media-picker-search]');
  const mediaPickerCloseButton = document.querySelector('[data-media-picker-close]');
  const mediaPickerUploadInput = document.querySelector('[data-media-picker-upload-input]');

  // Emplacements photo fixes du site public (Site > Emplacements). Doit
  // rester synchronisé avec build/slots.py — un slot_key ajouté ici sans
  // marqueur MEDIA_SLOT correspondant dans un fragment content/*.html
  // n'aurait aucun effet visible sur le site publié.
  const SLOT_DEFINITIONS = [
    { slotKey: 'corps-expression:playful-extatique', pageLabel: 'Corps & expression', label: 'Playful extatique', fallbackFilename: 'l5d2lm-photo-corps-expression-2.jpg' },
    { slotKey: 'corps-expression:theatre-improvisation', pageLabel: 'Corps & expression', label: 'Théâtre d’improvisation' },
    { slotKey: 'corps-expression:reveil-du-corps', pageLabel: 'Corps & expression', label: 'Réveil du corps' },
    { slotKey: 'corps-expression:jeux-de-mouvement', pageLabel: 'Corps & expression', label: 'Jeux de mouvement', fallbackFilename: 'l5d2lm-photo-corps-expression-jeux.jpg' },
    { slotKey: 'corps-expression:a-portee-de-main', pageLabel: 'Corps & expression', label: 'À portée de main', fallbackFilename: 'l5d2lm-photo-corps-expression-4.jpg' }
  ];
  const mediaSlotsListEl = document.querySelector('[data-media-slots-list]');

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

  // Longueur au-delà de laquelle une annotation risque de déborder une
  // vraie carte postale publique (espace bien plus contraint que l'admin).
  const ANNOTATION_WARNING_LENGTH = 140;

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
    // Source de vérité : tous les médias Supabase actifs (non supprimés),
    // indexés par id réel. importedByFilename/importedFilenames restent
    // dérivés de library (par nom de fichier) pour ne pas casser le reste
    // du code qui recherche déjà une "fiche" par original_filename.
    library: new Map(),
    importedFilenames: new Set(),
    importedByFilename: new Map(),
    mediaSections: new Map(),
    localUploads: [],
    categoryFilter: 'all',
    rightsFilter: 'all',
    stateFilter: 'all',
    batchFilter: 'all',
    searchQuery: '',
    lastBatchId: null,
    activePage: 'all',
    libraryCounts: { bySection: new Map(), total: 0 },
    sectionOrderItems: [],
    slotAssignments: new Map(),
    signedUrlCache: new Map(),
    dragMediaId: null,
    pickerMode: null,
    pickerContext: null,
    pickerSearch: '',
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

  // Médiathèque Supabase = source de vérité. gestion-media-catalog.js ne
  // sert plus qu'à proposer la migration des anciennes photos du dépôt qui
  // ne sont pas encore dans l5d2lm_media (voir loadMediaLibrary).
  const allMedia = () => {
    const libraryItems = Array.from(mediaState.library.values()).map((row) => ({
      id: row.id,
      filename: row.original_filename,
      kind: 'library'
    }));
    const migratedFilenames = new Set(libraryItems.map((item) => item.filename));
    const catalogItems = allSiteMedia()
      .filter((item) => !migratedFilenames.has(item.filename))
      .map((item) => ({ ...item, kind: 'catalog' }));
    return [...mediaState.localUploads, ...libraryItems, ...catalogItems];
  };

  const visibleMedia = () => {
    let items = allMedia();

    if (mediaState.categoryFilter !== 'all') {
      items = items.filter((item) => {
        const info = mediaState.importedByFilename.get(item.filename);
        if (!info) return false;
        const assigned = mediaState.mediaSections.get(info.id);
        return assigned && assigned.has(mediaState.categoryFilter);
      });
    }

    if (mediaState.rightsFilter !== 'all') {
      items = items.filter((item) => {
        const info = mediaState.importedByFilename.get(item.filename);
        return info && info.rights_status === mediaState.rightsFilter;
      });
    }

    if (mediaState.stateFilter === 'unclassified') {
      items = items.filter((item) => {
        const info = mediaState.importedByFilename.get(item.filename);
        if (!info) return true; // pas encore importée = non classée par définition
        const assigned = mediaState.mediaSections.get(info.id);
        return !assigned || assigned.size === 0;
      });
    } else if (mediaState.stateFilter === 'favorite') {
      items = items.filter((item) => {
        const info = mediaState.importedByFilename.get(item.filename);
        return info && info.favorite;
      });
    }

    if (mediaState.batchFilter === 'last' && mediaState.lastBatchId) {
      items = items.filter((item) => {
        const info = mediaState.importedByFilename.get(item.filename);
        return info && info.upload_batch_id === mediaState.lastBatchId;
      });
    }

    if (mediaState.searchQuery) {
      const query = mediaState.searchQuery.toLowerCase();
      items = items.filter((item) => {
        const info = mediaState.importedByFilename.get(item.filename);
        const title = info?.default_annotation || '';
        const assigned = info ? mediaState.mediaSections.get(info.id) : null;
        const categoryNames = assigned
          ? Array.from(assigned.keys())
              .map((id) => sectionsState.items.find((section) => section.id === id)?.title || '')
              .join(' ')
          : '';
        const haystack = `${item.filename} ${title} ${categoryNames}`.toLowerCase();
        return haystack.includes(query);
      });
    }

    return items;
  };

  const isItemImported = (item) => item.kind === 'library';

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

    const pendingCount = allMedia().filter(
      (item) => mediaState.selected.has(item.id) && !isItemImported(item)
    ).length;
    if (mediaImportCountEl) mediaImportCountEl.textContent = String(pendingCount);
    if (mediaImportBar) mediaImportBar.hidden = pendingCount === 0;
  };

  const updateMediaCounters = () => {
    if (mediaTotalEl) mediaTotalEl.textContent = String(allMedia().length);
    if (mediaSelectedEl) mediaSelectedEl.textContent = String(mediaState.selected.size);
    updateBulkPanel();
  };

  // Filtres repliés dans "Filtres ▾" (des <select> plutôt que des rangées
  // de boutons) + pastilles pour les filtres actifs, comme demandé.
  const populateFilterSelects = () => {
    if (filterCategorySelect) {
      const current = filterCategorySelect.value || 'all';
      filterCategorySelect.innerHTML = '<option value="all">Toutes</option>';
      sectionsState.items.forEach((section) => {
        const option = document.createElement('option');
        option.value = section.id;
        option.textContent = section.title;
        filterCategorySelect.appendChild(option);
      });
      filterCategorySelect.value = sectionsState.items.some((s) => s.id === current) ? current : 'all';
    }
    if (filterRightsSelect && !filterRightsSelect.options.length) {
      filterRightsSelect.innerHTML = '<option value="all">Tous</option>';
      RIGHTS_STATUSES.forEach(({ value, label }) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        filterRightsSelect.appendChild(option);
      });
    }
  };

  const syncFilterSelects = () => {
    if (filterCategorySelect) filterCategorySelect.value = mediaState.categoryFilter;
    if (filterRightsSelect) filterRightsSelect.value = mediaState.rightsFilter;
    if (filterStateSelect) filterStateSelect.value = mediaState.stateFilter;
    if (filterBatchSelect) filterBatchSelect.value = mediaState.batchFilter;
  };

  const renderActiveFilterChips = () => {
    if (!activeFilterChipsEl) return;
    activeFilterChipsEl.innerHTML = '';
    const chips = [];

    if (mediaState.categoryFilter !== 'all') {
      const section = sectionsState.items.find((entry) => entry.id === mediaState.categoryFilter);
      chips.push({ label: section ? section.title : 'Catégorie', reset: () => { mediaState.categoryFilter = 'all'; } });
    }
    if (mediaState.rightsFilter !== 'all') {
      const def = RIGHTS_STATUSES.find((entry) => entry.value === mediaState.rightsFilter);
      chips.push({ label: def ? def.label : mediaState.rightsFilter, reset: () => { mediaState.rightsFilter = 'all'; } });
    }
    if (mediaState.stateFilter !== 'all') {
      const labels = { unclassified: 'Non classées', favorite: 'Favorites' };
      chips.push({ label: labels[mediaState.stateFilter] || mediaState.stateFilter, reset: () => { mediaState.stateFilter = 'all'; } });
    }
    if (mediaState.batchFilter !== 'all') {
      chips.push({ label: 'Dernier import', reset: () => { mediaState.batchFilter = 'all'; } });
    }

    chips.forEach(({ label, reset }) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'filter-chip';
      chip.textContent = `${label} ×`;
      chip.addEventListener('click', () => {
        reset();
        syncFilterSelects();
        renderActiveFilterChips();
        renderMediaGrid();
      });
      activeFilterChipsEl.appendChild(chip);
    });
  };

  const onFilterChange = () => {
    if (filtersDetails) filtersDetails.open = false;
    renderActiveFilterChips();
    renderMediaGrid();
  };

  if (filterCategorySelect) filterCategorySelect.addEventListener('change', () => { mediaState.categoryFilter = filterCategorySelect.value; onFilterChange(); });
  if (filterRightsSelect) filterRightsSelect.addEventListener('change', () => { mediaState.rightsFilter = filterRightsSelect.value; onFilterChange(); });
  if (filterStateSelect) filterStateSelect.addEventListener('change', () => { mediaState.stateFilter = filterStateSelect.value; onFilterChange(); });
  if (filterBatchSelect) filterBatchSelect.addEventListener('change', () => { mediaState.batchFilter = filterBatchSelect.value; onFilterChange(); });

  if (mediaSearchInput) {
    let searchTimer;
    mediaSearchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        mediaState.searchQuery = mediaSearchInput.value.trim();
        renderMediaGrid();
      }, 200);
    });
  }

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
      // Le statut d'import est déjà visible par ailleurs (badge "À
      // importer" sur les cartes en attente) : pas besoin de le répéter
      // sur chaque case à cocher.
      label.appendChild(document.createTextNode('Sélectionner'));
      card.appendChild(label);

      const thumb = document.createElement('div');
      thumb.className = 'media-item__thumb';
      if (isUpload && item.isHeic) {
        thumb.textContent = 'HEIC — aperçu indisponible, fichier conservé tel quel';
      } else {
        const img = document.createElement('img');
        img.alt = '';
        img.loading = 'lazy';
        if (item.kind === 'library') {
          const row = mediaState.library.get(item.id);
          if (row) img.style.objectPosition = `${(row.focal_x ?? 0.5) * 100}% ${(row.focal_y ?? 0.5) * 100}%`;
          attachMediaImage(img, row);
        } else {
          img.src = item.src;
        }
        thumb.appendChild(img);
      }
      card.appendChild(thumb);

      const meta = document.createElement('div');
      meta.className = 'media-item__meta';
      const info = isImported ? mediaState.importedByFilename.get(item.filename) : null;
      // Une fois un titre personnalisé enregistré, il remplace le nom
      // technique du fichier comme texte principal — jamais les deux à
      // la fois (le nom de fichier reste consultable via "Modifier...").
      const name = document.createElement('strong');
      name.textContent = info?.default_annotation || item.filename;
      meta.appendChild(name);

      if (!isImported) {
        const badges = document.createElement('div');
        badges.className = 'media-badges';
        const statusBadge = document.createElement('span');
        statusBadge.className = 'media-badge media-badge--pending';
        statusBadge.textContent = 'À importer';
        badges.appendChild(statusBadge);
        meta.appendChild(badges);
      }

      if (isImported) {
        const rightsRow = document.createElement('div');
        rightsRow.className = 'media-item__rights';

        // "Autorisation OK" est l'état validé : l'afficher sur chaque carte
        // n'apporte rien une fois que c'est fait — seuls les statuts qui
        // demandent encore une action restent visibles.
        if (info.rights_status !== 'authorized') {
          const rightsBadge = document.createElement('span');
          const rightsDef = RIGHTS_STATUSES.find((entry) => entry.value === info.rights_status);
          rightsBadge.className = `media-badge media-badge--rights-${info.rights_status}`;
          rightsBadge.textContent = rightsDef ? rightsDef.label : info.rights_status;
          rightsRow.appendChild(rightsBadge);
        }

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
          const ordered = Array.from(assignments.entries()).sort((a, b) => a[1] - b[1]);
          const visible = ordered.slice(0, 2);
          const remaining = ordered.length - visible.length;

          visible.forEach(([sectionId]) => {
            const section = sectionsState.items.find((entry) => entry.id === sectionId);
            if (!section) return;
            const chip = document.createElement('span');
            chip.className = 'media-badge';
            chip.textContent = section.title;
            sectionsRow.appendChild(chip);
          });

          if (remaining > 0) {
            const more = document.createElement('span');
            more.className = 'media-badge';
            more.textContent = `+${remaining}`;
            sectionsRow.appendChild(more);
          }

          meta.appendChild(sectionsRow);
        }

        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.className = 'gestion-link-button';
        editButton.textContent = 'Modifier le titre et les catégories';
        editButton.addEventListener('click', () => toggleMediaEditPanel(card, info));
        meta.appendChild(editButton);
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
      const id = `upload-${Date.now()}-${mediaState.uploadCounter}`;
      mediaState.localUploads.unshift({
        id,
        kind: 'upload',
        filename: file.name,
        file,
        src: heic ? '' : URL.createObjectURL(file),
        isHeic: heic,
        mimeType: file.type,
        bytes: file.size
      });
      mediaState.selected.add(id); // prêtes à être importées d'un clic
    });

    // Les fichiers qu'on vient d'ajouter doivent rester visibles même si un
    // filtre était actif juste avant.
    mediaState.categoryFilter = 'all';
    mediaState.rightsFilter = 'all';
    mediaState.stateFilter = 'all';
    mediaState.batchFilter = 'all';
    mediaState.searchQuery = '';
    if (mediaSearchInput) mediaSearchInput.value = '';
    syncFilterSelects();
    renderActiveFilterChips();
    renderMediaGrid();
    setStatus(`${files.length} photo(s) prête(s) à importer.`, 'success');
  };

  const removeLocalUpload = (id) => {
    const item = mediaState.localUploads.find((entry) => entry.id === id);
    if (item?.src) URL.revokeObjectURL(item.src);
    mediaState.localUploads = mediaState.localUploads.filter((entry) => entry.id !== id);
    mediaState.selected.delete(id);
    renderMediaGrid();
  };

  // Charge TOUTE la médiathèque Supabase active (pas seulement les médias
  // dont le nom de fichier existe dans le catalogue statique) : une photo
  // envoyée depuis un téléphone doit rester visible après rechargement,
  // reconnexion ou changement d'appareil.
  const loadMediaLibrary = async () => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('l5d2lm_media')
      .select(`
        id, original_filename, original_private_path, public_path,
        default_annotation, alt_text, rights_status, favorite,
        publish_status, processing_status, upload_batch_id, collection_id,
        focal_x, focal_y, created_at
      `)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;

    mediaState.library = new Map((data || []).map((row) => [row.id, row]));
    // Dérivé par nom de fichier pour le reste du code (édition, recherche,
    // filtres, actions groupées) qui retrouve déjà une fiche par filename.
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

  const findSectionIdBySlug = (slug) => sectionsState.items.find((section) => section.slug === slug)?.id || null;

  // Combien de photos sont déjà dans cette catégorie (toutes médias
  // confondus) : sert à placer une nouvelle association en fin de page.
  const countMediaInSection = (sectionId) => {
    let count = 0;
    mediaState.mediaSections.forEach((sections) => { if (sections.has(sectionId)) count += 1; });
    return count;
  };

  // Compte réel par catégorie (et total médiathèque), en excluant les
  // photos à la corbeille. Utilisé par l'onglet Catégories ET par la
  // navigation par page dans Photos — une seule source de vérité.
  const fetchLibraryCounts = async () => {
    const supabase = getSupabase();

    const { data: mediaRows, error: mediaError } = await supabase
      .from('l5d2lm_media')
      .select('id')
      .is('deleted_at', null);
    if (mediaError) throw mediaError;
    const activeIds = new Set((mediaRows || []).map((row) => row.id));

    const { data: assocRows, error: assocError } = await supabase
      .from('l5d2lm_media_sections')
      .select('section_id, media_id');
    if (assocError) throw assocError;

    const bySection = new Map();
    assocRows.forEach(({ section_id: sectionId, media_id: mediaId }) => {
      if (!activeIds.has(mediaId)) return;
      bySection.set(sectionId, (bySection.get(sectionId) || 0) + 1);
    });

    return { bySection, total: activeIds.size };
  };

  const SIGNED_URL_TTL_SECONDS = 3600;
  const SIGNED_URL_REFRESH_MARGIN_MS = 60 * 1000; // renouvelée 1 min avant expiration

  // Cache { url, expiresAt } : une signed URL expirée ne doit jamais être
  // réutilisée (le cache précédent ne mémorisait pas d'expiration).
  const getSignedMediaUrl = async (mediaRow, { forceFresh = false } = {}) => {
    if (!mediaRow.original_private_path) return '';
    const cached = mediaState.signedUrlCache.get(mediaRow.id);
    if (!forceFresh && cached && cached.expiresAt > Date.now() + SIGNED_URL_REFRESH_MARGIN_MS) {
      return cached.url;
    }

    const supabase = getSupabase();
    const { data, error } = await supabase.storage
      .from('l5d2lm-private-originals')
      .createSignedUrl(mediaRow.original_private_path, SIGNED_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) return '';

    mediaState.signedUrlCache.set(mediaRow.id, {
      url: data.signedUrl,
      expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000
    });
    return data.signedUrl;
  };

  // Résout une URL affichable pour une photo Supabase, quelle que soit son
  // origine (catalogue historique migré, import de cette session, ou photo
  // jamais présente dans gestion-media-catalog.js) : le sélecteur "Changer"
  // et la médiathèque doivent pouvoir afficher TOUT média actif.
  const resolveMediaSrc = async (mediaRow) => {
    if (!mediaRow) return '';
    const localUpload = mediaState.localUploads.find((item) => item.filename === mediaRow.original_filename && item.src);
    if (localUpload) return localUpload.src;

    const catalogEntry = allSiteMedia().find((item) => item.filename === mediaRow.original_filename);
    if (catalogEntry?.src) return catalogEntry.src;

    if (mediaRow.public_path) return mediaRow.public_path;

    return getSignedMediaUrl(mediaRow);
  };

  // Une signed URL en cache peut être révoquée/expirée côté Storage avant
  // son terme théorique : si l'<img> échoue au chargement, on régénère une
  // seule fois avant d'abandonner.
  const attachMediaImage = (img, mediaRow) => {
    let retried = false;
    img.addEventListener('error', () => {
      if (!mediaRow) return;
      if (retried) {
        img.replaceWith(document.createTextNode('Aperçu indisponible'));
        return;
      }
      retried = true;
      mediaState.signedUrlCache.delete(mediaRow.id);
      getSignedMediaUrl(mediaRow, { forceFresh: true }).then((src) => {
        if (src) img.src = src;
        else img.dispatchEvent(new Event('error'));
      });
    });
    resolveMediaSrc(mediaRow).then((src) => {
      if (src) img.src = src;
      else img.dispatchEvent(new Event('error'));
    });
  };

  // Navigation par page : toujours visible, compteurs réels (non écrits en
  // dur), un seul clic pour changer de page — remplace le filtre Catégorie
  // caché dans "Filtres ▾".
  const refreshLibraryCounts = async () => {
    try {
      mediaState.libraryCounts = await fetchLibraryCounts();
    } catch (error) {
      setStatus(error.message || 'Impossible de calculer les compteurs par page.', 'error');
    }
  };

  const renderPageNav = () => {
    if (!pageNavEl) return;
    pageNavEl.innerHTML = '';

    const makeItem = (id, title, count) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'page-nav__item';
      button.classList.toggle('is-active', mediaState.activePage === id);
      button.innerHTML = '';
      button.append(title + ' ');
      const countEl = document.createElement('span');
      countEl.textContent = String(count);
      button.appendChild(countEl);
      button.addEventListener('click', () => {
        mediaState.activePage = id;
        switchPhotosView();
      });
      return button;
    };

    pageNavEl.appendChild(makeItem('all', 'Toutes les pages', mediaState.libraryCounts.total));
    sectionsState.items
      .filter((section) => !section.parent_id) // premier niveau seulement dans cette rangée
      .forEach((section) => {
        pageNavEl.appendChild(
          makeItem(section.id, section.title, mediaState.libraryCounts.bySection.get(section.id) || 0)
        );
      });
  };

  const switchPhotosView = async () => {
    renderPageNav();
    const isAll = mediaState.activePage === 'all';
    if (photosAllView) photosAllView.hidden = !isAll;
    if (photosSectionView) photosSectionView.hidden = isAll;
    document.querySelectorAll('.photos-toolbar-top .photos-search, .photos-toolbar-top [data-filters-details]').forEach((el) => {
      el.style.display = isAll ? '' : 'none';
    });

    if (isAll) {
      renderMediaGrid();
    } else {
      await loadSectionOrderView(mediaState.activePage);
    }
  };

  const loadSectionOrderView = async (sectionId) => {
    if (!sectionOrderList) return;
    const section = sectionsState.items.find((entry) => entry.id === sectionId);
    if (sectionViewTitle) sectionViewTitle.textContent = section ? section.title : '—';
    sectionOrderList.setAttribute('aria-busy', 'true');

    const supabase = getSupabase();
    try {
      const { data: assocRows, error: assocError } = await supabase
        .from('l5d2lm_media_sections')
        .select('media_id, sort_order')
        .eq('section_id', sectionId)
        .order('sort_order', { ascending: true });
      if (assocError) throw assocError;

      const mediaIds = (assocRows || []).map((row) => row.media_id);
      let mediaById = new Map();
      let usageAnnotationByMediaId = new Map();
      if (mediaIds.length) {
        const { data: mediaRows, error: mediaError } = await supabase
          .from('l5d2lm_media')
          .select('id, original_filename, original_private_path, public_path, default_annotation, rights_status, favorite, focal_x, focal_y')
          .in('id', mediaIds)
          .is('deleted_at', null);
        if (mediaError) throw mediaError;
        mediaById = new Map((mediaRows || []).map((row) => [row.id, row]));

        // Priorité d'annotation : un override propre à CETTE page
        // (l5d2lm_media_usages) l'emporte sur l'annotation générale de la
        // photo — la même photo peut dire autre chose sur deux pages.
        const { data: usageRows } = await supabase
          .from('l5d2lm_media_usages')
          .select('media_id, annotation_override')
          .eq('section_id', sectionId)
          .in('media_id', mediaIds)
          .is('deleted_at', null)
          .not('annotation_override', 'is', null);
        usageAnnotationByMediaId = new Map((usageRows || []).map((row) => [row.media_id, row.annotation_override]));
      }

      const items = [];
      for (const assoc of assocRows || []) {
        const media = mediaById.get(assoc.media_id);
        if (!media) continue; // à la corbeille entre-temps : ignorée, pas de trou numéroté
        items.push({
          mediaId: media.id,
          sectionId,
          sortOrder: assoc.sort_order,
          filename: media.original_filename,
          annotation: usageAnnotationByMediaId.get(media.id) || media.default_annotation,
          rightsStatus: media.rights_status,
          favorite: media.favorite,
          mediaRow: media
        });
      }

      mediaState.sectionOrderItems = items;
      if (sectionViewCount) sectionViewCount.textContent = `${items.length} photo${items.length > 1 ? 's' : ''}`;
      renderSectionOrderList();
    } catch (error) {
      setStatus(error.message || 'Impossible de charger les photos de cette page.', 'error');
    } finally {
      sectionOrderList.setAttribute('aria-busy', 'false');
    }
  };

  const renderSectionOrderList = () => {
    if (!sectionOrderList) return;
    sectionOrderList.innerHTML = '';

    mediaState.sectionOrderItems.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'section-order-item';
      li.draggable = true;
      li.dataset.mediaId = item.mediaId;

      li.addEventListener('dragstart', () => {
        mediaState.dragMediaId = item.mediaId;
        li.classList.add('is-dragging');
      });
      li.addEventListener('dragend', () => li.classList.remove('is-dragging'));
      li.addEventListener('dragover', (event) => {
        event.preventDefault();
        li.classList.add('is-drop-target');
      });
      li.addEventListener('dragleave', () => li.classList.remove('is-drop-target'));
      li.addEventListener('drop', (event) => {
        event.preventDefault();
        li.classList.remove('is-drop-target');
        if (mediaState.dragMediaId && mediaState.dragMediaId !== item.mediaId) {
          reorderSectionItems(mediaState.dragMediaId, index);
        }
        mediaState.dragMediaId = null;
      });

      const handle = document.createElement('span');
      handle.className = 'section-order-item__handle';
      handle.textContent = '⠿';
      handle.setAttribute('aria-hidden', 'true');
      li.appendChild(handle);

      const numberInput = document.createElement('input');
      numberInput.type = 'number';
      numberInput.min = '1';
      numberInput.max = String(mediaState.sectionOrderItems.length);
      numberInput.value = String(index + 1);
      numberInput.className = 'section-order-item__number';
      numberInput.setAttribute('aria-label', `Position de ${item.filename}`);
      numberInput.addEventListener('change', () => {
        const requested = parseInt(numberInput.value, 10);
        if (Number.isFinite(requested)) reorderSectionItems(item.mediaId, requested - 1);
      });
      li.appendChild(numberInput);

      const thumb = document.createElement('div');
      thumb.className = 'section-order-item__thumb';
      const img = document.createElement('img');
      img.alt = '';
      img.loading = 'lazy';
      if (item.mediaRow) {
        img.style.objectPosition = `${(item.mediaRow.focal_x ?? 0.5) * 100}% ${(item.mediaRow.focal_y ?? 0.5) * 100}%`;
      }
      attachMediaImage(img, item.mediaRow);
      thumb.appendChild(img);
      li.appendChild(thumb);

      // Priorité visuelle : numéro, photo, annotation, Changer, "…". Le nom
      // technique du fichier (souvent inexploitable, ex. IMG_8734.HEIC)
      // n'est pas l'information principale ; il vit dans "… > Informations".
      const body = document.createElement('div');
      body.className = 'section-order-item__body';
      const annotation = document.createElement('p');
      annotation.className = 'section-order-item__annotation';
      annotation.textContent = item.annotation || '(sans annotation)';
      body.appendChild(annotation);

      // Avertissement plutôt que troncature silencieuse : un texte trop
      // long ici risque de déborder une fois affiché sur une vraie carte
      // postale publique, à l'espace bien plus contraint.
      if ((item.annotation || '').length > ANNOTATION_WARNING_LENGTH) {
        const warning = document.createElement('p');
        warning.className = 'section-order-item__annotation--warning';
        warning.textContent = 'Texte long : à raccourcir avant publication sur une carte postale.';
        body.appendChild(warning);
      }
      li.appendChild(body);

      const actions = document.createElement('div');
      actions.className = 'section-order-item__actions';

      const changeButton = document.createElement('button');
      changeButton.type = 'button';
      changeButton.className = 'btn';
      changeButton.textContent = 'Changer';
      changeButton.addEventListener('click', () => {
        openMediaPicker('replace', { sectionId: item.sectionId, oldMediaId: item.mediaId, sortOrder: item.sortOrder });
      });
      actions.appendChild(changeButton);

      const moreMenu = document.createElement('details');
      moreMenu.className = 'bulk-menu';
      const moreSummary = document.createElement('summary');
      moreSummary.textContent = '…';
      moreMenu.appendChild(moreSummary);
      const morePanel = document.createElement('div');
      morePanel.className = 'bulk-menu__panel';

      const infoLine = document.createElement('p');
      infoLine.className = 'section-order-item__info';
      infoLine.textContent = item.filename;
      morePanel.appendChild(infoLine);

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'btn';
      removeButton.textContent = 'Retirer de cette page';
      removeButton.addEventListener('click', () => handleRemoveFromSection(item));
      morePanel.appendChild(removeButton);

      RIGHTS_STATUSES.forEach(({ value, label }) => {
        const rightsButton = document.createElement('button');
        rightsButton.type = 'button';
        rightsButton.className = 'btn';
        rightsButton.textContent = label;
        rightsButton.addEventListener('click', () => handleItemRightsChange(item, value));
        morePanel.appendChild(rightsButton);
      });

      const trashButton = document.createElement('button');
      trashButton.type = 'button';
      trashButton.className = 'btn';
      trashButton.textContent = 'Mettre à la corbeille';
      trashButton.addEventListener('click', () => handleItemTrash(item));
      morePanel.appendChild(trashButton);

      moreMenu.appendChild(morePanel);
      actions.appendChild(moreMenu);

      li.appendChild(actions);
      sectionOrderList.appendChild(li);
    });
  };

  // Un seul chemin de réordonnancement, utilisé par le glisser-déposer ET
  // la saisie directe du numéro — jamais deux logiques différentes.
  const reorderSectionItems = async (mediaId, newIndex) => {
    const items = mediaState.sectionOrderItems;
    const currentIndex = items.findIndex((entry) => entry.mediaId === mediaId);
    if (currentIndex === -1) return;
    const clamped = Math.max(0, Math.min(items.length - 1, newIndex));
    if (clamped === currentIndex) {
      renderSectionOrderList();
      return;
    }

    const [moved] = items.splice(currentIndex, 1);
    items.splice(clamped, 0, moved);
    items.forEach((entry, idx) => { entry.sortOrder = idx * 10; });
    renderSectionOrderList(); // affichage optimiste immédiat

    const sectionId = mediaState.activePage;
    const supabase = getSupabase();
    try {
      // Une seule transaction côté base (l5d2lm_reorder_section_media) :
      // si un élément échoue en cours de route, RIEN n'est enregistré et
      // l'ordre précédent reste intact (pas d'ordre partiellement modifié).
      const { error } = await supabase.rpc('l5d2lm_reorder_section_media', {
        p_section_id: sectionId,
        p_media_ids: items.map((entry) => entry.mediaId)
      });
      if (error) throw error;
      setStatus('Ordre mis à jour.', 'success');
    } catch (error) {
      setStatus(error.message || 'Impossible d’enregistrer le nouvel ordre.', 'error');
      await loadSectionOrderView(sectionId); // resynchronise sur l'ordre réellement en base
    }
  };

  const handleRemoveFromSection = async (item) => {
    const confirmed = window.confirm(`Retirer cette photo de "${sectionsState.items.find((s) => s.id === item.sectionId)?.title || 'cette page'}" ? Le fichier reste dans la médiathèque.`);
    if (!confirmed) return;
    const supabase = getSupabase();
    const { error } = await supabase
      .from('l5d2lm_media_sections')
      .delete()
      .eq('media_id', item.mediaId)
      .eq('section_id', item.sectionId);
    if (error) {
      setStatus(error.message || 'Impossible de retirer cette photo.', 'error');
      return;
    }
    await loadSectionOrderView(item.sectionId);
    await refreshLibraryCounts();
    renderPageNav();
    setStatus('Photo retirée de la page.', 'success');
  };

  const handleItemRightsChange = async (item, status) => {
    const supabase = getSupabase();
    const { error } = await supabase.from('l5d2lm_media').update({ rights_status: status }).eq('id', item.mediaId);
    if (error) {
      setStatus(error.message || 'Impossible de mettre à jour les droits.', 'error');
      return;
    }
    item.rightsStatus = status;
    const known = Array.from(mediaState.importedByFilename.values()).find((entry) => entry.id === item.mediaId);
    if (known) known.rights_status = status;
    setStatus('Droits mis à jour.', 'success');
  };

  const handleItemTrash = async (item) => {
    const confirmed = window.confirm('Mettre cette photo à la corbeille ?');
    if (!confirmed) return;
    const supabase = getSupabase();
    const { error } = await supabase
      .from('l5d2lm_media')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', item.mediaId);
    if (error) {
      setStatus(error.message || 'Impossible de mettre cette photo à la corbeille.', 'error');
      return;
    }
    mediaState.library.delete(item.mediaId);
    mediaState.importedByFilename.delete(item.filename);
    await loadSectionOrderView(item.sectionId);
    await refreshLibraryCounts();
    renderPageNav();
    setStatus('Photo mise à la corbeille.', 'success');
  };

  // Sélecteur de photo : "Changer" (remplace une position, même ordre) et
  // "+ Ajouter une photo" (ajoute en dernière position). Ne détruit jamais
  // l'ancienne photo : seule l'association à cette page change.
  const openMediaPicker = (mode, context) => {
    if (!mediaPicker) return;
    mediaState.pickerMode = mode;
    mediaState.pickerContext = context;
    mediaState.pickerSearch = '';
    if (mediaPickerSearch) mediaPickerSearch.value = '';
    if (mediaPickerTitle) {
      const titles = {
        replace: 'Choisir une photo de remplacement',
        add: 'Ajouter une photo à cette page',
        slot: 'Choisir une photo pour cet emplacement'
      };
      mediaPickerTitle.textContent = titles[mode] || 'Choisir une photo';
    }
    mediaPicker.hidden = false;
    renderMediaPickerGrid();
  };

  const closeMediaPicker = () => {
    if (!mediaPicker) return;
    mediaPicker.hidden = true;
    mediaState.pickerMode = null;
    mediaState.pickerContext = null;
  };

  const renderMediaPickerGrid = () => {
    if (!mediaPickerGrid) return;
    mediaPickerGrid.innerHTML = '';

    const query = mediaState.pickerSearch.toLowerCase();
    // (media_id, section_id) est une clé composite unique en base : une photo
    // déjà présente sur cette page ne peut pas y occuper une deuxième position.
    // Ne s'applique qu'aux modes "Changer"/"+ Ajouter" (vue par page) : un
    // emplacement fixe (mode "slot") n'a pas cette contrainte.
    const alreadyOnPage = mediaState.pickerMode === 'slot'
      ? new Set()
      : new Set(mediaState.sectionOrderItems.map((entry) => entry.mediaId));
    const entries = Array.from(mediaState.importedByFilename.entries()).filter(([filename, info]) => {
      if (alreadyOnPage.has(info?.id)) return false; // déjà utilisée sur cette page (couvre aussi "elle-même" en mode Changer)
      return !query || filename.toLowerCase().includes(query);
    });

    entries.forEach(([filename, info]) => {
      const card = document.createElement('article');
      card.className = 'media-item';
      card.addEventListener('click', () => choosePickerMedia(info.id));

      const thumb = document.createElement('div');
      thumb.className = 'media-item__thumb';
      const img = document.createElement('img');
      img.alt = '';
      img.loading = 'lazy';
      img.style.objectPosition = `${(info.focal_x ?? 0.5) * 100}% ${(info.focal_y ?? 0.5) * 100}%`;
      attachMediaImage(img, info);
      thumb.appendChild(img);
      card.appendChild(thumb);

      const meta = document.createElement('div');
      meta.className = 'media-item__meta';
      const name = document.createElement('strong');
      name.textContent = filename;
      meta.appendChild(name);
      if (info.default_annotation) {
        const title = document.createElement('p');
        title.className = 'media-item__title';
        title.textContent = info.default_annotation;
        meta.appendChild(title);
      }
      card.appendChild(meta);

      mediaPickerGrid.appendChild(card);
    });

    if (!entries.length) {
      const empty = document.createElement('p');
      empty.textContent = 'Aucune photo importée ne correspond.';
      mediaPickerGrid.appendChild(empty);
    }
  };

  const choosePickerMedia = async (mediaId) => {
    const context = mediaState.pickerContext;
    const mode = mediaState.pickerMode;
    if (!context) return;

    const supabase = getSupabase();
    try {
      if (mode === 'slot') {
        await publishMediaForSlot(mediaId, context.slotKey);
        closeMediaPicker();
        return;
      }
      if (mode === 'replace') {
        // Transaction unique côté base (l5d2lm_replace_section_media) : si
        // l'insertion de la nouvelle association échoue, l'ancienne n'est
        // jamais supprimée — la position ne peut pas se perdre en route.
        const { error: rpcError } = await supabase.rpc('l5d2lm_replace_section_media', {
          p_section_id: context.sectionId,
          p_old_media_id: context.oldMediaId,
          p_new_media_id: mediaId
        });
        if (rpcError) throw rpcError;
        setStatus('Photo remplacée — même position, ancienne photo conservée dans la médiathèque.', 'success');
      } else {
        const maxOrder = mediaState.sectionOrderItems.reduce((max, entry) => Math.max(max, entry.sortOrder), -10);
        const { error: insertError } = await supabase
          .from('l5d2lm_media_sections')
          .insert({ media_id: mediaId, section_id: context.sectionId, sort_order: maxOrder + 10 });
        if (insertError) throw insertError;
        setStatus('Photo ajoutée à la page.', 'success');
      }

      closeMediaPicker();
      await loadSectionOrderView(context.sectionId);
      await refreshLibraryCounts();
      renderPageNav();
    } catch (error) {
      setStatus(error.message || 'Impossible de choisir cette photo.', 'error');
    }
  };

  // Importer directement une photo qui n'a jamais été mise dans la
  // médiathèque, depuis le sélecteur lui-même (Changer / + Ajouter /
  // Emplacements) — sans devoir aller d'abord dans Photos pour l'importer.
  const importFileForPicker = async (file) => {
    const supabase = getSupabase();
    const hash = await sha256Hex(file);

    // Contenu identique déjà présent : réutilise la fiche existante plutôt
    // que de dupliquer l'import (même règle que l'import depuis Photos).
    const { data: existingRow } = await supabase
      .from('l5d2lm_media')
      .select('id, original_filename, original_private_path, public_path, default_annotation, alt_text, rights_status, favorite, publish_status, processing_status, upload_batch_id, collection_id, focal_x, focal_y, created_at')
      .eq('original_sha256', hash)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();

    if (existingRow) {
      mediaState.library.set(existingRow.id, existingRow);
      mediaState.importedByFilename.set(existingRow.original_filename, existingRow);
      return existingRow.id;
    }

    const storagePath = `${crypto.randomUUID()}/${sanitizeStorageSegment(file.name)}`;
    const contentType = file.type || 'application/octet-stream';
    const { error: uploadError } = await supabase.storage
      .from('l5d2lm-private-originals')
      .upload(storagePath, file, { contentType, upsert: false });
    if (uploadError) throw uploadError;

    const { data: insertedRow, error: insertError } = await supabase
      .from('l5d2lm_media')
      .insert({
        original_filename: file.name,
        original_mime_type: contentType,
        original_byte_size: file.size,
        original_sha256: hash,
        original_private_path: storagePath
      })
      .select('id, original_filename, original_private_path, public_path, default_annotation, alt_text, rights_status, favorite, publish_status, processing_status, upload_batch_id, collection_id, focal_x, focal_y, created_at')
      .single();
    if (insertError) throw insertError;

    mediaState.library.set(insertedRow.id, insertedRow);
    mediaState.importedByFilename.set(insertedRow.original_filename, insertedRow);
    return insertedRow.id;
  };

  if (mediaPickerUploadInput) {
    mediaPickerUploadInput.addEventListener('change', async () => {
      const file = mediaPickerUploadInput.files?.[0];
      mediaPickerUploadInput.value = '';
      if (!file) return;
      setStatus(`Import de ${file.name} en cours...`);
      try {
        const mediaId = await importFileForPicker(file);
        setStatus(`${file.name} importée, droits à vérifier.`, 'success');
        await choosePickerMedia(mediaId);
      } catch (error) {
        setStatus(error.message || `Impossible d’importer ${file.name}.`, 'error');
      }
    });
  }

  if (mediaPickerCloseButton) mediaPickerCloseButton.addEventListener('click', closeMediaPicker);
  if (mediaPickerSearch) {
    mediaPickerSearch.addEventListener('input', () => {
      mediaState.pickerSearch = mediaPickerSearch.value.trim();
      renderMediaPickerGrid();
    });
  }
  if (sectionAddPhotoButton) {
    sectionAddPhotoButton.addEventListener('click', () => {
      if (mediaState.activePage === 'all') return;
      openMediaPicker('add', { sectionId: mediaState.activePage });
    });
  }

  // Emplacements photo fixes (Site > Emplacements) : choisir une photo ici
  // la publie (bucket public + l5d2lm_media_usages.slot_key) — le site
  // public se met à jour tout seul au prochain passage du workflow GitHub
  // Actions programmé, sans intervention manuelle dans le code.
  const fetchSlotAssignments = async () => {
    const supabase = getSupabase();
    const slotKeys = SLOT_DEFINITIONS.map((slot) => slot.slotKey);
    const { data, error } = await supabase
      .from('l5d2lm_media_usages')
      .select('slot_key, media_id')
      .in('slot_key', slotKeys)
      .eq('active', true)
      .is('deleted_at', null);
    if (error) throw error;

    mediaState.slotAssignments = new Map();
    (data || []).forEach((row) => {
      const media = Array.from(mediaState.library.values()).find((entry) => entry.id === row.media_id);
      if (media) mediaState.slotAssignments.set(row.slot_key, media);
    });
  };

  const renderSlotsList = () => {
    if (!mediaSlotsListEl) return;
    mediaSlotsListEl.innerHTML = '';

    SLOT_DEFINITIONS.forEach((slot) => {
      const media = mediaState.slotAssignments.get(slot.slotKey);
      // Une photo déjà en place avant ce mécanisme (import initial du site)
      // et jamais republiée depuis l'admin : le site public l'affiche déjà
      // (voir build/slots.py, fallback), mais elle n'est pas encore "gérée"
      // ici — à ne pas confondre avec un emplacement réellement vide.
      const fallbackEntry = !media && slot.fallbackFilename
        ? allSiteMedia().find((item) => item.filename === slot.fallbackFilename)
        : null;

      const row = document.createElement('div');
      row.className = 'media-slot-item';

      const thumb = document.createElement('div');
      thumb.className = 'media-slot-item__thumb';
      if (media) {
        const img = document.createElement('img');
        img.alt = '';
        img.loading = 'lazy';
        img.style.objectPosition = `${(media.focal_x ?? 0.5) * 100}% ${(media.focal_y ?? 0.5) * 100}%`;
        attachMediaImage(img, media);
        thumb.appendChild(img);
      } else if (fallbackEntry) {
        const img = document.createElement('img');
        img.src = fallbackEntry.src;
        img.alt = '';
        img.loading = 'lazy';
        thumb.appendChild(img);
      } else {
        thumb.classList.add('media-slot-item__thumb--empty');
        thumb.textContent = 'Photo à venir';
      }
      row.appendChild(thumb);

      const body = document.createElement('div');
      body.className = 'media-slot-item__body';
      const title = document.createElement('strong');
      title.textContent = slot.label;
      body.appendChild(title);
      const status = document.createElement('span');
      status.className = media || fallbackEntry ? 'media-slot-item__status' : 'media-slot-item__status--empty';
      if (media) {
        status.textContent = `${slot.pageLabel} · photo publiée`;
      } else if (fallbackEntry) {
        status.textContent = `${slot.pageLabel} · photo déjà en ligne, pas encore gérée ici`;
      } else {
        status.textContent = `${slot.pageLabel} · aucune photo publiée`;
      }
      body.appendChild(status);
      row.appendChild(body);

      const chooseButton = document.createElement('button');
      chooseButton.type = 'button';
      chooseButton.className = 'btn';
      chooseButton.textContent = media ? 'Changer la photo' : 'Choisir une photo';
      chooseButton.addEventListener('click', () => openMediaPicker('slot', { slotKey: slot.slotKey }));
      row.appendChild(chooseButton);

      mediaSlotsListEl.appendChild(row);
    });
  };

  const loadSlotsPanel = async () => {
    if (!mediaSlotsListEl) return;
    try {
      await fetchSlotAssignments();
    } catch (error) {
      // La liste des emplacements reste utile même si l'état publié n'a pas
      // pu être récupéré (ex. migration slot_key pas encore appliquée) :
      // on l'affiche quand même, chaque emplacement retombant sur son
      // statut "photo déjà en ligne" / "Photo à venir" par défaut, plutôt
      // que de laisser le panneau complètement vide sans explication.
      mediaState.slotAssignments = new Map();
      setStatus(`Impossible de vérifier les photos déjà publiées (${error.message || 'erreur inconnue'}) — la migration slot_key a-t-elle été appliquée dans Supabase ?`, 'error');
    }
    renderSlotsList();
  };

  // Rend un média public (bucket l5d2lm-public-media) s'il ne l'est pas déjà,
  // puis l'assigne à l'emplacement — remplace toute photo précédemment
  // assignée à ce même emplacement (un emplacement = une photo à la fois).
  const publishMediaForSlot = async (mediaId, slotKey) => {
    const media = mediaState.library.get(mediaId);
    if (!media) throw new Error('Photo introuvable dans la médiathèque.');

    if (media.rights_status === 'do_not_publish') {
      throw new Error('Cette photo est marquée "Ne pas publier" : changez ses droits avant de la publier sur le site.');
    }
    if (media.rights_status === 'needs_review') {
      const confirmed = window.confirm('Les droits de cette photo sont encore "À vérifier". La publier quand même ?');
      if (!confirmed) return;
    }

    const supabase = getSupabase();
    let publicPath = media.public_path;

    if (!publicPath) {
      const src = await resolveMediaSrc(media);
      if (!src) throw new Error('Impossible de récupérer le fichier de cette photo.');
      const response = await fetch(src);
      if (!response.ok) throw new Error('Impossible de récupérer le fichier de cette photo.');
      const blob = await response.blob();

      publicPath = `${media.id}/${sanitizeStorageSegment(media.original_filename)}`;
      const { error: uploadError } = await supabase.storage
        .from('l5d2lm-public-media')
        .upload(publicPath, blob, { contentType: blob.type || 'application/octet-stream', upsert: true });
      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('l5d2lm_media')
        .update({ public_path: publicPath, processing_status: 'ready', publish_status: 'published' })
        .eq('id', media.id);
      if (updateError) throw updateError;

      media.public_path = publicPath;
      media.processing_status = 'ready';
      media.publish_status = 'published';
    } else if (media.publish_status !== 'published' || media.processing_status !== 'ready') {
      const { error: updateError } = await supabase
        .from('l5d2lm_media')
        .update({ processing_status: 'ready', publish_status: 'published' })
        .eq('id', media.id);
      if (updateError) throw updateError;
      media.processing_status = 'ready';
      media.publish_status = 'published';
    }

    // Un emplacement = une association active à la fois : on retire
    // l'ancienne avant d'insérer la nouvelle plutôt qu'un upsert, l'index
    // unique porte sur slot_key seul (pas sur media_id, slot_key).
    const { error: deleteError } = await supabase
      .from('l5d2lm_media_usages')
      .delete()
      .eq('slot_key', slotKey);
    if (deleteError) throw deleteError;

    const { error: insertError } = await supabase
      .from('l5d2lm_media_usages')
      .insert({ media_id: mediaId, slot_key: slotKey, role: 'fixed', active: true });
    if (insertError) throw insertError;

    mediaState.slotAssignments.set(slotKey, media);
    renderSlotsList();
    setStatus('Photo publiée pour cet emplacement — le site public se mettra à jour automatiquement.', 'success');
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

  // Édition individuelle d'une photo déjà importée : titre (annotation) et
  // catégories propres à cette photo, disponible à tout moment (pas
  // seulement juste après l'import).
  const toggleMediaEditPanel = (card, info) => {
    const existing = card.querySelector('.media-item__edit');
    if (existing) {
      existing.remove();
      return;
    }

    const panel = document.createElement('div');
    panel.className = 'media-item__edit';

    const titleLabel = document.createElement('label');
    titleLabel.textContent = 'Titre';
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.value = info.default_annotation || '';
    titleInput.placeholder = 'Ex. Et si le terrain de jeu, c’était toi ?';
    titleLabel.appendChild(titleInput);
    panel.appendChild(titleLabel);

    const checksWrap = document.createElement('div');
    checksWrap.className = 'media-category-checks';
    const assigned = mediaState.mediaSections.get(info.id) || new Map();
    if (!sectionsState.items.length) {
      checksWrap.textContent = 'Aucune catégorie créée pour l’instant.';
    } else {
      sectionsState.items.forEach((section) => {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = section.id;
        input.checked = assigned.has(section.id);
        label.appendChild(input);
        label.appendChild(document.createTextNode(section.title));
        checksWrap.appendChild(label);
      });
    }
    panel.appendChild(checksWrap);

    const actions = document.createElement('div');
    actions.className = 'gestion-actions-line';

    const saveButton = document.createElement('button');
    saveButton.type = 'button';
    saveButton.className = 'btn btn-primary';
    saveButton.textContent = 'Enregistrer';
    saveButton.addEventListener('click', () => {
      const checkedSectionIds = Array.from(checksWrap.querySelectorAll('input:checked')).map((el) => el.value);
      saveMediaEdit(info, titleInput.value.trim(), checkedSectionIds);
    });

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'btn';
    cancelButton.textContent = 'Annuler';
    cancelButton.addEventListener('click', () => panel.remove());

    actions.appendChild(saveButton);
    actions.appendChild(cancelButton);
    panel.appendChild(actions);

    card.appendChild(panel);
    titleInput.focus();
  };

  const saveMediaEdit = async (info, title, checkedSectionIds) => {
    const supabase = getSupabase();
    try {
      const { error: titleError } = await supabase
        .from('l5d2lm_media')
        .update({ default_annotation: title || null })
        .eq('id', info.id);
      if (titleError) throw titleError;
      info.default_annotation = title || null;

      const assigned = mediaState.mediaSections.get(info.id) || new Map();
      const currentIds = new Set(assigned.keys());
      const nextIds = new Set(checkedSectionIds);
      const toAdd = checkedSectionIds.filter((id) => !currentIds.has(id));
      const toRemove = Array.from(currentIds).filter((id) => !nextIds.has(id));

      if (toAdd.length) {
        const countInSection = (sectionId) => {
          let count = 0;
          mediaState.mediaSections.forEach((sections) => { if (sections.has(sectionId)) count += 1; });
          return count;
        };
        const rows = toAdd.map((sectionId) => ({
          media_id: info.id,
          section_id: sectionId,
          sort_order: countInSection(sectionId) * 10
        }));
        const { error } = await supabase
          .from('l5d2lm_media_sections')
          .upsert(rows, { onConflict: 'media_id,section_id', ignoreDuplicates: true });
        if (error) throw error;
      }

      if (toRemove.length) {
        const { error } = await supabase
          .from('l5d2lm_media_sections')
          .delete()
          .eq('media_id', info.id)
          .in('section_id', toRemove);
        if (error) throw error;
      }

      await fetchMediaSections(Array.from(mediaState.importedByFilename.values()).map((entry) => entry.id));
      renderMediaGrid();
      setStatus('Photo mise à jour.', 'success');
    } catch (error) {
      setStatus(error.message || 'Impossible d’enregistrer les modifications.', 'error');
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
    await refreshLibraryCounts();
    renderPageNav();
    setStatus(`Catégories ${mode === 'add' ? 'ajoutées' : 'retirées'} pour ${infos.length} photo(s).`, 'success');
  };

  // Suppression douce (deleted_at) : récupérable depuis Plus > Corbeille
  // une fois cet écran construit. Pas de suppression définitive ici.
  const handleBulkTrash = async () => {
    const infos = selectedImportedInfos();
    if (!infos.length) {
      setStatus('Sélectionnez au moins une photo déjà importée.', 'error');
      return;
    }
    const confirmed = window.confirm(`Mettre ${infos.length} photo(s) à la corbeille ?`);
    if (!confirmed) return;

    const supabase = getSupabase();
    const { error } = await supabase
      .from('l5d2lm_media')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', infos.map((info) => info.id));
    if (error) {
      setStatus(error.message || 'Impossible de mettre ces photos à la corbeille.', 'error');
      return;
    }

    infos.forEach((info) => {
      mediaState.library.delete(info.id);
      mediaState.importedByFilename.delete(info.original_filename);
      mediaState.selected.delete(info.id);
    });
    renderMediaGrid();
    await refreshLibraryCounts();
    renderPageNav();
    setStatus(`${infos.length} photo(s) mise(s) à la corbeille.`, 'success');
  };

  const loadMediaPanel = async () => {
    if (!mediaGrid) return;
    try {
      await loadMediaLibrary();
    } catch (error) {
      setStatus(error.message || 'Impossible de charger la médiathèque.', 'error');
    }
    mediaState.loaded = true;
    populateFilterSelects();
    syncFilterSelects();
    renderActiveFilterChips();
    await refreshLibraryCounts();
    await switchPhotosView();
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
      mediaState.lastBatchId = batch.id;

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
            .select('id, original_filename, original_private_path, public_path, default_annotation, alt_text, rights_status, favorite, publish_status, processing_status, upload_batch_id, collection_id, focal_x, focal_y, created_at')
            .single();

          if (insertError) {
            if (insertError.code === '23505') {
              duplicates += 1;
              const { data: existingRow } = await supabase
                .from('l5d2lm_media')
                .select('id, original_filename, original_private_path, public_path, default_annotation, alt_text, rights_status, favorite, publish_status, processing_status, upload_batch_id, collection_id, focal_x, focal_y, created_at')
                .eq('original_sha256', hash)
                .is('deleted_at', null)
                .limit(1)
                .maybeSingle();
              if (existingRow) {
                mediaState.library.set(existingRow.id, existingRow);
                mediaState.importedByFilename.set(item.filename, existingRow);
              }
              mediaState.importedFilenames.add(item.filename);
              mediaState.selected.delete(item.id);
              // La photo est désormais représentée par sa fiche Supabase
              // (mediaState.library) : l'entrée "en attente d'import" ne
              // doit plus produire une seconde carte pour le même fichier.
              if (item.kind === 'upload') {
                mediaState.localUploads = mediaState.localUploads.filter((entry) => entry.id !== item.id);
              }
              continue;
            }
            throw insertError;
          }

          mediaState.library.set(insertedRow.id, insertedRow);
          mediaState.importedByFilename.set(item.filename, insertedRow);
          mediaState.importedFilenames.add(item.filename);
          mediaState.selected.delete(item.id);
          if (item.kind === 'upload') {
            mediaState.localUploads = mediaState.localUploads.filter((entry) => entry.id !== item.id);
          }

          // Une photo migrée depuis le catalogue historique apparaît déjà
          // réellement sur une page du site public : on la classe tout de
          // suite dans cette page, pas besoin de la reclasser à la main.
          if (item.kind === 'catalog' && item.sectionSlug) {
            const sectionId = findSectionIdBySlug(item.sectionSlug);
            if (sectionId) {
              const { error: assocError } = await supabase
                .from('l5d2lm_media_sections')
                .insert({ media_id: insertedRow.id, section_id: sectionId, sort_order: countMediaInSection(sectionId) * 10 });
              if (!assocError) {
                if (!mediaState.mediaSections.has(insertedRow.id)) mediaState.mediaSections.set(insertedRow.id, new Map());
                mediaState.mediaSections.get(insertedRow.id).set(sectionId, countMediaInSection(sectionId) * 10);
              }
            }
          }
          imported += 1;
        } catch (itemError) {
          const reason = itemError?.message || itemError?.error_description || String(itemError);
          failedItems.push({ filename: item.filename, reason });
          console.error(`Import échoué pour ${item.filename} :`, itemError);
        }
      }

      renderMediaGrid();
      await refreshLibraryCounts();
      renderPageNav();
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

  // Rattrapage pour les photos migrées AVANT que l'import n'associe
  // automatiquement une page depuis le catalogue historique (voir plus
  // haut dans handleImportSelection) : classe chaque photo déjà en
  // médiathèque, dont le nom correspond à une photo du catalogue, sur la
  // page où elle apparaît réellement — sans toucher aux photos déjà
  // classées ailleurs (jamais de reclassement forcé).
  const handleBackfillCatalogSections = async () => {
    const supabase = getSupabase();
    let classified = 0;
    let skippedAlreadyClassified = 0;
    let skippedNoSection = 0;

    for (const row of mediaState.library.values()) {
      const catalogEntry = allSiteMedia().find((item) => item.filename === row.original_filename);
      if (!catalogEntry?.sectionSlug) continue;

      const sectionId = findSectionIdBySlug(catalogEntry.sectionSlug);
      if (!sectionId) { skippedNoSection += 1; continue; }

      const alreadyAssigned = mediaState.mediaSections.get(row.id)?.has(sectionId);
      if (alreadyAssigned) { skippedAlreadyClassified += 1; continue; }

      const { error } = await supabase
        .from('l5d2lm_media_sections')
        .insert({ media_id: row.id, section_id: sectionId, sort_order: countMediaInSection(sectionId) * 10 });
      if (error) continue; // ex. déjà présente (course avec un autre onglet) : sans gravité, on continue

      if (!mediaState.mediaSections.has(row.id)) mediaState.mediaSections.set(row.id, new Map());
      mediaState.mediaSections.get(row.id).set(sectionId, countMediaInSection(sectionId) * 10);
      classified += 1;
    }

    renderMediaGrid();
    await refreshLibraryCounts();
    renderPageNav();

    const parts = [];
    if (classified) parts.push(`${classified} photo(s) classée(s) sur leur page d’origine`);
    if (skippedAlreadyClassified) parts.push(`${skippedAlreadyClassified} déjà classée(s)`);
    if (skippedNoSection) parts.push(`${skippedNoSection} page(s) du catalogue introuvable(s) — utilisez « Créer les 6 catégories du site » dans Site > Structure`);
    setStatus(parts.join(' — ') || 'Aucune photo du catalogue à classer.', 'success');
  };

  const backfillCatalogSectionsButton = document.querySelector('[data-backfill-catalog-sections]');
  if (backfillCatalogSectionsButton) backfillCatalogSectionsButton.addEventListener('click', handleBackfillCatalogSections);

  if (mediaSelectVisibleButton) mediaSelectVisibleButton.addEventListener('click', handleSelectVisible);
  if (mediaClearSelectionButton) mediaClearSelectionButton.addEventListener('click', handleClearSelection);
  if (mediaImportButton) mediaImportButton.addEventListener('click', handleImportSelection);
  if (mediaUploadInput) {
    mediaUploadInput.addEventListener('change', () => {
      handleFilesSelected(mediaUploadInput.files);
      mediaUploadInput.value = '';
    });
  }
  // Un menu "Classer"/"Droits"/"Plus" qui reste ouvert après un choix
  // recouvre la grille en dessous (position absolute) : on le referme
  // systématiquement une fois l'action lancée.
  const closeBulkMenu = (button) => {
    const details = button.closest('.bulk-menu');
    if (details) details.open = false;
  };

  if (rightsButtonsContainer) {
    RIGHTS_STATUSES.forEach(({ value, label }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn';
      button.textContent = label;
      button.addEventListener('click', () => {
        closeBulkMenu(button);
        handleBulkRightsChange(value);
      });
      rightsButtonsContainer.appendChild(button);
    });
  }
  document.querySelectorAll('[data-bulk-favorite]').forEach((button) => {
    // Un seul bouton bascule : si tout ce qui est sélectionné est déjà
    // favori, on retire ; sinon on marque tout favori.
    button.addEventListener('click', () => {
      const infos = selectedImportedInfos();
      const allFavorite = infos.length > 0 && infos.every((info) => info.favorite);
      handleBulkFavorite(!allFavorite);
    });
  });
  document.querySelectorAll('[data-bulk-category-apply]').forEach((button) => {
    button.addEventListener('click', () => {
      closeBulkMenu(button);
      handleBulkCategoryApply(button.dataset.bulkCategoryApply);
    });
  });
  if (bulkTrashButton) {
    bulkTrashButton.addEventListener('click', () => {
      closeBulkMenu(bulkTrashButton);
      handleBulkTrash();
    });
  }

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
      counts = (await fetchLibraryCounts()).bySection;
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
    populateFilterSelects();
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

  const accountSecurityButton = document.querySelector('[data-account-security]');
  const accountMenuDetails = document.querySelector('.account-menu');
  if (accountSecurityButton) {
    accountSecurityButton.addEventListener('click', () => {
      activateTab('plus');
      const securiteSubtab = document.querySelector('[data-panel="plus"] [data-subtab="securite"]');
      if (securiteSubtab) securiteSubtab.click();
      if (accountMenuDetails) accountMenuDetails.open = false;
    });
  }
  if (signOutButtons.length && accountMenuDetails) {
    signOutButtons.forEach((button) => button.addEventListener('click', () => { accountMenuDetails.open = false; }));
  }

  init();
})();
