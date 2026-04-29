(function () {
  function createConfirmationTemplates(shared) {
    const {
      CONFIG,
      formatCurrency,
      formatDate,
      formatApplicantKind,
      formatRequestKind,
      formatWorkflowStatus,
      escapeHtml,
      joinAddress,
      normalizeWhitespace
    } = shared;

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


  return {
    buildOperatorChecklist,
    buildReadableSummary,
    buildSummarySections,
    renderSummaryHtml,
    buildMailtoDraft,
    buildRequestExportFilename,
    sumTransactionAmounts,
    buildConfirmationDraft,
    buildDonorReplyDraft,
    buildFollowupRequestDraft,
    buildInternalArchiveRecord
  };
}

  window.HristeConfirmationsTemplates = createConfirmationTemplates;
})();
