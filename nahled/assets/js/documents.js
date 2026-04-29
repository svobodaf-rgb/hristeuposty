(function () {
  const DOCUMENTS = [
    {
      id: "collection-certificate",
      title: "Osvědčení o konání veřejné sbírky",
      publicStatus: "pending",
      availabilityLabel: "Bude doplněno",
      description:
        "Doklad k veřejné sbírce. Jakmile bude finální soubor vložen na web, odkaz povede přímo na dokument.",
      href: "osvedceni-verejna-sbirka.html",
      kind: "pending",
      effectiveDate: "15. 05. 2026",
      note: "Položka je připravena pro pozdější přepnutí na PDF."
    },
    {
      id: "transparent-account-info",
      title: "Informace k transparentnímu účtu",
      publicStatus: "available",
      availabilityLabel: "Dostupné",
      description:
        "Vysvětlení, co může být při platbě na transparentní účet veřejně viditelné.",
      href: "transparent-account.html",
      kind: "html",
      lastUpdated: "2026-04-23"
    },
    {
      id: "transparent-account-bank",
      title: "Veřejný náhled transparentního účtu",
      publicStatus: "external",
      availabilityLabel: "Externí odkaz",
      description:
        "Veřejný náhled účtu vedený bankou. Rozsah údajů určuje prostředí banky.",
      href: "https://www.csob.cz/firmy/bezne-ucty/transparentni-ucty/ucet?account=369889612",
      kind: "external",
      note: "Odkaz vede mimo tento web na stránky ČSOB."
    },
    {
      id: "privacy",
      title: "Zásady ochrany osobních údajů",
      publicStatus: "available",
      availabilityLabel: "Dostupné",
      description:
        "Stručně k údajům z formuláře, komunikace a plateb na transparentní účet.",
      href: "privacy.html",
      kind: "html",
      lastUpdated: "2026-04-23"
    },
    {
      id: "interim-accounting",
      title: "Průběžné vyúčtování",
      publicStatus: "after_processing",
      availabilityLabel: "Po zpracování",
      description:
        "Stránka pro pozdější zveřejnění průběžného vyúčtování, až bude zpracované.",
      href: "vyuctovani-prubezne.html",
      kind: "pending",
      effectiveDate: "30. 06. 2027",
      note: "Není součástí hlavního veřejného flow, dokud nebude aktuální."
    },
    {
      id: "final-accounting",
      title: "Konečné vyúčtování",
      publicStatus: "after_close",
      availabilityLabel: "Po ukončení sbírky",
      description:
        "Stránka pro pozdější zveřejnění konečného vyúčtování po ukončení sbírky.",
      href: "vyuctovani-konecne.html",
      kind: "pending",
      note: "Dokument bude relevantní až po ukončení sbírky."
    }
  ];

  const STATUS_META = {
    available: { label: "Dostupné", tone: "good" },
    pending: { label: "Bude doplněno", tone: "warm" },
    after_processing: { label: "Po zpracování", tone: "muted" },
    after_close: { label: "Po ukončení sbírky", tone: "muted" },
    external: { label: "Externí odkaz", tone: "neutral" }
  };

  const KIND_LABELS = {
    html: "stránka",
    pdf: "PDF",
    external: "externí odkaz",
    pending: "připravená stránka"
  };

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;")
      .replaceAll("'", "&#39;");
  }

  function getStatusMeta(documentItem) {
    return STATUS_META[documentItem.publicStatus] || STATUS_META.pending;
  }

  function getCtaLabel(documentItem) {
    if (documentItem.kind === "pdf") {
      return "Stáhnout PDF";
    }

    if (documentItem.kind === "external") {
      return "Otevřít externí odkaz";
    }

    if (documentItem.kind === "pending") {
      return "Zobrazit stav";
    }

    return "Otevřít stránku";
  }

  function renderStatusBadge(documentItem) {
    const statusMeta = getStatusMeta(documentItem);
    return (
      "<span class=\"status-pill status-pill--" +
      escapeHtml(statusMeta.tone) +
      "\">" +
      escapeHtml(documentItem.availabilityLabel || statusMeta.label) +
      "</span>"
    );
  }

  function renderDocumentMeta(documentItem) {
    const metaItems = [KIND_LABELS[documentItem.kind] || documentItem.kind];

    if (documentItem.lastUpdated) {
      metaItems.push("aktualizováno " + documentItem.lastUpdated);
    }

    if (documentItem.effectiveDate) {
      metaItems.push("relevantní od " + documentItem.effectiveDate);
    }

    return metaItems.filter(Boolean).join(" • ");
  }

  function renderDocumentCard(documentItem) {
    const isExternal = documentItem.kind === "external";
    return (
      "<article class=\"document-card\" data-document-id=\"" +
      escapeHtml(documentItem.id) +
      "\">" +
      "<div class=\"document-card__top\"><div><h3>" +
      escapeHtml(documentItem.title) +
      "</h3><p class=\"document-meta\">" +
      escapeHtml(renderDocumentMeta(documentItem)) +
      "</p></div>" +
      renderStatusBadge(documentItem) +
      "</div><p>" +
      escapeHtml(documentItem.description) +
      "</p>" +
      (documentItem.note
        ? "<p class=\"document-note\">" + escapeHtml(documentItem.note) + "</p>"
        : "") +
      "<a class=\"btn btn-secondary document-cta\" href=\"" +
      escapeHtml(documentItem.href) +
      "\"" +
      (isExternal ? " target=\"_blank\" rel=\"noopener noreferrer\"" : "") +
      ">" +
      escapeHtml(getCtaLabel(documentItem)) +
      "</a></article>"
    );
  }

  function renderCompactDocument(documentItem) {
    const isExternal = documentItem.kind === "external";
    return (
      "<li class=\"document-list-item\" data-document-id=\"" +
      escapeHtml(documentItem.id) +
      "\"><div><a href=\"" +
      escapeHtml(documentItem.href) +
      "\"" +
      (isExternal ? " target=\"_blank\" rel=\"noopener noreferrer\"" : "") +
      ">" +
      escapeHtml(documentItem.title) +
      "</a><p>" +
      escapeHtml(documentItem.description) +
      "</p><span class=\"document-meta\">" +
      escapeHtml(renderDocumentMeta(documentItem)) +
      "</span></div>" +
      renderStatusBadge(documentItem) +
      "</li>"
    );
  }

  function getDocumentsForElement(element) {
    const ids = String(element.dataset.documentIds || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (!ids.length) {
      return DOCUMENTS;
    }

    return ids
      .map((id) => DOCUMENTS.find((documentItem) => documentItem.id === id))
      .filter(Boolean);
  }

  function renderDocumentLists(root) {
    const scope = root || document;
    scope.querySelectorAll("[data-documents-list]").forEach((element) => {
      const layout = element.dataset.documentsList || "cards";
      const documents = getDocumentsForElement(element);

      if (layout === "compact") {
        element.innerHTML =
          "<ul class=\"document-list document-list--rendered\">" +
          documents.map(renderCompactDocument).join("") +
          "</ul>";
        return;
      }

      element.innerHTML =
        "<div class=\"document-grid\">" + documents.map(renderDocumentCard).join("") + "</div>";
    });
  }

  window.HristeDocuments = {
    DOCUMENTS,
    STATUS_META,
    getStatusMeta,
    renderDocumentLists
  };

  document.addEventListener("DOMContentLoaded", () => renderDocumentLists());
})();
