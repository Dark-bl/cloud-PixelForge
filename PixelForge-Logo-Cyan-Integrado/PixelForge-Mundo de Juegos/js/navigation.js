(() => {
    'use strict';

    const sectionIds = new Set([
        'inicio', 'comunidad-destacada', 'juegos', 'biblioteca', 'perfil', 'kids',
        'proponer', 'musica', 'comunidad', 'streamers', 'creadores',
        'reportes', 'administracion', 'aprendizaje', 'contactos',
        'pfV10UserDashboard', 'pfV10Directory', 'pfV10CollaboratorDashboard', 'perfil'
    ]);

    const privateSectionIds = new Set([
        'pfV10UserDashboard', 'pfV10Directory', 'pfV10CollaboratorDashboard', 'perfil'
    ]);

    const bridge = () => window.PIXELFORGE_ADMIN_BRIDGE || null;
    const esAdministrador = () => Boolean(bridge()?.isAdmin?.());
    const usuarioRegistrado = () => {
        const user = bridge()?.getUser?.();
        return Boolean(user?.id && user.id !== 'invitado-local');
    };

    function mostrarSubseccion() {
        let id = decodeURIComponent(location.hash.slice(1)) || 'inicio';

        if (id === 'administracion' && !esAdministrador()) {
            history.replaceState(null, '', location.pathname + location.search + '#inicio');
            id = 'inicio';
        }

        if (privateSectionIds.has(id) && !usuarioRegistrado()) {
            history.replaceState(null, '', location.pathname + location.search + '#biblioteca');
            id = 'biblioteca';
        }

        const target = document.getElementById(sectionIds.has(id) ? id : 'inicio')
            || document.getElementById('inicio');

        document.querySelectorAll('main > section[id]').forEach(section => {
            const visible = section === target;
            section.hidden = !visible;
            section.classList.toggle('pf-subseccion-activa', visible);
        });

        const adminLink = document.getElementById('pfAdminNavLink');
        if (adminLink) adminLink.hidden = !esAdministrador();

        document.querySelectorAll('header nav a[href^="#"]').forEach(link => {
            if (link.getAttribute('href') === '#' + target.id) {
                link.setAttribute('aria-current', 'page');
            } else {
                link.removeAttribute('aria-current');
            }
        });

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Menú compacto: las categorías secundarias y la biblioteca solo aparecen al desplegarlo.
    const menuToggle = document.getElementById('pfMenuToggle');
    const mainNav = document.getElementById('pfMainNav');

    function cerrarMenu() {
        if (!menuToggle || !mainNav) return;
        menuToggle.setAttribute('aria-expanded', 'false');
        menuToggle.classList.remove('is-open');
        mainNav.classList.remove('is-open');
    }

    if (menuToggle && mainNav) {
        menuToggle.addEventListener('click', () => {
            const abierto = menuToggle.getAttribute('aria-expanded') === 'true';
            menuToggle.setAttribute('aria-expanded', String(!abierto));
            menuToggle.classList.toggle('is-open', !abierto);
            mainNav.classList.toggle('is-open', !abierto);
        });

        mainNav.addEventListener('click', event => {
            if (event.target.closest('a')) cerrarMenu();
        });

        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') cerrarMenu();
        });

        document.addEventListener('click', event => {
            if (!event.target.closest('.pf-navigation-area')) cerrarMenu();
        });
    }

    window.addEventListener('hashchange', mostrarSubseccion);
    window.addEventListener('pixelforge:admin-state', mostrarSubseccion);
    window.addEventListener('pixelforge:auth', mostrarSubseccion);

    // Espera a que script.js y Dashboards.js creen el puente y los paneles V10.
    if (document.readyState === 'complete') {
        mostrarSubseccion();
    } else {
        window.addEventListener('load', mostrarSubseccion, { once: true });
    }

    // Conserva la vista previa de las publicaciones en la portada.
    const source = document.getElementById('listaPublicaciones');
    const preview = document.getElementById('vistaPreviaPublicaciones');

    function actualizarVistaPrevia() {
        if (!source || !preview) return;
        const cards = [...source.querySelectorAll('.tarjeta-publicacion')].slice(0, 3);
        preview.replaceChildren();

        if (!cards.length) {
            const p = document.createElement('p');
            p.textContent = source.querySelector('p')?.textContent
                || 'Todavía no hay publicaciones disponibles.';
            preview.appendChild(p);
            return;
        }

        cards.forEach(card => {
            const copy = document.createElement('article');
            copy.className = 'tarjeta-publicacion';
            card.querySelectorAll('.autor-publicacion,h4,p,small').forEach(node => {
                copy.append(node.cloneNode(true));
            });
            preview.appendChild(copy);
        });
    }

    if (source && preview) {
        new MutationObserver(actualizarVistaPrevia).observe(source, {
            childList: true,
            subtree: true,
            characterData: true
        });
        actualizarVistaPrevia();
    }
})();
