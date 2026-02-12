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
import { log } from "console";
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

const BASE_SIZE = 40;
const BASE_SPEED = 6;

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
        exit: { x: 700, y: 350, width: 50, height: 50 },
        beginPos: { x: 250 , y: 250, width: 10, height: 10 },
    },
    "map2": { 
        name: "Map escalier", 
        colliders : [
            { x: 400, y: 580, width: 800, height: 40 },
            { x: 250, y: 500, width: 200, height: 20 },
            { x: 150, y: 420, width: 160, height: 20 },
            { x: 300, y: 340, width: 120, height: 20 },
        ],
        exit: { x: 350, y: 290, width: 50, height: 50 },
        beginPos: { x: 42 , y: 42, width: 60, height: 60 },
    },
    "map3": {
        name: "map avec vide",
        colliders : [
            {x: 743, y: 82, width: 120, height: 5},
            {x: 743, y: 470, width: 120, height: 5},
            {x: 512, y: 512, width: 240, height: 5},
            {x: 13, y: 400, width: 40, height: 5},
            {x: 13, y: 400, width: 40, height: 5},
            {x: 50, y: 80, width: 120, height: 5},
            {x: 170, y: 180, width: 120, height: 5},
            {x: 170, y: 280, width: 120, height: 5},
            {x: 230, y: 160, width: 5, height: 310},
            {x: 330, y: 176, width: 120, height: 5, angle : 40},
            {x: 550, y: 340, width: 250, height: 5, angle : 40},
        ],
        exit: {x: 750, y: 30, width: 50, height: 50},
        beginPos: { x: 42 , y: 42, width: 40, height: 40 },
    },
    "map4": {
        name: "map bateau",
        colliders :[
            {x: 400, y: 500, width: 500, height: 5},
            {x: 400, y: 350, width: 5, height: 300},
            {x: 350, y: 250, width: 5, height: 150, angle : 45},
            {x: 450, y: 250, width: 5, height: 150, angle : -45},
            {x: 400, y: 300, width: 200, height: 5},
            {x: 600, y: 550, width: 5, height: 150, angle : 45},
            {x: 200, y: 550, width: 5, height: 150, angle : -45},
        ],
        exit: {x: 400, y: 40, width: 50, height: 50},
        beginPos: { x: 300 , y: 450, width: 40, height: 40 },
    },
    "map5": {
        name: "Escaliers montants",
        colliders: [
            // Escalier en montée
            {x: 100, y: 550, width: 150, height: 5},
            {x: 200, y: 480, width: 150, height: 5},
            {x: 300, y: 410, width: 150, height: 5},
            {x: 400, y: 340, width: 150, height: 5},
            {x: 500, y: 270, width: 150, height: 5},
            {x: 600, y: 200, width: 150, height: 5},
            // Plateforme finale
            {x: 700, y: 130, width: 150, height: 5},
        ],
        exit: {x: 730, y: 80, width: 50, height: 50},
        beginPos: {x: 80, y: 500, width: 40, height: 40},
    },

    "map6": {
        name: "Zigzag vertical",
        colliders: [
            // Mur gauche
            {x: 5, y: 300, width: 5, height: 600},
            // Mur droit
            {x: 795, y: 300, width: 5, height: 600},
            // Plateformes en zigzag
            {x: 150, y: 550, width: 250, height: 5},
            {x: 550, y: 450, width: 250, height: 5},
            {x: 150, y: 350, width: 250, height: 5},
            {x: 550, y: 250, width: 250, height: 5},
            {x: 150, y: 150, width: 250, height: 5},
            {x: 550, y: 50, width: 250, height: 5},
        ],
        exit: {x: 720, y: 10, width: 50, height: 50},
        beginPos: {x: 50, y: 500, width: 40, height: 40},
    },

    "map7": {
        name: "Labyrinthe simple",
        colliders: [
            // Murs extérieurs
            {x: 400, y: 5, width: 800, height: 5},      // haut
            {x: 400, y: 595, width: 800, height: 5},    // bas
            {x: 5, y: 300, width: 5, height: 600},      // gauche
            {x: 795, y: 300, width: 5, height: 600},    // droite
            
            // Murs internes
            //{x: 200, y: 150, width: 5, height: 300},
            {x: 400, y: 450, width: 5, height: 300},
            {x: 300, y: 300, width: 200, height: 5},
            {x: 600, y: 200, width: 5, height: 400},
            {x: 500, y: 100, width: 200, height: 5},
        ],
        exit: {x: 750, y: 550, width: 50, height: 50},
        beginPos: {x: 50, y: 50, width: 40, height: 40},
    },

    "map8": {
        name: "Saut de foi",
        colliders: [
            // Plateforme de départ
            {x: 100, y: 550, width: 200, height: 5},
            {x: 100, y: 500, width: 5, height: 100},
            
            // Petites plateformes suspendues
            {x: 350, y: 450, width: 80, height: 5},
            {x: 450, y: 350, width: 80, height: 5},
            {x: 350, y: 250, width: 80, height: 5},
            {x: 550, y: 200, width: 80, height: 5},
            
            // Plateforme d'arrivée
            {x: 700, y: 150, width: 200, height: 5},
            {x: 795, y: 200, width: 5, height: 100},
        ],
        exit: {x: 730, y: 100, width: 50, height: 50},
        beginPos: {x: 80, y: 500, width: 40, height: 40},
    },

    "map9": {
        name: "Tunnel en V",
        colliders: [
            // Tunnel descendant gauche
            {x: 150, y: 200, width: 5, height: 400},
            {x: 250, y: 200, width: 5, height: 400},
            //{x: 200, y: 50, width: 200, height: 5},
            
            // Fond du V
            {x: 300, y: 500, width: 200, height: 5, angle: 30},
            {x: 500, y: 500, width: 200, height: 5, angle: -30},
            
            // Tunnel montant droit
            {x: 550, y: 200, width: 5, height: 400},
            {x: 650, y: 200, width: 5, height: 400},
            //{x: 600, y: 50, width: 200, height: 5},
        ],
        exit: {x: 600, y: 20, width: 50, height: 50},
        beginPos: {x: 180, y: 20, width: 40, height: 40},
    },

    "map10": {
        name: "Obstacles diagonaux",
        colliders: [
            // Sol
            {x: 400, y: 590, width: 800, height: 5},
            
            // Barres diagonales croisées
            {x: 200, y: 400, width: 5, height: 300, angle: 45},
            {x: 300, y: 400, width: 5, height: 300, angle: -45},
            
            {x: 450, y: 300, width: 5, height: 300, angle: 45},
            {x: 550, y: 300, width: 5, height: 300, angle: -45},
            
            {x: 700, y: 400, width: 5, height: 300, angle: 45},
            {x: 800, y: 400, width: 5, height: 300, angle: -45},
            
            // Plateforme d'arrivée en hauteur
            {x: 400, y: 50, width: 200, height: 5},
        ],
        exit: {x: 400, y: 10, width: 50, height: 50},
        beginPos: {x: 30, y: 540, width: 40, height: 40},
    },

    "map11": {
        name: "Chambre avec piliers",
        colliders: [
            // Murs de la chambre
            {x: 400, y: 10, width: 700, height: 5},     // haut
            {x: 400, y: 590, width: 700, height: 5},    // bas
            {x: 50, y: 300, width: 5, height: 580},     // gauche
            {x: 750, y: 300, width: 5, height: 580},    // droite
            
            // Piliers (obstacles)
            {x: 200, y: 200, width: 60, height: 60},
            {x: 400, y: 200, width: 60, height: 60},
            {x: 600, y: 200, width: 60, height: 60},
            
            {x: 300, y: 400, width: 60, height: 60},
            {x: 500, y: 400, width: 60, height: 60},
        ],
        exit: {x: 700, y: 550, width: 50, height: 50},
        beginPos: {x: 100, y: 550, width: 40, height: 40},
    },
};

