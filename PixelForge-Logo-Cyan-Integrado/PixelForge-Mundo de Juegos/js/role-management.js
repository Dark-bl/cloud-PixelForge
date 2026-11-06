(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const bridge = () => window.PIXELFORGE_ADMIN_BRIDGE || null;
  const db = () => bridge()?.getClient?.() || null;
  const isAdmin = () => Boolean(bridge()?.isAdmin?.());
  const user = () => bridge()?.getUser?.() || null;

  const ROLES = [
    ['creador', 'Creador'],
    ['streamer', 'Streamer'],
    ['programador', 'Programador'],
    ['aficionado', 'Aficionado a los videojuegos'],
    ['colaborador', 'Colaborador'],
    ['moderador', 'Moderador']
  ];
  const ROLE_NAMES = Object.fromEntries(ROLES);
  let usersCache = [];
  let loading = false;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  function setStatus(message, isError = false) {
    const status = $('pfRoleManagerStatus');
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('pf-role-error', isError);
  }

  function ensurePanel() {
    const workspace = $('pfAdminWorkspace');
    if (!workspace || $('pfRoleManager')) return;
    const panel = document.createElement('section');
    panel.id = 'pfRoleManager';
    panel.className = 'pf-role-manager';
    panel.innerHTML = `
      <div class="pf-role-heading">
        <div><p class="etiqueta">PIXELFORGE · CONTROL DE ACCESOS</p><h3>Gestión de roles y permisos</h3>
        <p class="descripcion">Asigna varios roles a una misma cuenta. Los roles administrativos raíz se gestionan por separado y no pueden asignarse desde aquí.</p></div>
        <button type="button" class="boton boton-secundario" id="pfRoleReload">Actualizar usuarios</button>
      </div>
      <label class="pf-role-search-label" for="pfRoleSearch">Buscar cuenta</label>
      <input id="pfRoleSearch" class="pf-role-search" type="search" placeholder="Correo, nombre o ID de usuario">
      <p id="pfRoleManagerStatus" class="pf-role-status" role="status" aria-live="polite">Carga los usuarios para comenzar.</p>
      <div id="pfRoleUsers" class="pf-role-users"><p>Los usuarios aparecerán aquí.</p></div>
      <p class="pf-role-footnote">Los roles de esta sección no convierten una cuenta en superadministradora. El acceso administrativo raíz se conserva en pixelforge_admins y se valida en Supabase.</p>`;
    workspace.appendChild(panel);
    $('pfRoleReload')?.addEventListener('click', loadUsers);
    $('pfRoleSearch')?.addEventListener('input', renderUsers);
  }

  function roleLabel(code) {
    if (code === 'usuario') return 'Usuario';
    if (code === 'superadministrador') return 'Superadministrador';
    if (code === 'administrador') return 'Administrador';
    return ROLE_NAMES[code] || code;
  }

  function renderUsers() {
    const root = $('pfRoleUsers');
    if (!root) return;
    const term = String($('pfRoleSearch')?.value || '').trim().toLowerCase();
    const rows = usersCache.filter(item => [item.email, item.display_name, item.user_id].some(value => String(value || '').toLowerCase().includes(term)));
    root.replaceChildren();
    if (!rows.length) {
      root.append(el('p', 'pf-role-empty', usersCache.length ? 'No hay coincidencias.' : 'No se encontraron usuarios.'));
      return;
    }
    rows.forEach(item => {
      const card = el('article', 'pf-role-user');
      const top = el('div', 'pf-role-user-top');
      const identity = el('div', 'pf-role-identity');
      identity.append(el('strong', '', item.display_name || item.email || 'Usuario'));
      identity.append(el('span', '', item.email || item.user_id));
      identity.append(el('small', '', 'ID: ' + item.user_id));
      top.append(identity);
      const assigned = Array.isArray(item.roles) ? item.roles : ['usuario'];
      const chips = el('div', 'pf-role-chips');
      assigned.forEach(code => {
        const chip = el('span', 'pf-role-chip', roleLabel(code));
        if (code !== 'usuario' && code !== 'superadministrador' && code !== 'administrador') {
          const remove = el('button', 'pf-role-remove', '×');
          remove.type = 'button';
          remove.title = 'Retirar rol ' + roleLabel(code);
          remove.setAttribute('aria-label', 'Retirar rol ' + roleLabel(code));
          remove.addEventListener('click', () => changeRole('remove', item.user_id, code, remove));
          chip.append(remove);
        }
        chips.append(chip);
      });
      const controls = el('div', 'pf-role-controls');
      const select = document.createElement('select');
      select.className = 'pf-role-select';
      select.setAttribute('aria-label', 'Seleccionar rol para ' + (item.email || item.user_id));
      select.append(new Option('Seleccionar rol…', ''));
      ROLES.forEach(([code, label]) => {
        if (!assigned.includes(code)) select.append(new Option(label, code));
      });
      const add = el('button', 'boton boton-secundario', 'Asignar rol');
      add.type = 'button';
      add.disabled = select.options.length < 2;
      add.addEventListener('click', () => {
        if (!select.value) { setStatus('Selecciona un rol antes de asignarlo.', true); return; }
        changeRole('assign', item.user_id, select.value, add);
      });
      controls.append(select, add);
      card.append(top, chips, controls);
      root.append(card);
    });
  }

  async function loadUsers() {
    if (loading) return;
    if (!isAdmin()) { setStatus('No tienes permisos para gestionar roles.', true); return; }
    const client = db();
    if (!client) { setStatus('No se detectó la conexión con Supabase.', true); return; }
    loading = true;
    const button = $('pfRoleReload');
    if (button) button.disabled = true;
    setStatus('Cargando usuarios y roles…');
    try {
      const { data, error } = await client.rpc('pf_rbac_list_users');
      if (error) throw error;
      usersCache = Array.isArray(data) ? data : [];
      renderUsers();
      setStatus('Se cargaron ' + usersCache.length + ' cuentas. Puedes asignar o retirar roles.');
    } catch (error) {
      console.error('PixelForge RBAC:', error);
      setStatus('No se pudieron cargar los usuarios: ' + (error.message || 'Error desconocido') + '. Comprueba que ejecutaste roles.sql.', true);
    } finally {
      loading = false;
      if (button) button.disabled = false;
    }
  }

  async function changeRole(action, userId, roleCode, button) {
    const client = db();
    if (!client || !isAdmin()) { setStatus('Solo la superadministración puede modificar roles.', true); return; }
    if (button) button.disabled = true;
    setStatus(action === 'assign' ? 'Asignando rol…' : 'Retirando rol…');
    try {
      const rpcName = action === 'assign' ? 'pf_rbac_assign_role' : 'pf_rbac_remove_role';
      const { error } = await client.rpc(rpcName, { p_user_id: userId, p_role_code: roleCode });
      if (error) throw error;
      setStatus(action === 'assign' ? 'Rol asignado correctamente.' : 'Rol retirado correctamente.');
      await loadUsers();
    } catch (error) {
      console.error('PixelForge RBAC action:', error);
      setStatus('No se pudo modificar el rol: ' + (error.message || 'Error desconocido'), true);
      if (button) button.disabled = false;
    }
  }

  function onAdminState() {
    ensurePanel();
    if (isAdmin()) loadUsers();
  }

  ensurePanel();
  window.addEventListener('pixelforge:admin-state', onAdminState);
  window.addEventListener('pixelforge:auth', onAdminState);
  window.addEventListener('hashchange', () => {
    if (location.hash === '#administracion' && isAdmin()) loadUsers();
  });
  if (isAdmin()) loadUsers();

  window.PIXELFORGE_RBAC = {
    loadUsers,
    async myRoles() {
      const client = db();
      if (!client) return [];
      const { data, error } = await client.rpc('pf_rbac_my_roles');
      if (error) throw error;
      return Array.isArray(data) ? data : [];
    },
    async hasPermission(permissionCode) {
      const client = db();
      if (!client) return false;
      const { data, error } = await client.rpc('pf_rbac_has_permission', { p_permission_code: permissionCode });
      if (error) throw error;
      return data === true;
    }
  };
})();
