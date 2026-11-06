(() => {
    "use strict";

const SUPABASE_URL = "https://ofeiovlpkmwtqpwdfurj.supabase.co";
const SUPABASE_KEY = "sb_publishable_DbCzzF0nXqAyPI6uHB3C5Q_G2BuU54_";

const configurado =
    /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(SUPABASE_URL) &&
    typeof SUPABASE_KEY === "string" &&
    SUPABASE_KEY.length > 20 &&
    !SUPABASE_KEY.includes("PEGA_AQUI_TU_CLAVE");

const $ = (id) => document.getElementById(id);
let supabase = null;
let usuario = null;
let juegoEnEdicion = null;
let soloFavoritos = false;

function mensaje(id, texto) {
    const elemento = $(id);
    if (elemento) elemento.textContent = texto;
}


// Copia local de respaldo por cuenta. Nunca borra filas de Supabase automáticamente.
const PF_BIBLIOTECA_CACHE_PREFIX = "pixelforge_biblioteca_respaldo_v1:";
function pfClaveCacheBiblioteca() {
    return usuario?.id ? PF_BIBLIOTECA_CACHE_PREFIX + usuario.id : null;
}
function pfLeerCacheBiblioteca() {
    const clave = pfClaveCacheBiblioteca();
    if (!clave) return [];
    try {
        const lista = JSON.parse(localStorage.getItem(clave) || "[]");
        return Array.isArray(lista) ? lista : [];
    } catch (error) {
        console.warn("No se pudo leer la copia local de la biblioteca:", error);
        return [];
    }
}
function pfGuardarCacheBiblioteca(lista) {
    const clave = pfClaveCacheBiblioteca();
    if (!clave) return;
    try {
        const segura = (Array.isArray(lista) ? lista : []).map(({ __cacheOnly, ...juego }) => juego);
        localStorage.setItem(clave, JSON.stringify(segura));
    } catch (error) {
        console.warn("No se pudo actualizar la copia local de la biblioteca:", error);
    }
}
function pfGuardarCopiaJuego(juego, esNuevo = false) {
    if (!usuario?.id || !juego?.nombre) return;
    const lista = pfLeerCacheBiblioteca();
    const copia = {
        id: juego.id || `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        usuario_id: usuario.id,
        nombre: String(juego.nombre).trim(),
        plataforma: juego.plataforma || "PC",
        genero: juego.genero || "Otro",
        estado: juego.estado || "Pendiente",
        valoracion: Number(juego.valoracion) || 0,
        notas: juego.notas || "",
        creado_en: juego.creado_en || new Date().toISOString(),
        __localOnly: Boolean(esNuevo && !juego.id)
    };
    const indice = lista.findIndex(item => (copia.id && item.id === copia.id) || (esNuevo && item.__localOnly && String(item.nombre).toLocaleLowerCase("es-MX") === copia.nombre.toLocaleLowerCase("es-MX") && (item.plataforma || "PC") === copia.plataforma));
    if (indice >= 0) lista[indice] = { ...lista[indice], ...copia };
    else lista.push(copia);
    pfGuardarCacheBiblioteca(lista);
}
function pfQuitarCopiaJuego(id) {
    const lista = pfLeerCacheBiblioteca().filter(item => String(item.id) !== String(id));
    pfGuardarCacheBiblioteca(lista);
}
function pfNormalizarBusqueda(texto) {
    return String(texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-MX").trim();
}


function explicarErrorSupabase(error, contexto = "") {
    const detalle = String(error?.message || error?.code || "Error desconocido");
    const normalizado = detalle.toLowerCase();
    if (/email address not authorized|email_not_authorized/.test(normalizado)) {
        return "Supabase no está autorizado a enviar correo a esta dirección con el SMTP predeterminado. Para pruebas usa un correo autorizado del equipo o configura un SMTP propio en Authentication. El código no puede habilitar el envío desde el navegador.";
    }
    if (/signup_disabled|signups? (are )?disabled|new user signups.*disabled/.test(normalizado)) {
        return "El registro de cuentas está deshabilitado en Supabase. Activa Allow new users to sign up / Enable email signups en Authentication y en el proveedor Email.";
    }
    if (/redirect.*not allowed|redirect_to.*not allowed|url not allowed/.test(normalizado)) {
        return "Supabase rechazó la URL de regreso. Añade la URL actual de Live Server a Authentication > URL Configuration > Redirect URLs e inténtalo otra vez.";
    }
    if (/rate limit|email rate limit/.test(normalizado)) {
        return "Supabase limitó temporalmente los correos de registro. Espera antes de solicitar otro o configura SMTP propio.";
    }
    if (/user already registered|already registered|already exists/.test(normalizado)) {
        return "Ese correo ya está registrado. Inicia sesión con esa cuenta o usa otro correo.";
    }
    if (/email not confirmed|email_not_confirmed/.test(normalizado)) {
        return "Tu correo todavía no está confirmado. Abre el mensaje de confirmación de Supabase (revisa spam) y después vuelve a iniciar sesión.";
    }
    if (/invalid login credentials/.test(normalizado)) {
        return "El correo o la contraseña no coinciden. Si acabas de registrarte, confirma el correo primero.";
    }
    if (/invalid api key|no api key found|invalid jwt/.test(normalizado)) {
        return "Supabase rechazó la clave pública. Copia la anon/publishable key del mismo proyecto que coincide con SUPABASE_URL; nunca uses service_role en el navegador.";
    }
    if (/row-level security|permission denied|violates row-level/.test(normalizado)) {
        return "Supabase denegó la operación por permisos o políticas RLS. Ejecuta el SQL de configuración incluido con este proyecto.";
    }
    if (/could not find the table|schema cache|relation .* does not exist|42p01/.test(normalizado)) {
        return "No se pudo cargar esta función desde la base de datos. El catálogo principal sigue disponible; revisa la configuración de Supabase si el problema continúa.";
    }
    if (/failed to fetch|networkerror|fetch failed/.test(normalizado)) {
        return "No se pudo conectar con Supabase. Comprueba internet, la URL del proyecto y que la página se abra con Live Server.";
    }
    return detalle;
}

function mostrarAcceso() {
    if ($("zonaAcceso")) $("zonaAcceso").hidden = false;
    if ($("zonaBiblioteca")) $("zonaBiblioteca").hidden = true;
    if ($("correo")) $("correo").focus();
}

function mostrarBiblioteca() {
    if ($("zonaAcceso")) $("zonaAcceso").hidden = true;
    if ($("zonaBiblioteca")) $("zonaBiblioteca").hidden = false;
    if ($("correoUsuario")) $("correoUsuario").textContent = usuario?.email || "";
    window.PIXELFORGE_PROFILE?.load?.();
    cargarJuegos();
    cargarComunidad();
    window.dispatchEvent(new Event("pixelforge:auth"));
}

function botonCargando(boton, cargando, textoCargando) {
    if (!boton) return;
    if (cargando) {
        boton.dataset.textoOriginal = boton.textContent;
        boton.textContent = textoCargando;
        boton.disabled = true;
    } else {
        boton.textContent = boton.dataset.textoOriginal || boton.textContent;
        boton.disabled = false;
    }
}

const formAcceso = $("formAcceso");
if (formAcceso) {
    formAcceso.addEventListener("submit", async (evento) => {
        evento.preventDefault();
        if (!supabase) {
            mensaje("mensajeAcceso", "Supabase no se ha conectado. Comprueba que script.js se cargue después de la librería.");
            return;
        }

        const email = $("correo").value.trim();
        const password = $("clave").value;
        const boton = formAcceso.querySelector('button[type="submit"]');
        if (!email || !$("correo").checkValidity()) {
            mensaje("mensajeAcceso", "Escribe un correo electrónico válido.");
            $("correo").focus();
            return;
        }
        if (password.length < 8) {
            mensaje("mensajeAcceso", "La contraseña debe tener al menos 8 caracteres.");
            $("clave").focus();
            return;
        }

        botonCargando(boton, true, "Iniciando sesión...");
        mensaje("mensajeAcceso", "");
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            if (!data?.session?.user) {
                usuario = null;
                mensaje("mensajeAcceso", "Supabase no devolvió una sesión activa. Si tu correo requiere confirmación, confírmalo y vuelve a iniciar sesión.");
                return;
            }
            usuario = data.session.user;
            localStorage.setItem("pixelforge_usuario_activo", JSON.stringify({ id: usuario.id, email: usuario.email }));
            mensaje("mensajeAcceso", "Sesión iniciada correctamente.");
            mostrarBiblioteca();
        } catch (error) {
            console.error("Error al iniciar sesión:", error);
            console.warn("Detalle de inicio de sesión:", explicarErrorSupabase(error, "login"));
            mensaje("mensajeAcceso", "No se pudo iniciar sesión. Comprueba el correo y la contraseña e inténtalo de nuevo.");
        } finally {
            botonCargando(boton, false);
        }
    });
}

const botonCrearCuenta = $("crearCuenta");
if (botonCrearCuenta) {
    botonCrearCuenta.addEventListener("click", async () => {
        if (!supabase) {
            mensaje("mensajeAcceso", "Supabase no se ha conectado. Revisa la URL, la clave pública y que cargue la librería.");
            return;
        }

        const email = $("correo").value.trim();
        const password = $("clave").value;
        if (!email || !$("correo").checkValidity()) {
            mensaje("mensajeAcceso", "Escribe un correo electrónico válido.");
            $("correo").focus();
            return;
        }
        if (password.length < 8) {
            mensaje("mensajeAcceso", "La contraseña debe tener al menos 8 caracteres.");
            $("clave").focus();
            return;
        }

        botonCargando(botonCrearCuenta, true, "Creando cuenta...");
        mensaje("mensajeAcceso", "Creando tu cuenta en PixelForge...");
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: { emailRedirectTo: window.location.origin }
            });
            
            if (error) throw error;
            if (data?.session?.user) {
                usuario = data.session.user;
                localStorage.setItem("pixelforge_usuario_activo", JSON.stringify({ id: usuario.id, email: usuario.email }));
                mensaje("mensajeAcceso", "Cuenta creada y sesión iniciada correctamente.");
                mostrarBiblioteca();
            } else if (data?.user) {
                usuario = null;
                mensaje("mensajeAcceso", "¡Cuenta creada! Revisa tu correo para activarla y después inicia sesión. Tu biblioteca se sincronizará automáticamente al entrar.");
            } else {
                throw new Error("Supabase no devolvió datos de la cuenta. Comprueba la configuración de Authentication.");
            }
        } catch (error) {
            console.error("Error al crear cuenta:", error);
            // Si el correo ya existe, intentamos iniciar sesión o le avisamos
            if ((error.message || "").toLowerCase().includes("already registered")) {
                mensaje("mensajeAcceso", "Ese correo ya está registrado. Pulsa 'Iniciar sesión' para ingresar.");
            } else {
                mensaje("mensajeAcceso", "No se pudo completar el registro. Revisa los datos e inténtalo de nuevo.");
            }
        } finally {
            botonCargando(botonCrearCuenta, false);
        }
    });
}

const botonModoInvitado = $("modoInvitado");
if (botonModoInvitado) {
    botonModoInvitado.addEventListener("click", () => {
        usuario = { id: "invitado-local", email: "invitado@pixelforge.local" };
        mensaje("mensajeAcceso", "Has ingresado en modo local. Tus juegos se guardan de forma segura en este navegador.");
        mostrarBiblioteca();
    });
}

const botonCerrarSesion = $("cerrarSesion");
if (botonCerrarSesion) {
    botonCerrarSesion.addEventListener("click", async () => {
        if (!supabase) return;
        botonCargando(botonCerrarSesion, true, "Cerrando sesión...");
        try {
            if (supabase) {
                try { await supabase.auth.signOut(); } catch (e) { console.warn("Supabase signOut:", e); }
            }
            usuario = null;
            juegoEnEdicion = null;
            localStorage.removeItem("pixelforge_usuario_activo");
            if ($("listaJuegos")) $("listaJuegos").replaceChildren();
            if ($("listaPublicaciones")) $("listaPublicaciones").replaceChildren();
            resetearFormularioJuego();
            mostrarAcceso();
            window.dispatchEvent(new Event("pixelforge:auth"));
            mensaje("mensajeAcceso", "Sesión cerrada.");
        } catch (error) {
            console.error("Error al cerrar sesión:", error);
            mensaje("mensajeJuego", "No se pudo cerrar sesión: " + (error.message || "error desconocido"));
        } finally {
            botonCargando(botonCerrarSesion, false);
        }
    });
}

const formJuego = $("formJuego");
if (formJuego) {
    formJuego.addEventListener("submit", async (evento) => {
        evento.preventDefault();
        if (!supabase || !usuario) {
            mensaje("mensajeJuego", "Inicia sesión para guardar videojuegos.");
            return;
        }

        const videojuego = {
            usuario_id: usuario.id,
            nombre: $("nombreJuego").value.trim(),
            plataforma: $("plataforma").value,
            genero: $("generoJuego").value,
            estado: $("estadoJuego").value,
            valoracion: Number.parseInt($("valoracionJuego").value, 10) || 0,
            notas: $("notasJuego").value.trim()
        };
        if (!videojuego.nombre) {
            mensaje("mensajeJuego", "Escribe el nombre del videojuego.");
            return;
        }

        const edicionAntesDeGuardar = juegoEnEdicion;
        const botonGuardar = $("guardarJuego");
        botonCargando(botonGuardar, true, juegoEnEdicion ? "Guardando cambios..." : "Guardando...");
        mensaje("mensajeJuego", "");

        if (usuario.id === "invitado-local") {
            if (edicionAntesDeGuardar) {
                pfGuardarCopiaJuego({ ...videojuego, id: edicionAntesDeGuardar.id, creado_en: edicionAntesDeGuardar.creado_en }, false);
            } else {
                pfGuardarCopiaJuego(videojuego, true);
            }
            const estabaEditando = Boolean(juegoEnEdicion);
            resetearFormularioJuego();
            mensaje("mensajeJuego", estabaEditando ? "Cambios guardados localmente." : "Videojuego guardado en tu biblioteca.");
            await cargarJuegos();
            botonCargando(botonGuardar, false);
            return;
        }

        try {
            let respuesta;
            if (juegoEnEdicion) {
                respuesta = await supabase
                    .from("videojuegos")
                    .update({
                        nombre: videojuego.nombre,
                        plataforma: videojuego.plataforma,
                        genero: videojuego.genero,
                        estado: videojuego.estado,
                        valoracion: videojuego.valoracion,
                        notas: videojuego.notas,
                        actualizado_en: new Date().toISOString()
                    })
                    .eq("id", juegoEnEdicion.id)
                    .eq("usuario_id", usuario.id)
                    .select("id")
                    .maybeSingle();
            } else {
                respuesta = await supabase.from("videojuegos").insert(videojuego);
            }
            if (respuesta.error) throw respuesta.error;
            if (edicionAntesDeGuardar && !respuesta.data?.id) {
                throw new Error("Supabase no confirmó la edición. No reemplacé tu copia local; revisa la política RLS de UPDATE.");
            }

            // Respaldo local inmediato; la siguiente lectura confirma si Supabase devolvió la fila.
            if (edicionAntesDeGuardar) {
                pfGuardarCopiaJuego({ ...videojuego, id: edicionAntesDeGuardar.id, creado_en: edicionAntesDeGuardar.creado_en }, false);
            } else {
                pfGuardarCopiaJuego(videojuego, true);
            }
            const estabaEditando = Boolean(juegoEnEdicion);
            resetearFormularioJuego();
            mensaje("mensajeJuego", estabaEditando ? "Cambios guardados correctamente." : "Videojuego guardado correctamente.");
            await cargarJuegos();
        } catch (error) {
            console.error("Error al guardar videojuego:", error);
            mensaje("mensajeJuego", "No se pudo guardar: " + (error.message || "revisa las columnas y políticas de Supabase"));
        } finally {
            botonCargando(botonGuardar, false);
        }
    });
}

function resetearFormularioJuego() {
    juegoEnEdicion = null;
    if (formJuego) formJuego.reset();
    if ($("tituloFormularioJuego")) $("tituloFormularioJuego").textContent = "Agregar videojuego";
    if ($("guardarJuego")) $("guardarJuego").textContent = "Guardar videojuego";
    if ($("cancelarEdicion")) $("cancelarEdicion").hidden = true;
}

const botonCancelarEdicion = $("cancelarEdicion");
if (botonCancelarEdicion) {
    botonCancelarEdicion.addEventListener("click", resetearFormularioJuego);
}

async function pfSincronizarCopiasLocales() {
    if (!supabase || !usuario?.id || usuario.id === "invitado-local") return;
    const copias = pfLeerCacheBiblioteca();
    const pendientes = copias.filter(j => j && (j.__localOnly || String(j.id || "").startsWith("local-")));
    if (!pendientes.length) return;
    try {
        const { data: existentes, error: errorLectura } = await supabase
            .from("videojuegos")
            .select("id,nombre,plataforma")
            .eq("usuario_id", usuario.id);
        if (errorLectura) throw errorLectura;
        const filas = Array.isArray(existentes) ? existentes : [];
        const cacheActualizada = [...copias];
        for (const copia of pendientes) {
            const duplicado = filas.find(f =>
                pfNormalizarBusqueda(f.nombre) === pfNormalizarBusqueda(copia.nombre) &&
                (f.plataforma || "PC") === (copia.plataforma || "PC")
            );
            if (duplicado) {
                const i = cacheActualizada.findIndex(x => String(x.id) === String(copia.id));
                if (i >= 0) cacheActualizada[i] = { ...cacheActualizada[i], ...duplicado, usuario_id: usuario.id, __localOnly: false };
                continue;
            }
            const nuevo = {
                usuario_id: usuario.id,
                nombre: String(copia.nombre || "").trim(),
                plataforma: copia.plataforma || "PC",
                genero: copia.genero || "Otro",
                estado: copia.estado || "Pendiente",
                valoracion: Number(copia.valoracion) || 0,
                notas: copia.notas || ""
            };
            if (!nuevo.nombre) continue;
            const { data: insertado, error: errorInsertar } = await supabase
                .from("videojuegos").insert(nuevo).select("id,usuario_id,nombre,plataforma,genero,estado,valoracion,notas,creado_en").single();
            if (errorInsertar) throw errorInsertar;
            const i = cacheActualizada.findIndex(x => String(x.id) === String(copia.id));
            if (i >= 0) cacheActualizada[i] = { ...insertado, __localOnly: false };
            filas.push(insertado);
        }
        pfGuardarCacheBiblioteca(cacheActualizada);
    } catch (error) {
        // Silencioso en la interfaz; el error queda disponible en la consola para diagnóstico.
        console.warn("PixelForge: la sincronización automática de registros locales se reintentará más tarde.", error);
    }
}

async function cargarJuegos() {
    if (!usuario || !$("listaJuegos")) return;
    const contenedor = $("listaJuegos");
    contenedor.replaceChildren();
    const cachePrevia = pfLeerCacheBiblioteca();

    function pintar(lista, modoRespaldo = false) {
        contenedor.replaceChildren();
        if (!lista.length) {
            const vacio = document.createElement("p");
            vacio.textContent = "Todavía no has agregado videojuegos a tu biblioteca.";
            contenedor.appendChild(vacio);
            return;
        }
        lista.forEach((juego) => {
            const tarjeta = document.createElement("article");
            tarjeta.className = "tarjeta-biblioteca";
            const titulo = document.createElement("h4");
            titulo.textContent = juego.nombre || "Videojuego sin nombre";
            const plataforma = document.createElement("p");
            plataforma.textContent = "Plataforma: " + (juego.plataforma || "PC");
            const genero = document.createElement("p");
            genero.textContent = "Género: " + (juego.genero || "Otro");
            const estado = document.createElement("p");
            estado.textContent = "Estado: " + (juego.estado || "Pendiente");
            const valoracion = document.createElement("p");
            valoracion.className = "calificacion";
            const puntos = Number(juego.valoracion) || 0;
            valoracion.textContent = puntos ? `Calificación: ${"★".repeat(puntos)}${"☆".repeat(5 - puntos)} (${puntos}/5)` : "Calificación: sin calificar";
            const notas = document.createElement("p");
            notas.textContent = juego.notas || "Observaciones: sin notas.";
            tarjeta.append(titulo, plataforma, genero, estado, valoracion, notas);

            const esSoloRespaldo = modoRespaldo || Boolean(juego.__cacheOnly) || (Boolean(juego.__localOnly) && usuario?.id !== "invitado-local") || (String(juego.id || "").startsWith("local-") && usuario?.id !== "invitado-local");
            if (esSoloRespaldo) {
                // Los registros locales no confirmados se conservan sin mostrar mensajes técnicos.
                // No se habilitan edición/eliminación hasta que el servidor confirme el registro.
                tarjeta.dataset.estadoLocal = "pendiente-sincronizacion";
            } else {
                const acciones = document.createElement("div");
                acciones.className = "acciones-tarjeta";
                const editar = document.createElement("button");
                editar.type = "button";
                editar.textContent = "Editar";
                editar.addEventListener("click", () => prepararEdicion(juego));
                const eliminar = document.createElement("button");
                eliminar.type = "button";
                eliminar.className = "eliminar-juego";
                eliminar.textContent = "Eliminar";
                eliminar.addEventListener("click", () => eliminarJuego(juego));
                acciones.append(editar, eliminar);
                tarjeta.appendChild(acciones);
            }
            contenedor.appendChild(tarjeta);
        });
    }

    if (usuario.id === "invitado-local") {
        pintar(cachePrevia);
        mensaje("mensajeJuego", "Biblioteca local (sin cuenta). Tus registros se guardan en este dispositivo.");
        return;
    }

    mensaje("mensajeJuego", "");

    try {
        await pfSincronizarCopiasLocales();
        const { data, error } = await supabase
            .from("videojuegos")
            .select("id, usuario_id, nombre, plataforma, genero, estado, valoracion, notas, creado_en")
            .eq("usuario_id", usuario.id)
            .order("creado_en", { ascending: false });
        if (error) throw error;

        const remotos = Array.isArray(data) ? data : [];
        const combinados = remotos.map(juego => ({ ...juego, __cacheOnly: false }));
        let conservados = 0;
        for (const copia of cachePrevia) {
            const coincidePorId = copia.id && !String(copia.id).startsWith("local-") && remotos.some(juego => String(juego.id) === String(copia.id));
            const coincideNuevoPorNombre = copia.__localOnly && remotos.some(juego =>
                pfNormalizarBusqueda(juego.nombre) === pfNormalizarBusqueda(copia.nombre) && (juego.plataforma || "PC") === (copia.plataforma || "PC")
            );
            if (!coincidePorId && !coincideNuevoPorNombre) {
                combinados.push({ ...copia, __cacheOnly: true });
                conservados++;
            }
        }
        // Guardar primero lo que Supabase confirmó y conservar las copias no confirmadas por separado.
        pfGuardarCacheBiblioteca(combinados);
        pintar(combinados);

        if (conservados > 0) {
            mensaje("mensajeJuego", "Tu biblioteca está disponible. Algunos cambios pueden tardar en actualizarse; vuelve a intentarlo más tarde si notas que falta algo.");
        } else if (remotos.length === 0 && cachePrevia.length === 0) {
            mensaje("mensajeJuego", "¡Tu biblioteca está lista! Agrega tu primer videojuego cuando quieras.");
        } else {
            mensaje("mensajeJuego", "Biblioteca actualizada.");
        }
    } catch (error) {
        console.error("Error al cargar videojuegos:", error);
        if (cachePrevia.length > 0) {
            pintar(cachePrevia.map(juego => ({ ...juego, __cacheOnly: true })), true);
            mensaje("mensajeJuego", "Tu biblioteca sigue disponible en este dispositivo. La actualización automática se volverá a intentar cuando haya conexión.");
        } else {
            const aviso = document.createElement("p");
            aviso.textContent = "No se pudo actualizar la biblioteca en este momento. Comprueba tu conexión e inténtalo de nuevo.";
            contenedor.replaceChildren(aviso);
            mensaje("mensajeJuego", "La biblioteca no está disponible temporalmente. Inténtalo de nuevo en unos momentos.");
        }
    }
}
function prepararEdicion(juego) {
    juegoEnEdicion = juego;
    $("nombreJuego").value = juego.nombre || "";
    $("plataforma").value = juego.plataforma || "PC";
    $("generoJuego").value = juego.genero || "Otro";
    $("estadoJuego").value = juego.estado || "Pendiente";
    $("valoracionJuego").value = String(Number(juego.valoracion) || 0);
    $("notasJuego").value = juego.notas || "";
    $("tituloFormularioJuego").textContent = "Editar videojuego";
    $("guardarJuego").textContent = "Guardar cambios";
    $("cancelarEdicion").hidden = false;
    $("nombreJuego").focus();
    $("formJuego").scrollIntoView({ behavior: "smooth", block: "center" });
}

async function eliminarJuego(juego) {
    if (!usuario) return;
    if (usuario.id === "invitado-local") {
        if (!confirm(`¿Eliminar "${juego.nombre}" de tu biblioteca?`)) return;
        pfQuitarCopiaJuego(juego.id);
        mensaje("mensajeJuego", "Videojuego eliminado.");
        if (juegoEnEdicion && juegoEnEdicion.id === juego.id) resetearFormularioJuego();
        await cargarJuegos();
        return;
    }
    if (!supabase) return;
    if (juego.__cacheOnly || juego.__localOnly || String(juego.id || "").startsWith("local-")) {
        mensaje("mensajeJuego", "Este videojuego todavía se está actualizando. Inténtalo de nuevo en unos momentos.");
        return;
    }
    if (!confirm(`¿Eliminar "${juego.nombre}" de tu biblioteca? Esta acción solo se ejecuta porque la confirmas aquí.`)) return;
    try {
        const { data, error } = await supabase
            .from("videojuegos")
            .delete()
            .eq("id", juego.id)
            .eq("usuario_id", usuario.id)
            .select("id");
        if (error) throw error;
        if (!Array.isArray(data) || data.length === 0) {
            throw new Error("Supabase no confirmó la eliminación. Conservé el videojuego y su copia local; revisa la política RLS de DELETE.");
        }
        pfQuitarCopiaJuego(juego.id);
        mensaje("mensajeJuego", "Videojuego eliminado tras confirmación de Supabase.");
        if (juegoEnEdicion && juegoEnEdicion.id === juego.id) resetearFormularioJuego();
        await cargarJuegos();
    } catch (error) {
        console.error("Error al eliminar videojuego:", error);
        mensaje("mensajeJuego", "No se pudo completar la acción. Inténtalo de nuevo en unos momentos.");
    }
}
const CLAVE_FAVORITOS = "pixelforge_favoritos_v1";
function leerFavoritos() {
    try {
        const valor = JSON.parse(localStorage.getItem(CLAVE_FAVORITOS) || "[]");
        return Array.isArray(valor) ? valor : [];
    } catch {
        return [];
    }
}
function guardarFavoritos(lista) {
    try { localStorage.setItem(CLAVE_FAVORITOS, JSON.stringify(lista)); }
    catch (error) { console.warn("No fue posible guardar favoritos en este navegador:", error); }
}
function aplicarFiltroJuegos() {
    const busqueda = pfNormalizarBusqueda($("buscadorJuegos")?.value || "");
    const favoritos = leerFavoritos();
    const generoFiltro = pfNormalizarBusqueda($("filtroGeneroCatalogo")?.value || "");
    const edadFiltro = $("filtroEdadCatalogo")?.value || "";
    document.querySelectorAll(".contenedor-juegos .juego").forEach((tarjeta) => {
        const id = tarjeta.dataset.juego;
        const texto = pfNormalizarBusqueda(tarjeta.textContent);
        const genero = tarjeta.dataset.genero || tarjeta.textContent;
        const edadTarjeta = tarjeta.dataset.edad || "";
        const infantilTarjeta = ["3+", "7+"].includes(edadTarjeta);
        const coincideTexto = !busqueda || texto.includes(busqueda);
        const coincideGenero = pfGeneroCoincide(genero, generoFiltro, { edad: edadTarjeta, infantil: infantilTarjeta });
        const coincideEdad = !edadFiltro || edadTarjeta === edadFiltro;
        const coincideFavorito = !soloFavoritos || favoritos.includes(id);
        tarjeta.hidden = !(coincideTexto && coincideGenero && coincideEdad && coincideFavorito);
    });
    const botonFiltro = $("mostrarFavoritos");
    if (botonFiltro) {
        botonFiltro.setAttribute("aria-pressed", String(soloFavoritos));
        botonFiltro.textContent = soloFavoritos ? "★ Mostrar todos" : "☆ Ver favoritos";
    }
}
function actualizarBotonesFavoritos() {
    const favoritos = leerFavoritos();
    document.querySelectorAll("[data-favorito]").forEach((boton) => {
        const guardado = favoritos.includes(boton.dataset.favorito);
        boton.setAttribute("aria-pressed", String(guardado));
        boton.textContent = guardado ? "★ En favoritos" : "☆ Añadir a favoritos";
    });
    aplicarFiltroJuegos();
}
document.querySelectorAll("[data-favorito]").forEach((boton) => {
    boton.addEventListener("click", () => {
        const id = boton.dataset.favorito;
        const favoritos = leerFavoritos();
        const siguiente = favoritos.includes(id) ? favoritos.filter((x) => x !== id) : [...favoritos, id];
        guardarFavoritos(siguiente);
        if (typeof guardarFavoritoNube === "function") void guardarFavoritoNube(id, siguiente.includes(id));
        actualizarBotonesFavoritos();
        if (pfCatalogoInicializado) pfFiltrosActualizados();
    });
});
if ($("mostrarFavoritos")) {
    $("mostrarFavoritos").addEventListener("click", () => {
        soloFavoritos = !soloFavoritos;
        aplicarFiltroJuegos();
        if (pfCatalogoInicializado) pfFiltrosActualizados();
    });
}
actualizarBotonesFavoritos();

const formPublicacion = $("formPublicacion");
if (formPublicacion) {
    formPublicacion.addEventListener("submit", async (evento) => {
        evento.preventDefault();
        if (!supabase || !usuario) {
            mensaje("mensajeComunidad", "Inicia sesión para publicar.");
            document.querySelector("#biblioteca")?.scrollIntoView({ behavior: "smooth" });
            return;
        }
        const titulo = $("tituloPublicacion").value.trim();
        const contenido = $("textoPublicacion").value.trim();
        if (!titulo || !contenido) {
            mensaje("mensajeComunidad", "Completa el título y el contenido.");
            return;
        }

        const boton = formPublicacion.querySelector('button[type="submit"]');
        botonCargando(boton, true, "Publicando...");
        try {
            const { error } = await supabase.from("comunidad_publicaciones").insert({
                usuario_id: usuario.id,
                autor_nombre: (usuario.email || "Jugador").split("@")[0],
                titulo,
                contenido
            });
            if (error) throw error;
            formPublicacion.reset();
            mensaje("mensajeComunidad", "¡Publicación creada!");
            await cargarComunidad();
        } catch (error) {
            console.error("Error al publicar:", error);
            mensaje("mensajeComunidad", "No se pudo publicar: " + explicarErrorSupabase(error, "community"));
        } finally {
            botonCargando(boton, false);
        }
    });
}

const botonAlternarClave =
    document.getElementById("alternarClave");

const campoClave = document.getElementById("clave");

if (botonAlternarClave && campoClave) {
    botonAlternarClave.addEventListener("click", () => {
        const mostrar = campoClave.type === "password";

        campoClave.type = mostrar ? "text" : "password";

        botonAlternarClave.textContent =
            mostrar ? "Ocultar" : "Mostrar";

        botonAlternarClave.setAttribute(
            "aria-pressed",
            String(mostrar)
        );
    });
}

async function cargarComunidad() {
    const contenedor = $("listaPublicaciones");
    if (!contenedor) return;
    if (!supabase || !usuario) {
        contenedor.replaceChildren();
        const aviso = document.createElement("p");
        aviso.textContent = "Inicia sesión para consultar la comunidad.";
        contenedor.appendChild(aviso);
        return;
    }

    try {
        const { data, error } = await supabase
            .from("comunidad_publicaciones")
            .select("id, usuario_id, autor_nombre, titulo, contenido, creado_en")
            .order("creado_en", { ascending: false })
            .limit(40);
        if (error) throw error;
        contenedor.replaceChildren();
        if (!data || data.length === 0) {
            const aviso = document.createElement("p");
            aviso.textContent = "Todavía no hay publicaciones. ¡Sé el primero en compartir!";
            contenedor.appendChild(aviso);
            return;
        }
        data.forEach((publicacion) => {
            const tarjeta = document.createElement("article");
            tarjeta.className = "tarjeta-publicacion";
            const titulo = document.createElement("h4");
            titulo.textContent = publicacion.titulo;
            const contenido = document.createElement("p");
            contenido.textContent = publicacion.contenido;
            const fecha = document.createElement("small");
            fecha.textContent = "Publicado: " + new Date(publicacion.creado_en).toLocaleString("es-MX");
            const autor = document.createElement("small");
            autor.className = "autor-publicacion";
            autor.textContent = "Publicado por: " + (publicacion.autor_nombre || "Jugador de PixelForge");
            tarjeta.append(autor, titulo, contenido, fecha);

            if (publicacion.usuario_id === usuario.id) {
                const editar = document.createElement("button");
                editar.type = "button";
                editar.className = "boton boton-secundario";
                editar.textContent = "Editar publicación";
                editar.addEventListener("click", async () => {
                    const nuevoTitulo = prompt("Editar título:", publicacion.titulo);
                    if (nuevoTitulo === null) return;
                    const nuevoContenido = prompt("Editar publicación:", publicacion.contenido);
                    if (nuevoContenido === null) return;
                    const tituloLimpio = nuevoTitulo.trim(); const contenidoLimpio = nuevoContenido.trim();
                    if (!tituloLimpio || !contenidoLimpio || tituloLimpio.length > 80 || contenidoLimpio.length > 500) {
                        mensaje("mensajeComunidad", "El título debe tener entre 1 y 80 caracteres y el contenido entre 1 y 500."); return;
                    }
                    try {
                        const { error: errorEditar } = await supabase.from("comunidad_publicaciones")
                            .update({ titulo: tituloLimpio, contenido: contenidoLimpio })
                            .eq("id", publicacion.id).eq("usuario_id", usuario.id);
                        if (errorEditar) throw errorEditar;
                        mensaje("mensajeComunidad", "Publicación actualizada."); await cargarComunidad();
                    } catch (errorEditar) { mensaje("mensajeComunidad", "No se pudo editar: " + explicarErrorSupabase(errorEditar, "community")); }
                });
                tarjeta.appendChild(editar);
                const eliminar = document.createElement("button");
                eliminar.type = "button";
                eliminar.className = "boton boton-secundario";
                eliminar.textContent = "Eliminar publicación";
                eliminar.addEventListener("click", async () => {
                    if (!confirm("¿Quieres eliminar esta publicación?")) return;
                    try {
                        const { error: errorEliminar } = await supabase
                            .from("comunidad_publicaciones")
                            .delete()
                            .eq("id", publicacion.id)
                            .eq("usuario_id", usuario.id);
                        if (errorEliminar) throw errorEliminar;
                        mensaje("mensajeComunidad", "Publicación eliminada.");
                        await cargarComunidad();
                    } catch (errorEliminar) {
                        console.error("Error al eliminar publicación:", errorEliminar);
                        mensaje("mensajeComunidad", "No se pudo eliminar: " + explicarErrorSupabase(errorEliminar, "community"));
                    }
                });
                tarjeta.appendChild(eliminar);
            }
            contenedor.appendChild(tarjeta);
        });
        mensaje("mensajeComunidad", "");
    } catch (error) {
        console.error("Error al cargar la comunidad:", error);
        mensaje("mensajeComunidad", "No se pudo cargar la comunidad: " + explicarErrorSupabase(error, "community"));
    }
}

async function iniciarPixelForge() {
    const anio = $("anioActual");
    if (anio) anio.textContent = String(new Date().getFullYear());

    if (!configurado) {
        mensaje("mensajeAcceso", "Revisa la URL y la clave pública de Supabase en scrip.js.");
        mostrarAcceso();
        return;
    }
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
        mensaje("mensajeAcceso", "No se cargó la librería de Supabase. Revisa la conexión a internet y las etiquetas script al final de index.html.");
        mostrarAcceso();
        return;
    }

    try {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        const { data } = await supabase.auth.getSession().catch(() => ({ data: {} }));
        
        if (data?.session?.user) {
            usuario = data.session.user;
            localStorage.setItem("pixelforge_usuario_activo", JSON.stringify({ id: usuario.id, email: usuario.email }));
            mostrarBiblioteca();
            window.dispatchEvent(new Event("pixelforge:auth"));
        } else {
            usuario = null;
            localStorage.removeItem("pixelforge_usuario_activo");
            mostrarAcceso();
            cargarComunidad();
            window.dispatchEvent(new Event("pixelforge:auth"));
        }
    } catch (error) {
        console.error("Error al iniciar PixelForge:", error);
        let usuarioGuardado = null;
        try {
            const raw = localStorage.getItem("pixelforge_usuario_activo");
            if (raw) usuarioGuardado = JSON.parse(raw);
        } catch {}

        if (usuarioGuardado?.email) {
            usuario = usuarioGuardado;
            mostrarBiblioteca();
        } else {
            mostrarAcceso();
        }
    }
}

iniciarPixelForge().then(() => iniciarCatalogoExtendido());

/* ================= PIXELFORGE: CATÁLOGO, FAVORITOS, CALIFICACIONES Y PROPUESTAS ================= */
window.PIXELFORGE_CATALOGO = [
    {
        nombre: "The Legend of Zelda: Tears of the Kingdom",
        genero: "Aventura",
        edad: "10+",
        descripcion: "Una aventura épica por las tierras y los vastos cielos de Hyrule, construyendo artilugios y explorando sin límites.",
        url: "https://www.zelda.com/tears-of-the-kingdom/",
        imagen: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80",
        streamers: "IlloJuan / Rubius",
        infantil: false
    },
    {
        nombre: "Super Mario Odyssey",
        genero: "Familiar",
        edad: "3+",
        descripcion: "Únete a Mario en una aventura 3D a través de reinos coloridos y usa los increíbles poderes de Cappy.",
        url: "https://www.nintendo.com/store/products/super-mario-odyssey-switch/",
        imagen: "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=600&auto=format&fit=crop&q=80",
        streamers: "Nintendo / Creadores familiares",
        infantil: true
    },
    {
        nombre: "Rocket League",
        genero: "Deportes",
        edad: "3+",
        descripcion: "Fútbol acrobático impulsado por cohetes. Conduce a toda velocidad, vuela y marca goles con tu equipo.",
        url: "https://www.rocketleague.com",
        imagen: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&auto=format&fit=crop&q=80",
        streamers: "SquishyMuffinz / SunlessKhan",
        infantil: true
    },
    {
        nombre: "Stardew Valley",
        genero: "Simulación",
        edad: "7+",
        descripcion: "Has heredado la vieja granja de tu abuelo. Aprende a vivir de la tierra y haz prosperar el pueblo.",
        url: "https://www.stardewvalley.net",
        imagen: "https://images.unsplash.com/photo-1500651230702-0e2d8a49d4ad?w=600&auto=format&fit=crop&q=80",
        streamers: "Comunidad granjera",
        infantil: true
    },
    {
        nombre: "Hollow Knight",
        genero: "Acción",
        edad: "7+",
        descripcion: "Desciende al oscuro y fascinante reino de Hallownest, derrota criaturas feroces y desentraña misterios.",
        url: "https://www.teamcherry.com.au",
        imagen: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80",
        streamers: "Fireb0rn / Skurry",
        infantil: false
    },
    {
        nombre: "Elden Ring",
        genero: "RPG",
        edad: "16+",
        descripcion: "Levántate, Sinluz, y déjate guiar por la gracia para blandir el poder del Círculo de Elden en las Tierras Intermedias.",
        url: "https://www.bandainamcoent.com/games/elden-ring",
        imagen: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=600&auto=format&fit=crop&q=80",
        streamers: "ElXokas / Asmongold",
        infantil: false
    },
    {
        nombre: "Among Us",
        genero: "Cooperativo",
        edad: "7+",
        descripcion: "Prepara tu nave espacial mientras intentas descubrir a los impostores antes de que saboteen la tripulación.",
        url: "https://innersloth.com/games/among-us/",
        imagen: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
        streamers: "Ibai / Valkyrae / Disguised Toast",
        infantil: true
    },
    {
        nombre: "Forza Horizon 5",
        genero: "Carreras",
        edad: "3+",
        descripcion: "Explora los vibrantes paisajes en constante evolución de México en los mejores bólidos del mundo.",
        url: "https://forza.net/horizon",
        imagen: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600&auto=format&fit=crop&q=80",
        streamers: "AR12Gaming / BlackPanthaa",
        infantil: true
    }
];

const PF_CLAVE_CALIFICACIONES_LOCAL = "pixelforge_calificaciones_local_v1";
const PF_CLAVE_FAVORITOS = "pixelforge_favoritos_v1";
let pfJuegosBD = [];
let pfCalificacionesResumen = {};
let pfCalificacionesUsuario = {};
let pfEsAdmin = false;
let pfCatalogoInicializado = false;
let pfResultadosWikidata = [];
let pfTerminoWikidata = "";
let pfWikidataCargando = false;
let pfWikidataError = false;
let pfWikidataTimer = null;
let pfWikidataController = null;
const pfCacheWikidata = new Map();

function pfLeerJSONLocal(clave, predeterminado) {
    try {
        const dato = JSON.parse(localStorage.getItem(clave) || "null");
        return dato ?? predeterminado;
    } catch { return predeterminado; }
}
function pfGuardarJSONLocal(clave, dato) {
    try { localStorage.setItem(clave, JSON.stringify(dato)); } catch (error) { console.warn("PixelForge no pudo guardar en este navegador:", error); }
}
function pfEscaparTexto(value) { return String(value ?? ""); }

// Streamers sugeridos por juego. Los enlaces abren resultados de Twitch; no afirman que estén en directo.
const PF_STREAMERS_POR_JUEGO = {
    "minecraft": ["Auronplay", "Vegetta777", "Rubius"],
    "fortnite": ["Ninja", "SypherPK", "TheGrefg"],
    "grand theft auto v": ["TheProfessional", "Caylus", "xQc"],
    "gta v": ["TheProfessional", "Caylus", "xQc"],
    "rocket league": ["SquishyMuffinz", "ApparentlyJack", "SunlessKhan"],
    "stardew valley": ["ConcernedApe", "ezlilyy", "Fuzzireno"],
    "hollow knight": ["Fireb0rn", "Skurry", "Mossbag"],
    "elden ring": ["LobosJr", "MissMikkaa", "Asmongold"],
    "among us": ["Valkyrae", "DisguisedToast", "Hafu"],
    "forza horizon 5": ["AR12Gaming", "BlackPanthaa", "DonJoewonSong"],
    "super mario odyssey": ["SmallAnt", "GrandPooBear", "PointCrow"],
    "the legend of zelda tears of the kingdom": ["PointCrow", "ZeldaDungeon", "SmallAnt"]
};
function pfTwitchBuscar(termino) {
    return `https://www.twitch.tv/search?term=${encodeURIComponent(String(termino || "videojuegos"))}`;
}
function pfNombresStreamers(juego) {
    const nombre = String(juego?.nombre || "").trim();
    const clave = pfNormalizarBusqueda(nombre).replace(/[^a-z0-9]+/g, " ").trim();
    const exacto = PF_STREAMERS_POR_JUEGO[clave];
    // Los datos antiguos del catálogo base tenían nombres genéricos o mezclados; usar la lista por título.
    if (juego?.deBase && exacto) return exacto;
    const guardados = String(juego?.streamers || "").trim();
    const esTextoGenerico = !guardados || /busca (streamers|creadores)|explora creadores|comunidad granjera|nintendo \/ creadores familiares/i.test(guardados);
    if (!esTextoGenerico) {
        return [...new Set(guardados.split(/[,;/|]+/).map(x => x.trim()).filter(x => x && !/pendiente|no disponible/i.test(x)))].slice(0, 5);
    }
    if (exacto) return exacto;
    const parcial = Object.keys(PF_STREAMERS_POR_JUEGO).find(k => clave.includes(k) || k.includes(clave));
    return parcial ? PF_STREAMERS_POR_JUEGO[parcial] : [];
}
function pfSlug(texto) {
    return String(texto || "juego").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
        .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90) || "juego";
}
function pfImagenMarcador(nombre) {
    const seguro = String(nombre || "PixelForge").replace(/[<>&"']/g, "").slice(0, 50);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#101827"/><stop offset="1" stop-color="#153d58"/></linearGradient></defs><rect width="640" height="360" fill="url(#g)"/><path d="M0 280L220 80 360 210 475 115 640 280V360H0Z" fill="#00e5ff" opacity=".10"/><text x="32" y="55" fill="#00e5ff" font-size="17" font-family="Arial" font-weight="bold">PIXELFORGE · VIDEOJUEGO</text><text x="32" y="185" fill="#ffffff" font-size="34" font-family="Arial" font-weight="bold">${seguro}</text><text x="32" y="230" fill="#aab3c6" font-size="18" font-family="Arial">Portada ilustrativa</text></svg>`;
    return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}
function pfNormalizarJuego(j) {
    const nombre = j.nombre || j.title || "Videojuego";
    return {
        slug: j.slug || pfSlug(nombre), nombre,
        genero: j.genero || "Otro",
        edad: j.edad || j.clasificacion_edad || "Pendiente de verificar",
        descripcion: j.descripcion || "Descubre este videojuego.",
        url: j.url || j.sitio_oficial || "",
        imagen: j.imagen || j.imagen_url || "",
        streamers: j.streamers || "",
        url_streamers: j.url_streamers || pfTwitchBuscar(nombre),
        infantil: Boolean(j.infantil ?? j.es_infantil),
        deBase: Boolean(j.deBase),
        fuenteWikidata: Boolean(j.fuenteWikidata),
        url_wikidata: j.url_wikidata || "",
        requisitos_minimos: j.requisitos_minimos || j.requisitosMinimos || "",
        requisitos_recomendados: j.requisitos_recomendados || j.requisitosRecomendados || "",
        fuenteRawg: Boolean(j.fuenteRawg), rawgId: j.rawgId || null, rawgSlug: j.rawgSlug || ""
    };
}
function pfCrearEnlace(url, texto, clase = "enlace-juego") {
    const a = document.createElement("a");
    a.className = clase; a.textContent = texto; a.href = url || "#";
    if (url && /^https:\/\//i.test(url)) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
    else { a.removeAttribute("href"); a.setAttribute("aria-disabled", "true"); }
    return a;
}
function pfCrearTarjetaJuego(juego) {
    const articulo = document.createElement("article");
    articulo.className = "juego tarjeta-catalogo-extra";
    articulo.dataset.juego = juego.slug;
    articulo.dataset.genero = juego.genero;
    articulo.dataset.edad = juego.edad;
    articulo.dataset.infantil = String(juego.infantil);
    const figura = document.createElement("div"); figura.className = "imagen-juego-contenedor";
    const imagen = document.createElement("img"); imagen.loading = "lazy"; imagen.alt = `Portada de ${juego.nombre}`;
    imagen.src = juego.imagen || pfImagenMarcador(juego.nombre);
    imagen.addEventListener("error", () => { if (!imagen.dataset.fallback) { imagen.dataset.fallback = "1"; imagen.src = pfImagenMarcador(juego.nombre); } }, { once: true });
    figura.appendChild(imagen);
    const info = document.createElement("div"); info.className = "informacion";
    const genero = document.createElement("span"); genero.textContent = juego.genero.toUpperCase();
    const titulo = document.createElement("h3"); titulo.textContent = juego.nombre;
    const desc = document.createElement("p"); desc.textContent = juego.descripcion;
    const edad = document.createElement("p"); edad.className = "etiqueta-edad"; edad.textContent = `Edad sugerida: ${juego.edad}`;
    const requisitos = document.createElement("details"); requisitos.className = "pf-requisitos-juego";
    const requisitosTitulo = document.createElement("summary"); requisitosTitulo.textContent = "Requisitos de PC";
    const requisitosTexto = document.createElement("p");
    requisitosTexto.textContent = juego.requisitos_recomendados ? `Recomendados: ${juego.requisitos_recomendados}` : (juego.requisitos_minimos ? `Mínimos: ${juego.requisitos_minimos}` : "No hay requisitos verificados disponibles todavía.");
    requisitos.append(requisitosTitulo, requisitosTexto);
    if (juego.fuenteRawg && juego.rawgId && !juego.requisitos_recomendados && !juego.requisitos_minimos) {
        const cargarReq = document.createElement("button"); cargarReq.type = "button"; cargarReq.className = "boton-mini"; cargarReq.textContent = "Consultar requisitos en RAWG";
        cargarReq.addEventListener("click", async () => {
            cargarReq.disabled = true; cargarReq.textContent = "Consultando…";
            try {
                const key = window.PIXELFORGE_CONFIG?.rawgApiKey?.trim();
                if (!key) throw new Error("Configura la clave RAWG en api-config.js.");
                const response = await fetch(`https://api.rawg.io/api/games/${encodeURIComponent(juego.rawgId)}?key=${encodeURIComponent(key)}`);
                if (!response.ok) throw new Error(`RAWG respondió HTTP ${response.status}.`);
                const detail = await response.json();
                const platforms = (detail.platforms || []).map(x => ({ name: x.platform?.name || "PC", req: x.requirements || {} }));
                const recommended = platforms.find(x => /pc|windows/i.test(x.name) && x.req.recommended)?.req.recommended;
                const minimum = platforms.find(x => /pc|windows/i.test(x.name) && x.req.minimum)?.req.minimum;
                requisitosTexto.textContent = recommended ? `Requisitos recomendados: ${recommended}` : minimum ? `Requisitos mínimos: ${minimum}` : "RAWG no proporciona requisitos de PC para este juego.";
                requisitos.open = true;
                if (detail.website) { const link = pfCrearEnlace(detail.website, "Sitio oficial", "enlace-juego enlace-secundario"); requisitos.appendChild(link); }
                cargarReq.remove();
            } catch (err) { requisitosTexto.textContent = err.message || "No se pudieron consultar los requisitos."; cargarReq.disabled = false; cargarReq.textContent = "Reintentar consulta"; }
        });
        requisitos.appendChild(cargarReq);
    }
    if (juego.fuenteRawg) { const fuente = pfCrearEnlace(`https://rawg.io/games/${encodeURIComponent(juego.rawgSlug || juego.slug)}`, "Datos e imagen: RAWG", "enlace-juego enlace-secundario"); requisitos.appendChild(fuente); }
    const bloqueStreamers = document.createElement("section");
    bloqueStreamers.className = "pf-streamers-juego";
    const tituloStreamers = document.createElement("p");
    tituloStreamers.className = "streamers-juego";
    tituloStreamers.textContent = "Streamers de este juego en Twitch";
    bloqueStreamers.appendChild(tituloStreamers);
    const listaStreamers = document.createElement("div");
    listaStreamers.className = "pf-lista-streamers";
    const streamers = pfNombresStreamers(juego);
    if (streamers.length) {
        streamers.forEach(nombreStreamer => {
            listaStreamers.appendChild(pfCrearEnlace(pfTwitchBuscar(nombreStreamer), `Buscar ${nombreStreamer}`, "enlace-juego enlace-secundario pf-enlace-streamer"));
        });
    } else {
        const avisoStreamers = document.createElement("span");
        avisoStreamers.className = "pf-streamers-sin-lista";
        avisoStreamers.textContent = "No hay nombres verificados guardados para este juego.";
        listaStreamers.appendChild(avisoStreamers);
    }
    listaStreamers.appendChild(pfCrearEnlace(pfTwitchBuscar(juego.nombre), `Ver directos de ${juego.nombre}`, "enlace-juego pf-enlace-directos"));
    bloqueStreamers.appendChild(listaStreamers);
    const enlaces = document.createElement("div"); enlaces.className = "acciones-catalogo";
    if (juego.url) enlaces.appendChild(pfCrearEnlace(juego.url, "Página oficial"));
    if (juego.url_wikidata) enlaces.appendChild(pfCrearEnlace(juego.url_wikidata, "Ficha Wikidata", "enlace-juego enlace-secundario"));
    if (!juego.url && !juego.url_wikidata) {
        const sinPagina = document.createElement("span");
        sinPagina.className = "enlace-juego enlace-secundario";
        sinPagina.textContent = "Página oficial no disponible";
        enlaces.appendChild(sinPagina);
    }
    if (juego.fuenteRawg) {
        const importar = document.createElement("button"); importar.type = "button"; importar.className = "boton-mini"; importar.textContent = "Preparar para editar categoría";
        importar.addEventListener("click", async () => {
            if (!pfEsAdmin || !supabase || !$("pfEditorCatalogoForm")) {
                mensaje("mensajeBusqueda", "Inicia sesión con una cuenta administradora para importar y editar este juego."); return;
            }
            const key = window.PIXELFORGE_CONFIG?.rawgApiKey?.trim();
            let detalle = {};
            if (key && juego.rawgId) {
                try { const r = await fetch(`https://api.rawg.io/api/games/${encodeURIComponent(juego.rawgId)}?key=${encodeURIComponent(key)}`); if (r.ok) detalle = await r.json(); } catch (e) { console.warn("No se pudo ampliar el juego RAWG:", e); }
            }
            const nombre = juego.nombre || detalle.name || "";
            const form = $("pfEditorCatalogoForm");
            $("pfEditorSlug").readOnly = false; $("pfEditorSlug").value = pfSlug(nombre); $("pfEditorNombre").value = nombre;
            const categoria = pfNormalizarGeneroApi((detalle.genres || []).map(x => x.name).join(", ") || juego.genero);
            const generoSelect = $("pfEditorGenero");
            if (![...generoSelect.options].some(o => o.value === categoria || o.textContent === categoria)) { const op = document.createElement("option"); op.value = categoria; op.textContent = categoria; generoSelect.appendChild(op); }
            generoSelect.value = categoria;
            $("pfEditorEdad").value = "Pendiente de verificar";
            $("pfEditorUrl").value = detalle.website && /^https:\/\//i.test(detalle.website) ? detalle.website : `https://rawg.io/games/${encodeURIComponent(juego.rawgSlug || juego.slug)}`;
            $("pfEditorImagen").value = juego.imagen || "";
            $("pfEditorStreamers").value = "";
            $("pfEditorDescripcion").value = (detalle.description_raw || juego.descripcion || "").replace(/<[^>]*>/g, " ").slice(0, 1000);
            const pc = (detalle.platforms || []).find(x => /pc|windows/i.test(x.platform?.name || ""))?.requirements || {};
            $("pfEditorReqMin").value = pc.minimum || juego.requisitos_minimos || "";
            $("pfEditorReqRec").value = pc.recommended || juego.requisitos_recomendados || "";
            $("pfEditorInfantil").checked = false; $("pfEditorAprobado").checked = false;
            $("pfEditorGuardar").textContent = "Guardar juego";
            $("pfEditorMensaje").textContent = detalle.website ? "Datos importados de RAWG. Revisa la categoría, edad y requisitos antes de publicar." : "Datos importados. El enlace actual es la ficha RAWG, no un sitio oficial; reemplázalo por la página oficial del juego antes de guardar.";
            location.hash = "#proponer"; form.scrollIntoView({behavior:"smooth",block:"start"});
        });
        enlaces.appendChild(importar);
    }
    const calificacionBox = document.createElement("div"); calificacionBox.className = "calificacion-catalogo";
    const resumen = document.createElement("span"); resumen.className = "resumen-calificacion"; resumen.dataset.resumenSlug = juego.slug;
    const select = document.createElement("select"); select.setAttribute("aria-label", `Tu calificación para ${juego.nombre}`); select.dataset.calificar = juego.slug;
    select.innerHTML = '<option value="">Tu nota</option><option value="1">1 ★</option><option value="2">2 ★★</option><option value="3">3 ★★★</option><option value="4">4 ★★★★</option><option value="5">5 ★★★★★</option>';
    select.value = pfCalificacionesUsuario[juego.slug] ? String(pfCalificacionesUsuario[juego.slug]) : "";
    const calificar = document.createElement("button"); calificar.type = "button"; calificar.className = "boton-mini"; calificar.textContent = "Calificar";
    calificar.addEventListener("click", async () => {
        const puntos = Number(select.value);
        if (!puntos || puntos < 1 || puntos > 5) { mensaje("mensajeBusqueda", "Elige una calificación del 1 al 5."); return; }
        if (usuario && supabase) {
            const { error } = await supabase.from("videojuego_calificaciones").upsert({ usuario_id: usuario.id, slug: juego.slug, puntuacion: puntos }, { onConflict: "usuario_id,slug" });
            if (error) { mensaje("mensajeBusqueda", "No se pudo guardar la calificación en la cuenta. Ejecuta el SQL y vuelve a probar."); console.error(error); return; }
        }
        const locales = pfLeerJSONLocal(PF_CLAVE_CALIFICACIONES_LOCAL, {}); locales[juego.slug] = puntos; pfGuardarJSONLocal(PF_CLAVE_CALIFICACIONES_LOCAL, locales);
        pfCalificacionesUsuario[juego.slug] = puntos;
        await pfCargarResumenCalificaciones(); pfActualizarResumenTarjetas();
        mensaje("mensajeBusqueda", usuario ? "Tu calificación se guardó en tu cuenta." : "Calificación guardada en este navegador. Inicia sesión para sincronizarla entre dispositivos.");
    });
    calificacionBox.append(resumen, select, calificar);
    const favorito = document.createElement("button"); favorito.type = "button"; favorito.className = "boton-favorito"; favorito.dataset.favorito = juego.slug; favorito.setAttribute("aria-pressed", "false"); favorito.textContent = "☆ Añadir a favoritos";
    favorito.addEventListener("click", async () => {
        const id = juego.slug; const favoritos = leerFavoritos();
        const siguiente = favoritos.includes(id) ? favoritos.filter(x => x !== id) : [...favoritos, id];
        guardarFavoritos(siguiente); actualizarBotonesFavoritos();
        pfFiltrosActualizados();
        await guardarFavoritoNube(id, siguiente.includes(id));
    });
    info.append(genero, titulo, desc, edad, requisitos, bloqueStreamers, enlaces, calificacionBox, favorito);
    articulo.append(figura, info);
    return articulo;
}
function pfGeneroCoincide(generoJuego, categoria, juego = {}) {
    const g = pfNormalizarBusqueda(generoJuego || "");
    const c = pfNormalizarBusqueda(categoria || "");
    if (!c) return true;
    const tiene = (...palabras) => palabras.some(p => g.includes(p));
    switch (c) {
        case "accion":
            return tiene("accion", "action", "shooter", "disparos", "battle royale", "hack and slash", "hero shooter") || g === "moba";
        case "carreras":
            return tiene("carreras", "racing", "conduccion", "kart", "motorsport");
        case "aventura":
            return tiene("aventura", "adventure", "exploracion", "exploration", "mundo abierto", "open world", "metroidvania", "sandbox");
        case "estrategia":
            return tiene("estrategia", "strategy", "tactics", "tactica", "turnos", "real-time strategy", "rts", "moba");
        case "supervivencia":
            return tiene("supervivencia", "survival", "crafting", "supervivencia");
        case "terror":
            return tiene("terror", "horror", "survival horror", "psychological horror");
        case "rpg":
            return tiene("rpg", "mmorpg", "arpg", "rol", "role-playing", "role playing", "action rpg");
        case "deportes":
            return tiene("deporte", "sports", "futbol", "football", "soccer", "basketball", "baloncesto", "tennis", "tenis", "wrestling", "lucha libre");
        case "simulacion":
            return tiene("simulacion", "simulation", "simulator", "simulador", "gestion", "management", "granja", "farming", "city builder");
        case "cooperativo":
            return Boolean(juego.cooperativo) || tiene("cooperativo", "co-op", "coop", "cooperative", "multiplayer", "multijugador", "party game", "online co-op");
        case "familiar":
            return Boolean(juego.infantil) || tiene("familiar", "family", "party game", "educational") || ["3+", "7+"].includes(String(juego.edad || ""));
        case "disparos":
            return tiene("disparos", "shooter", "fps", "third-person shooter", "tps");
        case "moba":
            return tiene("moba", "multiplayer online battle arena");
        case "battle royale":
            return tiene("battle royale", "battle-royale");
        case "indie":
            return Boolean(juego.indie) || tiene("indie", "independent");
        case "sandbox":
            return tiene("sandbox", "mundo abierto", "open world", "building");
        default:
            return g.includes(c) || c.includes(g);
    }
}

