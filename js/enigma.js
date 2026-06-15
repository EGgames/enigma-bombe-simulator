/*
 * Motor de cifrado Enigma (modelo I / M3).
 * Cableados históricos de rotores y reflectores.
 */

const A = 65; // código ASCII de 'A'

const ROTOR_WIRINGS = {
  I:   "EKMFLGDQVZNTOWYHXUSPAIBRCJ",
  II:  "AJDKSIRUXBLHWTMCQGZNPYFVOE",
  III: "BDFHJLCPRTXVZNYEIWGAKMUSQO",
  IV:  "ESOVPZJAYQUIRHXLNFTGKDCMWB",
  V:   "VZBRGITYUPSDNHLXAWMJQOFECK",
};

const ROTOR_NOTCHES = {
  I: "Q",
  II: "E",
  III: "V",
  IV: "J",
  V: "Z",
};

const REFLECTORS = {
  A: "EJMZALYXVBWFCRQUONTSPIKHGD",
  B: "YRUHQSLDPXNGOKMIEBFZCWVJAT",
  C: "FVPJIAOYEDRZXWGCTKUQSBNMHL",
};

function mod(n, m) {
  return ((n % m) + m) % m;
}

class Rotor {
  constructor(type, ring = 0, position = 0) {
    this.type = type;
    this.wiring = ROTOR_WIRINGS[type];
    this.notch = ROTOR_NOTCHES[type].charCodeAt(0) - A;
    this.ring = ring;         // ringstellung, 0-25
    this.position = position; // posición visible en la ventanilla, 0-25
  }

  atNotch() {
    return this.position === this.notch;
  }

  step() {
    this.position = mod(this.position + 1, 26);
  }

  // Señal entrando por el lado derecho (teclado -> reflector)
  forward(c) {
    const shift = this.position - this.ring;
    const idx = mod(c + shift, 26);
    const mapped = this.wiring.charCodeAt(idx) - A;
    return mod(mapped - shift, 26);
  }

  // Señal entrando por el lado izquierdo (reflector -> lámparas)
  backward(c) {
    const shift = this.position - this.ring;
    const idx = mod(c + shift, 26);
    const letter = String.fromCharCode(A + idx);
    const mapped = this.wiring.indexOf(letter);
    return mod(mapped - shift, 26);
  }
}

class Enigma {
  /**
   * @param {Object} cfg
   * @param {string[]} cfg.rotorTypes  ej. ['I','II','III'] de izquierda a derecha
   * @param {number[]} cfg.rings       ringstellung por rotor, 0-25
   * @param {number[]} cfg.positions   posición inicial por rotor, 0-25
   * @param {string}   cfg.reflector   'A' | 'B' | 'C'
   * @param {string[]} cfg.plugPairs   ej. ['AB','CD']
   */
  constructor(cfg) {
    this.rotors = cfg.rotorTypes.map((t, i) => new Rotor(t, cfg.rings[i], cfg.positions[i]));
    this.reflector = REFLECTORS[cfg.reflector];
    this.plugboard = Enigma.buildPlugboard(cfg.plugPairs);
  }

  static buildPlugboard(pairs) {
    const map = {};
    for (const pair of pairs || []) {
      const p = pair.trim().toUpperCase();
      if (p.length !== 2) continue;
      const a = p.charCodeAt(0) - A;
      const b = p.charCodeAt(1) - A;
      if (a < 0 || a > 25 || b < 0 || b > 25) continue;
      map[a] = b;
      map[b] = a;
    }
    return map;
  }

  // Avanza los rotores (mecanismo de paso, incluye doble paso del rotor medio)
  stepRotors() {
    const n = this.rotors.length;
    const left = this.rotors[n - 3];
    const middle = this.rotors[n - 2];
    const right = this.rotors[n - 1];

    const middleAtNotch = middle.atNotch();
    const rightAtNotch = right.atNotch();

    if (middleAtNotch) {
      left.step();
      middle.step();
    } else if (rightAtNotch) {
      middle.step();
    }
    right.step();
  }

  // Cifra/descifra un único carácter (A-Z). Devuelve null para otros caracteres.
  encryptChar(ch) {
    const upper = ch.toUpperCase();
    const code = upper.charCodeAt(0) - A;
    if (code < 0 || code > 25) return null;

    this.stepRotors();

    let c = this.plugboard[code] ?? code;

    for (let i = this.rotors.length - 1; i >= 0; i--) {
      c = this.rotors[i].forward(c);
    }

    c = this.reflector.charCodeAt(c) - A;

    for (let i = 0; i < this.rotors.length; i++) {
      c = this.rotors[i].backward(c);
    }

    c = this.plugboard[c] ?? c;

    return String.fromCharCode(A + c);
  }

  getPositions() {
    return this.rotors.map(r => r.position);
  }

  getPositionLetters() {
    return this.rotors.map(r => String.fromCharCode(A + r.position));
  }
}

// Exponer en el ámbito global para que app.js / bombe.js lo usen directamente
window.Enigma = Enigma;
window.Rotor = Rotor;
window.mod = mod;
window.ROTOR_WIRINGS = ROTOR_WIRINGS;
window.ROTOR_NOTCHES = ROTOR_NOTCHES;
window.REFLECTORS = REFLECTORS;
