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
interface RectCollider {
    x : number;
    y : number;
    width : number;
    height : number;
}

interface MapData {
    name: string;
    colliders : RectCollider[];
}

const maps: Record<string, MapData> = {
    "map1": { 
        name : "Map simple",
        colliders : [
            //Sol principal
            { x: 400, y: 580, width: 800, height: 40 },
            //plateforme
            { x: 400, y: 400, width: 200, height: 20 },
            { x: 250, y: 470, width: 200, height: 20 },
        ]},
    "map2": { 
        name: "Map escalier", 
        colliders : [
            { x: 400, y: 580, width: 800, height: 40 },
            { x: 250, y: 500, width: 200, height: 20 },
            { x: 150, y: 420, width: 160, height: 20 },
            { x: 300, y: 340, width: 120, height: 20 },  
        ]}
};

// clé : id socket, valeur : la couleur (string) pareil pour le pseudo 
const playerColors = new Map<string, string>();
const playerPseudos = new Map<string, string>();

// Parties actives
interface Partie {
    engine: Matter.Engine;
    joueurs: Map<string, Matter.Body>;
    interval: NodeJS.Timer;
    mapId: string;
}
// On accède aux parties par un dico avec comme clé une "partieID" et l'interface Partie  
const parties = new Map<string, Partie>();