const mapOrder = Object.keys(maps);

const KILL_Y = 2000; // à adapter à la taille de ta map

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
// clé userId - valeur : score actuel
const playersScore = new Map<number, number>();

const ahCooldown = new Map<number, number>(); // userId -> timestamp du prochain ah autorisé
const AH_COOLDOWN_MS = 1500; // 1.5 secondes

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

app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(sessionMiddleware);

io.use((socket, next) => {
    // @ts-ignore
    sessionMiddleware(socket.request, {}, next);
});


// Page de login
app.get("/login", (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname,"..","public","login.html"));
});

// MIDDLEWARE GLOBAL : toutes les requêtes GET renvoient sur /login
app.use((req, res, next) => {
    // Autoriser les fichiers statiques (CSS, JS, images, etc.)
    if (req.path.endsWith(".css") ||
        req.path.endsWith(".js") ||
        req.path.endsWith(".png") ||
        req.path.endsWith(".jpg") ||
        req.path.endsWith(".jpeg") ||
        req.path.endsWith(".gif") ||
        req.path.endsWith(".svg") ||
        req.path.endsWith(".ico")) {
        next();
        return;
    }
    
    // Autoriser les routes POST et les fichiers statiques essentiels
    if (req.method === "POST" || req.path.startsWith("/auth/")) {
        next();
        return;
    }

    // Vérifier si connecté pour toutes les autres routes
    if (req.method === "GET" && !req.session.userId && req.path !== "/login") {
    res.redirect("/login");
        return;
    }

    next();
});