function pfCoincideFiltros(juego) {
    const busqueda = pfNormalizarBusqueda($("buscadorJuegos")?.value || "");
    const genero = pfNormalizarBusqueda($("filtroGeneroCatalogo")?.value || "");
    const edad = $("filtroEdadCatalogo")?.value || "";
    const esInfantil = document.body.dataset.modoKids === "true";
    const textoJuego = pfNormalizarBusqueda(`${juego.nombre} ${juego.genero} ${juego.descripcion} ${juego.streamers}`);
    return (!busqueda || textoJuego.includes(busqueda))
        && pfGeneroCoincide(juego.genero, genero, juego)
        && (!edad || juego.edad === edad)
        && (!soloFavoritos || leerFavoritos().includes(juego.slug))
        && (!esInfantil || juego.infantil);
}
function pfPintarCatalogoActual() {
    const normal = document.getElementById("catalogoDinamico");
    const input = $("buscadorJuegos");
    const query = (input?.value || "").trim();
    if (!normal) return;

    normal.replaceChildren();
    const nombresDestacados = new Set([...document.querySelectorAll(".contenedor-juegos .juego h3")].map(titulo => pfNormalizarBusqueda(titulo.textContent)));
    const resultadosExternos = query.length >= 2 && pfTerminoWikidata === query
        ? pfResultadosWikidata.map(pfNormalizarJuego).filter(j => !nombresDestacados.has(pfNormalizarBusqueda(j.nombre)))
        : [];
    const todos = [
        ...(window.PIXELFORGE_CATALOGO || []).map(pfNormalizarJuego).map(j => ({ ...j, deBase: true })),
        ...pfJuegosBD.map(pfNormalizarJuego).filter(j => !nombresDestacados.has(pfNormalizarBusqueda(j.nombre))),
        ...(window.pfJuegosRawg || []).map(pfNormalizarJuego).filter(j => !nombresDestacados.has(pfNormalizarBusqueda(j.nombre))),
        ...resultadosExternos
    ];
    const unicos = new Map();
    todos.forEach(j => unicos.set(j.slug, j));
    const visibles = [...unicos.values()].filter(pfCoincideFiltros);
    visibles.forEach(j => normal.appendChild(pfCrearTarjetaJuego(j)));
    aplicarFiltroJuegos();
    const destacadosVisibles = [...document.querySelectorAll(".contenedor-juegos .juego")].filter(card => !card.hidden).length;

    if (!visibles.length) {
        const aviso = document.createElement("p");
        aviso.className = "mensaje-catalogo-vacio";
        if (query.length >= 2 && pfWikidataCargando) {
            aviso.textContent = "Buscando videojuegos en Wikidata...";
        } else if (query.length >= 2 && pfWikidataError) {
            aviso.textContent = destacadosVisibles
                ? "No pude conectar con Wikidata. Hay coincidencias en los juegos destacados de arriba."
                : "No pude conectar con la búsqueda de Wikidata. Puedes seguir buscando en los juegos destacados y los aprobados por la comunidad.";
        } else if (query.length >= 2 && destacadosVisibles) {
            aviso.textContent = "No hay coincidencias adicionales en el catálogo de la comunidad. Revisa también los juegos destacados que aparecen arriba.";
        } else if (query.length >= 2) {
            aviso.textContent = "No se encontraron coincidencias en los juegos aprobados ni en Wikidata. Prueba el nombre oficial del juego o revisa tu conexión.";
        } else {
            aviso.textContent = "Los videojuegos aprobados por la comunidad aparecerán aquí. Usa el buscador para consultar más juegos sin cargar un catálogo fijo.";
        }
        normal.appendChild(aviso);
    }

    const total = destacadosVisibles + visibles.length;
    if (query.length >= 2 && pfWikidataCargando) {
        mensaje("mensajeBusqueda", total ? `Se muestran ${total} coincidencia(s) local(es); buscando más videojuegos...` : "Buscando videojuegos en la base local y Wikidata...");
    } else if (!total) {
        mensaje("mensajeBusqueda", query ? "No se encontraron videojuegos con ese nombre o filtros." : "No hay videojuegos que coincidan con los filtros actuales.");
    } else if (query.length >= 2 && pfResultadosWikidata.length) {
        mensaje("mensajeBusqueda", `Se encontraron ${total} resultado(s). Los resultados de Wikidata son informativos y no se guardan en Supabase automáticamente.`);
    } else {
        mensaje("mensajeBusqueda", `Coincidencias visibles: ${total}.`);
    }
    pfActualizarResumenTarjetas();
}

