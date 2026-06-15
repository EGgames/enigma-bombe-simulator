/*
 * Helpers de UI compartidos entre app.js (Enigma) y app-bombe.js (Bombe).
 */

(function () {
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const STEP_DEG = 360 / 26;

  // Construye un disco SVG con las 26 letras dispuestas en círculo dentro
  // de un <g class="dial-ring"> rotable, más un aro y un puntero fijo.
  function buildRotorDial(svgEl) {
    const NS = "http://www.w3.org/2000/svg";
    svgEl.innerHTML = "";

    const cx = 110, cy = 110;
    const trackR = 100;
    const letterR = 85;

    const track = document.createElementNS(NS, "circle");
    track.setAttribute("class", "dial-track");
    track.setAttribute("cx", cx);
    track.setAttribute("cy", cy);
    track.setAttribute("r", trackR);
    svgEl.appendChild(track);

    const pointer = document.createElementNS(NS, "polygon");
    pointer.setAttribute("class", "dial-pointer");
    pointer.setAttribute("points", "100,4 120,4 110,18");
    svgEl.appendChild(pointer);

    const ring = document.createElementNS(NS, "g");
    ring.setAttribute("class", "dial-ring");

    const textEls = [];
    for (let i = 0; i < 26; i++) {
      const angleRad = (i * STEP_DEG) * (Math.PI / 180);
      const x = cx + letterR * Math.sin(angleRad);
      const y = cy - letterR * Math.cos(angleRad);
      const text = document.createElementNS(NS, "text");
      text.setAttribute("x", x.toFixed(2));
      text.setAttribute("y", y.toFixed(2));
      text.textContent = ALPHABET[i];
      ring.appendChild(text);
      textEls.push(text);
    }

    svgEl.appendChild(ring);
    return { ring, textEls };
  }

  // Rotación (en grados) para que la letra `position` (0-25) quede bajo el puntero.
  function rotationForPosition(position) {
    return -(position * STEP_DEG);
  }

  function makeLabeledSelect(id, labelText, options, defaultValue) {
    const wrap = document.createElement("div");
    const label = document.createElement("label");
    label.setAttribute("for", id);
    label.textContent = labelText;
    const select = document.createElement("select");
    select.id = id;
    for (const opt of options) {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt;
      if (opt === defaultValue) o.selected = true;
      select.appendChild(o);
    }
    wrap.appendChild(label);
    wrap.appendChild(select);
    return wrap;
  }

  window.UIHelpers = {
    ALPHABET,
    STEP_DEG,
    buildRotorDial,
    rotationForPosition,
    makeLabeledSelect,
  };
})();
