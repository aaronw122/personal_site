const containerId = 'page-root';

function isInternalLink(anchor) {
    return anchor.origin === window.location.origin && !anchor.target && !anchor.hasAttribute('download') && anchor.rel !==
        'external';
}

async function loadPage(url, replaceState = false) {
    const res = await fetch(url, { headers: { 'X-Requested-With': 'spa-nav' } });
    if (!res.ok) throw new Error('Fetch failed');
    const text = await res.text();
    const doc = new DOMParser().parseFromString(text, 'text/html');
    const next = doc.getElementById(containerId);
    if (!next) throw new Error('No container in response');
    const container = document.getElementById(containerId);
    container.innerHTML = next.innerHTML;
    document.title = doc.title;
    if (!replaceState) history.pushState({}, '', url);
}

function handleClick(e) {
    const anchor = e.target.closest('a');
    if (!anchor || anchor.dataset.noSpa === 'true' || !isInternalLink(anchor) || e.defaultPrevented || e.metaKey || e.ctrlKey ||
        e.shiftKey || e.altKey) return;
    e.preventDefault();
    loadPage(anchor.href).catch(() => { window.location.href = anchor.href; });
}

function handlePopState() {
    loadPage(window.location.href, true).catch(() => { window.location.reload(); });
}

window.addEventListener('click', handleClick);
window.addEventListener('popstate', handlePopState);