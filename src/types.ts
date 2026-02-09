import * as Matter from "matter-js";

export interface User {
    id: number;
    identifiant: string;
    pseudo: string;
    color: string;
    password_hash?: string;
}

export interface UserLogin {
    id: number;
    password_hash: string;
}

export interface UserProfile {
    identifiant: string;
    pseudo: string;
    color: string;
}

export interface PlayerInput {
    left: boolean;
    right: boolean;
    jump: boolean;
    ah: boolean;
}

export interface RectCollider {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface MapData {
    name: string;
    colliders: RectCollider[];
    exit: RectCollider;
}

export interface DrawnPlatform {
    x: number;
    y: number;
    width: number;
    height: number;
    angle: number;
}

export interface Partie {
    engine: Matter.Engine;
    joueurs: Map<number, Matter.Body>;
    interval: NodeJS.Timer;
    mapId: string;
    drawnPlatforms: DrawnPlatform[];
    drawnBodies : Matter.Body[];
}

export interface PlayerState {
    x: number;
    y: number;
    angle: number;
    colorPlayer: string;
    pseudoPlayer: string;
}

export interface JoinData {
    partieId: string;
    mapId: string;
}

export interface ActionData {
    action: string;
}

export interface DrawPlatformData {
    x: number;
    y: number;
}