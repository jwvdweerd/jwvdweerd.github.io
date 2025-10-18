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
                setHeaderHeight();
            });
            // Close menu when a link is clicked (mobile UX)
            navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
        }
        // Update CSS var for header height (to ensure content clears fixed header)
        const setHeaderHeight = () => {
            const h = header.getBoundingClientRect().height;
            document.documentElement.style.setProperty('--header-height', h + 'px');
        };
        setHeaderHeight();
        window.addEventListener('resize', setHeaderHeight);
    } catch (e) {
        console.error('Nav include error:', e);
    }
});
