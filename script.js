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

  const currentFile = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.site-nav a').forEach((link) => {
    if (link.getAttribute('href') === currentFile) {
      link.setAttribute('aria-current', 'page');
    }
  });

  document.querySelectorAll('.page-logo').forEach((img) => {
    img.addEventListener('error', () => {
      img.hidden = true;
      const fallback = img.nextElementSibling;
      if (fallback) fallback.hidden = false;
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

  const form = document.querySelector('[data-contact-form]');
  if (form) {
    const requestedType = new URLSearchParams(window.location.search).get('type');
    const typeField = form.querySelector('#type');
    if (requestedType && typeField) {
      const matchingOption = Array.from(typeField.options).find((option) => option.text === requestedType);
      if (matchingOption) typeField.value = matchingOption.value;
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const status = form.querySelector('[role="status"]');
      const data = new FormData(form);
      const name = String(data.get('name') || '').trim();
      const email = String(data.get('email') || '').trim();
      const phone = String(data.get('phone') || '').trim();

      if (!email && !phone) {
        if (status) {
          status.textContent = 'Indique au moins un email ou un téléphone pour que je puisse te répondre.';
        }
        const emailField = form.querySelector('#email');
        if (emailField) emailField.focus();
        return;
      }

      const requestType = String(data.get('type') || 'Autre demande').trim();
      const subject = `Demande — ${requestType}${name ? ` — ${name}` : ''}`;
      const body = [
        `Nom : ${name}`,
        `Email : ${email}`,
        `Téléphone : ${phone}`,
        `Type de demande : ${requestType}`,
        `Lieu ou région : ${String(data.get('location') || '').trim()}`,
        `Date ou période : ${String(data.get('date') || '').trim()}`,
        `Nombre de personnes : ${String(data.get('people') || '').trim()}`,
        '',
        'Message :',
        String(data.get('message') || '').trim()
      ].join('\n');

      if (status) {
        status.textContent = 'Un email va s’ouvrir avec les infos indiquées. Il restera à confirmer son envoi.';
      }

      window.location.href = `mailto:l5d2lm@ik.me?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    });
  }
});
