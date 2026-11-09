import { state } from './state.js?v=7.5';
import { AION2_CUSTOM_EMOJIS, extractFlagIsoCode, getCustomEmojiEntry, normalizeEmojiCode } from './utils.js?v=7.5';

const TWEMOJI_BASE = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg';

// Skin tone options matching Discord's diversity picker
const SKIN_TONES = [
  { index: 0, code: '1f44f', native: '👏', label: 'Default Skin Tone' },
  { index: 1, code: '1f44f-1f3fb', native: '👏🏻', label: 'Light Skin Tone' },
  { index: 2, code: '1f44f-1f3fc', native: '👏🏼', label: 'Medium-Light Skin Tone' },
  { index: 3, code: '1f44f-1f3fd', native: '👏🏽', label: 'Medium Skin Tone' },
  { index: 4, code: '1f44f-1f3fe', native: '👏🏾', label: 'Medium-Dark Skin Tone' },
  { index: 5, code: '1f44f-1f3ff', native: '👏🏿', label: 'Dark Skin Tone' }
];

// Discord's exact category definitions & monochrome rail SVG icons
const DISCORD_CATEGORIES = [
  {
    id: 'recent',
    name: 'Frequently Used',
    svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm1 10.414V7a1 1 0 10-2 0v6a1 1 0 00.293.707l3.5 3.5a1 1 0 001.414-1.414L13 12.414z"/></svg>`
  },
  {
    id: 'people',
    name: 'People',
    svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-3.5 7a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm7 0a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm-3.5 8.5c-2.61 0-4.83-1.67-5.65-4h11.3c-.82 2.33-3.04 4-5.65 4z"/></svg>`
  },
  {
    id: 'nature',
    name: 'Nature',
    svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8z"/></svg>`
  },
  {
    id: 'foods',
    name: 'Food',
    svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.06 22.99h1.66c.84 0 1.53-.64 1.63-1.46L23 5.05h-5V1h-1.97v4.05h-4.97l.3 2.34c1.71.47 3.31 1.32 4.27 2.26 1.44 1.42 2.43 2.89 2.43 5.29v8.05zM1 21.99V21h15.03v.99c0 .55-.45 1-1.01 1H2.01c-.56 0-1.01-.45-1.01-1zm15.03-7c0-8-15.03-8-15.03 0h15.03zM1.02 17h15v2h-15z"/></svg>`
  },
  {
    id: 'activity',
    name: 'Activities',
    svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 3.3l2.8-.95a8.01 8.01 0 013.68 3.67l-.93 2.78L16 12l-2.55-1.8L12 7.5V5.3zm-4.8-.95L11 5.3v2.2L9.55 10.2 7 12l-2.55-1.2-.93-2.78A8.01 8.01 0 017.2 4.35zM5.08 16.5l1.42-2.5 2.5-.5 1.8 2.2v2.3l-2.45 1.37a8.03 8.03 0 01-3.27-2.87zm10.64 2.87L13.2 18v-2.3l1.8-2.2 2.5.5 1.42 2.5a8.03 8.03 0 01-3.2 2.87z"/></svg>`
  },
  {
    id: 'places',
    name: 'Travel',
    svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>`
  },
  {
    id: 'objects',
    name: 'Objects',
    svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z"/></svg>`
  },
  {
    id: 'symbols',
    name: 'Symbols',
    svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`
  },
  {
    id: 'flags',
    name: 'Flags',
    svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6h-5.6z"/></svg>`
  }
];

const DEFAULT_RECENT_IDS = [
  'shield', 'crossed_swords', 'bow_and_arrow', 'dagger', 'crystal_ball', 'cyclone',
  'medical_symbol', 'notes', 'flag-ph', 'flag-kr', 'flag-jp', 'flag-id', 'flag-th',
  'flag-tw', 'flag-sg', 'flag-my', 'flag-vn', 'flag-us', 'bell', 'rotating_light',
  'fire', 'sparkles', 'white_check_mark', 'video_game', 'computer', 'crown', 'trophy'
];

let emojiDataset = null;
let emojiLoadPromise = null;
let activeSelectionCallback = null;
let selectedSkinTone = Number(localStorage.getItem('maiev_emoji_skin') || 0);
let collapsedSections = new Set();
let recentEmojiIds = [];

