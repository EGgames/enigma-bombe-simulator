# La Bombe de Turing — Información de referencia

Notas técnicas e históricas para diseñar un proyecto con GUI que simule la
**Bombe** (la máquina electromecánica diseñada por Alan Turing y Gordon
Welchman en Bletchley Park para atacar el cifrado Enigma).

---

## 1. Contexto histórico

- **Origen**: Desarrollada en 1939-1940 en Bletchley Park (Reino Unido),
  basada en la "bomba" polaca (*Bomba kryptologiczna*) de Marian Rejewski.
- **Objetivo**: Encontrar la configuración diaria de la máquina **Enigma**
  (orden de rotores, posiciones iniciales y, parcialmente, el *plugboard*/
  Steckerbrett) probando combinaciones a alta velocidad.
- **Construcción**: Fabricada por la **British Tabulating Machine Company**
  (BTM), bajo dirección de Harold "Doc" Keen.
- **Escala**: Cada máquina tenía aproximadamente 36 "tríos" de tambores
  Enigma equivalentes (algunas versiones con más), pesaba ~1 tonelada y
  medía ~2 metros de ancho.
- **Resultado**: Se construyeron más de 200 unidades durante la guerra,
  permitiendo descifrar mensajes navales y militares alemanes (tráfico
  Ultra).

---

## 2. La máquina Enigma (lo mínimo necesario)

Para entender la Bombe primero hace falta modelar Enigma:

