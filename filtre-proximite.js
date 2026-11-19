(function () {
  "use strict";

  // ============================================================
  // CONFIGURATION
  // ============================================================

  const CONFIG = {
    dataUrl:
      "https://bassogna.github.io/cosmetic-valley-cartographie/cosmetic_valley_adherents_carte.json",

    prefix: "guests_list_916095",
    pageParam: "guests_list_916095_page",

    maxPages: 50,
    concurrence: 4,
    pageSize: 20,

    stockage: "cv_proximite_v6"
  };

  if (window.__cvProximiteInitialise) return;

  window.__cvProximiteInitialise = true;

  let formulaire;
  let ui;

  let mode = "classique";
  let position = null;

  let resultats = [];
  let pageCourante = 1;
  let rechercheEnCours = false;
  let requeteCourante = 0;

  let blocRegion = null;
  let blocRegionDisplay = "";

  let conteneurNatif = null;
  let affichageNatif = "";
  let paginationNative = [];

  let boutonsNatifs = [];

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

      const parties = url.pathname
        .split("/")
        .filter(Boolean);

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
    );
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
        font-size: 14px;
        cursor: pointer;
      }

      .cv-mode-options input {
        accent-color: #70358d;
      }

      #cv-proximite {
        display: none;
        margin: 12px 0 20px;
        padding: 0;
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

      #cv-prox-status {
        margin-top: 12px;
        font-size: 14px;
        line-height: 1.5;
      }

      #cv-prox-results {
        margin-top: 20px;
      }

      #cv-prox-pagination {
        display: flex;
        justify-content: center;
        gap: 8px;
        flex-wrap: wrap;
        margin: 22px 0;
      }

      .cv-prox-page {
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        background: white;
        color: #70358d;
        cursor: pointer;
      }

      .cv-prox-page.active {
        background: #70358d;
        color: white;
      }

      .cv-prox-page:disabled {
        opacity: .45;
        cursor: default;
      }

      .cv-prox-distance {
        color: #70358d;
        font-size: 12px;
        font-weight: bold;
        text-align: center;
        margin: 7px 0;
      }

      #cv-prox-results .guest-item img {
        max-width: 100%;
        object-fit: contain;
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
      throw new Error(
        "Formulaire Eventmaker introuvable."
      );
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

    if (blocRegion) {
      blocRegionDisplay = blocRegion.style.display;
    }

    // ----------------------------------------------------------
    // SELECTEUR DES MODES
    // ----------------------------------------------------------

    const selecteurMode = document.createElement("div");

    selecteurMode.id = "cv-mode-recherche";

    selecteurMode.innerHTML = `
      <div class="cv-mode-title">
        Mode de recherche
      </div>

      <div class="cv-mode-options">

        <label>
          <input
            type="radio"
            name="cv-mode"
            value="classique"
            checked
          >
          Par région / département
        </label>

        <label>
          <input
            type="radio"
            name="cv-mode"
            value="proximite"
          >
          📍 À proximité
        </label>

      </div>
    `;

    // ----------------------------------------------------------
    // CHAMPS PROXIMITE
    // ----------------------------------------------------------

    const bloc = document.createElement("div");

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
            autocomplete="off"
          >
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

        <button
          type="button"
          id="cv-prox-geoloc"
          class="cv-prox-btn cv-prox-location">
          📍 Autour de moi
        </button>

        <button
          type="button"
          id="cv-prox-reset"
          class="cv-prox-btn cv-prox-reset">
          Réinitialiser
        </button>

      </div>

      <div
        id="cv-prox-status"
        role="status"
        aria-live="polite">
      </div>
    `;

    // ----------------------------------------------------------
    // INSERTION DANS LE FORMULAIRE
    // ----------------------------------------------------------

    formulaire.prepend(selecteurMode);

    if (blocRegion) {
      blocRegion.insertAdjacentElement(
        "afterend",
        bloc
      );
    } else {
      formulaire.appendChild(bloc);
    }

    // Boutons natifs conservés dans les deux modes.

    boutonsNatifs = [
      ...formulaire.querySelectorAll(
        'button[type="submit"], input[type="submit"]'
      )
    ].filter(b => !b.closest("#cv-proximite"));

    return {
      mode: selecteurMode,
      bloc,
      ville: bloc.querySelector("#cv-prox-ville"),
      rayon: bloc.querySelector("#cv-prox-rayon"),
      geoloc: bloc.querySelector("#cv-prox-geoloc"),
      reset: bloc.querySelector("#cv-prox-reset"),
      status: bloc.querySelector("#cv-prox-status")
    };
  }

  function statut(message, erreur = false) {
    ui.status.textContent = message;

    ui.status.style.color =
      erreur ? "#b42318" : "#555";
  }

  function verrouiller(etat) {
    rechercheEnCours = etat;

    ui.geoloc.disabled = etat;
    ui.reset.disabled = etat;

    boutonsNatifs.forEach(b => {
      b.disabled = etat;
    });
  }

  // ============================================================
  // CHANGEMENT DE MODE
  // ============================================================

  function changerModeRecherche(nouveauMode) {
    mode = nouveauMode;

    const proximite = mode === "proximite";

    if (blocRegion) {
      if (proximite) {
        blocRegion.style.setProperty(
          "display",
          "none",
          "important"
        );
      } else {
        blocRegion.style.removeProperty("display");

        if (blocRegionDisplay) {
          blocRegion.style.display = blocRegionDisplay;
        }
      }
    }

    ui.bloc.style.display = proximite
      ? "block"
      : "none";

    // Le bouton natif Rechercher reste visible.

    if (!proximite) {
      ++requeteCourante;
      restaurerResultatsNatifs();
    }

    const ancien = lireEtat() || {};

    enregistrerEtat({
      ...ancien,
      mode,
      active: proximite && !!position && !!ancien.active
    });
  }

  // ============================================================
  // GEOLOCALISATION
  // ============================================================

  function obtenirPositionNavigateur() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error(
          "Géolocalisation indisponible."
        ));
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
            "Impossible