try {
  const savedRecent = JSON.parse(localStorage.getItem('maiev_recent_emojis') || 'null');
  if (Array.isArray(savedRecent) && savedRecent.length > 0) {
    recentEmojiIds = savedRecent;
  } else {
    recentEmojiIds = [...DEFAULT_RECENT_IDS];
  }
} catch {
  recentEmojiIds = [...DEFAULT_RECENT_IDS];
}

export function getTwemojiUrl(unified) {
  if (!unified) return `${TWEMOJI_BASE}/1f600.svg`;
  const clean = unified.includes('200d') ? unified : unified.replace(/-fe0f/g, '');
  return `${TWEMOJI_BASE}/${clean}.svg`;
}

export function emojiToTwemojiUrl(emojiStr) {
  if (!emojiStr) return `${TWEMOJI_BASE}/1f600.svg`;
  const custom = getCustomEmojiEntry(emojiStr);
  if (custom) return custom.url;
  const codePoints = [];
  for (const symbol of emojiStr) {
    const cp = symbol.codePointAt(0);
    if (cp) codePoints.push(cp.toString(16));
  }
  const unified = codePoints.join('-');
  return getTwemojiUrl(unified);
}

async function ensureEmojiDataset() {
  if (emojiDataset) return emojiDataset;
  if (!emojiLoadPromise) {
    emojiLoadPromise = fetch('/js/discord-emoji-data.json')
      .then(r => r.json())
      .then(data => {
        emojiDataset = data;
        return data;
      })
      .catch(err => {
        console.error('Failed to load discord-emoji-data.json:', err);
        return null;
      });
  }
  return emojiLoadPromise;
}

