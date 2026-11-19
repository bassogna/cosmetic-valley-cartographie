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
  // GEOCODAGE VILLE / CODE POSTAL
  // ============================================================

  async function geocoderVille(valeur) {
    const recherche = valeur.trim();

    if (!recherche) {
      throw new Error(
        "Saisissez une ville ou un code postal."
      );
    }

    const params = new URLSearchParams({
      fields: "centre,codesPostaux",
      format: "json",
      limit: "10"
    });

    if (/^[0-9]{5}$/.test(recherche)) {
      params.set("codePostal", recherche);
    } else {
      params.set("nom", recherche);
    }

    const response = await fetch(
      "https://geo.api.gouv.fr/communes?" +
      params.toString()
    );

    if (!response.ok) {
      throw new Error(
        "Service de recherche des villes indisponible."
      );
    }

    const communes = await response.json();

    if (!Array.isArray(communes) || !communes.length) {
      throw new Error(
        "Aucune commune trouvée."
      );
    }

    const exacte = communes.find(c =>
      normaliser(c.nom) === normaliser(recherche)
    );

    const commune = exacte || communes[0];

    if (!commune.centre?.coordinates) {
      throw new Error(
        "Coordonnées de la commune indisponibles."
      );
    }

    return {
      latitude: commune.centre.coordinates[1],
      longitude: commune.centre.coordinates[0],
      nom: commune.nom
    };
  }

  // ============================================================
  // CHARGEMENT JSON GITHUB
  // ============================================================

  async function chargerAdherents() {
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
      throw new Error(
        "Format JSON incorrect."
      );
    }

    return source.filter(a =>
      a.url &&
      a.latitude !== null &&
      a.latitude !== "" &&
      a.longitude !== null &&
      a.longitude !== "" &&
      Number.isFinite(Number(a.latitude)) &&
      Number.isFinite(Number(a.longitude))
    );
  }

  // ============================================================
  // PARAMETRES EVENTMAKER
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

    // Région et Département exclus uniquement
    // des requêtes géographiques.

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
  // PAGINATION EVENTMAKER
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

        if (
          Number.isInteger(n) &&
          n > maximum
        ) {
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
        numero +
        " : HTTP " +
        response.status
      );
    }

    const html = await response.text();

    const doc = new DOMParser().parseFromString(
      html,
      "text/html"
    );

    return {
      doc,
      cartes: [
        ...doc.querySelectorAll(".guest-item")
      ]
    };
  }

  async function chargerToutesLesCartes(filtres) {
    statut("Lecture des résultats Eventmaker...");

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

    async function travailleur() {
      while (prochainePage <= totalPages) {
        const numero = prochainePage++;

        const resultat = await chargerPage(
          numero,
          filtres
        );

        pages[numero - 1] = resultat.cartes;

        terminees++;

        statut(
          "Chargement Eventmaker : " +
          terminees +
          " / " +
          totalPages +
          " pages."
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

      if (slug) {
        index.set(slug, a);
      }
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

      if (!adherent || dejaVus.has(slug)) {
        return;
      }

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
  // LOGOS NATIFS EVENTMAKER
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

      if (source) {
        img.setAttribute("src", source);
      }

      if (srcset) {
        img.setAttribute("srcset", srcset);
      }

      img.removeAttribute("data-src");
      img.removeAttribute("data-original");
      img.removeAttribute("data-lazy-src");
      img.removeAttribute("data-srcset");

      img.loading = "eager";

      img.classList.remove(
        "lazyload",
        "lazyloading"
      );

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

    carte.querySelectorAll(
      "[data-bg], [data-background]"
    ).forEach(element => {
      const background =
        element.getAttribute("data-bg") ||
        element.getAttribute("data-background");

      if (background) {
        element.style.backgroundImage =
          'url("' +
          background.replace(/["\\]/g, "") +
          '")';
      }
    });
  }

  // ============================================================
  // AFFICHAGE NATIF
  // ============================================================

  function masquerResultatsNatifs() {
    if (conteneurNatif) return;

    conteneurNatif = trouverConteneur(document);

    if (!conteneurNatif) {
      throw new Error(
        "Conteneur des fiches introuvable."
      );
    }

    affichageNatif = conteneurNatif.style.display;

    conteneurNatif.style.display = "none";

    const zone = conteneurNatif.parentElement;

    paginationNative = zone
      ? [...zone.querySelectorAll(".pagination")]
      : [];

    paginationNative = paginationNative.filter(
      p => !p.closest("#cv-prox-results")
    );

    paginationNative.forEach(p => {
      p.dataset.cvDisplayOriginal = p.style.display;
      p.style.display = "none";
    });
  }

  function restaurerResultatsNatifs() {
    if (conteneurNatif) {
      conteneurNatif.style.display =
        affichageNatif || "";

      conteneurNatif = null;
    }

    paginationNative.forEach(p => {
      p.style.display =
        p.dataset.cvDisplayOriginal || "";

      delete p.dataset.cvDisplayOriginal;
    });

    paginationNative = [];

    document.getElementById(
      "cv-prox-results"
    )?.remove();
  }

  // ============================================================
  // AFFICHAGE DES RESULTATS
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

    grille.className = "row";

    page.forEach(item => {
      const carte = item.carte.cloneNode(true);

      restaurerImages(carte);

      const badge = document.createElement("div");

      badge.className = "cv-prox-distance";

      badge.textContent =
        "📍 " +
        item.distance.toFixed(1) +
        " km";

      const lien = carte.querySelector(
        'a[href*="/annuaire-entreprises/"]'
      );

      if (lien) {
        lien.appendChild(badge);
      }

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
      const navigation = document.createElement("div");

      navigation.id = "cv-prox-pagination";

      function ajouterBouton(label, numero, actif) {
        const bouton = document.createElement("button");

        bouton.type = "button";

        bouton.className =
          "cv-prox-page" +
          (actif ? " active" : "");

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

        navigation.appendChild(bouton);
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
      ui.rayon.value +
      " km."
    );
  }

  // ============================================================
  // RECHERCHE GEOGRAPHIQUE
  // ============================================================

  async function rechercher(centre, enregistrer = true) {
    if (rechercheEnCours) return;

    verrouiller(true);

    const numeroRequete = ++requeteCourante;

    try {
      const rayon = Number(ui.rayon.value);

      statut(
        "Chargement des données géographiques..."
      );

      const adherents = await chargerAdherents();

      const filtres = obtenirParametresNatifs();

      const cartes = await chargerToutesLesCartes(
        filtres
      );

      statut("Calcul des distances...");

      const selection = filtrerParDistance(
        cartes,
        adherents,
        centre,
        rayon
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
          rayon,
          ville: ui.ville.value,
          active: true
        });
      }

      afficherResultats();

    } catch (erreur) {
      console.error(
        "Filtre proximité Cosmetic Valley :",
        erreur
      );

      statut(erreur.message, true);

    } finally {
      verrouiller(false);
    }
  }

  // ============================================================
  // RECHERCHE DEPUIS LE BOUTON UNIQUE
  // ============================================================

  async function lancerRechercheProximite() {
    if (rechercheEnCours) return;

    try {
      const valeur = ui.ville.value.trim();

      let centre;

      if (
        valeur === "Ma position actuelle" &&
        position
      ) {
        centre = position;

      } else {
        statut("Recherche de la commune...");

        centre = await geocoderVille(valeur);
      }

      await rechercher(centre);

    } catch (erreur) {
      console.error(
        "Recherche proximité :",
        erreur
      );

      statut(erreur.message, true);
    }
  }

  // ============================================================
  // EVENEMENTS
  // ============================================================

  function brancherEvenements() {

    // CHANGEMENT DE MODE

    ui.mode.querySelectorAll(
      'input[name="cv-mode"]'
    ).forEach(input => {
      input.addEventListener("change", () => {
        changerModeRecherche(input.value);
      });
    });

    // AUTOUR DE MOI

    ui.geoloc.addEventListener("click", async () => {
      if (rechercheEnCours) return;

      try {
        statut("Localisation en cours...");

        const centre =
          await obtenirPositionNavigateur();

        ui.ville.value = "Ma position actuelle";

        await rechercher(centre);

      } catch (erreur) {
        statut(erreur.message, true);
      }
    });

    // ENTREE DANS LE CHAMP VILLE

    ui.ville.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();

        lancerRechercheProximite();
      }
    });

    // REINITIALISATION PROXIMITE

    ui.reset.addEventListener("click", () => {
      if (rechercheEnCours) return;

      position = null;
      resultats = [];
      pageCourante = 1;

      ui.ville.value = "";
      ui.rayon.value = "50";

      restaurerResultatsNatifs();

      enregistrerEtat({
        mode: "proximite",
        active: false
      });

      statut("Filtre de proximité désactivé.");
    });

    // ========================================================
    // BOUTON RECHERCHER NATIF EVENTMAKER
    // ========================================================

    formulaire.addEventListener(
      "submit",
      function (e) {

        if (mode !== "proximite") {
          return;
        }

        e.preventDefault();

        e.stopPropagation();

        lancerRechercheProximite();

      },
      true
    );
  }

  // ============================================================
  // INITIALISATION
  // ============================================================

  async function initialiser() {
    try {
      formulaire = trouverFormulaire();

      if (!formulaire) {
        throw new Error(
          "Formulaire Eventmaker introuvable."
        );
      }

      ajouterStyles();

      ui = creerInterface();

      brancherEvenements();

      const etat = lireEtat();

      if (etat?.mode === "proximite") {
        ui.mode.querySelector(
          'input[value="proximite"]'
        ).checked = true;

        ui.ville.value = etat.ville || "";

        ui.rayon.value =
          String(etat.rayon || 50);

        if (
          etat.centre &&
          Number.isFinite(
            Number(etat.centre.latitude)
          ) &&
          Number.isFinite(
            Number(etat.centre.longitude)
          )
        ) {
          position = etat.centre;
        }

        changerModeRecherche("proximite");

        if (etat.active && position) {
          await rechercher(position, false);
        }

      } else {
        changerModeRecherche("classique");
      }

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

  // ============================================================
  // DEMARRAGE
  // ============================================================

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
