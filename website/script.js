'use strict';

const demos = Object.freeze({
  files: { command:'Open my Downloads folder', response:'Opening your Downloads folder.', window:'File Explorer', title:'Downloads', rows:[['Documents','Folder'],['Projects','Folder'],['Resources','Folder']] },
  search: { command:'Search YouTube for Python DSA', response:'Sending the search to your browser.', window:'Browser', title:'Python DSA', rows:[['YouTube search','Browser handoff'],['Python tutorials','Example'],['Data structures','Example']] },
  app: { command:'Open Calculator', response:'Requesting Windows Calculator.', window:'Calculator', title:'Calculator', rows:[['Application','Windows'],['Launch','Requested'],['Outcome','Illustrative']] },
  volume: { command:'Set volume to 45%', response:'Adjusting system volume to 45%.', window:'Windows audio', title:'Sound settings', rows:[['System volume','45%'],['Output device','Speakers'],['Action','Illustrative']] }
});
const tabs = Array.from(document.querySelectorAll('.demo-tab'));
function chooseDemo(tab) {
  const demo = demos[tab.dataset.demo];
  if (!demo) return;
  for (const other of tabs) {
    other.classList.toggle('active', other === tab);
    other.setAttribute('aria-pressed', String(other === tab));
  }
  document.getElementById('demo-command').textContent = demo.command;
  document.getElementById('demo-response').textContent = demo.response;
  document.getElementById('demo-window-title').textContent = demo.window;
  document.getElementById('demo-work-title').textContent = demo.title;
  const rows = document.getElementById('demo-work-rows');
  rows.replaceChildren(...demo.rows.map(([label, detail]) => {
    const row = document.createElement('div');
    const marker = document.createElement('i');
    const title = document.createElement('span');
    const description = document.createElement('small');
    title.textContent = label;
    description.textContent = detail;
    row.append(marker, title, description);
    return row;
  }));
  const bubble = document.getElementById('demo-bubble');
  bubble.classList.remove('bubble-enter');
  void bubble.offsetWidth;
  bubble.classList.add('bubble-enter');
}
for (const tab of tabs) tab.addEventListener('click', () => chooseDemo(tab));

const characters = Array.from(document.querySelectorAll('.character-option'));
const allowedCharacters = new Set(['sparky','pixel','mochi','cloudie','kiko','boba']);
function chooseCharacter(button) {
  const { character, name, role, description, number } = button.dataset;
  if (!allowedCharacters.has(character)) return;
  for (const other of characters) {
    other.classList.toggle('selected', other === button);
    other.setAttribute('aria-pressed', String(other === button));
  }
  const source = 'assets/' + character + '.svg';
  const preview = document.getElementById('character-preview');
  const hero = document.getElementById('demo-character');
  preview.src = source;
  preview.alt = name + ' — ' + role;
  hero.src = source;
  hero.alt = name + ', ' + role;
  const portrait = document.getElementById('hero-portrait');
  portrait.src = source;
  portrait.alt = name + ' — ' + role;
  document.getElementById('hero-character-name').textContent = name.toUpperCase();
  document.getElementById('hero-character-role').textContent = role;
  document.getElementById('hero-character-number').textContent = number;
  document.getElementById('character-name').textContent = name;
  document.getElementById('character-role').textContent = role;
  document.getElementById('character-description').textContent = description;
  document.getElementById('character-number').textContent = number;
  document.getElementById('character-announcement').textContent = name + ' selected for website preview.';
}
for (const button of characters) button.addEventListener('click', () => chooseCharacter(button));

const toggle = document.querySelector('.menu-toggle');
const mobileNav = document.querySelector('.mobile-nav');
if (toggle && mobileNav) {
  function setMenuOpen(open, restoreFocus = false) {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    mobileNav.hidden = !open;
    if (restoreFocus) toggle.focus();
  }
  toggle.addEventListener('click', () => setMenuOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  mobileNav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenuOpen(false)));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !mobileNav.hidden) setMenuOpen(false, true);
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 760 && !mobileNav.hidden) setMenuOpen(false);
  });
}
const year = document.getElementById('year');
if (year) year.textContent = String(new Date().getFullYear());
