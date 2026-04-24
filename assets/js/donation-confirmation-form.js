const shared = window.HristeConfirmations;
const { CONFIG } = shared;

const els = {
  form: document.querySelector("#confirmation-form"),
  formSuccess: document.querySelector("#form-success"),
  mailtoLink: document.querySelector("#mailto-link"),
  copySummaryButton: document.querySelector("#copy-summary-button"),
  downloadJsonButton: document.querySelector("#download-json-button"),
  copyFeedback: document.querySelector("#copy-feedback"),
  requestOutput: document.querySelector("#request-output"),
  requestSummary: document.querySelector("#request-summary"),
  operatorChecklist: document.querySelector("#operator-checklist"),
  requestPayload: document.querySelector("#request-payload"),
  applicantKindInputs: Array.from(document.querySelectorAll('input[name="applicantKind"]')),
  requestKindInputs: Array.from(document.querySelectorAll('input[name="requestKind"]')),
  applicantConditionalBlocks: Array.from(document.querySelectorAll("[data-applicant-only]")),
  requestConditionalBlocks: Array.from(document.querySelectorAll("[data-request-only]")),
  identityHeading: document.querySelector("#identity-heading"),
  requestHeading: document.querySelector("#request-heading"),
  requestModeHint: document.querySelector("#request-mode-hint"),
  payerAccountNameLabel: document.querySelector("#payer-account-name-label"),
  annualCalendarYear: document.querySelector("#annual-calendar-year"),
  gdprPolicyLink: document.querySelector("#gdpr-policy-link-form"),
  transparentAccountLink: document.querySelector("#transparent-account-link-form")
};

let latestRequestBundle = null;

function applyHref(element, href) {
  if (element) {
    element.href = href;
  }
}

function getCheckedValue(inputs) {
  const checked = inputs.find((input) => input.checked);
  return checked ? checked.value : "";
}

function getApplicantKind() {
  return getCheckedValue(els.applicantKindInputs) || "person";
}

function getRequestKind() {
  return getCheckedValue(els.requestKindInputs) || "single";
}

function toggleConditionalBlocks(blocks, activeValue, datasetKey) {
  blocks.forEach((block) => {
    const isActive = block.dataset[datasetKey] === activeValue;
    block.classList.toggle("is-hidden", !isActive);

    block.querySelectorAll("input, textarea, select").forEach((field) => {
      const requiredWhenVisible = field.dataset.requiredWhenVisible === "true";
      field.disabled = !isActive;
      field.required = isActive && requiredWhenVisible;
    });
  });
}

function clearRequestOutput() {
  latestRequestBundle = null;
  els.formSuccess.textContent = "";
  els.copyFeedback.textContent = "";
  els.mailtoLink.classList.add("is-hidden");
  els.copySummaryButton.classList.add("is-hidden");
  els.downloadJsonButton.classList.add("is-hidden");
  els.requestOutput.classList.add("is-hidden");
  els.requestSummary.innerHTML = "";
  els.operatorChecklist.innerHTML = "";
  els.requestPayload.textContent = "";
}

function syncFormMode() {
  const applicantKind = getApplicantKind();
  const requestKind = getRequestKind();

  toggleConditionalBlocks(els.applicantConditionalBlocks, applicantKind, "applicantOnly");
  toggleConditionalBlocks(els.requestConditionalBlocks, requestKind, "requestOnly");

  els.identityHeading.textContent =
    applicantKind === "person" ? "Údaje dárce" : "Údaje organizace";
  els.payerAccountNameLabel.innerHTML =
    applicantKind === "person"
      ? "Jméno plátce na účtu, pokud se liší od dárce <span class=\"field-optional\">nepovinné</span>"
      : "Jméno plátce na účtu, pokud se liší od názvu organizace <span class=\"field-optional\">nepovinné</span>";

  if (requestKind === "single") {
    els.requestHeading.textContent = "Údaje k jednotlivému daru";
    els.requestModeHint.textContent =
      "Vyplňte částku a přibližné datum platby. VS, zpráva pro příjemce nebo jméno plátce mohou pomoci s ověřením daru.";
  } else {
    els.requestHeading.textContent = "Žádost o roční souhrn";
    els.requestModeHint.textContent =
      "Stačí uvést kalendářní rok. Jednotlivé částky není nutné vypisovat, pokud je spolek bude umět dohledat podle účtu a dalších údajů.";
  }
}

