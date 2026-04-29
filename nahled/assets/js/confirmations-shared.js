(function () {
  const CONFIG = {
    collectedAmountCzk: 0,
    donorCount: 0,
    targetAmountCzk: 2000000,
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

  const createTemplates = window.HristeConfirmationsTemplates;

  if (typeof createTemplates !== "function") {
    throw new Error("Missing confirmations templates module.");
  }

  const templateExports = createTemplates({
    CONFIG,
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
    normalizeWhitespace
  });

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
    copyText,
    downloadFile,
    downloadJson,
    ...templateExports
  };
})();
