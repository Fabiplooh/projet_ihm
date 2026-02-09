import express, { Express, Request, Response, RequestHandler } from "express";
import dotenv from "dotenv";
import * as path from "path";
import { createServer } from "http";
import { Server } from "socket.io";
import * as Matter from "matter-js";
import session from "express-session";
import { Session } from "express-session"
import bcrypt from "bcrypt";
import { db } from "./db";
import { User, UserLogin, UserProfile, PlayerInput, RectCollider, MapData, DrawnPlatform, Partie, PlayerState, JoinData } from "./types";
declare module "express-session" {
    interface SessionData {
        userId?: number;
    }
}

dotenv.config();

const app: Express = express();
const port = Number(process.env.PORT) || 3000;

// connect-sqlite3 n'a pas de types → require obligatoire
const connectSqlite3 = require("connect-sqlite3");

const { Engine, World, Bodies, Body } = Matter;

app.use(express.static(path.join(__dirname,"..","public")));
app.use(express.json());
app.use(express.urlencoded({extended: true}));

// Maps stockées côté serveur (JSON)
const maps: Record<string, MapData> = {
    "map1": { 
        name : "Map simple",
        colliders : [
            //Sol principal
            { x: 400, y: 580, width: 800, height: 40 },
            //plateforme
            { x: 400, y: 400, width: 200, height: 20 },
            { x: 250, y: 470, width: 200, height: 20 },
        ],
        exit: { x: 700, y: 350, width: 50, height: 50 } 
    },
    "map2": { 
        name: "Map escalier", 
        colliders : [
            { x: 400, y: 580, width: 800, height: 40 },
            { x: 250, y: 500, width: 200, height: 20 },
            { x: 150, y: 420, width: 160, height: 20 },
            { x: 300, y: 340, width: 120, height: 20 },
        ],
        exit: { x: 350, y: 290, width: 50, height: 50 }
    }
};

const socketToUser = new Map<string, number>();
const userToSocket = new Map<number, string>();

// clé : userId, valeur : la couleur (string) pareil pour le pseudo 
const playerColors = new Map<number, string>();
const playerPseudos = new Map<number, string>();

// On accède aux parties par un dico avec comme clé une "partieID" et l'interface Partie
const parties = new Map<string, Partie>();

// Va nous permettre de stocker les inputs de chaques player. Ce sont donc des boolean stocker dans un dico avec comme clé l'userId 
// du joueur (qui est unique et creer a la connection). La clé string est la socket. 
const playerInputs = new Map<number, PlayerInput>()



// Page partie
app.get("/partie", (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname,"..","public","partie.html"));
    console.log(`[server]: Un client essaye de se connecter a partie`);
});

app.get("/test-login", (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname,"..","public","test-login.html"));
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




// Créer le serveur HTTP et Socket.IO
const httpServer = createServer(app);
const io = new Server(httpServer);

//Connexion a la base de donnée
const SQLiteStore = connectSqlite3(session);

// On utilise une session, qui stock des infos comme userId (quand on fait req.session... userId = user.id)
// C'est ensuite stocker dans le fichier sessions.sqlite et utilisé comme cookie par le navigateur. Ca permet d'eviter de 
// devoir recreer tout a chaque refresh de page etc.. Il fait le travail de charger/sauvegarder aussi 
const sessionMiddleware = session({
    store: new SQLiteStore({ db: "sessions.sqlite" }),
    secret: "secret_dev",
    resave: false,
    saveUninitialized: false,
});

app.use(sessionMiddleware);

io.use((socket, next) => {
    // @ts-ignore
    sessionMiddleware(socket.request, {}, next);
});



