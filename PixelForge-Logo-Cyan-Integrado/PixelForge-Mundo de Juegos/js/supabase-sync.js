(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const bridge = () => window.PIXELFORGE_ADMIN_BRIDGE || null;
  const db = () => bridge()?.getClient?.() || null;
  const isAdmin = () => Boolean(bridge()?.isAdmin?.());
  const currentUser = () => bridge()?.getUser?.() || null;
  const V10_QUEUE_KEY = 'pixelforge_v10_pending_sync_v1';
  const QUEUES = {
    reports: { key: 'pixelforge_v9_reportes_local', table: 'pf_v9_reports' },
    creators: { key: 'pixelforge_v9_solicitudes_creadores', table: 'pf_v9_creator_applications' },
    streams: { key: 'pixelforge_v9_solicitudes_stream', table: 'pf_v9_stream_requests' }
  };
  const TABLES = [
    ['pixelforge_admins','Administradores'],['catalogo_publico','Catálogo público'],['propuestas_videojuegos','Propuestas de videojuegos'],
    ['pf_v9_creator_applications','Solicitudes de creadores'],['pf_v9_stream_requests','Solicitudes de stream'],['pf_v9_featured_streams','Streams destacados'],['pf_v9_reports','Reportes'],
    ['pf_v10_collaborators','Colaboradores'],['pf_v10_advice_requests','Asesorías'],['pf_v10_polls','Sondeos'],['pf_v10_poll_votes','Votos'],
    ['pf_rbac_roles','Roles'],['pf_rbac_permissions','Permisos'],['pf_rbac_role_permissions','Permisos por rol'],['pf_rbac_user_roles','Roles de usuarios'],['pf_rbac_audit','Historial de roles']
  ];
  let busy = false;

  function read(key) { try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } }
  function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { console.warn('PixelForge sync localStorage:', e); return false; } }
  function uuid() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random()*16|0; return (c==='x'?r:(r&3|8)).toString(16); });
  }
  function stableId(item) {
    const valid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
    if (valid(item.supabase_sync_id)) return item.supabase_sync_id;
    if (valid(item.id)) return item.id;
    item.supabase_sync_id = uuid();
    return item.supabase_sync_id;
  }
  function dateValue(value) { const d = value ? new Date(value) : new Date(); return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString(); }
  function setStatus(message, error=false) { const node=$('pfSupabaseSyncStatus'); if(node){node.textContent=message;node.classList.toggle('pf-sync-error',error);} }
  function ensurePanel() {
    const workspace=$('pfAdminWorkspace');
    if (!workspace || $('pfSupabaseSyncPanel')) return;
    const section=document.createElement('section'); section.id='pfSupabaseSyncPanel'; section.className='pf-sync-panel pf-admin-block';
    section.innerHTML=`
      <div class="pf-sync-head"><div><p class="etiqueta">PIXELFORGE · CONEXIÓN Y DATOS</p><h3>Sincronización con Supabase</h3><p class="descripcion">Comprueba qué tablas existen, cuántos registros hay y recupera respaldos locales pendientes de envío.</p></div><div class="pf-sync-actions"><button type="button" class="boton boton-secundario" id="pfSupabaseCheck">Revisar conexión</button><button type="button" class="boton" id="pfSupabaseRun">Sincronizar respaldos</button></div></div>
      <p id="pfSupabaseSyncStatus" class="pf-sync-status" role="status" aria-live="polite">Esperando revisión de Supabase…</p>
      <div class="pf-sync-summary"><article><span>Respaldos pendientes</span><strong id="pfSyncPendingCount">0</strong></article><article><span>Tablas detectadas</span><strong id="pfSyncTableCount">—</strong></article><article><span>Última revisión</span><strong id="pfSyncLastCheck">—</strong></article></div>
      <div class="pf-sync-table-wrap"><table class="pf-sync-table"><thead><tr><th>Área</th><th>Tabla Supabase</th><th>Registros</th><th>Estado</th></tr></thead><tbody id="pfSyncTableBody"><tr><td colspan="4">Presiona “Revisar conexión”.</td></tr></tbody></table></div>
      <p class="pf-sync-note">Los respaldos locales solo existen en el navegador y dispositivo donde se enviaron. Esta función no puede recuperar datos que nunca llegaron a Supabase desde otro dispositivo o que fueron borrados del navegador.</p>`;
    workspace.append(section);
    $('pfSupabaseCheck')?.addEventListener('click',checkRemote);
    $('pfSupabaseRun')?.addEventListener('click',runSync);
    updatePendingCount();
  }
  function updatePendingCount() {
    let total=0;
    Object.values(QUEUES).forEach(q => { total += read(q.key).filter(x => x.almacenamiento !== 'supabase').length; });
    total += read(V10_QUEUE_KEY).length;
    const node=$('pfSyncPendingCount'); if(node) node.textContent=String(total);
  }
  function setButtonState(disabled) { ['pfSupabaseCheck','pfSupabaseRun'].forEach(id=>{const b=$(id);if(b)b.disabled=disabled;}); }
  function renderRows(rows) {
    const body=$('pfSyncTableBody'); if(!body)return; body.replaceChildren();
    const byName=new Map((rows||[]).map(r=>[r.relation_name,r]));
    let found=0;
    TABLES.forEach(([name,label])=>{
      const info=byName.get(name); const tr=document.createElement('tr');
      const cells=[label,name,info?.is_present ? Number(info.row_count).toLocaleString('es-MX') : '—',info?.is_present ? 'Disponible' : 'Falta tabla'];
      if(info?.is_present) found++;
      cells.forEach((value,i)=>{const td=document.createElement('td');td.textContent=String(value);if(i===3)td.className=info?.is_present?'pf-sync-ok':'pf-sync-bad';tr.append(td);});body.append(tr);
    });
    const count=$('pfSyncTableCount'); if(count) count.textContent=found+' / '+TABLES.length;
    const last=$('pfSyncLastCheck'); if(last) last.textContent=new Date().toLocaleTimeString('es-MX');
  }
  async function checkRemote() {
    if (!isAdmin()) { setStatus('Inicia sesión con una cuenta de superadministrador.',true); return; }
    const client=db(); if(!client){setStatus('No hay cliente Supabase inicializado. Revisa js/config.js y la conexión.',true);return;}
    setButtonState(true); setStatus('Consultando inventario directamente en Supabase…');
    try {
      const {data,error}=await client.rpc('pf_admin_sync_overview');
      if(error) throw error;
      renderRows(data||[]);
      const missing=(data||[]).filter(r=>!r.is_present).map(r=>r.relation_name);
      setStatus(missing.length ? 'Conexión correcta. Faltan '+missing.length+' tablas: '+missing.join(', ')+'. Ejecuta database/pixelforge.sql y database/roles.sql según corresponda.' : 'Conexión correcta. Todas las tablas de PixelForge están presentes y se consultaron desde Supabase.');
    } catch(e) {
      console.error('PixelForge Supabase sync check:',e);
      setStatus('No se pudo consultar el inventario: '+(e.message||e)+'. Ejecuta database/supabase-sync.sql y vuelve a revisar.',true);
      const body=$('pfSyncTableBody'); if(body){body.replaceChildren();const tr=document.createElement('tr');const td=document.createElement('td');td.colSpan=4;td.textContent='No se pudo ejecutar pf_admin_sync_overview: '+(e.message||e);tr.append(td);body.append(tr);}
    } finally { setButtonState(false); }
  }
  function buildV9Payload(type,item) {
    const id=stableId(item); const created_at=dateValue(item.fecha || item.created_at);
    if(type==='reports') return {id,created_at,created_by:null,tipo:String(item.tipo||'Reporte').slice(0,80),resumen:String(item.resumen||'Reporte importado').slice(0,120),detalle:String(item.detalle||'Sin detalle').slice(0,2500),pagina_url:item.pagina||item.pagina_url||null,navegador:item.navegador||null,estado:'pendiente'};
    if(type==='creators') {
      if(item.aceptaCuotaInformada!==true || item.aceptaRevisionDatos!==true) throw new Error('No se puede importar: el respaldo no conserva las dos aceptaciones obligatorias.');
      const hasGame=['si','no','en_proceso'].includes(item.yaCreoVideojuego)?item.yaCreoVideojuego:'no';
      const hasStreams=['si','no'].includes(item.yaHizoStreams)?item.yaHizoStreams:'no';
      return {id,created_at,created_by:null,nombre_publico:String(item.nombre||'Usuario importado').slice(0,100),alias:String(item.alias||'Usuario').slice(0,60),correo:String(item.correo||'sin-correo@local.invalid').slice(0,160),perfil:['desarrollador','streamer','ambos'].includes(item.perfil)?item.perfil:'desarrollador',nombre_idea_videojuego:item.nombreIdeaVideojuego||null,concepto_videojuego:item.conceptoVideojuego||null,ya_creo_videojuego:hasGame,ya_hizo_streams:hasStreams,videojuego_existente:item.videojuego||null,enlace_videojuego:item.enlaceVideojuego||null,experiencia_desarrollo:item.experienciaDesarrollo||null,plataforma_stream:item.plataformaStream||null,canal_stream:item.canalStream||null,experiencia_stream:item.experienciaStream||null,propuesta:String(item.propuesta||'Solicitud importada desde respaldo local').slice(0,2000),acepta_cuota_informada:true,acepta_revision_datos:true,cuota_recuperacion_mxn:Number(item.cuotaRecuperacionMXN)||50,cuota_estado:'no_cobrada',estado:'pendiente'};
    }
    if(item.permisoDeclarado!==true || item.aceptaReglas!==true) throw new Error('No se puede importar: el respaldo no conserva la autorización del canal y la aceptación de reglas.');
    return {id,created_at,created_by:null,nombre_publico:String(item.nombre||'Canal importado').slice(0,100),correo:String(item.correo||'sin-correo@local.invalid').slice(0,160),plataforma:item.plataforma==='YouTube'?'YouTube':'Twitch',url_canal:String(item.urlCanal||'https://example.invalid').slice(0,500),contenido:String(item.contenido||'Solicitud importada desde respaldo local').slice(0,1200),permiso_declarado:true,acepta_reglas:true,estado:'pendiente'};
  }
  async function syncV9() {
    const client=db(); let synced=0, failed=0, skipped=0;
    for (const [type,queue] of Object.entries(QUEUES)) {
      const items=read(queue.key);
      for (const item of items) {
        if (item.almacenamiento==='supabase') { skipped++; continue; }
        try {
          const payload=buildV9Payload(type,item);
          const {error}=await client.from(queue.table).upsert(payload,{onConflict:'id',ignoreDuplicates:true});
          if(error) throw error;
          item.almacenamiento='supabase'; item.sincronizado_en=new Date().toISOString(); delete item.error_sincronizacion; synced++;
        } catch(e) { item.error_sincronizacion=String(e.message||e); failed++; }
        write(queue.key,items);
      }
    }
    return {synced,failed,skipped};
  }
  async function syncV10OwnQueue() {
    const client=db(), user=currentUser(); const queue=read(V10_QUEUE_KEY); if(!client||!user?.id||user.id==='invitado-local') return {synced:0,failed:0,pending:queue.length};
    const keep=[]; let synced=0, failed=0;
    for(const entry of queue) {
      if(entry.user_id && entry.user_id!==user.id) { keep.push(entry); continue; }
      try {
        let response;
        if(entry.type==='report') response=await client.from('pf_v9_reports').upsert({...entry.payload,created_by:user.id},{onConflict:'id',ignoreDuplicates:true});
        else if(entry.type==='collaborator') {
          response=await client.from('pf_v10_collaborators').insert(entry.payload);
          if(response.error?.code==='23505') response={error:null};
        }
        else if(entry.type==='advice') response=await client.from('pf_v10_advice_requests').upsert(entry.payload,{onConflict:'id',ignoreDuplicates:true});
        else throw new Error('Tipo de respaldo desconocido: '+entry.type);
        if(response.error) throw response.error;
        synced++;
      } catch(e) { entry.last_error=String(e.message||e); keep.push(entry); failed++; }
    }
    write(V10_QUEUE_KEY,keep);
    return {synced,failed,pending:keep.length};
  }
  async function runSync() {
    if(busy)return; if(!isAdmin()){setStatus('Solo la superadministración puede iniciar la sincronización global.',true);return;}
    busy=true;setButtonState(true);setStatus('Recuperando respaldos locales y verificando Supabase…');
    try {
      const local=await syncV9();
      const own=await syncV10OwnQueue();
      updatePendingCount();
      window.dispatchEvent(new Event('pixelforge:supabase-sync-complete'));
      await checkRemote();
      const parts=['Respaldos V9 sincronizados: '+local.synced,'pendientes con error: '+local.failed,'V10 de esta cuenta sincronizados: '+own.synced,'V10 pendientes: '+own.pending];
      setStatus(parts.join(' · '),local.failed>0||own.failed>0);
    } catch(e) { setStatus('La sincronización no terminó: '+(e.message||e),true); }
    finally { busy=false;setButtonState(false); }
  }
  async function retryOwnQueue() {
    const user=currentUser(); if(!user?.id||user.id==='invitado-local')return;
    const result=await syncV10OwnQueue(); updatePendingCount();
    if(result.synced) window.dispatchEvent(new Event('pixelforge:supabase-sync-complete'));
  }
  function init() {
    ensurePanel();
    window.addEventListener('pixelforge:admin-state',()=>{ensurePanel();if(isAdmin())checkRemote();});
    window.addEventListener('pixelforge:auth',()=>{ensurePanel();retryOwnQueue();if(isAdmin())checkRemote();});
    window.addEventListener('hashchange',()=>{if(location.hash==='#administracion'&&isAdmin()){ensurePanel();checkRemote();}});
    if(isAdmin())checkRemote();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  window.PIXELFORGE_SUPABASE_SYNC={check:checkRemote,sync:runSync};
})();
