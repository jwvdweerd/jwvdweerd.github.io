// Inject shared top navigation and mark active link
document.addEventListener('DOMContentLoaded', async () => {
    const header = document.querySelector('header');
    if (!header) return;
    try {
        const resp = await fetch('partials/nav.html', { cache: 'no-cache' });
        if (!resp.ok) throw new Error('Failed to load nav');
        const html = await resp.text();
        // Replace existing <nav> if present, else append
        const temp = document.createElement('div');
        temp.innerHTML = html;
        const newNav = temp.querySelector('nav');
        const oldNav = header.querySelector('nav');
        if (oldNav) oldNav.replaceWith(newNav); else header.appendChild(newNav);
        // set active based on current file name
        const path = location.pathname.split('/').pop() || 'index.html';
        const links = newNav.querySelectorAll('a');
        links.forEach(a => {
            const href = a.getAttribute('href');
            if (href === path) a.classList.add('active');
        });
    } catch (e) {
        console.error('Nav include error:', e);
    }
});