// Page d'accueil
app.get("/", (req: Request, res: Response) => {
    res.redirect("/lobby.html");
        return;
});

// Page d'accueil
app.get("/lobby", (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname,"..","public","partie.html"));
        return;
});

// Page partie
app.get("/partie", (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname,"..","public","partie.html"));
    console.log(`[server]: Un client essaye de se connecter a partie`);
});

app.use(express.static(path.join(__dirname,"..","public")));

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


// RECUPERATION DES PARTIES EN COURS (LOBBY)
app.get("/parties", (req, res) => {
    const partiesEnCours = Array.from(parties.entries()).map(([id, partie]) => ({
        id,
        mapId: partie.mapId,
        nom: partie.mapData.name,
        nbJoueurs: partie.joueurs.size // C'est pas bon
    }));

    console.log("Parties en cours :", partiesEnCours);

    res.json(partiesEnCours);   
});

//Sert a détecter le sol pour éviter de sauter dans les airs et donc limiter les double ou triple sauts
function isOnGround(body: Matter.Body, bodies: Matter.Body[], joueurs : Map<number, Matter.Body>) {
    const footY = body.bounds.max.y;
    const tolerance = 6;
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

        const deltaY = Math.abs(b.bounds.min.y - footY);
        if (deltaY >= tolerance) return false;
        
        //C'est magique le .some, des qu'on a trouvé la condition, ca return sinon ca continue
        // donc si la condition en bas est true, on a trouvé un rectangle statique en dessous de nous donc on renvoie ture
        return pointsX.some(x => 
            x > b.bounds.min.x &&
            x < b.bounds.max.x 
        );
    });
    //Si deja au sol
    if (onStaticBody) return true;

    //collision avec les autres joueurs 
    const onOtherPlayer = Array.from(joueurs.values()).some(otherBody => { //meme principe mais avec les joueurs 
        if (otherBody === body) return false;
        
        const deltaY = Math.abs(otherBody.bounds.min.y - footY);
        if (deltaY >= tolerance) return false;
        
        return pointsX.some(x =>
            x > otherBody.bounds.min.x &&
            x < otherBody.bounds.max.x
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
    const now = Date.now();

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
            angle,
            createdAt: now // Ajouter le timestamp
        });
        partie.drawnBodies.push(segment);
    }
}

