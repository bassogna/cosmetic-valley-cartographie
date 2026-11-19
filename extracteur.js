(async function () {
  "use strict";

  
  // ============================================================
  // CONFIGURATION
  // ============================================================

  const CONFIG = {
    eventId: "69df947ea63d9e7ddb3c693e",
    categoryId: "69e2014ffe76df32b3f31117",

    baseAnnuaire:
      "https://www.cosmetic-valley.com/fr/annuaire-entreprises/",

    pageSize: 500,
    maxPages: 20,

    seuilMinimum: 600,

    // Nombre de lectures HTML simultanées
    concurrence: 4,

    delaiEntrePagesMs: 250,
    delaiEntreFichesMs: 200,

    maxTentatives: 3,
    delaiNouvelleTentativeMs: 1200
  };

  if (window.__cvExtractionEnCours) {
    alert("Une extraction Cosmetic Valley est déjà en cours.");
    return;
  }

  window.__cvExtractionEnCours = true;

  // ============================================================
  // MAPPING DES ACTIVITÉS
  // ============================================================

  const ACTIVITES = {
    "1": "CONDITIONNEMENT & LOGISTIQUE",
    "2": "FABRICATION A FAÇON",
    "3": "FORMULATION",
    "4": "EQUIPEMENT INDUSTRIEL",
    "5": "MARQUES",
    "6": "MATIERES PREMIERES",
    "7": "PACKAGING PRIMAIRE",
    "8": "PACKAGING SECONDAIRE",
    "9": "RECHERCHE ET FORMATION",
    "10": "SERVICES",
    "11": "TESTS ET ANALYSES",
    "12": "DISTRIBUTEUR"
  };

  // ============================================================
  // MAPPING DES RÉGIONS
  // ============================================================

  const REGIONS = {
    "auvergne-rhone-alpes": "Auvergne-Rhône-Alpes",
    "bourgogne-franche-comte": "Bourgogne-Franche-Comté",
    "bretagne": "Bretagne",
    "centre-val-de-loire": "Centre-Val De Loire",
    "corse": "Corse",
    "grand-est": "Grand Est",
    "guadeloupe": "Guadeloupe",
    "guyane": "Guyane",
    "hauts-de-france": "Hauts-de-France",
    "ile-de-france": "Île-de-France",
    "la-reunion": "La Réunion",
    "martinique": "Martinique",
    "mayotte": "Mayotte",
    "normandie": "Normandie",
    "nouvelle-aquitaine": "Nouvelle-Aquitaine",
    "occitanie": "Occitanie",
    "pays-de-la-loire": "Pays De La Loire",
    "provence-alpes-cote-d-azur":
      "Provence-Alpes-Côte d'Azur"
  };

  // ============================================================
  // FONCTIONS UTILITAIRES
  // ============================================================

  function pause(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function decodeHtml(value) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = String(value ?? "");
    return textarea.value;
  }

  function texte(value) {
    return decodeHtml(value)
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function nettoyerUrl(value) {
    const valeur = texte(value);

    if (!valeur) return "";

    try {
      const url = new URL(valeur);

      if (
        url.protocol !== "https:" &&
        url.protocol !== "http:"
      ) {
        return "";
      }

      return url.href;

    } catch {
      return "";
    }
  }

  function nettoyerRegion(value) {
    const chaine = texte(value);

    if (!chaine) return "";

    const parties = chaine
      .split("->")
      .map(item => item.trim())
      .filter(Boolean);

    const code = parties.length
      ? parties[parties.length - 1]
      : chaine;

    return REGIONS[code] || code;
  }

  function nettoyerDepartement(value) {
    const chaine = texte(value);

    if (!chaine) return "";

    const parties = chaine
      .split("->")
      .map(item => item.trim())
      .filter(Boolean);

    const code = parties[parties.length - 1] || "";

    return code
      .split("-")
      .map(mot =>
        mot.charAt(0).toUpperCase() + mot.slice(1)
      )
      .join("-");
  }

  function convertirActivites(value) {
    return [
      ...new Set(
        String(value || "")
          .split(";")
          .map(code => code.trim())
          .filter(Boolean)
          .map(code => ACTIVITES[code] || code)
      )
    ];
  }

  function analyserGPS(value) {
    const source = texte(value).replace(/^'/, "");

    if (!source) return null;

    const morceaux = source
      .split(",")
      .map(item => item.trim());

    if (morceaux.length !== 2) return null;

    const latitude = Number(morceaux[0]);
    const longitude = Number(morceaux[1]);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return null;
    }

    return { latitude, longitude };
  }

  // ============================================================
  // INTERFACE DE PROGRESSION
  // ============================================================

  function creerInterface() {
    const ancien = document.getElementById(
      "cv-extracteur-overlay"
    );

    if (ancien) ancien.remove();

    const overlay = document.createElement("div");

    overlay.id = "cv-extracteur-overlay";

    overlay.innerHTML = `
      <div style="
        position:fixed;
        inset:0;
        z-index:2147483647;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:20px;
        background:rgba(0,0,0,.58);
        font-family:Arial,sans-serif;
      ">

        <div style="
          width:min(520px,100%);
          padding:25px;
          border-radius:12px;
          background:#fff;
          box-shadow:0 12px 50px rgba(0,0,0,.4);
        ">

          <h2 style="
            margin:0 0 12px;
            color:#70358d;
            font-size:20px;
          ">
            Cartographie Cosmetic Valley
          </h2>

          <div id="cv-extracteur-etape" style="
            margin-bottom:12px;
            font-size:15px;
            line-height:1.5;
          ">
            Initialisation…
          </div>

          <div style="
            height:12px;
            overflow:hidden;
            border-radius:8px;
            background:#eee;
          ">
            <div id="cv-extracteur-barre" style="
              width:0%;
              height:100%;
              background:#70358d;
              transition:width .25s ease;
            "></div>
          </div>

          <div id="cv-extracteur-detail" style="
            margin-top:12px;
            color:#666;
            font-size:13px;
            white-space:pre-line;
          "></div>

          <button id="cv-extracteur-fermer" style="
            display:none;
            margin-top:18px;
            padding:9px 14px;
            border:0;
            border-radius:6px;
            background:#70358d;
            color:#fff;
            font-weight:bold;
            cursor:pointer;
          ">
            Fermer
          </button>

        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    document
      .getElementById("cv-extracteur-fermer")
      .addEventListener("click", () => overlay.remove());

    return {
      etape: document.getElementById("cv-extracteur-etape"),
      barre: document.getElementById("cv-extracteur-barre"),
      detail: document.getElementById("cv-extracteur-detail"),
      fermer: document.getElementById("cv-extracteur-fermer")
    };
  }

  const interfaceExtraction = creerInterface();

  function afficher(etape, progression, detail) {
    interfaceExtraction.etape.textContent = etape;

    interfaceExtraction.barre.style.width =
      Math.max(0, Math.min(100, progression)) + "%";

    interfaceExtraction.detail.textContent = detail || "";
  }

  function terminer(message, detail, erreur = false) {
    interfaceExtraction.etape.textContent = message;

    interfaceExtraction.etape.style.color =
      erreur ? "#b42318" : "#18794e";

    interfaceExtraction.barre.style.width = "100%";

    interfaceExtraction.barre.style.background =
      erreur ? "#b42318" : "#18794e";

    interfaceExtraction.detail.textContent = detail || "";

    interfaceExtraction.fermer.style.display = "inline-block";
  }

  // ============================================================
  // CONFIGURATION POWER AUTOMATE
  // ============================================================

  function obtenirConfiguration() {

  const flowUrl = window.URL_FLOW;

  if (!flowUrl) {
    throw new Error("URL Power Automate absente du bookmarklet.");
  }

  const secret = (
    prompt(
      "Saisis la clé de contrôle configurée dans Power Automate :"
    ) || ""
  ).trim();

  if (!secret) {
    throw new Error("Clé de contrôle absente.");
  }

  const url = new URL(flowUrl);

  if (url.protocol !== "https:") {
    throw new Error(
      "L'URL Power Automate doit utiliser HTTPS."
    );
  }

  sessionStorage.setItem("cv_flow_url", flowUrl);

  return { flowUrl, secret };
}

  // ============================================================
  // REQUÊTES EVENTMAKER
  // ============================================================

  async function fetchAvecTentatives(url, type) {
    let derniereErreur;

    for (
      let tentative = 1;
      tentative <= CONFIG.maxTentatives;
      tentative++
    ) {
      try {
        const response = await fetch(url, {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            Accept:
              type === "json"
                ? "application/json"
                : "text/html"
          }
        });

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status}`
          );
        }

        // Une redirection vers la connexion ne doit pas
        // être interprétée comme une fiche valide.
        if (
          response.url.includes("/users/sign_in")
        ) {
          throw new Error(
            "Session Eventmaker expirée."
          );
        }

        return type === "json"
          ? await response.json()
          : await response.text();

      } catch (erreur) {
        derniereErreur = erreur;

        if (tentative < CONFIG.maxTentatives) {
          await pause(
            CONFIG.delaiNouvelleTentativeMs * tentative
          );
        }
      }
    }

    throw derniereErreur;
  }

  async function lirePage(page) {
    const url =
      `/api/v1/events/${CONFIG.eventId}/guests.json` +
      `?page=${page}` +
      `&guest_metadata=true`;

    const resultat = await fetchAvecTentatives(
      url,
      "json"
    );

    if (!Array.isArray(resultat)) {
      throw new Error(
        `La page ${page} ne contient pas un tableau JSON.`
      );
    }

    return resultat;
  }

  // ============================================================
  // EXTRACTION DU SLUG NATIF EVENTMAKER
  // ============================================================

  async function recupererSlugNatif(guestId) {
    const url =
      `/fr/events/${CONFIG.eventId}/guests/${guestId}`;

    const html = await fetchAvecTentatives(
      url,
      "html"
    );

    const doc = new DOMParser().parseFromString(
      html,
      "text/html"
    );

    const element = [
      ...doc.querySelectorAll("body *")
    ].find(e =>
      e.children.length === 0 &&
      e.textContent.includes(
        "Slug de chemin de site Web"
      )
    );

    if (!element) {
      throw new Error(
        `Champ slug natif introuvable pour ${guestId}`
      );
    }

    const texteSlug = texte(
      element.parentElement?.textContent || ""
    );

    const correspondance = texteSlug.match(
      /Slug de chemin de site Web\s*:\s*([a-zA-Z0-9_-]+)/i
    );

    if (!correspondance) {
      throw new Error(
        `Valeur du slug introuvable pour ${guestId}`
      );
    }

    return correspondance[1].trim();
  }

  // ============================================================
  // TRANSFORMATION DES GUESTS
  // ============================================================

  function transformerGuest(guest) {
    const metadata = guest.guest_metadata_hash || {};

    const gps = analyserGPS(
      metadata.company_geolocation
    );

    const adherent = {
      id: String(guest._id || ""),
      uid: String(guest.uid || ""),

      nom: texte(guest.company_name),

      region: nettoyerRegion(
        metadata.company_dpt_region_level_1
      ),

      departement: nettoyerDepartement(
        metadata.company_dpt_region_level_2
      ),

      ville: texte(metadata.company_city),

      activites: convertirActivites(
        metadata.company_activite_niv1
      ),

      latitude: gps ? gps.latitude : null,
      longitude: gps ? gps.longitude : null,

      slug: "",
      url: "",

      logo: nettoyerUrl(
        metadata.company_logo_url
      ),

      site_web: nettoyerUrl(
        metadata.company_website
      ),

      updated_at: guest.updated_at || ""
    };

    const anomalies = [];

    if (!adherent.nom) {
      anomalies.push("nom_manquant");
    }

    if (!gps) {
      anomalies.push("gps_manquant");
    }

    if (!adherent.region) {
      anomalies.push("region_manquante");
    }

    if (!adherent.activites.length) {
      anomalies.push("activite_manquante");
    }

    return { adherent, anomalies };
  }

  // ============================================================
  // TRAITEMENT PRINCIPAL
  // ============================================================

  try {
    if (
      window.location.hostname !== "app.eventmaker.io"
    ) {
      throw new Error(
        "Lance cet extracteur depuis le back-office app.eventmaker.io."
      );
    }

    const { flowUrl, secret } = obtenirConfiguration();

    afficher(
      "Lecture des adhérents Eventmaker…",
      5,
      "Connexion à l'API."
    );

    // ========================================================
    // 1. PAGINATION
    // ========================================================

    let page = 1;
    let paginationComplete = false;

    const guestsParId = new Map();
    const signaturesPages = new Set();

    while (page <= CONFIG.maxPages) {
      afficher(
        `Lecture de la page Eventmaker ${page}…`,
        Math.min(20, 5 + page * 5),
        `${guestsParId.size} adhérents uniques récupérés.`
      );

      const guestsPage = await lirePage(page);

      const signature = guestsPage
        .map(g => g._id || g.uid || "")
        .join("|");

      if (
        guestsPage.length &&
        signaturesPages.has(signature)
      ) {
        throw new Error(
          "Une page API est répétée. Pagination interrompue."
        );
      }

      signaturesPages.add(signature);

      const guestsCategorie = guestsPage.filter(
        guest =>
          guest.guest_category_id === CONFIG.categoryId
      );

      guestsCategorie.forEach(guest => {
        const cle = guest._id || guest.uid;

        if (cle) {
          guestsParId.set(cle, guest);
        }
      });

      if (guestsPage.length < CONFIG.pageSize) {
        paginationComplete = true;
        break;
      }

      page++;

      await pause(CONFIG.delaiEntrePagesMs);
    }

    if (!paginationComplete) {
      throw new Error(
        "La pagination Eventmaker n'est pas complète."
      );
    }

    const guests = [...guestsParId.values()];

    if (guests.length < CONFIG.seuilMinimum) {
      throw new Error(
        `Seulement ${guests.length} adhérents récupérés. ` +
        `Minimum requis : ${CONFIG.seuilMinimum}.`
      );
    }

    // ========================================================
    // 2. PRÉPARATION DES DONNÉES
    // ========================================================

    afficher(
      "Préparation des données…",
      25,
      `${guests.length} adhérents actifs récupérés.`
    );

    const resultats = guests.map(
      guest => transformerGuest(guest)
    );

    // ========================================================
    // 3. RÉCUPÉRATION DES SLUGS NATIFS
    // ========================================================

    afficher(
      "Récupération des slugs natifs…",
      30,
      `0 / ${guests.length} fiches traitées.`
    );

    let prochainIndex = 0;
    let nombreTraites = 0;

    const erreursSlug = [];

    async function traiterFiches() {
      while (prochainIndex < guests.length) {
        const index = prochainIndex++;

        const guest = guests[index];
        const resultat = resultats[index];
        const adherent = resultat.adherent;

        try {
          const slug = await recupererSlugNatif(
            guest._id
          );

          adherent.slug = slug;

          adherent.url =
            CONFIG.baseAnnuaire +
            encodeURIComponent(slug);

        } catch (erreur) {
          resultat.anomalies.push(
            "slug_natif_introuvable"
          );

          erreursSlug.push({
            uid: adherent.uid,
            nom: adherent.nom,
            erreur: erreur.message
          });

          console.warn(
            "Slug introuvable :",
            adherent.nom,
            erreur.message
          );
        }

        nombreTraites++;

        // Mise à jour de la progression
        if (
          nombreTraites % 10 === 0 ||
          nombreTraites === guests.length
        ) {
          afficher(
            "Récupération des slugs Eventmaker…",
            30 + Math.round(
              (nombreTraites / guests.length) * 45
            ),
            [
              `${nombreTraites} / ${guests.length} fiches`,
              `${erreursSlug.length} erreurs de slug`
            ].join("\n")
          );
        }

        await pause(CONFIG.delaiEntreFichesMs);
      }
    }

    await Promise.all(
      Array.from(
        {
          length: Math.min(
            CONFIG.concurrence,
            guests.length
          )
        },
        () => traiterFiches()
      )
    );

    // ========================================================
    // 4. CONSTRUCTION DU JSON
    // ========================================================

    afficher(
      "Construction du JSON…",
      80,
      "Vérification des données."
    );

    const adherentsComplets = resultats.map(
      resultat => resultat.adherent
    );

    const adherentsCarte = adherentsComplets.filter(
      adherent =>
        adherent.nom &&
        adherent.latitude !== null &&
        adherent.longitude !== null
    );

    const anomalies = resultats
      .filter(resultat => resultat.anomalies.length)
      .map(resultat => ({
        id: resultat.adherent.id,
        uid: resultat.adherent.uid,
        nom: resultat.adherent.nom,
        problemes: [
          ...new Set(resultat.anomalies)
        ]
      }));

    // ========================================================
    // 5. CONTRÔLES DE SÉCURITÉ
    // ========================================================

    if (
      adherentsCarte.length < CONFIG.seuilMinimum
    ) {
      throw new Error(
        `${adherentsCarte.length} adhérents cartographiables. ` +
        "Publication annulée : nombre insuffisant."
      );
    }

    const slugsManquants = adherentsCarte.filter(
      adherent => !adherent.slug || !adherent.url
    );

    if (slugsManquants.length) {
      console.table(
        slugsManquants.map(a => ({
          uid: a.uid,
          nom: a.nom
        }))
      );

      throw new Error(
        `${slugsManquants.length} adhérents cartographiables ` +
        "sans slug natif. Publication annulée."
      );
    }

    // Contrôle des doublons UID
    const uids = adherentsCarte
      .map(a => a.uid)
      .filter(Boolean);

    if (new Set(uids).size !== uids.length) {
      throw new Error(
        "Des UID sont présents plusieurs fois. Publication annulée."
      );
    }

    // ========================================================
    // 6. PRÉPARATION POWER AUTOMATE
    // ========================================================

    afficher(
      "Préparation de la publication…",
      88,
      [
        `${guests.length} adhérents actifs`,
        `${adherentsCarte.length} cartographiables`,
        `${anomalies.length} fiches avec anomalie`
      ].join("\n")
    );

    const payload = {
      secret,

      nombre_adherents: adherentsCarte.length,

      nombre_adherents_actifs: guests.length,

      pagination_complete: true,

      date_extraction: new Date().toISOString(),

      adherents: adherentsCarte,

      anomalies
    };

    // ========================================================
    // 7. ENVOI POWER AUTOMATE
    // ========================================================

    afficher(
      "Envoi vers Power Automate…",
      95,
      "Transmission du JSON."
    );

    const response = await fetch(flowUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(
        `Power Automate a retourné HTTP ${response.status}.`
      );
    }

    terminer(
      "Transmission terminée",
      [
        `HTTP Power Automate : ${response.status}`,
        "",
        `${guests.length} adhérents actifs`,
        `${adherentsCarte.length} adhérents cartographiables`,
        `${anomalies.length} anomalies`,
        `${erreursSlug.length} erreurs de slug`,
        "",
        "Vérifie l'exécution Power Automate et la publication GitHub."
      ].join("\n")
    );

    console.log(
      "Extraction Cosmetic Valley terminée.",
      {
        actifs: guests.length,
        cartographiables: adherentsCarte.length,
        anomalies: anomalies.length
      }
    );

  } catch (erreur) {
    console.error(
      "Extracteur Cosmetic Valley :",
      erreur
    );

    terminer(
      "Publication annulée",
      erreur.message,
      true
    );

  } finally {
    window.__cvExtractionEnCours = false;
  }

})();
