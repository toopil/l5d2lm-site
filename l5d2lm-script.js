document.documentElement.classList.add('js-reveal');

document.addEventListener('DOMContentLoaded', () => {
  // Garde la ponctuation française avec le mot qui la précède,
  // même lorsque la largeur de la fenêtre change.
  const protectFrenchPunctuation = (root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest('script, style, textarea, input, select, option, pre, code')) {
          return NodeFilter.FILTER_REJECT;
        }

        return /(?:[ \t]+[?!:;»]|«[ \t]+)/.test(node.nodeValue)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP;
      }
    });

    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    textNodes.forEach((node) => {
      node.nodeValue = node.nodeValue
        .replace(/[ \t]+([?!:;»])/g, '\u00a0$1')
        .replace(/«[ \t]+/g, '«\u00a0');
    });
  };

  protectFrenchPunctuation(document.body);

  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.site-nav');

  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });

    nav.addEventListener('click', (event) => {
      if (event.target.closest('a')) {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  const currentFile = location.pathname.split('/').pop() || 'l5d2lm-index.html';
  document.querySelectorAll('.site-nav a').forEach((link) => {
    if (link.getAttribute('href') === currentFile) {
      link.setAttribute('aria-current', 'page');
    }
  });

  document.querySelectorAll('.page-logo').forEach((img) => {
    img.addEventListener('error', () => {
      img.hidden = true;
      let fallback = img.nextElementSibling;
      if (!fallback || !fallback.classList.contains('logo-fallback')) {
        fallback = document.createElement('div');
        fallback.className = 'logo-fallback';
        fallback.innerHTML = 'Les 5 doigts<br>de la main';
        img.after(fallback);
      }
      fallback.hidden = false;
    });
  });

  const items = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    items.forEach((item) => item.classList.add('visible'));
  } else {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    items.forEach((item) => observer.observe(item));
  }

  const requestSpaces = {
    massage: {
      label: 'Massage',
      description: 'Prendre soin du corps de différentes manières.',
      offers: {
        'massage-intuitif': {
          label: 'Massage intuitif',
          duration: '30 à 90 minutes',
          fields: ['location', 'date', 'message']
        },
        'reveil-energetique': {
          label: 'Réveil énergétique',
          duration: 'Environ 3 minutes par personne',
          fields: ['location', 'date', 'people', 'message']
        },
        'massage-aquatique': {
          label: 'Massage aquatique',
          duration: '45 à 90 minutes',
          fields: ['location', 'date', 'message']
        },
        'transmission-reveil-energetique': {
          label: 'Transmission du Réveil énergétique',
          note: 'Transmission collective',
          fields: ['location', 'date', 'people', 'message']
        }
      }
    },
    'corps-expression': {
      label: 'Corps & expression',
      description: 'Mouvement, jeu, danse et expression.',
      offers: {
        'playful-extatique': {
          label: 'Playful extatique',
          fields: ['location', 'date', 'people', 'message']
        },
        'theatre-improvisation': {
          label: 'Théâtre d’improvisation',
          fields: ['location', 'date', 'people', 'message']
        },
        'reveil-du-corps': {
          label: 'Réveil du corps',
          fields: ['location', 'date', 'people', 'message']
        },
        'jeux-de-mouvement': {
          label: 'Jeux de mouvement',
          fields: ['location', 'date', 'people', 'message']
        },
        'a-portee-de-main': {
          label: 'À portée de main',
          fields: ['location', 'date', 'people', 'message'],
          intents: {
            'prochaines-dates': 'Être informé des prochaines dates',
            'lieu-partenariat': 'Proposer un lieu ou un partenariat'
          }
        }
      }
    },
    'colo-pour-adultes': {
      label: 'Colo pour adultes',
      description: 'Séjours et expériences collectives.',
      offers: {
        'colo-pour-adultes': {
          label: 'Colo pour adultes',
          note: 'À partir de 15 adultes',
          fields: ['location', 'date', 'people', 'message']
        }
      }
    },
    'animations-participatives': {
      label: 'Animations participatives',
      description: 'Créer du lien dans votre événement ou votre lieu.',
      offers: {
        'animation-participative': {
          label: 'Animation participative',
          duration: 'De 30 minutes à 4 heures',
          fields: ['location', 'date', 'people', 'message']
        }
      }
    },
    'espaces-a-decouvrir': {
      label: 'Espaces à découvrir',
      description: 'Proposer ou faire connaître une initiative.',
      offers: {
        'proposer-un-lieu': {
          label: 'Proposer un lieu / une initiative',
          fields: ['location', 'message']
        }
      }
    },
    autre: {
      label: 'Autre',
      description: 'Pour votre demande si elle ne correspond pas aux catégories précédentes.',
      offers: {
        'autre-demande': {
          label: 'Autre demande',
          fields: ['location', 'date', 'people', 'message']
        }
      }
    }
  };

  const legacyRequestMap = {
    'Massage intuitif': { category: 'massage', offer: 'massage-intuitif' },
    'Massage aquatique': { category: 'massage', offer: 'massage-aquatique' },
    'Réveil énergétique': { category: 'massage', offer: 'reveil-energetique' },
    'Formation réveil énergétique': { category: 'massage', offer: 'transmission-reveil-energetique' },
    'Corps & expression': { category: 'corps-expression' },
    'À portée de main — prochaines dates': {
      category: 'corps-expression',
      offer: 'a-portee-de-main',
      intent: 'prochaines-dates'
    },
    'À portée de main — lieu ou partenariat': {
      category: 'corps-expression',
      offer: 'a-portee-de-main',
      intent: 'lieu-partenariat'
    },
    'Playful extatique': { category: 'corps-expression', offer: 'playful-extatique' },
    'Théâtre d’improvisation': { category: 'corps-expression', offer: 'theatre-improvisation' },
    'Réveil du corps': { category: 'corps-expression', offer: 'reveil-du-corps' },
    'Jeux de mouvement': { category: 'corps-expression', offer: 'jeux-de-mouvement' },
    'Colo pour adultes': { category: 'colo-pour-adultes', offer: 'colo-pour-adultes' },
    'Animation participative': { category: 'animations-participatives', offer: 'animation-participative' },
    'Espace à découvrir': { category: 'espaces-a-decouvrir', offer: 'proposer-un-lieu' },
    'Autre demande': { category: 'autre', offer: 'autre-demande' }
  };

  const fieldConfig = {
    location: {
      label: 'Lieu ou région',
      type: 'text',
      autocomplete: 'address-level2'
    },
    date: {
      label: 'Date ou période envisagée',
      type: 'text'
    },
    people: {
      label: 'Nombre de personnes',
      type: 'number',
      min: '1'
    },
    message: {
      label: 'Message libre',
      type: 'textarea',
      optional: true
    }
  };

  const requestState = {
    category: '',
    offer: '',
    intent: '',
    opened: false,
    collapsed: false,
    fields: {
      name: '',
      email: '',
      phone: '',
      location: '',
      date: '',
      people: '',
      message: ''
    }
  };

  let lastRequestTrigger = null;
  let panelShell = null;
  const contactRoot = document.querySelector('[data-request-contact-root]');

  const getSpace = () => requestSpaces[requestState.category] || null;
  const getOffer = () => {
    const space = getSpace();
    return space && requestState.offer ? space.offers[requestState.offer] : null;
  };
  const getIntentLabel = () => {
    const offer = getOffer();
    return offer && offer.intents && requestState.intent ? offer.intents[requestState.intent] : '';
  };
  const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
  const isSingleOffer = (space) => space && Object.keys(space.offers).length === 1;

  const normalizeSelection = (selection) => {
    const category = selection.category || '';
    const space = requestSpaces[category];
    if (!space) return {};

    const normalized = { category };
    if (selection.offer && space.offers[selection.offer]) {
      normalized.offer = selection.offer;
    }
    if (normalized.offer) {
      const offer = space.offers[normalized.offer];
      if (selection.intent && offer.intents && offer.intents[selection.intent]) {
        normalized.intent = selection.intent;
      }
    }

    return normalized;
  };

  const getSelectionFromParams = () => {
    const params = new URLSearchParams(window.location.search);
    const category = params.get('category');
    const offer = params.get('offer');
    const intent = params.get('intent');
    const normalized = normalizeSelection({ category, offer, intent });

    if (normalized.category) return normalized;

    const legacyType = params.get('type');
    if (legacyType && legacyRequestMap[legacyType]) {
      return normalizeSelection(legacyRequestMap[legacyType]);
    }

    return {};
  };

  const applySelection = (selection, options = {}) => {
    const normalized = normalizeSelection(selection);
    if (!normalized.category) return false;

    const categoryChanged = requestState.category !== normalized.category;
    requestState.category = normalized.category;

    if (Object.prototype.hasOwnProperty.call(normalized, 'offer')) {
      const offerChanged = requestState.offer !== normalized.offer;
      requestState.offer = normalized.offer || '';
      requestState.intent = offerChanged ? '' : requestState.intent;
    } else if (categoryChanged || options.resetOffer) {
      requestState.offer = '';
      requestState.intent = '';
    }

    if (Object.prototype.hasOwnProperty.call(normalized, 'intent')) {
      requestState.intent = normalized.intent || '';
    } else if (Object.prototype.hasOwnProperty.call(normalized, 'offer')) {
      const offer = getOffer();
      if (!offer || !offer.intents) requestState.intent = '';
    }

    return true;
  };

  const createPanel = () => {
    if (panelShell) return panelShell;

    panelShell = document.createElement('div');
    panelShell.className = 'request-panel-shell';
    panelShell.setAttribute('data-request-shell', '');
    panelShell.hidden = true;
    panelShell.innerHTML = `
      <button class="request-panel-tab" type="button" data-request-action="expand" aria-expanded="false">
        Demande en cours
      </button>
      <aside class="request-panel" aria-label="Demande en cours" role="complementary">
        <div data-request-panel-content></div>
      </aside>
    `;
    document.body.appendChild(panelShell);
    return panelShell;
  };

  const openPanel = () => {
    const shell = createPanel();
    requestState.opened = true;
    requestState.collapsed = false;
    shell.hidden = false;
    renderAllRequestSurfaces();

    const focusTarget = shell.querySelector('[data-request-panel-content] button, [data-request-panel-content] a, [data-request-panel-content] input, [data-request-panel-content] textarea');
    if (focusTarget) focusTarget.focus({ preventScroll: true });
  };

  const closePanel = () => {
    if (!panelShell) return;
    requestState.opened = false;
    requestState.collapsed = false;
    panelShell.hidden = true;
    renderAllRequestSurfaces();
    if (lastRequestTrigger && document.contains(lastRequestTrigger)) {
      lastRequestTrigger.focus({ preventScroll: true });
    }
  };

  const collapsePanel = () => {
    if (!panelShell) return;
    requestState.collapsed = true;
    renderAllRequestSurfaces();
  };

  const expandPanel = () => {
    if (!panelShell) return;
    requestState.opened = true;
    requestState.collapsed = false;
    panelShell.hidden = false;
    renderAllRequestSurfaces();
  };

  const updateContactUrl = () => {
    if (!contactRoot || !window.history || !window.history.replaceState) return;

    const params = new URLSearchParams();
    if (requestState.category) params.set('category', requestState.category);
    if (requestState.offer) params.set('offer', requestState.offer);
    if (requestState.intent) params.set('intent', requestState.intent);

    const nextUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
    window.history.replaceState({}, '', nextUrl);
  };

  const getRelevantFields = () => {
    const offer = getOffer();
    if (offer && Array.isArray(offer.fields)) return offer.fields;

    const space = getSpace();
    if (space && isSingleOffer(space)) {
      const singleOffer = space.offers[Object.keys(space.offers)[0]];
      return singleOffer.fields || ['location', 'date', 'message'];
    }

    return ['location', 'date', 'message'];
  };

  const renderChoiceButton = ({ action, category, offer, intent, title, description, meta }) => `
    <button class="request-choice" type="button"
      data-request-action="${action}"
      ${category ? `data-request-category="${escapeHtml(category)}"` : ''}
      ${offer ? `data-request-offer="${escapeHtml(offer)}"` : ''}
      ${intent ? `data-request-intent="${escapeHtml(intent)}"` : ''}>
      <span>${escapeHtml(title)}</span>
      ${meta ? `<small>${escapeHtml(meta)}</small>` : ''}
      ${description ? `<em>${escapeHtml(description)}</em>` : ''}
    </button>
  `;

  const renderSummary = () => {
    const space = getSpace();
    const offer = getOffer();
    const intentLabel = getIntentLabel();

    if (!space) {
      return '<p class="request-summary-empty">Un premier choix permet d’orienter votre demande.</p>';
    }

    return `
      <div class="request-summary">
        <p class="request-summary__label">Votre demande</p>
        <strong>${escapeHtml(space.label)}</strong>
        ${offer ? `<span>→ ${escapeHtml(offer.label)}</span>` : ''}
        ${intentLabel ? `<span>→ ${escapeHtml(intentLabel)}</span>` : ''}
        ${offer && offer.duration ? `<small>${escapeHtml(offer.duration)}</small>` : ''}
        ${offer && !offer.duration && offer.note ? `<small>${escapeHtml(offer.note)}</small>` : ''}
      </div>
    `;
  };

  const renderHeader = (surface) => {
    if (surface !== 'panel') return '';

    return `
      <div class="request-panel-header">
        <div>
          <p class="eyebrow">Demande</p>
          <h2>Votre demande</h2>
        </div>
        <div class="request-panel-controls">
          <button type="button" data-request-action="collapse" aria-label="Réduire le panneau">Réduire</button>
          <button type="button" data-request-action="close" aria-label="Fermer le panneau">Fermer</button>
        </div>
      </div>
    `;
  };

  const renderCategoryStep = () => {
    const choices = Object.entries(requestSpaces).map(([category, space]) => renderChoiceButton({
      action: 'select-category',
      category,
      title: space.label,
      description: space.description
    })).join('');

    return `
      <div class="request-step">
        <h3>Qu’est-ce qui vous amène&nbsp;?</h3>
        <div class="request-choice-grid">${choices}</div>
      </div>
    `;
  };

  const renderOfferStep = () => {
    const space = getSpace();
    if (!space) return renderCategoryStep();

    if (isSingleOffer(space)) {
      const offerKey = Object.keys(space.offers)[0];
      requestState.offer = offerKey;
      return renderFormStep();
    }

    const choices = Object.entries(space.offers).map(([offer, details]) => renderChoiceButton({
      action: 'select-offer',
      category: requestState.category,
      offer,
      title: details.label,
      meta: details.duration || details.note || ''
    })).join('');

    return `
      <div class="request-step">
        ${renderSummary()}
        <div class="request-backline">
          <button type="button" data-request-action="change-category">Modifier l’espace</button>
        </div>
        <h3>Quelle proposition vous intéresse&nbsp;?</h3>
        <div class="request-choice-grid">${choices}</div>
      </div>
    `;
  };

  const renderIntentStep = () => {
    const offer = getOffer();
    if (!offer || !offer.intents) return renderFormStep();

    const choices = Object.entries(offer.intents).map(([intent, label]) => renderChoiceButton({
      action: 'select-intent',
      category: requestState.category,
      offer: requestState.offer,
      intent,
      title: label
    })).join('');

    return `
      <div class="request-step">
        ${renderSummary()}
        <div class="request-backline">
          <button type="button" data-request-action="change-offer">Modifier la proposition</button>
        </div>
        <h3>Pour À portée de main, quelle intention&nbsp;?</h3>
        <div class="request-choice-grid">${choices}</div>
      </div>
    `;
  };

  const renderInputField = (field, surface) => {
    const id = `request-${surface}-${field}`;
    const value = requestState.fields[field] || '';

    if (field === 'message') {
      return `
        <div class="field-group full">
          <label for="${id}">${fieldConfig[field].label} <span class="optional-label">facultatif</span></label>
          <textarea id="${id}" data-request-field="${field}" rows="4">${escapeHtml(value)}</textarea>
        </div>
      `;
    }

    const config = fieldConfig[field];
    return `
      <div class="field-group">
        <label for="${id}">${config.label}</label>
        <input id="${id}" data-request-field="${field}" type="${config.type}" value="${escapeHtml(value)}"
          ${config.min ? `min="${config.min}"` : ''}
          ${config.autocomplete ? `autocomplete="${config.autocomplete}"` : ''}>
      </div>
    `;
  };

  const renderFormStep = (surface = 'panel') => {
    const space = getSpace();
    if (space && !requestState.offer && isSingleOffer(space)) {
      requestState.offer = Object.keys(space.offers)[0];
    }

    const offer = getOffer();
    const needsIntent = offer && offer.intents && !requestState.intent;

    if (!space) return renderCategoryStep();
    if (!offer && !isSingleOffer(space)) return renderOfferStep();
    if (needsIntent) return renderIntentStep();

    const relevantFields = getRelevantFields();
    const extraFields = relevantFields.map((field) => renderInputField(field, surface)).join('');
    const nameId = `request-${surface}-name`;
    const emailId = `request-${surface}-email`;
    const phoneId = `request-${surface}-phone`;

    return `
      <div class="request-step">
        ${renderSummary()}
        <div class="request-backline">
          <button type="button" data-request-action="change-offer">Modifier</button>
        </div>
        <form class="contact-form request-form" data-request-form>
          <div class="request-form-grid">
            <div class="field-group">
              <label for="${nameId}">Nom</label>
              <input id="${nameId}" data-request-field="name" type="text" autocomplete="name" value="${escapeHtml(requestState.fields.name)}">
            </div>
            <div class="field-group">
              <label for="${emailId}">Email</label>
              <input id="${emailId}" data-request-field="email" type="email" autocomplete="email" value="${escapeHtml(requestState.fields.email)}">
            </div>
            <div class="field-group">
              <label for="${phoneId}">Téléphone</label>
              <input id="${phoneId}" data-request-field="phone" type="tel" autocomplete="tel" value="${escapeHtml(requestState.fields.phone)}">
            </div>
            ${extraFields}
          </div>
          <button class="btn btn-primary" type="submit">Envoyer la demande</button>
          <p class="form-help">Un email ou un téléphone suffit pour recevoir une réponse.</p>
          <p class="form-status" role="status" aria-live="polite"></p>
        </form>
      </div>
    `;
  };

  const renderRequestSurface = (container, surface) => {
    const space = getSpace();
    const offer = getOffer();
    const needsIntent = offer && offer.intents && !requestState.intent;
    let content = renderCategoryStep();

    if (space && !offer && !isSingleOffer(space)) {
      content = renderOfferStep();
    } else if (space && needsIntent) {
      content = renderIntentStep();
    } else if (space) {
      content = renderFormStep(surface);
    }

    container.innerHTML = `${renderHeader(surface)}${content}`;
  };

  const updatePanelState = () => {
    if (!panelShell) return;

    const space = getSpace();
    const offer = getOffer();
    const tab = panelShell.querySelector('.request-panel-tab');
    const labelParts = ['Demande en cours'];
    if (space) labelParts.push(space.label);
    if (offer) labelParts.push(offer.label);

    panelShell.classList.toggle('is-open', requestState.opened);
    panelShell.classList.toggle('is-collapsed', requestState.collapsed);
    if (tab) {
      tab.textContent = labelParts.join(' — ');
      tab.setAttribute('aria-expanded', String(requestState.opened && !requestState.collapsed));
    }
  };

  const renderAllRequestSurfaces = () => {
    if (panelShell && requestState.opened) {
      const panelContent = panelShell.querySelector('[data-request-panel-content]');
      if (panelContent) renderRequestSurface(panelContent, 'panel');
      updatePanelState();
    }

    if (contactRoot) {
      renderRequestSurface(contactRoot, 'contact');
      updateContactUrl();
    }
  };

  const selectionFromTrigger = (trigger) => ({
    category: trigger.dataset.requestCategory || '',
    offer: trigger.dataset.requestOffer || '',
    intent: trigger.dataset.requestIntent || ''
  });

  const FORMCARRY_ENDPOINT = 'https://formcarry.com/s/NwuDa3bnZxj';

  const sendRequestMail = (form) => {
    const status = form.querySelector('[role="status"]');
    const name = requestState.fields.name.trim();
    const email = requestState.fields.email.trim();
    const phone = requestState.fields.phone.trim();
    const space = getSpace();
    const offer = getOffer();
    const intentLabel = getIntentLabel();

    if (!email && !phone) {
      if (status) {
        status.textContent = 'Indiquer au moins un email ou un téléphone pour recevoir une réponse.';
      }
      const emailField = form.querySelector('[data-request-field="email"]');
      if (emailField) emailField.focus();
      return;
    }

    const subjectParts = ['Demande'];
    if (space) subjectParts.push(space.label);
    if (offer) subjectParts.push(offer.label);
    if (name) subjectParts.push(name);

    const lines = [];
    if (space) lines.push(`Espace : ${space.label}`);
    if (offer) lines.push(`Proposition : ${offer.label}`);
    if (intentLabel) lines.push(`Intention : ${intentLabel}`);
    if (offer && offer.duration) lines.push(`Durée : ${offer.duration}`);
    if (offer && !offer.duration && offer.note) lines.push(`Repère : ${offer.note}`);
    if (name) lines.push(`Nom : ${name}`);
    if (email) lines.push(`Email : ${email}`);
    if (phone) lines.push(`Téléphone : ${phone}`);

    getRelevantFields().forEach((field) => {
      const value = requestState.fields[field].trim();
      if (!value) return;
      const label = fieldConfig[field].label.replace(' envisagée', '');
      lines.push(`${label} : ${value}`);
    });

    const subject = subjectParts.join(' — ');
    const body = lines.join('\n');

    const fallbackToMail = () => {
      if (status) {
        status.textContent = 'Un email va s’ouvrir avec les infos indiquées. Il restera à confirmer son envoi.';
      }
      window.location.href = `mailto:l5d2lm@ik.me?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    };

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    if (status) status.textContent = 'Envoi en cours…';

    fetch(FORMCARRY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ name, email, phone, sujet: subject, resume: body })
    })
      .then((response) => {
        if (!response.ok) throw new Error('formcarry-error');
        if (status) {
          status.textContent = 'Demande envoyée. Vous recevrez une réponse par email ou téléphone.';
        }
      })
      .catch(() => {
        fallbackToMail();
      })
      .finally(() => {
        if (submitButton) submitButton.disabled = false;
      });
  };

  const initialSelection = getSelectionFromParams();
  if (initialSelection.category) {
    applySelection(initialSelection);
  }
  if (contactRoot && !requestState.category) {
    requestState.category = '';
  }

  if (contactRoot) {
    renderAllRequestSurfaces();
  }

  document.addEventListener('click', (event) => {
    const requestLink = event.target.closest('a[data-request-category]');
    if (requestLink) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || requestLink.target === '_blank') return;

      event.preventDefault();
      lastRequestTrigger = requestLink;
      applySelection(selectionFromTrigger(requestLink), {
        resetOffer: !requestLink.dataset.requestOffer
      });
      openPanel();
      return;
    }

    const actionButton = event.target.closest('[data-request-action]');
    if (!actionButton) return;

    const action = actionButton.dataset.requestAction;

    if (action === 'close') {
      closePanel();
      return;
    }
    if (action === 'collapse') {
      collapsePanel();
      return;
    }
    if (action === 'expand') {
      expandPanel();
      return;
    }
    if (action === 'change-category') {
      requestState.category = '';
      requestState.offer = '';
      requestState.intent = '';
      renderAllRequestSurfaces();
      return;
    }
    if (action === 'change-offer') {
      const space = getSpace();
      if (space && isSingleOffer(space)) {
        requestState.category = '';
      }
      requestState.offer = '';
      requestState.intent = '';
      renderAllRequestSurfaces();
      return;
    }
    if (action === 'select-category') {
      applySelection(selectionFromTrigger(actionButton), { resetOffer: true });
      renderAllRequestSurfaces();
      return;
    }
    if (action === 'select-offer') {
      applySelection(selectionFromTrigger(actionButton));
      renderAllRequestSurfaces();
      return;
    }
    if (action === 'select-intent') {
      applySelection(selectionFromTrigger(actionButton));
      renderAllRequestSurfaces();
    }
  });

  document.addEventListener('input', (event) => {
    const field = event.target.closest('[data-request-field]');
    if (!field) return;

    requestState.fields[field.dataset.requestField] = field.value;
  });

  document.addEventListener('submit', (event) => {
    const form = event.target.closest('[data-request-form]');
    if (!form) return;

    event.preventDefault();
    sendRequestMail(form);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && requestState.opened && !requestState.collapsed) {
      collapsePanel();
    }
  });
});
