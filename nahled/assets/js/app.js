const shared = window.HristeConfirmations;
const { CONFIG } = shared;

const els = {
  heroPlanImage: document.querySelector("#hero-plan-image"),
  accountNumber: document.querySelector("#account-number"),
  accountIban: document.querySelector("#account-iban"),
  bankName: document.querySelector("#bank-name"),
  targetAmount: document.querySelector("#cil-amount"),
  collectedAmount: document.querySelector("#vybrano-amount"),
  remainingAmount: document.querySelector("#remaining-amount"),
  remainingLabel: document.querySelector("#remaining-label"),
  progressTrack: document.querySelector(".progress-track"),
  progressPercentGroup: document.querySelector("#progress-percent-group"),
  donorCountGroup: document.querySelector("#donor-count-group"),
  progressPercent: document.querySelector("#progress-percent"),
  progressPercentLabel: document.querySelector("#progress-percent-label"),
  donorCount: document.querySelector("#donor-count"),
  donorCountLabel: document.querySelector("#donor-count-label"),
  progressBar: document.querySelector("#progress-bar"),
  qrCode: document.querySelector("#qr-code"),
  qrSummary: document.querySelector("#qr-summary"),
  accountNotice: document.querySelector("#account-notice"),
  customAmountInput: document.querySelector("#custom-amount-input"),
  amountButtons: Array.from(document.querySelectorAll(".amount-button")),
  footerTransparentLink: document.querySelector("#transparent-account-link"),
  gdprPolicyLinks: Array.from(
    document.querySelectorAll(
      "#gdpr-policy-link-payment, #gdpr-policy-link-footer"
    )
  ),
  transparentAccountPrivacyLinks: Array.from(
    document.querySelectorAll(
      "#transparent-account-privacy-link, #gdpr-transparent-account-link-footer"
    )
  )
};

let selectedAmount = CONFIG.defaultQrAmount;

function hasConfiguredAccount() {
  const normalizedIban = CONFIG.iban.replace(/\s+/g, "");
  return /^CZ\d{22}$/.test(normalizedIban);
}

function applyHref(element, href) {
  if (!element) {
    return;
  }

  element.href = href;
}

function buildSpdString(amount) {
  return [
    "SPD*1.0",
    "ACC:" + CONFIG.iban.replace(/\s+/g, ""),
    "AM:" + amount,
    "CC:CZK",
    "MSG:" + CONFIG.qrMessage,
    "RN:" + CONFIG.qrRecipient
  ].join("*");
}

const QR_VERSION = 6;
const QR_SIZE = QR_VERSION * 4 + 17;
const QR_DATA_CODEWORDS = 108;
const QR_BLOCK_COUNT = 4;
const QR_DATA_CODEWORDS_PER_BLOCK = 27;
const QR_ECC_CODEWORDS_PER_BLOCK = 16;

function appendBits(buffer, value, bitCount) {
  for (let index = bitCount - 1; index >= 0; index -= 1) {
    buffer.push((value >>> index) & 1);
  }
}

function getUtf8Bytes(text) {
  if (window.TextEncoder) {
    return Array.from(new TextEncoder().encode(text));
  }

  return Array.from(String(text)).map((character) => character.charCodeAt(0) & 0xff);
}

function buildQrDataCodewords(text) {
  const bytes = getUtf8Bytes(text);
  const capacityBits = QR_DATA_CODEWORDS * 8;
  const bits = [];

  if (bytes.length > 106) {
    throw new Error("Platební QR data jsou pro lokální QR generátor příliš dlouhá.");
  }

  appendBits(bits, 0x4, 4);
  appendBits(bits, bytes.length, 8);
  bytes.forEach((byte) => appendBits(bits, byte, 8));
  appendBits(bits, 0, Math.min(4, capacityBits - bits.length));

  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  let padByte = 0xec;
  while (bits.length < capacityBits) {
    appendBits(bits, padByte, 8);
    padByte = padByte === 0xec ? 0x11 : 0xec;
  }

  const codewords = [];
  for (let index = 0; index < bits.length; index += 8) {
    codewords.push(bits.slice(index, index + 8).reduce((value, bit) => (value << 1) | bit, 0));
  }

  return codewords;
}

function reedSolomonMultiply(left, right) {
  let result = 0;
  let x = left;
  let y = right;

  while (y > 0) {
    if (y & 1) {
      result ^= x;
    }
    y >>>= 1;
    x <<= 1;
    if (x & 0x100) {
      x ^= 0x11d;
    }
  }

  return result;
}

