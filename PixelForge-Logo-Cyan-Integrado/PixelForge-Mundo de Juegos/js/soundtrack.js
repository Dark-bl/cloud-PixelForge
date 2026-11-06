(() => {
    "use strict";
    const PISTAS_LOCALES_DEFAULT = [
        // --- SELECCIÓN K-POP EN VIDEOJUEGOS ---
        {
            titulo: "POP/STARS (feat. (G)I-DLE & Madison Beer)",
            artista: "K/DA",
            juego: "League of Legends (Grupo Virtual)",
            url: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/be/6d/da/be6dda93-0fc9-9545-38a7-04bfd3a4c67d/mzaf_12674869634233540340.plus.aac.p.m4a",
            caratula: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/93/f8/8a/93f88a32-342c-b650-ef1c-ebc1c9f804c3/00198704643309_Cover.jpg/600x600bb.jpg",
            duracion: "3:11",
            esApi: false
        },
        {
            titulo: "Perfect Night",
            artista: "LE SSERAFIM",
            juego: "Overwatch 2 (Colaboración Oficial)",
            url: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/bc/f7/7f/bcf77f57-ea7e-e483-aa46-6cb919eee7e5/mzaf_16548890274351085831.plus.aac.p.m4a",
            caratula: "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/a0/cd/40/a0cd4013-89cf-0554-0aa5-1ac5a0bb3db1/196922680779_Cover.jpg/600x600bb.jpg",
            duracion: "2:39",
            esApi: false
        },
        {
            titulo: "GODS (Himno Oficial Worlds)",
            artista: "League of Legends & NewJeans",
            juego: "League of Legends Worlds 2023",
            url: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/98/f8/6c/98f86c06-431b-1112-52a2-f2222bece13e/mzaf_5836013213479843390.plus.aac.p.m4a",
            caratula: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/30/59/e0/3059e000-eb6f-6c08-4387-c1ee9d38d962/00198704670657_Cover.jpg/600x600bb.jpg",
            duracion: "3:41",
            esApi: false
        },
        {
            titulo: "Ready For Love (The Virtual)",
            artista: "BLACKPINK",
            juego: "PUBG Mobile (Concierto Virtual)",
            url: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/74/11/8f/74118f5b-5a11-e863-66bf-dd200408b589/mzaf_8781433739403529773.plus.aac.p.m4a",
            caratula: "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/52/8e/5a/528e5a30-52b0-b68c-f184-635fcf15e6d7/22UM1IM01017.rgb.jpg/600x600bb.jpg",
            duracion: "3:05",
            esApi: false
        },
        {
            titulo: "MORE",
            artista: "K/DA (feat. Lexie Liu & Seraphine)",
            juego: "League of Legends",
            url: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/cb/d1/27/cbd127bc-1665-1095-9aa9-13322bd1da20/mzaf_12465534455231308006.plus.aac.p.m4a",
            caratula: "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/67/11/24/671124b5-7b83-672c-46fc-92245524db3d/00198704643033_Cover.jpg/600x600bb.jpg",
            duracion: "3:37",
            esApi: false
        },
        // --- SELECCIÓN eFOOTBALL (KONAMI) ---
        {
            titulo: "Fiesta",
            artista: "CxM",
            juego: "eFootball (Konami)",
            evento: "Banda Sonora Oficial eFootball",
            url: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/90/0d/21/900d21e6-c457-70b9-83cb-a177d0a45084/mzaf_1621968359718200629.plus.aac.p.m4a",
            caratula: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/84/03/57/84035799-08ce-ebf7-af38-b132e8b85544/198704686016_Cover.jpg/600x600bb.jpg",
            duracion: "2:45",
            esApi: false
        },
        {
            titulo: "404 (New Era)",
            artista: "KiiiKiii",
            juego: "eFootball (Konami)",
            evento: "Banda Sonora Oficial eFootball",
            url: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/ef/d8/84/efd884da-ffb3-dff0-1c53-05ee61d7baa1/mzaf_9160660066743675925.plus.aac.p.m4a",
            caratula: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/1c/b4/81/1cb481b3-9b5b-83bf-e047-41e3089b0653/199806885123.jpg/600x600bb.jpg",
            duracion: "3:00",
            esApi: false
        },
        {
            titulo: "Dracula (JENNIE Remix)",
            artista: "Tame Impala & JENNIE",
            juego: "eFootball (Konami)",
            evento: "Banda Sonora Oficial eFootball",
            url: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/71/5d/31/715d3169-5fba-a0b7-da24-2aefc83796cf/mzaf_8089500935177582820.plus.aac.p.m4a",
            caratula: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/36/be/b4/36beb41f-c644-55cb-9fbb-bf0622a66653/196873644783.jpg/600x600bb.jpg",
            duracion: "3:25",
            esApi: false
        },
        // --- BANDAS SONORAS RETRO Y CHIPTUNE ---
        {
            titulo: "Battle Boss (Tema de Jefe Final)",
            artista: "BoxCat Games",
            juego: "Nameless RPG / Boss Battle",
            url: "/audio/battle-boss.mp3",
            caratula: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400&auto=format&fit=crop&q=80",
            duracion: "0:53",
            esApi: false
        },
        {
            titulo: "Mt. Fox Shop (Tienda del Pueblo)",
            artista: "BoxCat Games",
            juego: "Nameless RPG Soundtrack",
            url: "/audio/mt-fox-shop.mp3",
            caratula: "https://images.unsplash.com/photo-1500651230702-0e2d8a49d4ad?w=400&auto=format&fit=crop&q=80",
            duracion: "3:14",
            esApi: false
        },
        {
            titulo: "Battle Special (Combate Épico)",
            artista: "BoxCat Games",
            juego: "Action RPG Chronicles",
            url: "/audio/battle-special.mp3",
            caratula: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&auto=format&fit=crop&q=80",
            duracion: "0:54",
            esApi: false
        },
        {
            titulo: "Breaking In (Infiltración Hacker)",
            artista: "BoxCat Games",
            juego: "Cyberpunk Heist",
            url: "/audio/breaking-in.mp3",
            caratula: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&auto=format&fit=crop&q=80",
            duracion: "0:32",
            esApi: false
        },
        {
            titulo: "B-3 (Exploración Chiptune)",
            artista: "BoxCat Games",
            juego: "Dungeon Crawler 8-Bit",
            url: "/audio/dungeon-b3.mp3",
            caratula: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&auto=format&fit=crop&q=80",
            duracion: "3:06",
            esApi: false
        },
        {
            titulo: "Inspiration (Mundo Abierto)",
            artista: "BoxCat Games",
            juego: "Pixel Adventures OST",
            url: "/audio/inspiration.mp3",
            caratula: "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=400&auto=format&fit=crop&q=80",
            duracion: "4:28",
            esApi: false
        }
    ];

    // Lista activa de canciones (puede provenir de la colección local o de la API de música)
    let pistasActivas = [...PISTAS_LOCALES_DEFAULT];
    let indiceActual = 0;
    let reproduciendo = false;

    // Referencias DOM
    const audio = document.getElementById("audioGamer") || document.getElementById("audioRainwave");
    const btnPlay = document.getElementById("btnAudioPlay");
    const btnPrev = document.getElementById("btnAudioPrev");
    const btnNext = document.getElementById("btnAudioNext");
    const titulo = document.getElementById("tituloTemaGamer") || document.getElementById("tituloTemaRainwave");
    const artista = document.getElementById("artistaTemaGamer") || document.getElementById("artistaTemaRainwave");
    const album = document.getElementById("albumTemaGamer") || document.getElementById("albumTemaRainwave");
    const estado = document.getElementById("estadoGamer") || document.getElementById("estadoRainwave");
    const caratulaImg = document.getElementById("caratulaAudioImg");
    const caratulaContenedor = document.getElementById("caratulaAudioContenedor");
    const barraProgreso = document.getElementById("barraProgresoAudio");
    const tiempoActualEl = document.getElementById("tiempoActualAudio");
    const tiempoTotalEl = document.getElementById("tiempoTotalAudio");
    const volumenSlider = document.getElementById("volumenAudio");
    const listaPistasContenedor = document.getElementById("listaPistasAudio");
    const badgeOrigenMusica = document.getElementById("badgeOrigenMusica");
    const tituloListaPistas = document.getElementById("tituloListaPistas");

    // Elementos de la API de música
    const inputBusquedaMusica = document.getElementById("inputBusquedaMusicaApi");
    const btnBuscarMusica = document.getElementById("btnBuscarMusicaApi");
    const btnApiKpop = document.getElementById("btnApiKpopGaming");
    const btnColeccionLocal = document.getElementById("btnColeccionLocalMusica");
    const contenedorChips = document.getElementById("chipsMusica");

    if (!audio) return;

    function formatearTiempo(segundos) {
        if (!segundos || isNaN(segundos)) return "0:00";
        const mins = Math.floor(segundos / 60);
        const segs = Math.floor(segundos % 60);
        return `${mins}:${segs < 10 ? "0" : ""}${segs}`;
    }

    function renderizarListaPistas() {
        if (!listaPistasContenedor) return;
        listaPistasContenedor.replaceChildren();

        if (pistasActivas.length === 0) {
            const vacio = document.createElement("p");
            vacio.style.color = "#8ba0c0";
            vacio.style.fontSize = "0.9rem";
            vacio.style.padding = "10px";
            vacio.textContent = "No se encontraron canciones para esta búsqueda. Prueba con otro término o vuelve a pistas clásicas.";
            listaPistasContenedor.appendChild(vacio);
            return;
        }

        pistasActivas.forEach((p, idx) => {
            const item = document.createElement("div");
            item.className = `pista-item ${idx === indiceActual ? "activa" : ""}`;
            item.setAttribute("role", "button");
            item.setAttribute("tabindex", "0");
            item.innerHTML = `
                <div class="pista-item-info">
                    <span class="pista-item-titulo">${idx + 1}. ${p.titulo}</span>
                    <span class="pista-item-subtitulo">${p.artista} · ${p.juego}</span>
                </div>
                <div class="pista-item-meta">
                    ${p.evento ? '<span style="font-size: 0.68rem; padding: 2px 6px; border-radius: 4px; background: rgba(255, 45, 117, 0.18); color: #ff2d75; border: 1px solid rgba(255, 45, 117, 0.4); font-weight: bold;">K-POP</span>' : (p.esApi ? '<span style="font-size: 0.68rem; padding: 2px 6px; border-radius: 4px; background: rgba(0, 229, 255, 0.15); color: #00e5ff; border: 1px solid rgba(0, 229, 255, 0.3);">API</span>' : '')}
                    <span style="font-size: 0.8rem; color: #00e5ff; font-variant-numeric: tabular-nums;">${p.duracion || "0:30"}</span>
                </div>
            `;
            item.addEventListener("click", () => cargarPista(idx, true));
            item.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    cargarPista(idx, true);
                }
            });
            listaPistasContenedor.appendChild(item);
        });
    }

    function cargarPista(indice, autoPlay = false) {
        if (!pistasActivas || pistasActivas.length === 0) return;
        if (indice < 0) indice = pistasActivas.length - 1;
        if (indice >= pistasActivas.length) indice = 0;
        indiceActual = indice;
        const pista = pistasActivas[indiceActual];

        audio.src = pista.url;
        audio.load();

        if (titulo) titulo.textContent = pista.titulo;
        if (artista) artista.textContent = `Artista: ${pista.artista}`;
        if (album) album.textContent = pista.evento ? `Banda Sonora: ${pista.juego} (${pista.evento})` : `Banda Sonora: ${pista.juego}`;
        if (estado) estado.textContent = `Pista ${indiceActual + 1} de ${pistasActivas.length} · Lista para reproducir`;
        if (caratulaImg) caratulaImg.src = pista.caratula || "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400&auto=format&fit=crop&q=80";

        if (barraProgreso) {
            barraProgreso.value = 0;
            barraProgreso.max = 100;
        }
        if (tiempoActualEl) tiempoActualEl.textContent = "0:00";
        if (tiempoTotalEl) tiempoTotalEl.textContent = pista.duracion || "0:30";

        // Actualizar clase activa en la lista visual
        document.querySelectorAll(".pista-item").forEach((el, idx) => {
            el.classList.toggle("activa", idx === indiceActual);
        });

        if (autoPlay) {
            iniciarReproduccion();
        } else {
            actualizarBotonPlay(false);
        }
    }

    function actualizarBotonPlay(estaReproduciendo) {
        reproduciendo = estaReproduciendo;
        if (btnPlay) {
            btnPlay.textContent = estaReproduciendo ? "⏸" : "▶";
            btnPlay.setAttribute("aria-label", estaReproduciendo ? "Pausar música" : "Reproducir música");
        }
        if (caratulaContenedor) {
            caratulaContenedor.classList.toggle("reproduciendo", estaReproduciendo);
        }
        const onda = document.getElementById("ondaEcualizador");
        if (onda) {
            onda.classList.toggle("reproduciendo", estaReproduciendo);
        }
        if (estado && pistasActivas[indiceActual]) {
            const p = pistasActivas[indiceActual];
            estado.textContent = estaReproduciendo ? `▶ Reproduciendo: ${p.titulo}` : `⏸ Pausado: ${p.titulo}`;
        }
    }

    function iniciarReproduccion() {
        const promesa = audio.play();
        if (promesa !== undefined) {
            promesa.then(() => {
                actualizarBotonPlay(true);
            }).catch((err) => {
                console.warn("Autoplay bloqueado por el navegador o interacción requerida:", err);
                actualizarBotonPlay(false);
                if (estado) estado.textContent = "Pulsa reproducir ▶ para iniciar el audio";
            });
        }
    }

    function alternarReproduccion() {
        if (audio.paused) {
            iniciarReproduccion();
        } else {
            audio.pause();
            actualizarBotonPlay(false);
        }
    }

    // Configuración de eventos de audio HTML5
    audio.addEventListener("timeupdate", () => {
        if (!barraProgreso || isNaN(audio.duration) || audio.duration === 0) return;
        const porcentaje = (audio.currentTime / audio.duration) * 100;
        barraProgreso.value = porcentaje || 0;
        if (tiempoActualEl) tiempoActualEl.textContent = formatearTiempo(audio.currentTime);
        if (tiempoTotalEl && audio.duration) tiempoTotalEl.textContent = formatearTiempo(audio.duration);
    });

    audio.addEventListener("ended", () => {
        cargarPista(indiceActual + 1, true);
    });

    audio.addEventListener("error", (e) => {
        console.warn("PixelForge Audio: No se pudo reproducir este stream, pasando a la siguiente pista.", e);
        if (estado) estado.textContent = "Stream no disponible, saltando a la siguiente...";
        setTimeout(() => {
            if (pistasActivas.length > 1) {
                cargarPista(indiceActual + 1, true);
            }
        }, 1200);
    });

    if (barraProgreso) {
        barraProgreso.addEventListener("input", () => {
            if (!isNaN(audio.duration)) {
                audio.currentTime = (barraProgreso.value / 100) * audio.duration;
            }
        });
    }

    if (volumenSlider) {
        volumenSlider.addEventListener("input", () => {
            audio.volume = Number(volumenSlider.value) / 100;
        });
        audio.volume = Number(volumenSlider.value || 80) / 100;
    }

    if (btnPlay) btnPlay.addEventListener("click", alternarReproduccion);
    if (btnPrev) btnPrev.addEventListener("click", () => cargarPista(indiceActual - 1, true));
    if (btnNext) btnNext.addEventListener("click", () => cargarPista(indiceActual + 1, true));

    // ==========================================
    // CONEXIÓN CON LA API DE MÚSICA (iTunes Search API)
    // ==========================================
    async function consultarApiMusica(termino) {
        const terminoLimpio = (termino || "").trim();
        if (!terminoLimpio) return;

        if (estado) estado.textContent = `Consultando API de música para "${terminoLimpio}"...`;
        if (btnBuscarMusica) {
            btnBuscarMusica.disabled = true;
            btnBuscarMusica.textContent = "Buscando...";
        }

        try {
            // La API de iTunes es pública, gratuita, sin API keys, con CORS abierto y entrega previews oficiales en audio AAC/MP3
            const urlApi = `https://itunes.apple.com/search?term=${encodeURIComponent(terminoLimpio)}&entity=song&limit=25`;
            const respuesta = await fetch(urlApi);

            if (!respuesta.ok) {
                throw new Error(`Error HTTP: ${respuesta.status}`);
            }

            const data = await respuesta.json();
            const cancionesValidas = (data.results || [])
                .filter(item => item.previewUrl)
                .map(item => {
                    const duracionSegundos = item.trackTimeMillis ? Math.round(item.trackTimeMillis / 1000) : 30;
                    return {
                        titulo: item.trackName || "Pista de banda sonora",
                        artista: item.artistName || "Varios artistas",
                        juego: item.collectionName || terminoLimpio,
                        url: item.previewUrl,
                        caratula: item.artworkUrl100 ? item.artworkUrl100.replace("100x100bb", "450x450bb") : "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400&auto=format&fit=crop&q=80",
                        duracion: formatearTiempo(duracionSegundos),
                        esApi: true
                    };
                });

            if (cancionesValidas.length === 0) {
                if (estado) estado.textContent = `No se hallaron previews para "${terminoLimpio}". Intenta con otra saga.`;
                return;
            }

            pistasActivas = cancionesValidas;
            if (badgeOrigenMusica) {
                badgeOrigenMusica.textContent = `API EN VIVO (${cancionesValidas.length} TEMAS)`;
                badgeOrigenMusica.style.borderColor = "#00e5ff";
                badgeOrigenMusica.style.color = "#00e5ff";
            }
            if (tituloListaPistas) {
                tituloListaPistas.textContent = `Resultados en vivo: "${terminoLimpio}" (${cancionesValidas.length} pistas)`;
            }

            renderizarListaPistas();
            cargarPista(0, true);

        } catch (error) {
            console.error("Error al consultar API de música:", error);
            if (estado) estado.textContent = `No se pudo conectar con la API de música. Cargando colección local...`;
            restaurarColeccionLocal();
        } finally {
            if (btnBuscarMusica) {
                btnBuscarMusica.disabled = false;
                btnBuscarMusica.textContent = "Buscar en la API";
            }
        }
    }

    function restaurarColeccionLocal() {
        pistasActivas = [...PISTAS_LOCALES_DEFAULT];
        if (badgeOrigenMusica) {
            badgeOrigenMusica.textContent = "COLECCIÓN LOCAL";
            badgeOrigenMusica.style.borderColor = "#8ba0c0";
            badgeOrigenMusica.style.color = "#8ba0c0";
        }
        if (tituloListaPistas) {
            tituloListaPistas.textContent = "Pistas destacadas (K-Pop y bandas sonoras):";
        }
        renderizarListaPistas();
        cargarPista(0, false);
    }

    // Eventos de la barra de búsqueda de música
    if (btnBuscarMusica && inputBusquedaMusica) {
        btnBuscarMusica.addEventListener("click", () => {
            consultarApiMusica(inputBusquedaMusica.value);
        });

        inputBusquedaMusica.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                consultarApiMusica(inputBusquedaMusica.value);
            }
        });
    }

    // ==========================================
    // CONEXIÓN CON LA API OFICIAL DE K-POP GAMER (/api/kpop-gaming)
    // ==========================================
    async function consultarApiKpop(filtro = "") {
        const filtroLimpio = (filtro || "").trim();
        if (estado) estado.textContent = "Conectando con la API oficial de K-Pop Gamer...";
        if (btnApiKpop) {
            btnApiKpop.disabled = true;
            btnApiKpop.textContent = "Cargando API...";
        }

        try {
            const urlApi = filtroLimpio
                ? `/api/kpop-gaming?search=${encodeURIComponent(filtroLimpio)}`
                : "/api/kpop-gaming";

            const respuesta = await fetch(urlApi);
            if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);

            const data = await respuesta.json();
            const cancionesValidas = data.resultados || [];

            if (cancionesValidas.length === 0) {
                if (estado) estado.textContent = `No se encontraron temas en la API de K-Pop para "${filtroLimpio}".`;
                return;
            }

            pistasActivas = cancionesValidas;
            if (badgeOrigenMusica) {
                badgeOrigenMusica.textContent = `API K-POP GAMER (${cancionesValidas.length} TEMAS)`;
                badgeOrigenMusica.style.borderColor = "#ff2d75";
                badgeOrigenMusica.style.color = "#ff2d75";
            }
            if (tituloListaPistas) {
                tituloListaPistas.textContent = `Pistas API K-Pop Gamer (${cancionesValidas.length} colaboraciones):`;
            }

            renderizarListaPistas();
            cargarPista(0, true);
            if (estado) estado.textContent = `API K-Pop Gamer conectada · ${cancionesValidas.length} temas oficiales disponibles`;

        } catch (error) {
            console.error("Error al consultar API de K-Pop Gamer:", error);
            // Respaldo directo en caso de recarga del servidor
            try {
                const resp = await fetch("./data/kpop_gaming.json");
                if (resp.ok) {
                    const datos = await resp.json();
                    pistasActivas = datos;
                    if (badgeOrigenMusica) {
                        badgeOrigenMusica.textContent = `API K-POP GAMER (${datos.length} TEMAS)`;
                        badgeOrigenMusica.style.borderColor = "#ff2d75";
                        badgeOrigenMusica.style.color = "#ff2d75";
                    }
                    if (tituloListaPistas) {
                        tituloListaPistas.textContent = `Pistas API K-Pop Gamer (${datos.length} colaboraciones):`;
                    }
                    renderizarListaPistas();
                    cargarPista(0, true);
                    return;
                }
            } catch (_) {}
            if (estado) estado.textContent = "No se pudo conectar con la API de K-Pop Gamer. Restaurando...";
            restaurarColeccionLocal();
        } finally {
            if (btnApiKpop) {
                btnApiKpop.disabled = false;
                btnApiKpop.textContent = "🇰🇷 API K-Pop Gamer";
            }
        }
    }

    // Botón para activar la API de K-Pop Gamer
    if (btnApiKpop) {
        btnApiKpop.addEventListener("click", () => {
            document.querySelectorAll(".chip-musica-btn").forEach(c => c.classList.remove("activo"));
            consultarApiKpop();
        });
    }

    // Botón para volver a las pistas locales
    if (btnColeccionLocal) {
        btnColeccionLocal.addEventListener("click", () => {
            restaurarColeccionLocal();
            if (inputBusquedaMusica) inputBusquedaMusica.value = "";
            document.querySelectorAll(".chip-musica-btn").forEach(c => c.classList.remove("activo"));
        });
    }

    // Chips de sagas populares (Zelda, Mario, Minecraft, Halo, Cyberpunk, etc.)
    if (contenedorChips) {
        contenedorChips.addEventListener("click", (e) => {
            const botonChip = e.target.closest(".chip-musica-btn");
            if (!botonChip) return;

            document.querySelectorAll(".chip-musica-btn").forEach(c => c.classList.remove("activo"));
            botonChip.classList.add("activo");

            const query = botonChip.dataset.query || botonChip.textContent;
            if (inputBusquedaMusica) inputBusquedaMusica.value = query;
            consultarApiMusica(query);
        });
    }

    // Inicializar reproductor con pistas clásicas al inicio
    renderizarListaPistas();
    cargarPista(0, false);
})();