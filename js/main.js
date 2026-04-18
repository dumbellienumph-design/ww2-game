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
import { AudioManager } from './audio.js';
import { Objective } from './objective.js';
import { ParticleSystem } from './particles.js';

class Game {
    constructor() {
        this.canvas = document.querySelector('#game-canvas');
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.devicePixelRatio || 1);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.minimapCanvas = document.querySelector('#minimap-canvas');
        this.minimapRenderer = new THREE.WebGLRenderer({ canvas: this.minimapCanvas, antialias: true });
        this.minimapRenderer.setSize(200, 200);

        this.scene = new THREE.Scene();
        this.world = new CANNON.World();
        this.world.gravity.set(0, -25, 0);

        this.timeOfDay = 0;
        this.daySpeed = 0.05;

        this.initLights();
        this.initPhysicsMaterial();
        this.terrain = new Terrain(this.scene, this.world);
        this.vegetation = new Vegetation(this.scene, this.world, this.terrain);
        
        // --- PARTICLE SYSTEM ---
        this.particles = new ParticleSystem(this.scene);

        this.player = new Player(this.scene, this.world, this.renderer.domElement, null, this.particles);
        this.player.body.position.set(-50, 5, -50); 

        this.audio = new AudioManager(this.player.camera);
        this.player.audio = this.audio;
        this.initAudio();

        this.base = new Base(this.scene, this.world, { x: -50, y: 0, z: -50 }, this.audio);

        this.tanks = [
            new Tank(this.scene, this.world, { x: -20, y: 5, z: -80 }, this.audio, this.particles), 
            new Tank(this.scene, this.world, { x: -10, y: 5, z: -80 }, this.audio, this.particles), 
            new Tank(this.scene, this.world, { x: 0, y: 5, z: -80 }, this.audio, this.particles)    
        ];
        this.helicopters = [new Helicopter(this.scene, this.world, { x: -20, y: 15, z: 20 }, this.audio, this.particles)];
        this.enemies = [];
        this.allies = [];
        this.activeVehicle = null;

        this.alliedTickets = 500;
        this.enemyTickets = 500;
        this.isGameOver = false;

        this.objectives = [
            new Objective(this.scene, "ABLE", { x: 25, y: 0, z: -40 }, this.audio),
            new Objective(this.scene, "BAKER", { x: -50, y: 0, z: 10 }, this.audio),
            new Objective(this.scene, "CHARLIE", { x: 50, y: 0, z: 40 }, this.audio)
        ];

        this.initMinimap();
        this.spawnEnemies(12);
        this.spawnAllies(5);
        this.initUI();
        
