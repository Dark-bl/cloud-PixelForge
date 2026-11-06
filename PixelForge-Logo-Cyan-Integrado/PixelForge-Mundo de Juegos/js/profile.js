(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const bridge = () => window.PIXELFORGE_ADMIN_BRIDGE || null;
  const currentUser = () => bridge()?.getUser?.() || null;
  const dbClient = () => bridge()?.getClient?.() || null;

  function setLoading(button, loading) {
    if (!button) return;
    if (loading) {
      button.dataset.textoOriginal = button.textContent;
      button.textContent = 'GUARDANDO...';
      button.disabled = true;
    } else {
      button.textContent = button.dataset.textoOriginal || button.textContent;
      button.disabled = false;
    }
  }

  function updateAvatar(url, name) {
    const avatar = $('pfProfileAvatarPreview');
    if (!avatar) return;
    avatar.replaceChildren();
    if (url && /^https?:\/\//i.test(url)) {
      const img = document.createElement('img');
      img.src = url;
      img.alt = 'Foto de perfil';
      img.onerror = () => { avatar.textContent = (name || 'PF').slice(0, 2).toUpperCase(); };
      avatar.appendChild(img);
    } else {
      avatar.textContent = (name || 'PF').trim().slice(0, 2).toUpperCase() || 'PF';
    }
  }

  function loadProfile() {
    const user = currentUser();
    const meta = user?.user_metadata || {};
    if ($('pfProfileName')) $('pfProfileName').value = meta.display_name || meta.full_name || '';
    if ($('pfProfileUsername')) $('pfProfileUsername').value = meta.username || '';
    if ($('pfProfileAvatar')) $('pfProfileAvatar').value = meta.avatar_url || '';
    if ($('pfProfileBio')) $('pfProfileBio').value = meta.bio || '';
    if ($('pfProfileStatus')) $('pfProfileStatus').textContent = user?.app_metadata?.pixelforge_status || 'Usuario';
    updateAvatar(meta.avatar_url || '', meta.display_name || meta.full_name || user?.email || 'PF');
    if ($('pfProfileMessage')) $('pfProfileMessage').textContent = user?.email
      ? `Cuenta: ${user.email}`
      : 'Inicia sesión para editar tu perfil.';
  }

  function initProfile() {
    const form = $('pfProfileForm');
    if (!form || form.dataset.pfProfileReady === '1') return;
    form.dataset.pfProfileReady = '1';

    $('pfProfileAvatar')?.addEventListener('input', () =>
      updateAvatar($('pfProfileAvatar').value.trim(), $('pfProfileName')?.value || 'PF'));
    $('pfProfileName')?.addEventListener('input', () =>
      updateAvatar($('pfProfileAvatar')?.value.trim(), $('pfProfileName').value));

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const status = $('pfProfileMessage');
      const submit = form.querySelector('[type="submit"]');
      const user = currentUser();
      const db = dbClient();

      if (!user || user.id === 'invitado-local' || !db) {
        if (status) status.textContent = 'Inicia sesión con una cuenta para guardar los cambios de perfil.';
        return;
      }

      const display_name = $('pfProfileName')?.value.trim() || '';
      const username = ($('pfProfileUsername')?.value || '').trim().replace(/^@/, '');
      const avatar_url = $('pfProfileAvatar')?.value.trim() || '';
      const bio = $('pfProfileBio')?.value.trim() || '';
      if (!display_name) {
        if (status) status.textContent = 'Escribe un nombre visible.';
        return;
      }
      if (avatar_url && !/^https?:\/\//i.test(avatar_url)) {
        if (status) status.textContent = 'La foto debe usar un enlace http o https válido.';
        return;
      }

      setLoading(submit, true);
      if (status) status.textContent = 'Guardando tu perfil...';
      try {
        const { data, error } = await db.auth.updateUser({
          data: { display_name, full_name: display_name, username, avatar_url, bio }
        });
        if (error) throw error;
        bridge()?.setUser?.(data?.user || user);
        loadProfile();
        if (status) status.textContent = '✓ Perfil actualizado correctamente.';
        window.dispatchEvent(new Event('pixelforge:auth'));
      } catch (error) {
        console.error('No se pudo actualizar el perfil:', error);
        if (status) status.textContent = 'No se pudo guardar: ' + (error?.message || 'error desconocido');
      } finally {
        setLoading(submit, false);
      }
    });
  }

  window.PIXELFORGE_PROFILE = { load: loadProfile, init: initProfile };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProfile, { once: true });
  } else {
    initProfile();
  }
  window.addEventListener('pixelforge:auth', loadProfile);
  loadProfile();
})();