function renderOperatorChecklist(items) {
  els.operatorChecklist.innerHTML = items
    .map((item) => "<li>" + shared.escapeHtml(item) + "</li>")
    .join("");
}

function handleForm() {
  els.form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!els.form.reportValidity()) {
      clearRequestOutput();
      els.formSuccess.textContent = "Prosím doplňte všechna povinná pole formuláře.";
      return;
    }

    const formData = new FormData(els.form);
    const payload = shared.buildRequestPayload(formData);
    const readableSummary = shared.buildReadableSummary(payload);
    const mailDraft = shared.buildMailtoDraft(payload);
    const operatorChecklist = shared.buildOperatorChecklist(payload);
    const mailtoHref =
      "mailto:" +
      CONFIG.contactEmail +
      "?subject=" +
      encodeURIComponent(mailDraft.subject) +
      "&body=" +
      encodeURIComponent(mailDraft.body);

    latestRequestBundle = {
      payload,
      readableSummary,
      mailDraft,
      operatorChecklist
    };

    els.mailtoLink.href = mailtoHref;
    els.mailtoLink.classList.remove("is-hidden");
    els.copySummaryButton.classList.remove("is-hidden");
    els.downloadJsonButton.classList.remove("is-hidden");
    els.requestOutput.classList.remove("is-hidden");
    els.requestSummary.innerHTML = shared.renderSummaryHtml(payload);
    renderOperatorChecklist(operatorChecklist);
    els.requestPayload.textContent = JSON.stringify(payload, null, 2);
    els.copyFeedback.textContent = "";
    els.formSuccess.textContent =
      "Žádost je připravena. Potvrzení vystavíme až po ověření přijetí daru na transparentním účtu.";
  });

  els.copySummaryButton.addEventListener("click", async () => {
    if (!latestRequestBundle) {
      return;
    }

    try {
      await shared.copyText(latestRequestBundle.readableSummary);
      els.copyFeedback.textContent = "Souhrn žádosti byl zkopírován.";
    } catch (_error) {
      els.copyFeedback.textContent =
        "Souhrn se nepodařilo zkopírovat automaticky. Použijte prosím předvyplněný e-mail.";
    }
  });

  els.downloadJsonButton.addEventListener("click", () => {
    if (!latestRequestBundle) {
      return;
    }

    shared.downloadJson(
      shared.buildRequestExportFilename(latestRequestBundle.payload),
      latestRequestBundle.payload
    );
    els.copyFeedback.textContent = "Data žádosti byla stažena pro ruční zpracování.";
  });

  els.form.addEventListener("input", clearRequestOutput);
  els.form.addEventListener("change", clearRequestOutput);
  els.applicantKindInputs.forEach((input) => input.addEventListener("change", syncFormMode));
  els.requestKindInputs.forEach((input) => input.addEventListener("change", syncFormMode));
}

document.addEventListener("DOMContentLoaded", () => {
  if (!els.form) {
    return;
  }

  applyHref(els.gdprPolicyLink, CONFIG.privacyUrl);
  applyHref(els.transparentAccountLink, CONFIG.transparentAccountInfoUrl);

  const currentYear = new Date().getFullYear();
  els.annualCalendarYear.min = "2026";
  els.annualCalendarYear.max = String(currentYear);
  els.annualCalendarYear.placeholder = String(currentYear);
  if (!els.annualCalendarYear.value) {
    els.annualCalendarYear.value = String(currentYear);
  }

  syncFormMode();
  handleForm();
});