// Va nous permettre de stocker les inputs de chaques player. Ce sont donc des boolean stocker dans un dico avec comme clé le socket 
// du joueur (qui est unique et creer a la connection). La clé string est la socket.id 
const playerInputs = new Map<string, {
    left: boolean;
    right: boolean;
    jump: boolean;
}>



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
           `
    );
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

//Sert a détecter le sol pour éviter de sauter dans les airs et donc limiter les double ou triple sauts
//On pourrait rajouter le fait de sauter l'un sur l'autre en parcourant le dico de joueur
function isOnGround(body: Matter.Body, bodies: Matter.Body[]) {
    const footY = body.bounds.max.y;
    const pointsX = [
        body.position.x,
        body.bounds.min.x + 3,
        body.bounds.max.x - 3
    ];

    return bodies.some(b => {
        if (b === body || !b.isStatic){
            return false;
        } 

        return pointsX.some(x =>
            x > b.bounds.min.x &&
            x < b.bounds.max.x &&
            Math.abs(b.bounds.min.y - footY) < 6
        );
    });
}





// Créer le serveur HTTP et Socket.IO
const httpServer = createServer(app);
const io = new Server(httpServer);

// Socket.IO
// On a creer un serveur http et on connecte les joueurs (client html) qui se connecte sur la page partie. Ils sont ensuite mis dans la partie
// correspondant à leur demande et sont connecté via socket avec socket.io
io.on("connection", (socket) => {
    console.log("Client connecté", socket.id);

    // Rejoindre une partie et demander une map
    socket.on("join", (data: { partieId: string; mapId: string, color : string, pseudo : string}) => {
        const { partieId, mapId, color, pseudo } = data;
        //Creer une "room" pour cette partie. On peut ensuite envoyer a tout ceux dedans facilement : "io.to(partieId).emit("state", etat);"
        socket.join(partieId);


        let partie = parties.get(partieId);

        if (!partie) {
            socket.emit("connection_first_on_server");
            const mapData = maps[mapId];
            if (!mapData) return;

            const engine = Engine.create();
            const joueurs = new Map<string, Matter.Body>();

            // Créer le sol
            mapData.colliders.forEach(g => {
                const ground = Bodies.rectangle(g.x, g.y, g.width, g.height, { isStatic: true });
                World.add(engine.world, [ground]);
            });

            //On met a jour l'etat du monde : la vitesse du joueur en fonction de son input (donc de la Hashmap PlayerInput)
            const interval = setInterval(() => {
        
                const HORIZONTAL_SPEED = 6;
                const STOP_MOUVEMENT = 0.8;

                joueurs.forEach((body, socketId) => {
                    const input = playerInputs.get(socketId);
                    if (!input){
                        return;
                    } 


                    let vx = body.velocity.x;

                    if (input.left) {
                        vx = -HORIZONTAL_SPEED;
                    } else if (input.right) {
                        vx = HORIZONTAL_SPEED;
                    } else {
                        vx *= STOP_MOUVEMENT; // arrêt fluide
                    }

                
                    Body.setVelocity(body, {
                        x: vx,
                        y: body.velocity.y,
                    });


                    //  Jump
                    if (input.jump && isOnGround(body, engine.world.bodies)) {
                        Body.setVelocity(body, {
                        x: vx,
                        y: -8,
                        });
                    input.jump = false;
                    }
                });
                Engine.update(engine, 16);

                // envoyer état à tous les clients de la partie
                const etat: Record<string, { x: number; y: number; angle: number, colorPlayer : string, pseudoPlayer : string}> = {};
                joueurs.forEach((body, id) => {
                    etat[id] = { 
                        x: body.position.x, 
                        y: body.position.y, 
                        angle: body.angle, 
                        colorPlayer : playerColors.get(id) || "#2d7dff", // couleur par defaut si jamais 
                        pseudoPlayer : playerPseudos.get(id) || "Joueur", //pseudo par defaut si jamais  
                    };
                });
                // Ici on envoie bien qu'au gens de la room partieID
                io.to(partieId).emit("state", etat);
                io.to(partieId).emit("map", maps[mapId].colliders);
            }, 16);

            partie = { engine, joueurs, interval, mapId };
            parties.set(partieId, partie);
        }
        else {
            socket.emit("connection_not_first");
        }

        //On ajoute la couleur et le speudo du joueur qui vient de se connecter aux dico 
        playerColors.set(socket.id, color);
        playerPseudos.set(socket.id, pseudo);

        // Ajouter le joueur a la partie :(dans tous les cas si on a une connection)
        const playerBody = Bodies.rectangle(400, 0, 40, 40);
        // Empêche la rotation (important pour un joueur)
        Body.setInertia(playerBody, Infinity);
        partie.joueurs.set(socket.id, playerBody);
        World.add(partie.engine.world, [playerBody]);
    });



    // Actions du joueur
    // On capte juste l'action et on change la valeur de la touche dans playerInputs 
    socket.on("action", (action: string) => {
        if (!playerInputs.has(socket.id)) {
            playerInputs.set(socket.id, { left: false, right: false, jump: false });
        }



        const input = playerInputs.get(socket.id)!;

        if (action === "left") input.left = true;
        if (action === "right") input.right = true;
        if (action === "stopLeft") input.left = false;
        if (action === "stopRight") input.right = false;
        if (action === "jump") input.jump = true;
    });


    socket.on("disconnecting", () => {
        console.log("Client déconnecté", socket.id);
        
        for (const [partieId, partie] of parties.entries()) {
            const body = partie.joueurs.get(socket.id);
            if (body) {
                World.remove(partie.engine.world, body);
                //On supprime de tous nos dic
                partie.joueurs.delete(socket.id);
                playerColors.delete(socket.id);
                playerPseudos.delete(socket.id);
                playerInputs.delete(socket.id);
            }

            //Gestion du dico si il n'y a plus de joueurs dans le salon courant 
            if(partie.joueurs.size == 0){
                //Typage en Timer donc chiant d'où la ligne un peu magique avec cast moche
                clearInterval(partie.interval as unknown as any); // Stop la boucle qui envoie les données aux clients
                parties.delete(partieId)
                console.log('Partie "${partieID}" supprimée car plus aucuns joueurs dedans !')
            }
        }
    });
});

// Démarrer le serveur
httpServer.listen(port, () => {
    console.log(`[server]: Server is running at http://localhost:${port}`);
});

