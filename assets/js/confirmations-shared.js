(function () {
  const CONFIG = {
    collectedAmountCzk: 0,
    donorCount: 0,
    targetAmountCzk: 1600000,
    accountNumber: "369889612/0300",
    iban: "CZ32 0300 0000 0003 6988 9612",
    bankName: "Československá obchodní banka, a. s.",
    transparentAccountUrl: "https://www.csob.cz/firmy/bezne-ucty/transparentni-ucty/ucet?account=369889612",
    privacyUrl: "privacy.html",
    transparentAccountInfoUrl: "transparent-account.html",
    contactEmail: "hristeuposty@gmail.com",
    qrMessage: "Hriste Palmovka",
    qrRecipient: "Spolek U Posty",
    defaultQrAmount: 500,
    projectName: "Jediné hřiště Palmovky",
    organizerName: "Spolek pro správu a zvelebení dětského hřiště U Pošty",
    organizerIco: "22045082",
    organizerAddress: "U Pošty 1474/1, Libeň, 180 00 Praha 8",
    organizerRegistry: "Městský soud v Praze, oddíl L, vložka 79560",
    collectionPurpose:
      "získání peněžitých příspěvků na rekonstrukci hřiště na křižovatce ulic V Mezihoří a U Pošty (v hlavním městě Praze) a jeho celkovou revitalizaci"
  };

  const SNAPSHOT_SCHEMA = "ops-confirmations-v1";
  const WORKFLOW_STATUSES = [
    "new",
    "needs_review",
    "possible_match",
    "strong_match",
    "approved",
    "rejected",
    "waiting_for_donor",
    "archived"
  ];

  const WORKFLOW_STATUS_META = {
    new: { label: "Nová", tone: "neutral" },
    needs_review: { label: "Ruční kontrola", tone: "muted" },
    possible_match: { label: "Možná shoda", tone: "warm" },
    strong_match: { label: "Silná shoda", tone: "good" },
    approved: { label: "Schváleno", tone: "good" },
    rejected: { label: "Zamítnuto", tone: "danger" },
    waiting_for_donor: { label: "Čeká na dárce", tone: "warm" },
    archived: { label: "Archivováno", tone: "neutral" }
  };

  const MANUAL_WORKFLOW_STATUSES = [
    "approved",
    "rejected",
    "waiting_for_donor",
    "archived"
  ];

  const currencyFormatter = new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0
  });

  const plainNumberFormatter = new Intl.NumberFormat("cs-CZ");

  function formatCurrency(value) {
    return currencyFormatter.format(Number(value) || 0);
  }

  function formatPlainNumber(value) {
    return plainNumberFormatter.format(Number(value) || 0);
  }

  function pluralizeDonors(count) {
    const numericCount = Number(count) || 0;

    if (numericCount === 1) {
      return "1 dárce";
    }

    if (numericCount >= 2 && numericCount <= 4) {
      return plainNumberFormatter.format(numericCount) + " dárci";
    }

    return plainNumberFormatter.format(numericCount) + " dárců";
  }

  function formatDate(dateString) {
    if (!dateString) {
      return "";
    }

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return String(dateString);
    }

    return new Intl.DateTimeFormat("cs-CZ", {
      day: "numeric",
      month: "numeric",
      year: "numeric"
    }).format(date);
  }

  function formatApplicantKind(applicantKind) {
    return applicantKind === "company" ? "právnická osoba" : "fyzická osoba";
  }

  function formatRequestKind(requestKind) {
    return requestKind === "annual"
      ? "souhrnně za kalendářní rok"
      : "pro jednotlivý dar";
  }

  function formatWorkflowStatus(status) {
    return (WORKFLOW_STATUS_META[status] || WORKFLOW_STATUS_META.new).label;
  }

  function getWorkflowStatusMeta(status) {
    return WORKFLOW_STATUS_META[status] || WORKFLOW_STATUS_META.new;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;")
      .replaceAll("'", "&#39;");
  }

  function joinAddress(address) {
    if (!address) {
      return "";
    }

    return [address.street, address.city, address.postalCode].filter(Boolean).join(", ");
  }

  function normalizeWhitespace(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function removeDiacritics(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function normalizeText(value) {
    return removeDiacritics(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function slugifyKey(value) {
    return normalizeText(value).replace(/\s+/g, "");
  }

  function tokenize(value) {
    const normalized = normalizeText(value);
    return normalized ? normalized.split(" ") : [];
  }

  function getTokenOverlapScore(left, right) {
    const leftTokens = new Set(tokenize(left));
    const rightTokens = new Set(tokenize(right));

    if (!leftTokens.size || !rightTokens.size) {
      return 0;
    }

    let commonCount = 0;
    leftTokens.forEach((token) => {
      if (rightTokens.has(token)) {
        commonCount += 1;
      }
    });

    return commonCount / Math.max(leftTokens.size, rightTokens.size);
  }

  function getStringSimilarity(left, right) {
    const normalizedLeft = normalizeText(left);
    const normalizedRight = normalizeText(right);

    if (!normalizedLeft || !normalizedRight) {
      return 0;
    }

    if (normalizedLeft === normalizedRight) {
      return 1;
    }

    return getTokenOverlapScore(normalizedLeft, normalizedRight);
  }

  function parseAmountLike(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    let normalized = String(value || "")
      .replace(/\s+/g, "")
      .replace(/\u00A0/g, "")
      .replace(/CZK|Kc|Kč|EUR|USD/gi, "");

    if (normalized.includes(",")) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    }

    if (!normalized) {
      return NaN;
    }

    return Number(normalized);
  }

  function normalizeDateValue(value) {
    if (!value) {
      return null;
    }

    const normalized = String(value).trim();
    const directMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (directMatch) {
      return normalized;
    }

    const dottedMatch = normalized.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);

    if (dottedMatch) {
      const day = dottedMatch[1].padStart(2, "0");
      const month = dottedMatch[2].padStart(2, "0");
      return dottedMatch[3] + "-" + month + "-" + day;
    }

    const slashMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

    if (slashMatch) {
      const month = slashMatch[1].padStart(2, "0");
      const day = slashMatch[2].padStart(2, "0");
      return slashMatch[3] + "-" + month + "-" + day;
    }

    const parsedDate = new Date(normalized);

    if (Number.isNaN(parsedDate.getTime())) {
      return null;
    }

    return parsedDate.toISOString().slice(0, 10);
  }

  function buildRequestId(prefix) {
    const safePrefix = prefix || "jhp";
    const createdAt = new Date().toISOString();
    return (
      safePrefix +
      "-" +
      createdAt
        .replaceAll("-", "")
        .replaceAll(":", "")
        .replaceAll(".", "")
        .replace("T", "-")
        .replace("Z", "")
    );
  }

  function getTrimmedValue(formData, key) {
    return normalizeWhitespace(formData.get(key) || "");
  }

  function buildRequestPayload(formData) {
    const applicantKind = getTrimmedValue(formData, "applicantKind");
    const requestKind = getTrimmedValue(formData, "requestKind");
    const createdAt = new Date().toISOString();

    const address = {
      street: getTrimmedValue(formData, "addressStreet"),
      city: getTrimmedValue(formData, "addressCity"),
      postalCode: getTrimmedValue(formData, "addressPostalCode")
    };

    const contact = {
      email: getTrimmedValue(formData, "contactEmail"),
      phone: getTrimmedValue(formData, "contactPhone") || null
    };

    const payerIdentity = {
      accountHolderName: getTrimmedValue(formData, "payerAccountName") || null,
      differsFromApplicant: Boolean(getTrimmedValue(formData, "payerAccountName"))
    };

    const applicant =
      applicantKind === "company"
        ? {
            kind: "company",
            legalName: getTrimmedValue(formData, "companyName"),
            ico: getTrimmedValue(formData, "companyIco"),
            contactPerson: getTrimmedValue(formData, "companyContactPerson") || null
          }
        : {
            kind: "person",
            firstName: getTrimmedValue(formData, "personFirstName"),
            lastName: getTrimmedValue(formData, "personLastName"),
            fullName: [
              getTrimmedValue(formData, "personFirstName"),
              getTrimmedValue(formData, "personLastName")
            ]
              .filter(Boolean)
              .join(" "),
            birthDate: getTrimmedValue(formData, "personBirthDate") || null
          };

    const donationLookup =
      requestKind === "annual"
        ? {
            mode: "annual",
            calendarYear: Number(getTrimmedValue(formData, "annualCalendarYear") || 0),
            note: getTrimmedValue(formData, "annualRequestNote") || null
          }
        : {
            mode: "single",
            amountCzk: Number(getTrimmedValue(formData, "singleAmount") || 0),
            paymentDateApprox: getTrimmedValue(formData, "singlePaymentDate") || null,
            variableSymbol: getTrimmedValue(formData, "singleVariableSymbol") || null,
            messageForRecipient: getTrimmedValue(formData, "singlePaymentMessage") || null,
            note: getTrimmedValue(formData, "singleRequestNote") || null
          };

    return {
      requestMeta: {
        requestId: buildRequestId("jhp"),
        createdAt,
        source: "static_web_manual_request_v2",
        requestStatus: "new_unverified",
        applicantKind,
        requestKind
      },
      applicant,
      address,
      contact,
      payerIdentity,
      donationLookup,
      matchingHints: {
        matchByAmount: donationLookup.mode === "single" && Boolean(donationLookup.amountCzk),
        matchByApproxDate:
          donationLookup.mode === "single" && Boolean(donationLookup.paymentDateApprox),
        matchByVariableSymbol:
          donationLookup.mode === "single" && Boolean(donationLookup.variableSymbol),
        matchByMessage:
          donationLookup.mode === "single" && Boolean(donationLookup.messageForRecipient),
        matchByPayerAccountName: Boolean(payerIdentity.accountHolderName),
        matchByCalendarYear:
          donationLookup.mode === "annual" && Boolean(donationLookup.calendarYear)
      },
      collection: {
        projectName: CONFIG.projectName,
        organizerName: CONFIG.organizerName,
        accountNumber: CONFIG.accountNumber,
        iban: CONFIG.iban,
        bankName: CONFIG.bankName,
        collectionChannel: "transparent_account"
      },
      acknowledgements: {
        privacyConsent: Boolean(formData.get("privacyConsent"))
      }
    };
  }

  function cloneData(value) {
    if (typeof structuredClone === "function") {
      return structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value));
  }

  function validateRequestPayload(payload) {
    const errors = [];

    if (!payload || typeof payload !== "object") {
      return ["JSON neobsahuje platný objekt žádosti."];
    }

    ["requestMeta", "applicant", "address", "contact", "donationLookup"].forEach((key) => {
      if (!payload[key] || typeof payload[key] !== "object") {
        errors.push("Chybí blok `" + key + "`.");
      }
    });

    if (payload.requestMeta && !payload.requestMeta.requestKind) {
      errors.push("Chybí `requestMeta.requestKind`.");
    }

    if (payload.applicant && !payload.applicant.kind) {
      errors.push("Chybí `applicant.kind`.");
    }

    if (payload.contact && !payload.contact.email) {
      errors.push("Chybí `contact.email`.");
    }

    if (payload.donationLookup && !payload.donationLookup.mode) {
      errors.push("Chybí `donationLookup.mode`.");
    }

    return errors;
  }

  function normalizeRequestPayload(input, options) {
    const normalized = cloneData(input);
    const errors = validateRequestPayload(normalized);

    if (errors.length) {
      throw new Error(errors.join(" "));
    }

    const now = new Date().toISOString();
    const idPrefix = options && options.idPrefix ? options.idPrefix : "ops-req";

    normalized.requestMeta = normalized.requestMeta || {};
    normalized.requestMeta.requestId =
      normalizeWhitespace(normalized.requestMeta.requestId) || buildRequestId(idPrefix);
    normalized.requestMeta.createdAt = normalized.requestMeta.createdAt || now;
    normalized.requestMeta.source =
      normalized.requestMeta.source || "static_web_manual_request_v2";
    normalized.requestMeta.requestStatus =
      normalized.requestMeta.requestStatus || "new_unverified";
    normalized.requestMeta.applicantKind =
      normalized.requestMeta.applicantKind || normalized.applicant.kind;
    normalized.requestMeta.requestKind =
      normalized.requestMeta.requestKind || normalized.donationLookup.mode;

    normalized.applicant = normalized.applicant || {};
    normalized.applicant.kind = normalized.applicant.kind || normalized.requestMeta.applicantKind;

    if (normalized.applicant.kind === "person") {
      normalized.applicant.fullName =
        normalized.applicant.fullName ||
        [normalized.applicant.firstName, normalized.applicant.lastName]
          .filter(Boolean)
          .join(" ")
          .trim();
    }

    normalized.contact = normalized.contact || {};
    normalized.contact.email = normalizeWhitespace(normalized.contact.email);
    normalized.contact.phone = normalizeWhitespace(normalized.contact.phone) || null;

    normalized.address = normalized.address || {};
    normalized.address.street = normalizeWhitespace(normalized.address.street);
    normalized.address.city = normalizeWhitespace(normalized.address.city);
    normalized.address.postalCode = normalizeWhitespace(normalized.address.postalCode);

    normalized.payerIdentity = normalized.payerIdentity || {};
    normalized.payerIdentity.accountHolderName =
      normalizeWhitespace(normalized.payerIdentity.accountHolderName) || null;
    normalized.payerIdentity.differsFromApplicant = Boolean(
      normalized.payerIdentity.accountHolderName
    );

    normalized.donationLookup = normalized.donationLookup || {};
    normalized.donationLookup.mode =
      normalized.donationLookup.mode || normalized.requestMeta.requestKind;

    if (normalized.donationLookup.mode === "annual") {
      normalized.donationLookup.calendarYear = Number(normalized.donationLookup.calendarYear || 0);
      normalized.donationLookup.note = normalizeWhitespace(normalized.donationLookup.note) || null;
    } else {
      normalized.donationLookup.amountCzk = Number(normalized.donationLookup.amountCzk || 0);
      normalized.donationLookup.paymentDateApprox =
        normalizeDateValue(normalized.donationLookup.paymentDateApprox) ||
        normalizeWhitespace(normalized.donationLookup.paymentDateApprox) ||
        null;
      normalized.donationLookup.variableSymbol =
        normalizeWhitespace(normalized.donationLookup.variableSymbol) || null;
      normalized.donationLookup.messageForRecipient =
        normalizeWhitespace(normalized.donationLookup.messageForRecipient) || null;
      normalized.donationLookup.note = normalizeWhitespace(normalized.donationLookup.note) || null;
    }

    normalized.matchingHints = normalized.matchingHints || {
      matchByAmount:
        normalized.donationLookup.mode === "single" && Boolean(normalized.donationLookup.amountCzk),
      matchByApproxDate:
        normalized.donationLookup.mode === "single" &&
        Boolean(normalized.donationLookup.paymentDateApprox),
      matchByVariableSymbol:
        normalized.donationLookup.mode === "single" &&
        Boolean(normalized.donationLookup.variableSymbol),
      matchByMessage:
        normalized.donationLookup.mode === "single" &&
        Boolean(normalized.donationLookup.messageForRecipient),
      matchByPayerAccountName: Boolean(normalized.payerIdentity.accountHolderName),
      matchByCalendarYear:
        normalized.donationLookup.mode === "annual" &&
        Boolean(normalized.donationLookup.calendarYear)
    };

    normalized.collection = normalized.collection || {
      projectName: CONFIG.projectName,
      organizerName: CONFIG.organizerName,
      accountNumber: CONFIG.accountNumber,
      iban: CONFIG.iban,
      bankName: CONFIG.bankName,
      collectionChannel: "transparent_account"
    };

    normalized.acknowledgements = normalized.acknowledgements || {};

    return normalized;
  }

  function getApplicantDisplayName(payload) {
    return payload.applicant.kind === "company"
      ? payload.applicant.legalName
      : payload.applicant.fullName;
  }

  function formatCurrencyNumber(value) {
    return typeof value === "number" && value > 0 ? formatCurrency(value) : "neuvedeno";
  }

  function buildOperatorChecklist(payload) {
    const items = [
      "Potvrzení vystavit až po ověření přijetí daru na transparentním účtu.",
      "Zkontrolovat shodu identifikačních údajů žadatele a údajů o plátci, pokud se liší."
    ];

    if (payload.donationLookup.mode === "single") {
      items.push(
        "Dohledat platbu podle částky " +
          formatCurrencyNumber(payload.donationLookup.amountCzk) +
          " a přibližného data " +
          (formatDate(payload.donationLookup.paymentDateApprox) || "neuvedeno") +
          "."
      );

      if (payload.donationLookup.variableSymbol) {
        items.push("Prověřit variabilní symbol: " + payload.donationLookup.variableSymbol + ".");
      }

      if (payload.donationLookup.messageForRecipient) {
        items.push(
          "Prověřit zprávu pro příjemce: " +
            payload.donationLookup.messageForRecipient +
            "."
        );
      }
    } else {
      items.push(
        "Prověřit dary připsané v kalendářním roce " +
          payload.donationLookup.calendarYear +
          "."
      );
    }

    if (payload.payerIdentity.accountHolderName) {
      items.push(
        "Při dohledání zohlednit jméno plátce na účtu: " +
          payload.payerIdentity.accountHolderName +
          "."
      );
    }

    items.push("Pokud nebude možné dar jednoznačně dohledat, kontaktovat žadatele.");

    return items;
  }

  function buildReadableSummary(payload) {
    const donorLabel = getApplicantDisplayName(payload);
    const lines = [
      "Žádost o potvrzení o daru",
      "",
      "Typ žadatele: " + formatApplicantKind(payload.requestMeta.applicantKind),
      "Typ potvrzení: " + formatRequestKind(payload.requestMeta.requestKind),
      "ID žádosti: " + payload.requestMeta.requestId,
      "",
      "Identifikační údaje:",
      "Název / jméno: " + donorLabel,
      "Adresa: " + joinAddress(payload.address),
      "E-mail: " + payload.contact.email
    ];

    if (payload.applicant.kind === "company" && payload.applicant.ico) {
      lines.push("IČO: " + payload.applicant.ico);
    }

    if (payload.applicant.kind === "company" && payload.applicant.contactPerson) {
      lines.push("Kontaktní osoba: " + payload.applicant.contactPerson);
    }

    if (payload.applicant.kind === "person" && payload.applicant.birthDate) {
      lines.push("Datum narození: " + formatDate(payload.applicant.birthDate));
    }

    if (payload.contact.phone) {
      lines.push("Telefon: " + payload.contact.phone);
    }

    if (payload.payerIdentity.accountHolderName) {
      lines.push("Jméno plátce na účtu: " + payload.payerIdentity.accountHolderName);
    }

    lines.push("", "Údaje k dohledání platby:");

    if (payload.donationLookup.mode === "single") {
      lines.push("Výše daru: " + formatCurrencyNumber(payload.donationLookup.amountCzk));
      lines.push(
        "Přibližné datum platby: " +
          (formatDate(payload.donationLookup.paymentDateApprox) || "neuvedeno")
      );
      lines.push(
        "Variabilní symbol: " + (payload.donationLookup.variableSymbol || "neuvedeno")
      );
      lines.push(
        "Zpráva pro příjemce: " +
          (payload.donationLookup.messageForRecipient || "neuvedeno")
      );
    } else {
      lines.push("Kalendářní rok: " + payload.donationLookup.calendarYear);
    }

    lines.push(
      "Poznámka: " + (payload.donationLookup.note || "neuvedeno"),
      "",
      "Interní ověření:",
      ...buildOperatorChecklist(payload).map((item) => "- " + item)
    );

    return lines.join("\n");
  }

  function buildSummarySections(payload) {
    const identityRows = [
      [
        payload.applicant.kind === "company" ? "Název organizace" : "Jméno a příjmení",
        getApplicantDisplayName(payload)
      ],
      ["Adresa", joinAddress(payload.address)],
      ["E-mail", payload.contact.email]
    ];

    if (payload.applicant.kind === "company") {
      identityRows.push(["IČO", payload.applicant.ico]);
      if (payload.applicant.contactPerson) {
        identityRows.push(["Kontaktní osoba", payload.applicant.contactPerson]);
      }
    }

    if (payload.applicant.kind === "person" && payload.applicant.birthDate) {
      identityRows.push(["Datum narození", formatDate(payload.applicant.birthDate)]);
    }

    if (payload.contact.phone) {
      identityRows.push(["Telefon", payload.contact.phone]);
    }

    if (payload.payerIdentity.accountHolderName) {
      identityRows.push(["Jméno plátce na účtu", payload.payerIdentity.accountHolderName]);
    }

    const donationRows =
      payload.donationLookup.mode === "annual"
        ? [
            ["Typ potvrzení", formatRequestKind(payload.requestMeta.requestKind)],
            ["Rok", String(payload.donationLookup.calendarYear)],
            ["Poznámka", payload.donationLookup.note || "neuvedeno"]
          ]
        : [
            ["Typ potvrzení", formatRequestKind(payload.requestMeta.requestKind)],
            ["Výše daru", formatCurrencyNumber(payload.donationLookup.amountCzk)],
            [
              "Přibližné datum",
              formatDate(payload.donationLookup.paymentDateApprox) || "neuvedeno"
            ],
            ["Variabilní symbol", payload.donationLookup.variableSymbol || "neuvedeno"],
            [
              "Zpráva pro příjemce",
              payload.donationLookup.messageForRecipient || "neuvedeno"
            ],
            ["Poznámka", payload.donationLookup.note || "neuvedeno"]
          ];

    return [
      {
        title: "Typ žádosti",
        rows: [
          ["Typ žadatele", formatApplicantKind(payload.requestMeta.applicantKind)],
          ["Typ potvrzení", formatRequestKind(payload.requestMeta.requestKind)],
          ["ID žádosti", payload.requestMeta.requestId]
        ]
      },
      {
        title: "Identifikační údaje",
        rows: identityRows
      },
      {
        title: "Údaje k dohledání platby",
        rows: donationRows
      }
    ];
  }

  function renderSummaryHtml(payload) {
    return buildSummarySections(payload)
      .map((section) => {
        const rows = section.rows
          .filter((row) => Boolean(row[1]))
          .map(
            (row) =>
              "<div><dt>" +
              escapeHtml(row[0]) +
              "</dt><dd>" +
              escapeHtml(row[1]) +
              "</dd></div>"
          )
          .join("");

        return (
          "<section class=\"summary-section\">" +
          "<h4>" +
          escapeHtml(section.title) +
          "</h4>" +
          "<dl class=\"summary-list\">" +
          rows +
          "</dl>" +
          "</section>"
        );
      })
      .join("");
  }

  function buildMailtoDraft(payload) {
    const subject =
      "Žádost o potvrzení o daru — " +
      formatApplicantKind(payload.requestMeta.applicantKind) +
      " / " +
      formatRequestKind(payload.requestMeta.requestKind) +
      " — " +
      CONFIG.projectName;

    const bodyLines = [
      "Dobrý den,",
      "",
      "žádám o vystavení potvrzení o daru pro veřejnou sbírku " + CONFIG.projectName + ".",
      "Potvrzení prosím vystavte až po ověření přijetí daru na transparentním účtu.",
      "",
      "Základní údaje:",
      "Typ žadatele: " + formatApplicantKind(payload.requestMeta.applicantKind),
      "Typ potvrzení: " + formatRequestKind(payload.requestMeta.requestKind),
      "ID žádosti: " + payload.requestMeta.requestId,
      "",
      "Identifikační údaje:",
      "Název / jméno: " + getApplicantDisplayName(payload),
      "Adresa: " + joinAddress(payload.address),
      "E-mail: " + payload.contact.email
    ];

    if (payload.applicant.kind === "company") {
      bodyLines.push("IČO: " + payload.applicant.ico);
      if (payload.applicant.contactPerson) {
        bodyLines.push("Kontaktní osoba: " + payload.applicant.contactPerson);
      }
    }

    if (payload.applicant.kind === "person" && payload.applicant.birthDate) {
      bodyLines.push("Datum narození: " + formatDate(payload.applicant.birthDate));
    }

    if (payload.contact.phone) {
      bodyLines.push("Telefon: " + payload.contact.phone);
    }

    if (payload.payerIdentity.accountHolderName) {
      bodyLines.push("Jméno plátce na účtu: " + payload.payerIdentity.accountHolderName);
    }

    bodyLines.push("", "Údaje k dohledání platby:");

    if (payload.donationLookup.mode === "single") {
      bodyLines.push("Výše daru: " + formatCurrencyNumber(payload.donationLookup.amountCzk));
      bodyLines.push(
        "Přibližné datum platby: " +
          (formatDate(payload.donationLookup.paymentDateApprox) || "neuvedeno")
      );
      bodyLines.push(
        "Variabilní symbol: " + (payload.donationLookup.variableSymbol || "neuvedeno")
      );
      bodyLines.push(
        "Zpráva pro příjemce: " +
          (payload.donationLookup.messageForRecipient || "neuvedeno")
      );
    } else {
      bodyLines.push("Kalendářní rok: " + payload.donationLookup.calendarYear);
    }

    bodyLines.push(
      "Poznámka: " + (payload.donationLookup.note || "neuvedeno"),
      "",
      "Interní ověření:",
      ...buildOperatorChecklist(payload).map((item) => "- " + item),
      "",
      "Pokud údaje nebudou stačit k jednoznačnému dohledání platby, prosím kontaktujte mě na uvedeném e-mailu.",
      "",
      "Děkuji."
    );

    return {
      subject,
      body: bodyLines.join("\n")
    };
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const helper = document.createElement("textarea");
    helper.value = text;
    helper.setAttribute("readonly", "");
    helper.style.position = "absolute";
    helper.style.left = "-9999px";
    document.body.appendChild(helper);
    helper.select();
    document.execCommand("copy");
    helper.remove();
  }

  function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function downloadJson(filename, data) {
    downloadFile(filename, JSON.stringify(data, null, 2), "application/json;charset=utf-8");
  }

  function buildRequestExportFilename(payload) {
    return "jhp-request-" + payload.requestMeta.requestId + ".json";
  }

  function sumTransactionAmounts(transactions) {
    return (transactions || []).reduce((sum, transaction) => {
      return sum + (Number(transaction.amount) || 0);
    }, 0);
  }

  function getResolvedTransactions(record) {
    if (Array.isArray(record.resolvedTransactions)) {
      return record.resolvedTransactions;
    }

    if (Array.isArray(record.selectedTransactions)) {
      return record.selectedTransactions;
    }

    return [];
  }

  function buildResolutionContext(record) {
    const payload = record.sourcePayload || record;
    const resolution = record.resolution || {};
    const transactions = getResolvedTransactions(record);
    const resolvedAmount =
      typeof resolution.resolvedAmount === "number" && resolution.resolvedAmount > 0
        ? resolution.resolvedAmount
        : payload.donationLookup.mode === "single"
          ? Number(payload.donationLookup.amountCzk || 0) || sumTransactionAmounts(transactions)
          : sumTransactionAmounts(transactions);

    const resolvedDateText =
      normalizeWhitespace(resolution.resolvedDateText) ||
      (payload.donationLookup.mode === "annual"
        ? "v kalendářním roce " + payload.donationLookup.calendarYear
        : formatDate(
            transactions[0] && transactions[0].bookingDate
              ? transactions[0].bookingDate
              : payload.donationLookup.paymentDateApprox
          ) || "neuvedeno");

    return {
      payload,
      resolution,
      transactions,
      donorLabel: getApplicantDisplayName(payload),
      resolvedAmount,
      resolvedDateText
    };
  }

  function renderTransactionListHtml(transactions) {
    if (!transactions.length) {
      return "";
    }

    return (
      "<ul class=\"draft-transaction-list\">" +
      transactions
        .map((transaction) => {
          return (
            "<li><strong>" +
            escapeHtml(formatCurrency(transaction.amount)) +
            "</strong> — " +
            escapeHtml(formatDate(transaction.bookingDate) || "neuvedeno") +
            (transaction.variableSymbol
              ? " • VS " + escapeHtml(transaction.variableSymbol)
              : "") +
            (transaction.payerName ? " • " + escapeHtml(transaction.payerName) : "") +
            "</li>"
          );
        })
        .join("") +
      "</ul>"
    );
  }

  function renderTransactionListText(transactions) {
    if (!transactions.length) {
      return "Bez připojeného přehledu transakcí.";
    }

    return transactions
      .map((transaction) => {
        return (
          "- " +
          formatCurrency(transaction.amount) +
          " | " +
          (formatDate(transaction.bookingDate) || "neuvedeno") +
          (transaction.variableSymbol ? " | VS " + transaction.variableSymbol : "") +
          (transaction.payerName ? " | " + transaction.payerName : "")
        );
      })
      .join("\n");
  }

  function buildConfirmationDraft(record) {
    const context = buildResolutionContext(record);
    const donorIdentification =
      context.payload.applicant.kind === "company"
        ? context.donorLabel + ", IČO " + context.payload.applicant.ico
        : context.donorLabel;
    const amountText = formatCurrency(context.resolvedAmount);
    const annualMode = context.payload.donationLookup.mode === "annual";
    const subject =
      "Pracovní draft potvrzení o přijetí daru — " +
      context.donorLabel +
      " — " +
      CONFIG.projectName;

    const introText = annualMode
      ? "Potvrzujeme, že jsme od uvedeného dárce přijali v kalendářním roce " +
        context.payload.donationLookup.calendarYear +
        " peněžité dary v celkové výši " +
        amountText +
        "."
      : "Potvrzujeme, že jsme od uvedeného dárce přijali peněžitý dar ve výši " +
        amountText +
        " dne " +
        context.resolvedDateText +
        ".";

    const html =
      "<article class=\"draft-letter\">" +
      "<h3>Pracovní draft potvrzení o přijetí daru</h3>" +
      "<p><strong>Pracovní podklad:</strong> tento text není finální podepsané potvrzení ani razítkovaný dokument.</p>" +
      "<p><strong>" +
      escapeHtml(CONFIG.organizerName) +
      "</strong><br />IČO " +
      escapeHtml(CONFIG.organizerIco) +
      "<br />" +
      escapeHtml(CONFIG.organizerAddress) +
      "</p>" +
      "<p><strong>Dárce:</strong><br />" +
      escapeHtml(donorIdentification) +
      "<br />" +
      escapeHtml(joinAddress(context.payload.address)) +
      "</p>" +
      "<p>" +
      escapeHtml(introText) +
      "</p>" +
      "<p>Dar byl přijat v rámci veřejné sbírky \"" +
      escapeHtml(CONFIG.projectName) +
      "\". Účelem sbírky je " +
      escapeHtml(CONFIG.collectionPurpose) +
      ".</p>" +
      "<p>Tento draft slouží jako podklad pro potvrzení o přijetí daru pro daňové účely.</p>" +
      renderTransactionListHtml(context.transactions) +
      "</article>";

    const textLines = [
      "Potvrzení o přijetí daru",
      "PRACOVNÍ DRAFT - není finální podepsané potvrzení.",
      "",
      CONFIG.organizerName,
      "IČO: " + CONFIG.organizerIco,
      CONFIG.organizerAddress,
      "",
      "Dárce:",
      donorIdentification,
      joinAddress(context.payload.address),
      "",
      introText,
      "",
      "Dar byl přijat v rámci veřejné sbírky \"" +
        CONFIG.projectName +
        "\".",
      "Účel sbírky: " + CONFIG.collectionPurpose + ".",
      "Tento draft slouží jako podklad pro potvrzení o přijetí daru pro daňové účely.",
      "",
      "Přehled připojených transakcí:",
      renderTransactionListText(context.transactions)
    ];

    return {
      subject,
      title: "Draft potvrzení o daru",
      html,
      text: textLines.join("\n"),
      suggestedFilename: "jhp-confirmation-" + context.payload.requestMeta.requestId
    };
  }

  function buildDonorReplyDraft(record) {
    const context = buildResolutionContext(record);
    const subject =
      "Potvrzení o daru připravujeme — " +
      CONFIG.projectName +
      " / " +
      context.payload.requestMeta.requestId;
    const bodyLines = [
      "Dobrý den,",
      "",
      "děkujeme za Váš dar pro veřejnou sbírku " + CONFIG.projectName + ".",
      "Potvrzení o přijetí daru jsme připravili k finálnímu vystavení po interní kontrole.",
      annualizedLine(context),
      "",
      "Pokud by bylo potřeba ještě něco doplnit, ozveme se Vám na tento e-mail.",
      "",
      "S pozdravem",
      CONFIG.organizerName
    ].filter(Boolean);

    return {
      subject,
      title: "E-mail dárci po schválení",
      body: bodyLines.join("\n"),
      mailto:
        "mailto:" +
        encodeURIComponent(context.payload.contact.email) +
        "?subject=" +
        encodeURIComponent(subject) +
        "&body=" +
        encodeURIComponent(bodyLines.join("\n"))
    };
  }

  function annualizedLine(context) {
    if (context.payload.donationLookup.mode === "annual") {
      return (
        "Jde o souhrn darů za kalendářní rok " +
        context.payload.donationLookup.calendarYear +
        " v celkové výši " +
        formatCurrency(context.resolvedAmount) +
        "."
      );
    }

    return "Evidujeme dar ve výši " + formatCurrency(context.resolvedAmount) + ".";
  }

  function buildFollowupRequestDraft(record) {
    const payload = record.sourcePayload || record;
    const subject =
      "Doplnění údajů k potvrzení o daru — " +
      CONFIG.projectName +
      " / " +
      payload.requestMeta.requestId;
    const bodyLines = [
      "Dobrý den,",
      "",
      "děkujeme za Vaši žádost o potvrzení o daru pro veřejnou sbírku " +
        CONFIG.projectName +
        ".",
      "Zatím se nám nepodařilo dar jednoznačně dohledat na transparentním účtu.",
      "Pomůže nám, pokud doplníte co nejvíce z těchto údajů:",
      "- přesnou nebo přibližnou částku daru",
      "- datum platby",
      "- variabilní symbol nebo zprávu pro příjemce",
      "- jméno plátce na účtu, pokud se liší od dárce",
      "",
      "ID žádosti: " + payload.requestMeta.requestId,
      "",
      "Děkujeme za součinnost.",
      "",
      "S pozdravem",
      CONFIG.organizerName
    ];

    return {
      subject,
      title: "E-mail s žádostí o doplnění",
      body: bodyLines.join("\n"),
      mailto:
        "mailto:" +
        encodeURIComponent(payload.contact.email) +
        "?subject=" +
        encodeURIComponent(subject) +
        "&body=" +
        encodeURIComponent(bodyLines.join("\n"))
    };
  }

  function buildInternalArchiveRecord(record) {
    const context = buildResolutionContext(record);
    const selectedTransactionIds =
      (record.resolution && record.resolution.selectedTransactionIds) ||
      context.transactions.map((transaction) => transaction.transactionId);
    const summary = [
      "Interní záznam žádosti",
      "",
      "ID žádosti: " + context.payload.requestMeta.requestId,
      "Stav: " + formatWorkflowStatus(record.workflowStatus || context.resolution.status || "new"),
      "Rozhodnuto: " + ((record.resolution && record.resolution.decidedAt) || "neuvedeno"),
      "Dárce: " + context.donorLabel,
      "E-mail: " + context.payload.contact.email,
      "Typ potvrzení: " + formatRequestKind(context.payload.requestMeta.requestKind),
      "Vyřešená částka: " + formatCurrency(context.resolvedAmount),
      "Vyřešené datum / období: " + context.resolvedDateText,
      "Vybrané transactionId: " + (selectedTransactionIds.length ? selectedTransactionIds.join(", ") : "neuvedeno"),
      "",
      "Připojené transakce:",
      renderTransactionListText(context.transactions),
      "",
      "Poznámka operátora: " + ((record.resolution && record.resolution.resolutionNote) || "neuvedeno")
    ].join("\n");

    return {
      subject: "Interní archiv žádosti — " + context.payload.requestMeta.requestId,
      title: "Interní archivní záznam",
      text: summary,
      html:
        "<article class=\"draft-letter\"><h3>Interní archivní záznam</h3><pre>" +
        escapeHtml(summary) +
        "</pre></article>",
      suggestedFilename: "jhp-archive-" + context.payload.requestMeta.requestId
    };
  }

  window.HristeConfirmations = {
    CONFIG,
    SNAPSHOT_SCHEMA,
    WORKFLOW_STATUSES,
    MANUAL_WORKFLOW_STATUSES,
    formatCurrency,
    formatPlainNumber,
    pluralizeDonors,
    formatDate,
    formatApplicantKind,
    formatRequestKind,
    formatWorkflowStatus,
    getWorkflowStatusMeta,
    escapeHtml,
    joinAddress,
    normalizeText,
    slugifyKey,
    getTokenOverlapScore,
    getStringSimilarity,
    parseAmountLike,
    normalizeDateValue,
    buildRequestId,
    buildRequestPayload,
    validateRequestPayload,
    normalizeRequestPayload,
    buildOperatorChecklist,
    buildReadableSummary,
    buildSummarySections,
    renderSummaryHtml,
    buildMailtoDraft,
    buildConfirmationDraft,
    buildDonorReplyDraft,
    buildFollowupRequestDraft,
    buildInternalArchiveRecord,
    sumTransactionAmounts,
    copyText,
    downloadFile,
    downloadJson,
    buildRequestExportFilename
  };
})();
