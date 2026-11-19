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

    stockage: "cv_proximite_v8"
  };

  if (window.__cvProximiteInitialise) return;

  let formulaire;
  let ui;

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

  let boutonsNatifs = [];

  const paginationNative = new Map();

  let cacheAdherents = null;

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

      if (directs.length > 1) {
        return parent;
      }

      parent = parent.parentElement;
    }

    return premiere.parentElement;
  }

  // ============================================================
  // CSS
  // ============================================================

  function ajouterStyles() {
    if (document.getElementById("cv-proximite-styles")) {
      return;
    }

    const style = document.createElement("style");

    style.id = "cv-proximite-styles";

    style.textContent = `

      /* ==========================================
         SELECTEUR DE MODE
         ========================================== */

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

      /* ==========================================
         FILTRES DE PROXIMITE
         ========================================== */

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

      /* ==========================================
         BARRE DE PROGRESSION
         ========================================== */

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
        border-radius: 8px;
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

      /* ==========================================
         RESULTATS GPS
         ========================================== */

      #cv-prox-results {
        width: 100%;
        margin: 0;
        padding: 0;
      }

      /*
       * Grille Flexbox.
       * Conservation des largeurs Bootstrap Eventmaker.
       * Suppression des flottements responsables
       * des décalages verticaux.
       */

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

      /* Conservation des logos natifs */

      #cv-prox-results .guest-item img {
        max-width: 100%;
        object-fit: contain;
      }

      /* Distance */

      #cv-prox-results .cv-prox-distance {
        margin-top: auto;
        padding-top: 8px;
        text-align: center;
        color: #70358d;
        font-size: 12px;
        font-weight: bold;
      }

      /* ==========================================
         PAGINATION GPS
         ========================================== */

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

      #cv-prox-pagination .cv-prox-page:disabled {
        cursor: default;
      }

      /* ==========================================
         MASQUAGE PAGINATION EVENTMAKER
         ========================================== */

      body.cv-proximite-active
      ul:has(a[href*="guests_list_916095_page="]):not(#cv-prox-pagination),
      body.cv-proximite-active
      nav:has(a[href*="guests_list_916095_page="]):not(#cv-prox-pagination),
      body.cv-proximite-active
      .pagination:has(a[href*="guests_list_916095_page="]) {
        display: none !important;
      }

      /* ==========================================
         MOBILE
         ========================================== */

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

    if (blocRegion) {
      affichageRegion = blocRegion.style.display;
    }

    // ----------------------------------------------------------
    // MODES
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
            checked>
          Par région / département
        </label>

        <label>
          <input
            type="radio"
            name="cv-mode"
            value="proximite">
          📍 À proximité
        </label>

      </div>
    `;

    // ----------------------------------------------------------
    // CHAMPS GPS
    // ----------------------------------------------------------

    const bloc = document.createElement
