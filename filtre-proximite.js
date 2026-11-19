(function () {
  "use strict";

  const CONFIG = {
    dataUrl:
      "https://bassogna.github.io/cosmetic-valley-cartographie/cosmetic_valley_adherents_carte.json",
    prefix: "guests_list_916095",
    pageParam: "guests_list_916095_page",
    maxPages: 50,
    concurrence: 4,
    pageSize: 20,
    stockage: "cv_proximite_v9"
  };

  if (window.__cvProximiteControleur) {
    window.__cvProximiteControleur.verifier();
    return;
  }

  let formulaire = null;
  let ui = null;
  let mode = "classique";
  let position = null;
  let resultats = [];
  let pageCourante = 1;
  let rechercheEnCours = false;
  let requeteCourante = 0;
  let blocRegion = null;
  let affichageRegion = "";
  let conteneurNatif = null;
  let affichageNatif = "";
  let cacheAdherents = null;
  let minuterieObservation = null;
  let initialisationEnCours = false;

  const paginationNative = new Map();

  // ============================================================
  // OUTILS
  // ============================================================

  function normaliser(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function slugDepuisUrl(value) {
    try {
      const url = new URL(value, location.origin);
      const parties = url.pathname.split("/").filter(Boolean);

      return decodeURIComponent(
        parties[parties.length - 1] || ""
      ).toLowerCase();
    } catch {
      return "";
    }
  }

  function distanceKm(lat1, lon1, lat2, lon2) {
    const rad = x => x * Math.PI / 180;
    const dLat = rad(lat2 - lat1);
    const dLon = rad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(lat1)) *
      Math.cos(rad(lat2)) *
      Math.sin(dLon / 2) ** 2;

    return 12742 * Math.asin(
      Math.min(1, Math.sqrt(a))
    );
  }

  function lireEtat() {
    try {
      return JSON.parse(
        sessionStorage.getItem(CONFIG.stockage) || "null"
      );
    } catch {
      return null;
    }
  }

  function enregistrerEtat(etat) {
    sessionStorage.setItem(
      CONFIG.stockage,
      JSON.stringify(etat)
    );
  }

  function trouverFormulaire() {
    return [...document.forms].find(f =>
      f.querySelector(
        '[name="' + CONFIG.prefix + '_q"]'
      )
    ) || null;
  }

  function trouverConteneur(doc) {
    const premiere = doc.querySelector(".guest-item");
    if (!premiere) return null;

    let parent = premiere.parentElement;

    while (parent && parent !== doc.body) {
      const directs = [...parent.children].filter(e =>
        e.matches(".guest-item")
      );

      if (directs.length > 1) return parent;
      parent = parent.parentElement;
    }

    return premiere.parentElement;
  }

  // ============================================================
  // PLACEHOLDERS REGION / DEPARTEMENT
  // ============================================================

  function personnaliserPlaceholders() {
    const form = trouverFormulaire();
    if (!form) return;

    const groupe = form.querySelector(
      ".hierarchical-guest-fields-select"
    );

    if (!groupe) return;

    const colonnes = [
      ...groupe.querySelectorAll(":scope > .col-md-4")
    ];

    const textes = [
      "Choisissez une région",
      "Choisissez un département"
    ];

    colonnes.slice(0, 2).forEach((colonne, index) => {
      const placeholder = colonne.querySelector(
        '[class*="placeholder"], [class*="Placeholder"]'
      );

      if (
        placeholder &&
        placeholder.textContent.trim() !== textes[index]
      ) {
        placeholder.textContent = textes[index];
      }
    });
  }

  // ============================================================
  // STYLES
  // ============================================================

  function ajouterStyles() {
    if (document.getElementById("cv-proximite-styles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "cv-proximite-styles";

    style.textContent = `
      #cv-mode-recherche {
        margin: 15px 0 20px;
        padding: 16px 20px;
        background: #f7f7f9;
        border: 1px solid #e5e5e8;
        border-radius: 9px;
        font-family: Arial, sans-serif;
      }

      .cv-mode-title {
        font-size: 15px;
        font-weight: bold;
        margin-bottom: 12px;
      }

      .cv-mode-options {
        display: flex;
        gap: 25px;
        flex-wrap: wrap;
      }

      .cv-mode-options label {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        font-size: 14px;
      }

      .cv-mode-options input {
        accent-color: #70358d;
      }

      #cv-proximite {
        display: none;
        margin: 12px 0 20px;
        font-family: Arial, sans-serif;
      }

      #cv-proximite * {
        box-sizing: border-box;
      }

      .cv-prox-fields {
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: 15px;
        margin-bottom: 15px;
      }

      .cv-prox-field label {
        display: block;
        margin-bottom: 7px;
        font-size: 14px;
        font-weight: 600;
      }

      .cv-prox-field input,
      .cv-prox-field select {
        width: 100%;
        height: 44px;
        padding: 9px 12px;
        border: 1px solid #ccc;
        border-radius: 6px;
        background: white;
        color: #292929;
        font-size: 15px;
      }

      .cv-prox-buttons {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin: 12px 0;
      }

      .cv-prox-btn {
        padding: 11px 17px;
        border: 0;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
      }

      .cv-prox-location {
        background: #70358d;
        color: white;
      }

      .cv-prox-reset {
        background: #e8e8eb;
        color: #333;
      }

      .cv-prox-btn:disabled {
        opacity: .55;
        cursor: wait;
      }

      #cv-prox-progress {
        display: none;
        margin-top: 18px;
      }

      .cv-prox-progress-track {
        width: 100%;
        height: 10px;
        background: #e7e7ec;
        border-radius: 8px;
        overflow: hidden;
      }

      #cv-prox-progress-bar {
        width: 0%;
        height: 100%;
        background: #70358d;
        transition: width .25s ease;
      }

      #cv-prox-progress-text {
        margin-top: 7px;
        font-size: 13px;
        color: #666;
      }

      #cv-prox-status {
        margin-top: 12px;
        font-size: 14px;
        line-height: 1.5;
      }

      #cv-prox-results {
        width: 100%;
        margin: 0;
        padding: 0;
      }

      #cv-prox-results .cv-prox-grid {
        display: flex !important;
        flex-wrap: wrap;
        align-items: stretch;
        align-content: flex-start;
        row-gap: 20px;
        margin-left: -15px;
        margin-right: -15px;
      }

      #cv-prox-results .cv-prox-grid > .guest-item {
        float: none !important;
        clear: none !important;
        display: flex;
        flex-direction: column;
        margin-top: 0 !important;
        margin-bottom: 0 !important;
        min-width: 0;
      }

      #cv-prox-results .cv-prox-grid > .guest-item > a {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
      }

      #cv-prox-results .guest-item img {
        max-width: 100%;
        object-fit: contain;
      }

      #cv-prox-results .cv-prox-distance {
        margin-top: auto;
        padding-top: 8px;
        text-align: center;
        color: #70358d;
        font-size: 12px;
        font-weight: bold;
      }

      #cv-prox-pagination {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        margin: 30px 0;
        padding: 0;
        list-style: none;
      }

      #cv-prox-pagination li {
        list-style: none;
        margin: 0;
        padding: 0;
      }

      #cv-prox-pagination .cv-prox-page {
        display: inline-flex;
        justify-content: center;
        align-items: center;
        min-width: 28px;
        height: 28px;
        padding: 5px 9px;
        border: 0;
        border-radius: 50%;
        background: #f4f4f4;
        color: #c52f63;
        font-size: 13px;
        cursor: pointer;
      }

      #cv-prox-pagination .cv-prox-page.active {
        background: #c52f63;
        color: white;
      }

      #cv-prox-pagination .cv-prox-page:hover:not(:disabled) {
        background: #70358d;
        color: white;
      }

      body.cv-proximite-active
      ul:has(a[href*="guests_list_916095_page="]):not(#cv-prox-pagination),
      body.cv-proximite-active
      nav:has(a[href*="guests_list_916095_page="]):not(#cv-prox-pagination),
      body.cv-proximite-active
      .pagination:has(a[href*="guests_list_916095_page="]) {
        display: none !important;
      }

      @media(max-width:650px) {
        .cv-prox-fields {
          grid-template-columns: 1fr;
        }

        .cv-prox-buttons {
          flex-direction: column;
        }

        .cv-prox-btn {
          width: 100%;
        }

        .cv-mode-options {
          flex-direction: column;
          gap: 12px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  // ============================================================
  // INTERFACE
  // ============================================================

  function creerInterface() {
    formulaire = trouverFormulaire();

    if (!formulaire) {
      throw new Error("Formulaire Eventmaker introuvable.");
    }

    const regionInput = formulaire.querySelector(
      '[name="' +
      CONFIG.prefix +
      '_search_options[company_dpt_region_level_1]"]'
    );

    blocRegion = regionInput?.closest(
      ".hierarchical-guest-fields-select"
    ) || formulaire.querySelector(
      ".hierarchical-guest-fields-select"
    );

    affichageRegion = blocRegion?.style.display || "";

    let selecteurMode = document.getElementById(
      "cv-mode-recherche"
    );

    if (!selecteurMode) {
      selecteurMode = document.createElement("div");
      selecteurMode.id = "cv-mode-recherche";

      selecteurMode.innerHTML = `
        <div class="cv-mode-title">
          Mode de recherche
        </div>

        <div class="cv-mode-options">
          <label>
            <input type="radio"
                   name="cv-mode"
                   value="classique"
                   checked>
            Par région / département
          </label>

          <label>
            <input type="radio"
                   name="cv-mode"
                   value="proximite">
            📍 À proximité
          </label>
        </div>
      `;
    }

    let bloc = document.getElementById("cv-proximite");

    if (!bloc) {
      bloc = document.createElement("div");
      bloc.id = "cv-proximite";

      bloc.innerHTML = `
        <div class="cv-prox-fields">
          <div class="cv-prox-field">
            <label for="cv-prox-ville">
              Ville ou code postal
            </label>
            <input
              id="cv-prox-ville"
              type="text"
              placeholder="Ex. Chartres ou 28000"
              autocomplete="off">
          </div>

          <div class="cv-prox-field">
            <label for="cv-prox-rayon">
              Rayon de recherche
            </label>
            <select id="cv-prox-rayon">
              <option value="10">10 km</option>
              <option value="25">25 km</option>
              <option value="50" selected>50 km</option>
              <option value="100">100 km</option>
              <option value="200">200 km</option>
            </select>
          </div>
        </div>

        <div class="cv-prox-buttons">
          <button type="button"
                  id="cv-prox-geoloc"
                  class="cv-prox-btn cv-prox-location">
            📍 Autour de moi
          </button>

          <button type="button"
                  id="cv-prox-reset"
                  class="cv-prox-btn cv-prox-reset">
            Réinitialiser
          </button>
        </div>

        <div id="cv-prox-progress">
          <div class="cv-prox-progress-track">
            <div id="cv-prox-progress-bar"></div>
          </div>
          <div id="cv-prox-progress-text"></div>
        </div>

        <div id="cv-prox-status"
             role="status"
             aria-live="polite"></div>
      `;
    }

    if (selecteurMode.nextElementSibling !== formulaire) {
      formulaire.insertAdjacentElement(
        "beforebegin",
        selecteurMode
      );
    }

    if (blocRegion) {
      blocRegion.insertAdjacentElement("afterend", bloc);
    } else {
      formulaire.appendChild(bloc);
    }

    return {
      mode: selecteurMode,
      bloc,
      ville: bloc.querySelector("#cv-prox-ville"),
      rayon: bloc.querySelector("#cv-prox-rayon"),
      geoloc: bloc.querySelector("#cv-prox-geoloc"),
      reset: bloc.querySelector("#cv-prox-reset"),
      status: bloc.querySelector("#cv-prox-status"),
      progress: bloc.querySelector("#cv-prox-progress"),
      progressBar: bloc.querySelector("#cv-prox-progress-bar"),
      progressText: bloc.querySelector("#cv-prox-progress-text")
    };
  }

  function statut(message, erreur = false) {
    if (!ui?.status) return;

    ui.status.textContent = message;
    ui.status.style.color =
      erreur ? "#b42318" : "#555";
  }

  function progression(pourcentage, message) {
    if (!ui?.progress) return;

    ui.progress.style.display = "block";

    const valeur = Math.max(
      0,
      Math.min(100, pourcentage)
    );

    ui.progressBar.style.width = valeur + "%";
    ui.progressText.textContent =
      message + " (" + Math.round(valeur) + " %)";
  }

  function masquerProgression() {
    if (!ui?.progress) return;

    ui.progress.style.display = "none";
    ui.progressBar.style.width = "0%";
  }

  function verrouiller(etat) {
    rechercheEnCours = etat;

    if (!ui) return;

    ui.geoloc.disabled = etat;
    ui.reset.disabled = etat;

    formulaire?.querySelectorAll(
      'button[type="submit"], input[type="submit"]'
    ).forEach(b => {
      b.disabled = etat;
    });
  }

  // ============================================================
  // PAGINATION NATIVE
  // ============================================================

  function gererPaginationNative(masquer) {
    if (!masquer) {
      paginationNative.forEach((ancien, element) => {
        if (!element.isConnected) return;

        if (ancien.display) {
          element.style.setProperty(
            "display",
            ancien.display,
            ancien.priority
          );
        } else {
          element.style.removeProperty("display");
        }
      });

      paginationNative.clear();
      return;
    }

    const liens = [
      ...document.querySelectorAll("a[href]")
    ].filter(a => {
      if (a.closest("#cv-prox-results")) return false;

      try {
        return new URL(
          a.href,
          location.origin
        ).searchParams.has(CONFIG.pageParam);
      } catch {
        return false;
      }
    });

    const conteneurs = new Set();

    liens.forEach(lien => {
      const bloc = lien.closest(
        "ul, nav, .pagination, .pagination-wrapper"
      );

      if (bloc) conteneurs.add(bloc);
    });

    conteneurs.forEach(element => {
      if (!paginationNative.has(element)) {
        paginationNative.set(element, {
          display: element.style.getPropertyValue("display"),
          priority: element.style.getPropertyPriority("display")
        });
      }

      element.style.setProperty(
        "display",
        "none",
        "important"
      );
    });
  }

  // ============================================================
  // MODES
  // ============================================================

  function changerModeRecherche(nouveauMode) {
    mode = nouveauMode;

    const proximite = mode === "proximite";

    document.body.classList.toggle(
      "cv-proximite-active",
      proximite
    );

    if (blocRegion) {
      if (proximite) {
        blocRegion.style.setProperty(
          "display",
          "none",
          "important"
        );
      } else {
        blocRegion.style.removeProperty("display");

        if (affichageRegion) {
          blocRegion.style.display = affichageRegion;
        }
      }
    }

    if (ui?.bloc) {
      ui.bloc.style.display =
        proximite ? "block" : "none";
    }

    gererPaginationNative(proximite);

    if (!proximite) {
      ++requeteCourante;
      restaurerResultatsNatifs();
      masquerProgression();
    }

    enregistrerEtat({
      ...(lireEtat() || {}),
      mode,
      active: proximite && !!position
    });
  }

  // ============================================================
  // GEOLOCALISATION
  // ============================================================

  function obtenirPositionNavigateur() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Géolocalisation indisponible."));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        p => resolve({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude
        }),
        erreur => {
          const messages = {
            1: "Autorisation de localisation refusée.",
            2: "Position géographique indisponible.",
            3: "Délai de localisation dépassé."
          };

          reject(new Error(
            messages[erreur.code] ||
            "Impossible d'obtenir votre position."
          ));
        },
        {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 60000
        }
      );
    });
  }

  // ============================================================
  // GEOCODAGE IGN
  // ============================================================

  async function geocoderVille(valeur) {
    const recherche = valeur.trim();

    if (!recherche) {
      throw new Error(
        "Saisissez une ville ou un code postal."
      );
    }

    const params = new URLSearchParams({
      q: recherche,
      type: "municipality",
      limit: "10"
    });

    const response = await fetch(
      "https://data.geopf.fr/geocodage/search?" +
      params.toString()
    );

    if (!response.ok) {
      throw new Error(
        "Service de géocodage indisponible."
      );
    }

    const data = await response.json();

    if (!data.features?.length) {
      throw new Error("Aucune commune trouvée.");
    }

    const exacte = data.features.find(f => {
      const p = f.properties || {};

      return (
        normaliser(p.city || p.name) ===
          normaliser(recherche) ||
        p.postcode === recherche
      );
    });

    const commune = exacte || data.features[0];
    const p = commune.properties || {};
    const coordinates = commune.geometry?.coordinates;

    if (!coordinates || coordinates.length < 2) {
      throw new Error(
        "Coordonnées géographiques indisponibles."
      );
    }

    return {
      latitude: coordinates[1],
      longitude: coordinates[0],
      nom: p.city || p.name || recherche,
      codePostal: p.postcode || ""
    };
  }

  async function identifierVille(positionGPS) {
    try {
      const params = new URLSearchParams({
        lon: positionGPS.longitude,
        lat: positionGPS.latitude,
        type: "municipality"
      });

      const response = await fetch(
        "https://data.geopf.fr/geocodage/reverse?" +
        params.toString()
      );

      if (!response.ok) return "";

      const data = await response.json();
      const p = data.features?.[0]?.properties;

      if (!p) return "";

      const ville = p.city || p.name || "";
      const cp = p.postcode || "";

      return [
        ville,
        cp ? "(" + cp + ")" : ""
      ].filter(Boolean).join(" ");
    } catch {
      return "";
    }
  }

  // ============================================================
  // DONNEES GITHUB
  // ============================================================

  async function chargerAdherents() {
    if (cacheAdherents) return cacheAdherents;

    const response = await fetch(
      CONFIG.dataUrl + "?v=" + Date.now(),
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error(
        "Impossible de charger les adhérents."
      );
    }

    const json = await response.json();
    const source = Array.isArray(json)
      ? json
      : json.adherents;

    if (!Array.isArray(source)) {
      throw new Error("Format JSON incorrect.");
    }

    cacheAdherents = source.filter(a =>
      a.url &&
      a.latitude !== null &&
      a.latitude !== "" &&
      a.longitude !== null &&
      a.longitude !== "" &&
      Number.isFinite(Number(a.latitude)) &&
      Number.isFinite(Number(a.longitude))
    );

    return cacheAdherents;
  }

  // ============================================================
  // FILTRES EVENTMAKER
  // ============================================================

  function obtenirParametresNatifs() {
    const params = new URLSearchParams();
    const data = new FormData(formulaire);

    for (const [cle, valeur] of data.entries()) {
      if (
        typeof valeur === "string" &&
        cle.startsWith(CONFIG.prefix)
      ) {
        params.append(cle, valeur);
      }
    }

    params.delete(
      CONFIG.prefix +
      "_search_options[company_dpt_region_level_1]"
    );

    params.delete(
      CONFIG.prefix +
      "_search_options[company_dpt_region_level_2]"
    );

    params.delete(CONFIG.pageParam);

    return params;
  }

  // ============================================================
  // PAGES EVENTMAKER
  // ============================================================

  function urlPage(numero, filtres) {
    const url = new URL(
      formulaire.action || location.pathname,
      location.origin
    );

    url.hash = "";
    url.search = filtres.toString();

    url.searchParams.set(
      CONFIG.pageParam,
      String(numero)
    );

    return url.href;
  }

  function nombrePages(doc) {
    let maximum = 1;

    doc.querySelectorAll(
      'a[href*="' + CONFIG.pageParam + '="]'
    ).forEach(a => {
      try {
        const url = new URL(a.href, location.origin);
        const n = Number(
          url.searchParams.get(CONFIG.pageParam)
        );

        if (Number.isInteger(n) && n > maximum) {
          maximum = n;
        }
      } catch {}
    });

    return maximum;
  }

  async function chargerPage(numero, filtres) {
    const response = await fetch(
      urlPage(numero, filtres),
      {
        credentials: "same-origin",
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(
        "Erreur Eventmaker page " +
        numero + " : HTTP " + response.status
      );
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(
      html,
      "text/html"
    );

    return {
      doc,
      cartes: [...doc.querySelectorAll(".guest-item")]
    };
  }

  async function chargerToutesLesCartes(filtres) {
    progression(5, "Préparation de la recherche");

    const premiere = await chargerPage(1, filtres);
    const totalPages = nombrePages(premiere.doc);

    if (totalPages > CONFIG.maxPages) {
      throw new Error(
        "Nombre de pages supérieur à la limite."
      );
    }

    const pages = new Array(totalPages);
    pages[0] = premiere.cartes;

    let prochainePage = 2;
    let terminees = 1;

    progression(
      10 + 75 * terminees / totalPages,
      "Recherche des entreprises"
    );

    async function travailleur() {
      while (prochainePage <= totalPages) {
        const numero = prochainePage++;

        const resultat = await chargerPage(
          numero,
          filtres
        );

        pages[numero - 1] = resultat.cartes;
        terminees++;

        progression(
          10 + 75 * terminees / totalPages,
          "Recherche des entreprises"
        );
      }
    }

    await Promise.all(
      Array.from(
        {
          length: Math.min(
            CONFIG.concurrence,
            Math.max(0, totalPages - 1)
          )
        },
        () => travailleur()
      )
    );

    return pages.flat();
  }

  // ============================================================
  // FILTRAGE GEOGRAPHIQUE
  // ============================================================

  function filtrerParDistance(
    cartes,
    adherents,
    centre,
    rayon
  ) {
    const index = new Map();

    adherents.forEach(a => {
      const slug = slugDepuisUrl(a.url);
      if (slug) index.set(slug, a);
    });

    const dejaVus = new Set();
    const selection = [];

    cartes.forEach(carte => {
      const lien = carte.querySelector(
        'a[href*="/annuaire-entreprises/"]'
      );

      if (!lien) return;

      const slug = slugDepuisUrl(lien.href);
      const adherent = index.get(slug);

      if (!adherent || dejaVus.has(slug)) return;

      const distance = distanceKm(
        centre.latitude,
        centre.longitude,
        Number(adherent.latitude),
        Number(adherent.longitude)
      );

      if (distance <= rayon) {
        dejaVus.add(slug);

        selection.push({
          carte,
          adherent,
          distance
        });
      }
    });

    selection.sort(
      (a, b) => a.distance - b.distance
    );

    return selection;
  }

  // ============================================================
  // IMAGES EVENTMAKER
  // ============================================================

  function restaurerImages(carte) {
    carte.querySelectorAll("img").forEach(img => {
      const source =
        img.getAttribute("data-original") ||
        img.getAttribute("data-lazy-src") ||
        img.getAttribute("data-src") ||
        img.getAttribute("src");

      const srcset =
        img.getAttribute("data-srcset") ||
        img.getAttribute("srcset");

      if (source) img.setAttribute("src", source);
      if (srcset) img.setAttribute("srcset", srcset);

      img.removeAttribute("data-src");
      img.removeAttribute("data-original");
      img.removeAttribute("data-lazy-src");
      img.removeAttribute("data-srcset");

      img.loading = "eager";
      img.classList.remove("lazyload", "lazyloading");
      img.classList.add("lazyloaded");

      img.style.visibility = "visible";
      img.style.opacity = "1";

      img.onerror = function () {
        this.style.display = "none";
      };

      if (!source && !srcset) {
        img.style.display = "none";
      }
    });
  }

  // ============================================================
  // RESULTATS NATIFS
  // ============================================================

  function masquerResultatsNatifs() {
    if (!conteneurNatif || !conteneurNatif.isConnected) {
      conteneurNatif = trouverConteneur(document);

      if (!conteneurNatif) {
        throw new Error(
          "Conteneur des fiches introuvable."
        );
      }

      affichageNatif = conteneurNatif.style.display;
    }

    conteneurNatif.style.display = "none";
    gererPaginationNative(true);
  }

  function restaurerResultatsNatifs() {
    if (conteneurNatif?.isConnected) {
      conteneurNatif.style.display =
        affichageNatif || "";
    }

    conteneurNatif = null;

    document.getElementById(
      "cv-prox-results"
    )?.remove();

    gererPaginationNative(false);
  }

  // ============================================================
  // AFFICHAGE GPS
  // ============================================================

  function afficherResultats() {
    if (mode !== "proximite") return;

    masquerResultatsNatifs();

    let conteneur = document.getElementById(
      "cv-prox-results"
    );

    if (!conteneur) {
      conteneur = document.createElement("div");
      conteneur.id = "cv-prox-results";

      conteneurNatif.insertAdjacentElement(
        "afterend",
        conteneur
      );
    }

    conteneur.innerHTML = "";

    const debut =
      (pageCourante - 1) * CONFIG.pageSize;

    const page = resultats.slice(
      debut,
      debut + CONFIG.pageSize
    );

    const grille = document.createElement("div");
    grille.className = "row cv-prox-grid";

    page.forEach(item => {
      const carte = item.carte.cloneNode(true);
      restaurerImages(carte);

      const badge = document.createElement("div");
      badge.className = "cv-prox-distance";
      badge.textContent =
        "📍 " + item.distance.toFixed(1) + " km";

      const lien = carte.querySelector(
        'a[href*="/annuaire-entreprises/"]'
      );

      if (lien) lien.appendChild(badge);
      grille.appendChild(carte);
    });

    conteneur.appendChild(grille);

    if (!resultats.length) {
      const vide = document.createElement("p");
      vide.textContent =
        "Aucune entreprise trouvée dans ce rayon.";
      conteneur.appendChild(vide);
    }

    const totalPages = Math.ceil(
      resultats.length / CONFIG.pageSize
    );

    if (totalPages > 1) {
      const navigation = document.createElement("ul");
      navigation.id = "cv-prox-pagination";

      function ajouterBouton(label, numero, actif) {
        const li = document.createElement("li");
        const bouton = document.createElement("button");

        bouton.type = "button";
        bouton.className =
          "cv-prox-page" + (actif ? " active" : "");

        bouton.textContent = label;
        bouton.disabled = actif;

        bouton.addEventListener("click", () => {
          pageCourante = numero;
          afficherResultats();

          ui.bloc.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
        });

        li.appendChild(bouton);
        navigation.appendChild(li);
      }

      if (pageCourante > 1) {
        ajouterBouton(
          "Précédent",
          pageCourante - 1,
          false
        );
      }

      for (let i = 1; i <= totalPages; i++) {
        ajouterBouton(
          String(i),
          i,
          i === pageCourante
        );
      }

      if (pageCourante < totalPages) {
        ajouterBouton(
          "Suivant",
          pageCourante + 1,
          false
        );
      }

      conteneur.appendChild(navigation);
    }

    statut(
      resultats.length +
      " entreprise(s) trouvée(s) dans un rayon de " +
      ui.rayon.value + " km."
    );
  }

  // ============================================================
  // RECHERCHE
  // ============================================================

  async function rechercher(centre, enregistrer = true) {
    if (rechercheEnCours) return;

    verrouiller(true);
    const numeroRequete = ++requeteCourante;

    try {
      progression(
        3,
        "Chargement des données géographiques"
      );

      const adherents = await chargerAdherents();
      const filtres = obtenirParametresNatifs();
      const cartes = await chargerToutesLesCartes(filtres);

      progression(90, "Calcul des distances");

      const selection = filtrerParDistance(
        cartes,
        adherents,
        centre,
        Number(ui.rayon.value)
      );

      if (
        numeroRequete !== requeteCourante ||
        mode !== "proximite"
      ) {
        return;
      }

      resultats = selection;
      pageCourante = 1;
      position = centre;

      if (enregistrer) {
        enregistrerEtat({
          mode: "proximite",
          centre,
          rayon: Number(ui.rayon.value),
          ville: ui.ville.value,
          active: true
        });
      }

      progression(100, "Recherche terminée");
      afficherResultats();

      setTimeout(masquerProgression, 700);

    } catch (erreur) {
      console.error(
        "Filtre proximité Cosmetic Valley :",
        erreur
      );

      masquerProgression();
      statut(erreur.message, true);

    } finally {
      verrouiller(false);
    }
  }

  async function lancerRechercheProximite() {
    if (rechercheEnCours) return;

    try {
      const valeur = ui.ville.value.trim();
      let centre;

      if (
        position &&
        valeur === position.libelle
      ) {
        centre = position;
      } else {
        statut("Recherche de la commune...");
        centre = await geocoderVille(valeur);

        centre.libelle = [
          centre.nom,
          centre.codePostal
            ? "(" + centre.codePostal + ")"
            : ""
        ].filter(Boolean).join(" ");

        ui.ville.value = centre.libelle;
      }

      await rechercher(centre);

    } catch (erreur) {
      statut(erreur.message, true);
    }
  }

  // ============================================================
  // EVENEMENTS
  // ============================================================

  function brancherEvenements() {
    document.addEventListener("change", e => {
      if (
        e.target.matches(
          '#cv-mode-recherche input[name="cv-mode"]'
        )
      ) {
        changerModeRecherche(e.target.value);
      }
    });

    document.addEventListener("click", async e => {
      const geoloc = e.target.closest("#cv-prox-geoloc");

      if (geoloc) {
        e.preventDefault();
        if (rechercheEnCours) return;

        try {
          statut("Localisation en cours...");
          const centre = await obtenirPositionNavigateur();
          const ville = await identifierVille(centre);

          centre.libelle = ville ||
            "Ma position actuelle (" +
            centre.latitude.toFixed(4) + ", " +
            centre.longitude.toFixed(4) + ")";

          ui.ville.value = centre.libelle;
          await rechercher(centre);

        } catch (erreur) {
          statut(erreur.message, true);
        }

        return;
      }

      const reset = e.target.closest("#cv-prox-reset");

      if (reset) {
        e.preventDefault();
        if (rechercheEnCours) return;

        position = null;
        resultats = [];
        pageCourante = 1;

        ui.ville.value = "";
        ui.rayon.value = "50";

        restaurerResultatsNatifs();
        masquerProgression();

        enregistrerEtat({
          mode: "proximite",
          active: false
        });

        statut("Filtre de proximité désactivé.");
      }
    });

    document.addEventListener("keydown", e => {
      if (
        e.target.id === "cv-prox-ville" &&
        e.key === "Enter"
      ) {
        e.preventDefault();
        lancerRechercheProximite();
      }
    });

    document.addEventListener(
      "submit",
      e => {
        if (mode !== "proximite") return;

        const cible = trouverFormulaire();
        if (!cible || e.target !== cible) return;

        e.preventDefault();
        e.stopImmediatePropagation();
        lancerRechercheProximite();
      },
      true
    );
  }

  // ============================================================
  // RECONSTRUCTION EVENTMAKER
  // ============================================================

  function verifierInterface() {
    if (initialisationEnCours) return;

    const nouveauFormulaire = trouverFormulaire();
    if (!nouveauFormulaire) return;

    // Toujours actualiser les placeholders, même si
    // React n'a pas remplacé le formulaire entier.
    personnaliserPlaceholders();

    const selecteur = document.getElementById(
      "cv-mode-recherche"
    );

    const bloc = document.getElementById(
      "cv-proximite"
    );

    const formulaireChange =
      formulaire !== nouveauFormulaire;

    const interfaceAbsente =
      !selecteur || !bloc;

    if (!formulaireChange && !interfaceAbsente) {
      return;
    }

    initialisationEnCours = true;

    try {
      if (formulaireChange) {
        ++requeteCourante;
        conteneurNatif = null;
        paginationNative.clear();

        document.getElementById(
          "cv-prox-results"
        )?.remove();
      }

      formulaire = nouveauFormulaire;
      ui = creerInterface();

      const etat = lireEtat();

      const modeVoulu =
        etat?.mode === "proximite"
          ? "proximite"
          : mode;

      ui.mode.querySelector(
        'input[value="' + modeVoulu + '"]'
      ).checked = true;

      ui.ville.value = etat?.ville || "";
      ui.rayon.value = String(etat?.rayon || 50);

      if (
        etat?.centre &&
        Number.isFinite(Number(etat.centre.latitude)) &&
        Number.isFinite(Number(etat.centre.longitude))
      ) {
        position = etat.centre;
      }

      changerModeRecherche(modeVoulu);
      personnaliserPlaceholders();

      console.log(
        "Interface Cosmetic Valley rétablie."
      );

    } catch (erreur) {
      console.error(
        "Réinsertion filtre proximité :",
        erreur
      );
    } finally {
      initialisationEnCours = false;
    }
  }

  function surveillerEventmaker() {
    const observateur = new MutationObserver(() => {
      clearTimeout(minuterieObservation);

      minuterieObservation = setTimeout(() => {
        minuterieObservation = null;
        verifierInterface();
      }, 250);
    });

    observateur.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  // ============================================================
  // INITIALISATION
  // ============================================================

  function initialiser() {
    try {
      formulaire = trouverFormulaire();

      if (!formulaire) {
        throw new Error(
          "Formulaire Eventmaker introuvable."
        );
      }

      ajouterStyles();
      ui = creerInterface();
      personnaliserPlaceholders();
      brancherEvenements();

      const etat = lireEtat();

      if (etat?.mode === "proximite") {
        ui.mode.querySelector(
          'input[value="proximite"]'
        ).checked = true;

        ui.ville.value = etat.ville || "";
        ui.rayon.value = String(etat.rayon || 50);

        if (
          etat.centre &&
          Number.isFinite(Number(etat.centre.latitude)) &&
          Number.isFinite(Number(etat.centre.longitude))
        ) {
          position = etat.centre;
        }

        changerModeRecherche("proximite");

        if (etat.active && position) {
          rechercher(position, false);
        }
      } else {
        changerModeRecherche("classique");
      }

      window.__cvProximiteInitialise = true;

      window.__cvProximiteControleur = {
        verifier: verifierInterface
      };

      surveillerEventmaker();

      console.log(
        "Filtre proximité Cosmetic Valley initialisé :",
        mode
      );

    } catch (erreur) {
      console.error(
        "Initialisation filtre proximité :",
        erreur
      );
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialiser,
      { once: true }
    );
  } else {
    initialiser();
  }

})();
