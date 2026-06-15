# Enigma & Bombe — Simuladores

🔗 **Demo en vivo**: https://enigma-bombe-simulator.vercel.app

Simulador interactivo, en HTML/CSS/JS vanilla (sin dependencias ni build),
de dos máquinas históricas:

- **Enigma**: la máquina de cifrado alemana (rotores I-V, reflectores
  A/B/C, plugboard, doble paso, encriptado reciproco).
- **Bombe**: la máquina electromecánica diseñada por Alan Turing y Gordon
  Welchman para deducir la configuración de Enigma a partir de un *crib*
  (texto plano probable).

## Uso

Simplemente abrí [`index.html`](index.html) en el navegador. No requiere
instalación ni servidor (aunque también funciona servido por cualquier
servidor estático).

## Documentación

- [BOMBE.md](BOMBE.md) — contexto histórico y diseño de la Bombe.
- [MANUAL.md](MANUAL.md) — manual paso a paso con capturas de pantalla:
  cifrar un mensaje con Enigma, recuperar la configuración con la Bombe a
  partir de un crib, y descifrar el mensaje original.

La misma documentación del manual también está disponible dentro de la app,
en la pestaña **Manual**.
