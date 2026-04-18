import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Player } from './player.js';
import { Tank } from './tank.js';
import { Helicopter } from './helicopter.js';
import { Enemy } from './enemy.js';
import { Ally } from './ally.js';
import { Terrain } from './terrain.js';
import { Vegetation } from './vegetation.js';
import { Base } from './base.js';
import { Objective } from './objective.js';
import { ParticleSystem } from './particles.js';

class GameUI {
    static addKill(killer, victim, isPlayerKiller = false) {
        const feed = document.getElementById('kill-feed');
        if (!feed) return;
        const msg = document.createElement('div');
        msg.className = 'kill-msg';
        const killerClass = isPlayerKiller ? 'player' : (killer === 'ALLY' ? 'allied' : 'enemy');
        const victimClass = victim === 'ENEMY' ? 'enemy' : 'allied';
        msg.innerHTML = `<span class="${killerClass}">${killer}</span> ➔ <span class="${victimClass}">${victim}</span>`;
        feed.prepend(msg);
        setTimeout(() => msg.remove(), 5000);
    }

    static notify(text, color = '#ff0') {
        const container = document.getElementById('tactical-notify');
        if (!container) return;
        const msg = document.createElement('div');
        msg.className = 'xp-popup';
        msg.style.color = color;
        msg.innerText = text;
        container.appendChild(msg);
        setTimeout(() => msg.remove(), 2000);
    }
}

class Game {
    constructor() {
        window.game = this; // Global access for UI buttons
        this.canvas = document.querySelector('#game-canvas');
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: this.canvas, 
            antialias: true,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.minimapCanvas = document.querySelector('#minimap-canvas');
        this.minimapRenderer = new THREE.WebGLRenderer({ canvas: this.minimapCanvas });
        this.minimapRenderer.setSize(220, 220);

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x33383d);
        this.scene.fog = new THREE.FogExp2(0x33383d, 0.003);
        
        this.world = new CANNON.World();
        this.world.gravity.set(0, -25, 0);

        this.timeOfDay = 0;
        this.daySpeed = 0.05;

        this.isGameOver = false;
        this.isPlayerActive = false; 
        this.activeRadius = 200; 

        this.alliedTickets = 500;
        this.enemyTickets = 500;
        this.activeVehicle = null;

        this.initWorld();
        this.initUI();
        
        window.addEventListener('resize', () => this.onWindowResize());
        this.clock = new THREE.Clock();
        this.animate();

