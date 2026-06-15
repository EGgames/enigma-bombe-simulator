/*
 * Motor de la Bombe (Turing/Welchman).
 *
 * Idea central: para un "crib" (texto plano probable alineado con el texto
 * cifrado), cada posición i define una relación
 *
 *     cipher_i = P( S_i( P( plain_i ) ) )
 *
 * donde P es la permutación del clavijero (desconocida, involución) y S_i es
 * la permutación del "scrambler" (rotores + reflector, SIN clavijero) en la
 * posición i. Esa permutación S_i es siempre una involución sin puntos fijos
 * (igual que el reflector).
 *
 * Si en el grafo "letra clara <-> letra cifrada" (el "menú") existe un bucle
 * cerrado que vuelve a una letra v, componiendo las S_i de ese bucle se
 * obtiene una permutación R tal que:
 *
 *     P(v) debe ser un punto fijo de R
 *
 * Si R no tiene ningún punto fijo, la posición de los rotores probada es
 * IMPOSIBLE (contradicción) y se descarta. Si varias bucles pasan por la
 * misma letra ("letra de prueba"), la intersección de los puntos fijos de
 * cada bucle da las hipótesis de clavija candidatas. Una posición donde esa
 * intersección no es vacía es un "stop".
 */

(function () {
  const A = 65;
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const ROTOR_TYPES = ["I", "II", "III", "IV", "V"];

  /* ---------- Menú (grafo crib <-> cifrado) ---------- */

  function buildMenu(cipherText, crib) {
    const C = cipherText.toUpperCase().replace(/[^A-Z]/g, "");
    const P = crib.toUpperCase().replace(/[^A-Z]/g, "");

    if (C.length === 0 || P.length === 0) {
      throw new Error("Ingresá el texto cifrado y el crib.");
    }
    if (C.length !== P.length) {
      throw new Error(`Las longitudes no coinciden (cifrado: ${C.length}, crib: ${P.length}).`);
    }

    const edges = [];
    for (let i = 0; i < C.length; i++) {
      const plain = P.charCodeAt(i) - A;
      const cipher = C.charCodeAt(i) - A;
      if (plain === cipher) {
        throw new Error(`Posición ${i + 1}: "${P[i]}" no puede cifrarse a sí misma (propiedad de Enigma).`);
      }
      edges.push({ plain, cipher, pos: i });
    }
    return { edges, cipherText: C, crib: P };
  }

  /* ---------- Búsqueda de bucles ---------- */

  // Devuelve todos los ciclos simples (arrays de índices de arista) que
  // empiezan y terminan en el vértice v, sin repetir aristas ni vértices
  // intermedios, hasta longitud maxLen.
  function findLoopsForVertex(edges, v, maxLen = 8) {
    const cycles = [];

    function dfs(current, usedEdges, edgePath, visited) {
      for (let e = 0; e < edges.length; e++) {
        if (usedEdges.has(e)) continue;
        const { plain, cipher } = edges[e];
        let next;
        if (plain === current) next = cipher;
        else if (cipher === current) next = plain;
        else continue;

        if (next === v) {
          if (edgePath.length + 1 >= 2) {
            cycles.push([...edgePath, e]);
          }
          continue;
        }
        if (visited.has(next)) continue;
        if (edgePath.length + 1 >= maxLen) continue;

        visited.add(next);
        dfs(next, new Set([...usedEdges, e]), [...edgePath, e], visited);
        visited.delete(next);
      }
    }

    dfs(v, new Set(), [], new Set([v]));

    // Deduplicar ciclos que son el mismo conjunto de aristas recorrido en
    // sentido inverso (dan los mismos puntos fijos).
    const seen = new Set();
    const unique = [];
    for (const cyc of cycles) {
      const key = [...cyc].sort((a, b) => a - b).join(",");
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(cyc);
    }
    return unique;
  }

  // Elige la mejor "letra de prueba": la que participa en más bucles.
  function chooseTestLetter(edges, maxLen = 8) {
    let best = null;
    for (let v = 0; v < 26; v++) {
      const cycles = findLoopsForVertex(edges, v, maxLen);
      if (cycles.length === 0) continue;
      if (!best || cycles.length > best.cycles.length) {
        best = { letter: v, cycles };
      }
    }
    return best; // null si el menú no tiene ningún bucle
  }

  /* ---------- Tabla de permutaciones del scrambler ---------- */

  // table[left*676 + mid*26 + right] = Uint8Array(26) con la permutación
  // rotores+reflector (sin clavijero) para esa posición absoluta de rotores.
  function buildScramblerTable(rotorTypes, rings, reflectorKey) {
    const reflector = window.REFLECTORS[reflectorKey];
    const Rotor = window.Rotor;
    const r = [
      new Rotor(rotorTypes[0], rings[0], 0),
      new Rotor(rotorTypes[1], rings[1], 0),
      new Rotor(rotorTypes[2], rings[2], 0),
    ];

    const table = new Array(17576);
    for (let left = 0; left < 26; left++) {
      r[0].position = left;
      for (let mid = 0; mid < 26; mid++) {
        r[1].position = mid;
        for (let right = 0; right < 26; right++) {
          r[2].position = right;
          const S = new Uint8Array(26);
          for (let x = 0; x < 26; x++) {
            let c = x;
            c = r[2].forward(c);
            c = r[1].forward(c);
            c = r[0].forward(c);
            c = reflector.charCodeAt(c) - A;
            c = r[0].backward(c);
            c = r[1].backward(c);
            c = r[2].backward(c);
            S[x] = c;
          }
          table[left * 676 + mid * 26 + right] = S;
        }
      }
    }
    return table;
  }

  /* ---------- Simulación del avance de rotores ---------- */

  // Para una posición inicial [left0, mid0, right0], devuelve un array de
  // `count` índices a `table` (uno por cada paso 1..count), igual que
  // Enigma.stepRotors() pero sin necesidad de instanciar la máquina completa.
  function simulateStates(rotorTypes, startPos, count) {
    const notches = rotorTypes.map(t => window.ROTOR_NOTCHES[t].charCodeAt(0) - A);
    let [left, mid, right] = startPos;
    const states = new Array(count);
    for (let i = 0; i < count; i++) {
      const midAtNotch = mid === notches[1];
      const rightAtNotch = right === notches[2];
      if (midAtNotch) {
        left = (left + 1) % 26;
        mid = (mid + 1) % 26;
      } else if (rightAtNotch) {
        mid = (mid + 1) % 26;
      }
      right = (right + 1) % 26;
      states[i] = left * 676 + mid * 26 + right;
    }
    return states;
  }

  /* ---------- Álgebra de permutaciones ---------- */

  function identityPerm() {
    const id = new Uint8Array(26);
    for (let i = 0; i < 26; i++) id[i] = i;
    return id;
  }

  // (f ∘ g)(x) = f(g(x))
  function composePerm(f, g) {
    const r = new Uint8Array(26);
    for (let x = 0; x < 26; x++) r[x] = f[g[x]];
    return r;
  }

  function composeLoop(table, states, edgeIndices) {
    let R = identityPerm();
    for (const e of edgeIndices) {
      R = composePerm(table[states[e]], R);
    }
    return R;
  }

  function fixedPoints(perm) {
    const fps = [];
    for (let x = 0; x < 26; x++) if (perm[x] === x) fps.push(x);
    return fps;
  }

  /* ---------- Búsqueda principal ---------- */

  // Recorre las 26^3 = 17576 posiciones iniciales de rotores para un orden y
  // anillos dados, y devuelve los "stops": posiciones donde, para la letra
  // de prueba, la intersección de puntos fijos de todos sus bucles no es vacía.
  function searchRotorOrder({ rotorTypes, rings, reflector, edges, testLetter, cycles }) {
    const table = buildScramblerTable(rotorTypes, rings, reflector);
    const stops = [];
    const stepCount = edges.length;

    for (let left0 = 0; left0 < 26; left0++) {
      for (let mid0 = 0; mid0 < 26; mid0++) {
        for (let right0 = 0; right0 < 26; right0++) {
          const states = simulateStates(rotorTypes, [left0, mid0, right0], stepCount);

          let intersection = null;
          for (const cyc of cycles) {
            const R = composeLoop(table, states, cyc);
            const fps = fixedPoints(R);
            if (fps.length === 0) {
              intersection = [];
              break;
            }
            intersection = intersection === null ? fps : intersection.filter(x => fps.includes(x));
            if (intersection.length === 0) break;
          }

          if (intersection && intersection.length > 0) {
            stops.push({
              rotorTypes: rotorTypes.slice(),
              rings: rings.slice(),
              reflector,
              start: [left0, mid0, right0],
              testLetter,
              hypotheses: intersection,
            });
          }
        }
      }
    }
    return stops;
  }

  /* ---------- Órdenes de rotores ---------- */

  function allRotorOrders() {
    const orders = [];
    for (const a of ROTOR_TYPES) {
      for (const b of ROTOR_TYPES) {
        if (b === a) continue;
        for (const c of ROTOR_TYPES) {
          if (c === a || c === b) continue;
          orders.push([a, b, c]);
        }
      }
    }
    return orders; // 5*4*3 = 60
  }

  /* ---------- API pública ---------- */

  window.Bombe = {
    ALPHABET,
    ROTOR_TYPES,
    buildMenu,
    findLoopsForVertex,
    chooseTestLetter,
    buildScramblerTable,
    simulateStates,
    composeLoop,
    fixedPoints,
    searchRotorOrder,
    allRotorOrders,
  };
})();
