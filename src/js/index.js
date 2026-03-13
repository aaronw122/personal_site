const containerId = 'page-root';

console.log('[spa] script loaded at', performance.now().toFixed(1), 'ms');

function isInternalLink(anchor) {
    return anchor.origin === window.location.origin && !anchor.target && !anchor.hasAttribute('download') && anchor.rel !==
        'external';
}

async function loadPage(url, replaceState = false) {
    console.log('[spa] loadPage called:', url, 'replaceState:', replaceState);
    console.trace('[spa] loadPage callstack');
    const res = await fetch(url, { headers: { 'X-Requested-With': 'spa-nav' } });
    if (!res.ok) throw new Error('Fetch failed');
    const text = await res.text();
    const doc = new DOMParser().parseFromString(text, 'text/html');
    const next = doc.getElementById(containerId);
    if (!next) throw new Error('No container in response');
    const container = document.getElementById(containerId);
    console.log('[spa] replacing innerHTML at', performance.now().toFixed(1), 'ms');
    container.innerHTML = next.innerHTML;
    document.title = doc.title;
    if (!replaceState) history.pushState({}, '', url);
}

function handleClick(e) {
    const anchor = e.target.closest('a');
    if (!anchor || anchor.dataset.noSpa === 'true' || !isInternalLink(anchor) || e.defaultPrevented || e.metaKey || e.ctrlKey ||
        e.shiftKey || e.altKey) return;
    console.log('[spa] click nav to:', anchor.href);
    e.preventDefault();
    loadPage(anchor.href).then(() => { currentUrl = window.location.href; }).catch(() => { window.location.href = anchor.href; });
}

let currentUrl = window.location.href;

function handlePopState() {
    console.log('[spa] popstate fired. current:', currentUrl, 'new:', window.location.href);
    if (window.location.href === currentUrl) {
        console.log('[spa] popstate skipped (same URL)');
        return;
    }
    currentUrl = window.location.href;
    loadPage(window.location.href, true).catch(() => { window.location.reload(); });
}

window.addEventListener('popstate', handlePopState);
window.addEventListener('click', handleClick);

// Log when key rendering events happen
window.addEventListener('DOMContentLoaded', () => {
    console.log('[spa] DOMContentLoaded at', performance.now().toFixed(1), 'ms');
});
window.addEventListener('load', () => {
    console.log('[spa] window.load at', performance.now().toFixed(1), 'ms');
    // Log all images and their load state
    document.querySelectorAll('img').forEach(img => {
        console.log('[spa] img:', img.src, 'complete:', img.complete, 'naturalWidth:', img.naturalWidth);
    });
});