        GameUI.notify("MISSION STARTED: SECURE THE SECTOR", "#ff0");
    }

    initUI() {
        // Pointer Lock on click
        document.addEventListener('mousedown', () => {
            if (!this.isGameOver && !document.pointerLockElement) {
                try { this.player.requestPointerLock(); } catch (e) {}
            }
        });

        // ESC Menu
        const btnResume = document.getElementById('btn-resume');
        if (btnResume) {
            btnResume.addEventListener('click', () => {
                document.getElementById('esc-menu').classList.add('hidden');
                this.player.requestPointerLock();
            });
        }

        // --- COMMAND SYSTEM INPUTS ---
        const commandMenu = document.getElementById('command-menu');
        document.addEventListener('keydown', (e) => {
            if (e.code === 'KeyV') {
                commandMenu.classList.add('active');
                document.exitPointerLock();
            }
            if (commandMenu.classList.contains('active')) {
                if (e.code === 'Digit1') this.setSquadOrder('ADVANCE');
                if (e.code === 'Digit2') this.setSquadOrder('HOLD');
                if (e.code === 'Digit3') this.setSquadOrder('REGROUP');
            }
        });
        document.addEventListener('keyup', (e) => {
            if (e.code === 'KeyV') {
                commandMenu.classList.remove('active');
                if (this.isLoaded) this.player.requestPointerLock();
            }
        });
    }

    setSquadOrder(order) {
        GameUI.notify(`SQUAD ORDER: ${order}`, "#ff0");
        this.allies.forEach(ally => {
            if (typeof ally.setOrder === 'function') {
                ally.setOrder(order, this.player.body.position);
            }
        });
        document.getElementById('command-menu').classList.remove('active');
        this.player.requestPointerLock();
    }

    initWorld() {
        this.terrain = new Terrain(this.scene, this.world);
        this.initLights();
        this.initPhysicsMaterial();
        this.vegetation = new Vegetation(this.scene, this.world, this.terrain);
        this.particles = new ParticleSystem(this.scene);
        this.player = new Player(this.scene, this.world, this.renderer.domElement, null, this.particles);
        this.player.body.position.set(-50, 5, 40); 
        this.player.yaw = Math.PI;
        this.player.pitch = -0.1;

        this.base = new Base(this.scene, this.world, { x: -50, y: 0, z: -50 }, null, this.particles);
        this.objectives = [
            new Objective(this.scene, "ABLE", { x: 25, y: 0, z: -40 }, null),
            new Objective(this.scene, "BAKER", { x: -50, y: 0, z: 10 }, null),
            new Objective(this.scene, "CHARLIE", { x: 50, y: 0, z: 40 }, null)
        ];
        
        this.tanks = [
            new Tank(this.scene, this.world, { x: -20, y: 5, z: -80 }, null, this.particles), 
            new Tank(this.scene, this.world, { x: 0, y: 5, z: -80 }, null, this.particles)    
        ];
        this.helicopters = [new Helicopter(this.scene, this.world, { x: -20, y: 15, z: 20 }, null, this.particles)];
        
        this.spawnEnemies(15); 
        this.spawnAllies(5);
        this.initMinimap();
        this.isLoaded = true;
    }

    initLights() {
        this.ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        this.scene.add(this.ambientLight);
        this.sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
        this.sunLight.position.set(100, 200, 100);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.camera.left = -200;
        this.sunLight.shadow.camera.right = 200;
        this.sunLight.shadow.camera.top = 200;
        this.sunLight.shadow.camera.bottom = -200;
        this.sunLight.shadow.mapSize.set(2048, 2048);
        this.scene.add(this.sunLight);
    }

    initPhysicsMaterial() {
        const defaultMat = new CANNON.Material('default');
        const contactMat = new CANNON.ContactMaterial(defaultMat, defaultMat, { friction: 0.1, restitution: 0.3 });
        this.world.addContactMaterial(contactMat);
        this.world.defaultContactMaterial = contactMat;
    }

    spawnEnemies(count) {
        this.enemies = [];
        for(let i=0; i<count; i++) {
            let x, z;
            do { x = (Math.random() - 0.5) * 800; z = (Math.random() - 0.5) * 800; } 
            while (Math.sqrt((x - (-50))**2 + (z - (-50))**2) < 300); 
            let type = (Math.random() > 0.85 ? 'tank' : 'infantry');
            const enemy = new Enemy(this.scene, this.world, { x, y: 30, z }, null, type);
            const iconColor = type === 'tank' ? 0xffaa00 : 0xff0000;
            const icon = new THREE.Mesh(new THREE.CircleGeometry(type === 'tank' ? 6 : 3, 16), new THREE.MeshBasicMaterial({ color: iconColor }));
            icon.rotation.x = -Math.PI / 2; icon.layers.set(1); this.scene.add(icon);
            enemy.minimapIcon = icon; 
            enemy.onKilledByPlayer = () => {
                GameUI.addKill("YOU", enemy.type.toUpperCase(), true);
                GameUI.notify("+100 ENEMY NEUTRALIZED", "#ff0");
            };
            this.enemies.push(enemy);
        }
    }

    spawnAllies(count) {
        this.allies = [];
        for(let i=0; i<count; i++) {
            const x = -40 + (Math.random() - 0.5) * 20; const z = -40 + (Math.random() - 0.5) * 20;
            const ally = new Ally(this.scene, this.world, { x, y: 5, z }, null);
            const icon = new THREE.Mesh(new THREE.CircleGeometry(2, 16), new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
            icon.rotation.x = -Math.PI / 2; icon.layers.set(1); this.scene.add(icon);
            ally.minimapIcon = icon; this.allies.push(ally);
        }
    }

    initMinimap() {
        this.minimapSize = 80;
        this.minimapCamera = new THREE.OrthographicCamera(-this.minimapSize, this.minimapSize, this.minimapSize, -this.minimapSize, 1, 1000);
        this.minimapCamera.position.set(0, 200, 0);
        this.minimapCamera.lookAt(0, 0, 0);
        this.minimapCamera.up.set(0, 0, -1);
        this.playerIcon = new THREE.Mesh(new THREE.CircleGeometry(3, 16), new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
        this.playerIcon.rotation.x = -Math.PI / 2; this.playerIcon.layers.set(1); this.scene.add(this.playerIcon);
    }

    onWindowResize() {
        if (this.player) {
            this.player.camera.aspect = window.innerWidth / window.innerHeight;
            this.player.camera.updateProjectionMatrix();
        }
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    updateCulling() {
        if (!this.player) return;
        const playerPos = this.player.body.position;
        if (this.vegetation && this.vegetation.objects) {
            this.vegetation.objects.forEach(obj => {
                const distSq = playerPos.distanceSquared(obj.body.position);
                const shouldBeActive = distSq < this.activeRadius * this.activeRadius;
                if (shouldBeActive && !obj.active) {
                    this.scene.add(obj.mesh);
                    this.world.addBody(obj.body);
                    obj.active = true;
                } else if (!shouldBeActive && obj.active) {
                    this.scene.remove(obj.mesh);
                    this.world.removeBody(obj.body);
                    obj.active = false;
                }
            });
        }
    }

    animate() {
        if (this.isGameOver) return;
        requestAnimationFrame(() => this.animate());
        const delta = this.clock.getDelta();

        if (this.player && !this.isPlayerActive) {
            const vel = this.player.body.velocity;
            if (Math.abs(vel.x) > 0.1 || Math.abs(vel.z) > 0.1) this.isPlayerActive = true;
        }

        this.updateCulling();
        this.world.step(1/60, delta, 10);
        this.base.update(delta, this.clock.elapsedTime);
        this.particles.update(delta, this.player.camera);
        
        this.objectives.forEach(obj => {
            const oldOwner = obj.owner;
            obj.update(delta, [this.player, ...this.allies], this.enemies);
            if (obj.owner !== oldOwner && obj.owner === 'allied') {
                GameUI.notify(`OBJECTIVE ${obj.name} SECURED`, "#0f0");
            } else if (obj.owner !== oldOwner && obj.owner === 'enemy') {
                GameUI.notify(`OBJECTIVE ${obj.name} LOST`, "#f00");
            }
        });

        let alliedPoints = this.objectives.filter(o => o.owner === 'allied').length;
        let enemyPoints = this.objectives.filter(o => o.owner === 'enemy').length;
        if (enemyPoints > alliedPoints) this.alliedTickets -= (enemyPoints - alliedPoints) * delta * 2;
        if (alliedPoints > enemyPoints) this.enemyTickets -= (alliedPoints - enemyPoints) * delta * 2;
        if (this.alliedTickets <= 0 || this.enemyTickets <= 0) this.endGame();

        this.world.bodies.forEach(body => { if(body.mesh) { body.mesh.position.copy(body.position); body.mesh.quaternion.copy(body.quaternion); } });
        
        if (this.activeVehicle) {
            this.activeVehicle.update(delta, this.player.moveState, this.player.camera);
            const targetPos = new THREE.Vector3();
            const anchor = (this.activeVehicle.isSniperMode && this.activeVehicle.sniperCameraAnchor) ? 
                this.activeVehicle.sniperCameraAnchor : this.activeVehicle.chaseCameraAnchor;
            anchor.getWorldPosition(targetPos);
            this.player.camera.position.lerp(targetPos, 0.1);
            if (this.activeVehicle.isSniperMode) {
                const targetRot = new THREE.Quaternion(); anchor.getWorldQuaternion(targetRot);
                this.player.camera.quaternion.slerp(targetRot, 0.2);
            } else {
                const lookAtPos = new THREE.Vector3();
                if (this.activeVehicle instanceof Tank) this.activeVehicle.turretGroup.getWorldPosition(lookAtPos);
                else this.activeVehicle.group.getWorldPosition(lookAtPos);
                this.player.camera.lookAt(lookAtPos);
            }
            this.player.body.position.copy(this.activeVehicle.body.position);
        } else { this.player.update(delta, this.terrain); }

        const playerPos = this.activeVehicle ? this.activeVehicle.body.position : this.player.body.position;
        this.allies.forEach(ally => ally.update(delta, playerPos, this.enemies, this.objectives, this.isPlayerActive));
        
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            enemy.update(delta, playerPos, this.player);
            if (enemy.isDead && !enemy.wasCounted) {
                if (enemy.onKilledByPlayer) enemy.onKilledByPlayer();
                enemy.wasCounted = true;
            }
        }

        this.updateUIGameplay(playerPos);
        this.renderer.render(this.scene, this.player.camera);
        this.minimapCamera.position.set(playerPos.x, 200, playerPos.z);
        this.playerIcon.position.set(playerPos.x, 101, playerPos.z);
        this.minimapRenderer.render(this.scene, this.minimapCamera);
    }

    updateUIGameplay(playerPos) {
        document.getElementById('health').innerText = `HP: ${Math.ceil(this.player.health)}`;
        let ammoText = `TICKETS: ALLY ${Math.ceil(this.alliedTickets)} | AXIS ${Math.ceil(this.enemyTickets)}`;
        if (this.activeVehicle) {
            ammoText += ` | VEHICLE: HP ${Math.ceil(this.activeVehicle.health)}`;
        } else {
            const w = this.player.weapons[this.player.currentWeaponIndex];
            ammoText += ` | AMMO: ${w.ammo}/${w.reserve}`;
        }
        document.getElementById('ammo').innerText = ammoText;
    }

    endGame() {
        this.isGameOver = true;
        const victory = this.enemyTickets <= 0;
        const endScreen = document.createElement('div');
        endScreen.className = 'overlay';
        endScreen.innerHTML = `<h1>${victory ? 'MISSION ACCOMPLISHED' : 'MISSION FAILED'}</h1><button onclick="location.reload()">REDEPLOY</button>`;
        document.body.appendChild(endScreen);
        document.exitPointerLock();
    }
}
new Game();
