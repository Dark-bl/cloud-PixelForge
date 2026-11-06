(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const bridge = () => window.PIXELFORGE_ADMIN_BRIDGE || null;
  const dbClient = () => bridge()?.getClient?.() || null;
  const currentUser = () => bridge()?.getUser?.() || null;
  const isAdmin = () => Boolean(bridge()?.isAdmin?.());
  let myCollaboratorProfile = null;
  let refreshRunning = false;
  const V10_QUEUE_KEY = 'pixelforge_v10_pending_sync_v1';
  function queueV10(type, payload, error) {
    try { const queue = JSON.parse(localStorage.getItem(V10_QUEUE_KEY) || '[]'); const id = payload.id || (window.crypto?.randomUUID ? window.crypto.randomUUID() : ''); const storedPayload = { ...payload }; if (type !== 'collaborator' && id) storedPayload.id = id; queue.push({ id, type, user_id: payload.user_id || payload.solicitante_id || payload.created_by, payload: storedPayload, queued_at: new Date().toISOString(), last_error: String(error?.message || error || 'Sin conexión') }); localStorage.setItem(V10_QUEUE_KEY, JSON.stringify(queue)); return true; } catch (storageError) { console.warn('No se pudo guardar la cola V10 local:', storageError); return false; }
  }

  function isRealUser() {
    const user = currentUser();
    return Boolean(user?.id && user.id !== 'invitado-local' && dbClient());
  }

  function setText(id, value) {
    const node = $(id);
    if (node) node.textContent = String(value ?? '');
  }

  function setStatus(id, value, isError = false) {
    const node = $(id);
    if (!node) return;
    node.textContent = value;
    node.classList.toggle('pf10-error', Boolean(isError));
  }

  function make(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined && value !== null) node.textContent = String(value);
    return node;
  }

  function dateLabel(value) {
    if (!value) return 'Fecha no disponible';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('es-MX');
  }

  function statusLabel(value) {
    const labels = {
      pendiente: 'Pendiente', en_revision: 'En revisión', resuelto: 'Resuelto', cerrado: 'Cerrado',
      aceptada: 'Aceptada', rechazada: 'Rechazada', en_curso: 'En curso', finalizada: 'Finalizada',
      cancelada: 'Cancelada', aprobado: 'Aprobado', rechazada_colaborador: 'Rechazada', suspendido: 'Suspendido'
    };
    return labels[value] || value || 'Sin estado';
  }

  function specialtyLabel(value) {
    const labels = {
      streamer: 'Streamer',
      programador: 'Programador',
      aficionado: 'Aficionado a los videojuegos'
    };
    return labels[value] || value || 'Usuario';
  }

  function addPanels() {
    if ($('pfV10UserDashboard')) return;
    const main = document.querySelector('main');
    const nav = document.querySelector('.pf-header nav');
    if (!main || !nav) return;

    const reportLink = nav.querySelector('a[href="#reportes"]');
    const navMarkup = `
      <a href="#pfV10UserDashboard" id="pfV10UserNav" hidden>Mi dashboard</a>
      <a href="#pfV10Directory" id="pfV10DirectoryNav" hidden>Colaboradores</a>
      <a href="#pfV10CollaboratorDashboard" id="pfV10CollaboratorNav" hidden>Panel colaborador</a>`;
    if (reportLink) reportLink.insertAdjacentHTML('afterend', navMarkup);
    else nav.insertAdjacentHTML('beforeend', navMarkup);

    main.insertAdjacentHTML('beforeend', `
      <section class="seccion pf10-section" id="pfV10UserDashboard" hidden>
        <p class="etiqueta">PIXELFORGE · ESPACIO PERSONAL</p>
        <h2>Mi dashboard</h2>
        <p class="descripcion">Consulta tus reportes, participa en sondeos y encuentra apoyo dentro de la comunidad PixelForge.</p>
        <div class="pf10-stats">
          <article class="pf10-stat"><span>Mis reportes</span><strong id="pf10ReportCount">0</strong></article>
          <article class="pf10-stat"><span>Mis asesorías</span><strong id="pf10AdviceCount">0</strong></article>
          <article class="pf10-stat"><span>Mi perfil</span><strong id="pf10RoleState">Usuario</strong></article>
        </div>
        <div class="pf10-grid">
          <article class="panel-pixel pf10-card">
            <h3>Crear un reporte</h3>
            <p>Describe errores, problemas con tu cuenta, contenido o ideas para mejorar PixelForge.</p>
            <form id="pf10ReportForm" class="pf10-form">
              <label for="pf10ReportType">Tipo de reporte</label>
              <select id="pf10ReportType" required>
                <option value="Error funcional">Error funcional</option>
                <option value="Cuenta o acceso">Cuenta o acceso</option>
                <option value="Diseño o accesibilidad">Diseño o accesibilidad</option>
                <option value="Catálogo o videojuegos">Catálogo o videojuegos</option>
                <option value="Streams o música">Streams o música</option>
                <option value="Sugerencia">Sugerencia</option>
                <option value="Otro">Otro</option>
              </select>
              <label for="pf10ReportTitle">Resumen</label>
              <input id="pf10ReportTitle" maxlength="120" required placeholder="Ej. No puedo guardar un videojuego">
              <label for="pf10ReportDetail">Describe lo ocurrido</label>
              <textarea id="pf10ReportDetail" rows="4" maxlength="2500" required placeholder="¿Qué pasó? ¿Qué esperabas que sucediera?"></textarea>
              <button class="boton" type="submit">Enviar reporte</button>
              <p id="pf10ReportStatus" class="pf10-status" role="status" aria-live="polite"></p>
            </form>
          </article>
          <article class="panel-pixel pf10-card">
            <h3>Estado de mis reportes</h3>
            <p>Las actualizaciones que haga el equipo aparecerán aquí.</p>
            <div id="pf10MyReports" class="pf10-list"><p>Inicia sesión para consultar tus reportes.</p></div>
          </article>
        </div>
        <article class="panel-pixel pf10-card pf10-wide">
          <h3>Sondeos de la comunidad</h3>
          <p>Participa en decisiones y propuestas para las próximas mejoras de PixelForge.</p>
          <div id="pf10PollList" class="pf10-list"><p>Cargando sondeos…</p></div>
        </article>
        <div class="pf10-grid">
          <article class="panel-pixel pf10-card">
            <h3>Solicitar incorporación como colaborador</h3>
            <p>Postúlate para apoyar a otros integrantes como streamer, programador o aficionado a los videojuegos. Tu solicitud debe ser aprobada por superadministración.</p>
            <form id="pf10CollaboratorApplyForm" class="pf10-form">
              <label for="pf10CollabName">Nombre público</label>
              <input id="pf10CollabName" maxlength="100" required placeholder="Nombre que verá la comunidad">
              <label for="pf10CollabSpecialty">Especialidad principal</label>
              <select id="pf10CollabSpecialty" required>
                <option value="streamer">Streamer y creación de contenido</option>
                <option value="programador">Programador y desarrollo</option>
                <option value="aficionado">Aficionado a los videojuegos</option>
              </select>
              <label for="pf10CollabBio">¿En qué puedes ayudar?</label>
              <textarea id="pf10CollabBio" rows="3" maxlength="700" required placeholder="Cuéntale a la comunidad qué conocimientos o experiencia puedes compartir."></textarea>
              <button class="boton" type="submit">Enviar solicitud</button>
              <p id="pf10ApplyStatus" class="pf10-status" role="status" aria-live="polite"></p>
            </form>
            <div id="pf10MyCollabState" class="pf10-status" role="status" aria-live="polite"></div>
          </article>
          <article class="panel-pixel pf10-card">
            <h3>Mis solicitudes de asesoría</h3>
            <p>Consulta si el colaborador aceptó tu solicitud y lee sus respuestas.</p>
            <div id="pf10MyAdvice" class="pf10-list"><p>Aún no has solicitado asesorías.</p></div>
          </article>
        </div>
      </section>

      <section class="seccion pf10-section" id="pfV10Directory" hidden>
        <p class="etiqueta">PIXELFORGE · APOYO ENTRE LA COMUNIDAD</p>
        <h2>Directorio de colaboradores</h2>
        <p class="descripcion">Encuentra personas aprobadas por PixelForge y solicita una asesoría rápida para tus ideas, proyectos o dudas.</p>
        <div id="pf10DirectoryList" class="pf10-directory"><p>Inicia sesión para consultar colaboradores.</p></div>
      </section>

      <section class="seccion pf10-section" id="pfV10CollaboratorDashboard" hidden>
        <p class="etiqueta">PIXELFORGE · ESPACIO DE COLABORACIÓN</p>
        <h2>Dashboard de colaborador</h2>
        <p class="descripcion">Administra tu disponibilidad y atiende las solicitudes de asesoría que te envíe la comunidad.</p>
        <article class="panel-pixel pf10-card">
          <div class="pf10-profile-head"><div><h3 id="pf10CollaboratorName">Colaborador</h3><p id="pf10CollaboratorSpecialty">Especialidad</p></div><button type="button" class="boton boton-secundario" id="pf10ToggleAvailability">Cambiar disponibilidad</button></div>
          <p id="pf10AvailabilityStatus" class="pf10-status" role="status"></p>
        </article>
        <article class="panel-pixel pf10-card pf10-wide">
          <h3>Solicitudes recibidas</h3>
          <p>Al aceptar una solicitud podrás iniciar la asesoría y marcarla como finalizada cuando termines.</p>
          <div id="pf10CollaboratorRequests" class="pf10-request-groups">
            <section class="pf10-request-group"><h4>Solicitudes activas</h4><div id="pf10CollaboratorPending" class="pf10-list"><p>No hay solicitudes activas.</p></div></section>
            <section class="pf10-request-group"><h4>Historial de asesorías</h4><div id="pf10CollaboratorHistory" class="pf10-list"><p>Aún no hay asesorías finalizadas o rechazadas.</p></div></section>
          </div>
          <p id="pf10CollaboratorStatus" class="pf10-status" role="status" aria-live="polite"></p>
        </article>
      </section>`);

    const adminWorkspace = $('pfAdminWorkspace');
    if (adminWorkspace && !$('pf10AdminExtension')) {
      adminWorkspace.insertAdjacentHTML('beforeend', `
        <section class="pf10-admin-extension" id="pf10AdminExtension">
          <p class="etiqueta">PIXELFORGE · SUPERADMINISTRACIÓN</p>
          <h3>Gestión de colaboradores y asesorías</h3>
          <p>Aprueba a quienes podrán ofrecer asesorías y supervisa las solicitudes de la comunidad.</p>
          <div class="pf10-stats">
            <article class="pf10-stat"><span>Colaboradores registrados</span><strong id="pf10AdminCollabCount">0</strong></article>
            <article class="pf10-stat"><span>Asesorías registradas</span><strong id="pf10AdminAdviceCount">0</strong></article>
            <article class="pf10-stat"><span>Sondeos activos</span><strong id="pf10AdminPollCount">0</strong></article>
          </div>
          <div class="pf10-grid">
            <article class="pf10-card">
              <h4>Solicitudes de colaboración</h4>
              <div id="pf10AdminCollaborators" class="pf10-list"><p>Cargando colaboradores…</p></div>
            </article>
            <article class="pf10-card">
              <h4>Supervisión de asesorías</h4>
              <div id="pf10AdminAdvice" class="pf10-list"><p>Cargando asesorías…</p></div>
            </article>
          </div>
          <article class="pf10-card pf10-wide">
            <h4>Crear un sondeo</h4>
            <form id="pf10PollCreateForm" class="pf10-form">
              <label for="pf10PollQuestion">Pregunta</label>
              <input id="pf10PollQuestion" maxlength="180" required placeholder="Ej. ¿Qué función debería mejorar PixelForge primero?">
              <label for="pf10PollOptions">Opciones (una por línea, entre 2 y 6)</label>
              <textarea id="pf10PollOptions" rows="4" required placeholder="Mejorar la biblioteca&#10;Agregar más videojuegos&#10;Mejorar los perfiles"></textarea>
              <button class="boton" type="submit">Publicar sondeo</button>
              <p id="pf10PollAdminStatus" class="pf10-status" role="status" aria-live="polite"></p>
            </form>
            <h4>Sondeos publicados</h4>
            <div id="pf10AdminPolls" class="pf10-list"><p>Aún no hay sondeos.</p></div>
          </article>
          <p id="pf10AdminStatus" class="pf10-status" role="status" aria-live="polite"></p>
          <button type="button" class="boton boton-secundario" id="pf10AdminRefresh">Actualizar panel de superadministración</button>
        </section>`);
    }

    const adminLink = $('pfAdminNavLink');
    if (adminLink) adminLink.textContent = 'Superadministración';
  }

  function wrapSubsection(node, title, description = '', open = false, id = '') {
    if (!node || !node.parentNode) return null;
    const details = document.createElement('details');
    details.className = 'pf10-subsection';
    if (id) details.id = id;
    details.open = Boolean(open);
    const summary = make('summary', 'pf10-subsection-title', title);
    const content = make('div', 'pf10-subsection-content');
    if (description) content.append(make('p', 'pf10-subsection-description', description));
    node.parentNode.insertBefore(details, node);
    content.append(node);
    details.append(summary, content);
    return details;
  }

  function organizeDashboardSections() {
    const user = $('pfV10UserDashboard');
    if (user && !user.dataset.organized) {
      const stats = user.querySelector('.pf10-stats');
      if (stats) user.insertBefore(make('h3', 'pf10-section-heading', 'Resumen general'), stats);
      const grids = user.querySelectorAll(':scope > .pf10-grid');
      const polls = user.querySelector(':scope > .pf10-wide');
      if (grids[0]) wrapSubsection(grids[0], '01 · Reportes y soporte', 'Crea un reporte y consulta el seguimiento que realiza el equipo.', true, 'pf10UserReportsSection');
      if (polls) wrapSubsection(polls, '02 · Comunidad y sondeos', 'Participa en las decisiones y propuestas de PixelForge.', false, 'pf10UserPollsSection');
      if (grids[1]) wrapSubsection(grids[1], '03 · Colaboración y asesorías', 'Solicita incorporarte al equipo o revisa las asesorías que has solicitado.', false, 'pf10UserCollabSection');
      user.dataset.organized = 'true';
    }

    const collaborator = $('pfV10CollaboratorDashboard');
    if (collaborator && !collaborator.dataset.organized) {
      const cards = collaborator.querySelectorAll(':scope > article.pf10-card');
      if (cards[0]) wrapSubsection(cards[0], '01 · Mi perfil y disponibilidad', 'Mantén actualizado tu estado para que la comunidad sepa cuándo puede solicitarte apoyo.', true, 'pf10CollaboratorProfileSection');
      if (cards[1]) wrapSubsection(cards[1], '02 · Solicitudes y seguimiento', 'Atiende las solicitudes activas y consulta tu historial de asesorías.', false, 'pf10CollaboratorRequestsSection');
      collaborator.dataset.organized = 'true';
    }

    const admin = $('pf10AdminExtension');
    if (admin && !admin.dataset.organized) {
      const grid = admin.querySelector(':scope > .pf10-grid');
      const polls = admin.querySelector(':scope > .pf10-wide');
      if (grid) wrapSubsection(grid, '01 · Equipo y asesorías', 'Aprueba colaboradores y supervisa las solicitudes de apoyo.', true, 'pf10AdminTeamSection');
      if (polls) wrapSubsection(polls, '02 · Sondeos de la comunidad', 'Publica preguntas, revisa sondeos y cierra las votaciones.', false, 'pf10AdminPollsSection');
      admin.dataset.organized = 'true';
    }
  }

  function appendStateLine(parent, label, value) {
    const p = make('p', 'pf10-meta');
    p.append(make('strong', '', label + ': '), document.createTextNode(statusLabel(value)));
    parent.append(p);
  }

  async function loadMyReports(db, user) {
    const root = $('pf10MyReports');
    if (!root) return;
    const { data, error } = await db.from('pf_v9_reports')
      .select('id,tipo,resumen,detalle,estado,notas_administracion,created_at')
      .eq('created_by', user.id).order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    root.replaceChildren();
    const items = data || [];
    setText('pf10ReportCount', items.length);
    if (!items.length) { root.append(make('p', 'pf10-empty', 'Todavía no tienes reportes enviados desde una cuenta registrada.')); return; }
    items.forEach(item => {
      const card = make('article', 'pf10-item');
      card.append(make('strong', '', `${item.tipo} · ${item.resumen}`));
      appendStateLine(card, 'Estado', item.estado);
      card.append(make('small', '', dateLabel(item.created_at)));
      if (item.notas_administracion) card.append(make('p', 'pf10-response', 'Respuesta del equipo: ' + item.notas_administracion));
      root.append(card);
    });
  }

  async function loadMyAdvice(db, user) {
    const root = $('pf10MyAdvice');
    if (!root) return;
    const { data, error } = await db.from('pf_v10_advice_requests')
      .select('id,tema,mensaje,estado,respuesta,created_at')
      .eq('solicitante_id', user.id).order('created_at', { ascending: false }).limit(40);
    if (error) throw error;
    root.replaceChildren();
    const items = data || [];
    setText('pf10AdviceCount', items.length);
    if (!items.length) { root.append(make('p', 'pf10-empty', 'Aún no has solicitado asesorías.')); return; }
    items.forEach(item => {
      const card = make('article', 'pf10-item');
      card.append(make('strong', '', item.tema));
      appendStateLine(card, 'Estado', item.estado);
      card.append(make('p', '', item.mensaje), make('small', '', dateLabel(item.created_at)));
      if (item.respuesta) card.append(make('p', 'pf10-response', 'Respuesta del colaborador: ' + item.respuesta));
      root.append(card);
    });
  }

  async function loadPolls(db, user) {
    const root = $('pf10PollList');
    if (!root) return;
    const [{ data: polls, error }, { data: votes, error: voteError }] = await Promise.all([
      db.from('pf_v10_polls').select('id,question,options,active,created_at').eq('active', true).order('created_at', { ascending: false }),
      db.from('pf_v10_poll_votes').select('poll_id,option_index').eq('user_id', user.id)
    ]);
    if (error) throw error;
    if (voteError) throw voteError;
    root.replaceChildren();
    if (!polls?.length) { root.append(make('p', 'pf10-empty', 'Por ahora no hay sondeos activos.')); return; }
    const voted = new Map((votes || []).map(v => [v.poll_id, v.option_index]));
    for (const poll of polls) {
      const card = make('article', 'pf10-item pf10-poll');
      card.append(make('strong', '', poll.question));
      const voteIndex = voted.get(poll.id);
      const resultsBox = make('div', 'pf10-poll-results');
      let results = [];
      try {
        const response = await db.rpc('pf_v10_poll_results', { p_poll_id: poll.id });
        if (!response.error) results = response.data || [];
      } catch (e) { console.warn('No se pudieron cargar resultados del sondeo:', e); }
      const total = results.reduce((sum, row) => sum + Number(row.total_votes || 0), 0);
      if (voteIndex) {
        card.append(make('p', 'pf10-meta', `Ya participaste. Votos registrados: ${total}.`));
        results.forEach(row => {
          const line = make('p', 'pf10-result-line', `${row.option_label}: ${row.total_votes} voto(s)` + (Number(row.option_index) === Number(voteIndex) ? ' · Tu elección' : ''));
          resultsBox.append(line);
        });
        card.append(resultsBox);
      } else {
        const form = make('form', 'pf10-form');
        (poll.options || []).forEach((option, index) => {
          const label = make('label', 'pf10-radio-label');
          const radio = document.createElement('input');
          radio.type = 'radio'; radio.name = 'pf10-poll-' + poll.id; radio.value = String(index + 1); radio.required = true;
          label.append(radio, document.createTextNode(' ' + option));
          form.append(label);
        });
        const button = make('button', 'boton', 'Enviar voto'); button.type = 'submit'; form.append(button);
        form.addEventListener('submit', async event => {
          event.preventDefault();
          const selected = form.querySelector('input[type="radio"]:checked');
          if (!selected) return;
          button.disabled = true;
          try {
            const { error: rpcError } = await db.rpc('pf_v10_vote_poll', { p_poll_id: poll.id, p_option_index: Number(selected.value) });
            if (rpcError) throw rpcError;
            setStatus('pf10ReportStatus', 'Tu voto quedó registrado.');
            await loadPolls(db, user);
          } catch (e) { setStatus('pf10ReportStatus', 'No se pudo registrar el voto: ' + e.message, true); button.disabled = false; }
        });
        card.append(form);
      }
      root.append(card);
    }
  }

  async function loadCollaboratorProfile(db, user) {
    const { data, error } = await db.from('pf_v10_collaborators').select('*').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    myCollaboratorProfile = data || null;
    const form = $('pf10CollaboratorApplyForm');
    const state = $('pf10MyCollabState');
    if (form) form.hidden = Boolean(data);
    if (state) {
      state.textContent = data
        ? `Tu solicitud de colaboración está: ${statusLabel(data.estado)}. Especialidad: ${data.especialidad}.`
        : 'Todavía no tienes una solicitud de colaboración.';
    }
    const approved = data?.estado === 'aprobado';
    const accountStatus = approved
      ? specialtyLabel(data.especialidad)
      : data?.estado === 'pendiente' ? 'Solicitud pendiente' : 'Usuario';
    setText('pf10RoleState', accountStatus);
    setText('pfProfileStatus', approved ? specialtyLabel(data.especialidad) : accountStatus);
    if ($('pf10CollaboratorNav')) $('pf10CollaboratorNav').hidden = !approved;
    if ($('pfV10CollaboratorDashboard')) $('pfV10CollaboratorDashboard').hidden = !approved;
    if (approved) {
      setText('pf10CollaboratorName', data.nombre_publico);
      setText('pf10CollaboratorSpecialty', specialtyLabel(data.especialidad) + ' · ' + (data.presentacion || ''));
      setText('pf10AvailabilityStatus', data.disponible ? 'Estás disponible para recibir asesorías.' : 'Tu perfil aparece como no disponible.');
      setText('pf10ToggleAvailability', data.disponible ? 'Pausar solicitudes' : 'Volver a estar disponible');
      await loadCollaboratorRequests(db, user);
    }
  }

  async function loadDirectory(db, user) {
    const root = $('pf10DirectoryList');
    if (!root) return;
    const { data, error } = await db.from('pf_v10_collaborators')
      .select('user_id,nombre_publico,especialidad,presentacion,disponible')
      .eq('estado', 'aprobado').order('nombre_publico', { ascending: true }).limit(100);
    if (error) throw error;
    root.replaceChildren();
    const items = (data || []).filter(item => item.user_id !== user.id);
    if (!items.length) { root.append(make('p', 'pf10-empty', 'Todavía no hay colaboradores aprobados disponibles en el directorio.')); return; }

    const groups = [
      { key: 'streamer', label: 'Streamers y creadores de contenido' },
      { key: 'programador', label: 'Programadores y desarrolladores' },
      { key: 'aficionado', label: 'Aficionados a los videojuegos' }
    ];
    const normalized = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (const group of groups) {
      const members = items.filter(item => normalized(item.especialidad).includes(group.key));
      if (!members.length) continue;
      const block = make('section', 'pf10-directory-group');
      block.append(make('h3', 'pf10-directory-heading', group.label));
      const cards = make('div', 'pf10-directory-cards');
      members.forEach(item => {
        const card = make('article', 'pf10-directory-card');
        card.append(make('h3', '', item.nombre_publico));
        card.append(make('span', 'pf10-specialty', item.especialidad));
        card.append(make('p', '', item.presentacion || 'Colaborador de PixelForge.'));
        card.append(make('small', item.disponible ? 'pf10-available' : 'pf10-unavailable', item.disponible ? 'Disponible para asesorías' : 'No disponible por ahora'));
        const form = make('form', 'pf10-form pf10-advice-form');
        form.dataset.collaboratorId = item.user_id;
        const topicLabel = make('label', '', 'Tema de la asesoría');
        const topic = document.createElement('select'); topic.required = true;
        ['Programación','Transmisiones y streaming','Videojuegos','Idea o proyecto','Creación de contenido','Otro'].forEach(value => {
          const option = document.createElement('option'); option.value = value; option.textContent = value; topic.append(option);
        });
        const msgLabel = make('label', '', '¿Qué necesitas resolver?');
        const message = document.createElement('textarea'); message.rows = 3; message.maxLength = 1200; message.required = true; message.placeholder = 'Explica brevemente tu duda o idea.';
        const button = make('button', 'boton', 'Solicitar asesoría'); button.type = 'submit'; button.disabled = !item.disponible;
        form.append(topicLabel, topic, msgLabel, message, button);
        const status = make('p', 'pf10-status'); status.setAttribute('role','status');
        form.addEventListener('submit', async event => {
          event.preventDefault();
          button.disabled = true;
          const advicePayload = {
            id: (window.crypto?.randomUUID ? window.crypto.randomUUID() : undefined),
            solicitante_id: user.id, colaborador_id: item.user_id,
            tema: topic.value, mensaje: message.value.trim(), estado: 'pendiente'
          };
          try {
            const { error: insertError } = await db.from('pf_v10_advice_requests').insert(advicePayload);
            if (insertError) throw insertError;
            status.textContent = 'Solicitud enviada. Podrás revisar la respuesta en Mi dashboard.';
            form.reset();
            await loadMyAdvice(db, user);
          } catch (e) { const saved = queueV10('advice', advicePayload, e); status.textContent = saved ? 'No llegó a Supabase. La solicitud quedó guardada en este navegador para reintentarla al recuperar la conexión.' : 'No se pudo enviar ni guardar localmente: ' + e.message; status.classList.add('pf10-error'); }
          finally { button.disabled = !item.disponible; }
        });
        card.append(form, status);
        cards.append(card);
      });
      block.append(cards);
      root.append(block);
    }
  }

  async function loadCollaboratorRequests(db, user) {
    const activeRoot = $('pf10CollaboratorPending');
    const historyRoot = $('pf10CollaboratorHistory');
    const fallbackRoot = $('pf10CollaboratorRequests');
    if (!activeRoot && !historyRoot && !fallbackRoot) return;
    const { data, error } = await db.from('pf_v10_advice_requests')
      .select('id,solicitante_id,tema,mensaje,estado,respuesta,created_at')
      .eq('colaborador_id', user.id).order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    if (activeRoot) activeRoot.replaceChildren();
    if (historyRoot) historyRoot.replaceChildren();
    if (fallbackRoot && !activeRoot && !historyRoot) fallbackRoot.replaceChildren();
    const isHistory = item => ['finalizada','rechazada','cancelada'].includes(item.estado);
    if (!data?.length) {
      const empty = make('p', 'pf10-empty', 'Aún no has recibido solicitudes de asesoría.');
      (activeRoot || fallbackRoot)?.append(empty);
      return;
    }
    data.forEach(item => {
      const card = make('article', 'pf10-item');
      card.append(make('strong', '', item.tema));
      card.append(make('small', '', 'Solicitud de cuenta: ' + String(item.solicitante_id).slice(0, 8) + '… · ' + dateLabel(item.created_at)));
      card.append(make('p', '', item.mensaje));
      appendStateLine(card, 'Estado', item.estado);
      const response = document.createElement('textarea'); response.rows = 2; response.maxLength = 1200; response.placeholder = 'Respuesta para la persona solicitante…'; response.value = item.respuesta || '';
      card.append(make('label', '', 'Tu respuesta'), response);
      const controls = make('div', 'pf10-actions');
      const actions = [];
      if (item.estado === 'pendiente') actions.push(['Aceptar','aceptada'],['Rechazar','rechazada']);
      if (item.estado === 'aceptada') actions.push(['Iniciar asesoría','en_curso']);
      if (item.estado === 'en_curso') actions.push(['Finalizar asesoría','finalizada']);
      actions.forEach(([label, nextState]) => {
        const button = make('button', 'boton boton-secundario', label); button.type = 'button';
        button.addEventListener('click', async () => {
          button.disabled = true;
          try {
            const { error: updateError } = await db.from('pf_v10_advice_requests')
              .update({ estado: nextState, respuesta: response.value.trim() }).eq('id', item.id);
            if (updateError) throw updateError;
            setStatus('pf10CollaboratorStatus', 'Solicitud actualizada: ' + statusLabel(nextState));
            await loadCollaboratorRequests(db, user);
            await loadMyAdvice(db, user);
          } catch (e) { setStatus('pf10CollaboratorStatus', 'No se pudo actualizar: ' + e.message, true); button.disabled = false; }
        });
        controls.append(button);
      });
      if (actions.length) card.append(controls);
      const target = isHistory(item) ? (historyRoot || fallbackRoot) : (activeRoot || fallbackRoot);
      target?.append(card);
    });
    if (activeRoot && !activeRoot.children.length) activeRoot.append(make('p', 'pf10-empty', 'No tienes solicitudes activas.'));
    if (historyRoot && !historyRoot.children.length) historyRoot.append(make('p', 'pf10-empty', 'Aún no hay asesorías finalizadas o rechazadas.'));
  }

  async function handleReportSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget; // currentTarget deja de estar disponible después del primer await.
    const db = dbClient(); const user = currentUser(); const button = form.querySelector('button[type="submit"]');
    if (!db || !user?.id || user.id === 'invitado-local') { setStatus('pf10ReportStatus', 'Inicia sesión con tu cuenta PixelForge para enviar y consultar reportes.', true); return; }
    const payload = {
      id: (window.crypto?.randomUUID ? window.crypto.randomUUID() : undefined),
      tipo: $('pf10ReportType').value,
      resumen: $('pf10ReportTitle').value.trim(),
      detalle: $('pf10ReportDetail').value.trim(),
      pagina_url: location.href,
      navegador: navigator.userAgent,
      estado: 'pendiente'
    };
    button.disabled = true;
    try {
      const { error } = await db.from('pf_v9_reports').insert(payload);
      if (error) throw error;
      form.reset();
      setStatus('pf10ReportStatus', 'Reporte enviado correctamente. Su estado aparecerá en esta pantalla.');
      await loadMyReports(db, user);
    } catch (e) { const saved = queueV10('report', { ...payload, created_by: user.id }, e); if (saved) form.reset(); setStatus('pf10ReportStatus', saved ? 'No se pudo conectar con Supabase. El reporte quedó guardado en este navegador para sincronizarlo al recuperar la conexión.' : 'No se pudo enviar ni guardar localmente: ' + e.message, true); }
    finally { button.disabled = false; }
  }

  async function handleCollaboratorApply(event) {
    event.preventDefault();
    const form = event.currentTarget; // conservar referencia antes de esperar a Supabase.
    const db = dbClient(); const user = currentUser(); const button = form.querySelector('button[type="submit"]');
    if (!db || !user?.id || user.id === 'invitado-local') { setStatus('pf10ApplyStatus', 'Inicia sesión para enviar tu solicitud.', true); return; }
    button.disabled = true;
    const collaboratorPayload = {
      user_id: user.id,
      nombre_publico: $('pf10CollabName').value.trim(),
      especialidad: $('pf10CollabSpecialty').value,
      presentacion: $('pf10CollabBio').value.trim(),
      estado: 'pendiente', disponible: false
    };
    try {
      const { error } = await db.from('pf_v10_collaborators').insert(collaboratorPayload);
      if (error) throw error;
      form.reset();
      setStatus('pf10ApplyStatus', 'Solicitud enviada. El superadministrador revisará tu perfil.');
      await loadCollaboratorProfile(db, user);
      await loadAdminExtension();
    } catch (e) { const saved = queueV10('collaborator', collaboratorPayload, e); if (saved) form.reset(); setStatus('pf10ApplyStatus', saved ? 'No llegó a Supabase. Tu solicitud quedó guardada en este navegador y se reintentará con tu cuenta al recuperar la conexión.' : 'No se pudo enviar ni guardar localmente: ' + e.message, true); }
    finally { button.disabled = false; }
  }

  async function toggleAvailability() {
    const db = dbClient(); const user = currentUser();
    if (!db || !user || !myCollaboratorProfile) return;
    const next = !myCollaboratorProfile.disponible;
    const { error } = await db.from('pf_v10_collaborators').update({ disponible: next }).eq('user_id', user.id);
    if (error) { setStatus('pf10AvailabilityStatus', 'No se pudo cambiar la disponibilidad: ' + error.message, true); return; }
    myCollaboratorProfile.disponible = next;
    setText('pf10AvailabilityStatus', next ? 'Estás disponible para recibir asesorías.' : 'Tu perfil aparece como no disponible.');
    setText('pf10ToggleAvailability', next ? 'Pausar solicitudes' : 'Volver a estar disponible');
    const dbUser = currentUser();
    if (dbUser) await loadDirectory(db, dbUser);
  }

  async function loadAdminExtension() {
    const db = dbClient();
    if (!db || !isAdmin()) return;
    const status = $('pf10AdminStatus');
    const specs = [
      ['pf_v10_collaborators','pf10AdminCollabCount','pf10AdminCollaborators',renderAdminCollaborators],
      ['pf_v10_advice_requests','pf10AdminAdviceCount','pf10AdminAdvice',renderAdminAdvice],
      ['pf_v10_polls','pf10AdminPollCount','pf10AdminPolls',renderAdminPolls]
    ];
    const results = await Promise.all(specs.map(async ([table]) => {
      try {
        const response = await db.from(table).select('*').order('created_at', { ascending: false }).limit(100);
        if (response.error) throw response.error;
        return { data: response.data || [], error: null };
      } catch (error) { return { data: [], error }; }
    }));
    let failures = 0;
    results.forEach((result,index) => {
      const [table,countId,rootId,renderer] = specs[index];
      if (result.error) {
        failures++;
        setText(countId,'—');
        const root = $(rootId);
        if (root) { root.replaceChildren(); root.append(make('p','pf10-error',table + ': ' + result.error.message)); }
        console.error('PixelForge V10 admin (' + table + '):',result.error);
      } else {
        setText(countId,index === 2 ? result.data.filter(p => p.active).length : result.data.length);
        renderer(result.data);
      }
    });
    if (status) status.textContent = failures
      ? 'Sincronización parcial: ' + (3-failures) + ' de 3 tablas V10 cargadas. Revisa el detalle de cada sección.'
      : 'Datos de colaboradores, asesorías y sondeos actualizados desde Supabase.';
  }

  function renderAdminCollaborators(items) {
    const root = $('pf10AdminCollaborators'); if (!root) return;
    root.replaceChildren();
    if (!items.length) { root.append(make('p', 'pf10-empty', 'No hay solicitudes de colaboradores.')); return; }
    items.forEach(item => {
      const card = make('article', 'pf10-item');
      card.append(make('strong', '', item.nombre_publico + ' · ' + item.especialidad));
      card.append(make('p', '', item.presentacion || 'Sin presentación.'));
      appendStateLine(card, 'Estado', item.estado);
      card.append(make('small', '', 'Usuario: ' + item.user_id + ' · ' + dateLabel(item.created_at)));
      const actions = make('div', 'pf10-actions');
      [['Aprobar','aprobado'],['Rechazar','rechazado'],['Suspender','suspendido']].forEach(([label, next]) => {
        const button = make('button', 'boton boton-secundario', label); button.type = 'button';
        button.addEventListener('click', async () => {
          button.disabled = true;
          try {
            const { error } = await dbClient().rpc('pf_v10_set_collaborator_status', { p_user_id: item.user_id, p_estado: next });
            if (error) throw error;
            setStatus('pf10AdminStatus', 'Estado actualizado: ' + item.nombre_publico + ' → ' + statusLabel(next));
            await loadAdminExtension();
            const user = currentUser(); if (user?.id === item.user_id) await refreshAll();
          } catch (e) { setStatus('pf10AdminStatus', 'No se pudo modificar el perfil: ' + e.message, true); button.disabled = false; }
        });
        actions.append(button);
      });
      card.append(actions); root.append(card);
    });
  }

  function renderAdminAdvice(items) {
    const root = $('pf10AdminAdvice'); if (!root) return;
    root.replaceChildren();
    if (!items.length) { root.append(make('p', 'pf10-empty', 'No hay asesorías registradas.')); return; }
    items.forEach(item => {
      const card = make('article', 'pf10-item');
      card.append(make('strong', '', item.tema));
      appendStateLine(card, 'Estado', item.estado);
      card.append(make('p', '', item.mensaje));
      card.append(make('small', '', 'Solicitante: ' + String(item.solicitante_id).slice(0, 8) + '… · Colaborador: ' + String(item.colaborador_id).slice(0, 8) + '… · ' + dateLabel(item.created_at)));
      if (!['finalizada','rechazada','cancelada'].includes(item.estado)) {
        const close = make('button', 'boton boton-secundario', 'Cerrar seguimiento'); close.type = 'button';
        close.addEventListener('click', async () => {
          close.disabled = true;
          try {
            const { error } = await dbClient().from('pf_v10_advice_requests').update({ estado: 'finalizada' }).eq('id', item.id);
            if (error) throw error;
            await loadAdminExtension();
          } catch (e) { setStatus('pf10AdminStatus', 'No se pudo cerrar el seguimiento: ' + e.message, true); close.disabled = false; }
        });
        card.append(close);
      }
      root.append(card);
    });
  }

  function renderAdminPolls(items) {
    const root = $('pf10AdminPolls'); if (!root) return;
    root.replaceChildren();
    if (!items.length) { root.append(make('p', 'pf10-empty', 'No hay sondeos creados.')); return; }
    items.forEach(item => {
      const card = make('article', 'pf10-item');
      card.append(make('strong', '', item.question));
      card.append(make('small', '', item.active ? 'Activo' : 'Cerrado'));
      if (item.active) {
        const button = make('button', 'boton boton-secundario', 'Cerrar sondeo'); button.type = 'button';
        button.addEventListener('click', async () => {
          button.disabled = true;
          try {
            const { error } = await dbClient().from('pf_v10_polls').update({ active: false }).eq('id', item.id);
            if (error) throw error;
            await loadAdminExtension();
            const user = currentUser(); if (user) await loadPolls(dbClient(), user);
          } catch (e) { setStatus('pf10AdminStatus', 'No se pudo cerrar el sondeo: ' + e.message, true); button.disabled = false; }
        });
        card.append(button);
      }
      root.append(card);
    });
  }

  async function handleCreatePoll(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!isAdmin()) { setStatus('pf10PollAdminStatus', 'Solo la superadministración puede publicar sondeos.', true); return; }
    const question = $('pf10PollQuestion').value.trim();
    const options = $('pf10PollOptions').value.split('\n').map(v => v.trim()).filter(Boolean);
    const button = form.querySelector('button[type="submit"]');
    if (options.length < 2 || options.length > 6) { setStatus('pf10PollAdminStatus', 'Escribe entre 2 y 6 opciones, una por línea.', true); return; }
    button.disabled = true;
    try {
      const { error } = await dbClient().from('pf_v10_polls').insert({ question, options, active: true });
      if (error) throw error;
      form.reset();
      setStatus('pf10PollAdminStatus', 'Sondeo publicado correctamente.');
      await loadAdminExtension();
      const user = currentUser(); if (user) await loadPolls(dbClient(), user);
    } catch (e) { setStatus('pf10PollAdminStatus', 'No se pudo publicar: ' + e.message, true); }
    finally { button.disabled = false; }
  }

  async function refreshAll() {
    if (refreshRunning) return;
    refreshRunning = true;
    try {
      const user = currentUser(); const db = dbClient();
      const admin = isAdmin();
      if (admin) await loadAdminExtension();
      const logged = isRealUser();
      if ($('pfV10UserNav')) $('pfV10UserNav').hidden = !logged;
      if ($('pfV10DirectoryNav')) $('pfV10DirectoryNav').hidden = !logged;
      if ($('pfV10UserDashboard')) $('pfV10UserDashboard').hidden = !logged;
      if ($('pfV10Directory')) $('pfV10Directory').hidden = !logged;
      if (!logged) {
        myCollaboratorProfile = null;
        if ($('pfV10CollaboratorNav')) $('pfV10CollaboratorNav').hidden = true;
        if ($('pfV10CollaboratorDashboard')) $('pfV10CollaboratorDashboard').hidden = true;
        return;
      }
      setText('pf10RoleState', 'Usuario');
      try {
        await loadCollaboratorProfile(db, user);
        await Promise.all([loadMyReports(db, user), loadMyAdvice(db, user), loadPolls(db, user), loadDirectory(db, user)]);
      } catch (e) {
        console.warn('PixelForge V10: no se pudieron cargar todos los datos del usuario:', e);
        setStatus('pf10MyCollabState', 'No se pudo cargar una parte del dashboard. Verifica la migración SQL V10. ' + e.message, true);
      }
    } finally { refreshRunning = false; }
  }

  function bindEvents() {
    $('pf10ReportForm')?.addEventListener('submit', handleReportSubmit);
    $('pf10CollaboratorApplyForm')?.addEventListener('submit', handleCollaboratorApply);
    $('pf10ToggleAvailability')?.addEventListener('click', toggleAvailability);
    $('pf10PollCreateForm')?.addEventListener('submit', handleCreatePoll);
    $('pf10AdminRefresh')?.addEventListener('click', loadAdminExtension);
    $('pfAdminRefresh')?.addEventListener('click', () => { if (isAdmin()) loadAdminExtension(); });
    window.addEventListener('pixelforge:auth', refreshAll);
    window.addEventListener('pixelforge:admin-state', refreshAll);
    window.addEventListener('pixelforge:supabase-sync-complete', () => { if (isAdmin()) loadAdminExtension(); refreshAll(); });
    window.addEventListener('hashchange', () => {
      if (location.hash === '#administracion' && isAdmin()) loadAdminExtension();
      if (isRealUser() && ['#pfV10UserDashboard','#pfV10Directory','#pfV10CollaboratorDashboard'].includes(location.hash)) refreshAll();
    });
  }

  function init() {
    addPanels();
    organizeDashboardSections();
    bindEvents();
    refreshAll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();