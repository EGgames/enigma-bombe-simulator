/*
 * UI de la capa "Bombe": crib -> menú/grafo -> búsqueda -> resultados.
 */

(function () {
  const { ALPHABET, buildRotorDial, rotationForPosition, makeLabeledSelect } = UIHelpers;
  const DEFAULT_TYPES = ["I", "II", "III"];

  // Ejemplo precalculado: crib "ANXEINSXKOMMTXSOFORT" cifrado con
  // rotores I,II,III / anillos AAA / posición inicial DFB / reflector B /
  // clavijero AB. La búsqueda con I,II,III + AAA encuentra 2 stops,
  // uno de ellos es DFB con hipótesis "N" (sin clavija para N).
  const EXAMPLE = {
    cipher: "LWHNDVNEJTQNSVZXYNWO",
    plain: "ANXEINSXKOMMTXSOFORT",
  };

  const MAX_RESULT_ROWS = 200;
  const SPIN_STEP_DEG = 45;
  const SPIN_INTERVAL_MS = 35;
  const MIN_SPIN_MS = 700;

  /* ---------- DOM ---------- */

  const cribCipherInput = document.getElementById("crib-cipher");
  const cribPlainInput = document.getElementById("crib-plain");
  const cribExampleBtn = document.getElementById("crib-example-btn");
  const cribMenuBtn = document.getElementById("crib-menu-btn");
  const cribStatus = document.getElementById("crib-status");
  const cribPositionsEl = document.getElementById("crib-positions");

  const rotorConfigEl = document.getElementById("bombe-rotor-config");
  const reflectorSelect = document.getElementById("bombe-reflector-select");
  const searchBtn = document.getElementById("bombe-search-btn");
  const progressFill = document.getElementById("bombe-progress");

  const menuGraphSvg = document.getElementById("menu-graph");
  const menuInfoEl = document.getElementById("menu-info");

  const drumUnits = Array.from(document.querySelectorAll("#bombe-drums .rotor-unit"));

  const resultsEmpty = document.getElementById("bombe-results-empty");
  const resultsTable = document.getElementById("bombe-results-table");
  const resultsBody = resultsTable.querySelector("tbody");

  const diagonalGrid = document.getElementById("diagonal-grid");

  /* ---------- Estado ---------- */

  let currentMenu = null;     // { edges, cipherText, crib }
  let currentTestInfo = null; // { letter, cycles }
  let drumDialState = [];     // [{ ring, textEls, rotation }]
  let spinTimer = null;

  function letters(indices) {
    return indices.map(i => ALPHABET[i]).join("");
  }

  /* ---------- Configuración de rotores a probar ---------- */

  function buildRotorConfigUI() {
    rotorConfigEl.innerHTML = "";
    const titles = ["Izquierdo", "Medio", "Derecho"];
    for (let i = 0; i < 3; i++) {
      const col = document.createElement("div");
      col.className = "rotor-config-col";

      const title = document.createElement("strong");
      title.textContent = titles[i];
      col.appendChild(title);

      col.appendChild(makeLabeledSelect(`bombe-rotor-type-${i}`, "Tipo", ["I", "II", "III", "IV", "V"], DEFAULT_TYPES[i]));
      col.appendChild(makeLabeledSelect(`bombe-rotor-ring-${i}`, "Anillo", ALPHABET.split(""), "A"));

      rotorConfigEl.appendChild(col);
    }
  }

  /* ---------- Tambores (discos animados) ---------- */

  function buildDrums() {
    drumDialState = drumUnits.map(unit => {
      const svgEl = unit.querySelector(".rotor-dial");
      const { ring, textEls } = buildRotorDial(svgEl);
      ring.style.transition = "none";
      ring.style.transform = "rotate(0deg)";
      void ring.getBoundingClientRect();
      ring.style.transition = "";
      return { ring, textEls, rotation: 0 };
    });
  }

  // Devuelve la rotación (continuando en el mismo sentido desde `current`)
  // que deja la letra `position` bajo el puntero.
  function settleRotation(current, position) {
    const base = rotationForPosition(position);
    const k = Math.floor((current - base) / 360);
    return base + k * 360;
  }

  function setDrumLetters(positions, animate = true) {
    drumUnits.forEach((unit, i) => {
      const letterEl = unit.querySelector(".rotor-letter");
      letterEl.textContent = ALPHABET[positions[i]];

      const state = drumDialState[i];
      state.textEls.forEach(el => el.classList.remove("active"));
      state.textEls[positions[i]].classList.add("active");

      if (animate) {
        const target = settleRotation(state.rotation, positions[i]);
        state.ring.style.transition = "";
        state.ring.style.transform = `rotate(${target}deg)`;
        state.rotation = target;
      } else {
        const target = rotationForPosition(positions[i]);
        state.ring.style.transition = "none";
        state.ring.style.transform = `rotate(${target}deg)`;
        void state.ring.getBoundingClientRect();
        state.ring.style.transition = "";
        state.rotation = target;
      }
    });
  }

  function startSpin() {
    stopSpin();
    drumDialState.forEach(state => { state.ring.style.transition = "none"; });
    spinTimer = setInterval(() => {
      drumDialState.forEach(state => {
        state.rotation -= SPIN_STEP_DEG;
        state.ring.style.transform = `rotate(${state.rotation}deg)`;
      });
    }, SPIN_INTERVAL_MS);
  }

  function stopSpin() {
    if (spinTimer) {
      clearInterval(spinTimer);
      spinTimer = null;
    }
  }

  /* ---------- Diagonal board ---------- */

  function buildDiagonalGrid() {
    diagonalGrid.innerHTML = "";

    const corner = document.createElement("div");
    corner.className = "cell header";
    diagonalGrid.appendChild(corner);

    for (let c = 0; c < 26; c++) {
      const h = document.createElement("div");
      h.className = "cell header";
      h.textContent = ALPHABET[c];
      diagonalGrid.appendChild(h);
    }

    for (let r = 0; r < 26; r++) {
      const rowHeader = document.createElement("div");
      rowHeader.className = "cell header";
      rowHeader.textContent = ALPHABET[r];
      diagonalGrid.appendChild(rowHeader);

      for (let c = 0; c < 26; c++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.row = r;
        cell.dataset.col = c;
        diagonalGrid.appendChild(cell);
      }
    }
  }

  function clearDiagonalHighlights() {
    diagonalGrid.querySelectorAll(".cell.active").forEach(c => c.classList.remove("active"));
  }

  function highlightDiagonal(stop) {
    clearDiagonalHighlights();
    for (const h of stop.hypotheses) {
      const cell1 = diagonalGrid.querySelector(`.cell[data-row="${stop.testLetter}"][data-col="${h}"]`);
      const cell2 = diagonalGrid.querySelector(`.cell[data-row="${h}"][data-col="${stop.testLetter}"]`);
      if (cell1) cell1.classList.add("active");
      if (cell2) cell2.classList.add("active");
    }
  }

  /* ---------- Grafo del menú ---------- */

  function renderMenuGraph() {
    const NS = "http://www.w3.org/2000/svg";
    menuGraphSvg.innerHTML = "";

    const cx = 160, cy = 160, R = 135, nodeR = 13;
    const positions = [];
    for (let i = 0; i < 26; i++) {
      const angle = (i * (360 / 26)) * (Math.PI / 180);
      positions.push({ x: cx + R * Math.sin(angle), y: cy - R * Math.cos(angle) });
    }

    const loopEdgeSet = new Set();
    if (currentTestInfo) {
      for (const cyc of currentTestInfo.cycles) {
        for (const e of cyc) loopEdgeSet.add(e);
      }
    }

    const degree = new Array(26).fill(0);
    currentMenu.edges.forEach(edge => {
      degree[edge.plain]++;
      degree[edge.cipher]++;
    });

    // Aristas
    currentMenu.edges.forEach((edge, i) => {
      const p1 = positions[edge.plain];
      const p2 = positions[edge.cipher];
      const dx = p2.x - p1.x, dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy) || 1;
      const offset = 8 + (i % 3) * 10;
      const mx = (p1.x + p2.x) / 2 + (-dy / len) * offset;
      const my = (p1.y + p2.y) / 2 + (dx / len) * offset;

      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`);
      path.setAttribute("class", "menu-edge" + (loopEdgeSet.has(i) ? " loop" : ""));
      menuGraphSvg.appendChild(path);
    });

    // Nodos
    for (let i = 0; i < 26; i++) {
      let cls = "menu-node";
      if (currentTestInfo && currentTestInfo.letter === i) cls += " active";
      if (degree[i] === 0) cls += " isolated";

      const g = document.createElementNS(NS, "g");
      g.setAttribute("class", cls);

      const circle = document.createElementNS(NS, "circle");
      circle.setAttribute("cx", positions[i].x.toFixed(1));
      circle.setAttribute("cy", positions[i].y.toFixed(1));
      circle.setAttribute("r", nodeR);
      g.appendChild(circle);

      const text = document.createElementNS(NS, "text");
      text.setAttribute("x", positions[i].x.toFixed(1));
      text.setAttribute("y", positions[i].y.toFixed(1));
      text.textContent = ALPHABET[i];
      g.appendChild(text);

      menuGraphSvg.appendChild(g);
    }
  }

  function renderMenuInfo() {
    const n = currentMenu.edges.length;
    let html = `<div>Aristas (posiciones del crib): <strong>${n}</strong></div>`;

    if (!currentTestInfo) {
      html += `<div class="status-msg error" style="margin-top:0.6rem">
        El menú no contiene ningún bucle cerrado. La Bombe necesita al menos
        un bucle para poder descartar posiciones — probá con un crib más
        largo o distinto.
      </div>`;
    } else {
      const letter = ALPHABET[currentTestInfo.letter];
      const n = currentTestInfo.cycles.length;
      html += `<div style="margin-top:0.4rem">Letra de prueba: <strong>${letter}</strong> (${n} bucle${n === 1 ? "" : "s"})</div>`;
      html += `<ol class="loop-list">`;
      for (const cyc of currentTestInfo.cycles) {
        const posList = cyc.map(e => currentMenu.edges[e].pos + 1).join(", ");
        html += `<li>Bucle de ${cyc.length} aristas — posiciones: ${posList}</li>`;
      }
      html += `</ol>`;
    }

    menuInfoEl.innerHTML = html;
  }

  /* ---------- Generar menú ---------- */

  // El crib puede ser más corto que el texto cifrado: se lo "desliza" sobre
  // el cifrado ("crib dragging") y se descartan automáticamente las
  // posiciones donde alguna letra coincidiría con sí misma. Si queda más de
  // una posición compatible, se le pide al usuario que elija una.
  function failMenu(message) {
    currentMenu = null;
    currentTestInfo = null;
    cribStatus.textContent = message;
    cribStatus.className = "status-msg error";
    menuGraphSvg.innerHTML = "";
    menuInfoEl.textContent = 'Ingresá un crib válido y hacé click en "Generar menú".';
    searchBtn.disabled = true;
    resetResults();
  }

  function hideCribPositions() {
    cribPositionsEl.innerHTML = "";
    cribPositionsEl.classList.add("hidden");
  }

  function showCribPositions(cipherText, crib, positions, selectedOffset) {
    cribPositionsEl.innerHTML = "";
    cribPositionsEl.classList.remove("hidden");

    positions.forEach(p => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "crib-position-btn" + (p.offset === selectedOffset ? " selected" : "");

      const label = document.createElement("span");
      label.textContent = p.cipherSlice;

      const offset = document.createElement("span");
      offset.className = "crib-position-offset";
      offset.textContent = `letras ${p.offset + 1}–${p.offset + crib.length}`;

      btn.append(label, offset);
      btn.addEventListener("click", () => generateMenu(p.offset));
      cribPositionsEl.appendChild(btn);
    });
  }

  function generateMenu(forcedOffset) {
    let result;
    try {
      result = Bombe.findCribPositions(cribCipherInput.value, cribPlainInput.value);
    } catch (err) {
      failMenu(err.message);
      hideCribPositions();
      return;
    }

    const { cipherText, crib, positions } = result;

    if (positions.length === 0) {
      failMenu("Ninguna posición es compatible: el crib siempre coincide con el cifrado en alguna letra (imposible en Enigma). Probá otro crib.");
      hideCribPositions();
      return;
    }

    if (positions.length > 1 && forcedOffset === undefined) {
      showCribPositions(cipherText, crib, positions);
      currentMenu = null;
      currentTestInfo = null;
      cribStatus.textContent = `El crib encaja en ${positions.length} posiciones posibles del cifrado. Elegí una para generar el menú.`;
      cribStatus.className = "status-msg ok";
      menuGraphSvg.innerHTML = "";
      menuInfoEl.textContent = "Elegí una posición del crib arriba para generar el menú.";
      searchBtn.disabled = true;
      resetResults();
      return;
    }

    const offset = forcedOffset !== undefined ? forcedOffset : positions[0].offset;
    const chosen = positions.find(p => p.offset === offset) || positions[0];

    let menu;
    try {
      menu = Bombe.buildMenu(chosen.cipherSlice, crib);
    } catch (err) {
      failMenu(err.message);
      hideCribPositions();
      return;
    }

    currentMenu = menu;
    currentTestInfo = Bombe.chooseTestLetter(currentMenu.edges, 8);

    if (positions.length > 1) {
      showCribPositions(cipherText, crib, positions, offset);
      cribStatus.textContent = `Menú generado para la posición ${offset + 1}: ${currentMenu.edges.length} aristas.`;
    } else {
      hideCribPositions();
      cribStatus.textContent = `Menú generado: ${currentMenu.edges.length} aristas.`;
    }
    cribStatus.className = "status-msg ok";

    renderMenuGraph();
    renderMenuInfo();

    searchBtn.disabled = !currentTestInfo;
    resetResults();
  }

  /* ---------- Resultados ---------- */

  function resetResults() {
    resultsBody.innerHTML = "";
    resultsTable.classList.add("hidden");
    resultsEmpty.textContent = "Generá un menú e iniciá la búsqueda para ver resultados.";
    resultsEmpty.classList.remove("hidden");
    clearDiagonalHighlights();
    setDrumLetters([0, 0, 0], false);
  }

  function formatHypotheses(stop) {
    return stop.hypotheses.map(h => {
      if (h === stop.testLetter) return `${ALPHABET[h]} (sin clavija)`;
      return `${ALPHABET[stop.testLetter]}↔${ALPHABET[h]}`;
    }).join(", ");
  }

  function showResults(stops) {
    resultsBody.innerHTML = "";

    if (stops.length === 0) {
      resultsTable.classList.add("hidden");
      resultsEmpty.textContent = "Sin resultados: ninguna posición de rotores es consistente con el menú para esta configuración.";
      resultsEmpty.classList.remove("hidden");
      clearDiagonalHighlights();
      setDrumLetters([0, 0, 0]);
      return;
    }

    resultsEmpty.classList.add("hidden");
    resultsTable.classList.remove("hidden");

    const shown = stops.slice(0, MAX_RESULT_ROWS);
    shown.forEach((stop, idx) => {
      const tr = document.createElement("tr");

      const tdOrder = document.createElement("td");
      tdOrder.textContent = stop.rotorTypes.join("-");

      const tdStart = document.createElement("td");
      tdStart.textContent = letters(stop.start);

      const tdLetter = document.createElement("td");
      tdLetter.textContent = ALPHABET[stop.testLetter];

      const tdHyp = document.createElement("td");
      tdHyp.textContent = formatHypotheses(stop);

      const tdAction = document.createElement("td");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "Cargar en Enigma";
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        loadIntoEnigma(stop);
      });
      tdAction.appendChild(btn);

      tr.append(tdOrder, tdStart, tdLetter, tdHyp, tdAction);
      tr.addEventListener("click", () => selectStop(stop, tr));
      resultsBody.appendChild(tr);

      if (idx === 0) selectStop(stop, tr);
    });

    if (stops.length > MAX_RESULT_ROWS) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 5;
      td.style.color = "var(--text-dim)";
      td.textContent = `… y ${stops.length - MAX_RESULT_ROWS} resultados más (${stops.length} en total).`;
      tr.appendChild(td);
      resultsBody.appendChild(tr);
    }
  }

  function selectStop(stop, tr) {
    resultsBody.querySelectorAll("tr.selected").forEach(el => el.classList.remove("selected"));
    tr.classList.add("selected");
    setDrumLetters(stop.start);
    highlightDiagonal(stop);
  }

  function loadIntoEnigma(stop) {
    for (let i = 0; i < 3; i++) {
      document.getElementById(`rotor-type-${i}`).value = stop.rotorTypes[i];
      document.getElementById(`rotor-ring-${i}`).value = ALPHABET[stop.rings[i]];
      document.getElementById(`rotor-pos-${i}`).value = ALPHABET[stop.start[i]];
    }
    document.getElementById("reflector-select").value = stop.reflector;

    const plugInput = document.getElementById("plugboard-input");
    const partner = stop.hypotheses.find(h => h !== stop.testLetter);
    plugInput.value = partner !== undefined ? ALPHABET[stop.testLetter] + ALPHABET[partner] : "";

    window.AppEnigma.reinit();
    window.AppTabs.showView("enigma-view");
  }

  /* ---------- Búsqueda ---------- */

  function readSearchConfig() {
    const rotorTypes = [0, 1, 2].map(i => document.getElementById(`bombe-rotor-type-${i}`).value);
    const rings = [0, 1, 2].map(i => ALPHABET.indexOf(document.getElementById(`bombe-rotor-ring-${i}`).value));
    const reflector = reflectorSelect.value;
    return {
      rotorTypes, rings, reflector,
      edges: currentMenu.edges,
      testLetter: currentTestInfo.letter,
      cycles: currentTestInfo.cycles,
    };
  }

  function runSearchOne(cfg, onDone) {
    progressFill.style.width = "0%";
    setTimeout(() => {
      const stops = Bombe.searchRotorOrder(cfg);
      progressFill.style.width = "100%";
      onDone(stops);
    }, 0);
  }

  function runSearchAll(cfg, onDone) {
    const orders = Bombe.allRotorOrders();
    let idx = 0;
    let allStops = [];
    progressFill.style.width = "0%";

    function step() {
      if (idx >= orders.length) {
        onDone(allStops);
        return;
      }
      const stops = Bombe.searchRotorOrder({ ...cfg, rotorTypes: orders[idx] });
      allStops = allStops.concat(stops);
      idx++;
      progressFill.style.width = `${Math.round((idx / orders.length) * 100)}%`;
      setTimeout(step, 0);
    }
    step();
  }

  searchBtn.addEventListener("click", () => {
    if (!currentMenu || !currentTestInfo) return;

    const cfg = readSearchConfig();
    const mode = document.querySelector('input[name="bombe-search-mode"]:checked').value;

    searchBtn.disabled = true;
    startSpin();
    const startTime = Date.now();

    const finish = (stops) => {
      const wait = Math.max(0, MIN_SPIN_MS - (Date.now() - startTime));
      setTimeout(() => {
        stopSpin();
        showResults(stops.sort((a, b) => a.rotorTypes.join("").localeCompare(b.rotorTypes.join("")) || a.start.join(",").localeCompare(b.start.join(","))));
        searchBtn.disabled = false;
      }, wait);
    };

    if (mode === "all") {
      runSearchAll(cfg, finish);
    } else {
      runSearchOne(cfg, finish);
    }
  });

  /* ---------- Entrada de crib ---------- */

  [cribCipherInput, cribPlainInput].forEach(input => {
    input.addEventListener("input", () => {
      const cleaned = input.value.toUpperCase().replace(/[^A-Z]/g, "");
      if (cleaned !== input.value) input.value = cleaned;
    });
  });

  cribMenuBtn.addEventListener("click", () => generateMenu());

  cribExampleBtn.addEventListener("click", () => {
    cribCipherInput.value = EXAMPLE.cipher;
    cribPlainInput.value = EXAMPLE.plain;
    generateMenu();
  });

  /* ---------- Inicio ---------- */

  buildRotorConfigUI();
  buildDrums();
  buildDiagonalGrid();
  resetResults();
})();
