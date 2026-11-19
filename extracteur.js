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
    "occitanie": "Occitanie