export function setupDiscordEmojiPicker() {
  const triggerBtn = document.getElementById('btn-emoji-picker-trigger');
  const popover = document.getElementById('discord-emoji-popover');
  const hiddenInput = document.getElementById('new-nat-emoji');
  const selectedDisplay = document.getElementById('emoji-picker-selected-display');
  const selectedLabel = document.getElementById('emoji-picker-selected-label');
  if (selectedLabel) selectedLabel.remove();

  if (!triggerBtn || !popover) return;

  // Mount popover directly on document.body so it can float above any tab or modal
  if (popover.parentElement !== document.body) {
    document.body.appendChild(popover);
  }
  popover.style.position = 'fixed';
  popover.style.zIndex = '100000';

  // Build exact 1:1 Discord Emoji Picker Panel DOM inside #discord-emoji-popover
  const activeSkin = SKIN_TONES[selectedSkinTone] || SKIN_TONES[0];
  popover.innerHTML = `
    <div class="discord-ep-header">
      <div class="discord-ep-search-wrap">
        <input type="text" id="emoji-picker-search" placeholder="Find the perfect emoji" autocomplete="off" spellcheck="false">
        <button type="button" class="discord-ep-search-btn" id="emoji-picker-search-clear" title="Search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </button>
      </div>
      <div class="discord-ep-diversity-wrap" id="emoji-diversity-wrap">
        <button type="button" class="discord-ep-diversity-btn" id="btn-emoji-skin-tone" title="Select Skin Tone">
          <img src="${getTwemojiUrl(activeSkin.code)}" alt="${activeSkin.native}" id="emoji-skin-tone-current">
        </button>
        <div class="discord-ep-skin-menu hidden" id="emoji-skin-tone-menu"></div>
      </div>
    </div>
    <div class="discord-ep-body">
      <nav class="discord-ep-rail" id="emoji-picker-categories" aria-label="Emoji Categories"></nav>
      <div class="discord-ep-main">
        <div class="discord-ep-scroller" id="emoji-picker-grid"></div>
        <div class="discord-ep-inspector">
          <span class="discord-ep-inspector-icon" id="emoji-footer-icon">
            <img src="${TWEMOJI_BASE}/1f600.svg" alt="😀">
          </span>
          <div class="discord-ep-inspector-text">
            <strong id="emoji-footer-shortcode">:grinning:</strong>
            <span id="emoji-footer-label">People</span>
          </div>
        </div>
      </div>
    </div>
  `;

  // Upgrade default trigger preview to Twemoji SVG
  if (selectedDisplay && !hiddenInput?.value) {
    selectedDisplay.innerHTML = `<img src="${TWEMOJI_BASE}/1f600.svg" alt="😀" class="twemoji-inline">`;
  }

  const searchInput = document.getElementById('emoji-picker-search');
  const searchClearBtn = document.getElementById('emoji-picker-search-clear');
  const categoriesRail = document.getElementById('emoji-picker-categories');
  const gridScroller = document.getElementById('emoji-picker-grid');
  const footerIcon = document.getElementById('emoji-footer-icon');
  const footerShortcode = document.getElementById('emoji-footer-shortcode');
  const footerLabel = document.getElementById('emoji-footer-label');
  const skinToneBtn = document.getElementById('btn-emoji-skin-tone');
  const skinToneMenu = document.getElementById('emoji-skin-tone-menu');
  const skinToneImg = document.getElementById('emoji-skin-tone-current');

  // Preload dataset immediately in the background
  ensureEmojiDataset();

  function renderSkinToneMenu() {
    if (!skinToneMenu) return;
    skinToneMenu.innerHTML = '';
    SKIN_TONES.forEach(tone => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `discord-ep-skin-option ${tone.index === selectedSkinTone ? 'selected' : ''}`;
      btn.title = tone.label;
      btn.innerHTML = `<img src="${getTwemojiUrl(tone.code)}" alt="${tone.native}">`;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedSkinTone = tone.index;
        localStorage.setItem('maiev_emoji_skin', String(selectedSkinTone));
        if (skinToneImg) {
          skinToneImg.src = getTwemojiUrl(tone.code);
          skinToneImg.alt = tone.native;
        }
        skinToneMenu.classList.add('hidden');
        renderEmojiGrid(searchInput?.value || '');
      });
      skinToneMenu.appendChild(btn);
    });
  }

  skinToneBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    renderSkinToneMenu();
    skinToneMenu?.classList.toggle('hidden');
  });

  function buildResolvedCategories(data) {
    const emojisMap = data?.emojis || {};
    const rawCats = data?.categories || [];
    const serverEmojis = state.serverState?.guild?.emojis || [];
    const guildName = state.serverState?.guild?.name || 'AION 2 Server Emojis';
    const guildIcon = state.serverState?.guild?.icon || '/emojis/Elyos.webp';

    const aion2NamesSet = new Set(AION2_CUSTOM_EMOJIS.map(e => e.name.toLowerCase()));
    const aion2Items = AION2_CUSTOM_EMOJIS.map(e => ({
      id: `custom_${e.name}`,
      emoji: `:${e.name}:`,
      displayUrl: e.file,
      shortcode: `:${e.name}:`,
      name: e.name,
      categoryName: guildName,
      keywords: [...(e.keywords || []), e.name.toLowerCase(), 'server', 'custom', 'aion'],
      code: e.name.toLowerCase().replace(/[^a-z0-9]/g, '-')
    }));

    const extraServerItems = serverEmojis
      .filter(e => e && e.name && !aion2NamesSet.has(e.name.toLowerCase()))
      .map(e => ({
        id: `custom_${e.name}`,
        emoji: `:${e.name}:`,
        displayUrl: e.url,
        shortcode: `:${e.name}:`,
        name: e.name,
        categoryName: guildName,
        keywords: [e.name.toLowerCase(), 'server', 'custom'],
        code: e.name.toLowerCase().replace(/[^a-z0-9]/g, '-')
      }));

    const customItems = [...aion2Items, ...extraServerItems];
    const customMap = new Map(customItems.map(item => [item.id, item]));

    const resolved = [];

    // 1. Frequently Used
    const recentItems = recentEmojiIds
      .map(id => {
        if (customMap.has(id)) {
          return { ...customMap.get(id), categoryName: 'Frequently Used' };
        }
        const entry = emojisMap[id];
        if (!entry) return null;
        return formatStandardEmojiItem(entry, 'Frequently Used');
      })
      .filter(Boolean);

    if (recentItems.length > 0) {
      resolved.push({
        id: 'recent',
        name: 'Frequently Used',
        svg: DISCORD_CATEGORIES[0].svg,
        items: recentItems
      });
    }

    // 2. Server / AION 2 Custom Emojis
    if (customItems.length > 0) {
      resolved.push({
        id: 'server',
        name: guildName,
        isServer: true,
        guildIcon,
        items: customItems
      });
    }

    // 3. Standard 8 Discord Unicode Categories
    DISCORD_CATEGORIES.slice(1).forEach(catDef => {
      const foundCat = rawCats.find(c => c.id === catDef.id);
      if (!foundCat) return;
      const items = foundCat.emojis
        .map(id => {
          const entry = emojisMap[id];
          if (!entry) return null;
          return formatStandardEmojiItem(entry, catDef.name);
        })
        .filter(Boolean);

      if (items.length > 0) {
        resolved.push({
          id: catDef.id,
          name: catDef.name,
          svg: catDef.svg,
          items
        });
      }
    });

    return resolved;
  }

  function formatStandardEmojiItem(entry, categoryName) {
    const skins = entry.s || [];
    const chosenSkin = skins[selectedSkinTone] || skins[0] || { u: '1f600', e: '😀' };
    return {
      id: entry.id,
      emoji: chosenSkin.e,
      unified: chosenSkin.u,
      displayUrl: getTwemojiUrl(chosenSkin.u),
      shortcode: `:${entry.id}:`,
      name: entry.n || entry.id,
      categoryName,
      keywords: entry.k || [],
      code: extractFlagIsoCode(chosenSkin.e) || entry.id.replace(/^flag-/, '')
    };
  }

  function renderCategoryRail(categories, activeId) {
    if (!categoriesRail) return;
    categoriesRail.innerHTML = '';

    categories.forEach((cat, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `discord-ep-rail-btn ${cat.id === activeId ? 'active' : ''} ${cat.isServer ? 'server-icon-btn' : ''}`;
      btn.dataset.catId = cat.id;
      btn.title = cat.name;

      if (cat.isServer && cat.guildIcon) {
        btn.innerHTML = `<img src="${cat.guildIcon}" alt="${cat.name}" class="discord-ep-guild-img">`;
      } else {
        btn.innerHTML = cat.svg || DISCORD_CATEGORIES[1].svg;
      }

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (searchInput && searchInput.value.trim()) {
          searchInput.value = '';
          updateSearchClearIcon();
          renderEmojiGrid('');
        }
        if (collapsedSections.has(cat.id)) {
          collapsedSections.delete(cat.id);
          renderEmojiGrid('');
        }
        const sectionEl = gridScroller?.querySelector(`[data-section-id="${cat.id}"]`);
        if (sectionEl && gridScroller) {
          gridScroller.scrollTo({ top: sectionEl.offsetTop, behavior: 'smooth' });
        }
        setActiveRailIcon(cat.id);
      });

      categoriesRail.appendChild(btn);

      // Add Discord's horizontal separator line after Frequently Used / Server Emojis
      const nextCat = categories[idx + 1];
      if ((cat.id === 'recent' && nextCat?.isServer) || (cat.isServer) || (cat.id === 'recent' && !nextCat?.isServer)) {
        const hr = document.createElement('div');
        hr.className = 'discord-ep-rail-divider';
        categoriesRail.appendChild(hr);
      }
    });
  }

  function setActiveRailIcon(catId) {
    categoriesRail?.querySelectorAll('.discord-ep-rail-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.catId === catId);
    });
  }

  function updateInspector(item) {
    if (!item) return;
    if (footerIcon) {
      const safeFallback = (item.emoji && (item.emoji.startsWith(':') || item.emoji.startsWith('<'))) ? '✨' : (item.emoji || '✨');
      footerIcon.innerHTML = `<img src="${item.displayUrl}" alt="${item.name || item.emoji}" onerror="this.replaceWith(document.createTextNode('${safeFallback}'))">`;
    }
    if (footerShortcode) footerShortcode.textContent = item.shortcode;
    if (footerLabel) footerLabel.textContent = `${item.name} • ${item.categoryName}`;
    if (searchInput && !searchInput.value) {
      searchInput.placeholder = item.shortcode;
    }
  }

  async function renderEmojiGrid(query = '') {
    if (!gridScroller) return;
    const data = await ensureEmojiDataset();
    if (!data) return;

    const categories = buildResolvedCategories(data);
    const q = query.trim().toLowerCase();

    if (!categoriesRail.hasChildNodes() || !q) {
      renderCategoryRail(categories, categories[0]?.id || 'recent');
    }

    gridScroller.innerHTML = '';
    const fragment = document.createDocumentFragment();
    let totalMatches = 0;
    let firstItem = null;

    if (q) {
      // Search Results Mode (deduplicated across categories)
      const seenIds = new Set();
      const matchedItems = [];

      categories.forEach(cat => {
        cat.items.forEach(item => {
          if (seenIds.has(item.id)) return;
          const matchId = item.id.toLowerCase().includes(q);
          const matchName = item.name.toLowerCase().includes(q);
          const matchKw = item.keywords.some(k => k.toLowerCase().includes(q));
          const matchEmoji = item.emoji === q;
          if (matchId || matchName || matchKw || matchEmoji) {
            seenIds.add(item.id);
            matchedItems.push(item);
          }
        });
      });

      const sectionEl = document.createElement('section');
      sectionEl.className = 'discord-ep-section';

      const headerEl = document.createElement('div');
      headerEl.className = 'discord-ep-section-header';
      headerEl.innerHTML = `<span>SEARCH RESULTS (${matchedItems.length})</span>`;
      sectionEl.appendChild(headerEl);

      if (matchedItems.length > 0) {
        const gridEl = document.createElement('div');
        gridEl.className = 'discord-ep-grid';
        matchedItems.slice(0, 250).forEach(item => {
          if (!firstItem) firstItem = item;
          totalMatches++;
          gridEl.appendChild(createEmojiCell(item));
        });
        sectionEl.appendChild(gridEl);
      } else {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'discord-ep-empty';
        emptyEl.innerHTML = `
          <div style="font-size: 2rem; margin-bottom: 6px;">🧭</div>
          <div>No emojis found for <strong>"${query.trim()}"</strong></div>
          <button type="button" class="btn btn-sm btn-primary" id="btn-use-raw-emoji" style="margin-top: 10px;">
            Use "${query.trim()}" directly
          </button>
        `;
        sectionEl.appendChild(emptyEl);
      }

      fragment.appendChild(sectionEl);
    } else {
      // Full Category View
      categories.forEach(cat => {
        const isCollapsed = collapsedSections.has(cat.id);
        const sectionEl = document.createElement('section');
        sectionEl.className = 'discord-ep-section';
        sectionEl.dataset.sectionId = cat.id;

        const headerEl = document.createElement('button');
        headerEl.type = 'button';
        headerEl.className = `discord-ep-section-header ${isCollapsed ? 'collapsed' : ''}`;
        headerEl.innerHTML = `
          <span class="discord-ep-section-icon">${cat.isServer ? '🏰' : ''}</span>
          <span class="discord-ep-section-title">${cat.name}</span>
          <svg class="discord-ep-section-caret" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
        `;
        headerEl.addEventListener('click', (e) => {
          e.stopPropagation();
          if (collapsedSections.has(cat.id)) {
            collapsedSections.delete(cat.id);
          } else {
            collapsedSections.add(cat.id);
          }
          renderEmojiGrid('');
        });
        sectionEl.appendChild(headerEl);

        if (!isCollapsed) {
          const gridEl = document.createElement('div');
          gridEl.className = 'discord-ep-grid';
          cat.items.forEach(item => {
            if (!firstItem) firstItem = item;
            totalMatches++;
            gridEl.appendChild(createEmojiCell(item));
          });
          sectionEl.appendChild(gridEl);
        }

        fragment.appendChild(sectionEl);
      });
    }

    gridScroller.appendChild(fragment);

    // Wire raw fallback button if present
    gridScroller.querySelector('#btn-use-raw-emoji')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const raw = query.trim();
      selectEmojiItem({
        id: raw,
        emoji: raw,
        displayUrl: emojiToTwemojiUrl(raw),
        shortcode: raw,
        name: 'Custom Emoji',
        categoryName: 'Custom',
        code: extractFlagIsoCode(raw) || ''
      });
    });

    if (firstItem) updateInspector(firstItem);
  }

  function createEmojiCell(item) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'discord-ep-cell';
    btn.setAttribute('aria-label', item.name);

    const img = document.createElement('img');
    img.src = item.displayUrl;
    img.alt = item.name || item.emoji;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.onerror = () => {
      const safeFallback = (item.emoji && (item.emoji.startsWith(':') || item.emoji.startsWith('<'))) ? '✨' : (item.emoji || '✨');
      img.replaceWith(document.createTextNode(safeFallback));
    };
    btn.appendChild(img);

    btn.addEventListener('mouseenter', () => {
      updateInspector(item);
    });

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectEmojiItem(item);
    });

    return btn;
  }

  // Scroll-spy for left category rail
  gridScroller?.addEventListener('scroll', () => {
    if (searchInput?.value.trim()) return;
    const scrollTop = gridScroller.scrollTop + 28;
    const sections = gridScroller.querySelectorAll('.discord-ep-section[data-section-id]');
    let currentId = sections[0]?.dataset.sectionId;
    sections.forEach(sec => {
      if (sec.offsetTop <= scrollTop) {
        currentId = sec.dataset.sectionId;
      }
    });
    if (currentId) setActiveRailIcon(currentId);
  }, { passive: true });

  function recordRecentEmoji(item) {
    if (!item?.id) return;
    recentEmojiIds = [item.id, ...recentEmojiIds.filter(id => id !== item.id)].slice(0, 27);
    try {
      localStorage.setItem('maiev_recent_emojis', JSON.stringify(recentEmojiIds));
    } catch {
      // Ignore storage quota errors
    }
  }

  function selectEmojiItem(item) {
    recordRecentEmoji(item);
    if (typeof activeSelectionCallback === 'function') {
      activeSelectionCallback(item);
    } else {
      setMainCreatorEmoji(item);
    }
    closePopover();
  }

  function setMainCreatorEmoji(item) {
    if (hiddenInput) hiddenInput.value = item.emoji;
    triggerBtn.classList.add('has-selection');
    if (selectedDisplay) {
      const safeFallback = (item.emoji && (item.emoji.startsWith(':') || item.emoji.startsWith('<'))) ? '✨' : (item.emoji || '✨');
      selectedDisplay.innerHTML = `<img src="${item.displayUrl}" alt="${item.name || item.emoji}" class="twemoji-inline" onerror="this.replaceWith(document.createTextNode('${safeFallback}'))">`;
    }
    triggerBtn.title = `${item.shortcode || item.emoji} (${item.name || 'Selected Emoji'})`;

    // Auto-fill identifier code if empty
    const codeInput = document.getElementById('new-nat-code');
    if (codeInput && !codeInput.value.trim()) {
      const iso = extractFlagIsoCode(item.emoji);
      if (iso) codeInput.value = iso;
      else if (item.code && item.code.length <= 14) codeInput.value = item.code;
    }
  }

  function updateSearchClearIcon() {
    if (!searchClearBtn || !searchInput) return;
    if (searchInput.value.trim()) {
      searchClearBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
      searchClearBtn.title = 'Clear search';
    } else {
      searchClearBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`;
      searchClearBtn.title = 'Search';
    }
  }

  searchClearBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (searchInput && searchInput.value) {
      searchInput.value = '';
      updateSearchClearIcon();
      renderEmojiGrid('');
      searchInput.focus();
    }
  });

  searchInput?.addEventListener('input', (e) => {
    updateSearchClearIcon();
    renderEmojiGrid(e.target.value);
  });

  let currentAnchorEl = null;

  function positionPopoverNearAnchor(anchorEl) {
    const target = anchorEl || triggerBtn;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const popW = 424;
    const popH = 435;
    const margin = 8;

    let left = rect.left;
    if (left + popW > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - popW - margin);
    }

    let top = rect.bottom + 6;
    if (top + popH > window.innerHeight - margin && rect.top - popH - 6 >= margin) {
      top = rect.top - popH - 6;
    } else if (top + popH > window.innerHeight - margin) {
      top = Math.max(margin, window.innerHeight - popH - margin);
    }

    popover.style.left = `${Math.round(left)}px`;
    popover.style.top = `${Math.round(top)}px`;
  }

  function openPopover(anchorEl, callback = null) {
    activeSelectionCallback = callback;
    currentAnchorEl = anchorEl || triggerBtn;
    document.querySelectorAll('.discord-emoji-trigger-btn.active').forEach(b => b.classList.remove('active'));
    currentAnchorEl.classList.add('active');
    skinToneMenu?.classList.add('hidden');
    popover.classList.remove('hidden');
    positionPopoverNearAnchor(currentAnchorEl);
    renderEmojiGrid(searchInput?.value || '');
    setTimeout(() => searchInput?.focus(), 20);
  }

  function closePopover() {
    popover.classList.add('hidden');
    skinToneMenu?.classList.add('hidden');
    document.querySelectorAll('.discord-emoji-trigger-btn.active').forEach(b => b.classList.remove('active'));
    activeSelectionCallback = null;
    currentAnchorEl = null;
  }

  function updateTriggerButtonVisual(btn, inputEl, emojiChar, displayUrl) {
    if (!btn) return;
    const normalizedEmoji = normalizeEmojiCode(emojiChar || '😀');
    const customEntry = getCustomEmojiEntry(normalizedEmoji);
    const iconSpan = btn.querySelector('.emoji-trigger-icon');
    const url = displayUrl || (customEntry ? customEntry.url : emojiToTwemojiUrl(normalizedEmoji));
    const fallbackText = customEntry ? '✨' : normalizedEmoji;
    if (iconSpan) {
      iconSpan.innerHTML = `<img src="${url}" alt="${normalizedEmoji}" class="twemoji-inline" onerror="this.replaceWith(document.createTextNode('${fallbackText}'))">`;
    }
    if (inputEl) {
      inputEl.value = normalizedEmoji;
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  // Bind all extra [data-emoji-trigger-for] buttons (Scheduled Alerts tab, Custom Alert modal, Custom Preset modal)
  document.querySelectorAll('[data-emoji-trigger-for]').forEach(extraBtn => {
    const targetInputId = extraBtn.getAttribute('data-emoji-trigger-for');
    const targetInput = document.getElementById(targetInputId);
    const initialEmoji = targetInput?.value || extraBtn.querySelector('.emoji-trigger-icon')?.textContent?.trim() || '🔔';
    updateTriggerButtonVisual(extraBtn, null, initialEmoji);

    extraBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!popover.classList.contains('hidden') && currentAnchorEl === extraBtn) {
        closePopover();
      } else {
        openPopover(extraBtn, (item) => {
          updateTriggerButtonVisual(extraBtn, targetInput, item.emoji, item.displayUrl);
        });
      }
    });
  });

  triggerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!popover.classList.contains('hidden') && currentAnchorEl === triggerBtn && !activeSelectionCallback) {
      closePopover();
    } else {
      openPopover(triggerBtn, null);
    }
  });

  window.addEventListener('resize', () => {
    if (!popover.classList.contains('hidden') && currentAnchorEl) {
      positionPopoverNearAnchor(currentAnchorEl);
    }
  });

  popover.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!e.target.closest('#emoji-diversity-wrap')) {
      skinToneMenu?.classList.add('hidden');
    }
  });

  document.addEventListener('click', () => {
    if (!popover.classList.contains('hidden')) {
      closePopover();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !popover.classList.contains('hidden')) {
      closePopover();
    }
  });

  window.__maievEmojiPicker = {
    openForCard(anchorEl, onSelect) {
      openPopover(anchorEl, onSelect);
    },
    setTriggerEmoji(inputId, emojiChar) {
      const normalized = normalizeEmojiCode(emojiChar || '😀');
      const btn = document.querySelector(`[data-emoji-trigger-for="${inputId}"]`);
      const inputEl = document.getElementById(inputId);
      if (inputEl) inputEl.value = normalized;
      if (btn) updateTriggerButtonVisual(btn, null, normalized);
    },
    resetCreator() {
      if (hiddenInput) hiddenInput.value = '';
      triggerBtn.classList.remove('has-selection');
      if (selectedDisplay) {
        selectedDisplay.innerHTML = `<img src="${TWEMOJI_BASE}/1f600.svg" alt="😀" class="twemoji-inline">`;
      }
      triggerBtn.title = 'Open Discord Emoji Picker';
    }
  };
}