        window.addEventListener('resize', () => this.onWindowResize());
        this.clock = new THREE.Clock();
        this.animate();
    }

    async initAudio() {
        await this.audio.loadSound('anthem', 'https://cdn.freesound.org/previews/235/235653_3534964-lq.mp3', false, true, 0.5);
        await this.audio.loadSound('ui_click', 'https://cdn.freesound.org/previews/256/256113_3263906-lq.mp3', false, false, 0.4);
        await this.audio.loadSound('rifle_fire', 'https://cdn.freesound.org/previews/146/146747_2437358-lq.mp3', false, false, 0.8);
        await this.audio.loadSound('rifle_cycle', 'https://cdn.freesound.org/previews/218/218151_2210086-lq.mp3', false, false, 0.6);
        await this.audio.loadSound('bullet_whiz', 'https://cdn.freesound.org/previews/192/192138_1066060-lq.mp3', false, false, 0.5);
        await this.audio.loadSound('tank_engine', 'https://cdn.freesound.org/previews/320/320661_5250656-lq.mp3', false, true, 0.6);
        await this.audio.loadSound('tank_fire', 'https://cdn.freesound.org/previews/146/146747_2437358-lq.mp3', false, false, 0.9);
        await this.audio.loadSound('tank_tracks', 'https://cdn.freesound.org/previews/261/261763_4933934-lq.mp3', false, true, 0.3);
        await this.audio.loadSound('tank_reload', 'https://cdn.freesound.org/previews/263/263004_4933934-lq.mp3', false, false, 0.7);
        await this.audio.loadSound('heli_engine', 'https://cdn.freesound.org/previews/337/337346_4221199-lq.mp3', false, true, 0.6);
        await this.audio.loadSound('heli_fire', 'https://cdn.freesound.org/previews/253/253381_4474943-lq.mp3', false, false, 0.5);
        await this.audio.loadSound('explosion_blast', 'https://cdn.freesound.org/previews/103/103213_746654-lq.mp3', false, false, 0.9);
        await this.audio.loadSound('explosion_debris', 'https://cdn.freesound.org/previews/563/563148_1066060-lq.mp3', false, false, 0.6);
        await this.audio.loadSound('base_hum', 'https://cdn.freesound.org/previews/212/212134_4083377-lq.mp3', true, true, 0.3);
        await this.audio.loadSound('ambient_wind', 'https://cdn.freesound.org/previews/458/458021_9228514-lq.mp3', false, true, 0.3);
        await this.audio.loadSound('reinforcement', 'https://cdn.freesound.org/previews/369/369932_6081467-lq.mp3', false, false, 0.7);
    }

    initLights() {
        this.ambientLight = new THREE.AmbientLight(0xd0e0e3, 0.4);
        this.scene.add(this.ambientLight);
        this.sunLight = new THREE.DirectionalLight(0xfff5e6, 0.8);
        this.sunLight.position.set(100, 150, 50);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.set(2048, 2048);
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 500;
        const d = 150;
        this.sunLight.shadow.camera.left = -d; this.sunLight.shadow.camera.right = d;
        this.sunLight.shadow.camera.top = d; this.sunLight.shadow.camera.bottom = -d;
        this.scene.add(this.sunLight);
    }

    updateEnvironment(delta) {
        this.timeOfDay += delta * this.daySpeed;
        const sunX = Math.cos(this.timeOfDay) * 200;
        const sunY = Math.sin(this.timeOfDay) * 200;
        this.sunLight.position.set(sunX, sunY, 50);
        const isDay = sunY > 0;
        const dayFactor = Math.max(0, Math.min(1, sunY / 50));
        this.sunLight.intensity = dayFactor * 0.8;
        this.ambientLight.intensity = 0.1 + (dayFactor * 0.3);
        const dayColor = new THREE.Color(0x8899a6);
        const nightColor = new THREE.Color(0x050510);
        const currentColor = dayColor.clone().lerp(nightColor, 1 - dayFactor);
        this.scene.background = currentColor;
        this.scene.fog.color = currentColor;
        if (this.base) {
            this.base.group.traverse(obj => {
                if (obj.name === 'searchlight_beam') {
                    obj.visible = !isDay || dayFactor < 0.3;
                    obj.material.opacity = (1 - dayFactor) * 0.4;
                }
            });
        }
    }

    initPhysicsMaterial() {
        const defaultMat = new CANNON.Material('default');
        const contactMat = new CANNON.ContactMaterial(defaultMat, defaultMat, { friction: 0.1, restitution: 0.3 });
        this.world.addContactMaterial(contactMat);
        this.world.defaultContactMaterial = contactMat;
    }

    spawnEnemies(count, forceType = null) {
        for(let i=0; i<count; i++) {
            let x, z;
            do { x = (Math.random() - 0.5) * 800; z = (Math.random() - 0.5) * 800; } 
            while (Math.sqrt((x - (-50))**2 + (z - (-50))**2) < 200);
            let type = forceType || (Math.random() > 0.85 ? 'tank' : (Math.random() > 0.70 ? 'aa_flak' : 'infantry'));
            const enemy = new Enemy(this.scene, this.world, { x, y: 30, z }, this.audio, type);
            const iconColor = type === 'tank' ? 0xffaa00 : (type === 'aa_flak' ? 0xffff00 : 0xff0000);
            const icon = new THREE.Mesh(new THREE.CircleGeometry(type === 'tank' ? 6 : 3, 16), new THREE.MeshBasicMaterial({ color: iconColor }));
            icon.rotation.x = -Math.PI / 2; icon.layers.set(1); this.scene.add(icon);
            enemy.minimapIcon = icon; this.enemies.push(enemy);
        }
    }

    spawnAllies(count) {
        for(let i=0; i<count; i++) {
            const x = -40 + (Math.random() - 0.5) * 40; const z = -40 + (Math.random() - 0.5) * 40;
            const ally = new Ally(this.scene, this.world, { x, y: 5, z });
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
        this.compassLabels = {};
        ['N', 'S', 'E', 'W'].forEach(label => {
            const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
            const ctx = canvas.getContext('2d'); ctx.fillStyle = 'white'; ctx.font = 'Bold 48px Courier New';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 32, 32);
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) }));
            sprite.scale.set(15, 15, 1); sprite.layers.set(1); this.scene.add(sprite);
            this.compassLabels[label] = sprite;
        });
    }

    initUI() {
        const menu = document.getElementById('main-menu');
        const gameUI = document.getElementById('game-ui');
        const deployBtn = document.getElementById('btn-mission-1');
        deployBtn.addEventListener('click', () => {
            this.audio.play('ui_click'); this.audio.startAudioContext(); 
            deployBtn.innerText = "LOADING..."; deployBtn.disabled = true;
            setTimeout(() => {
                menu.classList.add('hidden'); gameUI.classList.remove('hidden');
                try { this.player.requestPointerLock(); } catch (e) {}
                deployBtn.innerText = "DEPLOY NOW"; deployBtn.disabled = false;
            }, 500);
        });
        document.addEventListener('keydown', (e) => {
            if(e.key === 'Escape') { menu.classList.remove('hidden'); gameUI.classList.add('hidden'); document.exitPointerLock(); }
            if(e.code === 'KeyF') this.toggleVehicle();
        });
        document.addEventListener('mousedown', (e) => {
            if (this.activeVehicle && e.button === 2) { 
                this.activeVehicle.isSniperMode = !this.activeVehicle.isSniperMode; this.audio.play('ui_click');
            }
        });
        window.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    toggleVehicle() {
        if (this.activeVehicle) {
            this.activeVehicle.isOccupied = false; this.activeVehicle.isSniperMode = false;
            this.player.body.position.set(this.activeVehicle.body.position.x + 5, this.activeVehicle.body.position.y + 2, this.activeVehicle.body.position.z);
            this.player.enabled = true; this.activeVehicle = null; this.audio.play('ui_click');
        } else {
            const nearbyTank = this.tanks.find(t => new CANNON.Vec3().copy(t.body.position).vsub(this.player.body.position).length() < 12);
            const nearbyHeli = this.helicopters.find(h => new CANNON.Vec3().copy(h.body.position).vsub(this.player.body.position).length() < 12);
            if (nearbyTank) this.activeVehicle = nearbyTank; else if (nearbyHeli) this.activeVehicle = nearbyHeli;
            if (this.activeVehicle) { 
                this.activeVehicle.isOccupied = true; this.player.enabled = false; 
                const targetPos = new THREE.Vector3(); this.activeVehicle.chaseCameraAnchor.getWorldPosition(targetPos);
                this.player.camera.position.copy(targetPos); this.audio.play('ui_click');
            }
        }
    }

    onWindowResize() {
        this.player.camera.aspect = window.innerWidth / window.innerHeight;
        this.player.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        if (this.isGameOver) return;
        requestAnimationFrame(() => this.animate());
        const delta = this.clock.getDelta();
        this.world.step(1/60, delta, 10);
        this.base.update(delta, this.clock.elapsedTime);
        this.updateEnvironment(delta);
        this.particles.update(delta, this.player.camera);

        this.objectives.forEach(obj => obj.update(delta, [this.player, ...this.allies], this.enemies));
        let alliedPoints = this.objectives.filter(o => o.owner === 'allied').length;
        let enemyPoints = this.objectives.filter(o => o.owner === 'enemy').length;
        if (enemyPoints > alliedPoints) this.alliedTickets -= (enemyPoints - alliedPoints) * delta * 2;
        if (alliedPoints > enemyPoints) this.enemyTickets -= (alliedPoints - enemyPoints) * delta * 2;
        if (this.alliedTickets <= 0 || this.enemyTickets <= 0) this.endGame();

        const currentY = this.activeVehicle ? this.activeVehicle.body.position.y : this.player.body.position.y;
        this.audio.updateAltitudeEffects(currentY);

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
        this.enemies.forEach((enemy) => {
            enemy.update(delta, playerPos, this.player);
            if (enemy.minimapIcon) enemy.minimapIcon.position.set(enemy.body.position.x, 100, enemy.body.position.z);
            if (enemy.isDead && enemy.minimapIcon) { this.scene.remove(enemy.minimapIcon); enemy.minimapIcon = null; }
        });

        document.getElementById('health').innerText = `HP: ${Math.ceil(this.player.health)}`;
        document.getElementById('ammo').innerText = `TICKETS: ALLY ${Math.ceil(this.alliedTickets)} | AXIS ${Math.ceil(this.enemyTickets)}`;
        this.playerIcon.position.set(playerPos.x, 101, playerPos.z);
        const camEuler = new THREE.Euler().setFromQuaternion(this.player.camera.quaternion, 'YXZ');
        this.playerIcon.rotation.z = camEuler.y;
        this.minimapCamera.position.set(playerPos.x, 200, playerPos.z);
        ['N', 'S', 'E', 'W'].forEach(l => {
            const dist = 68;
            if(l==='N') this.compassLabels[l].position.set(playerPos.x, 150, playerPos.z - dist);
            if(l==='S') this.compassLabels[l].position.set(playerPos.x, 150, playerPos.z + dist);
            if(l==='E') this.compassLabels[l].position.set(playerPos.x + dist, 150, playerPos.z);
            if(l==='W') this.compassLabels[l].position.set(playerPos.x - dist, 150, playerPos.z);
        });

        this.player.camera.layers.set(0); this.renderer.render(this.scene, this.player.camera);
        this.minimapCamera.layers.enable(0); this.minimapCamera.layers.enable(1);
        this.minimapRenderer.render(this.scene, this.minimapCamera);
    }

    endGame() {
        this.isGameOver = true;
        const victory = this.enemyTickets <= 0;
        const endScreen = document.createElement('div');
        endScreen.style.position = 'fixed'; endScreen.style.top = '0'; endScreen.style.left = '0';
        endScreen.style.width = '100%'; endScreen.style.height = '100%';
        endScreen.style.background = 'rgba(0,0,0,0.8)'; endScreen.style.color = victory ? '#0f0' : '#f00';
        endScreen.style.display = 'flex'; endScreen.style.flexDirection = 'column';
        endScreen.style.justifyContent = 'center'; endScreen.style.alignItems = 'center';
        endScreen.style.zIndex = '1000'; endScreen.style.fontFamily = 'Courier New';
        endScreen.innerHTML = `<h1>${victory ? 'MISSION ACCOMPLISHED' : 'MISSION FAILED'}</h1><button onclick="location.reload()" style="background:#222;color:#fff;border:1px solid #fff;padding:10px 20px;cursor:pointer">REDEPLOY</button>`;
        document.body.appendChild(endScreen);
        document.exitPointerLock();
    }
}
new Game();