function reedSolomonDivisor(degree) {
  const result = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;

  for (let index = 0; index < degree; index += 1) {
    for (let coefficient = 0; coefficient < degree; coefficient += 1) {
      result[coefficient] = reedSolomonMultiply(result[coefficient], root);
      if (coefficient + 1 < degree) {
        result[coefficient] ^= result[coefficient + 1];
      }
    }
    root = reedSolomonMultiply(root, 0x02);
  }

  return result;
}

function reedSolomonRemainder(data, divisor) {
  const result = new Array(divisor.length).fill(0);

  data.forEach((byte) => {
    const factor = byte ^ result.shift();
    result.push(0);
    divisor.forEach((coefficient, index) => {
      result[index] ^= reedSolomonMultiply(coefficient, factor);
    });
  });

  return result;
}

function addQrErrorCorrection(dataCodewords) {
  const divisor = reedSolomonDivisor(QR_ECC_CODEWORDS_PER_BLOCK);
  const blocks = [];

  for (let blockIndex = 0; blockIndex < QR_BLOCK_COUNT; blockIndex += 1) {
    const start = blockIndex * QR_DATA_CODEWORDS_PER_BLOCK;
    const data = dataCodewords.slice(start, start + QR_DATA_CODEWORDS_PER_BLOCK);
    blocks.push({
      data,
      ecc: reedSolomonRemainder(data, divisor)
    });
  }

  const result = [];
  for (let index = 0; index < QR_DATA_CODEWORDS_PER_BLOCK; index += 1) {
    blocks.forEach((block) => result.push(block.data[index]));
  }
  for (let index = 0; index < QR_ECC_CODEWORDS_PER_BLOCK; index += 1) {
    blocks.forEach((block) => result.push(block.ecc[index]));
  }

  return result;
}

function createQrMatrix() {
  return {
    modules: Array.from({ length: QR_SIZE }, () => new Array(QR_SIZE).fill(false)),
    functionModules: Array.from({ length: QR_SIZE }, () => new Array(QR_SIZE).fill(false))
  };
}

function setQrFunctionModule(matrix, x, y, isDark) {
  matrix.modules[y][x] = isDark;
  matrix.functionModules[y][x] = true;
}

function drawFinderPattern(matrix, centerX, centerY) {
  for (let dy = -4; dy <= 4; dy += 1) {
    for (let dx = -4; dx <= 4; dx += 1) {
      const x = centerX + dx;
      const y = centerY + dy;

      if (x < 0 || x >= QR_SIZE || y < 0 || y >= QR_SIZE) {
        continue;
      }

      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      setQrFunctionModule(matrix, x, y, distance !== 2 && distance !== 4);
    }
  }
}

function drawAlignmentPattern(matrix, centerX, centerY) {
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      setQrFunctionModule(matrix, centerX + dx, centerY + dy, distance === 2 || distance === 0);
    }
  }
}

function getQrFormatBits(maskPattern) {
  const errorCorrectionFormatBits = 0;
  const data = (errorCorrectionFormatBits << 3) | maskPattern;
  let remainder = data;

  for (let index = 0; index < 10; index += 1) {
    remainder = (remainder << 1) ^ (((remainder >>> 9) & 1) ? 0x537 : 0);
  }

  return ((data << 10) | remainder) ^ 0x5412;
}

function drawFormatBits(matrix, maskPattern) {
  const bits = getQrFormatBits(maskPattern);
  const getBit = (index) => ((bits >>> index) & 1) !== 0;

  for (let index = 0; index <= 5; index += 1) {
    setQrFunctionModule(matrix, 8, index, getBit(index));
  }
  setQrFunctionModule(matrix, 8, 7, getBit(6));
  setQrFunctionModule(matrix, 8, 8, getBit(7));
  setQrFunctionModule(matrix, 7, 8, getBit(8));

  for (let index = 9; index < 15; index += 1) {
    setQrFunctionModule(matrix, 14 - index, 8, getBit(index));
  }

  for (let index = 0; index < 8; index += 1) {
    setQrFunctionModule(matrix, QR_SIZE - 1 - index, 8, getBit(index));
  }

  for (let index = 8; index < 15; index += 1) {
    setQrFunctionModule(matrix, 8, QR_SIZE - 15 + index, getBit(index));
  }

  setQrFunctionModule(matrix, 8, QR_SIZE - 8, true);
}

