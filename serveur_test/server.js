const Matter = require("matter-js");

const Engine = Matter.Engine;
const World = Matter.World;
const Bodies = Matter.Bodies;

const engine = Engine.create();
const world = engine.world;

// sol
const ground = Bodies.rectangle(400, 580, 800, 40, { isStatic: true });

// joueur
const player = Bodies.rectangle(400, 500, 40, 60);

World.add(world, [ground, player]);

setInterval(() => {
  Engine.update(engine, 1000 / 60);
  console.log(player.position);
}, 1000 / 60);