function resetPartie(partieId: string, finishedPlayers : Set<number>){
    const partieCourante = parties.get(partieId); 
    if (!partieCourante) return;
    partieCourante.isResetting = true;

    console.log("Tous les joueurs ont fini ! Rechargement des joueurs sur la partie :", partieId);
    const oldMaster = partieCourante.gameMaster;

    if (oldMaster !== undefined) {
        playersScore.set(oldMaster, 0); 
    }
    //CHANGEMENT DE GAME MASTER 
    const newIdGameMaster = getLeader();
    partieCourante.gameMaster = newIdGameMaster;
    console.log("Nouveau GameMaster:", newIdGameMaster);
    io.to(partieId).emit("game_master", partieCourante.gameMaster);

    partieCourante.drawnBodies.forEach(b => {
        World.remove(partieCourante.engine.world, b);
    });
    partieCourante.mapBodies.forEach(c =>{
        World.remove(partieCourante.engine.world, c);
    });
    
    partieCourante.drawnPlatforms.length = 0;
    partieCourante.drawnBodies.length = 0;
    partieCourante.platformsChanged = false;

    partieCourante.mapIndex = (partieCourante.mapIndex + 1) % mapOrder.length;
    const nextMapId = mapOrder[partieCourante.mapIndex];
    const newMapData = maps[nextMapId];
    partieCourante.mapId = nextMapId;
    partieCourante.mapData = newMapData;
    
    const newMapBodies: Matter.Body[] = [];
    newMapData.colliders.forEach(g => {
        const ground = Bodies.rectangle(g.x, g.y, g.width, g.height, { isStatic: true, angle: g.angle ? (g.angle * Math.PI/180) : 0});
        World.add(partieCourante.engine.world, [ground]);
        newMapBodies.push(ground);
    });

    const exitBody = Bodies.rectangle(newMapData.exit.x, newMapData.exit.y, newMapData.exit.width, newMapData.exit.height, { isStatic: true, isSensor: true });
    partieCourante.exitBody = exitBody;
    World.add(partieCourante.engine.world, exitBody);
    newMapBodies.push(exitBody);

    partieCourante.mapBodies = newMapBodies; 


    finishedPlayers.forEach((userId) => {
        //J'ai rajouter ça pour ramettre uniquement ceux qui sont encore connecté. 
        const socketId = userToSocket.get(userId);
        if (!socketId) return;

        const playerBody = Bodies.rectangle(
            partieCourante.mapData.beginPos.x,
            partieCourante.mapData.beginPos.y,
            partieCourante.mapData.beginPos.width,
            partieCourante.mapData.beginPos.height,
            {
                friction :0,
                frictionAir :0.01,
                frictionStatic :0,
            }
        );

        Body.setInertia(playerBody, Infinity);
        partieCourante.joueurs.set(userId, playerBody);
        World.add(partieCourante.engine.world, [playerBody]);
        // Remettre les inputs à zéro
        playerInputs.set(userId, { left: false, right: false, jump: false, ah: false});
    });
    finishedPlayers.clear();
    
    io.to(partieId).emit("playerSize", partieCourante.mapData.beginPos.width);
   
    io.to(partieId).emit("full_reset", {
        gameMaster: partieCourante.gameMaster,
        drawnPlatforms: partieCourante.drawnPlatforms,
        map: {colliders: partieCourante.mapData.colliders, exit: partieCourante.mapData.exit}
    });
    
    partieCourante.isResetting = false;
    updateLeaderboard(partieId);
}

function getLeader(): number | undefined {
    let bestId: number | undefined = undefined;
    let bestScore = -Infinity;

    for (const [userId, score] of playersScore.entries()) {
        if (score > bestScore) {
            bestScore = score;
            bestId = userId;
        }
    }
    return bestId;
}

function updateLeaderboard(partieId: string) {
    const leaderboard = [];
    for (const [userId, score] of playersScore.entries()) {
        leaderboard.push({
            userId,
            score,
            pseudo: playerPseudos.get(userId) || "?"
        });
    }
    leaderboard.sort((a, b) => b.score - a.score);
    
    const partieCourante = parties.get(partieId);
    if (partieCourante) {
        io.to(partieId).emit("leaderboard", {
            leaderboard,
            gameMaster: partieCourante.gameMaster
        });
    }
}

function killPlayer(partie: Partie, userId: number, finishedPlayers : Set<number>){
    const body = partie.joueurs.get(userId);
    if (!body) return;

    finishedPlayers.add(userId);
    World.remove(partie.engine.world, body);
    partie.joueurs.delete(userId);
    playerInputs.delete(userId);
}

