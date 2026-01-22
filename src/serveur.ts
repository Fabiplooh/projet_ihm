import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import * as path from "path";
import { createServer } from "http";
import { Server } from "socket.io";
import * as Matter from "matter-js";

dotenv.config();

const app: Express = express();
const port = process.env.PORT ?? 3000;

const { Engine, World, Bodies, Body } = Matter;

app.use(express.static(path.join(__dirname,"..","public")));
app.use(express.json());
app.use(express.urlencoded({extended: true}));

// Maps stockées côté serveur (JSON)
interface MapData {
  name: string;
  ground: { x: number; y: number; width: number; height: number }[];
}

const maps: Record<string, MapData> = {
  "map1": { name: "Map 1", ground: [{ x: 400, y: 580, width: 800, height: 40 }] },
  "map2": { name: "Map 2", ground: [
      { x: 400, y: 580, width: 800, height: 40 },
      { x: 400, y: 400, width: 200, height: 20 }
  ]}
};

// Parties actives
interface Partie {
  engine: Matter.Engine;
  joueurs: Map<string, Matter.Body>;
  interval: NodeJS.Timer;
  mapId: string;
}
const parties = new Map<string, Partie>();

// Page partie
app.get("/partie", (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname,"..","public","partie.html"));
    console.log(`[server]: Un client essaye de se connecter a partie`);
});

// Page d'accueil
app.get("/", (req: Request, res: Response) => {
  res.send(`<html>
               <head>
                    <link rel="stylesheet" href="roulette.css" />
                    <title> Coucou les meef </title>
               </head>
               <body> 
                   <h1>Un cours pour voir HTTP</h1>
                   <p>Avec un serveur Express</p>
               </body>
            </html> 
           `);
});

app.get("/roulette.css", (req : Request, res : Response) => {
    const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16)
    res.send(`
              body {
                  background-color: ${randomColor};
                  color : white;
              }  
             `
    )
});

// Addition simple
app.all("/add", (req: Request, res: Response) => {
  const a = Number(req.body.a ?? req.query.a);
  const b = Number(req.body.b ?? req.query.b);
  if (Number.isNaN(a) || Number.isNaN(b)) {
    res.status(400).json({ error: "Invalid numbers" });
    return;
  }
  const sum = a + b;
  res.json({ result: sum });
});

// Créer le serveur HTTP et Socket.IO
const httpServer = createServer(app);
const io = new Server(httpServer);

// Socket.IO
io.on("connection", (socket) => {
  console.log("Client connecté", socket.id);

  // Rejoindre une partie et demander une map
  socket.on("join", (data: { partieId: string; mapId: string }) => {
    const { partieId, mapId } = data;
    socket.join(partieId);

    let partie = parties.get(partieId);

    if (!partie) {
      const mapData = maps[mapId];
      if (!mapData) return;

      const engine = Engine.create();
      const joueurs = new Map<string, Matter.Body>();

      // Créer le sol
      mapData.ground.forEach(g => {
        const ground = Bodies.rectangle(g.x, g.y, g.width, g.height, { isStatic: true });
        World.add(engine.world, [ground]);
      });

      // Boucle de simulation
      const interval = setInterval(() => {
        Engine.update(engine, 16);

        // envoyer état à tous les clients de la partie
        const etat: Record<string, { x: number; y: number; angle: number }> = {};
        joueurs.forEach((body, id) => {
          etat[id] = { x: body.position.x, y: body.position.y, angle: body.angle };
        });

        io.to(partieId).emit("state", etat);
      }, 16);

      partie = { engine, joueurs, interval, mapId };
      parties.set(partieId, partie);
    }

    // Ajouter le joueur
    const playerBody = Bodies.rectangle(400, 0, 40, 40);
    partie.joueurs.set(socket.id, playerBody);
    World.add(partie.engine.world, [playerBody]);
  });

  // Actions du joueur
  socket.on("action", (action: string) => {
    for (const [partieId, partie] of parties.entries()) {
      if (partie.joueurs.has(socket.id)) {
        const body = partie.joueurs.get(socket.id)!;
        const speed = 5;
        if (action === "left") Body.translate(body, { x: -speed, y: 0 });
        if (action === "right") Body.translate(body, { x: speed, y: 0 });
        if (action === "jump") {
          // simple saut si sur le sol (y proche du sol)
          partie.engine.world.bodies.forEach(b => {
            if (b.isStatic && Math.abs(body.position.y + 20 - (b.position.y - b.bounds.max.y + b.position.y)) < 5) {
              Body.setVelocity(body, { x: body.velocity.x, y: -5 });
            }
          });
        }
      }
    }
  });

  socket.on("disconnecting", () => {
    console.log("Client déconnecté", socket.id);
    for (const partie of parties.values()) {
      const body = partie.joueurs.get(socket.id);
      if (body) {
        World.remove(partie.engine.world, body);
        partie.joueurs.delete(socket.id);
      }
    }
  });
});

// Démarrer le serveur
httpServer.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});