//Pour le login : 
// REGISTER - On ajoute à la base de donnée et on connecte puis message OK
app.post("/auth/register", async (req, res) => {
    const { identifiant, password, pseudo, color } = req.body;

    if (!identifiant || !password || !pseudo){
        res.status(400).json({ok: false, message : "Il manque des champs."});
        return;
    }
  
    try {
        //10 correspond aux nombre de fois qu'on a haché, plus c'est haché plus c'est secur mais plus c'est lent 
        const hash = await bcrypt.hash(password, 10);

        const info = db.prepare(`
            INSERT INTO users (identifiant, password_hash, pseudo, color)
            VALUES (?, ?, ?, ?)
        `).run(identifiant, hash, pseudo, color);
        //On connecte automatiquement l'utilisateur 
        req.session.userId = Number(info.lastInsertRowid);
        //Renovie au client
        res.json({ ok: true, message : "Vous avez bien crée votre compte et vous êtes maintenant connecté." });
    } catch (e) {
        res.status(400).json({ ok: false, message : "Il y a eu une erreur." });
    }
});

// LOGIN
app.post("/auth/login", async (req, res) => {
    const { identifiant, password } = req.body;
  
    if (!identifiant || !password){
        res.status(400).json({ok: false, message : "Il manque des champs."});
        return;
    }

    //Recherche du gonze
    const user = db.prepare(`
        SELECT id, password_hash FROM users WHERE identifiant = ?
    `).get(identifiant) as UserLogin | undefined;

    if (!user) {
        res.status(401).json({ ok: false, message : "Le compte n'existe pas."});
        return;
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
        res.status(401).json({ ok: false, message : "Mauvais mot de passe."});
        return;
    }

    req.session.userId = user.id;
    res.json({ ok: true, message : "Vous êtes bien connecté."});

});

// ME (profil)
app.post("/me", async (req, res) => {
    if (!req.session.userId) {
        res.status(401).json({ ok: false, message : "Vous n'êtes pas connecté."});
        return;
    }

    const user = db.prepare(`
        SELECT identifiant, pseudo, color FROM users WHERE id = ?
    `).get(req.session.userId) as UserProfile | undefined;

    if (!user) {
        res.status(401).json({ ok: false, message : "Utilisateur non trouvé."});
        return;
    }

    res.json({ ok: true, user, message : `Pseudo = ${user.pseudo}; Identifiant = ${user.identifiant}` });
});

// LOGOUT
app.post("/auth/logout", (req, res) => {
    req.session.destroy(() => res.json({ ok: true, message : "Vous êtes déconnecté." }));
});






//Sert a détecter le sol pour éviter de sauter dans les airs et donc limiter les double ou triple sauts
//On pourrait rajouter le fait de sauter l'un sur l'autre en parcourant le dico de joueur
function isOnGround(body: Matter.Body, bodies: Matter.Body[], joueurs : Map<number, Matter.Body>) {
    const footY = body.bounds.max.y;
    const pointsX = [ //Les trois points qu'on teste : gauche milieu et droite !
        body.position.x,
        body.bounds.min.x + 3,
        body.bounds.max.x - 3
    ];
    //parcourt de tout les body
    const onStaticBody = bodies.some(b => {
        if (b === body || !b.isStatic){
            return false; //on continue de chercher
        } 
        //C'est magique le .some, des qu'on a trouvé la condition, ca return sinon ca continue
        // donc si la condition en bas est true, on a trouvé un rectangle statique en dessous de nous donc on renvoie ture
        return pointsX.some(x => 
            x > b.bounds.min.x &&
            x < b.bounds.max.x &&
            Math.abs(b.bounds.min.y - footY) < 6
        );
    });
    //Si deja au sol
    if (onStaticBody) return true;

    //collision avec les autres joueurs 
    const onOtherPlayer = Array.from(joueurs.values()).some(otherBody => { //meme principe mais avec les joueurs 
        if (otherBody === body) return false;

        return pointsX.some(x =>
            x > otherBody.bounds.min.x &&
            x < otherBody.bounds.max.x &&
            Math.abs(otherBody.bounds.min.y - footY) < 6
        );
    });

    return onOtherPlayer;
}

function checkPlayerReachedExit(body: Matter.Body, userId : number, exitBody : Matter.Body) : boolean{
    const collision = Matter.Collision.collides(body, exitBody);
    if (! collision ) return false;
 
    const socketId = userToSocket.get(userId);
  
    if (socketId) {
        io.to(socketId).emit("player_exit");
    }
    return true;
}

