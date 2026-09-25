export function safariUrlForCanto(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:' || url.hostname !== 'bvl-group.canto.de' || url.username || url.password) return null;
    return `x-safari-https://${url.host}${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function externalLinkDestination(url, iosStandalone) {
  const safariUrl = iosStandalone && safariUrlForCanto(url);
  return safariUrl ? { href: safariUrl, newTab: false } : { href: url, newTab: true };
}
