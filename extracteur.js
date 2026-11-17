(async function () {
  "use strict";

  if (window.__cvExtractionEnCours) {
    alert("Une extraction Cosmetic Valley est déjà en cours.");
    return;
  }

  window.__cvExtractionEnCours = true;

  const CONFIG = {
    eventId: "69df947ea63d9e7ddb3c693e",
    categoryId: "69e2014ffe76df32b3f31117",
    pageSize: 500,
    seuilMinimum: 600,
    delaiEntrePagesMs: 250,
    maxPages: 20
  };

  const ACTIVITES = {
    "1": "CONDITIONNEMENT & LOGISTIQUE",
    "2": "FABRICATION A FAÇON",
    "3": "FORMULATION",
    "4": "EQUIPEMENT INDUSTRIEL & LABORATOIRE",
    "5": "MARQUES",
    "6": "MATIERES PREMIERES",
    "7": "PACKAGING PRIMAIRE",
    "8": "PACKAGING SECONDAIRE",
    "9": "RECHERCHE ET FORMATION",
    "10": "SERVICES",
    "11": "TESTS ET ANALYSES",
    "12": "DISTRIBUTEUR"
  };

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

  function pause(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function decodeHtml(value) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = String(value || "");
    return textarea.value;
  }

  function texte(value) {
    return decodeHtml(value)
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function creerInterface() {
    const ancien = document.getElementById("cv-extracteur-overlay");

    if (ancien) {
      ancien.remove();
    }

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

  function obtenirConfiguration() {
    let flowUrl = localStorage.getItem("cv_flow_url") || "";
    let secret = localStorage.getItem("cv_flow_secret") || "";

    if (!flowUrl) {
      flowUrl = prompt(
        "Colle l’URL HTTP POST du flux Power Automate :"
      ) || "";

      flowUrl = flowUrl.trim();

      if (flowUrl) {
        localStorage.setItem("cv_flow_url", flowUrl);
      }
    }

    if (!secret) {
      secret = prompt(
        "Saisis la clé secrète configurée dans Power Automate :"
      ) || "";

      secret = secret.trim();

      if (secret) {
        localStorage.setItem("cv_flow_secret", secret);
      }
    }

    return { flowUrl, secret };
  }

  function nettoyerRegion(value) {
    const chaine = texte(value);

    if (!chaine) {
      return "";
    }

    const parties = chaine
      .split("->")
      .map(item => item.trim())
      .filter(Boolean);

    const code = parties.length
      ? parties[parties.length - 1]
      : chaine;

    return REGIONS[code] || code;
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

    if (!source) {
      return null;
    }

    const morceaux = source
      .split(",")
      .map(item => item.trim());

    if (morceaux.length !== 2) {
      return null;
    }

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

  function nettoyerUrl(value) {
    const url = texte(value);

    if (!url) {
      return "";
    }

    try {
      const objet = new URL(url);

      if (
        objet.protocol !== "https:" &&
        objet.protocol !== "http:"
      ) {
        return "";
      }

      return objet.href;
    } catch {
      return "";
    }
  }

  async function lirePage(page) {
    const url =
      `/api/v1/events/${CONFIG.eventId}/guests.json` +
      `?page=${page}` +
      `&guest_metadata=true`;

    const response = await fetch(url, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(
        `Erreur Eventmaker HTTP ${response.status} sur la page ${page}`
      );
    }

    const resultat = await response.json();

    if (!Array.isArray(resultat)) {
      throw new Error(
        `La page ${page} ne contient pas un tableau JSON.`
      );
    }

    return resultat;
  }

  function transformerGuest(guest) {
    const metadata = guest.guest_metadata_hash || {};
    const gps = analyserGPS(metadata.company_geolocation);

    const adherent = {
      id: String(guest._id || ""),
      uid: String(guest.uid || ""),
      nom: texte(guest.company_name),
      region: nettoyerRegion(
        metadata.company_dpt_region_level_1
      ),
      departement: nettoyerRegion(
        metadata.company_dpt_region_level_2
      ),
      ville: texte(metadata.company_city),
      activites: convertirActivites(
        metadata.company_activite_niv1
      ),
      latitude: gps ? gps.latitude : null,
      longitude: gps ? gps.longitude : null,
      logo: nettoyerUrl(metadata.company_logo_url),
      site_web: nettoyerUrl(metadata.company_website),
      url: nettoyerUrl(metadata.company_slug),
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

    if (!adherent.url) {
      anomalies.push("url_manquante");
    }

    return { adherent, anomalies };
  }

  try {
    const { flowUrl, secret } = obtenirConfiguration();

    if (!flowUrl || !secret) {
      throw new Error(
        "L’URL Power Automate ou la clé secrète est absente."
      );
    }

    afficher(
      "Lecture des adhérents Eventmaker…",
      5,
      "Connexion à l’API Eventmaker."
    );

    let page = 1;
    let paginationComplete = false;
    const guestsParId = new Map();

    while (page <= CONFIG.maxPages) {
      afficher(
        `Lecture de la page Eventmaker ${page}…`,
        Math.min(30, 5 + page * 8),
        `${guestsParId.size} adhérents uniques récupérés.`
      );

      const guestsPage = await lirePage(page);

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
        "La pagination Eventmaker n’a pas pu être confirmée comme complète."
      );
    }

    const guests = [...guestsParId.values()];

    if (guests.length < CONFIG.seuilMinimum) {
      throw new Error(
        `Seulement ${guests.length} adhérents récupérés. ` +
        `Le seuil minimum est ${CONFIG.seuilMinimum}.`
      );
    }

    afficher(
      "Transformation des données…",
      45,
      `${guests.length} adhérents actifs récupérés.`
    );

    const adherentsComplets = [];
    const adherentsCarte = [];
    const anomalies = [];

    guests.forEach(guest => {
      const resultat = transformerGuest(guest);

      adherentsComplets.push(resultat.adherent);

      if (
        resultat.adherent.nom &&
        resultat.adherent.latitude !== null &&
        resultat.adherent.longitude !== null
      ) {
        adherentsCarte.push(resultat.adherent);
      }

      if (resultat.anomalies.length) {
        anomalies.push({
          id: resultat.adherent.id,
          uid: resultat.adherent.uid,
          nom: resultat.adherent.nom,
          problemes: resultat.anomalies
        });
      }
    });

    if (adherentsCarte.length < CONFIG.seuilMinimum) {
      throw new Error(
        `${adherentsCarte.length} adhérents seulement sont cartographiables. ` +
        `Publication annulée par sécurité.`
      );
    }

    afficher(
      "Préparation de la publication…",
      65,
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
      pagination_complete: paginationComplete,
      date_extraction: new Date().toISOString(),
      adherents: adherentsCarte,
      anomalies
    };

    afficher(
      "Envoi vers Power Automate…",
      80,
      "Transmission du JSON sécurisé."
    );

    const response = await fetch(flowUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const reponseTexte = await response.text();

    if (!response.ok && response.status !== 202) {
      throw new Error(
        `Power Automate a retourné HTTP ${response.status}. ` +
        reponseTexte
      );
    }

    terminer(
      "Transmission terminée",
      [
        `HTTP Power Automate : ${response.status}`,
        `${guests.length} adhérents actifs`,
        `${adherentsCarte.length} adhérents publiables`,
        `${anomalies.length} anomalies`,
        "",
        "Pour ce test, vérifie maintenant test_publication.json sur GitHub."
      ].join("\n")
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