function cleanOldPlatforms(partie: Partie, maxAge: number = 5000) {
    const now = Date.now();
    let i = 0;
    let hasRemoved = false;

    while (i < partie.drawnPlatforms.length) {
        const platform = partie.drawnPlatforms[i];
        
        if (platform.createdAt && (now - platform.createdAt) > maxAge) {
            // Supprimer du monde physique
            const body = partie.drawnBodies[i];
            if (body) {
                World.remove(partie.engine.world, body);
            }
            
            // Supprimer des arrays
            partie.drawnPlatforms.splice(i, 1);
            partie.drawnBodies.splice(i, 1);
            
            hasRemoved = true;
            
            // Ne pas incrémenter i car l'élément suivant a pris la place de l'actuel
        } else {
            // Seulement incrémenter si on n'a pas supprimé
            i++;
        }
    }

    // Notifier les clients qu'il y a eu des changements
    if (hasRemoved) {
        partie.platformsChanged = true;
    }
}

// Socket.IO
// On a creer un serveur http et on connecte les joueurs (client html) qui se connecte sur la page partie. Ils sont ensuite mis dans la partie
// correspondant à leur demande et sont connecté via socket avec socket.io
io.on("connection", (socket) => {
    console.log("Client connecté", socket.id);

   // Rejoindre le lobby
    socket.on("lobby", () => {
        socket.emit("lobby_success");
    });

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
      
        playersScore.set(userId, 0);

        socket.emit("your_id", userId);

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
            const mapBodies: Matter.Body[] = [];
            const finishedPlayers = new Set<number>();

            // Créer le sol
            mapData.colliders.forEach(g => {
                const ground = Bodies.rectangle(g.x, g.y, g.width, g.height, { isStatic: true, angle: g.angle ? (g.angle * Math.PI / 180) : 0 });
                World.add(engine.world, [ground]);
                mapBodies.push(ground);
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
            //mapBodies.push(...walls);

            const exitBody = Bodies.rectangle(
                mapData.exit.x,
                mapData.exit.y,
                mapData.exit.width,
                mapData.exit.height,
                {
                    isStatic: true,
                    isSensor : true, //pas de collision
                }
            );
            World.add(engine.world, [exitBody]);
            mapBodies.push(exitBody);
            
            //On met a jour l'etat du monde : la vitesse du joueur en fonction de son input (donc de la Hashmap PlayerInput)
            const interval = setInterval(() => {
                const partieCourante = parties.get(partieId);
                if (!partieCourante) return;
                if (partieCourante.isResetting) return;
      
                cleanOldPlatforms(partieCourante, 5000);


                const SPEED_FACTOR = Math.max(0.5, Math.min(2, BASE_SIZE / partieCourante.mapData.beginPos.width));
                const HORIZONTAL_SPEED = BASE_SPEED * SPEED_FACTOR; 
                const STOP_MOUVEMENT = 0.8;

                const toRemove: number[] = [];

                joueurs.forEach((body, userId) => {
                    const input = playerInputs.get(userId);
                    if (!input) return; 

                    if (checkPlayerReachedExit(body, userId, partieCourante.exitBody)){
                        let curScore = playersScore.get(userId);
                        if (curScore === undefined){
                            console.warn("Score manquant pour", userId);
                            playersScore.set(userId, 0);
                        }
                        else {
                            switch (finishedPlayers.size){
                                case 0 :
                                    //Le joueur a finit premier
                                    playersScore.set(userId, curScore + 20);
                                    break ;
                                case 1: 
                                    playersScore.set(userId, curScore + 16);
                                    break;
                                case 2:
                                    playersScore.set(userId, curScore + 13);
                                    break;
                                default :
                                    playersScore.set(userId, curScore + 10);
                                    break;
                            }

                        }
                        
                        console.log(playersScore.get(userId));
                        finishedPlayers.add(userId);
                        toRemove.push(userId);
                        updateLeaderboard(partieId);
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

                for (const userId of toRemove) {
                    const body = joueurs.get(userId);
                    if (body) {
                        World.remove(engine.world, body);
                        joueurs.delete(userId);
                        playerInputs.delete(userId);
                    }
                }

                //Gestion des joueurs tombés 
                for (const [userId, body] of partieCourante.joueurs.entries()) {
                    if (body.position.y > KILL_Y) {
                        //finishedPlayers.add(userId);
                        //toRemove.push(userId);
                        killPlayer(partieCourante, userId, finishedPlayers);
                    }
                }

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
                //io.to(partieId).emit("map", {colliders : mapData.colliders, exit : mapData.exit});

                //io.to(partieId).emit("drawnPlatforms", partieCourante.drawnPlatforms);
                if (partieCourante.platformsChanged) {
                    io.to(partieId).emit("drawnPlatforms", partieCourante.drawnPlatforms);
                    partieCourante.platformsChanged = false;
                }
            }, 16);

            partie = { 
                engine, 
                joueurs, 
                interval, 
                mapId, 
                drawnPlatforms: [], 
                drawnBodies: [],
                mapBodies,
                exitBody,
                gameMaster : userId,
                isResetting: false,
                platformsChanged: false,
                mapData,
                mapIndex : mapOrder.indexOf(mapId),
            };
            //partie.gameMaster = userId;   // le premier devient Game Master
            console.log("Nouveau GameMaster:", userId);
            io.to(partieId).emit("game_master", userId);

            parties.set(partieId, partie);
            socket.emit("map", {colliders: mapData.colliders, exit: mapData.exit});
        }
        else {
            socket.emit("connection_not_first");
            if (partie.gameMaster !== undefined) {
                socket.emit("game_master", partie.gameMaster);
            }
            socket.emit("map",{colliders: partie.mapData.colliders, exit: partie.mapData.exit});
            socket.emit("drawnPlatforms", partie.drawnPlatforms);
        }

        // Ajouter le joueur a la partie :(dans tous les cas si on a une connection)
        const playerBody = Bodies.rectangle(
            partie.mapData.beginPos.x,
            partie.mapData.beginPos.y,
            partie.mapData.beginPos.width,
            partie.mapData.beginPos.height,
            {
                friction :0,
                frictionAir :0.01,
                frictionStatic :0,
            }
        );
        socket.emit("playerSize", partie.mapData.beginPos.width);
        // Empêche la rotation (important pour un joueur)
        Body.setInertia(playerBody, Infinity);
        partie.joueurs.set(userId, playerBody);
        World.add(partie.engine.world, [playerBody]);
        socket.emit("join_success");
        updateLeaderboard(partieId);
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
        if (action ==="ah"){
            const now = Date.now();
            const nextAllowed = ahCooldown.get(userId) || 0;
            if (now < nextAllowed){
                socket.emit("ah_refuse", {remaining : nextAllowed - now});
                return;
            }
            ahCooldown.set(userId, now + AH_COOLDOWN_MS); // on remet le cooldown vu qu'il vient de l'utiliser.
            input.ah = true;
            socket.emit("ah_ok", {cooldown : AH_COOLDOWN_MS}); //pour gerer le cooldown du gars précisément
            //partieCourante = parties.get(userId);
            //io.to(partieId).emit("ah_ok", { userId }); // pour l'affichage pour tous
        }
    });

    socket.on("action_master", (path: Array<{ x: number; y: number }>) => {
        const userId = socketToUser.get(socket.id);
        if (!userId) return; 
        for (const partie of parties.values()){
            //if (!partie.joueurs.has(userId)) continue;
            if (partie.gameMaster !== userId) continue;

            createPlatformFromPath(partie, path); 
            partie.platformsChanged = true;
        }
    });


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
                playersScore.delete(userId);     
                ahCooldown.delete(userId);
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
httpServer.listen(port, '0.0.0.0', () => {
    console.log(`[server]: Server is running at http://0.0.0.0:${port}`);
    console.log(`[server]: Accessible sur le réseau local à http://localhost:${port}`);
});