function drawQrFunctionPatterns(matrix) {
  drawFinderPattern(matrix, 3, 3);
  drawFinderPattern(matrix, QR_SIZE - 4, 3);
  drawFinderPattern(matrix, 3, QR_SIZE - 4);
  drawAlignmentPattern(matrix, 34, 34);

  for (let index = 0; index < QR_SIZE; index += 1) {
    if (!matrix.functionModules[6][index]) {
      setQrFunctionModule(matrix, index, 6, index % 2 === 0);
    }
    if (!matrix.functionModules[index][6]) {
      setQrFunctionModule(matrix, 6, index, index % 2 === 0);
    }
  }

  drawFormatBits(matrix, 0);
}

function drawQrCodewords(matrix, codewords) {
  let bitIndex = 0;
  let upward = true;

  for (let right = QR_SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) {
      right -= 1;
    }

    for (let vertical = 0; vertical < QR_SIZE; vertical += 1) {
      const y = upward ? QR_SIZE - 1 - vertical : vertical;

      for (let column = 0; column < 2; column += 1) {
        const x = right - column;

        if (matrix.functionModules[y][x]) {
          continue;
        }

        const bit =
          bitIndex < codewords.length * 8
            ? (codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1
            : 0;
        matrix.modules[y][x] = Boolean(bit);
        bitIndex += 1;
      }
    }

    upward = !upward;
  }
}

function applyQrMask(matrix) {
  for (let y = 0; y < QR_SIZE; y += 1) {
    for (let x = 0; x < QR_SIZE; x += 1) {
      if (!matrix.functionModules[y][x] && (x + y) % 2 === 0) {
        matrix.modules[y][x] = !matrix.modules[y][x];
      }
    }
  }
}

function buildQrSvg(text) {
  const matrix = createQrMatrix();
  const dataCodewords = buildQrDataCodewords(text);
  const codewords = addQrErrorCorrection(dataCodewords);
  const border = 4;
  const viewBoxSize = QR_SIZE + border * 2;
  const path = [];

  drawQrFunctionPatterns(matrix);
  drawQrCodewords(matrix, codewords);
  applyQrMask(matrix);
  drawFormatBits(matrix, 0);

  matrix.modules.forEach((row, y) => {
    row.forEach((isDark, x) => {
      if (isDark) {
        path.push("M" + (x + border) + " " + (y + border) + "h1v1h-1z");
      }
    });
  });

  return (
    "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 " +
    viewBoxSize +
    " " +
    viewBoxSize +
    "\" width=\"200\" height=\"200\" role=\"img\" aria-label=\"QR kód pro bankovní platbu\">" +
    "<rect width=\"100%\" height=\"100%\" fill=\"#ffffff\"/>" +
    "<path fill=\"#1F1A17\" d=\"" +
    path.join("") +
    "\"/></svg>"
  );
}

