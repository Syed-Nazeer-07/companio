'use strict';

const demos = {
  files: { command: 'Open my Downloads folder', response: 'On it! Opening Downloads' },
  search: { command: 'Search YouTube for Python DSA', response: 'Searching in your browser' },
  app: { command: 'Open Calculator', response: 'Launching Calculator' },
};

for (const tab of document.querySelectorAll('.demo-tab')) {
  tab.addEventListener('click', () => {
    const demo = demos[tab.dataset.demo];
    if (!demo) return;
    for (const other of document.querySelectorAll('.demo-tab')) {
      const selected = other === tab;
      other.classList.toggle('active', selected);
      other.setAttribute('aria-pressed', String(selected));
    }
    document.getElementById('demo-command').textContent = demo.command;
    const bubble = document.getElementById('demo-bubble');
    bubble.replaceChildren(document.createTextNode(demo.response + ' '));
    const arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '↗';
    bubble.appendChild(arrow);
    bubble.classList.remove('bubble-enter');
    void bubble.offsetWidth;
    bubble.classList.add('bubble-enter');
  });
}

const toggle = document.querySelector('.menu-toggle');
const mobileNav = document.querySelector('.mobile-nav');
if (toggle && mobileNav) {
  function setMenuOpen(open) {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    mobileNav.hidden = !open;
    document.body.classList.toggle('menu-open', open);
  }
  toggle.addEventListener('click', () => setMenuOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  mobileNav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenuOpen(false)));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') setMenuOpen(false);
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 760) setMenuOpen(false);
  });
}

const year = document.getElementById('year');
if (year) year.textContent = String(new Date().getFullYear());
