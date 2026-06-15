/*
 * Conecta el motor Enigma (enigma.js) con la GUI:
 * - construye los discos de los rotores (SVG) y los anima en tiempo real
 * - construye teclado y lámparas
 * - maneja la configuración (tipos de rotor, anillos, posiciones, reflector, clavijero)
 */

(function () {
  const A = 65;
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const STEP_DEG = UIHelpers.STEP_DEG;
  const { buildRotorDial, makeLabeledSelect, rotationForPosition } = UIHelpers;

  // Distribución de teclado real de la Enigma (QWERTZ)
  const KEY_ROWS = ["QWERTZUIOP", "ASDFGHJKL", "YXCVBNM"];

  const rotorConfigEl = document.getElementById("rotor-config");
  const reflectorSelect = document.getElementById("reflector-select");
  const plugboardInput = document.getElementById("plugboard-input");
  const resetBtn = document.getElementById("reset-btn");
  const plainText = document.getElementById("plain-text");
  const cipherText = document.getElementById("cipher-text");

  const lampboardEl = document.querySelector(".lampboard");
  const keyboardEl = document.querySelector(".keyboard");
  const rotorUnits = Array.from(document.querySelectorAll("#enigma-view .rotor-unit"));

  const DEFAULT_TYPES = ["I", "II", "III"];

  let enigma = null;
  let dialState = []; // por rotor: { ring, textEls, rotation }
  let lampTimeout = null;

  /* ---------- Construcción de UI de configuración ---------- */

  function buildRotorConfigUI() {
    rotorConfigEl.innerHTML = "";
    const titles = ["Izquierdo", "Medio", "Derecho"];
    for (let i = 0; i < 3; i++) {
      const col = document.createElement("div");
      col.className = "rotor-config-col";

      const title = document.createElement("strong");
      title.textContent = titles[i];
      col.appendChild(title);

      col.appendChild(makeLabeledSelect(`rotor-type-${i}`, "Tipo", ["I", "II", "III", "IV", "V"], DEFAULT_TYPES[i]));
      col.appendChild(makeLabeledSelect(`rotor-ring-${i}`, "Anillo", ALPHABET.split(""), "A"));
      col.appendChild(makeLabeledSelect(`rotor-pos-${i}`, "Posición", ALPHABET.split(""), "A"));

      rotorConfigEl.appendChild(col);
    }
  }

  /* ---------- Teclado y lámparas ---------- */

  function buildLampboardAndKeyboard() {
    KEY_ROWS.forEach((row, rowIdx) => {
      const lampRow = lampboardEl.querySelector(`.keyboard-row[data-row="${rowIdx}"]`);
      const keyRow = keyboardEl.querySelector(`.keyboard-row[data-row="${rowIdx}"]`);
      lampRow.innerHTML = "";
      keyRow.innerHTML = "";

      for (const letter of row) {
        const lamp = document.createElement("div");
        lamp.className = "lamp";
        lamp.dataset.letter = letter;
        lamp.textContent = letter;
        lampRow.appendChild(lamp);

        const key = document.createElement("div");
        key.className = "key";
        key.dataset.letter = letter;
        key.textContent = letter;
        key.addEventListener("click", () => pressKey(letter));
        keyRow.appendChild(key);
      }
    });
  }

  /* ---------- Configuración / inicialización de la máquina ---------- */

  function readConfig() {
    const rotorTypes = [0, 1, 2].map(i => document.getElementById(`rotor-type-${i}`).value);
    const rings = [0, 1, 2].map(i => ALPHABET.indexOf(document.getElementById(`rotor-ring-${i}`).value));
    const positions = [0, 1, 2].map(i => ALPHABET.indexOf(document.getElementById(`rotor-pos-${i}`).value));
    const reflector = reflectorSelect.value;
    const plugPairs = plugboardInput.value.trim().split(/\s+/).filter(Boolean);
    return { rotorTypes, rings, positions, reflector, plugPairs };
  }

  function initEnigma() {
    const cfg = readConfig();
    enigma = new Enigma(cfg);

    dialState = rotorUnits.map((unit, i) => {
      const svgEl = unit.querySelector(".rotor-dial");
      const { ring, textEls } = buildRotorDial(svgEl);
      const position = enigma.rotors[i].position;
      const rotation = rotationForPosition(position);

      // Posicionar sin animación inicial
      ring.style.transition = "none";
      ring.style.transform = `rotate(${rotation}deg)`;
      void ring.getBoundingClientRect(); // forzar reflow
      ring.style.transition = "";

      return { ring, textEls, rotation };
    });

    updateRotorDisplays();
    plainText.value = "";
    cipherText.value = "";
  }

  function updateRotorDisplays() {
    const positions = enigma.getPositions();
    rotorUnits.forEach((unit, i) => {
      const letterEl = unit.querySelector(".rotor-letter");
      letterEl.textContent = ALPHABET[positions[i]];

      const { textEls } = dialState[i];
      textEls.forEach(el => el.classList.remove("active"));
      textEls[positions[i]].classList.add("active");
    });
  }

  function animateRotors(oldPositions) {
    const newPositions = enigma.getPositions();
    rotorUnits.forEach((unit, i) => {
      if (newPositions[i] !== oldPositions[i]) {
        dialState[i].rotation -= STEP_DEG;
        dialState[i].ring.style.transform = `rotate(${dialState[i].rotation}deg)`;
      }
    });
  }

  /* ---------- Interacción: pulsar una tecla ---------- */

  function pressKey(letter) {
    if (!enigma) return;

    const oldPositions = enigma.getPositions();
    const output = enigma.encryptChar(letter);
    if (output === null) return;

    animateRotors(oldPositions);
    updateRotorDisplays();
    lightLamp(output);
    flashKey(letter);

    plainText.value += letter;
    cipherText.value += output;
    plainText.scrollTop = plainText.scrollHeight;
    cipherText.scrollTop = cipherText.scrollHeight;
  }

  function lightLamp(letter) {
    const current = lampboardEl.querySelector(".lamp.lit");
    if (current) current.classList.remove("lit");

    const lamp = lampboardEl.querySelector(`.lamp[data-letter="${letter}"]`);
    if (lamp) lamp.classList.add("lit");

    clearTimeout(lampTimeout);
    lampTimeout = setTimeout(() => {
      if (lamp) lamp.classList.remove("lit");
    }, 600);
  }

  function flashKey(letter) {
    const key = keyboardEl.querySelector(`.key[data-letter="${letter}"]`);
    if (!key) return;
    key.classList.add("pressed");
    setTimeout(() => key.classList.remove("pressed"), 150);
  }

  /* ---------- Entrada por teclado físico ---------- */

  document.addEventListener("keydown", (e) => {
    const tag = document.activeElement.tagName;
    if (tag === "SELECT" || tag === "INPUT") return;

    const letter = e.key.toUpperCase();
    if (letter.length === 1 && ALPHABET.includes(letter)) {
      e.preventDefault();
      pressKey(letter);
    }
  });

  /* ---------- Inicio ---------- */

  buildRotorConfigUI();
  buildLampboardAndKeyboard();
  initEnigma();

  resetBtn.addEventListener("click", initEnigma);

  window.AppEnigma = { reinit: initEnigma };
})();