| Componente | Función |
|---|---|
| **Teclado** | Entrada de letra en claro |
| **Rotores (3-4)** | Cada uno aplica una sustitución de letras y rota tras cada pulsación (con muescas/*notches* que provocan el avance del rotor vecino) |
| **Reflector (Umkehrwalze)** | Refleja la señal de vuelta a través de los rotores por un camino distinto |
| **Plugboard (Steckerbrett)** | Intercambia pares de letras antes y después de pasar por los rotores |
| **Lámparas** | Muestran la letra cifrada resultante |

**Propiedad clave para la Bombe**: la trayectoria eléctrica es *reciproca*
(si A → B entonces B → A) y **ninguna letra puede cifrarse a sí misma**
(gracias al reflector). Esta propiedad es la base de las contradicciones que
explota la Bombe.

---

## 3. Idea central del ataque: el "crib" (menú)

1. Los criptoanalistas adivinaban un fragmento de texto en claro probable
   (un *crib*), por ejemplo `WETTERVORHERSAGE` ("pronóstico del tiempo").
2. Alineaban el crib con el texto cifrado y construían un **menú**: un grafo
   donde cada letra del alfabeto es un nodo, y cada par
   (posición del rotor, letra clara ↔ letra cifrada) es una arista etiquetada
   con la posición de cifrado en la que ocurre.
3. Se buscaban **bucles (loops)** en ese grafo: ciclos que vuelven a la
   misma letra tras pasar por varias posiciones de rotor distintas.

```
Texto claro:    W E T T E R V O R H E R S A G E
Texto cifrado:  R Q J Y H L D Z W ...
Posición:       1 2 3 4 5 6 7 8 9 ...
```

Cada bucle, al recorrerse, debe ser *consistente* con una hipótesis sobre
las conexiones del plugboard. Si la hipótesis es incorrecta, en algún punto
del bucle aparece una contradicción eléctrica.

---

## 4. Cómo funciona la Bombe internamente

### 4.1. Tambores (drums)
- Cada tambor de la Bombe simula eléctricamente **un rotor de Enigma con su
  reflector** (en realidad cada "trío" representa 3 rotores + reflector en
  una de las 26 posiciones de offset entre sí).
- Hay 26 contactos de entrada y 26 de salida por cara del tambor (front/back),
  representando las 26 letras.
- Los tambores giran sincronizados, probando las **26³ = 17,576** posiciones
  posibles de los rotores para un orden de rotores dado.

### 4.2. Cableado según el menú
- Los tambores se interconectan con cables siguiendo exactamente el grafo
  del **menú** (las aristas letra-clara ↔ letra-cifrada en cada posición).
- Esto crea un circuito eléctrico gigante que representa todas las
  ecuaciones del menú simultáneamente.

### 4.3. El Diagonal Board (innovación de Gordon Welchman)
- Añadido en 1940. Conecta todas las combinaciones posibles de pares de
  letras (26×26 = 676 conexiones) entre sí.
- Explota la propiedad de reciprocidad del plugboard: si la letra A está
  conectada con B en una posición, entonces B también está conectada con A.
- **Efecto**: multiplica enormemente las contradicciones detectables,
  permitiendo descartar la mayoría de las 17,576 posiciones con un único
  supuesto inicial ("la letra X no está enchufada con la letra Y").

### 4.4. Detección de "stops"
- La Bombe prueba cada una de las 17,576 posiciones de rotor (para cada
  orden de rotores posible — había que repetir el proceso para cada
  permutación de los 3-5 rotores disponibles).
- En cada posición, se energiza el circuito con una hipótesis de partida
  (una letra conectada a tierra/corriente).
- Si **demasiados** caminos eléctricos se activan (corriente fluyendo por
  casi todos los 26 cables = contradicción total: "todo está conectado con
  todo", lo cual es imposible), la posición se descarta.
- Si **solo unos pocos** caminos se activan, es una posible solución: la
  máquina se **detiene** (*stop*) y un operador la registra para verificación
  manual.
- La mayoría de los "stops" eran falsos positivos (~1 de cada pocos cientos
  era correcto); se verificaban con una máquina auxiliar llamada
  **Checking Machine**.

### 4.5. Velocidad
- Cada Bombe recorría las 17,576 posiciones en aproximadamente **15-20
  minutos** por orden de rotores.
- Con múltiples Bombes operando en paralelo (cada una probando un orden de
  rotores distinto), el espacio completo se cubría en horas.

---

## 5. Componentes a modelar en una simulación con GUI

| Módulo | Descripción | Complejidad |
|---|---|---|
| **Motor Enigma** | Cifrado/descifrado letra a letra con rotores configurables, reflector y plugboard | Media |
| **Editor de menú (crib)** | Interfaz para alinear texto claro/cifrado y generar el grafo de conexiones | Media-Alta |
| **Visualización de tambores** | Representación gráfica de los "drums" girando, mostrando posición actual | Alta (visual) |
| **Diagonal board** | Matriz 26×26 visualizable, mostrando qué conexiones están activas | Media |
| **Motor de búsqueda** | Recorre las 17,576 posiciones × órdenes de rotores, detecta "stops" | Media (lógica) |
| **Panel de resultados** | Lista de "stops" encontrados, con opción de verificar contra el texto cifrado completo | Baja |
| **Modo "paso a paso" educativo** | Animación lenta mostrando cómo se propaga la corriente por el circuito en una posición dada | Alta (la parte más vistosa) |

---

## 6. Sugerencias de diseño para la GUI

- **Vista principal**: panel central con representación visual de los
  tambores (cilindros giratorios o barras de progreso con letras), y a un
  lado el diagonal board como matriz interactiva.
- **Panel de configuración**: selección de modelo Enigma (3 vs 4 rotores,
  M3/M4 naval), rotores disponibles, reflector.
- **Editor de crib**: entrada de texto claro y cifrado, alineación visual,
  generación automática del menú (grafo de letras y bucles detectados,
  resaltando los bucles más cortos como mejores candidatos).
- **Controles de ejecución**: play/pause/step, velocidad ajustable, y un
  log de "stops" con timestamp simulado de posición de rotor.
- **Modo educativo**: tooltips y animaciones que expliquen *por qué* una
  posición es descartada (mostrando el flujo de corriente y la
  contradicción).
- **Tema visual**: estética "retro/Bletchley Park" (paneles de baquelita,
  diales, luces indicadoras) es opcional pero muy efectivo para este tipo
  de proyecto educativo.

---

## 7. Stack técnico sugerido

Dependiendo de la plataforma objetivo:

- **Web (recomendado para portabilidad)**: React/Vue + Canvas o SVG para
  animaciones de tambores; lógica de cifrado en TypeScript puro (fácil de
  testear de forma aislada).
- **Desktop**: Python + PyQt/PySide o Tkinter (rápido de prototipar, bueno
  para la lógica matemática); o C#/.NET con WPF si se prefiere Windows
  nativo.
- **Núcleo de simulación**: independiente de la GUI, como librería separada
  (motor Enigma + motor Bombe), para poder testear la lógica criptográfica
  sin depender del framework visual.

---

## 8. Recursos de referencia

- Museo Nacional de Computación (Bletchley Park) — documentación técnica de
  la réplica funcional de la Bombe.
- *"The Bombe"* — descripciones técnicas de Frank Carter y Tony Sale
  (proyecto de reconstrucción de Bletchley Park).
- Especificaciones del cableado de rotores Enigma (modelos I, II, III, IV,
  V y reflectores B/C) — necesarias para que el motor Enigma simulado sea
  fiel al histórico.

---

## 9. Alcance sugerido por fases

1. **Fase 1**: Motor Enigma funcional (cifrar/descifrar con configuración
   manual de rotores y plugboard) + GUI básica de teclado/lámparas.
2. **Fase 2**: Editor de crib + generación de menú/grafo + detección de
   bucles.
3. **Fase 3**: Simulación de la Bombe (recorrido de posiciones, diagonal
   board, detección de stops) con visualización en tiempo real.
4. **Fase 4**: Modo educativo paso a paso + pulido visual/temático.