function createPlatformFromPath(partie: Partie, path : {x:number, y:number}[]) {
    const thickness = 10;

    for (let i = 1; i < path.length; i++) {
        const p1 = path[i - 1];
        const p2 = path[i];

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        const x = (p1.x + p2.x) / 2;
        const y = (p1.y + p2.y) / 2;
  
        const segment = Bodies.rectangle(x, y, length, thickness, {
            isStatic: true,
            friction: 0.8,
        });

        Body.setAngle(segment, angle);
        World.add(partie.engine.world, segment);
        //sav
        partie.drawnPlatforms.push({
            x, y,
            width: length,
            height: thickness,
            angle
        });
        partie.drawnBodies.push(segment);
    }
}

function resetPartie(partieId: string, finishedPlayers : Set<number>){
    const partieCourante = parties.get(partieId); 
    if (!partieCourante) return;

    console.log("Tous les joueurs ont fini ! Rechargement des joueurs sur la partie :", partieId);
    
    partieCourante.drawnBodies.forEach(b => {
        World.remove(partieCourante.engine.world, b);
    });
    
    partieCourante.drawnPlatforms.length = 0;
    partieCourante.drawnBodies.length = 0;

    io.to(partieId).emit("deleteDrawnPlatform");
    
    finishedPlayers.forEach((userId) => {
        //J'ai rajouter ça pour ramettre uniquement ceux qui sont encore connecté. 
        const socketId = userToSocket.get(userId);
        if (!socketId) return;

        const playerBody = Bodies.rectangle(400, 0, 40, 40);
        Body.setInertia(playerBody, Infinity);
        partieCourante.joueurs.set(userId, playerBody);
        World.add(partieCourante.engine.world, [playerBody]);
        // Remettre les inputs à zéro
        playerInputs.set(userId, { left: false, right: false, jump: false, ah: false});
    });
    finishedPlayers.clear();
}

