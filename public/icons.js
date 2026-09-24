const paths = {
  'calculator': '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 10h2m4 0h2M8 14h2m4 0h2M8 18h2m4 0h2"/>',
  'list-tree': '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  'refresh-cw': '<path d="M20 11a8 8 0 0 0-14.9-4M4 4v4h4M4 13a8 8 0 0 0 14.9 4M20 20v-4h-4"/>',
  'presentation': '<path d="M3 3h18M5 3v12h14V3M8 21l4-6 4 6M8 8h8M8 11h5"/>',
  'truck': '<path d="M3 6h12v11H3zM15 10h4l3 4v3h-7M7 17h.01M18 17h.01"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  'building-2': '<path d="M3 21V7l8-4v18M11 9h10v12M6 9h2M6 13h2M6 17h2M14 12h2M18 12h1M14 16h2M18 16h1M2 21h20"/>',
  'images': '<rect x="3" y="3" width="15" height="15" rx="2"/><path d="m3 14 4-4 3 3 2-2 6 6M7 7h.01M9 21h11a2 2 0 0 0 2-2V8"/>',
  'wrench': '<path d="M14.7 6.3a5 5 0 0 0-6.4 6.4L3 17.7a2.3 2.3 0 0 0 3.3 3.3l5.3-5.3A5 5 0 0 0 18 9.3l-3.7 3.7-3-3z"/>',
  'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h8"/>',
  'folder-open': '<path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v2M3 10h18l-2 10H5z"/>',
  'link-2': '<path d="M10 13a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7M14 11a5 5 0 0 0-7.1 0l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7"/>',
  'book-open': '<path d="M12 7a8 8 0 0 0-9-2v14a8 8 0 0 1 9 2M12 7a8 8 0 0 1 9-2v14a8 8 0 0 0-9 2M12 7v14"/>',
  'globe': '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
  'phone': '<path d="M5 3h4l2 5-2 2a16 16 0 0 0 5 5l2-2 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
  'mail': '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  'video': '<rect x="2" y="5" width="15" height="14" rx="2"/><path d="m17 10 5-3v10l-5-3"/>',
  'chart-no-axes-combined': '<path d="M3 3v18h18M6 16l5-5 4 3 6-7"/>',
  'package': '<path d="m12 2 9 5-9 5-9-5zM3 7v10l9 5 9-5V7M12 12v10"/>',
  'settings': '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a2 2 0 0 0 .4 2.2l-2.6 2.6a2 2 0 0 0-2.2-.4 2 2 0 0 0-1.4 1.6h-3.2A2 2 0 0 0 9 19.4a2 2 0 0 0-2.2.4l-2.6-2.6A2 2 0 0 0 4.6 15 2 2 0 0 0 3 13.6v-3.2A2 2 0 0 0 4.6 9a2 2 0 0 0-.4-2.2l2.6-2.6A2 2 0 0 0 9 4.6 2 2 0 0 0 10.4 3h3.2A2 2 0 0 0 15 4.6a2 2 0 0 0 2.2-.4l2.6 2.6A2 2 0 0 0 19.4 9a2 2 0 0 0 1.6 1.4v3.2A2 2 0 0 0 19.4 15z"/>',
  'users': '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5v1"/>',
  'home': '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM9 21v-7h6v7"/>',
  'bell': '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  'user-round': '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  'clock-3': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5h4"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  'arrow-left': '<path d="m12 19-7-7 7-7M5 12h14"/>',
  'arrow-up-right': '<path d="M7 17 17 7M8 7h9v9"/>',
  'external-link': '<path d="M13 4h7v7M20 4l-9 9M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5"/>',
  'plus': '<path d="M12 5v14M5 12h14"/>',
  'check': '<path d="m5 12 4 4L19 6"/>',
  'trash-2': '<path d="M3 6h18M8 6V4h8v2M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  'edit-3': '<path d="M12 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-7M16 3l5 5-9 9-5 1 1-5z"/>',
  'log-out': '<path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5M15 17l5-5-5-5M20 12H9"/>',
  'wifi-off': '<path d="M2 8a16 16 0 0 1 5-2M14 6a16 16 0 0 1 8 2M5 12a11 11 0 0 1 5-2M15 10a11 11 0 0 1 4 2M8 16a6 6 0 0 1 8 0M12 20h.01M2 2l20 20"/>',
  'shield-check': '<path d="M12 2 4 5v6c0 5 3.4 8.8 8 11 4.6-2.2 8-6 8-11V5zM8 12l3 3 5-6"/>',
  'grip-vertical': '<circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/>'
};

export function icon(name, className = '') {
  const body = paths[name] || paths['link-2'];
  return `<svg class="icon ${className}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

export const editableIcons = ['calculator','list-tree','refresh-cw','presentation','truck','building-2','images','wrench','file-text','folder-open','link-2','book-open','globe','phone','mail','video','chart-no-axes-combined','package','settings','users'];
