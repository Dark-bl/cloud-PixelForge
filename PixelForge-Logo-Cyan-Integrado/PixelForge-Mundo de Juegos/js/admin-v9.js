/* ============================= PIXELFORGE V9 ============================= */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const REPORTS_KEY = 'pixelforge_v9_reportes_local';
  const CREATOR_REQUESTS_KEY = 'pixelforge_v9_solicitudes_creadores';
  const STREAM_REQUESTS_KEY = 'pixelforge_v9_solicitudes_stream';
  const readList = (key) => { try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } };
  const writeList = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (error) { console.warn('PixelForge V9: no se pudo guardar localmente.', error); return false; } };
  const text = (id) => String($(id)?.value || '').trim();
  const dateLabel = (value) => { try { return new Date(value).toLocaleString('es-MX'); } catch { return value || ''; } };
  const dbClient = () => window.PIXELFORGE_ADMIN_BRIDGE?.getClient?.() || null;
  const adminAllowed = () => Boolean(window.PIXELFORGE_ADMIN_BRIDGE?.isAdmin?.());
  async function insertRemote(table, payload) {
    const db = dbClient();
    if (!db) throw new Error('Supabase aún no está conectado.');
    const { error } = await db.from(table).insert(payload);
    if (error) throw error;
  }
  async function updateRemote(table, id, fields) {
    const db = dbClient();
    if (!db || !adminAllowed()) throw new Error('Debes iniciar sesión con una cuenta administradora.');
    const { error } = await db.from(table).update(fields).eq('id', id);
    if (error) throw error;
  }
  function errorShort(error) { return String(error?.message || error?.details || 'error desconocido').slice(0, 240); }
  function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }
  function safeDisplay(value) { return String(value ?? ''); }
  function renderList(containerId, items, kind) {
    const root = $(containerId); if (!root) return;
    root.replaceChildren();
    if (!items.length) { const p=document.createElement('p'); p.className='pf-v9-empty'; p.textContent='Aún no hay registros guardados en este navegador.'; root.append(p); return; }
    items.slice(-5).reverse().forEach((item) => {
      const article=document.createElement('article'); article.className='pf-v9-local-item';
      const title=document.createElement('strong');
      if (kind==='report') title.textContent=(item.tipo || 'Reporte') + ': ' + (item.resumen || 'Sin resumen');
      else title.textContent=(item.alias || 'Tester') + ' — ' + String(item.calificacion || '—') + '/5';
      const body=document.createElement('p'); body.textContent=kind==='report' ? safeDisplay(item.detalle) : safeDisplay(item.opinion);
      const meta=document.createElement('small'); meta.textContent=dateLabel(item.fecha) + (item.dispositivo ? ' · ' + item.dispositivo : '');
      article.append(title, body, meta); root.append(article);
    });
  }
  function updateDashboard() {
    const games = document.querySelectorAll('#contenedorJuegos .juego').length + document.querySelectorAll('#catalogoDinamico .juego, #catalogoDinamico .tarjeta-juego, #catalogoDinamico article').length;
    const favs = (() => { try { const v=JSON.parse(localStorage.getItem('pixelforge_favoritos_v1') || '[]'); return Array.isArray(v) ? v.length : 0; } catch { return 0; } })();
    const reports = readList(REPORTS_KEY).length;
    const creators = readList(CREATOR_REQUESTS_KEY).length;
    const streams = readList(STREAM_REQUESTS_KEY).length;
    if ($('pfStatJuegos')) $('pfStatJuegos').textContent=String(games);
    if ($('pfStatFavoritos')) $('pfStatFavoritos').textContent=String(favs);
    if ($('pfStatReportes')) $('pfStatReportes').textContent=String(reports);
    if ($('pfStatCreadores')) $('pfStatCreadores').textContent=String(creators);
    if ($('pfStatStreams')) $('pfStatStreams').textContent=String(streams);
  }
  function setupStream() {
    const form=$('pfV9StreamForm'), input=$('pfV9Channel'), player=$('pfV9Player'), status=$('pfV9StreamStatus');
    if (!form || !input || !player || !status) return;
    form.addEventListener('submit',(event)=>{
      event.preventDefault(); const channel=text('pfV9Channel');
      if (!/^[A-Za-z0-9_]{1,60}$/.test(channel)) { status.textContent='Escribe un nombre de canal válido. Solo letras, números y guion bajo.'; return; }
      if (location.protocol==='file:') { status.textContent='Abre PixelForge con Live Server o un dominio web para probar el reproductor de Twitch.'; return; }
      const parent = String(window.PIXELFORGE_CONFIG?.twitchParent || location.hostname).trim();
      player.replaceChildren();
      const iframe=document.createElement('iframe'); iframe.title='Directo de Twitch: '+channel; iframe.loading='lazy'; iframe.allow='autoplay; fullscreen'; iframe.allowFullscreen=true; iframe.referrerPolicy='strict-origin-when-cross-origin';
      iframe.src='https://player.twitch.tv/?channel='+encodeURIComponent(channel)+'&parent='+encodeURIComponent(parent)+'&muted=true';
      player.append(iframe); status.textContent='Se solicitó el directo de '+channel+'. Si no aparece, verifica el dominio parent en api-config.js y que el canal esté transmitiendo.';
    });
    $('pfV9Search')?.addEventListener('click',()=>{const q=text('pfV9Channel') || 'videojuegos'; window.open('https://www.twitch.tv/search?term='+encodeURIComponent(q),'_blank','noopener,noreferrer');});
  }
  function setupReports() {
    const form=$('pfV9ReportForm'); if (!form) return;
    const refresh=()=>{renderList('pfV9ReportList',readList(REPORTS_KEY),'report'); updateDashboard();};
    form.addEventListener('submit', async (event)=>{
      event.preventDefault();
      const record={id:crypto?.randomUUID?.() || String(Date.now()), tipo:text('pfV9ReportType'), resumen:text('pfV9ReportTitle'), detalle:text('pfV9ReportDetail'), pagina:location.href, navegador:navigator.userAgent, fecha:new Date().toISOString()};
      const status=$('pfV9ReportStatus');
      let remoto=false, errorRemoto='';
      try {
        await insertRemote('pf_v9_reports', { id: record.id, tipo:record.tipo, resumen:record.resumen, detalle:record.detalle, pagina_url:record.pagina, navegador:record.navegador, estado:'pendiente' });
        remoto=true;
      } catch (error) { errorRemoto=errorShort(error); console.warn('PixelForge reportes: no se pudo guardar en Supabase:', error); }
      const items=readList(REPORTS_KEY); items.push({...record, almacenamiento:remoto?'supabase':'local'});
      const ok=writeList(REPORTS_KEY,items);
      if (status) status.textContent=remoto
        ? 'Reporte recibido en PixelForge y enviado al panel administrativo. Se conservó una copia de respaldo local.'
        : (ok ? 'Reporte guardado solo en este navegador. No llegó al panel administrativo; ejecuta la migración SQL V9 y verifica Supabase. Detalle: '+errorRemoto : 'El navegador no permitió guardar el reporte; descarga el contenido o revisa el almacenamiento.');
      if (ok || remoto) { form.reset(); refresh(); }
    });
    $('pfV9ExportReports')?.addEventListener('click',()=>downloadJson('pixelforge-reportes-v9.json',readList(REPORTS_KEY)));
    refresh();
  }
  function setupCreatorHub() {
    const cfg = window.PIXELFORGE_CONFIG || {};
    const fee = Number.isFinite(Number(cfg.creatorRecoveryFeeMxn)) && Number(cfg.creatorRecoveryFeeMxn) >= 0
      ? Number(cfg.creatorRecoveryFeeMxn) : 50;
    const feeLabel = $('pfCreatorFeeLabel');
    if (feeLabel) feeLabel.textContent = fee.toLocaleString('es-MX', {style:'currency', currency:'MXN', maximumFractionDigits:0}) + ' MXN';

    const hasGame = $('pfCreatorHasGame');
    const hasStreamed = $('pfCreatorHasStreamed');
    const gameDetails = $('pfCreatorGameDetails');
    const streamDetails = $('pfCreatorStreamDetails');
    const beginnerNotice = $('pfCreatorBeginnerNotice');
    const syncBeginnerNotice = () => { if (beginnerNotice) beginnerNotice.hidden = !(hasGame?.value === 'no' && hasStreamed?.value === 'no'); };
    const syncConditional = (select, container, requiredIds) => {
      if (!select || !container) return;
      const visible = select.value !== 'no';
      container.hidden = !visible;
      container.querySelectorAll('input,select,textarea').forEach(el => { el.disabled = !visible; if (!visible) el.value = ''; });
      requiredIds.forEach(id => { const el=$(id); if (el) el.required = visible; });
    };
    hasGame?.addEventListener('change', () => syncConditional(hasGame, gameDetails, ['pfCreatorGameName']));
    hasStreamed?.addEventListener('change', () => { syncConditional(hasStreamed, streamDetails, []); syncBeginnerNotice(); });
    hasGame?.addEventListener('change', syncBeginnerNotice);
    syncConditional(hasGame, gameDetails, ['pfCreatorGameName']);
    syncConditional(hasStreamed, streamDetails, []);
    syncBeginnerNotice();

    const creatorForm = $('pfCreatorForm');
    creatorForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const hasGameValue = text('pfCreatorHasGame');
      const hasStreamedValue = text('pfCreatorHasStreamed');
      const record = {
        id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()),
        nombre: text('pfCreatorName'), alias: text('pfCreatorAlias'), correo: text('pfCreatorEmail'),
        perfil: text('pfCreatorRole'), nombreIdeaVideojuego: text('pfCreatorIdeaName'), conceptoVideojuego: text('pfCreatorIdeaConcept'),
        yaCreoVideojuego: hasGameValue, yaHizoStreams: hasStreamedValue, videojuego: text('pfCreatorGameName'), enlaceVideojuego: text('pfCreatorGameLink'),
        experienciaDesarrollo: text('pfCreatorGameDetailsText'), plataformaStream: text('pfCreatorPlatform'),
        canalStream: text('pfCreatorStreamLink'), experienciaStream: text('pfCreatorStreamExperience'),
        propuesta: text('pfCreatorBio'), aceptaCuotaInformada: Boolean($('pfCreatorFeeConsent')?.checked),
        aceptaRevisionDatos: Boolean($('pfCreatorDataConsent')?.checked), cuotaRecuperacionMXN: fee,
        estado: 'Pendiente de revisión', fecha: new Date().toISOString()
      };
      const status = $('pfCreatorStatus');
      const mailLink = $('pfCreatorMailLink');
      let remoto = false, errorRemoto = '';
      try {
        await insertRemote('pf_v9_creator_applications', {
          id: record.id,
          nombre_publico: record.nombre, alias: record.alias, correo: record.correo, perfil: record.perfil,
          nombre_idea_videojuego: record.nombreIdeaVideojuego || null, concepto_videojuego: record.conceptoVideojuego || null,
          ya_creo_videojuego: hasGameValue, ya_hizo_streams: hasStreamedValue,
          videojuego_existente: record.videojuego || null, enlace_videojuego: record.enlaceVideojuego || null,
          experiencia_desarrollo: record.experienciaDesarrollo || null, plataforma_stream: record.plataformaStream || null,
          canal_stream: record.canalStream || null, experiencia_stream: record.experienciaStream || null,
          propuesta: record.propuesta, acepta_cuota_informada: record.aceptaCuotaInformada,
          acepta_revision_datos: record.aceptaRevisionDatos, cuota_recuperacion_mxn: fee,
          estado: 'pendiente', cuota_estado: 'no_cobrada'
        });
        remoto = true;
      } catch (error) { errorRemoto = errorShort(error); console.warn('PixelForge creadores: no se pudo guardar en Supabase:', error); }
      const items = readList(CREATOR_REQUESTS_KEY); items.push({...record, almacenamiento: remoto ? 'supabase' : 'local'});
      const ok = writeList(CREATOR_REQUESTS_KEY, items);
      if (ok || remoto) {
        const tieneExperiencia = hasGameValue === 'si' || hasGameValue === 'en_proceso' || hasStreamedValue === 'si';
        if (status) status.textContent = remoto
          ? (tieneExperiencia ? 'Solicitud recibida en el panel de administración y marcada para evaluación como posible colaborador. ' : 'Solicitud recibida en el panel de administración. Revisa también la guía para principiantes. ') + 'Se conservó una copia de respaldo local; la cuota no se cobra al enviar.'
          : (tieneExperiencia ? 'Solicitud guardada solo en este navegador y marcada para futura evaluación como colaborador. ' : 'Solicitud guardada solo en este navegador; revisa la guía para principiantes. ') + 'No llegó al panel administrativo. Ejecuta el SQL V9 y verifica Supabase. Detalle: ' + errorRemoto;
        const contactEmail = String(cfg.applicationEmail || cfg.contactEmail || '').trim();
        if (mailLink && contactEmail && !remoto) {
          const lines = Object.entries(record).map(([key,value]) => `${key}: ${value}`).join('\n');
          mailLink.href = 'mailto:' + contactEmail + '?subject=' + encodeURIComponent('Solicitud de creador PixelForge — ' + record.alias) + '&body=' + encodeURIComponent(lines);
          mailLink.hidden = false;
          mailLink.textContent = 'Preparar correo de respaldo';
        } else if (mailLink) mailLink.hidden = true;
        creatorForm.reset();
        syncConditional(hasGame, gameDetails, ['pfCreatorGameName']);
        syncConditional(hasStreamed, streamDetails, []);
        syncBeginnerNotice();
        updateDashboard();
      } else if (status) status.textContent = 'No se pudo guardar la solicitud. Comprueba el almacenamiento del navegador.';
    });
    $('pfCreatorExport')?.addEventListener('click', () => downloadJson('pixelforge-solicitudes-creadores.json', readList(CREATOR_REQUESTS_KEY)));

    const streamForm = $('pfStreamRequestForm');
    streamForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const record = {
        id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()),
        nombre: text('pfStreamRequestName'), correo: text('pfStreamRequestEmail'), plataforma: text('pfStreamRequestPlatform'),
        urlCanal: text('pfStreamRequestUrl'), contenido: text('pfStreamRequestContent'),
        permisoDeclarado: Boolean($('pfStreamRequestPermission')?.checked), aceptaReglas: Boolean($('pfStreamRequestRules')?.checked),
        estado: 'Pendiente de revisión de permiso', fecha: new Date().toISOString()
      };
      const status = $('pfStreamRequestStatus');
      const mailLink = $('pfStreamRequestMailLink');
      const contactEmail = String(cfg.applicationEmail || cfg.contactEmail || '').trim();
      let remoto = false, errorRemoto = '';
      try {
        await insertRemote('pf_v9_stream_requests', {
          id: record.id,
          nombre_publico: record.nombre, correo: record.correo, plataforma: record.plataforma,
          url_canal: record.urlCanal, contenido: record.contenido, permiso_declarado: record.permisoDeclarado,
          acepta_reglas: record.aceptaReglas, estado: 'pendiente'
        });
        remoto = true;
      } catch (error) { errorRemoto = errorShort(error); console.warn('PixelForge streams: no se pudo guardar en Supabase:', error); }
      const items = readList(STREAM_REQUESTS_KEY); items.push({...record, almacenamiento: remoto ? 'supabase' : 'local'});
      const ok = writeList(STREAM_REQUESTS_KEY, items);
      if (ok || remoto) {
        if (status) status.textContent = remoto
          ? 'Solicitud recibida en el panel administrativo y pendiente de revisión. El canal no se publica automáticamente.'
          : 'Solicitud guardada solo en este navegador. No llegó al panel de administración. Ejecuta el SQL V9 y verifica Supabase. Detalle: ' + errorRemoto;
        if (mailLink && contactEmail && !remoto) {
          const lines = Object.entries(record).map(([key,value]) => `${key}: ${value}`).join('\n');
          mailLink.href = 'mailto:' + contactEmail + '?subject=' + encodeURIComponent('Solicitud de permiso para stream — ' + record.nombre) + '&body=' + encodeURIComponent(lines);
          mailLink.hidden = false;
          mailLink.textContent = 'Preparar correo de respaldo';
        } else if (mailLink) mailLink.hidden = true;
        streamForm.reset(); updateDashboard();
      } else if (status) status.textContent = 'No se pudo guardar la solicitud. Revisa el almacenamiento del navegador.';
    });
    $('pfStreamRequestExport')?.addEventListener('click', () => downloadJson('pixelforge-solicitudes-stream.json', readList(STREAM_REQUESTS_KEY)));

    const approvedRoot = $('pfApprovedStreams');
    const approved = Array.isArray(cfg.featuredStreams) ? cfg.featuredStreams : [];
    if (approvedRoot) {
      approvedRoot.replaceChildren();
      if (!approved.length) {
        const p = document.createElement('p'); p.className='pf-v9-empty';
        p.textContent='Todavía no hay canales destacados configurados. Cuando una solicitud se revise y se autorice, agrega el canal a featuredStreams en api-config.js.';
        approvedRoot.append(p);
      } else {
        approved.forEach((item) => {
          if (!item || typeof item.channel !== 'string' || !/^[A-Za-z0-9_]{1,60}$/.test(item.channel)) return;
          const card=document.createElement('article'); card.className='pf-v9-local-item';
          const title=document.createElement('strong'); title.textContent=String(item.name || item.channel);
          const detail=document.createElement('p'); detail.textContent='Twitch · Canal configurado para aparecer en PixelForge';
          const button=document.createElement('button'); button.type='button'; button.className='boton'; button.textContent='Ver directo';
          button.addEventListener('click',()=>{
            const channelInput=$('pfV9Channel'); if(channelInput) channelInput.value=item.channel;
            const form=$('pfV9StreamForm');
            if(form) { location.hash='#streamers'; form.requestSubmit(); }
          });
          card.append(title,detail,button); approvedRoot.append(card);
        });
      }
    }
    void loadPublicFeaturedStreams();
    updateDashboard();
  }
  const STATUS_CREATOR = [['pendiente','Pendiente'],['en_revision','En revisión'],['aprobada','Aprobada / colaborador'],['rechazada','Rechazada'],['archivada','Archivada']];
  const STATUS_FEE = [['no_cobrada','No cobrada'],['pendiente','Pendiente de pago'],['confirmada','Pago confirmado manualmente'],['exenta','Exenta'],['cancelada','Cancelada']];
  const STATUS_STREAM = [['pendiente','Pendiente'],['en_revision','En revisión'],['aprobada','Aprobada'],['rechazada','Rechazada']];
  const STATUS_REPORT = [['pendiente','Pendiente'],['en_revision','En revisión'],['resuelto','Resuelto'],['cerrado','Cerrado']];
  function setAdminGate(message, authorized) {
    if ($('pfAdminGate')) $('pfAdminGate').textContent = message;
    if ($('pfAdminWorkspace')) $('pfAdminWorkspace').hidden = !authorized;
  }
  function appendText(parent, tag, value, className) {
    const el = document.createElement(tag); if (className) el.className = className; el.textContent = safeDisplay(value); parent.append(el); return el;
  }
  function makeSelect(options, value) {
    const select = document.createElement('select'); select.className = 'pf-admin-select';
    options.forEach(([val,label]) => { const option=document.createElement('option'); option.value=val; option.textContent=label; select.append(option); });
    select.value = options.some(o=>o[0]===value) ? value : options[0][0]; return select;
  }
  function adminAction(label, handler, secondary=false) {
    const b=document.createElement('button'); b.type='button'; b.className=secondary?'boton boton-secundario':'boton'; b.textContent=label;
    b.addEventListener('click', async()=>{ b.disabled=true; try { await handler(); } catch(error) { const st=$('pfAdminStatus'); if(st) st.textContent='No se completó la acción: '+errorShort(error); console.error(error); } finally { b.disabled=false; } });
    return b;
  }
  async function adminSetStatus(table,id,fields) { await updateRemote(table,id,fields); }
  async function loadAdminPanel() {
    const nav=$('pfAdminNavLink'); const isAdmin=adminAllowed();
    if(nav) nav.hidden=!isAdmin;
    if(!isAdmin) { setAdminGate('Acceso restringido. Inicia sesión con una cuenta incluida en pixelforge_admins para utilizar este panel.',false); return; }
    const db=dbClient();
    if(!db) { setAdminGate('No se pudo conectar con Supabase. Verifica la configuración de la web.',false); return; }
    setAdminGate('Administrador verificado. Cargando solicitudes y reportes…',true);
    const status=$('pfAdminStatus'); if(status) status.textContent='';
    const specs = [
      ['pf_v9_creator_applications', 'pfAdminCreatorCount', 'pfAdminCreatorList', renderAdminCreators],
      ['pf_v9_stream_requests', 'pfAdminStreamCount', 'pfAdminStreamList', renderAdminStreams],
      ['pf_v9_reports', 'pfAdminReportCount', 'pfAdminReportList', renderAdminReports]
    ];
    const results = await Promise.all(specs.map(async ([table]) => {
      try {
        const response = await db.from(table).select('*').order('created_at',{ascending:false}).limit(100);
        if (response.error) throw response.error;
        return { data: response.data || [], error: null };
      } catch (error) { return { data: [], error }; }
    }));
    let failures = 0;
    results.forEach((result, index) => {
      const [table, countId, listId, renderer] = specs[index];
      const countNode = $(countId);
      if (result.error) {
        failures++;
        if (countNode) countNode.textContent = '—';
        const list = $(listId);
        if (list) { list.replaceChildren(); appendText(list, 'p', table + ': ' + errorShort(result.error), 'pf-v9-empty'); }
        console.error('Panel administrador V9 (' + table + '):', result.error);
      } else {
        if (countNode) countNode.textContent = String(result.data.length);
        renderer(result.data);
      }
    });
    const creators = results[0].data;
    $('pfAdminFeeCount').textContent = results[0].error ? '—' : String(creators.filter(x=>['pendiente','no_cobrada'].includes(x.cuota_estado) && x.estado==='aprobada').length);
    if (failures) {
      setAdminGate('Administrador verificado. Algunas tablas no pudieron sincronizarse; revisa el detalle de cada sección.',true);
      if(status) status.textContent='Sincronización parcial: '+(3-failures)+' de 3 tablas V9 cargadas. Revisa migraciones y políticas RLS. Última revisión: '+new Date().toLocaleTimeString('es-MX')+'.';
    } else {
      setAdminGate('Administrador verificado. Datos actualizados desde Supabase.',true);
      if(status) status.textContent='Datos actualizados desde Supabase. Última actualización: '+new Date().toLocaleTimeString('es-MX')+'.';
    }
  }
  function renderAdminCreators(items) {
    const root=$('pfAdminCreatorList'); if(!root)return; root.replaceChildren();
    if(!items.length){appendText(root,'p','No hay solicitudes de creadores registradas.','pf-v9-empty');return;}
    items.forEach(item=>{
      const card=document.createElement('article'); card.className='pf-admin-card';
      appendText(card,'h4',`${item.alias||item.nombre_publico||'Creador'} · ${item.perfil||'sin perfil'}`);
      appendText(card,'p',`${item.nombre_publico||''} · ${item.correo||''}`);
      appendText(card,'p',`Juego: ${item.ya_creo_videojuego||'—'} · Streams previos: ${item.ya_hizo_streams||'—'}`);
      if(item.nombre_idea_videojuego) appendText(card,'p','Idea: '+item.nombre_idea_videojuego);
      if(item.concepto_videojuego) appendText(card,'p','Concepto: '+item.concepto_videojuego);
      if(item.videojuego_existente) appendText(card,'p','Proyecto anterior: '+item.videojuego_existente);
      if(item.enlace_videojuego) { const a=document.createElement('a'); a.href=item.enlace_videojuego; a.target='_blank'; a.rel='noopener noreferrer'; a.textContent='Ver demo/portafolio'; card.append(a); }
      if(item.canal_stream) { const a=document.createElement('a'); a.href=item.canal_stream; a.target='_blank'; a.rel='noopener noreferrer'; a.textContent='Ver canal de stream'; card.append(a); }
      if(item.propuesta) appendText(card,'p','Propuesta: '+item.propuesta);
      appendText(card,'small',`Recibida: ${dateLabel(item.created_at)} · Cuota sugerida: $${Number(item.cuota_recuperacion_mxn||0).toFixed(2)} MXN`);
      const controls=document.createElement('div'); controls.className='pf-admin-controls';
      const state=makeSelect(STATUS_CREATOR,item.estado); const fee=makeSelect(STATUS_FEE,item.cuota_estado);
      const save=adminAction('Guardar estado',async()=>{await adminSetStatus('pf_v9_creator_applications',item.id,{estado:state.value,cuota_estado:fee.value}); const st=$('pfAdminStatus'); if(st)st.textContent='Solicitud de creador actualizada. El pago se registra de forma manual; no se procesó ningún cobro.'; await loadAdminPanel();});
      appendText(controls,'label','Solicitud'); controls.append(state); appendText(controls,'label','Cuota'); controls.append(fee,save);
      card.append(controls); root.append(card);
    });
  }
  function extractTwitchChannel(item) {
    if(item.plataforma!=='Twitch')return null;
    try { const u=new URL(item.url_canal); if(!/(^|\.)twitch\.tv$/i.test(u.hostname))return null; const slug=u.pathname.split('/').filter(Boolean)[0]||''; return /^[A-Za-z0-9_]{1,60}$/.test(slug)?slug:null; } catch {return null;}
  }
  async function approveAndFeatureStream(item) {
    await adminSetStatus('pf_v9_stream_requests',item.id,{estado:'aprobada'});
    const db=dbClient(); const row={solicitud_id:item.id,nombre_publico:item.nombre_publico,plataforma:item.plataforma,url_canal:item.url_canal,canal_twitch:extractTwitchChannel(item),activo:true};
    const {error}=await db.from('pf_v9_featured_streams').upsert(row,{onConflict:'solicitud_id'});
    if(error) throw error;
    if($('pfAdminStatus')) $('pfAdminStatus').textContent='Solicitud aprobada y canal destacado. Revisa que la autorización sea válida antes de publicar.';
    await loadAdminPanel(); await loadPublicFeaturedStreams();
  }
  function renderAdminStreams(items) {
    const root=$('pfAdminStreamList'); if(!root)return; root.replaceChildren();
    if(!items.length){appendText(root,'p','No hay solicitudes de stream registradas.','pf-v9-empty');return;}
    items.forEach(item=>{
      const card=document.createElement('article'); card.className='pf-admin-card';
      appendText(card,'h4',item.nombre_publico||'Canal sin nombre');
      appendText(card,'p',`${item.correo||''} · ${item.plataforma||''}`);
      const a=document.createElement('a'); a.href=item.url_canal; a.target='_blank'; a.rel='noopener noreferrer'; a.textContent='Abrir canal solicitado'; card.append(a);
      appendText(card,'p',item.contenido||'Sin descripción de contenido');
      appendText(card,'small',`Permiso declarado: ${item.permiso_declarado?'sí':'no'} · Reglas aceptadas: ${item.acepta_reglas?'sí':'no'} · ${dateLabel(item.created_at)}`);
      const controls=document.createElement('div'); controls.className='pf-admin-controls';
      const state=makeSelect(STATUS_STREAM,item.estado);
      controls.append(state,adminAction('Guardar estado',async()=>{await adminSetStatus('pf_v9_stream_requests',item.id,{estado:state.value}); if($('pfAdminStatus'))$('pfAdminStatus').textContent='Estado de solicitud de stream actualizado.'; await loadAdminPanel();},true));
      if(item.estado!=='aprobada') controls.append(adminAction('Aprobar y destacar canal',()=>approveAndFeatureStream(item)));
      else controls.append(adminAction('Volver a destacar',()=>approveAndFeatureStream(item),true));
      const deactivate=adminAction('Retirar de destacados',async()=>{const db=dbClient(); const {error}=await db.from('pf_v9_featured_streams').update({activo:false}).eq('solicitud_id',item.id); if(error)throw error; await loadPublicFeaturedStreams(); if($('pfAdminStatus'))$('pfAdminStatus').textContent='Canal retirado de destacados; la solicitud se conserva.';},true);
      controls.append(deactivate); card.append(controls); root.append(card);
    });
  }
  function renderAdminReports(items) {
    const root=$('pfAdminReportList'); if(!root)return; root.replaceChildren();
    if(!items.length){appendText(root,'p','No hay reportes registrados.','pf-v9-empty');return;}
    items.forEach(item=>{
      const card=document.createElement('article'); card.className='pf-admin-card';
      appendText(card,'h4',`${item.tipo||'Reporte'} · ${item.resumen||'Sin resumen'}`);
      appendText(card,'p',item.detalle||'Sin detalle');
      appendText(card,'small',`${dateLabel(item.created_at)} · ${item.pagina_url||''}`);
      const controls=document.createElement('div'); controls.className='pf-admin-controls'; const state=makeSelect(STATUS_REPORT,item.estado);
      controls.append(state,adminAction('Guardar estado',async()=>{await adminSetStatus('pf_v9_reports',item.id,{estado:state.value}); if($('pfAdminStatus'))$('pfAdminStatus').textContent='Estado del reporte actualizado.'; await loadAdminPanel();}));
      card.append(controls); root.append(card);
    });
  }
  async function loadPublicFeaturedStreams() {
    const root=$('pfApprovedStreams'); if(!root)return;
    const db=dbClient(); if(!db)return;
    try {
      const {data,error}=await db.from('pf_v9_featured_streams').select('id,nombre_publico,plataforma,url_canal,canal_twitch,activo').eq('activo',true).order('created_at',{ascending:false}).limit(50);
      if(error)throw error;
      root.replaceChildren();
      if(!data?.length){appendText(root,'p','Todavía no hay canales con permiso confirmados para aparecer aquí.','pf-v9-empty');return;}
      data.forEach(item=>{
        const card=document.createElement('article'); card.className='pf-v9-local-item';
        appendText(card,'strong',item.nombre_publico||item.canal_twitch||'Canal destacado');
        appendText(card,'p',item.plataforma+' · canal aprobado por PixelForge');
        if(item.plataforma==='Twitch' && item.canal_twitch) {
          card.append(adminAction('Ver directo',()=>{const inp=$('pfV9Channel');const form=$('pfV9StreamForm');if(inp)inp.value=item.canal_twitch;location.hash='#streamers';form?.requestSubmit();}));
        } else {
          const a=document.createElement('a');a.href=item.url_canal;a.target='_blank';a.rel='noopener noreferrer';a.className='boton';a.textContent='Abrir directo';card.append(a);
        }
        root.append(card);
      });
    } catch(error) { console.warn('No se pudo cargar la lista pública de streams destacados:',error); }
  }
  function setupAdminPanel() {
    const nav=$('pfAdminNavLink');
    if(nav) nav.hidden=!adminAllowed();
    $('pfAdminRefresh')?.addEventListener('click',loadAdminPanel);
    window.addEventListener('pixelforge:supabase-sync-complete', () => { if (adminAllowed()) loadAdminPanel(); });
    window.addEventListener('pixelforge:admin-state',()=>{if(nav)nav.hidden=!adminAllowed();if(location.hash==='#administracion')loadAdminPanel();});
    window.addEventListener('pixelforge:auth',()=>{if(location.hash==='#administracion')setTimeout(loadAdminPanel,0);});
    window.addEventListener('hashchange',()=>{if(location.hash==='#administracion')loadAdminPanel();});
    if(location.hash==='#administracion') loadAdminPanel();
  }
  function setContact(id, value, kind) {
    const el=$(id); if (!el || !value) return;
    let href=value;
    if (kind==='email') href='mailto:'+value;
    if (kind==='whatsapp') href='https://wa.me/'+value.replace(/\D/g,'');
    if (kind==='social') { if (!/^https?:\/\//i.test(href)) href='https://'+href; }
    el.textContent=value; el.href=href; el.target=kind==='email' || kind==='whatsapp' ? '_self' : '_blank';
    if (el.target==='_blank') el.rel='noopener noreferrer';
  }
  function setupContacts() {
    const cfg=window.PIXELFORGE_CONFIG || {};
    setContact('pfV9ContactEmail',String(cfg.contactEmail||'').trim(),'email');
    setContact('pfV9ContactWhatsapp',String(cfg.whatsapp||'').trim(),'whatsapp');
    setContact('pfV9ContactSocial',String(cfg.social||'').trim(),'social');
  }
  function init() {
    setupStream(); setupReports(); setupCreatorHub(); setupContacts(); setupAdminPanel(); updateDashboard();
    document.querySelectorAll('[data-favorito]').forEach(button=>button.addEventListener('click',()=>setTimeout(updateDashboard,80)));
    const catalogue=document.getElementById('catalogoDinamico');
    if (catalogue && window.MutationObserver) new MutationObserver(updateDashboard).observe(catalogue,{childList:true,subtree:true});
    const games=document.getElementById('contenedorJuegos');
    if (games && window.MutationObserver) new MutationObserver(updateDashboard).observe(games,{childList:true,subtree:true});
    window.addEventListener('storage',updateDashboard);
    window.addEventListener('hashchange',updateDashboard);
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