function buildFallbackImage() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 960">
      <defs>
        <linearGradient id="paper" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#faf7f0"/>
          <stop offset="100%" stop-color="#f0eadf"/>
        </linearGradient>
        <linearGradient id="slope" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#5b8746"/>
          <stop offset="100%" stop-color="#3f6b2e"/>
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="160%" height="160%">
          <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#1a1e18" flood-opacity="0.08"/>
        </filter>
      </defs>
      <rect width="1080" height="960" rx="42" fill="url(#paper)"/>
      <g filter="url(#shadow)">
        <rect x="70" y="64" width="940" height="760" rx="36" fill="#f9f7f1" stroke="#e6dfd2" stroke-width="6"/>
        <text x="540" y="110" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="800" fill="#2a3327">Referenční obrázek hřiště</text>
        <text x="540" y="142" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#5a6057">ne finální návrh konkrétního místa</text>
        <path d="M150 188 C210 152 852 148 920 182 L920 278 L150 278 Z" fill="url(#slope)"/>
        <text x="535" y="236" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#f7f9f3">Lesní svah Palmoveckého kopce</text>
        <rect x="170" y="280" width="730" height="418" fill="#dff0cc" stroke="#87a86c" stroke-width="5"/>
        <rect x="132" y="296" width="36" height="320" rx="12" fill="#f1eee8" stroke="#d5cec1" stroke-width="3"/>
        <rect x="902" y="306" width="44" height="286" rx="12" fill="#f1eee8" stroke="#d5cec1" stroke-width="3"/>
        <rect x="212" y="330" width="132" height="122" rx="18" fill="#efd9a9" stroke="#d4be8b" stroke-width="3"/>
        <text x="278" y="377" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="#5a5a46">Pískoviště</text>
        <text x="278" y="402" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" fill="#6d715f">s přístřeškem</text>
        <rect x="398" y="318" width="256" height="184" rx="24" fill="#f4e5b6" stroke="#d5c588" stroke-width="3"/>
        <text x="526" y="308" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="#55594c">Dominantní herní komplex</text>
        <rect x="432" y="350" width="62" height="56" rx="10" fill="#dfa66d"/>
        <rect x="512" y="350" width="62" height="56" rx="10" fill="#dfa66d"/>
        <rect x="594" y="350" width="48" height="54" rx="10" fill="#aecb80"/>
        <rect x="500" y="430" width="72" height="40" rx="8" fill="#b8c7d3"/>
        <path d="M464 405 L525 452" stroke="#af6f4c" stroke-width="4" stroke-linecap="round"/>
        <rect x="720" y="318" width="126" height="172" rx="20" fill="#f2dfb1" stroke="#d5c588" stroke-width="3"/>
        <text x="783" y="306" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="#55594c">Houpačky</text>
        <path d="M770 350 V438" stroke="#688698" stroke-width="5" stroke-linecap="round"/>
        <path d="M812 350 V438" stroke="#688698" stroke-width="5" stroke-linecap="round"/>
        <path d="M770 350 Q791 320 812 350" stroke="#688698" stroke-width="5" fill="none" stroke-linecap="round"/>
        <circle cx="791" cy="424" r="20" fill="none" stroke="#688698" stroke-width="5"/>
        <rect x="380" y="520" width="288" height="148" rx="30" fill="#d9ebbf" stroke="#7da05f" stroke-width="4" stroke-dasharray="12 10"/>
        <text x="524" y="593" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#6d7e61">Volná travnatá plocha</text>
        <circle cx="230" cy="510" r="22" fill="#f3c486"/>
        <circle cx="208" cy="555" r="22" fill="#f3c486"/>
        <circle cx="222" cy="636" r="46" fill="#8aa969"/>
        <circle cx="222" cy="636" r="18" fill="#5d7d48"/>
        <text x="222" y="705" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#5b664f">Zachovaný strom</text>
        <rect x="756" y="556" width="74" height="56" rx="12" fill="#f6d1a2"/>
        <rect x="786" y="640" width="116" height="50" rx="12" fill="#c19a67"/>
        <text x="844" y="704" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#5b664f">Stůl + lavice</text>
        <rect x="180" y="716" width="716" height="46" rx="14" fill="#e9e4d9"/>
        <text x="540" y="745" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#877e70">Ulice U Pošty / V Mezihoří</text>
      </g>
      <g transform="translate(158 848)" font-family="Arial, sans-serif" font-size="13" fill="#63705b">
        <circle cx="8" cy="0" r="7" fill="#dff0cc"/>
        <text x="22" y="5">Tráva</text>
        <circle cx="98" cy="0" r="7" fill="#efd9a9"/>
        <text x="112" y="5">Písek</text>
        <circle cx="184" cy="0" r="7" fill="#8aa969"/>
        <text x="198" y="5">Zachovaný strom</text>
        <rect x="336" y="-8" width="14" height="14" rx="3" fill="#c19a67"/>
        <text x="358" y="5">Mobiliář</text>
        <rect x="446" y="-8" width="14" height="14" rx="3" fill="#e9e4d9"/>
        <text x="468" y="5">Vstupní hrana</text>
      </g>
    </svg>
  `;

  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

function applyImageFallback(img) {
  if (!img) {
    return;
  }

  const replaceWithFallback = () => {
    img.src = buildFallbackImage();
  };

  img.addEventListener("error", replaceWithFallback);

  if (img.complete && img.naturalWidth === 0) {
    replaceWithFallback();
  }
}

function setStaticContent() {
  const progressRatio = Math.min(
    Math.max(CONFIG.collectedAmountCzk / CONFIG.targetAmountCzk, 0),
    1
  );
  const progressPercent = Math.round(progressRatio * 1000) / 10;
  const remaining = Math.max(CONFIG.targetAmountCzk - CONFIG.collectedAmountCzk, 0);
  const isZeroState = CONFIG.collectedAmountCzk === 0;

  els.accountNumber.textContent = CONFIG.accountNumber;
  els.accountIban.textContent = CONFIG.iban;
  els.bankName.textContent = CONFIG.bankName;
  els.targetAmount.textContent = "Cíl: " + shared.formatCurrency(CONFIG.targetAmountCzk);
  els.footerTransparentLink.textContent = "Transparentní účet u ČSOB";
  els.footerTransparentLink.href = CONFIG.transparentAccountUrl;
  els.footerTransparentLink.removeAttribute("aria-disabled");

  document.querySelector("#fundraising-progress").classList.toggle("is-zero-state", isZeroState);
  els.progressTrack.hidden = isZeroState;
  els.progressPercent.hidden = isZeroState;
  els.donorCount.hidden = isZeroState;
  els.progressPercentGroup.hidden = isZeroState;
  els.donorCountGroup.hidden = isZeroState;

  if (isZeroState) {
    els.collectedAmount.textContent =
      "Sbírka startuje 15. 5. 2026. Aktuální stav budeme zveřejňovat v týdenním rytmu.";
    els.progressPercent.textContent = "Po prvních příspěvcích";
    els.progressPercentLabel.textContent = "";
    els.donorCount.textContent = "Stav aktualizujeme ručně";
    els.donorCountLabel.textContent = "";
    els.remainingLabel.textContent = "Cíl sbírky: ";
    els.remainingAmount.textContent = shared.formatCurrency(CONFIG.targetAmountCzk);
  } else {
    els.collectedAmount.textContent = shared.formatCurrency(CONFIG.collectedAmountCzk);
    els.remainingAmount.textContent = shared.formatCurrency(remaining);
    els.progressPercent.textContent = shared.formatPlainNumber(progressPercent) + " %";
    els.progressPercentLabel.textContent = "cílové částky";
    els.donorCount.textContent = shared.pluralizeDonors(CONFIG.donorCount);
    els.donorCountLabel.textContent = "";
    els.remainingLabel.textContent = "Zbývá vybrat: ";
  }

  els.gdprPolicyLinks.forEach((link) => {
    applyHref(link, CONFIG.privacyUrl);
  });
  els.transparentAccountPrivacyLinks.forEach((link) => {
    applyHref(link, CONFIG.transparentAccountInfoUrl);
  });

  const animateProgress = () => {
    requestAnimationFrame(() => {
      els.progressBar.style.width = progressRatio * 100 + "%";
    });
  };

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateProgress();
          observer.disconnect();
        }
      });
    }, { threshold: 0.35 });

    observer.observe(document.querySelector("#fundraising-progress"));
  } else {
    animateProgress();
  }
}

function setActiveAmountButton(amount) {
  els.amountButtons.forEach((button) => {
    button.classList.toggle("is-active", Number(button.dataset.amount) === amount);
  });
}

function renderQrCode() {
  const amount = Math.max(Number(selectedAmount) || CONFIG.defaultQrAmount, 1);
  const spd = buildSpdString(amount);

  els.qrCode.innerHTML = "";

  try {
    els.qrCode.innerHTML = buildQrSvg(spd);
  } catch (_error) {
    els.qrCode.textContent = "QR kód se nepodařilo připravit.";
    els.qrSummary.textContent = "Pro dar ve výši " + shared.formatCurrency(amount) + ".";
    els.accountNotice.textContent = "Použijte prosím údaje transparentního účtu uvedené vedle QR kódu.";
    return;
  }

  els.qrSummary.textContent = "QR kód pro dar ve výši " + shared.formatCurrency(amount) + ".";
  els.accountNotice.textContent = hasConfiguredAccount()
    ? "QR platba se generuje lokálně v prohlížeči a obsahuje IBAN transparentního účtu."
    : "Zkontrolujte prosím nastavení IBAN účtu.";
}

function handleDonationPicker() {
  els.amountButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const amount = Number(button.dataset.amount);

      if (!amount) {
        return;
      }

      selectedAmount = amount;
      els.customAmountInput.value = "";
      setActiveAmountButton(amount);
      renderQrCode();
    });
  });

  els.customAmountInput.addEventListener("input", () => {
    const customAmount = Number(els.customAmountInput.value);

    if (!customAmount || customAmount < 1) {
      return;
    }

    selectedAmount = customAmount;
    els.amountButtons.forEach((button) => button.classList.remove("is-active"));
    renderQrCode();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  applyImageFallback(els.heroPlanImage);
  setStaticContent();
  setActiveAmountButton(CONFIG.defaultQrAmount);
  handleDonationPicker();
  renderQrCode();
});
