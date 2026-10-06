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
  // Plus > Corbeille/Historique/Sécurité) : chaque .gestion-subnav ne pilote
  // que les .subpanel de son propre article[data-panel].
  document.querySelectorAll('.gestion-subnav').forEach((nav) => {
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

  let statusHideTimer = null;
  const setStatus = (message = '', type = '') => {
    status.textContent = message;
    status.classList.toggle('is-error', type === 'error');
    status.classList.toggle('is-success', type === 'success');
    if (statusHideTimer) clearTimeout(statusHideTimer);
    // Les erreurs restent affichées le temps que l'admin agisse (bouton
    // "Retirer"/nouvelle action) ; les messages de succès ou neutres
    // disparaissent tout seuls pour ne pas rester en permanence à l'écran.
    if (message && type !== 'error') {
      statusHideTimer = setTimeout(() => {
        status.textContent = '';
        status.classList.remove('is-error', 'is-success');
      }, 5000);
    }
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
    await loadPostcardsPanel();
    await loadTextsPanel();
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

  // Édition plein écran d'une photo (Titre/Annotation/Catégories), avec
  // navigation Précédente/Suivante.
  const mediaEditOverlay = document.querySelector('[data-media-edit-overlay]');
  const mediaEditPhoto = document.querySelector('[data-media-edit-photo]');
  const mediaEditTitleInput = document.querySelector('[data-media-edit-title]');
  const mediaEditAnnotationInput = document.querySelector('[data-media-edit-annotation]');
  const mediaEditCategories = document.querySelector('[data-media-edit-categories]');
  const mediaEditPosition = document.querySelector('[data-media-edit-position]');
  const mediaEditPrevButton = document.querySelector('[data-media-edit-prev]');
  const mediaEditNextButton = document.querySelector('[data-media-edit-next]');
  const mediaEditCloseButton = document.querySelector('[data-media-edit-close]');
  const mediaEditCancelButton = document.querySelector('[data-media-edit-cancel]');
  const mediaEditSaveButton = document.querySelector('[data-media-edit-save]');

  // Emplacements photo fixes du site public (Site > Emplacements). Doit
  // rester synchronisé avec build/slots.py — un slot_key ajouté ici sans
  // marqueur MEDIA_SLOT correspondant dans un fragment content/*.html
  // n'aurait aucun effet visible sur le site publié.
  // Les ancrages "Photo — ..." / "Photo flottante — ..." sont optionnels :
  // aucune photo par défaut, aucun effet sur le site tant que rien n'est
  // choisi ici (voir build/slots.py, kind "float"/"band" pour le détail du
  // rendu et la garantie « jamais de chevauchement avec le texte »).
  const SLOT_DEFINITIONS = [
    { slotKey: 'corps-expression:playful-extatique', pageLabel: 'Corps & expression', label: 'Playful extatique', fallbackFilename: 'l5d2lm-photo-corps-expression-2.jpg' },
    { slotKey: 'corps-expression:theatre-improvisation', pageLabel: 'Corps & expression', label: 'Théâtre d’improvisation' },
    { slotKey: 'corps-expression:reveil-du-corps', pageLabel: 'Corps & expression', label: 'Réveil du corps' },
    { slotKey: 'corps-expression:jeux-de-mouvement', pageLabel: 'Corps & expression', label: 'Jeux de mouvement', fallbackFilename: 'l5d2lm-photo-corps-expression-jeux.jpg' },
    { slotKey: 'corps-expression:a-portee-de-main', pageLabel: 'Corps & expression', label: 'À portée de main', fallbackFilename: 'l5d2lm-photo-corps-expression-4.jpg' },
    { slotKey: 'corps-expression:anchor-band-hero', pageLabel: 'Corps & expression', label: 'Photo — entre le hero et les propositions' },
    { slotKey: 'corps-expression:anchor-band-cadre', pageLabel: 'Corps & expression', label: 'Photo — avant « Un cadre commun »' },
    { slotKey: 'corps-expression:anchor-float-cadre', pageLabel: 'Corps & expression', label: 'Photo flottante — « Un cadre commun »' },
    { slotKey: 'corps-expression:anchor-band-footer', pageLabel: 'Corps & expression', label: 'Photo — avant le bas de page' },

    { slotKey: 'accueil:postcard-1', pageLabel: 'Accueil', label: 'Carte postale 1', fallbackFilename: 'l5d2lm-photo-index.jpg' },
    { slotKey: 'accueil:postcard-2', pageLabel: 'Accueil', label: 'Carte postale 2', fallbackFilename: 'l5d2lm-photo-index-2.jpg' },
    { slotKey: 'accueil:anchor-band-hero', pageLabel: 'Accueil', label: 'Photo — entre l’accueil et Propositions' },
    { slotKey: 'accueil:anchor-float-formats', pageLabel: 'Accueil', label: 'Photo flottante — « Des formats qui se construisent ensemble »' },
    { slotKey: 'accueil:anchor-band-footer', pageLabel: 'Accueil', label: 'Photo — avant le bas de page' },

    { slotKey: 'massage:postcard-1', pageLabel: 'Massage', label: 'Carte postale 1', fallbackFilename: 'l5d2lm-photo-massage-intuitif.jpg' },
    { slotKey: 'massage:postcard-2', pageLabel: 'Massage', label: 'Carte postale 2', fallbackFilename: 'l5d2lm-photo-massage-2.jpg' },
    { slotKey: 'massage:postcard-3', pageLabel: 'Massage', label: 'Carte postale 3', fallbackFilename: 'l5d2lm-photo-massage-3.jpg' },
    { slotKey: 'massage:postcard-4', pageLabel: 'Massage', label: 'Carte postale 4', fallbackFilename: 'l5d2lm-photo-massage-4.jpg' },
    { slotKey: 'massage:anchor-float-chenda', pageLabel: 'Massage', label: 'Photo flottante — « Espace Chèndâ »' },
    { slotKey: 'massage:anchor-float-deroulement', pageLabel: 'Massage', label: 'Photo flottante — « Comment se déroule une séance ? »' },
    { slotKey: 'massage:anchor-float-qui-masse', pageLabel: 'Massage', label: 'Photo flottante — « Qui masse ? »' },
    { slotKey: 'massage:anchor-band-transmission', pageLabel: 'Massage', label: 'Photo — avant « Recevoir, ou apprendre à transmettre »' },

    { slotKey: 'colo:postcard-1', pageLabel: 'Colo pour adultes', label: 'Carte postale 1', fallbackFilename: 'l5d2lm-photo-colo.jpg' },
    { slotKey: 'colo:postcard-2', pageLabel: 'Colo pour adultes', label: 'Carte postale 2', fallbackFilename: 'l5d2lm-photo-colo-2.jpg' },
    { slotKey: 'colo:postcard-3', pageLabel: 'Colo pour adultes', label: 'Carte postale 3', fallbackFilename: 'l5d2lm-photo-colo-3.jpg' },
    { slotKey: 'colo:postcard-4', pageLabel: 'Colo pour adultes', label: 'Carte postale 4', fallbackFilename: 'l5d2lm-photo-colo-4.jpg' },
    { slotKey: 'colo:postcard-5', pageLabel: 'Colo pour adultes', label: 'Carte postale 5', fallbackFilename: 'l5d2lm-photo-colo-5.jpg' },
    { slotKey: 'colo:anchor-float-intro', pageLabel: 'Colo pour adultes', label: 'Photo flottante — introduction' },
    { slotKey: 'colo:anchor-float-magie', pageLabel: 'Colo pour adultes', label: 'Photo flottante — « La magie de chacun »' },
    { slotKey: 'colo:anchor-band-pratique', pageLabel: 'Colo pour adultes', label: 'Photo — avant « Quelques repères simples »' },
    { slotKey: 'colo:anchor-band-footer', pageLabel: 'Colo pour adultes', label: 'Photo — avant le bas de page' },

    { slotKey: 'animation:postcard-1', pageLabel: 'Animation participative', label: 'Carte postale 1', fallbackFilename: 'l5d2lm-photo-animation.jpg' },
    { slotKey: 'animation:postcard-2', pageLabel: 'Animation participative', label: 'Carte postale 2', fallbackFilename: 'l5d2lm-photo-animation-2.jpg' },
    { slotKey: 'animation:postcard-3', pageLabel: 'Animation participative', label: 'Carte postale 3', fallbackFilename: 'l5d2lm-photo-animation-3.jpg' },
    { slotKey: 'animation:anchor-band-hero', pageLabel: 'Animation participative', label: 'Photo — avant la mallette d’outils' },
    { slotKey: 'animation:anchor-float-souvenirs', pageLabel: 'Animation participative', label: 'Photo flottante — « Photos de groupe »' },
    { slotKey: 'animation:anchor-band-principes', pageLabel: 'Animation participative', label: 'Photo — avant les principes' },
    { slotKey: 'animation:anchor-band-finale', pageLabel: 'Animation participative', label: 'Photo — avant la section finale' },

    { slotKey: 'espaces:postcard-1', pageLabel: 'Espaces à découvrir', label: 'Carte postale 1', fallbackFilename: 'l5d2lm-photo-espaces.jpg' },
    { slotKey: 'espaces:postcard-2', pageLabel: 'Espaces à découvrir', label: 'Carte postale 2', fallbackFilename: 'l5d2lm-photo-espaces-2.jpg' },
    { slotKey: 'espaces:postcard-3', pageLabel: 'Espaces à découvrir', label: 'Carte postale 3', fallbackFilename: 'l5d2lm-photo-espaces-3.jpg' },
    { slotKey: 'espaces:anchor-band-initiatives', pageLabel: 'Espaces à découvrir', label: 'Photo — sous « Initiatives à explorer »' },
    { slotKey: 'espaces:anchor-band-footer', pageLabel: 'Espaces à découvrir', label: 'Photo — avant le bas de page' },
    { slotKey: 'espaces:espace-satellite', pageLabel: 'Espaces à découvrir', label: 'Logo/photo — Le Satellite' },
    { slotKey: 'espaces:espace-archipel', pageLabel: 'Espaces à découvrir', label: 'Logo/photo — L’Archipel' },
    { slotKey: 'espaces:espace-aslec', pageLabel: 'Espaces à découvrir', label: 'Logo/photo — ASLEC' },
    { slotKey: 'espaces:espace-kairos', pageLabel: 'Espaces à découvrir', label: 'Logo/photo — Association Kaïros' },
    { slotKey: 'espaces:espace-digestif', pageLabel: 'Espaces à découvrir', label: 'Logo/photo — Compagnie Digestif' },
    { slotKey: 'espaces:espace-akenes', pageLabel: 'Espaces à découvrir', label: 'Logo/photo — École aux Akènes' },
    { slotKey: 'espaces:espace-educaterre', pageLabel: 'Espaces à découvrir', label: 'Logo/photo — EducaTerre' },
    { slotKey: 'espaces:espace-mandala', pageLabel: 'Espaces à découvrir', label: 'Logo/photo — Mandala Schule' },
    { slotKey: 'espaces:espace-canopee', pageLabel: 'Espaces à découvrir', label: 'Logo/photo — Épicerie La Canopée' },
    { slotKey: 'espaces:espace-terraformation', pageLabel: 'Espaces à découvrir', label: 'Logo/photo — Terra Formation' },
    { slotKey: 'espaces:espace-agroecologie', pageLabel: 'Espaces à découvrir', label: 'Logo/photo — Journées de l’Agroécologie' },
    { slotKey: 'espaces:espace-passeport-possibles', pageLabel: 'Espaces à découvrir', label: 'Logo/photo — Passeport des possibles' },
    { slotKey: 'espaces:espace-transports-gratuits', pageLabel: 'Espaces à découvrir', label: 'Logo/photo — Transports publics gratuits' },
    { slotKey: 'espaces:espace-sentiers-savoirs', pageLabel: 'Espaces à découvrir', label: 'Logo/photo — Sentiers des Savoirs' }
  ];
  const mediaSlotsListEl = document.querySelector('[data-media-slots-list]');

  // Cartes postales (Cartes postales) : catégories dont la bande de cartes
  // postales peut basculer en rotation aléatoire (voir build/slots.py,
  // POSTCARD_CATEGORY_SECTION_SLUGS — doit rester synchronisé). Les valeurs
  // par défaut pré-remplissent "nombre visible" avec le nombre d'emplacements
  // fixes actuels de chaque page, pour un réglage cohérent au premier essai.
  const POSTCARD_ELIGIBLE_SECTION_SLUGS = [
    'accueil', 'massage', 'colo-pour-adultes', 'animations-participatives', 'espaces-a-decouvrir'
  ];
  const POSTCARD_DEFAULT_VISIBLE_COUNT = {
    accueil: 2, massage: 4, 'colo-pour-adultes': 5, 'animations-participatives': 3, 'espaces-a-decouvrir': 3
  };
  const postcardsListEl = document.querySelector('[data-postcards-list]');

  // Textes (Site > Textes) : doit rester synchronisé avec build/texts.py
  // (TEXT_BLOCKS) — mêmes page/block_key/fields. "defaults" reprend le
  // texte actuellement en place dans le fragment content/*.html, au format
  // léger (pas de HTML) : sert à pré-remplir l'éditeur pour un bloc jamais
  // encore modifié, sans que l'admin ait à recopier le texte du site.
  const TEXT_PAGES = [
    { slug: null, label: 'Toutes les pages' },
    { slug: 'l5d2lm-index', label: 'Accueil' },
    { slug: 'l5d2lm-massage', label: 'Massage' },
    { slug: 'l5d2lm-corps-expression', label: 'Corps & expression' },
    { slug: 'l5d2lm-colos-sejours', label: 'Colo pour adultes' },
    { slug: 'l5d2lm-animations-participatives', label: 'Animation participative' },
    { slug: 'l5d2lm-espaces-a-decouvrir', label: 'Espaces à découvrir' }
  ];
  const TEXT_PAGES_SECONDARY = [
    { slug: 'l5d2lm-contact', label: 'Contact' },
    { slug: '__commun__', label: 'Éléments communs' },
    { slug: 'l5d2lm-mentions-legales', label: 'Mentions légales' }
  ];

  const TEXT_BLOCKS = [
    { page: 'l5d2lm-index', blockKey: 'accueil-hero', label: 'Présentation principale', fields: ['eyebrow', 'title', 'lead', 'body', 'button'], defaults: {
      eyebrow: 'Association en Valais', title: 'Les 5 doigts de la main',
      lead: 'Créer du lien par le corps, le jeu, les émotions et le vivant.',
      body: 'Les 5 doigts de la main est une association en Valais. Le projet rassemble des espaces simples pour bouger, ressentir, créer, prendre soin et vivre des expériences collectives. À travers des ateliers, des massages intuitifs, des colos pour adultes et des animations participatives, le lien reprend place dans le réel.',
      button_label: 'Faire une demande', button_url: 'l5d2lm-contact.html'
    } },
    { page: 'l5d2lm-index', blockKey: 'accueil-espaces-heading', label: 'En-tête « Les grands espaces »', fields: ['eyebrow', 'title', 'lead'], defaults: {
      eyebrow: 'Les grands espaces', title: 'Plusieurs portes d’entrée, une même envie de lien.',
      lead: 'Chaque proposition peut s’adapter à votre groupe, votre école, votre entreprise, votre événement, votre famille ou votre lieu culturel, en Suisse romande et en France.'
    } },
    { page: 'l5d2lm-index', blockKey: 'accueil-card-massage', label: 'Carte Massage', fields: ['title', 'body', 'button'], defaults: {
      title: 'Massages & massage éclair',
      body: "Massage intuitif, massage aquatique et rituels courts pour une personne ou un collectif.",
      button_label: 'Découvrir', button_url: 'l5d2lm-massage.html'
    } },
    { page: 'l5d2lm-index', blockKey: 'accueil-card-corps-expression', label: 'Carte Corps & expression', fields: ['title', 'body', 'button'], defaults: {
      title: 'Corps & expression',
      body: "Playful extatique, improvisation, réveil du corps, jeux de mouvement et « À portée de main ».",
      button_label: 'Découvrir', button_url: 'l5d2lm-corps-expression.html'
    } },
    { page: 'l5d2lm-index', blockKey: 'accueil-card-colo', label: 'Carte Colo pour adultes', fields: ['title', 'body', 'button'], defaults: {
      title: 'Colo pour adultes',
      body: "Retrouver l’esprit d’une colo et construire ensemble un séjour où chacun peut apporter sa magie.",
      button_label: 'Découvrir', button_url: 'l5d2lm-colos-sejours.html'
    } },
    { page: 'l5d2lm-index', blockKey: 'accueil-card-animation', label: 'Carte Animations participatives', fields: ['title', 'body', 'button'], defaults: {
      title: 'Animations participatives',
      body: "Des jeux et propositions vivantes pour rendre chacun acteur et créer des souvenirs de groupe marquants.",
      button_label: 'Découvrir', button_url: 'l5d2lm-animations-participatives.html'
    } },
    { page: 'l5d2lm-index', blockKey: 'accueil-card-espaces', label: 'Carte Espaces à découvrir', fields: ['title', 'body', 'button'], defaults: {
      title: 'Espaces à découvrir',
      body: "Des lieux, associations, écoles et initiatives existantes à faire connaître.",
      button_label: 'Explorer', button_url: 'l5d2lm-espaces-a-decouvrir.html'
    } },
    { page: 'l5d2lm-index', blockKey: 'accueil-formats', label: '« Des formats qui se construisent ensemble »', fields: ['title', 'body', 'button'], defaults: {
      title: 'Des formats qui se construisent ensemble',
      body: "Un atelier bien-être, une animation festival, un massage événementiel, une colo pour adultes ou un séjour créatif pour adultes peuvent naître d’une envie encore floue. La forme se précise ensuite avec vous, selon le lieu, la durée et les personnes présentes.",
      button_label: 'Parler de votre idée', button_url: 'l5d2lm-contact.html'
    } },
    { page: 'l5d2lm-index', blockKey: 'accueil-footprints', label: 'Bandeau de bas de page', fields: ['lead'], defaults: {
      lead: 'Les pieds portent toute une vie.\nDe temps en temps, un peu d’attention leur fait du bien.'
    } },

    { page: 'l5d2lm-massage', blockKey: 'massage-hero', label: 'Présentation principale', fields: ['eyebrow', 'title', 'lead', 'body', 'button'], defaults: {
      eyebrow: 'Corps • écoute • présence',
      title: 'Massage',
      lead: 'Prendre soin peut prendre plusieurs formes.',
      body: 'Chaque personne est différente. Selon le moment, le lieu et les besoins, je propose trois façons d’accompagner le corps : une séance intuitive, un massage éclair ou une expérience dans l’eau.\n\n**Une même intention : créer du lien, remettre du mouvement et offrir un espace où le corps peut être écouté.**',
      button_label: 'Faire une demande', button_url: 'l5d2lm-contact.html?category=massage'
    } },
    { page: 'l5d2lm-massage', blockKey: 'massage-propositions-heading', label: 'En-tête « Trois propositions »', fields: ['eyebrow', 'title'], defaults: {
      eyebrow: 'Trois propositions', title: 'Choisir la forme qui correspond au moment'
    } },
    { page: 'l5d2lm-massage', blockKey: 'massage-intuitif', label: 'Massage intuitif', fields: ['title', 'lead', 'body'], defaults: {
      title: 'Massage intuitif',
      lead: 'Prendre le temps.\nÉcouter le corps.\nS’adapter à ce qui est présent.',
      body: "Après un temps d’échange, je construis la séance à partir de ce qui est présent. Le rythme peut être lent, plus mobile, ou alterner entre les deux. Rien n’est à réussir : le corps donne la direction.\n\n**Lieu principal :** Espace Chèndâ.\n\n- Ralentir lorsque tout va trop vite.\n- Retrouver du mouvement lorsque le corps semble immobile.\n- Disposer simplement d’un espace pour souffler.",
    } },
    { page: 'l5d2lm-massage', blockKey: 'reveil-energetique', label: 'Massage éclair', fields: ['title', 'lead', 'body'], defaults: {
      title: 'Massage éclair',
      lead: 'Recevoir.\nRéveiller.\nApprendre à transmettre.',
      body: "Le Massage éclair est une pratique très courte, d’environ trois minutes, qui peut être donnée ou reçue à différents moments de la journée : au travail, pendant une activité bénévole, après une journée fatigante ou simplement entre proches.\n\n> Deux façons de la découvrir : la recevoir, ou apprendre à la transmettre à votre tour.\n\n**Durée :** environ trois minutes par personne.\n**Formats :** individuel ou en groupe.",
    } },
    { page: 'l5d2lm-massage', blockKey: 'massage-aquatique', label: 'Massage aquatique', fields: ['title', 'lead', 'body'], defaults: {
      title: 'Massage aquatique',
      lead: 'Se laisser porter.\nRespirer.\nRetrouver de la légèreté.',
      body: "Dans l’eau, le corps n’a plus à porter tout son poids. Soutenue par la flottabilité, la personne est accompagnée dans des mouvements lents qui invitent à respirer, à relâcher et à retrouver de la fluidité.\n\n**Lieux :** Grimisuat ou Brigerbad.\n**Conditions :** l’eau est chauffée à 34 °C minimum et la tête reste hors de l’eau pendant toute la séance.\n**Après la séance :** prévoir si possible un moment calme pour prolonger l’expérience.\n\n- L’eau porte et donne une autre sensation du mouvement.\n- Le rythme s’ajuste aux réactions et au souffle.\n- Cette expérience prend place lorsque le lieu le permet.",
    } },
    { page: 'l5d2lm-massage', blockKey: 'massage-practical-heading', label: 'En-tête « Quelques repères simples »', fields: ['eyebrow', 'title'], defaults: {
      eyebrow: 'Avant de venir', title: 'Quelques repères simples'
    } },
    { page: 'l5d2lm-massage', blockKey: 'massage-practical-deroulement', label: '« Comment se déroule une séance ? »', fields: ['title', 'body'], defaults: {
      title: 'Comment se déroule une séance ?',
      body: "Chaque rencontre commence par un court échange. Ce temps permet de clarifier vos attentes et de repérer d’éventuelles douleurs, blessures ou zones sensibles afin que je puisse adapter la séance.\n\nIl ne s’agit pas d’un diagnostic médical, mais d’un moment d’écoute pour prendre soin du corps avec respect.\n\nUne fois installé, je vous invite à respirer, à vous déposer et à prendre le temps."
    } },
    { page: 'l5d2lm-massage', blockKey: 'massage-practical-parler', label: '« Faut-il parler pendant la séance ? »', fields: ['title', 'body'], defaults: {
      title: 'Faut-il parler pendant la séance ?',
      body: "Ce n’est pas nécessaire. Le silence peut faire partie de l’expérience, sans jamais être imposé.\n\nLe massage éclair laisse davantage de place aux échanges, notamment lorsqu’il est partagé en groupe."
    } },
    { page: 'l5d2lm-massage', blockKey: 'massage-practical-premiere-fois', label: '« Et si c’est une première fois ? »', fields: ['title', 'body'], defaults: {
      title: 'Et si c’est une première fois ?',
      body: "Aucune expérience préalable n’est nécessaire. La proposition s’adapte à votre rythme, vos envies et vos limites."
    } },
    { page: 'l5d2lm-massage', blockKey: 'massage-chenda', label: 'Espace Chèndâ', fields: ['eyebrow', 'title', 'body', 'button'], defaults: {
      eyebrow: 'Lieu principal', title: 'Espace Chèndâ',
      body: "Je donne principalement les massages intuitifs à l’Espace Chèndâ.",
      button_label: 'Voir l’adresse et l’itinéraire', button_url: 'https://search.ch/tel/sierre/avenue-general-guisan-19/espace-chenda.fr.html'
    } },
    { page: 'l5d2lm-massage', blockKey: 'massage-qui-masse', label: 'Qui masse ?', fields: ['eyebrow', 'title', 'body'], defaults: {
      eyebrow: 'Présentation pour l’espace massage', title: 'Qui masse ?',
      body: "Mon parcours s’est construit entre l’animation socioculturelle, les métiers du bois, le travail manuel, le mouvement et la relation humaine.\n\nDepuis de nombreuses années, j’accompagne des personnes et des groupes à travers le jeu, la créativité, l’expression corporelle et des expériences collectives. La menuiserie et la charpente ont aussi nourri mon rapport aux mains, à la matière, aux formes, aux appuis et à la précision du geste.\n\nLe toucher a progressivement pris une place importante dans ma manière de créer du lien. Dans des contextes amicaux, associatifs ou événementiels, j’ai observé combien un contact respectueux pouvait aider à relâcher les tensions, ralentir et retrouver une présence plus concrète au corps.\n\nJe masse de manière intuitive. Je ne reproduis pas une séance identique d’une personne à l’autre. Je m’adapte aux besoins exprimés, aux zones de tension, aux limites de chacun et aux réactions du corps au fil de la séance.\n\nJ’accorde une grande importance au respect, au consentement et à un cadre clair, sécurisant et non sexualisé."
    } },
    { page: 'l5d2lm-massage', blockKey: 'massage-training-heading', label: 'En-tête « Recevoir, ou apprendre à transmettre »', fields: ['eyebrow', 'title', 'lead'], defaults: {
      eyebrow: 'Massage éclair', title: 'Recevoir, ou apprendre à transmettre',
      lead: 'Le Massage éclair se découvre de deux façons : en le recevant, ou en apprenant à le proposer à d’autres.'
    } },
    { page: 'l5d2lm-massage', blockKey: 'massage-training-recevoir', label: 'Recevoir un massage éclair', fields: ['eyebrow', 'title', 'body', 'button'], defaults: {
      eyebrow: 'Recevoir', title: 'Recevoir un massage éclair',
      body: "Le Massage éclair est une pratique très courte, d’environ trois minutes, qui peut être proposée à différents moments de la journée.\n\nIl peut trouver sa place au travail, pendant une activité bénévole, après une journée fatigante, lors d’un événement ou simplement entre proches.\n\nQuelques minutes permettent d’apporter de l’attention au corps, de remettre du mouvement et de créer un court moment de présence.\n\n**Durée :** environ 3 minutes par personne.\n**Formats :** individuel ou groupe.",
      button_label: 'Faire une demande', button_url: 'l5d2lm-contact.html?category=massage&offer=reveil-energetique'
    } },
    { page: 'l5d2lm-massage', blockKey: 'massage-training-transmettre', label: 'Apprendre à transmettre', fields: ['eyebrow', 'title', 'body', 'button'], defaults: {
      eyebrow: 'Apprendre à transmettre', title: 'Apprendre à transmettre le massage éclair',
      body: "Le Massage éclair a aussi été pensé comme une pratique simple à apprendre et à réutiliser.\n\nCette transmission ne cherche pas à former des professionnels. Elle permet d’acquérir des repères accessibles pour proposer ensuite cette pratique entre proches, en famille, dans une association, une école, une entreprise ou pendant un événement.\n\n- Une séquence courte et facile à retenir.\n- Le rythme, la respiration et la qualité de présence.\n- Comment proposer sans imposer.\n- Comment adapter la pratique au lieu et aux personnes.\n- Une mise en situation où chacun peut essayer.",
      button_label: 'Demander une transmission', button_url: 'l5d2lm-contact.html?category=massage&offer=transmission-reveil-energetique'
    } },
    { page: 'l5d2lm-massage', blockKey: 'massage-cta', label: 'Construire une proposition', fields: ['eyebrow', 'title', 'body', 'button'], defaults: {
      eyebrow: 'Imaginer le bon format', title: 'Construire une proposition',
      body: "Chaque rencontre est différente. Lorsqu’une proposition résonne avec votre besoin ou votre curiosité, le format peut s’ajuster au contexte, au lieu et aux personnes présentes.\n\nLa durée et les tarifs sont définis selon le lieu, le nombre de personnes et le contexte.",
      button_label: 'Parler de votre besoin', button_url: 'l5d2lm-contact.html?category=massage'
    } },
    { page: 'l5d2lm-massage', blockKey: 'massage-footprints', label: 'Bandeau de bas de page', fields: ['lead'], defaults: {
      lead: 'Les pieds portent chaque jour. Les mains créent du lien.\nLe corps mérite parfois simplement un peu d’attention.'
    } },

    { page: 'l5d2lm-corps-expression', blockKey: 'corps-expression-hero', label: 'Présentation principale', fields: ['eyebrow', 'title', 'lead', 'body', 'button'], defaults: {
      eyebrow: 'Mouvement • jeu • expression', title: 'Corps & expression',
      lead: 'Des expériences pour remettre le corps en mouvement, jouer, s’exprimer et créer du lien.',
      body: 'Chaque proposition s’adapte à votre groupe et aux personnes présentes. Il ne s’agit pas de réussir une performance, mais d’expérimenter à son rythme.',
      button_label: 'Imaginer votre atelier', button_url: 'l5d2lm-contact.html?category=corps-expression'
    } },
    { page: 'l5d2lm-corps-expression', blockKey: 'corps-expression-jeu-danse', label: 'Jeu danse (famille)', fields: ['eyebrow', 'title', 'lead', 'body'], defaults: {
      eyebrow: 'Jeu danse', title: 'Le jeu comme porte d’entrée vers la danse.', lead: 'Jeu danse / Je danse',
      body: "Pas pour apprendre les bons mouvements, mais pour jouer, essayer, improviser et voir ce qui se passe.\n\nTout peut commencer par presque rien : une consigne, une musique, un regard, une rencontre.\n\nLe jeu devient mouvement, le mouvement devient rencontre et, parfois presque sans s’en rendre compte, le jeu devient danse."
    } },
    { page: 'l5d2lm-corps-expression', blockKey: 'playful-extatique', label: 'Playful extatique (format de Jeu danse)', fields: ['title', 'lead', 'body', 'button'], defaults: {
      title: 'Playful extatique',
      lead: 'Une exploration guidée, portée par la musique.',
      body: "Une exploration guidée du corps, du mouvement et du jeu, portée par la musique. Chacun reste libre de s’approprier les propositions : sensations et émotions ont leur place.\n\n> Ce n’est ni un cours de danse ni une chorégraphie : un espace pour se lâcher sur la musique et rencontrer les autres autrement.",
      button_label: 'Faire une demande pour Playful extatique', button_url: 'l5d2lm-contact.html?category=corps-expression&offer=playful-extatique'
    } },
    { page: 'l5d2lm-corps-expression', blockKey: 'a-portee-de-main', label: 'À portée de main (format de Jeu danse)', fields: ['title', 'lead', 'body', 'button'], defaults: {
      title: 'À portée de main',
      lead: 'Deux personnes, trois danses : la sienne, celle de l’autre, celle du lien.',
      body: 'Deux personnes, trois danses : la danse de soi, la danse de l’autre et celle du lien.\n\nLa rencontre commence par un retour à soi, puis deux personnes mettent leurs paumes en contact et bougent ensemble, sans leader permanent. Le mouvement peut ensuite engager les bras, puis le corps entier.',
      button_label: 'Proposer un lieu ou un partenariat', button_url: 'l5d2lm-contact.html?category=corps-expression&offer=a-portee-de-main&intent=lieu-partenariat'
    } },
    { page: 'l5d2lm-corps-expression', blockKey: 'theatre-improvisation', label: 'Théâtre d’improvisation', fields: ['title', 'lead', 'body', 'button'], defaults: {
      title: 'Théâtre d’improvisation',
      lead: 'Des petits jeux progressifs, sans représentation à préparer.',
      body: "Petits jeux et exercices progressifs : ni match d’impro, ni représentation à préparer. La progression se fait crescendo, sans stress.\n\n- Chacun participe selon son envie : observer, entrer dans un jeu, en sortir.\n- L’objectif est la spontanéité, l’écoute, l’accueil de ce qui apparaît.\n\n> Adapté à tous les âges, de 4 à 96 ans.",
      button_label: 'Faire une demande pour le Théâtre d’improvisation', button_url: 'l5d2lm-contact.html?category=corps-expression&offer=theatre-improvisation'
    } },
    { page: 'l5d2lm-corps-expression', blockKey: 'jeux-de-mouvement', label: 'Jeux de mouvement', fields: ['title', 'lead', 'body', 'button'], defaults: {
      title: 'Jeux de mouvement',
      lead: 'Courir, observer, réagir, improviser, coopérer.',
      body: "Jeu, théâtre d’improvisation, réveil du corps et danse réunis.\n\n- Balle aux prisonniers, ninja, jeux de son et mouvement, cache-cache géant…\n- Le mouvement passe d’abord par le plaisir de jouer.\n\n> Enfants, adolescents, adultes : règles et intensité ajustées aux personnes présentes.",
      button_label: 'Faire une demande pour les Jeux de mouvement', button_url: 'l5d2lm-contact.html?category=corps-expression&offer=jeux-de-mouvement'
    } },
    { page: 'l5d2lm-corps-expression', blockKey: 'reveil-du-corps', label: 'Réveil du corps', fields: ['title', 'lead', 'body', 'button'], defaults: {
      title: 'Réveil du corps',
      lead: 'Remettre le corps en mouvement, retrouver une présence à soi.',
      body: "Respiration, automassage, étirements, mobilisation articulaire, danse, yoga, sons tibétains. L’ambiance s’adapte au groupe et au moment : douce ou plus dynamique.\n\n- Peut aussi devenir un rendez-vous collectif régulier.",
      button_label: 'Faire une demande pour le Réveil du corps', button_url: 'l5d2lm-contact.html?category=corps-expression&offer=reveil-du-corps'
    } },
    { page: 'l5d2lm-corps-expression', blockKey: 'corps-expression-parcours', label: 'Présentation / parcours', fields: ['eyebrow', 'title', 'body'], defaults: {
      eyebrow: 'D’où vient cette approche ?', title: 'Du jeu au mouvement, et du mouvement à la rencontre.',
      body: "Issu de l’animation, du théâtre d’improvisation et des jeux collectifs, Julien aime créer des situations simples où chacun peut essayer, bouger et rencontrer les autres sans pression.\n\nLa danse est venue nourrir cette approche au fil du temps, avec une envie particulière : partir du jeu plutôt que chercher immédiatement à « bien danser », et explorer différentes manières de bouger et de rencontrer l’autre.\n\nLes propositions de Corps & expression mélangent ainsi jeu, improvisation, mouvement et danse."
    } },
    { page: 'l5d2lm-corps-expression', blockKey: 'corps-expression-cadre', label: '« Un cadre commun »', fields: ['eyebrow', 'title', 'body'], defaults: {
      eyebrow: 'Un cadre commun', title: 'Le même esprit pour chaque proposition.',
      body: "Chaque proposition s’adapte au groupe, au lieu et à l’énergie du moment. Il n’y a pas de performance à réussir : chacun peut participer à son rythme, observer, ou simplement essayer. Le respect et le consentement de chaque personne restent la base."
    } },
    { page: 'l5d2lm-corps-expression', blockKey: 'corps-expression-footprints', label: 'Bandeau de bas de page', fields: ['lead'], defaults: {
      lead: 'Les pieds portent toute une vie.\nDe temps en temps, un peu d’attention leur fait du bien.'
    } },

    { page: 'l5d2lm-colos-sejours', blockKey: 'colo-hero', label: 'Présentation principale', fields: ['eyebrow', 'title', 'lead', 'body', 'button'], defaults: {
      eyebrow: 'Jouer • partager • construire ensemble', title: 'Colo pour adultes',
      lead: 'Retrouver l’esprit d’une colo et construire le séjour ensemble.',
      body: 'Une expérience collective pour sortir du quotidien, rencontrer d’autres personnes, jouer, partager et vivre un séjour dans lequel chacun peut réellement prendre sa place.',
      button_label: 'Découvrir la Colo pour adultes et s’inscrire', button_url: 'https://form.jotform.com/toopilon/cpa--colo-pour-adultes-1'
    } },
    { page: 'l5d2lm-colos-sejours', blockKey: 'colo-collective-heading', label: '« Une expérience collective »', fields: ['eyebrow', 'title', 'body'], defaults: {
      eyebrow: 'Une expérience collective', title: 'Un cadre où chacun peut prendre sa place.',
      body: "La Colo pour adultes s’adresse aux personnes qui souhaitent sortir du quotidien et vivre un séjour construit à plusieurs."
    } },
    { page: 'l5d2lm-colos-sejours', blockKey: 'colo-magie', label: '« La magie de chacun »', fields: ['eyebrow', 'title', 'body'], defaults: {
      eyebrow: 'La magie de chacun', title: 'Le programme ne vient pas seulement d’activités décidées à l’avance.',
      body: "Chaque participant peut aussi proposer sa « magie » aux autres : un jeu, une activité, une passion, un savoir-faire, une pratique ou simplement une envie.\n\nL’objectif est de créer un cadre de confiance dans lequel chacun peut participer, essayer, proposer ou simplement profiter du séjour à son rythme. Le groupe devient progressivement acteur de sa propre expérience."
    } },
    { page: 'l5d2lm-colos-sejours', blockKey: 'colo-practical-depart', label: '« À partir de 15 adultes »', fields: ['eyebrow', 'title', 'body'], defaults: {
      eyebrow: 'Point de départ', title: 'À partir de 15 adultes',
      body: "Une colo peut être organisée à partir de **15 participants adultes**."
    } },
    { page: 'l5d2lm-colos-sejours', blockKey: 'colo-practical-construction', label: '« Selon le groupe »', fields: ['eyebrow', 'title', 'body'], defaults: {
      eyebrow: 'Construction', title: 'Selon le groupe',
      body: "Le contenu, la durée, le lieu et les activités sont construits en fonction des personnes présentes."
    } },
    { page: 'l5d2lm-colos-sejours', blockKey: 'colo-footprints', label: 'Bandeau de bas de page', fields: ['lead'], defaults: {
      lead: 'Les pieds portent toute une vie.\nDe temps en temps, un peu d’attention leur fait du bien.'
    } },

    { page: 'l5d2lm-animations-participatives', blockKey: 'animation-hero', label: 'Présentation principale', fields: ['eyebrow', 'title', 'lead', 'body', 'button'], defaults: {
      eyebrow: 'Festivals • fêtes • moments collectifs', title: 'Animation participative',
      lead: 'Être acteur plutôt que spectateur.',
      body: 'L’animation participative peut trouver sa place dans votre festival, votre fête, votre association, votre événement familial ou tout autre moment collectif.\n\nElle peut être préparée à l’avance ou se construire directement sur place, selon le public, l’ambiance et les interactions qui apparaissent.',
      button_label: 'Imaginer votre animation', button_url: 'l5d2lm-contact.html?category=animations-participatives&offer=animation-participative'
    } },
    { page: 'l5d2lm-animations-participatives', blockKey: 'animation-mallette-heading', label: 'En-tête « Une mallette d’outils »', fields: ['eyebrow', 'title', 'lead'], defaults: {
      eyebrow: 'Une mallette d’outils', title: 'Des propositions choisies selon le contexte et les personnes présentes.',
      lead: 'La diversité des jeux permet de faire évoluer l’animation en fonction de ce qui se passe sur le moment.'
    } },
    { page: 'l5d2lm-animations-participatives', blockKey: 'animation-toolbox-rencontrer', label: '« Se rencontrer »', fields: ['title', 'body'], defaults: {
      title: 'Se rencontrer',
      body: "- Jeux pour briser la glace\n- Jeux d’interaction et de mouvement\n- Mimes"
    } },
    { page: 'l5d2lm-animations-participatives', blockKey: 'animation-toolbox-jouer', label: '« Jouer et essayer »', fields: ['title', 'body'], defaults: {
      title: 'Jouer et essayer',
      body: "- Tir à l’arc\n- Slackline\n- Jeux de lancer\n- Jeux en bois et jeux de société"
    } },
    { page: 'l5d2lm-animations-participatives', blockKey: 'animation-toolbox-creer', label: '« Créer ensemble »', fields: ['title', 'body'], defaults: {
      title: 'Créer ensemble',
      body: "- Photos de groupe marquantes et drôles\n- Propositions improvisées à partir de ce qui se passe sur le moment"
    } },
    { page: 'l5d2lm-animations-participatives', blockKey: 'animation-souvenirs', label: '« Photos de groupe »', fields: ['eyebrow', 'title', 'body'], defaults: {
      eyebrow: 'Photos de groupe', title: 'Créer un souvenir qui raconte vraiment quelque chose du groupe.',
      body: "L’animation aide les participants à imaginer une situation, une composition, un geste ou une mise en scène collective.\n\nL’objectif est de créer un souvenir original, marquant et drôle, plutôt qu’une simple photo où tout le monde pose face à l’appareil."
    } },
    { page: 'l5d2lm-animations-participatives', blockKey: 'animation-essentiel', label: '« L’essentiel »', fields: ['eyebrow', 'title', 'body'], defaults: {
      eyebrow: 'L’essentiel', title: 'Créer du lien, pas une performance.',
      body: "Il n’y a pas de résultat particulier à atteindre. L’essentiel est de provoquer des rencontres et de permettre aux personnes d’interagir les unes avec les autres."
    } },
    { page: 'l5d2lm-animations-participatives', blockKey: 'animation-duree-public', label: '« Durée et public »', fields: ['eyebrow', 'title', 'body'], defaults: {
      eyebrow: 'Durée et public', title: 'De 30 minutes à 4 heures',
      body: "Les animations peuvent durer d’une demi-heure à quatre heures et s’adresser aux enfants, aux adolescents ou aux adultes."
    } },
    { page: 'l5d2lm-animations-participatives', blockKey: 'animation-cta', label: 'Appel à l’action final', fields: ['title', 'body', 'button'], defaults: {
      title: 'Votre événement, votre public, une ambiance ?',
      body: "La proposition peut se préparer en amont ou s’inventer sur place à partir de votre contexte.",
      button_label: 'Construire votre animation', button_url: 'l5d2lm-contact.html?category=animations-participatives&offer=animation-participative'
    } },
    { page: 'l5d2lm-animations-participatives', blockKey: 'animation-footprints', label: 'Bandeau de bas de page', fields: ['lead'], defaults: {
      lead: 'Les pieds portent toute une vie.\nDe temps en temps, un peu d’attention leur fait du bien.'
    } },

    { page: 'l5d2lm-espaces-a-decouvrir', blockKey: 'espaces-hero', label: 'Présentation principale', fields: ['title', 'body', 'button'], defaults: {
      title: 'Espaces à découvrir',
      body: 'Cette page rassemble des lieux, associations, écoles, projets et initiatives qui existent déjà et qui méritent d’être partagés. Ces espaces ne sont pas forcément partenaires des 5 doigts de la main. L’idée est de rendre visibles des points vivants déjà présents aux alentours.',
      button_label: 'Proposer un espace à découvrir', button_url: 'l5d2lm-contact.html?category=espaces-a-decouvrir&offer=proposer-un-lieu'
    } },
    { page: 'l5d2lm-espaces-a-decouvrir', blockKey: 'espaces-initiatives-heading', label: 'En-tête « Initiatives à explorer »', fields: ['eyebrow', 'title'], defaults: {
      eyebrow: 'Initiatives à explorer', title: 'Des espaces, lieux, initiatives et projets inspirants.'
    } },
    { page: 'l5d2lm-espaces-a-decouvrir', blockKey: 'espace-satellite', label: 'Le Satellite', fields: ['title', 'body', 'button'], defaults: {
      title: 'Le Satellite',
      body: "Sierre — Culture, partage et vie de quartier : jardin, ateliers, coworking et marché.",
      button_label: 'www.lesatellite.ch', button_url: 'https://www.lesatellite.ch/'
    } },
    { page: 'l5d2lm-espaces-a-decouvrir', blockKey: 'espace-archipel', label: 'L’Archipel', fields: ['title', 'body', 'button'], defaults: {
      title: 'L’Archipel',
      body: "Sion — Tiers-lieu avec ressourcerie, coworking, atelier partagé et jardin-forêt.",
      button_label: 'archipelsion.ch', button_url: 'https://archipelsion.ch/'
    } },
    { page: 'l5d2lm-espaces-a-decouvrir', blockKey: 'espace-aslec', label: 'ASLEC', fields: ['title', 'body', 'button'], defaults: {
      title: 'ASLEC',
      body: "Sierre — Loisirs, éducation et culture pour enfants et ados.",
      button_label: 'aslec.ch', button_url: 'https://aslec.ch/'
    } },
    { page: 'l5d2lm-espaces-a-decouvrir', blockKey: 'espace-kairos', label: 'Association Kaïros', fields: ['title', 'body', 'button'], defaults: {
      title: 'Association Kaïros',
      body: "Uvrier — Verger en permaculture, forêt nourricière, jus et nectars maison.",
      button_label: 'associationkairos.com', button_url: 'https://www.associationkairos.com/'
    } },
    { page: 'l5d2lm-espaces-a-decouvrir', blockKey: 'espace-digestif', label: 'Compagnie Digestif / Treffpunkt Tschüdanga', fields: ['title', 'body', 'button'], defaults: {
      title: 'Compagnie Digestif / Treffpunkt Tschüdanga',
      body: "Salgesch — Rencontre humain-nature-animaux en forêt de Finges : cirque, jardin et résidences d’artistes.",
      button_label: 'compagniedigestif.ch', button_url: 'https://www.compagniedigestif.ch/fr/angebote/treffpunkt-tschudanga/'
    } },
    { page: 'l5d2lm-espaces-a-decouvrir', blockKey: 'espace-akenes', label: 'École aux Akènes', fields: ['title', 'body', 'button'], defaults: {
      title: 'École aux Akènes',
      body: "Lens — École où l’enfant apprend à son rythme, en autonomie.",
      button_label: 'ecoleauxakenes.ch', button_url: 'https://www.ecoleauxakenes.ch/'
    } },
    { page: 'l5d2lm-espaces-a-decouvrir', blockKey: 'espace-educaterre', label: 'EducaTerre', fields: ['title', 'body', 'button'], defaults: {
      title: 'EducaTerre',
      body: "Valais — Apprendre et s’épanouir au contact de la nature.",
      button_label: 'educaterre.ch', button_url: 'https://educaterre.ch/'
    } },
    { page: 'l5d2lm-espaces-a-decouvrir', blockKey: 'espace-mandala', label: 'Mandala Schule', fields: ['title', 'body', 'button'], defaults: {
      title: 'Mandala Schule',
      body: "Venthône — École privée pour les 4-15 ans, proche de la nature, reconnue depuis 2015.",
      button_label: 'mandala-schule.ch', button_url: 'https://mandala-schule.ch/fr/accueil/'
    } },
    { page: 'l5d2lm-espaces-a-decouvrir', blockKey: 'espace-canopee', label: 'Épicerie La Canopée', fields: ['title', 'body', 'button'], defaults: {
      title: 'Épicerie La Canopée',
      body: "Muraz — Épicerie coopérative, locale et démocratique.",
      button_label: 'epicerielacanopee.ch', button_url: 'https://epicerielacanopee.ch/'
    } },
    { page: 'l5d2lm-espaces-a-decouvrir', blockKey: 'espace-terraformation', label: 'Terra Formation', fields: ['title', 'body', 'button'], defaults: {
      title: 'Terra Formation',
      body: "Fondation valaisanne autour de la biodiversité, de la régénération des écosystèmes et de la transmission de pratiques écologiques.",
      button_label: 'terraformation.ch', button_url: 'https://www.terraformation.ch/'
    } },
    { page: 'l5d2lm-espaces-a-decouvrir', blockKey: 'espace-agroecologie', label: 'Journées de l’Agroécologie', fields: ['title', 'body', 'button'], defaults: {
      title: 'Journées de l’Agroécologie',
      body: "Événements partout en Suisse autour de l’agroécologie : ateliers, visites, formations et rencontres. Chaque personne peut aussi proposer son propre événement.",
      button_label: 'agroecologyworks.ch', button_url: 'https://www.agroecologyworks.ch/fr/journees-de-l-agroecologie/2026/events'
    } },
    { page: 'l5d2lm-espaces-a-decouvrir', blockKey: 'espace-passeport-possibles', label: 'Passeport des possibles', fields: ['title', 'body', 'button'], defaults: {
      title: 'Passeport des possibles',
      body: "Parcours ludique à Fribourg pour découvrir plusieurs associations à travers des petites activités autour du réemploi, du bricolage et de l’économie circulaire.",
      button_label: 'lafabriquefribourg.ch', button_url: 'https://lafabriquefribourg.ch/le-passeport-des-possibles/'
    } },
    { page: 'l5d2lm-espaces-a-decouvrir', blockKey: 'espace-transports-gratuits', label: 'Transports publics gratuits', fields: ['title', 'body', 'button'], defaults: {
      title: 'Transports publics gratuits',
      body: "Initiative suisse visant à rendre les transports publics locaux et régionaux gratuits, et les déplacements longue distance beaucoup plus accessibles.",
      button_label: 'transports-publics-gratuits.ch', button_url: 'https://transports-publics-gratuits.ch/'
    } },
    { page: 'l5d2lm-espaces-a-decouvrir', blockKey: 'espace-sentiers-savoirs', label: 'Sentiers des Savoirs', fields: ['title', 'body', 'button'], defaults: {
      title: 'Sentiers des Savoirs',
      body: "Réseau où l’on voyage, souvent à pied, pour rencontrer des personnes et apprendre directement auprès d’elles des savoir-faire artisanaux, agricoles ou liés au vivant.",
      button_label: 'sentiers-des-savoirs.ch', button_url: 'https://sentiers-des-savoirs.ch/'
    } },
    { page: 'l5d2lm-espaces-a-decouvrir', blockKey: 'espaces-footprints', label: 'Bandeau de bas de page', fields: ['lead'], defaults: {
      lead: 'Les pieds portent toute une vie.\nDe temps en temps, un peu d’attention leur fait du bien.'
    } },

    { page: 'l5d2lm-contact', blockKey: 'contact-hero', label: 'Présentation principale', fields: ['eyebrow', 'title', 'lead', 'body'], defaults: {
      eyebrow: 'Contact & demandes', title: 'Une envie, une idée, un lieu, une demande ?',
      lead: 'Vous pouvez écrire même si tout n’est pas encore clair.',
      body: 'Votre demande peut concerner un massage, un massage éclair, un atelier corps & expression, « À portée de main », une colo, une animation participative ou un espace à découvrir.'
    } },
    { page: 'l5d2lm-contact', blockKey: 'contact-demande-heading', label: 'En-tête « Demande »', fields: ['eyebrow', 'title', 'lead'], defaults: {
      eyebrow: 'Demande', title: 'Qu’est-ce qui vous amène ?',
      lead: 'Un premier choix permet d’orienter votre demande. Le formulaire s’adapte ensuite à la proposition qui vous intéresse.'
    } },
    { page: 'l5d2lm-contact', blockKey: 'contact-note', label: '« Écrire simplement »', fields: ['title', 'body', 'button'], defaults: {
      title: 'Écrire simplement',
      body: "Il suffit d’indiquer un moyen de réponse, puis quelques repères utiles selon la proposition.",
      button_label: 'l5d2lm@ik.me', button_url: 'mailto:l5d2lm@ik.me'
    } },
    { page: 'l5d2lm-contact', blockKey: 'contact-footprints', label: 'Bandeau de bas de page', fields: ['lead'], defaults: {
      lead: 'Les pieds portent toute une vie.\nDe temps en temps, un peu d’attention leur fait du bien.'
    } },

    { page: 'l5d2lm-mentions-legales', blockKey: 'mentions-hero', label: 'Présentation principale', fields: ['eyebrow', 'title', 'lead'], defaults: {
      eyebrow: 'Informations légales', title: 'Mentions légales',
      lead: 'Éditeur, contact et hébergement de ce site.'
    } },
    { page: 'l5d2lm-mentions-legales', blockKey: 'mentions-editeur', label: 'Éditeur du site', fields: ['title', 'body'], defaults: {
      title: 'Éditeur du site',
      body: "Les 5 Doigts de la Main, association à but non lucratif de droit suisse (Valais, Suisse).\n\nResponsable de la publication : le comité de l’association."
    } },
    { page: 'l5d2lm-mentions-legales', blockKey: 'mentions-contact', label: 'Contact', fields: ['title', 'body'], defaults: {
      title: 'Contact',
      body: "Pour toute question relative au site ou à son contenu : [l5d2lm@ik.me](mailto:l5d2lm@ik.me), ou via la [page contact](l5d2lm-contact.html)."
    } },
    { page: 'l5d2lm-mentions-legales', blockKey: 'mentions-hebergement', label: 'Hébergement', fields: ['title', 'body'], defaults: {
      title: 'Hébergement',
      body: "Ce site est hébergé par GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis (GitHub Pages)."
    } },
    { page: 'l5d2lm-mentions-legales', blockKey: 'mentions-footprints', label: 'Bandeau de bas de page', fields: ['lead'], defaults: {
      lead: 'Les pieds portent toute une vie.\nDe temps en temps, un peu d’attention leur fait du bien.'
    } },

    { page: '__commun__', blockKey: 'commun-footer-tagline', label: 'Accroche du pied de page', fields: ['lead'], defaults: {
      lead: 'Créer du lien par le corps, le jeu, les émotions et le vivant.'
    } },
    { page: 'l5d2lm-corps-expression', blockKey: 'corps-expression-formats-label', label: "Corps & expression — « Formats de Jeu danse »", fields: ['title'], defaults: {
      title: "Formats de Jeu danse"
    } },
    { page: 'l5d2lm-corps-expression', blockKey: 'playful-extatique-tags', label: "Corps & expression — étiquettes Playful extatique", fields: ['title'], defaults: {
      title: "Musique • mouvement • jeu"
    } },
    { page: 'l5d2lm-corps-expression', blockKey: 'a-portee-de-main-tags', label: "Corps & expression — étiquettes À portée de main", fields: ['title'], defaults: {
      title: "Danse • rencontre • lien"
    } },
    { page: 'l5d2lm-corps-expression', blockKey: 'theatre-improvisation-tags', label: "Corps & expression — étiquettes Théâtre d’improvisation", fields: ['title'], defaults: {
      title: "Jeu • confiance • spontanéité"
    } },
    { page: 'l5d2lm-corps-expression', blockKey: 'jeux-de-mouvement-tags', label: "Corps & expression — étiquettes Jeux de mouvement", fields: ['title'], defaults: {
      title: "Plaisir • réaction • coopération"
    } },
    { page: 'l5d2lm-corps-expression', blockKey: 'reveil-du-corps-tags', label: "Corps & expression — étiquettes Réveil du corps", fields: ['title'], defaults: {
      title: "Présence • mobilité • énergie"
    } },
    { page: 'l5d2lm-corps-expression', blockKey: 'corps-expression-dates', label: "Corps & expression — annonce des prochaines dates", fields: ['title'], defaults: {
      title: "Les prochaines dates et les prochains lieux seront annoncés bientôt."
    } },
    { page: 'l5d2lm-corps-expression', blockKey: 'corps-expression-rythme', label: "Corps & expression — « Le rythme et les limites de chacun »", fields: ['title', 'body'], defaults: {
      title: "Le rythme et les limites de chacun",
      body: "La pratique respecte le rythme, les limites et le consentement de chaque personne. Chacun peut ralentir, modifier le contact ou se retirer à tout moment."
    } },
    { page: 'l5d2lm-massage', blockKey: 'massage-intuitif-duree', label: "Massage — durée Massage intuitif", fields: ['title'], defaults: {
      title: "30 à 90 min"
    } },
    { page: 'l5d2lm-massage', blockKey: 'reveil-energetique-duree', label: "Massage — durée Massage éclair", fields: ['title'], defaults: {
      title: "≈ 3 min pour recevoir · transmission possible en individuel ou en groupe"
    } },
    { page: 'l5d2lm-massage', blockKey: 'massage-aquatique-duree', label: "Massage — durée Massage aquatique", fields: ['title'], defaults: {
      title: "45 à 90 min"
    } },
    { page: 'l5d2lm-massage', blockKey: 'massage-formats-heading', label: "Massage — « Formats possibles »", fields: ['eyebrow', 'title', 'lead'], defaults: {
      eyebrow: "Formats possibles",
      title: "Où et avec qui ?",
      lead: "Ces indications donnent un premier repère. Les possibilités concrètes dépendent toujours du lieu et du contexte."
    } },
    { page: 'l5d2lm-massage', blockKey: 'massage-formats-address', label: "Massage — adresse", fields: ['lead'], defaults: {
      lead: "Avenue Général-Guisan 19\n3960 Sierre"
    } },
    { page: 'l5d2lm-contact', blockKey: 'contact-note-label', label: "Contact — libellé « Écrire directement »", fields: ['title'], defaults: {
      title: "Écrire directement :"
    } },
    { page: 'l5d2lm-mission-declic', blockKey: 'mission-temporaire', label: "Mission Déclic — page temporaire", fields: ['eyebrow', 'title', 'lead'], defaults: {
      eyebrow: "Page temporaire",
      title: "En construction",
      lead: "Cette page n’est pas encore prête."
    } },
    { page: 'l5d2lm-mission-declic', blockKey: 'mission-temporaire-intro', label: "Mission Déclic — texte d’attente", fields: ['lead'], defaults: {
      lead: "Elle reviendra plus tard, quand le contenu sera clair et pleinement assumé. Pour l’instant, l’accueil et la page Contact restent disponibles."
    } },
  ];

  const FIELD_LABELS = {
    title: 'Titre', eyebrow: 'Surtitre', lead: 'Accroche', body: 'Texte principal',
    button_label: 'Texte du bouton', button_url: 'Lien du bouton'
  };

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
    hiddenSlotKeys: new Set(),
    postcardConfigs: new Map(),
    postcardPoolBySection: new Map(),
    signedUrlCache: new Map(),
    heicPreviewCache: new Map(),
    editList: [],
    editIndex: -1,
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

  // Même détection que isHeicFile, mais sur une fiche l5d2lm_media (déjà
  // en base) plutôt que sur un File brut sélectionné localement.
  const isHeicMediaRow = (row) => {
    const type = String(row?.original_mime_type || '').toLowerCase();
    const name = String(row?.original_filename || '').toLowerCase();
    return type.includes('heic') || type.includes('heif') || name.endsWith('.heic') || name.endsWith('.heif');
  };

  // La plupart des navigateurs (Safari excepté) ne savent pas afficher un
  // .heic dans une balise <img> : on convertit une fois en JPEG pour
  // l'aperçu (le fichier original stocké n'est jamais modifié).
  const convertHeicBlobForPreview = async (blob) => {
    if (!window.heic2any) return '';
    try {
      const converted = await window.heic2any({ blob, toType: 'image/jpeg', quality: 0.85 });
      const outBlob = Array.isArray(converted) ? converted[0] : converted;
      return URL.createObjectURL(outBlob);
    } catch (error) {
      console.error('Conversion HEIC impossible :', error);
      return '';
    }
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
      // La mise en page "placeholder" (texte centré) ne doit s'appliquer
      // que tant que la conversion HEIC n'a pas encore produit d'aperçu.
      card.className = `media-item${isUpload && item.isHeic && !item.src ? ' media-item--heic' : ''}`;
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

      const info = isImported ? mediaState.importedByFilename.get(item.filename) : null;

      // Le titre (une fois personnalisé) remplace le nom technique du
      // fichier, et vient au-dessus de la photo plutôt qu'en dessous.
      const heading = document.createElement('p');
      heading.className = 'media-item__heading';
      heading.textContent = info?.default_annotation || item.filename;
      card.appendChild(heading);

      const thumb = document.createElement('div');
      thumb.className = 'media-item__thumb';
      if (isUpload && item.isHeic && !item.src) {
        // Conversion en cours (voir handleFilesSelected) : le fichier HEIC
        // original part tel quel à l'import, seul cet aperçu est temporaire.
        thumb.textContent = 'Conversion de l’aperçu…';
      } else {
        const img = document.createElement('img');
        img.loading = 'lazy';
        // L'annotation sert d'infobulle au survol (et de vrai texte
        // alternatif quand elle est renseignée) plutôt que de rester
        // cachée dans le panneau d'édition.
        img.alt = info?.alt_text || '';
        if (info?.alt_text) img.title = info.alt_text;
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

      // Titre + annotation saisissables tout de suite, avant même l'import :
      // repris automatiquement dans la fiche Supabase (voir
      // handleImportSelection), pour ne pas avoir à rouvrir chaque photo
      // une par une juste pour ça.
      if (isUpload && !isImported) {
        const quickFields = document.createElement('div');
        quickFields.className = 'media-item__quick-fields';

        const titleLabel = document.createElement('label');
        titleLabel.textContent = 'Titre';
        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.placeholder = 'Ex. Et si le terrain de jeu, c’était toi ?';
        titleInput.value = item.title || '';
        titleInput.addEventListener('input', () => { item.title = titleInput.value; });
        titleLabel.appendChild(titleInput);
        quickFields.appendChild(titleLabel);

        const annotationLabel = document.createElement('label');
        annotationLabel.textContent = 'Annotation (affichée au survol)';
        const annotationInput = document.createElement('input');
        annotationInput.type = 'text';
        annotationInput.placeholder = 'Ex. Deux personnes dansent, mains jointes.';
        annotationInput.value = item.annotation || '';
        annotationInput.addEventListener('input', () => { item.annotation = annotationInput.value; });
        annotationLabel.appendChild(annotationInput);
        quickFields.appendChild(annotationLabel);

        card.appendChild(quickFields);
      }

      // Une seule rangée compacte pour tout le statut (droits à traiter,
      // favori, catégories) plutôt que plusieurs lignes empilées.
      const statusRow = document.createElement('div');
      statusRow.className = 'media-item__status-row';

      if (!isImported) {
        const statusBadge = document.createElement('span');
        statusBadge.className = 'media-badge media-badge--pending';
        statusBadge.textContent = 'À importer';
        statusRow.appendChild(statusBadge);
      }

      if (isImported) {
        // "Autorisation OK" est l'état validé : l'afficher sur chaque carte
        // n'apporte rien une fois que c'est fait — seuls les statuts qui
        // demandent encore une action restent visibles.
        if (info.rights_status !== 'authorized') {
          const rightsBadge = document.createElement('span');
          const rightsDef = RIGHTS_STATUSES.find((entry) => entry.value === info.rights_status);
          rightsBadge.className = `media-badge media-badge--rights-${info.rights_status}`;
          rightsBadge.textContent = rightsDef ? rightsDef.label : info.rights_status;
          statusRow.appendChild(rightsBadge);
        }

        const assignments = mediaState.mediaSections.get(info.id) || new Map();
        if (assignments.size) {
          const ordered = Array.from(assignments.entries()).sort((a, b) => a[1] - b[1]);
          const visible = ordered.slice(0, 2);
          const remaining = ordered.length - visible.length;

          visible.forEach(([sectionId]) => {
            const section = sectionsState.items.find((entry) => entry.id === sectionId);
            if (!section) return;
            const chip = document.createElement('span');
            chip.className = 'media-badge';
            chip.textContent = section.title;
            statusRow.appendChild(chip);
          });

          if (remaining > 0) {
            const more = document.createElement('span');
            more.className = 'media-badge';
            more.textContent = `+${remaining}`;
            statusRow.appendChild(more);
          }
        }

        const favoriteButton = document.createElement('button');
        favoriteButton.type = 'button';
        favoriteButton.className = 'media-item__favorite';
        favoriteButton.textContent = info.favorite ? '★' : '☆';
        favoriteButton.setAttribute('aria-label', info.favorite ? 'Retirer des favoris' : 'Marquer comme favori');
        favoriteButton.addEventListener('click', () => toggleFavorite(info));
        statusRow.appendChild(favoriteButton);
      }

      card.appendChild(statusRow);

      if (isImported) {
        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.className = 'btn media-item__edit-open';
        editButton.textContent = 'Modifier';
        editButton.addEventListener('click', () => openMediaEditOverlay(info));
        card.appendChild(editButton);
      }

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
      const upload = {
        id,
        kind: 'upload',
        filename: file.name,
        file,
        src: heic ? '' : URL.createObjectURL(file),
        isHeic: heic,
        mimeType: file.type,
        bytes: file.size,
        // Saisis directement sur la carte avant import (voir
        // renderMediaGrid) pour éviter de rouvrir chaque photo une par
        // une juste pour ça : repris tels quels dans l'insert Supabase.
        title: '',
        annotation: ''
      };
      mediaState.localUploads.unshift(upload);
      mediaState.selected.add(id); // prêtes à être importées d'un clic

      // L'original HEIC part tel quel à l'import (voir plus bas) : cette
      // conversion ne sert qu'à afficher un aperçu dans l'admin.
      if (heic) {
        convertHeicBlobForPreview(file).then((previewUrl) => {
          if (!previewUrl) return;
          upload.src = previewUrl;
          renderMediaGrid();
        });
      }
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

    // Bucket privé, fichier HEIC : la plupart des navigateurs ne peuvent
    // pas l'afficher tel quel, on récupère les octets et on convertit en
    // JPEG une seule fois (résultat mis en cache par média).
    if (isHeicMediaRow(mediaRow)) {
      if (mediaState.heicPreviewCache.has(mediaRow.id)) return mediaState.heicPreviewCache.get(mediaRow.id);
      const signedUrl = await getSignedMediaUrl(mediaRow);
      if (!signedUrl) return '';
      try {
        const response = await fetch(signedUrl);
        if (!response.ok) return signedUrl;
        const blob = await response.blob();
        const previewUrl = await convertHeicBlobForPreview(blob);
        if (previewUrl) mediaState.heicPreviewCache.set(mediaRow.id, previewUrl);
        return previewUrl || signedUrl;
      } catch (error) {
        return signedUrl;
      }
    }

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
        slot: 'Choisir une photo pour cet emplacement',
        postcard: 'Ajouter une photo à cette carte postale'
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
    // Un emplacement fixe (mode "slot") n'a pas cette contrainte (une même
    // photo peut servir à plusieurs emplacements). Un pool de cartes
    // postales (mode "postcard") a sa propre règle : jamais deux fois la
    // même photo dans le pool d'UNE catégorie — mais elle peut très bien
    // servir aussi ailleurs sur le site.
    const alreadyOnPage = mediaState.pickerMode === 'slot'
      ? new Set()
      : mediaState.pickerMode === 'postcard'
        ? new Set((mediaState.postcardPoolBySection.get(mediaState.pickerContext?.sectionId) || []).map((item) => item.media_id))
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
      if (mode === 'postcard') {
        await addPostcardPoolItem(context.sectionId, mediaId);
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

  // Emplacements explicitement vidés (bouton "Retirer la photo" sur un
  // emplacement qui n'affichait qu'une photo déjà en ligne avant ce
  // mécanisme, pas encore "gérée" — voir l5d2lm_media_slot_overrides).
  // Table optionnelle : si la migration n'est pas encore appliquée,
  // l'erreur est avalée et aucun emplacement n'est considéré masqué.
  const fetchHiddenSlotKeys = async () => {
    mediaState.hiddenSlotKeys = new Set();
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('l5d2lm_media_slot_overrides')
        .select('slot_key')
        .eq('hidden', true);
      if (error) throw error;
      mediaState.hiddenSlotKeys = new Set((data || []).map((row) => row.slot_key));
    } catch (err) {
      console.warn('Emplacements masqués non récupérés (migration pas encore appliquée ?) :', err);
    }
  };

  const renderSlotsList = () => {
    if (!mediaSlotsListEl) return;
    mediaSlotsListEl.innerHTML = '';

    // Regroupé par page : une longue liste plate de 20+ emplacements
    // devient vite illisible une fois qu'on dépasse une seule page.
    let currentPageLabel = null;
    let currentGroup = null;

    SLOT_DEFINITIONS.forEach((slot) => {
      if (slot.pageLabel !== currentPageLabel) {
        currentPageLabel = slot.pageLabel;
        const heading = document.createElement('h3');
        heading.className = 'media-slots-group-heading';
        heading.textContent = currentPageLabel;
        mediaSlotsListEl.appendChild(heading);
        currentGroup = document.createElement('div');
        currentGroup.className = 'media-slots-group';
        mediaSlotsListEl.appendChild(currentGroup);
      }

      const isHidden = mediaState.hiddenSlotKeys.has(slot.slotKey);
      const media = isHidden ? null : mediaState.slotAssignments.get(slot.slotKey);
      // Une photo déjà en place avant ce mécanisme (import initial du site)
      // et jamais republiée depuis l'admin : le site public l'affiche déjà
      // (voir build/slots.py, fallback), mais elle n'est pas encore "gérée"
      // ici — à ne pas confondre avec un emplacement réellement vide.
      // Calculée même si masqué, pour proposer "Réafficher" seulement quand
      // il y a réellement quelque chose à réafficher.
      const fallbackEntry = !mediaState.slotAssignments.get(slot.slotKey) && slot.fallbackFilename
        ? allSiteMedia().find((item) => item.filename === slot.fallbackFilename)
        : null;
      const visibleFallback = isHidden ? null : fallbackEntry;

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
      } else if (visibleFallback) {
        const img = document.createElement('img');
        img.src = visibleFallback.src;
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
      status.className = media || visibleFallback ? 'media-slot-item__status' : 'media-slot-item__status--empty';
      if (media) {
        status.textContent = 'Photo publiée';
      } else if (visibleFallback) {
        status.textContent = 'Photo déjà en ligne, pas encore gérée ici';
      } else if (isHidden) {
        status.textContent = 'Photo retirée — rien n’est affiché ici';
      } else {
        status.textContent = 'Aucune photo publiée';
      }
      body.appendChild(status);
      row.appendChild(body);

      const actions = document.createElement('div');
      actions.className = 'media-slot-item__actions';

      const chooseButton = document.createElement('button');
      chooseButton.type = 'button';
      chooseButton.className = 'btn';
      chooseButton.textContent = media ? 'Changer la photo' : 'Choisir une photo';
      chooseButton.addEventListener('click', () => openMediaPicker('slot', { slotKey: slot.slotKey }));
      actions.appendChild(chooseButton);

      // Retirer : dès qu'une image est réellement affichée ici, qu'elle
      // soit gérée depuis Gestion ou juste une photo déjà en ligne avant ce
      // mécanisme — plus seulement quand il y a une fiche média à supprimer.
      if (media || visibleFallback) {
        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'gestion-link-button';
        removeButton.textContent = 'Retirer la photo';
        removeButton.addEventListener('click', () => removeSlotMedia(slot.slotKey));
        actions.appendChild(removeButton);
      }

      // Réafficher : seulement si on vient de masquer une photo déjà en
      // ligne qui, elle, existe toujours (le fallback n'a pas disparu,
      // juste été masqué) — pas de bouton si rien ne reviendrait.
      if (isHidden && fallbackEntry) {
        const unhideButton = document.createElement('button');
        unhideButton.type = 'button';
        unhideButton.className = 'gestion-link-button';
        unhideButton.textContent = 'Réafficher la photo d’origine';
        unhideButton.addEventListener('click', () => unhideSlot(slot.slotKey));
        actions.appendChild(unhideButton);
      }

      row.appendChild(actions);

      currentGroup.appendChild(row);
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
    await fetchHiddenSlotKeys();
    renderSlotsList();
  };

  // Vérifie les droits puis rend un média public (bucket l5d2lm-public-media)
  // s'il ne l'est pas déjà — précondition commune à tout affichage sur le
  // site public (Emplacements comme Cartes postales). Lève une erreur si la
  // photo est marquée "Ne pas publier" ; demande confirmation si "À
  // vérifier" (renvoie false sans rien faire si l'admin annule).
  const ensureMediaPublished = async (media) => {
    if (media.rights_status === 'do_not_publish') {
      throw new Error('Cette photo est marquée "Ne pas publier" : changez ses droits avant de la publier sur le site.');
    }
    if (media.rights_status === 'needs_review') {
      const confirmed = window.confirm('Les droits de cette photo sont encore "À vérifier". La publier quand même ?');
      if (!confirmed) return false;
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
    return true;
  };

  // Assigne une photo (déjà rendue publique par ensureMediaPublished) à
  // l'emplacement — remplace toute photo précédemment assignée à ce même
  // emplacement (un emplacement = une photo à la fois).
  const publishMediaForSlot = async (mediaId, slotKey) => {
    const media = mediaState.library.get(mediaId);
    if (!media) throw new Error('Photo introuvable dans la médiathèque.');

    const proceed = await ensureMediaPublished(media);
    if (proceed === false) return;
    const supabase = getSupabase();

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

    // Choisir une photo lève tout masquage précédent sur cet emplacement
    // (sinon la photo tout juste choisie resterait invisible au prochain
    // build — voir build/build.py, render_slot).
    if (mediaState.hiddenSlotKeys.has(slotKey)) {
      await supabase.from('l5d2lm_media_slot_overrides').delete().eq('slot_key', slotKey);
      mediaState.hiddenSlotKeys.delete(slotKey);
    }

    mediaState.slotAssignments.set(slotKey, media);
    renderSlotsList();

    // Déclenchement immédiat plutôt que d'attendre le prochain passage
    // programmé (toutes les 3h, un simple filet de sécurité) : silencieux
    // tant que la fonction Edge "trigger-publish" n'est pas configurée,
    // pour ne pas inquiéter avec une erreur avant que ce soit fait.
    const published = await triggerPublishNow({ silent: true });
    setStatus(
      published
        ? 'Photo publiée pour cet emplacement — publication du site en cours.'
        : 'Photo publiée pour cet emplacement — le site public se mettra à jour automatiquement (sous 3h maximum).',
      'success'
    );
  };

  // Retire la photo d'un emplacement sans la remplacer : l'emplacement
  // redevient vide ("Photo à venir" ou rien, selon le format — voir
  // build/build.py) plutôt que de forcer un remplacement immédiat.
  // Fonctionne aussi bien pour une photo gérée depuis Gestion que pour une
  // photo déjà en ligne avant ce mécanisme (fallback — voir
  // l5d2lm_media_slot_overrides) : dans les deux cas, l'emplacement doit
  // réellement devenir vide, jamais retomber sur une ancienne photo que
  // l'admin n'a pas choisie.
  const removeSlotMedia = async (slotKey) => {
    const supabase = getSupabase();
    const { error: usageError } = await supabase.from('l5d2lm_media_usages').delete().eq('slot_key', slotKey);
    if (usageError) { setStatus(usageError.message || 'Impossible de retirer la photo.', 'error'); return; }

    const { error: overrideError } = await supabase
      .from('l5d2lm_media_slot_overrides')
      .upsert({ slot_key: slotKey, hidden: true }, { onConflict: 'slot_key' });
    if (overrideError) { setStatus(overrideError.message || 'Impossible de retirer la photo.', 'error'); return; }

    mediaState.slotAssignments.delete(slotKey);
    mediaState.hiddenSlotKeys.add(slotKey);
    renderSlotsList();

    const published = await triggerPublishNow({ silent: true });
    setStatus(
      published
        ? 'Photo retirée de cet emplacement — publication du site en cours.'
        : 'Photo retirée de cet emplacement — le site public se mettra à jour automatiquement (sous 3h maximum).',
      'success'
    );
  };

  // Réaffiche une photo d'origine précédemment masquée (voir
  // removeSlotMedia) — n'a de sens que pour un fallback toujours présent
  // dans le dépôt, jamais pour une photo gérée (supprimée, pas masquable).
  const unhideSlot = async (slotKey) => {
    const supabase = getSupabase();
    const { error } = await supabase.from('l5d2lm_media_slot_overrides').delete().eq('slot_key', slotKey);
    if (error) { setStatus(error.message || 'Impossible de réafficher la photo.', 'error'); return; }

    mediaState.hiddenSlotKeys.delete(slotKey);
    renderSlotsList();

    const published = await triggerPublishNow({ silent: true });
    setStatus(
      published
        ? 'Photo d’origine réaffichée — publication du site en cours.'
        : 'Photo d’origine réaffichée — le site public se mettra à jour automatiquement (sous 3h maximum).',
      'success'
    );
  };

  // Déclenche le workflow GitHub Actions tout de suite plutôt que d'attendre
  // son prochain passage programmé : appelle une fonction Edge Supabase qui
  // détient le jeton GitHub nécessaire (jamais exposé côté navigateur).
  // Nécessite que cette fonction ("trigger-publish", voir
  // supabase/functions/trigger-publish/index.ts) soit déployée — sinon
  // échoue silencieusement en mode { silent: true } (ex. juste après
  // avoir publié une photo, avant que l'admin ait configuré la fonction).
  const triggerPublishNow = async ({ silent = false } = {}) => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.functions.invoke('trigger-publish');
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return true;
    } catch (error) {
      if (!silent) throw error;
      return false;
    }
  };

  // Cartes postales (rotation aléatoire par catégorie) : contrairement à
  // Emplacements (une photo fixe par slot_key), plusieurs photos peuvent
  // partager le même (section_id, role='postcard') — un vrai pool, piocher
  // aléatoirement côté navigateur public (voir l5d2lm-script.js) quand la
  // catégorie a l5d2lm_postcard_configs.enabled = true. Désactivée par
  // défaut : la catégorie garde alors son affichage Emplacements actuel.
  const fetchPostcardConfigs = async (sectionIds) => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('l5d2lm_postcard_configs')
      .select('section_id, enabled, visible_count')
      .in('section_id', sectionIds);
    if (error) throw error;
    mediaState.postcardConfigs = new Map((data || []).map((row) => [row.section_id, row]));
  };

  const fetchPostcardPools = async (sectionIds) => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('l5d2lm_media_usages')
      .select('id, media_id, section_id, sort_order, annotation_override')
      .eq('role', 'postcard')
      .eq('active', true)
      .is('deleted_at', null)
      .in('section_id', sectionIds)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    mediaState.postcardPoolBySection = new Map();
    (data || []).forEach((row) => {
      const list = mediaState.postcardPoolBySection.get(row.section_id) || [];
      list.push(row);
      mediaState.postcardPoolBySection.set(row.section_id, list);
    });
  };

  // Écrit la configuration d'une catégorie ; rotation_mode reste toujours
  // "random" (seul mode demandé, pas de sélecteur admin) et preload_count
  // se déduit automatiquement de la taille du pool plutôt que d'être un
  // champ à comprendre et remplir.
  const syncPostcardConfig = async (sectionId, overrides) => {
    const supabase = getSupabase();
    const current = mediaState.postcardConfigs.get(sectionId) || { enabled: false, visible_count: 3 };
    const poolSize = (mediaState.postcardPoolBySection.get(sectionId) || []).length;
    const next = {
      section_id: sectionId,
      enabled: overrides.enabled !== undefined ? overrides.enabled : current.enabled,
      visible_count: overrides.visible_count !== undefined ? overrides.visible_count : (current.visible_count || 3),
      rotation_mode: 'random',
      preload_count: Math.min(poolSize, 24)
    };
    const { error } = await supabase.from('l5d2lm_postcard_configs').upsert(next, { onConflict: 'section_id' });
    if (error) throw error;
    mediaState.postcardConfigs.set(sectionId, next);
  };

  const togglePostcardRotation = async (sectionId, enabled) => {
    try {
      await syncPostcardConfig(sectionId, { enabled });
      renderPostcardsList();
      const published = await triggerPublishNow({ silent: true });
      setStatus(
        `${enabled ? 'Rotation activée' : 'Rotation désactivée'} — ` +
        (published ? 'publication du site en cours.' : 'le site public se mettra à jour automatiquement (sous 3h maximum).'),
        'success'
      );
    } catch (error) {
      setStatus(error.message || 'Impossible de modifier la configuration.', 'error');
    }
  };

  const addPostcardPoolItem = async (sectionId, mediaId) => {
    const media = mediaState.library.get(mediaId);
    if (!media) throw new Error('Photo introuvable dans la médiathèque.');

    const pool = mediaState.postcardPoolBySection.get(sectionId) || [];
    // Une même photo ne doit jamais pouvoir apparaître deux fois en même
    // temps sur le site : refuser ici plutôt que de compter uniquement sur
    // le filtrage de secours côté site public.
    if (pool.some((item) => item.media_id === mediaId)) {
      setStatus('Cette photo est déjà dans le pool de cette carte postale.', 'error');
      return;
    }

    const proceed = await ensureMediaPublished(media);
    if (proceed === false) return;

    const supabase = getSupabase();
    const maxOrder = pool.reduce((max, item) => Math.max(max, item.sort_order), -10);
    const { data, error } = await supabase
      .from('l5d2lm_media_usages')
      .insert({ media_id: mediaId, section_id: sectionId, role: 'postcard', active: true, sort_order: maxOrder + 10 })
      .select('id, media_id, section_id, sort_order, annotation_override')
      .single();
    if (error) { setStatus(error.message || 'Impossible d’ajouter cette photo.', 'error'); return; }

    pool.push(data);
    mediaState.postcardPoolBySection.set(sectionId, pool);
    await syncPostcardConfig(sectionId, {});
    renderPostcardsList();
    setStatus('Photo ajoutée à la carte postale.', 'success');
  };

  const removePostcardPoolItem = async (sectionId, usageId) => {
    const supabase = getSupabase();
    const { error } = await supabase.from('l5d2lm_media_usages').delete().eq('id', usageId);
    if (error) { setStatus(error.message || 'Impossible de retirer cette photo.', 'error'); return; }

    const pool = (mediaState.postcardPoolBySection.get(sectionId) || []).filter((item) => item.id !== usageId);
    mediaState.postcardPoolBySection.set(sectionId, pool);
    await syncPostcardConfig(sectionId, {});
    renderPostcardsList();
  };

  const movePostcardPoolItem = async (sectionId, index, direction) => {
    const pool = mediaState.postcardPoolBySection.get(sectionId) || [];
    const current = pool[index];
    const target = pool[index + direction];
    if (!current || !target) return;
    const supabase = getSupabase();
    try {
      const a = current.sort_order;
      const b = target.sort_order;
      const { error: error1 } = await supabase.from('l5d2lm_media_usages').update({ sort_order: b }).eq('id', current.id);
      if (error1) throw error1;
      const { error: error2 } = await supabase.from('l5d2lm_media_usages').update({ sort_order: a }).eq('id', target.id);
      if (error2) throw error2;
      current.sort_order = b;
      target.sort_order = a;
      pool.sort((x, y) => x.sort_order - y.sort_order);
      mediaState.postcardPoolBySection.set(sectionId, pool);
      renderPostcardsList();
    } catch (error) {
      setStatus(error.message || 'Impossible de réordonner.', 'error');
    }
  };

  const savePostcardAnnotation = async (usageId, sectionId, value) => {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('l5d2lm_media_usages')
      .update({ annotation_override: value || null })
      .eq('id', usageId);
    if (error) { setStatus(error.message || 'Impossible d’enregistrer l’annotation.', 'error'); return; }
    const pool = mediaState.postcardPoolBySection.get(sectionId) || [];
    const item = pool.find((entry) => entry.id === usageId);
    if (item) item.annotation_override = value || null;
    setStatus('Annotation enregistrée.', 'success');
  };

  const renderPostcardPoolList = (container, sectionId, pool) => {
    container.innerHTML = '';
    pool.forEach((item, index) => {
      const media = mediaState.library.get(item.media_id);
      const row = document.createElement('div');
      row.className = 'postcard-pool-item';

      const thumb = document.createElement('div');
      thumb.className = 'postcard-pool-item__thumb';
      if (media) {
        const img = document.createElement('img');
        img.alt = '';
        img.loading = 'lazy';
        attachMediaImage(img, media);
        thumb.appendChild(img);
      }
      row.appendChild(thumb);

      const annotationInput = document.createElement('input');
      annotationInput.type = 'text';
      annotationInput.className = 'postcard-pool-item__annotation';
      annotationInput.placeholder = 'Annotation (visible au survol sur le site)';
      annotationInput.value = item.annotation_override || media?.default_annotation || '';
      annotationInput.addEventListener('blur', () => {
        if (annotationInput.value.length > ANNOTATION_WARNING_LENGTH) {
          setStatus(`Annotation longue (${annotationInput.value.length} caractères) : risque de déborder sur une vraie carte postale.`, 'error');
        }
        savePostcardAnnotation(item.id, sectionId, annotationInput.value.trim());
      });
      row.appendChild(annotationInput);

      const upButton = document.createElement('button');
      upButton.type = 'button';
      upButton.className = 'btn';
      upButton.textContent = '↑';
      upButton.disabled = index === 0;
      upButton.addEventListener('click', () => movePostcardPoolItem(sectionId, index, -1));
      row.appendChild(upButton);

      const downButton = document.createElement('button');
      downButton.type = 'button';
      downButton.className = 'btn';
      downButton.textContent = '↓';
      downButton.disabled = index === pool.length - 1;
      downButton.addEventListener('click', () => movePostcardPoolItem(sectionId, index, 1));
      row.appendChild(downButton);

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'btn';
      removeButton.textContent = 'Retirer';
      removeButton.addEventListener('click', () => removePostcardPoolItem(sectionId, item.id));
      row.appendChild(removeButton);

      container.appendChild(row);
    });

    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'btn';
    addButton.textContent = '+ Ajouter une photo';
    addButton.addEventListener('click', () => openMediaPicker('postcard', { sectionId }));
    container.appendChild(addButton);
  };

  const renderPostcardsList = () => {
    if (!postcardsListEl) return;
    postcardsListEl.innerHTML = '';

    POSTCARD_ELIGIBLE_SECTION_SLUGS.forEach((slug) => {
      const section = sectionsState.items.find((item) => item.slug === slug);
      if (!section) return; // catégorie pas encore créée ("Créer les 6 catégories du site")

      const config = mediaState.postcardConfigs.get(section.id) || { enabled: false, visible_count: POSTCARD_DEFAULT_VISIBLE_COUNT[slug] || 3 };
      const pool = mediaState.postcardPoolBySection.get(section.id) || [];

      const card = document.createElement('article');
      card.className = 'postcard-config';

      const header = document.createElement('div');
      header.className = 'postcard-config__header';
      const title = document.createElement('h3');
      title.textContent = section.title;
      header.appendChild(title);

      const toggleButton = document.createElement('button');
      toggleButton.type = 'button';
      toggleButton.className = config.enabled ? 'btn btn-primary' : 'btn';
      toggleButton.textContent = config.enabled ? 'Désactiver la rotation' : 'Activer la rotation';
      toggleButton.addEventListener('click', () => togglePostcardRotation(section.id, !config.enabled));
      header.appendChild(toggleButton);
      card.appendChild(header);

      const status = document.createElement('p');
      status.className = 'gestion-hint';
      status.textContent = config.enabled
        ? `Rotation active : ${pool.length} photo(s) dans le pool, ${config.visible_count || 1} affichée(s) à la fois, tirage aléatoire à chaque visite.`
        : 'Désactivée : cette catégorie garde ses cartes postales fixes actuelles (voir Emplacements).';
      card.appendChild(status);

      const visibleLabel = document.createElement('label');
      visibleLabel.className = 'postcard-config__visible-count';
      visibleLabel.append('Nombre affiché en même temps : ');
      const visibleInput = document.createElement('input');
      visibleInput.type = 'number';
      visibleInput.min = '1';
      visibleInput.max = '12';
      visibleInput.value = String(config.visible_count || POSTCARD_DEFAULT_VISIBLE_COUNT[slug] || 3);
      visibleInput.addEventListener('change', () => {
        const value = Math.max(1, Math.min(12, parseInt(visibleInput.value, 10) || 1));
        visibleInput.value = String(value);
        syncPostcardConfig(section.id, { visible_count: value }).then(renderPostcardsList);
      });
      visibleLabel.appendChild(visibleInput);
      card.appendChild(visibleLabel);

      const poolWrap = document.createElement('div');
      poolWrap.className = 'postcard-pool';
      renderPostcardPoolList(poolWrap, section.id, pool);
      card.appendChild(poolWrap);

      postcardsListEl.appendChild(card);
    });

    if (!postcardsListEl.children.length) {
      const empty = document.createElement('p');
      empty.textContent = 'Créez d’abord les catégories du site (Site > Structure > "Créer les 6 catégories du site").';
      postcardsListEl.appendChild(empty);
    }
  };

  const loadPostcardsPanel = async () => {
    if (!postcardsListEl) return;
    const sectionIds = POSTCARD_ELIGIBLE_SECTION_SLUGS
      .map((slug) => findSectionIdBySlug(slug))
      .filter(Boolean);
    if (!sectionIds.length) {
      renderPostcardsList();
      return;
    }
    try {
      await fetchPostcardConfigs(sectionIds);
      await fetchPostcardPools(sectionIds);
    } catch (error) {
      setStatus(error.message || 'Impossible de charger les cartes postales.', 'error');
    }
    renderPostcardsList();
  };

  // Textes (Site > Textes) --------------------------------------------
  //
  // Même grammaire restreinte que build/texts.py (render_lead/render_body) :
  // **gras**, *italique*, [texte](url), "- item" pour une liste, ligne
  // vide = nouveau paragraphe, "**Libellé :** texte" = ligne de repère,
  // "> texte" = phrase d'accent. Ce miroir JS ne sert QUE pour l'aperçu
  // local dans /gestion — la seule publication qui compte reste calculée
  // côté build.py à partir du texte brut enregistré en base.
  const escapeHtml = (text) => String(text ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

  const isSafeTextUrl = (url) => {
    url = String(url || '').trim();
    if (!url) return false;
    if (/^(https?:\/\/|mailto:|tel:|#|\/)/.test(url)) return true;
    const prefix = url.split(/[/?]/)[0];
    return !prefix.includes(':');
  };

  const renderInlineText = (escaped) => {
    let text = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) =>
      isSafeTextUrl(url) ? `<a href="${escapeHtml(url)}">${label}</a>` : label);
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
    return text;
  };

  const renderLeadText = (text) => renderInlineText(escapeHtml(text || '')).replace(/\n/g, '<br>');

  const renderBodyText = (text) => {
    text = String(text || '').trim();
    if (!text) return '';
    const blocks = text.split(/\n\s*\n/);
    return blocks.map((block) => {
      const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
      if (!lines.length) return '';
      if (lines.every((line) => /^-\s+/.test(line))) {
        return `<ul class="check-list">${lines.map((line) => `<li>${renderInlineText(escapeHtml(line.replace(/^-\s+/, '')))}</li>`).join('')}</ul>`;
      }
      if (lines.every((line) => /^\d+\.\s+/.test(line))) {
        return `<ol>${lines.map((line) => `<li>${renderInlineText(escapeHtml(line.replace(/^\d+\.\s+/, '')))}</li>`).join('')}</ol>`;
      }
      if (lines.every((line) => /^\*\*[^*]+[ \u00a0]:\*\*/.test(line))) {
        return lines.map((line) => `<p class="service-meta">${renderInlineText(escapeHtml(line))}</p>`).join('\n');
      }
      if (lines.length === 1 && lines[0].startsWith('> ')) {
        return `<p class="service-emphasis">${renderInlineText(escapeHtml(lines[0].slice(2)))}</p>`;
      }
      return `<p>${lines.map((line) => renderInlineText(escapeHtml(line))).join('<br>')}</p>`;
    }).filter(Boolean).join('\n');
  };

  const textPageNavEl = document.querySelector('[data-text-page-nav]');
  const textBlocksListEl = document.querySelector('[data-text-blocks-list]');
  const textEditorEl = document.querySelector('[data-text-editor]');
  const textEditorFieldsEl = document.querySelector('[data-text-editor-fields]');
  const textEditorTitleEl = document.querySelector('[data-text-editor-title]');
  const textEditorStatusEl = document.querySelector('[data-text-editor-status]');
  const textEditorHistoryEl = document.querySelector('[data-text-editor-history]');
  const textEditorHistoryListEl = document.querySelector('[data-text-editor-history-list]');
  const textPreviewOverlayEl = document.querySelector('[data-text-preview-overlay]');
  const textPreviewIframeEl = document.querySelector('[data-text-preview-iframe]');

  const textState = {
    selectedPage: 'l5d2lm-massage', // page ouverte par défaut à l'arrivée sur l'onglet
    blocksByKey: new Map(),
    openBlock: null,
    editorInputs: {},
    previewMode: 'desktop'
  };

  const textBlockStateKey = (page, blockKey) => `${page}::${blockKey}`;

  const fetchTextBlocksForPages = async (pageSlugs) => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('l5d2lm_text_blocks')
      .select('id, page_slug, block_key, title, eyebrow, lead, body, button_label, button_url, status, published_at, updated_at, deleted_at')
      .in('page_slug', pageSlugs);
    if (error) throw error;
    textState.blocksByKey = new Map();
    (data || []).forEach((row) => {
      const key = textBlockStateKey(row.page_slug, row.block_key);
      const bucket = textState.blocksByKey.get(key) || { draft: null, published: null, hidden: null, archived: [] };
      if (row.deleted_at) {
        bucket.archived.push(row);
      } else if (row.status === 'draft') {
        bucket.draft = row;
      } else if (row.status === 'published') {
        bucket.published = row;
      } else if (row.status === 'hidden') {
        bucket.hidden = row;
      }
      textState.blocksByKey.set(key, bucket);
    });
    textState.blocksByKey.forEach((bucket) => {
      bucket.archived.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
    });
  };

  const textBlockStatus = (page, blockKey) => {
    const bucket = textState.blocksByKey.get(textBlockStateKey(page, blockKey));
    if (!bucket) return { label: 'Texte d’origine', cssClass: '' };
    if (bucket.hidden) return { label: 'Masqué', cssClass: 'is-hidden' };
    if (bucket.published && bucket.draft) return { label: 'Modifications non publiées', cssClass: 'is-pending' };
    if (bucket.published) return { label: 'Publié', cssClass: 'is-published' };
    if (bucket.draft) return { label: 'Brouillon', cssClass: 'is-draft' };
    return { label: 'Texte d’origine', cssClass: '' };
  };

  const textBlockCurrentValues = (block) => {
    const bucket = textState.blocksByKey.get(textBlockStateKey(block.page, block.blockKey));
    const row = bucket?.draft || bucket?.published || bucket?.hidden || null;
    const values = {};
    block.fields.forEach((field) => {
      if (field === 'button') {
        values.button_label = row?.button_label ?? block.defaults.button_label ?? '';
        values.button_url = row?.button_url ?? block.defaults.button_url ?? '';
      } else {
        values[field] = row?.[field] ?? block.defaults[field] ?? '';
      }
    });
    return values;
  };

  const textBlockSnippet = (block) => {
    const values = textBlockCurrentValues(block);
    const snippet = values.title || values.eyebrow || values.lead || (values.body || '').split('\n')[0] || '';
    return snippet.length > 110 ? `${snippet.slice(0, 110)}…` : snippet;
  };

  const renderTextPageNav = () => {
    if (!textPageNavEl) return;
    textPageNavEl.innerHTML = '';
    [...TEXT_PAGES, ...TEXT_PAGES_SECONDARY].forEach((page) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = page.slug === textState.selectedPage ? 'gestion-tab is-active' : 'gestion-tab';
      button.textContent = page.label;
      button.addEventListener('click', () => {
        textState.selectedPage = page.slug;
        renderTextPageNav();
        renderTextBlocksList();
      });
      textPageNavEl.appendChild(button);
    });
  };

  const renderTextBlocksList = () => {
    if (!textBlocksListEl) return;
    textBlocksListEl.innerHTML = '';
    closeTextEditor();

    const pages = textState.selectedPage ? [textState.selectedPage] : TEXT_PAGES.filter((p) => p.slug).map((p) => p.slug);
    let anyBlock = false;
    pages.forEach((pageSlug) => {
      const blocks = TEXT_BLOCKS.filter((b) => b.page === pageSlug);
      if (!blocks.length) return;
      anyBlock = true;
      if (!textState.selectedPage) {
        const heading = document.createElement('h3');
        heading.className = 'text-blocks-group-heading';
        heading.textContent = TEXT_PAGES.find((p) => p.slug === pageSlug)?.label || pageSlug;
        textBlocksListEl.appendChild(heading);
      }
      blocks.forEach((block) => {
        const row = document.createElement('div');
        row.className = 'text-block-item';

        const body = document.createElement('div');
        body.className = 'text-block-item__body';
        const title = document.createElement('strong');
        title.textContent = block.label;
        body.appendChild(title);
        const snippet = document.createElement('p');
        snippet.className = 'text-block-item__snippet';
        snippet.textContent = textBlockSnippet(block);
        body.appendChild(snippet);
        row.appendChild(body);

        const actions = document.createElement('div');
        actions.className = 'text-block-item__actions';
        const status = textBlockStatus(block.page, block.blockKey);
        const badge = document.createElement('span');
        badge.className = `text-status-badge ${status.cssClass}`;
        badge.textContent = status.label;
        actions.appendChild(badge);

        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.className = 'btn';
        editButton.textContent = 'Modifier';
        editButton.addEventListener('click', () => openTextEditor(block));
        actions.appendChild(editButton);
        row.appendChild(actions);
        row.dataset.blockRow = textBlockStateKey(block.page, block.blockKey);

        textBlocksListEl.appendChild(row);
      });
    });

    if (!anyBlock) {
      const soon = document.createElement('p');
      soon.className = 'gestion-soon';
      soon.textContent = 'Bientôt disponible : édition des textes de cette page.';
      textBlocksListEl.appendChild(soon);
    }
  };

  const buildFormattingToolbar = (textarea) => {
    const toolbar = document.createElement('div');
    toolbar.className = 'text-editor__toolbar';
    const insert = (before, after = '') => {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = textarea.value.slice(start, end) || 'texte';
      textarea.value = `${textarea.value.slice(0, start)}${before}${selected}${after}${textarea.value.slice(end)}`;
      textarea.focus();
      textarea.selectionStart = start + before.length;
      textarea.selectionEnd = start + before.length + selected.length;
    };
    const addButton = (label, title, handler) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.title = title;
      button.textContent = label;
      button.addEventListener('click', handler);
      toolbar.appendChild(button);
    };
    addButton('Gras', 'Gras', () => insert('**', '**'));
    addButton('Italique', 'Italique', () => insert('*', '*'));
    addButton('Lien', 'Insérer un lien', () => {
      const url = window.prompt('Lien (https://... ou une page du site, ex. l5d2lm-contact.html)');
      if (url) insert('[', `](${url})`);
    });
    addButton('Liste', 'Liste à puces', () => {
      const start = textarea.selectionStart;
      const before = textarea.value.slice(0, start);
      const needsNewline = before.length && !before.endsWith('\n');
      insert(`${needsNewline ? '\n' : ''}- `, '');
    });
    addButton('Repère', 'Ligne de repère : libellé en gras suivi du texte (ex. Durée : 30 min)', () => {
      const start = textarea.selectionStart;
      const before = textarea.value.slice(0, start);
      const needsNewline = before.length && !before.endsWith('\n');
      insert(`${needsNewline ? '\n' : ''}**Libellé :** `, '');
    });
    addButton('Mise en avant', 'Phrase mise en avant (seule sur sa ligne)', () => {
      const start = textarea.selectionStart;
      const before = textarea.value.slice(0, start);
      const needsNewline = before.length && !before.endsWith('\n');
      insert(`${needsNewline ? '\n' : ''}> `, '');
    });
    return toolbar;
  };

  const renderTextHistory = (block) => {
    const bucket = textState.blocksByKey.get(textBlockStateKey(block.page, block.blockKey));
    const archived = bucket?.archived || [];
    if (!textEditorHistoryEl || !textEditorHistoryListEl) return;
    if (!archived.length) {
      textEditorHistoryEl.hidden = true;
      return;
    }
    textEditorHistoryEl.hidden = false;
    textEditorHistoryListEl.innerHTML = '';
    archived.forEach((row) => {
      const item = document.createElement('div');
      item.className = 'text-history-item';
      const date = document.createElement('span');
      const when = row.published_at || row.updated_at;
      date.textContent = when ? new Date(when).toLocaleString('fr-CH') : 'Date inconnue';
      item.appendChild(date);
      const restoreButton = document.createElement('button');
      restoreButton.type = 'button';
      restoreButton.className = 'btn';
      restoreButton.textContent = 'Restaurer en brouillon';
      restoreButton.addEventListener('click', () => restoreTextVersion(block, row));
      item.appendChild(restoreButton);
      textEditorHistoryListEl.appendChild(item);
    });
  };

  const textEditorHome = textEditorEl?.parentElement || null;

  const setEditorFeedback = (message, kind = '') => {
    const el = document.querySelector('[data-text-editor-feedback]');
    if (!el) return;
    el.textContent = message;
    el.className = `text-editor__feedback${kind ? ` is-${kind}` : ''}`;
  };

  const openTextEditor = (block) => {
    textState.openBlock = block;
    textState.editorInputs = {};
    textState.dirty = false;
    const values = textBlockCurrentValues(block);

    if (textEditorTitleEl) textEditorTitleEl.textContent = block.label;
    const status = textBlockStatus(block.page, block.blockKey);
    if (textEditorStatusEl) {
      textEditorStatusEl.textContent = status.label;
      textEditorStatusEl.className = `text-status-badge ${status.cssClass}`;
    }

    textEditorFieldsEl.innerHTML = '';

    const addGroup = (label, fields, open) => {
      if (!fields.length) return;
      const details = document.createElement('details');
      details.className = 'text-editor__accordion';
      details.open = open;
      const summary = document.createElement('summary');
      summary.textContent = label;
      details.appendChild(summary);
      fields.forEach((field) => {
        const wrap = document.createElement('label');
        wrap.className = 'text-editor__field';
        const span = document.createElement('span');
        span.textContent = FIELD_LABELS[field];
        wrap.appendChild(span);
        let input;
        if (field === 'body') {
          input = document.createElement('textarea');
          input.rows = 8;
          input.value = values.body || '';
          wrap.appendChild(buildFormattingToolbar(input));
        } else if (field === 'lead') {
          input = document.createElement('textarea');
          input.rows = 3;
          input.value = values.lead || '';
        } else {
          input = document.createElement('input');
          input.type = 'text';
          input.value = values[field] || '';
        }
        input.addEventListener('input', () => {
          if (textState.dirty) return;
          textState.dirty = true;
          setEditorFeedback('Modifications non enregistrées', 'dirty');
        });
        wrap.appendChild(input);
        textState.editorInputs[field] = input;
        details.appendChild(wrap);
      });
      textEditorFieldsEl.appendChild(details);
    };

    addGroup('Essentiel', block.fields.filter((f) => f === 'eyebrow' || f === 'title'), true);
    addGroup('Texte principal', block.fields.filter((f) => f === 'lead' || f === 'body'), true);

    if (block.fields.includes('button')) {
      const details = document.createElement('details');
      details.className = 'text-editor__accordion';
      details.open = true;
      const summary = document.createElement('summary');
      summary.textContent = 'Bouton et lien';
      details.appendChild(summary);

      const labelWrap = document.createElement('label');
      labelWrap.className = 'text-editor__field';
      const labelSpan = document.createElement('span');
      labelSpan.textContent = FIELD_LABELS.button_label;
      labelWrap.appendChild(labelSpan);
      const labelInput = document.createElement('input');
      labelInput.type = 'text';
      labelInput.value = values.button_label || '';
      labelWrap.appendChild(labelInput);
      textState.editorInputs.button_label = labelInput;
      details.appendChild(labelWrap);

      const urlWrap = document.createElement('label');
      urlWrap.className = 'text-editor__field';
      const urlSpan = document.createElement('span');
      urlSpan.textContent = FIELD_LABELS.button_url;
      urlWrap.appendChild(urlSpan);
      const urlInput = document.createElement('input');
      urlInput.type = 'text';
      urlInput.value = values.button_url || '';
      urlWrap.appendChild(urlInput);
      textState.editorInputs.button_url = urlInput;
      details.appendChild(urlWrap);

      textEditorFieldsEl.appendChild(details);
    }

    renderTextHistory(block);
    setEditorFeedback('', '');

    const row = textBlocksListEl?.querySelector(`[data-block-row="${CSS.escape(textBlockStateKey(block.page, block.blockKey))}"]`);
    if (row && textEditorEl) row.after(textEditorEl);
    textEditorEl.hidden = false;
    textEditorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const closeTextEditor = () => {
    textState.openBlock = null;
    textState.editorInputs = {};
    if (textEditorEl) {
      if (textEditorHome && textEditorEl.parentElement !== textEditorHome) textEditorHome.appendChild(textEditorEl);
      textEditorEl.hidden = true;
    }
  };

  const collectEditorValues = (block) => {
    const row = {};
    block.fields.forEach((field) => {
      if (field === 'button') {
        row.button_label = textState.editorInputs.button_label?.value.trim() || null;
        row.button_url = textState.editorInputs.button_url?.value.trim() || null;
      } else {
        row[field] = textState.editorInputs[field]?.value.trim() || null;
      }
    });
    return row;
  };

  const ALL_TEXT_PAGE_SLUGS = [...new Set(TEXT_BLOCKS.map((b) => b.page))];

  const saveTextDraft = async () => {
    const block = textState.openBlock;
    if (!block) return;
    const values = collectEditorValues(block);
    if (values.button_url && !isSafeTextUrl(values.button_url)) {
      setStatus('Lien de bouton invalide : utilisez http(s)://, mailto:, tel:, # ou un chemin relatif.', 'error');
      return;
    }
    const supabase = getSupabase();
    const bucket = textState.blocksByKey.get(textBlockStateKey(block.page, block.blockKey));
    setEditorFeedback('Enregistrement en cours…', 'saving');
    try {
      if (bucket?.draft) {
        const { error } = await supabase.from('l5d2lm_text_blocks').update(values).eq('id', bucket.draft.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('l5d2lm_text_blocks').insert({
          page_slug: block.page, block_key: block.blockKey, status: 'draft', ...values
        });
        if (error) throw error;
      }
      await fetchTextBlocksForPages(ALL_TEXT_PAGE_SLUGS);
      renderTextBlocksList();
      openTextEditor(block);
      setEditorFeedback('Enregistré en brouillon — le site public n’est pas encore modifié.', 'success');
      setStatus('Brouillon enregistré.', 'success');
    } catch (error) {
      setEditorFeedback(`Erreur : ${error.message || 'enregistrement impossible'}`, 'error');
      setStatus(error.message || 'Impossible d’enregistrer le brouillon.', 'error');
    }
  };

  const publishTextBlock = async () => {
    const block = textState.openBlock;
    if (!block) return;
    const values = collectEditorValues(block);
    if (values.button_url && !isSafeTextUrl(values.button_url)) {
      setStatus('Lien de bouton invalide : utilisez http(s)://, mailto:, tel:, # ou un chemin relatif.', 'error');
      return;
    }
    const supabase = getSupabase();
    const bucket = textState.blocksByKey.get(textBlockStateKey(block.page, block.blockKey));
    try {
      // Archive l'ancienne version publiée (jamais supprimée) avant de
      // publier la nouvelle : c'est ce qui alimente l'historique.
      if (bucket?.published) {
        const { error } = await supabase.from('l5d2lm_text_blocks')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', bucket.published.id);
        if (error) throw error;
      }
      if (bucket?.draft) {
        const { error } = await supabase.from('l5d2lm_text_blocks')
          .update({ ...values, status: 'published', published_at: new Date().toISOString() })
          .eq('id', bucket.draft.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('l5d2lm_text_blocks').insert({
          page_slug: block.page, block_key: block.blockKey, status: 'published',
          published_at: new Date().toISOString(), ...values
        });
        if (error) throw error;
      }
      await fetchTextBlocksForPages(ALL_TEXT_PAGE_SLUGS);
      renderTextBlocksList();
      closeTextEditor();
      const published = await triggerPublishNow({ silent: true });
      setStatus(
        published
          ? 'Texte publié — publication du site en cours.'
          : 'Texte publié — le site public se mettra à jour automatiquement (sous 3h maximum).',
        'success'
      );
    } catch (error) {
      setStatus(error.message || 'Impossible de publier ce texte.', 'error');
    }
  };

  const restoreTextVersion = async (block, archivedRow) => {
    const supabase = getSupabase();
    const bucket = textState.blocksByKey.get(textBlockStateKey(block.page, block.blockKey));
    const values = {};
    block.fields.forEach((field) => {
      if (field === 'button') {
        values.button_label = archivedRow.button_label;
        values.button_url = archivedRow.button_url;
      } else {
        values[field] = archivedRow[field];
      }
    });
    try {
      if (bucket?.draft) {
        const { error } = await supabase.from('l5d2lm_text_blocks').update(values).eq('id', bucket.draft.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('l5d2lm_text_blocks').insert({
          page_slug: block.page, block_key: block.blockKey, status: 'draft', ...values
        });
        if (error) throw error;
      }
      await fetchTextBlocksForPages(ALL_TEXT_PAGE_SLUGS);
      renderTextBlocksList();
      openTextEditor(block);
      setStatus('Version restaurée en brouillon — vérifiez l’aperçu avant de publier.', 'success');
    } catch (error) {
      setStatus(error.message || 'Impossible de restaurer cette version.', 'error');
    }
  };

  // Aperçu : charge la vraie page publique dans une iframe (même origine
  // que /gestion, donc accès direct au DOM), puis remplace le contenu
  // entre les commentaires <!-- TEXT:block:field --> / <!-- /TEXT -->
  // laissés par build.py — réutilise à 100% la mise en page/CSS/responsive
  // réels du site, sans réimplémenter de second moteur de rendu. Le
  // brouillon n'est jamais publié par cet aperçu : il ne touche que le DOM
  // local de l'iframe.
  const PAGE_URL_BY_SLUG = {
    'l5d2lm-index': '../l5d2lm-index.html',
    'l5d2lm-massage': '../l5d2lm-massage.html',
    'l5d2lm-corps-expression': '../l5d2lm-corps-expression.html',
    'l5d2lm-colos-sejours': '../l5d2lm-colos-sejours.html',
    'l5d2lm-animations-participatives': '../l5d2lm-animations-participatives.html',
    'l5d2lm-espaces-a-decouvrir': '../l5d2lm-espaces-a-decouvrir.html',
    'l5d2lm-contact': '../l5d2lm-contact.html',
    'l5d2lm-mentions-legales': '../l5d2lm-mentions-legales.html',
    // Pied de page partagé : identique sur toutes les pages, l'accueil
    // suffit à en donner un aperçu représentatif.
    __commun__: '../l5d2lm-index.html'
  };

  const findCommentMarkers = (doc, openText, closeText) => {
    const walker = document.createTreeWalker(doc, NodeFilter.SHOW_COMMENT);
    let openNode = null;
    let closeNode = null;
    let node = walker.nextNode();
    while (node) {
      if (!openNode && node.data.trim() === openText) {
        openNode = node;
      } else if (openNode && !closeNode && node.data.trim() === closeText) {
        closeNode = node;
        break;
      }
      node = walker.nextNode();
    }
    return openNode && closeNode ? { openNode, closeNode } : null;
  };

  const patchPreviewField = (doc, blockKey, field, htmlFragment) => {
    const range = findCommentMarkers(doc, `TEXT:${blockKey}:${field}`, '/TEXT');
    if (!range) return;
    let node = range.openNode.nextSibling;
    while (node && node !== range.closeNode) {
      const next = node.nextSibling;
      node.remove();
      node = next;
    }
    const wrapper = doc.createElement('div');
    wrapper.innerHTML = htmlFragment;
    Array.from(wrapper.childNodes).forEach((child) => {
      range.closeNode.parentNode.insertBefore(child, range.closeNode);
    });
  };

  const patchPreviewButton = (doc, blockKey, label, url) => {
    const range = findCommentMarkers(doc, `TEXT:${blockKey}:button`, '/TEXT');
    if (!range) return;
    // Le <a> se trouve entre les deux marqueurs (nœud frère), pas un enfant.
    let node = range.openNode.nextSibling;
    let existingAnchor = null;
    while (node && node !== range.closeNode) {
      if (node.nodeType === 1 && node.tagName === 'A') { existingAnchor = node; break; }
      node = node.nextSibling;
    }
    if (!existingAnchor || !url || !isSafeTextUrl(url)) return;
    existingAnchor.textContent = label || existingAnchor.textContent;
    existingAnchor.setAttribute('href', url);
  };

  const applyPreviewToIframe = (doc, block, values) => {
    block.fields.forEach((field) => {
      if (field === 'button') {
        patchPreviewButton(doc, block.blockKey, values.button_label, values.button_url);
        return;
      }
      if (!values[field]) return;
      const html = field === 'body' ? renderBodyText(values[field]) : renderLeadText(values[field]);
      patchPreviewField(doc, block.blockKey, field, field === 'title' || field === 'eyebrow' ? escapeHtml(values[field]) : html);
    });
  };

  const openTextPreview = () => {
    const block = textState.openBlock;
    if (!block) return;
    const url = PAGE_URL_BY_SLUG[block.page];
    if (!url || !textPreviewOverlayEl || !textPreviewIframeEl) {
      setStatus('Aperçu indisponible pour cette page.', 'error');
      return;
    }
    const values = collectEditorValues(block);
    textPreviewOverlayEl.hidden = false;
    setTextPreviewMode(textState.previewMode);
    textPreviewIframeEl.onload = () => {
      try {
        applyPreviewToIframe(textPreviewIframeEl.contentDocument, block, values);
      } catch (error) {
        setStatus('Impossible de générer l’aperçu.', 'error');
      }
    };
    textPreviewIframeEl.src = `${url}?preview=${Date.now()}`;
  };

  const closeTextPreview = () => {
    if (!textPreviewOverlayEl) return;
    textPreviewOverlayEl.hidden = true;
    if (textPreviewIframeEl) textPreviewIframeEl.src = 'about:blank';
  };

  const setTextPreviewMode = (mode) => {
    textState.previewMode = mode;
    if (!textPreviewOverlayEl) return;
    textPreviewOverlayEl.querySelectorAll('[data-text-preview-mode]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.textPreviewMode === mode);
    });
    textPreviewOverlayEl.classList.toggle('is-mobile', mode === 'mobile');
  };

  if (textEditorFieldsEl) {
    document.querySelector('[data-text-editor-close]')?.addEventListener('click', closeTextEditor);
    document.querySelector('[data-text-cancel]')?.addEventListener('click', closeTextEditor);
    document.querySelector('[data-text-save-draft]')?.addEventListener('click', saveTextDraft);
    document.querySelector('[data-text-publish]')?.addEventListener('click', publishTextBlock);
    document.querySelector('[data-text-preview]')?.addEventListener('click', openTextPreview);
    document.querySelector('[data-text-preview-close]')?.addEventListener('click', closeTextPreview);
    textPreviewOverlayEl?.querySelectorAll('[data-text-preview-mode]').forEach((button) => {
      button.addEventListener('click', () => setTextPreviewMode(button.dataset.textPreviewMode));
    });
  }

  const loadTextsPanel = async () => {
    if (!textBlocksListEl) return;
    try {
      await fetchTextBlocksForPages(ALL_TEXT_PAGE_SLUGS);
    } catch (error) {
      setStatus(error.message || 'Impossible de charger les textes.', 'error');
    }
    renderTextPageNav();
    renderTextBlocksList();
  };

  document.querySelectorAll('[data-publish-now]').forEach((publishNowButton) => {
    publishNowButton.addEventListener('click', async () => {
      setBusy(publishNowButton, true);
      setStatus('Déclenchement de la publication...');
      try {
        await triggerPublishNow();
        setStatus('Publication déclenchée — le site public sera à jour dans une à deux minutes.', 'success');
      } catch (error) {
        setStatus(error.message || 'Impossible de déclencher la publication.', 'error');
      } finally {
        setBusy(publishNowButton, false);
      }
    });
  });

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

  // Édition individuelle d'une photo déjà importée : titre, annotation et
  // catégories, en plein écran (pas un tiroir dans la carte) avec
  // Précédente/Suivante pour enchaîner plusieurs photos sans revenir à la
  // grille à chaque fois.
  // overrideList : utilisé juste après un import (voir handleImportSelection)
  // pour n'enchaîner Précédente/Suivante que sur les photos qui viennent
  // d'être importées, plutôt que sur toute la grille actuellement affichée.
  const openMediaEditOverlay = (info, overrideList) => {
    if (!mediaEditOverlay) return;
    if (overrideList && overrideList.length) {
      mediaState.editList = overrideList;
      mediaState.editIndex = Math.max(0, overrideList.findIndex((entry) => entry.id === info.id));
    } else {
      // Même ensemble que la grille actuellement affichée (filtres/recherche
      // compris), pour que Précédente/Suivante corresponde à ce qui est visible.
      mediaState.editList = visibleMedia()
        .filter((item) => isItemImported(item))
        .map((item) => mediaState.importedByFilename.get(item.filename))
        .filter(Boolean);
      mediaState.editIndex = mediaState.editList.findIndex((entry) => entry.id === info.id);
      if (mediaState.editIndex === -1) {
        mediaState.editList = [info];
        mediaState.editIndex = 0;
      }
    }
    mediaEditOverlay.hidden = false;
    renderMediaEditOverlay();
  };

  const closeMediaEditOverlay = () => {
    if (!mediaEditOverlay) return;
    mediaEditOverlay.hidden = true;
    mediaState.editList = [];
    mediaState.editIndex = -1;
  };

  const renderMediaEditOverlay = () => {
    const info = mediaState.editList[mediaState.editIndex];
    if (!info) { closeMediaEditOverlay(); return; }

    if (mediaEditPosition) mediaEditPosition.textContent = `${mediaState.editIndex + 1} / ${mediaState.editList.length}`;
    if (mediaEditPrevButton) mediaEditPrevButton.disabled = mediaState.editIndex === 0;
    if (mediaEditNextButton) mediaEditNextButton.disabled = mediaState.editIndex === mediaState.editList.length - 1;

    if (mediaEditPhoto) {
      mediaEditPhoto.innerHTML = '';
      const img = document.createElement('img');
      img.alt = info.alt_text || '';
      img.style.objectPosition = `${(info.focal_x ?? 0.5) * 100}% ${(info.focal_y ?? 0.5) * 100}%`;
      attachMediaImage(img, info);
      mediaEditPhoto.appendChild(img);
    }

    if (mediaEditTitleInput) mediaEditTitleInput.value = info.default_annotation || '';
    if (mediaEditAnnotationInput) mediaEditAnnotationInput.value = info.alt_text || '';

    if (mediaEditCategories) {
      mediaEditCategories.innerHTML = '';
      const assigned = mediaState.mediaSections.get(info.id) || new Map();
      if (!sectionsState.items.length) {
        mediaEditCategories.textContent = 'Aucune catégorie créée pour l’instant.';
      } else {
        sectionsState.items.forEach((section) => {
          const label = document.createElement('label');
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.value = section.id;
          input.checked = assigned.has(section.id);
          label.appendChild(input);
          label.appendChild(document.createTextNode(section.title));
          mediaEditCategories.appendChild(label);
        });
      }
    }
  };

  const goToMediaEditIndex = (nextIndex) => {
    if (nextIndex < 0 || nextIndex >= mediaState.editList.length) return;
    mediaState.editIndex = nextIndex;
    renderMediaEditOverlay();
  };

  if (mediaEditPrevButton) mediaEditPrevButton.addEventListener('click', () => goToMediaEditIndex(mediaState.editIndex - 1));
  if (mediaEditNextButton) mediaEditNextButton.addEventListener('click', () => goToMediaEditIndex(mediaState.editIndex + 1));
  if (mediaEditCloseButton) mediaEditCloseButton.addEventListener('click', closeMediaEditOverlay);
  if (mediaEditCancelButton) mediaEditCancelButton.addEventListener('click', closeMediaEditOverlay);
  if (mediaEditSaveButton) {
    mediaEditSaveButton.addEventListener('click', async () => {
      const info = mediaState.editList[mediaState.editIndex];
      if (!info) return;
      const checkedSectionIds = mediaEditCategories
        ? Array.from(mediaEditCategories.querySelectorAll('input:checked')).map((el) => el.value)
        : [];
      await saveMediaEdit(info, mediaEditTitleInput.value.trim(), mediaEditAnnotationInput.value.trim(), checkedSectionIds);
      renderMediaEditOverlay();
    });
  }

  const saveMediaEdit = async (info, title, annotation, checkedSectionIds) => {
    const supabase = getSupabase();
    try {
      const { error: titleError } = await supabase
        .from('l5d2lm_media')
        .update({ default_annotation: title || null, alt_text: annotation || null })
        .eq('id', info.id);
      if (titleError) throw titleError;
      info.default_annotation = title || null;
      info.alt_text = annotation || null;

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
    // Uniquement les photos envoyées depuis l'appareil (pas une migration
    // en masse du catalogue historique) : ce sont celles où l'admin a
    // vraiment besoin de saisir titre/catégories tout de suite.
    const newlyUploadedRows = [];

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
              upload_batch_id: batch.id,
              // Titre/annotation saisis sur la carte avant import (voir
              // renderMediaGrid) — null si laissés vides, comme avant.
              default_annotation: item.kind === 'upload' && item.title ? item.title.trim() : null,
              alt_text: item.kind === 'upload' && item.annotation ? item.annotation.trim() : null
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
                if (item.kind === 'upload') newlyUploadedRows.push(existingRow);
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
            newlyUploadedRows.push(insertedRow);
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

      // Photo(s) envoyée(s) depuis l'appareil : autant saisir titre et
      // catégories tout de suite plutôt que devoir rouvrir chaque carte
      // séparément ensuite.
      if (newlyUploadedRows.length) {
        openMediaEditOverlay(newlyUploadedRows[0], newlyUploadedRows);
      }

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
    // Déclenchement immédiat comme pour les emplacements photo : silencieux
    // tant que la fonction Edge "trigger-publish" n'est pas configurée.
    const published = await triggerPublishNow({ silent: true });
    setStatus(
      published
        ? `« ${section.title} » : ${CATEGORY_STATUS_LABEL[status] || status} — publication du site en cours.`
        : `« ${section.title} » : ${CATEGORY_STATUS_LABEL[status] || status} — le site public se mettra à jour automatiquement (sous 3h maximum).`,
      'success'
    );
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
    // Cartes postales dépend des catégories (section_id par slug) : sans ce
    // rechargement, le panneau resterait affiché comme si aucune catégorie
    // n'existait jusqu'au prochain rechargement complet de la page.
    await loadPostcardsPanel();
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