function pfRenderCatalogos() {
    pfPintarCatalogoActual();
    const kids = document.getElementById("catalogoInfantil");
    if (kids) {
        kids.replaceChildren();
        const todos = [...(window.PIXELFORGE_CATALOGO || []).map(pfNormalizarJuego), ...pfJuegosBD.map(pfNormalizarJuego)];
        const unicos = new Map();
        todos.forEach(j => { if (j.infantil) unicos.set(j.slug, j); });
        const infantiles = [...unicos.values()];
        infantiles.forEach(j => kids.appendChild(pfCrearTarjetaJuego(j)));
        if (!infantiles.length) {
            const aviso = document.createElement("p");
            aviso.className = "mensaje-catalogo-vacio";
            aviso.textContent = "La zona infantil mostrará aquí los juegos aprobados que tengan una edad sugerida infantil. Revisa siempre la clasificación oficial.";
            kids.appendChild(aviso);
        }
    }
    actualizarBotonesFavoritos();
    pfActualizarResumenTarjetas();
}

async function pfConsultarWikidata(termino, signal) {
    const textoSeguro = String(termino).replace(/\\/g, "\\\\").replace(/"/g, '\\"').slice(0, 100);
    const sparql = `SELECT ?item ?itemLabel ?itemDescription ?releaseDate ?officialWebsite WHERE {
      SERVICE wikibase:mwapi {
        bd:serviceParam wikibase:api "EntitySearch";
          wikibase:endpoint "www.wikidata.org";
          mwapi:search "${textoSeguro}";
          mwapi:language "es".
        ?item wikibase:apiOutputItem mwapi:item.
      }
      ?item wdt:P31/wdt:P279* wd:Q7889.
      OPTIONAL { ?item wdt:P577 ?releaseDate. }
      OPTIONAL { ?item wdt:P856 ?officialWebsite. }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
    }
    LIMIT 10`;
    const url = "https://query.wikidata.org/sparql?query=" + encodeURIComponent(sparql) + "&format=json";
    const respuesta = await fetch(url, {
        method: "GET",
        headers: { "Accept": "application/sparql-results+json" },
        signal,
        cache: "no-store"
    });
    if (!respuesta.ok) throw new Error(`Wikidata respondió HTTP ${respuesta.status}.`);
    const json = await respuesta.json();
    const bindings = json?.results?.bindings;
    if (!Array.isArray(bindings)) throw new Error("Wikidata devolvió una respuesta que no pude reconocer.");
    return bindings.map(registro => {
        const itemUrl = registro.item?.value || "";
        const id = itemUrl.split("/").pop();
        const nombre = registro.itemLabel?.value || "Videojuego";
        const descripcionApi = registro.itemDescription?.value || "Videojuego encontrado en Wikidata.";
        const fecha = registro.releaseDate?.value ? registro.releaseDate.value.slice(0, 10) : "";
        const sitio = registro.officialWebsite?.value || "";
        return {
            slug: `wikidata-${id || pfSlug(nombre)}`,
            nombre,
            genero: "Videojuego",
            edad: "Pendiente de verificar",
            descripcion: fecha ? `${descripcionApi} · Lanzamiento registrado: ${fecha}.` : descripcionApi,
            url: /^https:\/\//i.test(sitio) ? sitio : "",
            url_wikidata: itemUrl,
            url_streamers: `https://www.twitch.tv/search?term=${encodeURIComponent(nombre)}`,
            streamers: "Busca creadores que transmiten este videojuego",
            infantil: false,
            deBase: false,
            fuenteWikidata: true
        };
    }).filter(juego => juego.nombre && juego.slug);
}

function pfProgramarBusquedaWikidata() {
    const termino = ($("buscadorJuegos")?.value || "").trim();
    if (pfWikidataTimer) clearTimeout(pfWikidataTimer);
    if (pfWikidataController) pfWikidataController.abort();
    pfWikidataCargando = false;
    pfWikidataError = false;

    if (termino.length < 2) {
        pfTerminoWikidata = "";
        pfResultadosWikidata = [];
        pfPintarCatalogoActual();
        return;
    }

    if (termino !== pfTerminoWikidata) {
        pfTerminoWikidata = termino;
        pfResultadosWikidata = [];
    }
    if (pfCacheWikidata.has(termino)) {
        pfResultadosWikidata = pfCacheWikidata.get(termino);
        pfPintarCatalogoActual();
        return;
    }

    pfWikidataCargando = true;
    pfPintarCatalogoActual();
    pfWikidataTimer = window.setTimeout(async () => {
        const controlador = new AbortController();
        pfWikidataController = controlador;
        try {
            let resultados = await pfConsultarWikidata(termino, controlador.signal);
            if (controlador.signal.aborted || termino !== ($("buscadorJuegos")?.value || "").trim()) return;
            // Si la búsqueda en español no devuelve registros, intenta la consulta con la escritura en inglés.
            if (!resultados.length) {
                resultados = await pfConsultarWikidataIngles(termino, controlador.signal);
            }
            if (controlador.signal.aborted || termino !== ($("buscadorJuegos")?.value || "").trim()) return;
            pfResultadosWikidata = resultados;
            pfCacheWikidata.set(termino, resultados);
        } catch (error) {
            if (error?.name !== "AbortError") {
                console.warn("No se pudo buscar en Wikidata:", error);
                pfResultadosWikidata = [];
                pfWikidataError = true;
            }
        } finally {
            if (!controlador.signal.aborted && termino === ($("buscadorJuegos")?.value || "").trim()) {
                pfWikidataCargando = false;
                pfPintarCatalogoActual();
            }
        }
    }, 450);
}
async function pfConsultarWikidataIngles(termino, signal) {
    // Segunda consulta idéntica con el texto de búsqueda en inglés, por si la primera no encontró títulos.
    const textoSeguro = String(termino).replace(/\\/g, "\\\\").replace(/"/g, '\\"').slice(0, 100);
    const sparql = `SELECT ?item ?itemLabel ?itemDescription ?releaseDate ?officialWebsite WHERE {
      SERVICE wikibase:mwapi {
        bd:serviceParam wikibase:api "EntitySearch";
          wikibase:endpoint "www.wikidata.org";
          mwapi:search "${textoSeguro}";
          mwapi:language "en".
        ?item wikibase:apiOutputItem mwapi:item.
      }
      ?item wdt:P31/wdt:P279* wd:Q7889.
      OPTIONAL { ?item wdt:P577 ?releaseDate. }
      OPTIONAL { ?item wdt:P856 ?officialWebsite. }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,es". }
    }
    LIMIT 10`;
    const url = "https://query.wikidata.org/sparql?query=" + encodeURIComponent(sparql) + "&format=json";
    const respuesta = await fetch(url, { headers: { "Accept": "application/sparql-results+json" }, signal, cache: "no-store" });
    if (!respuesta.ok) throw new Error(`Wikidata respondió HTTP ${respuesta.status}.`);
    const json = await respuesta.json();
    if (!Array.isArray(json?.results?.bindings)) return [];
    return json.results.bindings.map(registro => {
        const itemUrl = registro.item?.value || "";
        const id = itemUrl.split("/").pop();
        const nombre = registro.itemLabel?.value || "Videojuego";
        const description = registro.itemDescription?.value || "Videojuego encontrado en Wikidata.";
        const fecha = registro.releaseDate?.value ? registro.releaseDate.value.slice(0, 10) : "";
        const sitio = registro.officialWebsite?.value || "";
        return { slug: `wikidata-${id || pfSlug(nombre)}`, nombre, genero: "Videojuego", edad: "Pendiente de verificar", descripcion: fecha ? `${description} · Lanzamiento registrado: ${fecha}.` : description, url: /^https:\/\//i.test(sitio) ? sitio : "", url_wikidata: itemUrl, url_streamers: `https://www.twitch.tv/search?term=${encodeURIComponent(nombre)}`, streamers: "Busca creadores que transmiten este videojuego", infantil: false, deBase: false, fuenteWikidata: true };
    }).filter(juego => juego.nombre && juego.slug);
}

// RAWG: catálogo mucho más amplio (requiere una clave gratuita del proveedor).
window.pfJuegosRawg = window.pfJuegosRawg || [];
let pfRawgTemporizador = null;
let pfRawgConsultaActual = "";
function pfRawgGeneroParaCategoria(categoria) {
    const c = pfNormalizarBusqueda(categoria);
    const mapa = { accion:"action", carreras:"racing", aventura:"adventure", estrategia:"strategy", terror:"horror", rpg:"role-playing", deportes:"sports", simulacion:"simulation", indie:"indie", sandbox:"sandbox" };
    return mapa[c] || "";
}
function pfMapearJuegoRawg(rawg) {
    const generos = (rawg.genres || []).map(x => x.name).filter(Boolean);
    const tags = (rawg.tags || []).map(x => x.name).filter(Boolean);
    const todosGeneros = [...generos, ...tags].join(", ") || "Otro";
    const edad = rawg.esrb_rating?.name ? rawg.esrb_rating.name : "Pendiente de verificar";
    const plataformasPC = (rawg.platforms || []).map(x => x.platform?.name).filter(Boolean);
    const requisitosPC = (rawg.platforms || []).find(x => /pc|windows/i.test(x.platform?.name || ""))?.requirements || {};
    return {
        slug: `rawg-${rawg.slug || rawg.id}`, nombre: rawg.name || "Videojuego", genero: todosGeneros,
        edad, descripcion: `Juego de RAWG${rawg.released ? ` · Lanzamiento: ${rawg.released}` : ""}${rawg.rating ? ` · Valoración RAWG: ${rawg.rating}/5` : ""}.`,
        url: `https://rawg.io/games/${rawg.slug || rawg.id}`, imagen: rawg.background_image || "",
        streamers: "", url_streamers: pfTwitchBuscar(rawg.name || ""),
        requisitos_minimos: requisitosPC.minimum || "", requisitos_recomendados: requisitosPC.recommended || "",
        fuenteRawg: true, rawgId: rawg.id, rawgSlug: rawg.slug || String(rawg.id), infantil: /everyone|everyone 10\+/i.test(edad),
        rawgPlataformas: plataformasPC.join(", ")
    };
}
async function pfCargarRawgParaCatalogo() {
    const config = window.PIXELFORGE_CONFIG || {};
    const key = String(config.rawgApiKey || "").trim();
    if (!key) return;
    const busqueda = String($("buscadorJuegos")?.value || "").trim();
    const categoria = String($("filtroGeneroCatalogo")?.value || "").trim();
    if (busqueda.length === 1) return;
    const queryKey = `${busqueda.toLowerCase()}|${categoria.toLowerCase()}`;
    if (queryKey === pfRawgConsultaActual) return;
    pfRawgConsultaActual = queryKey;
    const params = new URLSearchParams({ key, page_size: "24", ordering: "-added" });
    if (busqueda.length >= 2) params.set("search", busqueda);
    const genre = pfRawgGeneroParaCategoria(categoria);
    if (genre) params.set("genres", genre);
    if (categoria && ["supervivencia", "cooperativo", "familiar", "disparos", "moba", "battle royale"].includes(pfNormalizarBusqueda(categoria))) {
        const tags = { supervivencia:"survival", cooperativo:"co-op", familiar:"family", disparos:"shooter", moba:"moba", "battle royale":"battle-royale" };
        params.set("tags", tags[pfNormalizarBusqueda(categoria)]);
    }
    try {
        const response = await fetch(`https://api.rawg.io/api/games?${params.toString()}`, { headers: { Accept: "application/json" }, cache: "no-store" });
        if (!response.ok) throw new Error(`RAWG HTTP ${response.status}`);
        const data = await response.json();
        if (queryKey !== pfRawgConsultaActual) return;
        window.pfJuegosRawg = (data.results || []).map(pfMapearJuegoRawg);
        pfPintarCatalogoActual();
    } catch (error) {
        console.warn("RAWG no pudo cargar el catálogo; se conserva el catálogo actual:", error);
        if (queryKey === pfRawgConsultaActual && $("mensajeBusqueda")) mensaje("mensajeBusqueda", "No se pudo cargar RAWG. Comprueba la clave API y la conexión; el catálogo guardado se conserva.");
    }
}
function pfProgramarRawg() {
    if (pfRawgTemporizador) clearTimeout(pfRawgTemporizador);
    pfRawgTemporizador = setTimeout(pfCargarRawgParaCatalogo, 550);
}
function pfFiltrosActualizados() {
    aplicarFiltroJuegos();
    pfPintarCatalogoActual();
    pfProgramarBusquedaWikidata();
    pfProgramarRawg();
}

// Se registra la búsqueda una sola vez y antes de esperar a la red/Supabase.
$("buscadorJuegos")?.addEventListener("input", pfFiltrosActualizados);
$("filtroGeneroCatalogo")?.addEventListener("change", pfFiltrosActualizados);
$("filtroEdadCatalogo")?.addEventListener("change", pfFiltrosActualizados);

// PixelForge V7: enlaza las categorías en cuanto se carga el script, sin esperar a Supabase.
// Así los botones siguen funcionando aunque falle o tarde la consulta a la base de datos.
document.querySelectorAll(".categoria-filtro").forEach(btn => {
    btn.setAttribute("aria-pressed", "false");
    btn.addEventListener("click", () => {
        // La navegación de PixelForge muestra una sola sección a la vez.
        // Ir primero al catálogo evita filtrar una sección que permanece oculta.
        if (window.location.hash !== "#juegos") window.location.hash = "#juegos";
        const cat = String(btn.dataset.genero || "").trim();
        const busqueda = $("buscadorJuegos");
        const filtro = $("filtroGeneroCatalogo");
        const filtroEdad = $("filtroEdadCatalogo");
        const tabTodos = $("tabTodosJuegos");

        // Asegura que los resultados filtrados estén visibles en el catálogo general.
        if (tabTodos && !tabTodos.classList.contains("activa")) tabTodos.click();
        if (busqueda) busqueda.value = "";
        if (filtroEdad) filtroEdad.value = "";

        if (filtro) {
            if (!cat) {
                filtro.value = "";
            } else {
                let opcion = [...filtro.options].find(o =>
                    pfNormalizarBusqueda(o.value || o.textContent) === pfNormalizarBusqueda(cat)
                );
                // Si se añade una categoría nueva al HTML, no se pierde el filtro por falta de opción.
                if (!opcion) {
                    opcion = document.createElement("option");
                    opcion.value = cat;
                    opcion.textContent = cat;
                    filtro.appendChild(opcion);
                }
                filtro.value = opcion.value;
            }
        }

        document.querySelectorAll(".categoria-filtro").forEach(categoriaBtn => {
            const activa = categoriaBtn === btn;
            categoriaBtn.classList.toggle("activa", activa);
            categoriaBtn.setAttribute("aria-pressed", String(activa));
        });

        pfFiltrosActualizados();
        $("juegos")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
});

async function pfCargarCatalogoBD() {
    if (!supabase) return;
    const { data, error } = await supabase.from("catalogo_publico").select("slug,nombre,genero,descripcion,clasificacion_edad,sitio_oficial,imagen_url,streamers,es_infantil,requisitos_minimos,requisitos_recomendados").eq("aprobado", true).order("nombre", { ascending: true }).limit(500);
    if (error) { console.warn("Catálogo de Supabase no disponible todavía. El catálogo base seguirá funcionando.", error.message); return; }
    pfJuegosBD = (data || []).map(row => ({ ...row, edad: row.clasificacion_edad, url: row.sitio_oficial, imagen: row.imagen_url, infantil: row.es_infantil, deBase: false }));
}
async function guardarFavoritoNube(slug, guardado) {
    if (!supabase || !usuario) return;
    try {
        if (guardado) {
            const { error } = await supabase.from("videojuego_favoritos").upsert({ usuario_id: usuario.id, slug }, { onConflict: "usuario_id,slug" });
            if (error) throw error;
        } else {
            const { error } = await supabase.from("videojuego_favoritos").delete().eq("usuario_id", usuario.id).eq("slug", slug);
            if (error) throw error;
        }
    } catch (error) { console.error("Favorito no pudo sincronizarse:", error); mensaje("mensajeBusqueda", "El favorito queda guardado en este navegador, pero no se sincronizó con Supabase. Revisa el SQL."); }
}
async function pfCargarFavoritosUsuario() {
    if (!supabase || !usuario) { actualizarBotonesFavoritos(); return; }
    const locales = leerFavoritos();
    const { data, error } = await supabase.from("videojuego_favoritos").select("slug").eq("usuario_id", usuario.id);
    if (error) { console.warn("No se pudieron recuperar favoritos de la cuenta:", error.message); return; }
    const remotos = (data || []).map(x => x.slug);
    const combinados = [...new Set([...remotos, ...locales])];
    guardarFavoritos(combinados);
    for (const slug of combinados) {
        if (!remotos.includes(slug)) await guardarFavoritoNube(slug, true);
    }
    actualizarBotonesFavoritos();
}
async function pfCargarCalificacionesUsuario() {
    pfCalificacionesUsuario = pfLeerJSONLocal(PF_CLAVE_CALIFICACIONES_LOCAL, {});
    if (!supabase || !usuario) return;
    const { data, error } = await supabase.from("videojuego_calificaciones").select("slug,puntuacion").eq("usuario_id", usuario.id);
    if (error) { console.warn("No se pudieron cargar las calificaciones:", error.message); return; }
    (data || []).forEach(r => { pfCalificacionesUsuario[r.slug] = r.puntuacion; });
    pfGuardarJSONLocal(PF_CLAVE_CALIFICACIONES_LOCAL, pfCalificacionesUsuario);
}
async function pfCargarResumenCalificaciones() {
    if (!supabase) return;
    const { data, error } = await supabase.from("resumen_calificaciones_videojuegos").select("slug,promedio,total");
    if (error) { console.warn("Resumen de calificaciones no disponible aún:", error.message); return; }
    pfCalificacionesResumen = {};
    (data || []).forEach(r => { pfCalificacionesResumen[r.slug] = { promedio: Number(r.promedio) || 0, total: Number(r.total) || 0 }; });
}
const pfCargarCalificacionesResumen = pfCargarResumenCalificaciones;
function pfActualizarResumenTarjetas() {
    document.querySelectorAll("[data-resumen-slug]").forEach(el => {
        const slug = el.dataset.resumenSlug; const r = pfCalificacionesResumen[slug];
        el.textContent = r && r.total ? `Comunidad: ${r.promedio.toFixed(1)}/5 (${r.total})` : "Comunidad: sin calificaciones";
    });
    document.querySelectorAll("select[data-calificar]").forEach(select => {
        const slug = select.dataset.calificar;
        if (pfCalificacionesUsuario[slug]) select.value = String(pfCalificacionesUsuario[slug]);
    });
}
async function pfVerificarAdmin() {
    const estado = $("pfEstadoAdmin");
    const zona = $("zonaModeracionCatalogo");
    if (!supabase || !usuario || usuario.id === "invitado-local") {
        pfEsAdmin = false;
        if (zona) zona.hidden = true;
        if (estado) estado.textContent = !supabase
            ? "No se pudo conectar con Supabase. Revisa la conexión y la consola del navegador."
            : "Inicia sesión con la cuenta que habilitaste como administradora en Supabase para mostrar el panel.";
        window.dispatchEvent(new Event("pixelforge:admin-state"));
        return;
    }
    const { data, error } = await supabase.from("pixelforge_admins").select("user_id").eq("user_id", usuario.id).maybeSingle();
    pfEsAdmin = !error && Boolean(data);
    if (zona) zona.hidden = !pfEsAdmin;
    if (estado) {
        estado.textContent = error
            ? `No se pudo verificar el permiso de administrador. Detalle: ${error.code || "sin código"} — ${error.message || "error de Supabase"}`
            : pfEsAdmin
                ? "Acceso de administrador confirmado. Puedes revisar propuestas y editar el catálogo más abajo."
                : "Has iniciado sesión, pero esta cuenta aún no está registrada como administradora. Ejecuta PASO_ADMINISTRADOR_V8.sql con el correo exacto de tu cuenta.";
    }
    if (error) console.error("PixelForge no pudo comprobar el administrador:", error);
    window.dispatchEvent(new Event("pixelforge:admin-state"));
    pfInicializarEditorCatalogo();
    if (pfEsAdmin) { await pfCargarPropuestasAdmin(); await pfCargarCatalogoAdmin(); }
}
async function pfCargarPropuestasAdmin() {
    if (!pfEsAdmin || !supabase) return;
    const contenedor = $("listaPropuestasPendientes"); if (!contenedor) return;
    const { data, error } = await supabase.from("propuestas_videojuegos").select("id,nombre,genero,clasificacion_edad,sitio_oficial,imagen_url,streamers,descripcion,estado,creado_en").eq("estado", "pendiente").order("creado_en", { ascending: true }).limit(100);
    contenedor.replaceChildren();
    if (error) { const p = document.createElement("p"); p.textContent = "No se pudieron cargar propuestas. Ejecuta el SQL de PixelForge."; contenedor.appendChild(p); console.warn(error); return; }
    if (!data?.length) { const p = document.createElement("p"); p.textContent = "No hay propuestas pendientes."; contenedor.appendChild(p); return; }
    data.forEach(p => {
        const card = document.createElement("article"); card.className = "tarjeta-publicacion";
        const title = document.createElement("h4"); title.textContent = p.nombre;
        const detail = document.createElement("p"); detail.textContent = `${p.genero} · ${p.clasificacion_edad} · ${p.descripcion || "Sin descripción"}`;
        const url = pfCrearEnlace(p.sitio_oficial, "Abrir página propuesta");
        const actions = document.createElement("div"); actions.className = "acciones-formulario";
        const approve = document.createElement("button"); approve.type = "button"; approve.className = "boton"; approve.textContent = "Aprobar y publicar";
        approve.addEventListener("click", async () => {
            botonCargando(approve, true, "Publicando...");
            try {
                const slugBase = pfSlug(p.nombre);
                const { error: insertError } = await supabase.from("catalogo_publico").upsert({ slug: slugBase, nombre: p.nombre, genero: p.genero, descripcion: p.descripcion || "Propuesto por la comunidad PixelForge.", clasificacion_edad: p.clasificacion_edad || "Pendiente de verificar", sitio_oficial: p.sitio_oficial, imagen_url: p.imagen_url || null, streamers: p.streamers || null, es_infantil: ["3+", "7+"].includes(p.clasificacion_edad), aprobado: true }, { onConflict: "slug" });
                if (insertError) throw insertError;
                const { error: updateError } = await supabase.from("propuestas_videojuegos").update({ estado: "aprobada" }).eq("id", p.id);
                if (updateError) throw updateError;
                await pfCargarCatalogoBD(); pfRenderCatalogos(); await pfCargarPropuestasAdmin();
            } catch (e) { mensaje("mensajePropuesta", "No se pudo aprobar: " + (e.message || "comprueba las políticas SQL")); }
            finally { botonCargando(approve, false); }
        });
        const reject = document.createElement("button"); reject.type = "button"; reject.className = "boton boton-secundario"; reject.textContent = "Rechazar";
        reject.addEventListener("click", async () => {
            if (!confirm(`¿Rechazar la propuesta “${p.nombre}”?`)) return;
            const { error: updateError } = await supabase.from("propuestas_videojuegos").update({ estado: "rechazada" }).eq("id", p.id);
            if (updateError) mensaje("mensajePropuesta", "No se pudo rechazar: " + updateError.message); else await pfCargarPropuestasAdmin();
        });
        actions.append(approve, reject); card.append(title, detail, url, actions); contenedor.appendChild(card);
    });
}
async function pfCargarCatalogoAdmin() {
    if (!pfEsAdmin || !supabase) return;
    const lista = $("pfEditorListaCatalogo");
    if (!lista) return;
    lista.replaceChildren();
    const { data, error } = await supabase.from("catalogo_publico")
        .select("slug,nombre,genero,descripcion,clasificacion_edad,sitio_oficial,imagen_url,streamers,es_infantil,aprobado,requisitos_minimos,requisitos_recomendados")
        .order("nombre", { ascending: true }).limit(500);
    if (error) {
        const p = document.createElement("p");
        p.textContent = "No se pudo leer el catálogo de Supabase. Ejecuta pixelforge_v8_migracion.sql y revisa la consola.";
        lista.appendChild(p); console.warn("Editor de catálogo PixelForge:", error); return;
    }
    if (!data?.length) {
        const p = document.createElement("p"); p.textContent = "La tabla está lista, pero aún no tiene juegos guardados."; lista.appendChild(p); return;
    }
    data.forEach(juego => {
        const card = document.createElement("article"); card.className = "tarjeta-publicacion pf-admin-juego";
        const title = document.createElement("h4"); title.textContent = juego.nombre;
        const detail = document.createElement("p"); detail.textContent = `${juego.genero} · ${juego.clasificacion_edad} · ${juego.aprobado ? "Publicado" : "Borrador"}`;
        const actions = document.createElement("div"); actions.className = "acciones-formulario";
        const edit = document.createElement("button"); edit.type = "button"; edit.className = "boton boton-secundario"; edit.textContent = "Editar";
        edit.addEventListener("click", () => {
            const form = $("pfEditorCatalogoForm");
            $("pfEditorSlug").value = juego.slug || ""; $("pfEditorSlug").readOnly = true;
            $("pfEditorNombre").value = juego.nombre || "";
            const generoSelect = $("pfEditorGenero");
            const generoActual = juego.genero || "Otro";
            if (generoSelect && ![...generoSelect.options].some(o => o.value === generoActual || o.textContent === generoActual)) {
                const opcionGenero = document.createElement("option"); opcionGenero.value = generoActual; opcionGenero.textContent = generoActual; generoSelect.appendChild(opcionGenero);
            }
            if (generoSelect) generoSelect.value = generoActual;
            const edadSelect = $("pfEditorEdad");
            const edadActual = juego.clasificacion_edad || "Pendiente de verificar";
            if (edadSelect && ![...edadSelect.options].some(o => o.value === edadActual || o.textContent === edadActual)) {
                const opcionEdad = document.createElement("option"); opcionEdad.value = edadActual; opcionEdad.textContent = edadActual; edadSelect.appendChild(opcionEdad);
            }
            if (edadSelect) edadSelect.value = edadActual;
            $("pfEditorUrl").value = juego.sitio_oficial || ""; $("pfEditorImagen").value = juego.imagen_url || "";
            $("pfEditorStreamers").value = juego.streamers || ""; $("pfEditorDescripcion").value = juego.descripcion || "";
            if ($("pfEditorReqMin")) $("pfEditorReqMin").value = juego.requisitos_minimos || "";
            if ($("pfEditorReqRec")) $("pfEditorReqRec").value = juego.requisitos_recomendados || "";
            $("pfEditorInfantil").checked = Boolean(juego.es_infantil); $("pfEditorAprobado").checked = Boolean(juego.aprobado);
            $("pfEditorGuardar").textContent = "Guardar cambios";
            $("pfEditorMensaje").textContent = `Editando: ${juego.nombre}. El identificador no cambia.`;
            form?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        const del = document.createElement("button"); del.type = "button"; del.className = "boton boton-secundario"; del.textContent = "Eliminar";
        del.addEventListener("click", async () => {
            if (!confirm(`¿Eliminar “${juego.nombre}” del catálogo público? Esta acción no elimina publicaciones ni la biblioteca personal.`)) return;
            del.disabled = true;
            try {
                const { error: deleteError } = await supabase.from("catalogo_publico").delete().eq("slug", juego.slug);
                if (deleteError) throw deleteError;
                await pfCargarCatalogoBD(); pfRenderCatalogos(); await pfCargarCatalogoAdmin();
                $("pfEditorMensaje").textContent = `Se eliminó “${juego.nombre}” del catálogo público.`;
            } catch (e) {
                $("pfEditorMensaje").textContent = "No se pudo eliminar. Comprueba el permiso de administrador y las políticas RLS.";
                console.error("Error al eliminar del catálogo:", e);
            } finally { del.disabled = false; }
        });
        actions.append(edit, del); card.append(title, detail, actions); lista.appendChild(card);
    });
}

function pfInicializarEditorCatalogo() {
    const form = $("pfEditorCatalogoForm");
    if (!form || form.dataset.inicializado === "true") return;
    form.dataset.inicializado = "true";
    $("pfEditorNuevo")?.addEventListener("click", () => {
        form.reset(); $("pfEditorSlug").readOnly = false; $("pfEditorGuardar").textContent = "Guardar juego";
        $("pfEditorMensaje").textContent = "Formulario listo para un juego nuevo.";
    });
    $("pfEditorCancelar")?.addEventListener("click", () => {
        form.reset(); $("pfEditorSlug").readOnly = false; $("pfEditorGuardar").textContent = "Guardar juego";
        $("pfEditorMensaje").textContent = "Edición cancelada.";
    });
    form.addEventListener("submit", async event => {
        event.preventDefault();
        if (!pfEsAdmin || !supabase) { $("pfEditorMensaje").textContent = "Inicia sesión con una cuenta administradora para modificar el catálogo."; return; }
        const nombre = $("pfEditorNombre").value.trim();
        const slug = ($("pfEditorSlug").value.trim() || pfSlug(nombre)).toLowerCase();
        const url = $("pfEditorUrl").value.trim(); const imagen = $("pfEditorImagen").value.trim();
        const esHttps = value => { try { return new URL(value).protocol === "https:"; } catch { return false; } };
        if (!nombre || nombre.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) { $("pfEditorMensaje").textContent = "Escribe un nombre y un identificador simple (ej. mi-videojuego)."; return; }
        if (!esHttps(url) || (imagen && !esHttps(imagen))) { $("pfEditorMensaje").textContent = "La página oficial es obligatoria y debe comenzar con https://; la imagen también, si la usas."; return; }
        const btn = $("pfEditorGuardar"); btn.disabled = true; btn.textContent = "Guardando...";
        try {
            const payload = {
                slug, nombre, genero: $("pfEditorGenero").value,
                clasificacion_edad: $("pfEditorEdad").value,
                sitio_oficial: url, imagen_url: imagen || null,
                streamers: $("pfEditorStreamers").value.trim() || null,
                descripcion: $("pfEditorDescripcion").value.trim() || null,
                requisitos_minimos: $("pfEditorReqMin")?.value.trim() || null,
                requisitos_recomendados: $("pfEditorReqRec")?.value.trim() || null,
                es_infantil: $("pfEditorInfantil").checked,
                aprobado: $("pfEditorAprobado").checked
            };
            const { error } = await supabase.from("catalogo_publico").upsert(payload, { onConflict: "slug" });
            if (error) throw error;
            form.reset(); $("pfEditorSlug").readOnly = false; btn.textContent = "Guardar juego";
            $("pfEditorMensaje").textContent = `“${nombre}” se guardó en Supabase.`;
            await pfCargarCatalogoBD(); pfRenderCatalogos(); await pfCargarCatalogoAdmin();
        } catch (error) {
            console.error("No se pudo guardar el videojuego en Supabase:", error);
            $("pfEditorMensaje").textContent = "No se pudo guardar. Revisa que tu cuenta esté en pixelforge_admins y ejecuta el SQL V8.";
        } finally { btn.disabled = false; if (btn.textContent === "Guardando...") btn.textContent = "Guardar juego"; }
    });
}

async function pfEnviarPropuesta(evento) {
    evento.preventDefault();
    if (!supabase) { mensaje("mensajePropuesta", "No se ha conectado Supabase. Comprueba tu internet y la configuración."); return; }
    const nombre = $("propuestaNombre").value.trim();
    const genero = $("propuestaGenero").value;
    const edad = $("propuestaEdad").value;
    const sitio = $("propuestaUrl").value.trim();
    const imagen = $("propuestaImagen").value.trim();
    const streamers = $("propuestaStreamers").value.trim();
    const descripcion = $("propuestaDescripcion").value.trim();
    const validarHttps = (valor) => { try { const u = new URL(valor); return u.protocol === "https:"; } catch { return false; } };
    if (!nombre || !validarHttps(sitio) || (imagen && !validarHttps(imagen))) { mensaje("mensajePropuesta", "Escribe un nombre y enlaces https válidos. No se aceptan páginas inseguras."); return; }
    const boton = $("enviarPropuesta"); botonCargando(boton, true, "Enviando...");
    try {
        const { error } = await supabase.from("propuestas_videojuegos").insert({ nombre, genero, clasificacion_edad: edad, sitio_oficial: sitio, imagen_url: imagen || null, streamers: streamers || null, descripcion: descripcion || null, creado_por: (usuario?.id && usuario.id !== "invitado-local") ? usuario.id : null, estado: "pendiente" });
        if (error) throw error;
        $("formPropuestaJuego").reset();
        mensaje("mensajePropuesta", "¡Propuesta recibida! Se guardó en la base de datos y quedará pendiente de revisión antes de aparecer en el catálogo.");
        if (pfEsAdmin) await pfCargarPropuestasAdmin();
    } catch (error) {
        console.error("Error al enviar propuesta:", error);
        mensaje("mensajePropuesta", "No se pudo guardar la propuesta. Ejecuta el archivo SQL de PixelForge en Supabase y vuelve a intentar. Detalle: " + (error.message || "error de conexión"));
    } finally { botonCargando(boton, false); }
}

/* ================= PIXELFORGE: API EXTERNA DE VIDEOJUEGOS (FreeToGame) ================= */
let pfJuegosApi = [];
let pfApiCargando = false;

function pfNormalizarGeneroApi(genero) {
    const g = String(genero || "").toLowerCase();
    if (g.includes("shooter") || g.includes("fps")) return "Disparos";
    if (g.includes("battle royale")) return "Battle royale";
    if (g.includes("rpg") || g.includes("mmo")) return "RPG";
    if (g.includes("strategy") || g.includes("moba")) return "Estrategia";
    if (g.includes("racing")) return "Carreras";
    if (g.includes("sports")) return "Deportes";
    if (g.includes("survival")) return "Supervivencia";
    return "Acción";
}

async function pfCargarJuegosApi(categoria = "") {
    const contenedor = $("contenedorApiJuegos");
    if (!contenedor) return;

    if (pfApiCargando) return;
    pfApiCargando = true;
    contenedor.innerHTML = '<p class="mensaje-catalogo-vacio">⚡ Consultando la API de videojuegos...</p>';

    try {
        let datos = [];
        // Primero se intenta la API remota para que la pestaña realmente consulte datos en vivo.
        try {
            const resp = await fetch("https://www.freetogame.com/api/games", {
                headers: { "Accept": "application/json" }, cache: "no-store"
            });
            if (resp.ok) datos = await resp.json();
            else console.warn("FreeToGame respondió HTTP", resp.status);
        } catch (e) {
            console.warn("La API directa puede estar bloqueada por CORS o no estar disponible:", e);
        }
        // Segundo intento: proxy del hosting, si el usuario decide configurarlo.
        if (!Array.isArray(datos) || !datos.length) {
            try {
                const resp = await fetch("./api/games", { headers: { "Accept": "application/json" }, cache: "no-store" });
                if (resp.ok) { const respuesta = await resp.json(); datos = Array.isArray(respuesta) ? respuesta : respuesta.games; }
            } catch (e) { console.warn("No se pudo conectar con proxy /api/games:", e); }
        }
        // Tercer intento: archivo JSON local opcional, útil para un hosting sin proxy.
        if (!Array.isArray(datos) || !datos.length) {
            try {
                const resp = await fetch("./data/games.json", { cache: "no-store" });
                if (resp.ok) { const respuesta = await resp.json(); datos = Array.isArray(respuesta) ? respuesta : respuesta.games; }
            } catch (e) { console.warn("No se pudo cargar /data/games.json:", e); }
        }
        // Último recurso: mostrar el catálogo incluido para que la sección no quede vacía sin internet/API.
        if (!Array.isArray(datos) || !datos.length) {
            datos = (window.PIXELFORGE_CATALOGO || []).map((j, index) => ({
                id: `local-${index + 1}`, title: j.nombre, genre: j.genero,
                platform: "PC / Consola", thumbnail: j.imagen,
                short_description: j.descripcion, game_url: j.url, developer: "Catálogo PixelForge"
            }));
        }
        if (!Array.isArray(datos) && Array.isArray(datos?.games)) datos = datos.games;

        if (Array.isArray(datos) && datos.length) {
            if (categoria) {
                const catNorm = categoria.toLowerCase();
                datos = datos.filter(j => {
                    const g = (j.genre || "").toLowerCase();
                    if (catNorm === "shooter") return g.includes("shooter") || g.includes("fps") || g.includes("shoot 'em up");
                    if (catNorm === "battle-royale") return g.includes("battle royale") || g.includes("battle-royale");
                    if (catNorm === "mmorpg") return g.includes("mmo") || g.includes("mmorpg");
                    if (catNorm === "strategy") return g.includes("strategy") || g.includes("moba") || g.includes("tactics");
                    if (catNorm === "rpg") return g.includes("rpg") || g.includes("role-playing") || g.includes("mmorpg");
                    if (catNorm === "racing") return g.includes("racing") || g.includes("kart");
                    if (catNorm === "sports") return g.includes("sports") || g.includes("football") || g.includes("soccer");
                    if (catNorm === "survival") return g.includes("survival");
                    return g.includes(catNorm);
                });
            }
        }

        if (!Array.isArray(datos) || !datos.length) {
            contenedor.innerHTML = '<p class="mensaje-catalogo-vacio">La API no devolvió juegos para esta categoría. Prueba otra categoría o vuelve a consultar más tarde.</p>';
            return;
        }

        pfJuegosApi = datos.slice(0, 48);
        contenedor.replaceChildren();

        pfJuegosApi.forEach(juego => {
            const card = document.createElement("article");
            card.className = "juego tarjeta-catalogo-extra";
            card.dataset.juego = `api-${juego.id}`;
            card.dataset.genero = pfNormalizarGeneroApi(juego.genre);

            const figura = document.createElement("div");
            figura.className = "imagen-juego-contenedor";
            const img = document.createElement("img");
            img.loading = "lazy";
            img.alt = `Portada de ${juego.title}`;
            img.src = juego.thumbnail || pfImagenMarcador(juego.title);
            img.addEventListener("error", () => {
                if (!img.dataset.fallback) {
                    img.dataset.fallback = "1";
                    img.src = pfImagenMarcador(juego.title);
                }
            }, { once: true });
            figura.appendChild(img);

            const info = document.createElement("div");
            info.className = "informacion";

            const badges = document.createElement("div");
            badges.innerHTML = `<span class="badge-api">🌐 API OFICIAL</span><span class="badge-plataforma">${juego.platform || "PC"}</span>`;

            const generoSpan = document.createElement("span");
            generoSpan.textContent = (juego.genre || "VIDEOJUEGO").toUpperCase();

            const tit = document.createElement("h3");
            tit.textContent = juego.title;

            const desc = document.createElement("p");
            desc.textContent = juego.short_description || "Juego obtenido desde la API oficial de videojuegos.";

            const acciones = document.createElement("div");
            acciones.className = "acciones-catalogo";

            if (juego.game_url) {
                acciones.appendChild(pfCrearEnlace(juego.game_url, "Sitio oficial"));
            }

            // Botón añadir a biblioteca
            const btnBiblioteca = document.createElement("button");
            btnBiblioteca.type = "button";
            btnBiblioteca.className = "boton-agregar-biblioteca";
            btnBiblioteca.textContent = "+ A mi biblioteca";
            btnBiblioteca.title = "Guardar este videojuego en tu biblioteca personal";
            btnBiblioteca.addEventListener("click", async () => {
                if (!usuario) {
                    usuario = { id: "invitado-local", email: "invitado@pixelforge.local" };
                    localStorage.setItem("pixelforge_usuario_activo", JSON.stringify(usuario));
                }
                const nuevoJuego = {
                    usuario_id: usuario.id,
                    nombre: juego.title,
                    plataforma: juego.platform && juego.platform.toLowerCase().includes("pc") ? "PC" : "Otra",
                    genero: pfNormalizarGeneroApi(juego.genre),
                    estado: "Jugando",
                    valoracion: 5,
                    notas: `Importado desde la API FreeToGame. Desarrollador: ${juego.developer || "Desconocido"}.`
                };

                if (usuario.id === "invitado-local" || !supabase) {
                    pfGuardarCopiaJuego(nuevoJuego, true);
                    btnBiblioteca.textContent = "✔ En tu biblioteca";
                    btnBiblioteca.disabled = true;
                    if ($("zonaBiblioteca") && !$("zonaBiblioteca").hidden) await cargarJuegos();
                    mensaje("mensajeBusqueda", `¡"${juego.title}" se guardó en tu biblioteca!`);
                } else {
                    btnBiblioteca.textContent = "Guardando...";
                    try {
                        const { error } = await supabase.from("videojuegos").insert(nuevoJuego);
                        if (error) throw error;
                        pfGuardarCopiaJuego(nuevoJuego, true);
                        btnBiblioteca.textContent = "✔ En tu biblioteca";
                        btnBiblioteca.disabled = true;
                        if ($("zonaBiblioteca") && !$("zonaBiblioteca").hidden) await cargarJuegos();
                        mensaje("mensajeBusqueda", `¡"${juego.title}" se guardó en tu cuenta de Supabase!`);
                    } catch (err) {
                        pfGuardarCopiaJuego(nuevoJuego, true);
                        btnBiblioteca.textContent = "✔ Guardado local";
                        btnBiblioteca.disabled = true;
                        mensaje("mensajeBusqueda", "El videojuego quedó guardado en este dispositivo. Se intentará sincronizar automáticamente cuando haya conexión.");
                    }
                }
            });
            acciones.appendChild(btnBiblioteca);

            // Botón favorito
            const btnFav = document.createElement("button");
            btnFav.type = "button";
            btnFav.className = "boton-favorito";
            btnFav.dataset.favorito = `api-${juego.id}`;
            const favoritos = leerFavoritos();
            const esFav = favoritos.includes(`api-${juego.id}`);
            btnFav.setAttribute("aria-pressed", String(esFav));
            btnFav.textContent = esFav ? "★ En favoritos" : "☆ Favorito";
            btnFav.addEventListener("click", async () => {
                const favs = leerFavoritos();
                const id = `api-${juego.id}`;
                const sig = favs.includes(id) ? favs.filter(x => x !== id) : [...favs, id];
                guardarFavoritos(sig);
                btnFav.setAttribute("aria-pressed", String(sig.includes(id)));
                btnFav.textContent = sig.includes(id) ? "★ En favoritos" : "☆ Favorito";
                if (typeof guardarFavoritoNube === "function") void guardarFavoritoNube(id, sig.includes(id));
            });
            acciones.appendChild(btnFav);

            info.append(badges, generoSpan, tit, desc, acciones);
            card.append(figura, info);
            contenedor.appendChild(card);
        });

    } catch (error) {
        console.error("Error al cargar FreeToGame API:", error);
        contenedor.innerHTML = `<p class="mensaje-catalogo-vacio">No se pudo conectar con la API de FreeToGame (${error.message}). Puedes seguir explorando el catálogo base y los destacados.</p>`;
    } finally {
        pfApiCargando = false;
    }
}

async function iniciarCatalogoExtendido() {
    // Pestañas del catálogo
    const tabTodos = $("tabTodosJuegos");
    const tabApi = $("tabApiJuegos");
    const tabComunidad = $("tabComunidadJuegos");
    const secGeneral = $("seccionCatalogoGeneral");
    const secApi = $("seccionApiJuegos");

    if (tabTodos && tabApi && secGeneral && secApi) {
        tabTodos.addEventListener("click", () => {
            tabTodos.classList.add("activa");
            tabApi.classList.remove("activa");
            if (tabComunidad) tabComunidad.classList.remove("activa");
            secGeneral.hidden = false;
            secApi.hidden = true;
        });

        tabApi.addEventListener("click", () => {
            tabApi.classList.add("activa");
            tabTodos.classList.remove("activa");
            if (tabComunidad) tabComunidad.classList.remove("activa");
            secGeneral.hidden = true;
            secApi.hidden = false;
            if (!pfJuegosApi.length) {
                pfCargarJuegosApi($("filtroCategoriaApi")?.value || "");
            }
        });

        if (tabComunidad) {
            tabComunidad.addEventListener("click", () => {
                tabTodos.click();
                $("catalogoDinamico")?.scrollIntoView({ behavior: "smooth", block: "start" });
            });
        }
    }

    if ($("filtroCategoriaApi")) {
        $("filtroCategoriaApi").addEventListener("change", (e) => {
            pfCargarJuegosApi(e.target.value);
        });
    }

    // Las tres tarjetas originales se conservan; si sus imágenes locales no existen, se muestra una portada ilustrativa.
    document.querySelectorAll("#contenedorJuegos .juego").forEach(card => {
        const img = card.querySelector("img");
        if (img) img.addEventListener("error", () => { if (!img.dataset.fallback) { img.dataset.fallback = "1"; img.src = pfImagenMarcador(card.querySelector("h3")?.textContent || "PixelForge"); } }, { once: true });
        const h3 = card.querySelector("h3");
        if (h3 && !card.querySelector(".nota-edad-original")) {
            const p = document.createElement("p"); p.className = "nota-edad-original";
            p.textContent = h3.textContent.includes("GTA") ? "Edad sugerida: 18+" : h3.textContent.includes("Fortnite") ? "Edad sugerida: 12+" : "Edad sugerida: 7+";
            card.querySelector(".informacion")?.appendChild(p);
        }
        const titulo = card.querySelector("h3")?.textContent?.toLowerCase() || "";
        const datos = titulo.includes("minecraft") ? {slug:"minecraft", streamers:"Auronplay / Vegetta777", url:"https://www.twitch.tv/search?term=Minecraft", edad:"7+"}
            : titulo.includes("fortnite") ? {slug:"fortnite", streamers:"Ninja / SypherPK", url:"https://www.twitch.tv/search?term=Fortnite", edad:"12+"}
            : {slug:"gta-v", streamers:"TheProfessional / Caylus", url:"https://www.twitch.tv/search?term=GTA%20V", edad:"18+"};
        const info = card.querySelector(".informacion");
        if (info && !info.querySelector(".streamers-juego")) {
            const s = document.createElement("p"); s.className = "streamers-juego"; s.textContent = "Streamers / creadores: " + datos.streamers; info.appendChild(s);
            const l = pfCrearEnlace(datos.url, "Ver streamers", "enlace-juego enlace-secundario"); info.appendChild(l);
        }
    });
    await pfCargarCatalogoBD();
    await pfCargarCalificacionesResumen();
    await pfCargarCalificacionesUsuario();
    await pfCargarFavoritosUsuario();
    pfRenderCatalogos();
    pfCatalogoInicializado = true;
    $("formPropuestaJuego")?.addEventListener("submit", pfEnviarPropuesta);
    window.addEventListener("pixelforge:auth", async () => {
        await pfCargarFavoritosUsuario(); await pfCargarCalificacionesUsuario(); await pfVerificarAdmin();
        pfRenderCatalogos();
    });
    await pfVerificarAdmin();
    // Recarga el catálogo una vez para ver juegos recién aprobados mientras el visitante mantiene la página abierta.
    window.addEventListener("focus", async () => { await pfCargarCatalogoBD(); pfRenderCatalogos(); });
}
const botonSync = document.getElementById("btnSincronizar");
const estadoSync = document.getElementById("estadoSincronizacion");
const textoBoton = document.getElementById("textoBoton");
const iconoSync = document.querySelector(".sync-icon");

if (botonSync && estadoSync && textoBoton && iconoSync) botonSync.addEventListener("click", async () => {
    botonSync.disabled = true;
    textoBoton.textContent = "Sincronizando...";
    estadoSync.className = "estado-sync loading";
    estadoSync.textContent = "🔄 Conectando con Supabase...";
    iconoSync.classList.add("girando");

    try {
        if (!supabase && window.supabase) {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        }
        if (!supabase) throw new Error("Cliente de Supabase no disponible.");

        const { data, error } = await supabase
            .from("videojuegos")
            .select("*")
            .limit(100);

        if (error) throw error;

        estadoSync.className = "estado-sync online";
        estadoSync.textContent = `✅ Conectado a Supabase · ${data.length} videojuego(s) en la base de datos`;
        if (usuario) await cargarJuegos();
        await pfCargarCatalogoBD();
        pfFiltrosActualizados();

        textoBoton.textContent = "Sincronizado";
        iconoSync.classList.remove("girando");
        iconoSync.textContent = "✔";
        iconoSync.style.color = "#22c55e";

    } catch (error) {
        console.error("Error al sincronizar con Supabase:", error);
        estadoSync.className = "estado-sync error";
        estadoSync.textContent = "❌ " + (error?.message || "Error al conectar con Supabase");
        textoBoton.textContent = "Reintentar";
        iconoSync.classList.remove("girando");
        iconoSync.textContent = "⚠";
        iconoSync.style.color = "#ef4444";
    } finally {
        botonSync.disabled = false;
    }
});

// Puente interno: expone el cliente público de Supabase y el estado de admin,
// nunca la clave service_role. La autorización real la hacen las políticas RLS.
window.PIXELFORGE_ADMIN_BRIDGE = {
    getClient: () => supabase,
    getUser: () => usuario,
    setUser: (nextUser) => { usuario = nextUser; },
    isAdmin: () => Boolean(pfEsAdmin),
    refreshAdmin: () => pfVerificarAdmin()
};
})();

