const { Engine, Render, World, Bodies } = Matter;

// 1. Créer le moteur
const engine = Engine.create();

// 2. Créer le renderer (canvas)
const render = Render.create({
  element: document.body,
  engine: engine,
  options: {
    width: 800,
    height: 600,
    wireframes: false,
    background: "#222"
  }
});

// 3. Créer un rectangle
const rectangle = Bodies.rectangle(400, 200, 150, 80, {
  render: {
    fillStyle: "orange"
  }
});

// 4. Sol (pour que le rectangle tombe)
const sol = Bodies.rectangle(400, 580, 810, 40, {
  isStatic: true
});

// 5. Ajouter au monde
World.add(engine.world, [rectangle, sol]);

// 6. Lancer le moteur et le rendu
Engine.run(engine);
Render.run(render);

