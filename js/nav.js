if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
}

// Inject shared top navigation and mark active link
document.addEventListener('DOMContentLoaded', async () => {
    const header = document.querySelector('header');
    if (!header) return;
    try {
        const resp = await fetch('/partials/nav.html', { cache: 'no-cache' });
        if (!resp.ok) throw new Error('Failed to load nav');
        const html = await resp.text();
        // Replace existing <nav> if present, else append
        const temp = document.createElement('div');
        temp.innerHTML = html;
        const newNav = temp.querySelector('nav');
        const oldNav = header.querySelector('nav');
        if (oldNav) oldNav.replaceWith(newNav); else header.appendChild(newNav);
        // set active based on current file name
        const pathParts = location.pathname.split('/').filter(Boolean);
        let path = pathParts[pathParts.length - 1] || 'index.html';
        if (pathParts[0] === 'projects') {
            path = 'collection.html';
        }
        const links = newNav.querySelectorAll('a');
        links.forEach(a => {
            const href = a.getAttribute('href');
            const normalizedHref = href.startsWith('/') ? href.slice(1) : href;
            if (normalizedHref === path) a.classList.add('active');
        });
        // Mobile menu toggle handling
        const toggleBtn = newNav.querySelector('.menu-toggle');
        const navLinks = newNav.querySelector('.nav-links');
        const closeMenu = () => {
            if (!toggleBtn || !navLinks) return;
            navLinks.classList.remove('open');
            toggleBtn.setAttribute('aria-expanded', 'false');
        };
        if (toggleBtn && navLinks) {
            toggleBtn.addEventListener('click', () => {
                const isOpen = navLinks.classList.toggle('open');
                toggleBtn.setAttribute('aria-expanded', String(isOpen));
                setLayoutHeights();
            });
            // Close menu when a link is clicked (mobile UX)
            navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
        }
        // Update fixed layout offsets so content clears the header and footer.
        const setLayoutHeights = () => {
            const root = document.documentElement;
            root.style.setProperty('--header-height', header.getBoundingClientRect().height + 'px');
            if (footer) root.style.setProperty('--footer-height', footer.getBoundingClientRect().height + 'px');
        };
        const footer = document.querySelector('footer');
        setLayoutHeights();
        window.addEventListener('resize', setLayoutHeights);
        window.addEventListener('load', setLayoutHeights);
        if (footer && 'ResizeObserver' in window) {
            new ResizeObserver(setLayoutHeights).observe(footer);
        }
    } catch (e) {
        console.error('Nav include error:', e);
    }
});
