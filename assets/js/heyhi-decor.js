(function () {
  function makeRand(seed) {
    return function (index) {
      const x = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453;
      return x - Math.floor(x);
    };
  }

  function cssColor(name) {
    return getComputedStyle(document.documentElement).getPropertyValue("--" + name).trim();
  }

  function clearSvg(svg) {
    while (svg.firstChild) {
      svg.firstChild.remove();
    }
  }

  function buildSquiggle(svg) {
    clearSvg(svg);
    const width = Number(svg.dataset.width) || 800;
    const height = Number(svg.dataset.height) || 40;
    const amplitude = Number(svg.dataset.amplitude) || 12;
    const frequency = Number(svg.dataset.freq) || 4;
    const stroke = Number(svg.dataset.stroke) || 5;
    const color = cssColor(svg.dataset.color || "teal");
    const steps = frequency * 8;
    let pathData = "";

    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    svg.setAttribute("viewBox", "0 0 " + width + " " + height);
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");

    for (let index = 0; index <= steps; index += 1) {
      const progress = index / steps;
      const x = progress * width;
      const y = height / 2 + Math.sin(progress * Math.PI * frequency) * amplitude * (1 + Math.sin(index * 7.3) * 0.15);
      pathData += (index === 0 ? "M" : " L") + x.toFixed(1) + "," + y.toFixed(1);
    }

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", color);
    path.setAttribute("stroke-width", stroke);
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.appendChild(path);
  }

  function buildUnderline(svg) {
    clearSvg(svg);
    const width = Number(svg.dataset.width) || 200;
    const stroke = Number(svg.dataset.stroke) || 4;
    const jitter = Number(svg.dataset.jitter) || 1.5;
    const color = cssColor(svg.dataset.color || "orange");
    const rand = makeRand((width + stroke) * 11);
    const segments = 12;
    let pathData = "";

    svg.setAttribute("width", width);
    svg.setAttribute("height", 20);
    svg.setAttribute("viewBox", "0 0 " + width + " 20");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");

    for (let index = 0; index <= segments; index += 1) {
      const x = (index / segments) * width;
      const y = 8 + Math.sin(index * 1.7) * jitter + (index === 0 || index === segments ? 0 : (rand(index) - 0.5) * 1.5);
      pathData += (index === 0 ? "M" : " L") + x.toFixed(1) + "," + y.toFixed(1);
    }

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", color);
    path.setAttribute("stroke-width", stroke);
    path.setAttribute("stroke-linecap", "round");
    svg.appendChild(path);
  }

  function buildHandFrame(host) {
    const inner = host.firstElementChild;
    if (!inner) {
      return;
    }

    const rect = inner.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    if (!width || !height) {
      return;
    }

    const radius = 18;
    const jitter = 2.5;
    const rand = makeRand(Math.floor((width + height) * 7));
    const points = [];
    const steps = 14;

    for (let index = 0; index <= steps; index += 1) {
      points.push([radius + (index / steps) * (width - 2 * radius), (rand(index * 1.3) - 0.5) * jitter]);
    }
    points.push([width + (rand(99) - 0.5) * jitter, radius]);
    for (let index = 0; index <= steps; index += 1) {
      points.push([width + (rand(index * 2.7) - 0.5) * jitter, radius + (index / steps) * (height - 2 * radius)]);
    }
    for (let index = 0; index <= steps; index += 1) {
      points.push([(width - radius) - (index / steps) * (width - 2 * radius), height + (rand(index * 3.1) - 0.5) * jitter]);
    }
    for (let index = 0; index <= steps; index += 1) {
      points.push([(rand(index * 4.7) - 0.5) * jitter, (height - radius) - (index / steps) * (height - 2 * radius)]);
    }
    points.push(points[0]);

    const pathData = points.map((point, index) => (index === 0 ? "M" : " L") + point[0].toFixed(1) + "," + point[1].toFixed(1)).join("");
    const oldFrame = host.querySelector(":scope > .frame-svg");
    if (oldFrame) {
      oldFrame.remove();
    }

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("frame-svg");
    svg.setAttribute("viewBox", "-5 -5 " + (width + 10) + " " + (height + 10));
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", cssColor("ink"));
    path.setAttribute("stroke-width", 3.5);
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.appendChild(path);
    host.appendChild(svg);
  }

  function buildConfetti(host) {
    host.innerHTML = "";
    const count = Number(host.dataset.count) || 40;
    const seed = Number(host.dataset.seed) || 1;
    const rand = makeRand(seed);
    const parentRect = host.parentElement ? host.parentElement.getBoundingClientRect() : host.getBoundingClientRect();
    const width = Math.max(host.getBoundingClientRect().width, parentRect.width, 320);
    const height = Math.max(host.getBoundingClientRect().height, parentRect.height, 320);
    const palette = ["pink", "blue", "teal", "orange", "red", "purple", "yellow", "green"];

    for (let index = 0; index < count; index += 1) {
      const x = rand(index * 3 + 1) * width;
      const y = rand(index * 3 + 2) * height;
      const color = cssColor(palette[Math.floor(rand(index * 3 + 4) * palette.length)]);
      const rotation = (rand(index * 3 + 5) - 0.5) * 180;
      const shape = Math.floor(rand(index * 5 + 9) * 3);

      if (shape === 2) {
        const size = 5 + rand(index * 7 + 15) * 5;
        const dot = document.createElement("span");
        dot.className = "generated-confetti generated-confetti-dot";
        dot.style.cssText = "left:" + x + "px;top:" + y + "px;width:" + size + "px;height:" + size + "px;background:" + color + ";";
        host.appendChild(dot);
      } else if (shape === 1) {
        const squiggleWidth = 18 + rand(index * 7 + 17) * 10;
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.classList.add("generated-confetti", "generated-confetti-squiggle");
        svg.setAttribute("width", squiggleWidth);
        svg.setAttribute("height", 14);
        svg.setAttribute("viewBox", "0 0 " + squiggleWidth + " 14");
        svg.style.cssText = "left:" + x + "px;top:" + y + "px;transform:rotate(" + rotation + "deg);";
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", "M2,7 Q" + (squiggleWidth * 0.25).toFixed(1) + ",1 " + (squiggleWidth * 0.5).toFixed(1) + ",7 T" + (squiggleWidth - 2).toFixed(1) + ",7");
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", color);
        path.setAttribute("stroke-width", 2.5);
        path.setAttribute("stroke-linecap", "round");
        svg.appendChild(path);
        host.appendChild(svg);
      } else {
        const stripWidth = 8 + rand(index * 7 + 11) * 14;
        const stripHeight = 3 + rand(index * 7 + 13) * 3;
        const strip = document.createElement("span");
        strip.className = "generated-confetti generated-confetti-strip";
        strip.style.cssText = "left:" + x + "px;top:" + y + "px;width:" + stripWidth + "px;height:" + stripHeight + "px;background:" + color + ";transform:rotate(" + rotation + "deg);";
        host.appendChild(strip);
      }
    }
  }

  function initHeyHiDecor() {
    document.querySelectorAll("svg.squiggle").forEach(buildSquiggle);
    document.querySelectorAll("svg.underline-rough").forEach(buildUnderline);
    document.querySelectorAll(".confetti-bg[data-confetti]").forEach(buildConfetti);
    document.querySelectorAll(".hand-frame").forEach(buildHandFrame);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHeyHiDecor);
  } else {
    initHeyHiDecor();
  }

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      document.querySelectorAll(".hand-frame").forEach(buildHandFrame);
    }, 180);
  });
}());