// Socket.IO
// On a creer un serveur http et on connecte les joueurs (client html) qui se connecte sur la page partie. Ils sont ensuite mis dans la partie
// correspondant à leur demande et sont connecté via socket avec socket.io
io.on("connection", (socket) => {
    console.log("Client connecté", socket.id);

    // Rejoindre une partie et demander une map
    socket.on("join", (data: JoinData) => {
        const { partieId, mapId } = data;
      
        // récupérer userId depuis la session
        const userId = (socket.request as any).session?.userId as number | undefined;
        if (!userId) {
            socket.emit("join_error", "not_logged_in");
            console.log("Bug sur l'obtention du userId", socket.id);
            return;
        }
      
        socketToUser.set(socket.id, userId);
        userToSocket.set(userId, socket.id);

        const user = db.prepare(`SELECT pseudo, color FROM users WHERE id = ?`).get(userId) as UserProfile | undefined;
        if (!user) {
            socket.emit("join_error", "not_logged_in");
            console.log("Bug sur la recupération des donnés en bd", socket.id);
            return;
        }

        // stocker profil pour le jeu
        playerColors.set(userId, user.color);
        playerPseudos.set(userId, user.pseudo);

        playerInputs.set(userId, {
            left: false,
            right: false,
            jump: false,
            ah: false,
        });
      
        //Creer une "room" pour cette partie. On peut ensuite envoyer a tout ceux dedans facilement : "io.to(partieId).emit("state", etat);"
        socket.join(partieId);


        let partie = parties.get(partieId);

        if (!partie) {
            socket.emit("connection_first_on_server");
            const mapData = maps[mapId];
            if (!mapData){
                console.log("Bug sur le chargement de la carte", socket.id);
                return;
            } 

            const engine = Engine.create();
            const joueurs = new Map<number, Matter.Body>();

            // Créer le sol
            mapData.colliders.forEach(g => {
                const ground = Bodies.rectangle(g.x, g.y, g.width, g.height, { isStatic: true });
                World.add(engine.world, [ground]);
            });
          
            //creer le bord de map
            const CANVAS_WIDTH = 800;
            const CANVAS_HEIGHT = 600;
            const WALL_THICKNESS = 20;

            const walls = [
                // Mur gauche
                Bodies.rectangle(0, CANVAS_HEIGHT / 2, WALL_THICKNESS, CANVAS_HEIGHT*2, { isStatic: true }),
                // Mur droit
                Bodies.rectangle(CANVAS_WIDTH, CANVAS_HEIGHT / 2, WALL_THICKNESS, CANVAS_HEIGHT, { isStatic: true }),
                // Plafond
                Bodies.rectangle(CANVAS_WIDTH / 2, 0, CANVAS_WIDTH, WALL_THICKNESS, { isStatic: true })
            ];
            World.add(engine.world, walls);

            const exitBody = Bodies.rectangle(
                mapData.exit.x,
                mapData.exit.y,
                mapData.exit.width,
                mapData.exit.height,
                {
                    isStatic: true,
                    isSensor : true, //pas de collision
                }
            )
            World.add(engine.world, [exitBody])
            const finishedPlayers = new Set<number>();
          
            //On met a jour l'etat du monde : la vitesse du joueur en fonction de son input (donc de la Hashmap PlayerInput)
            const interval = setInterval(() => {
      
                const HORIZONTAL_SPEED = 6;
                const STOP_MOUVEMENT = 0.8;


                joueurs.forEach((body, userId) => {
                    const input = playerInputs.get(userId);
                    if (!input){
                        return;
                    } 

                    if (checkPlayerReachedExit(body, userId, exitBody)){
                        finishedPlayers.add(userId);
                        World.remove(engine.world, body);
                        joueurs.delete(userId);
                        playerInputs.delete(userId);

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
                    if (input.jump && isOnGround(body, engine.world.bodies, joueurs)) {
                        Body.setVelocity(body, {
                        x: vx,
                        y: -8,
                        });
                    input.jump = false;
                    }

                    if(input.ah){ /*CHAT GPT : a refaire, bug quand on pousse vers le haut*/
                        const PUSH_RADIUS = 100; // Rayon de la poussée
                        const PUSH_FORCE = 0.3; // Force de la poussée (ajuste selon tes besoins)
                        
                        const partieCourante = parties.get(partieId); 
                        if (!partieCourante) return;
                        
                        const pusherBody = partieCourante.joueurs.get(userId);
                        if (pusherBody){
                            partieCourante.joueurs.forEach((otherBody, otherUserId) => {
                                if (otherUserId === userId) return; // Ne pas se pousser soi-même
                                
                                const dx = otherBody.position.x - pusherBody.position.x;
                                const dy = otherBody.position.y - pusherBody.position.y;
                                const distance = Math.sqrt(dx * dx + dy * dy);
                                
                                // Si le joueur est dans le rayon de poussée
                                if (distance < PUSH_RADIUS && distance > 0) {
                                    // Normaliser le vecteur de direction
                                    const dirX = dx / distance;
                                    const dirY = dy / distance;
                                    
                                    // Appliquer une force proportionnelle à la distance (plus proche = plus fort)
                                    const forceMagnitude = PUSH_FORCE * (1 - distance / PUSH_RADIUS);
                                    
                                    Body.applyForce(otherBody, otherBody.position, {
                                        x: dirX * forceMagnitude,
                                        y: dirY * forceMagnitude
                                    });
                                }
                            });
                        }

                        input.ah = false;
                    }
                });

                //console.log("nombre de joueurs : ", joueurs.size);
                //Ici, on recreer juste les joueurs. Si on veut c'est ici qu'on change de map quand les joueurs ont fini ...
                if(joueurs.size === 0 && finishedPlayers.size > 0){
                    resetPartie(partieId, finishedPlayers);
                }

                Engine.update(engine, 16);
                
                // envoyer état à tous les clients de la partie
                const etat: Record<number, PlayerState> = {};
                joueurs.forEach((body, userId) => {
                    etat[userId] = { 
                        x: body.position.x, 
                        y: body.position.y, 
                        angle: body.angle, 
                        colorPlayer : playerColors.get(userId) || "#2d7dff", // couleur par defaut si jamais 
                        pseudoPlayer : playerPseudos.get(userId) || "Joueur", //pseudo par defaut si jamais
                    };
                });

                // Ici on envoie bien qu'au gens de la room partieID
                io.to(partieId).emit("state", etat);
                //on l'a renvoie pour les nouveaux joueurs qui rejoignent 
                io.to(partieId).emit("map", {colliders : mapData.colliders, exit : mapData.exit});

                const partieCourante = parties.get(partieId); 
                if (!partieCourante) return;
                io.to(partieId).emit("drawnPlatforms", partieCourante.drawnPlatforms);
            }, 16);

            partie = { 
                engine, 
                joueurs, 
                interval, 
                mapId, 
                drawnPlatforms: [], 
                drawnBodies: []
            };
            parties.set(partieId, partie);
        }
        else {
            socket.emit("connection_not_first");
        }

        // Ajouter le joueur a la partie :(dans tous les cas si on a une connection)
        const playerBody = Bodies.rectangle(400, 0, 40, 40);
        // Empêche la rotation (important pour un joueur)
        Body.setInertia(playerBody, Infinity);
        partie.joueurs.set(userId, playerBody);
        World.add(partie.engine.world, [playerBody]);
        socket.emit("join_success");
    });



    // Actions du joueur
    // On capte juste l'action et on change la valeur de la touche dans playerInputs 
    socket.on("action", (action: string) => {

        const userId = socketToUser.get(socket.id);
        if (!userId) return;

        const input = playerInputs.get(userId);
        if (!action || !input) return;

        if (action === "left") input.left = true;
        if (action === "right") input.right = true;
        if (action === "stopLeft") input.left = false;
        if (action === "stopRight") input.right = false;
        if (action === "jump") input.jump = true;
        if (action ==="ah") input.ah = true;
    });

    socket.on("action_master", (path: Array<{ x: number; y: number }>) => {
        const userId = socketToUser.get(socket.id);
        if (!userId) return; 
        for (const [partieId, partie] of parties.entries()){
            if (partie.joueurs.has(userId)){
                createPlatformFromPath(partie, path); 
            }
        }
    });

    function createPlatformFromPath(partie: Partie, path: Array<{ x: number; y: number }>) {
        const thickness = 10;

        for (let i = 1; i < path.length; i++) {
            const p1 = path[i - 1];
            const p2 = path[i];

            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx);

            const x = (p1.x + p2.x) / 2;
            const y = (p1.y + p2.y) / 2;
      
            const segment = Bodies.rectangle(x, y, length, thickness, {
                isStatic: true,
                friction: 0.8,
                restitution: 0,
                collisionFilter: {
                category: 0x0002   // catégorie "traits"
                }
            });

            Body.setAngle(segment, angle);
            World.add(partie.engine.world, segment);
            partie.drawnPlatforms.push({
                x, y,
                width: length,
                height: thickness,
                angle
            });
        }
        //io.to(partieId).emit("map", {colliders : mapData.colliders, exit : mapData.exit});
    }

    socket.on("disconnecting", () => {
        console.log("Client déconnecté", socket.id);
      
        const userId = socketToUser.get(socket.id);
        if(!userId) return;
        socketToUser.delete(socket.id);
        userToSocket.delete(userId);
        for (const [partieId, partie] of parties.entries()) {
            const body = partie.joueurs.get(userId);
            if (body) {
                World.remove(partie.engine.world, body);
                //On supprime de tous nos dic
                partie.joueurs.delete(userId);
                playerColors.delete(userId);
                playerPseudos.delete(userId);
                playerInputs.delete(userId);
            }

            //Gestion du dico si il n'y a plus de joueurs dans le salon courant 
            if(partie.joueurs.size == 0){
                //Typage en Timer
                clearInterval(partie.interval as ReturnType<typeof setTimeout>); // Stop la boucle qui envoie les données aux clients
                parties.delete(partieId)
                console.log(`Partie "${partieId}" supprimée car plus aucun joueur dedans !`)
            }
        }
    });
});

// Démarrer le serveur - connaitre ip : hostname -I
/*httpServer.listen(port, () => {
    console.log(`[server]: Server is running at http://localhost:${port}`);
});*/
httpServer.listen(port, '0.0.0.0', () => {
    console.log(`[server]: Server is running at http://0.0.0.0:${port}`);
    console.log(`[server]: Accessible sur le réseau local à http://localhost:${port}`);
});
