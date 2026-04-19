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

    static updateCompass(yaw) {
        const tape = document.getElementById('compass-tape');
        if (!tape) return;
        const deg = (yaw * (180 / Math.PI)) % 360;
        tape.style.transform = `translateX(${-deg * 2}px)`;
    }

    static updateWaypoints(camera, targets) {
        targets.forEach(t => {
            const element = document.getElementById(`wp-${t.id}`);
            if (!element) return;
            const pos = t.position.clone().project(camera);
            const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
            const y = (pos.y * -0.5 + 0.5) * window.innerHeight;
            const dist = Math.floor(t.dist);
            const isBehind = pos.z > 1;
            if (isBehind) {
                element.style.display = 'none';
            } else {
                element.style.display = 'block';
                element.style.left = `${x}px`;
                element.style.top = `${y}px`;
                element.querySelector('.dist').innerText = `${dist}m`;
                const distFromCenter = Math.sqrt(pos.x**2 + pos.y**2);
                element.style.opacity = Math.max(0, Math.min(1, (distFromCenter - 0) / (0.2 - 0)));
            }
        });
    }
}

class Game {
    constructor() {
        window.game = this;
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

        this.fullMapCanvas = document.querySelector('#full-map-canvas');
        this.fullMapRenderer = new THREE.WebGLRenderer({ canvas: this.fullMapCanvas });
        this.fullMapRenderer.setSize(800, 800); 

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x33383d);
        this.scene.fog = new THREE.FogExp2(0x33383d, 0.003);
        
        this.world = new CANNON.World();
        this.world.gravity.set(0, -25, 0);

        this.timeOfDay = 0;
        this.daySpeed = 0.05;

        this.isGameOver = false;
        this.isPlayerActive = false; 
        this.activeRadius = 250; 

        this.alliedTickets = 500;
        this.enemyTickets = 500;
        this.activeVehicle = null;

        this.playerXP = 0;
        this.playerRank = 'PRIVATE';
        this.xpTimer = 0;
        this.sessionKills = 0;
        this.sessionCaptures = 0;
        this.killstreakXP = 0;
        this.reconActive = false;
        this.reconTimer = 0;

        this.reinforcementQueue = [];

        this.initWorld();
        this.initUI();
        this.initCompass();
        this.initFullMap();
        
        window.addEventListener('resize', () => this.onWindowResize());
        this.clock = new THREE.Clock();
        this.animate();

        GameUI.notify("MISSION STARTED: SECURE THE SECTOR", "#ff0");
    }

    addXP(amount, reason) {
        this.playerXP += amount;
        this.killstreakXP += amount;
        GameUI.notify(`+${amount} XP ${reason}`, "#ff0");
        const oldRank = this.playerRank;
        if (this.playerXP >= 5000) this.playerRank = 'CAPTAIN';
        else if (this.playerXP >= 2500) this.playerRank = 'LIEUTENANT';
        else if (this.playerXP >= 1000) this.playerRank = 'SERGEANT';
        if (this.playerRank !== oldRank) {
            GameUI.notify(`PROMOTED TO ${this.playerRank}`, "#0f0");
            const rs = document.querySelector('#rank-indicator span');
            if(rs) rs.innerText = this.playerRank;
        }
    }

    activateReconPlane() {
        if (this.killstreakXP < 500) return;
        this.killstreakXP = 0;
        this.reconActive = true;
        this.reconTimer = 20.0;
        GameUI.notify("RECON PLANE INBOUND", "#0ff");
        const planeGeo = new THREE.BoxGeometry(5, 1, 4);
        const plane = new THREE.Mesh(planeGeo, new THREE.MeshStandardMaterial({color: 0x888888}));
        plane.position.set(-400, 100, 0);
        this.scene.add(plane);
        const anim = () => { plane.position.x += 2; if(plane.position.x < 400) requestAnimationFrame(anim); else this.scene.remove(plane); };
        anim();
    }

    initCompass() {
        const tape = document.getElementById('compass-tape');
        if (!tape) return;
        const markers = ['N', '45', 'E', '135', 'S', '225', 'W', '315'];
        let html = '';
        for(let j=0; j<3; j++) {
            for(let i=0; i<markers.length; i++) {
                html += `<div style="width:100px; flex-shrink:0; text-align:center;">${markers[i]}</div>`;
            }
        }
        tape.innerHTML = html;
    }

    initFullMap() {
        this.fullMapSize = 400; 
        this.fullMapCamera = new THREE.OrthographicCamera(-this.fullMapSize, this.fullMapSize, this.fullMapSize, -this.fullMapSize, 1, 1000);
        this.fullMapCamera.position.set(0, 500, 0);
        this.fullMapCamera.lookAt(0, 0, 0);
        this.fullMapCamera.up.set(0, 0, -1);
    }

    initUI() {
        document.addEventListener('mousedown', () => {
            if (!this.isGameOver && !document.pointerLockElement && !document.getElementById('full-map-overlay').classList.contains('active')) {
                try { this.player.requestPointerLock(); } catch (e) {}
            }
        });
        const btnResume = document.getElementById('btn-resume');
        if (btnResume) { btnResume.addEventListener('click', () => { document.getElementById('esc-menu').classList.add('hidden'); this.player.requestPointerLock(); }); }
        const commandMenu = document.getElementById('command-menu');
        document.addEventListener('keydown', (e) => {
            if (e.code === 'KeyM' && !this.isGameOver) {
                const fm = document.getElementById('full-map-overlay');
                fm.classList.toggle('active');
                if (fm.classList.contains('active')) document.exitPointerLock();
                else this.player.requestPointerLock();
            }
            if (e.code === 'KeyV') { commandMenu.classList.add('active'); document.exitPointerLock(); }
            if (commandMenu.classList.contains('active')) {
                if (e.code === 'Digit1') this.setSquadOrder('ADVANCE');
                if (e.code === 'Digit2') this.setSquadOrder('HOLD');
                if (e.code === 'Digit3') this.setSquadOrder('REGROUP');
            }
            if (e.code === 'Digit7') this.switchClass('ASSAULT');
            if (e.code === 'Digit8') this.switchClass('SNIPER');
            if (e.code === 'Digit9') this.switchClass('RIFLEMAN');
            if (e.code === 'Digit4') this.activateReconPlane();
            if (e.code === 'KeyF') this.toggleVehicle();
        });
        document.addEventListener('keyup', (e) => {
            if (e.code === 'KeyV') { commandMenu.classList.remove('active'); if (!document.getElementById('full-map-overlay').classList.contains('active')) this.player.requestPointerLock(); }
        });
    }

    switchClass(className) {
        if (!this.player) return;
        const indicator = document.querySelector('#class-indicator span');
        if (className === 'ASSAULT') this.player.switchWeapon(1);
        else if (className === 'SNIPER') this.player.switchWeapon(2);
        else this.player.switchWeapon(0);
        if(indicator) indicator.innerText = className;
        GameUI.notify(`CLASS: ${className}`, "#ff0");
    }

    setSquadOrder(order) {
        GameUI.notify(`SQUAD ORDER: ${order}`, "#ff0");
        this.allies.forEach(ally => { if (typeof ally.setOrder === 'function') ally.setOrder(order, this.player.body.position); });
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
        this.player.body.position.set(-150, 5, 0); 
        this.player.yaw = -Math.PI/2; 

        this.alliedBase = new Base(this.scene, this.world, { x: -150, y: 0, z: 0 }, null, this.particles, false);
        this.enemyBase = new Base(this.scene, this.world, { x: 150, y: 0, z: 0 }, null, this.particles, true);
        
        this.objectives = [
            { name: "ENEMY HQ", position: new THREE.Vector3(150, 0, 0), id: 'hq' },
            { name: "ALLIED BASE", position: new THREE.Vector3(-150, 0, 0), id: 'base' }
        ];
        
        this.tanks = [
            new Tank(this.scene, this.world, { x: -180, y: 5, z: -20 }, null, this.particles), 
            new Tank(this.scene, this.world, { x: -180, y: 5, z: 20 }, null, this.particles)    
        ];
        this.helicopters = [new Helicopter(this.scene, this.world, { x: -140, y: 15, z: 40 }, null, this.particles)];
        
        this.spawnEnemies(20); 
        this.spawnAllies(10);
        this.initMinimap();
        this.isLoaded = true;
    }

    initLights() {
        this.ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        this.scene.add(this.ambientLight);
        this.sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
        this.sunLight.position.set(100, 200, 100);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.camera.left = -300; this.sunLight.shadow.camera.right = 300;
        this.sunLight.shadow.camera.top = 300; this.sunLight.shadow.camera.bottom = -300;
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
            const x = 150 + (Math.random()-0.5)*150;
            const z = 0 + (Math.random()-0.5)*150;
            let type = (Math.random() > 0.85 ? 'tank' : 'infantry');
            const enemy = new Enemy(this.scene, this.world, { x, y: 30, z }, null, type);
            const iconColor = type === 'tank' ? 0xffaa00 : 0xff0000;
            const icon = new THREE.Mesh(new THREE.CircleGeometry(type === 'tank' ? 6 : 3, 16), new THREE.MeshBasicMaterial({ color: iconColor }));
            icon.rotation.x = -Math.PI / 2; icon.layers.set(1); this.scene.add(icon);
            enemy.minimapIcon = icon; 
            enemy.onKilledByPlayer = () => { GameUI.addKill("YOU", enemy.type.toUpperCase(), true); this.addXP(100, "ENEMY NEUTRALIZED"); this.sessionKills++; };
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
        this.minimapSize = 150;
        this.minimapCamera = new THREE.OrthographicCamera(-this.minimapSize, this.minimapSize, this.minimapSize, -this.minimapSize, 1, 1000);
        this.minimapCamera.position.set(0, 200, 0);
        this.minimapCamera.lookAt(0, 0, 0);
        this.minimapCamera.up.set(0, 0, -1);
        this.playerIcon = new THREE.Mesh(new THREE.CircleGeometry(5, 16), new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
        this.playerIcon.rotation.x = -Math.PI / 2; this.playerIcon.layers.set(1); this.scene.add(this.playerIcon);
    }

    onWindowResize() {
        if (this.player) { this.player.camera.aspect = window.innerWidth / window.innerHeight; this.player.camera.updateProjectionMatrix(); }
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    updateReinforcements(delta) {
        for (let i = this.reinforcementQueue.length - 1; i >= 0; i--) {
            const r = this.reinforcementQueue[i]; r.timer -= delta;
            if (r.timer <= 0) {
                if (r.type === 'TANK') this.tanks.push(new Tank(this.scene, this.world, r.pos, null, this.particles));
                else this.helicopters.push(new Helicopter(this.scene, this.world, r.pos, null, this.particles));
                GameUI.notify(`${r.type} REINFORCEMENTS ARRIVED`, "#0f0");
                this.reinforcementQueue.splice(i, 1);
            }
        }
        this.tanks.forEach((t, idx) => {
            if (t.isDestroyed && !t.queuedForRespawn) {
                this.reinforcementQueue.push({ type: 'TANK', timer: 20.0, pos: { x: -180, y: 5, z: 0 } });
                t.queuedForRespawn = true;
                setTimeout(() => { if(t.group.parent) this.scene.remove(t.group); this.world.removeBody(t.body); this.tanks.splice(idx, 1); }, 5000);
            }
        });
    }

    animate() {
        if (this.isGameOver) return;
        requestAnimationFrame(() => this.animate());
        const delta = this.clock.getDelta();
        if (this.player) {
            if (!this.isPlayerActive) { const vel = this.player.body.velocity; if (Math.abs(vel.x) > 0.1 || Math.abs(vel.z) > 0.1) this.isPlayerActive = true; }
            GameUI.updateCompass(this.player.yaw);
            const wpTargets = this.objectives.map(o => {
                const p = new THREE.Vector3(o.position.x, 5, o.position.z);
                return { id: o.id, position: p, dist: this.player.body.position.distanceTo(new CANNON.Vec3(p.x, p.y, p.z)) };
            });
            GameUI.updateWaypoints(this.player.camera, wpTargets);
        }
        if (this.reconActive) { this.reconTimer -= delta; if (this.reconTimer <= 0) this.reconActive = false; }
        this.updateReinforcements(delta);
        this.world.step(1/60, delta, 10);
        this.alliedBase.update(delta, this.clock.elapsedTime);
        this.enemyBase.update(delta, this.clock.elapsedTime);
        this.particles.update(delta, this.player.camera);
        if (this.vegetation) this.vegetation.update(delta);

        this.world.bodies.forEach(body => { if(body.mesh) { body.mesh.position.copy(body.position); body.mesh.quaternion.copy(body.quaternion); } });
        
        if (this.activeVehicle) {
            this.activeVehicle.update(delta, this.player.moveState, this.player.camera);
            const targetPos = new THREE.Vector3();
            const anchor = (this.activeVehicle.isSniperMode && this.activeVehicle.sniperCameraAnchor) ? this.activeVehicle.sniperCameraAnchor : this.activeVehicle.chaseCameraAnchor;
            anchor.getWorldPosition(targetPos);
            this.player.camera.position.lerp(targetPos, 0.1);
            this.player.body.position.copy(this.activeVehicle.body.position);
        } else { this.player.update(delta, this.terrain); }

        const playerPos = this.activeVehicle ? this.activeVehicle.body.position : this.player.body.position;
        this.allies.forEach(ally => ally.update(delta, playerPos, this.enemies, this.objectives, this.isPlayerActive));
        
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i]; enemy.update(delta, playerPos, this.player);
            if (enemy.minimapIcon) {
                const dx = playerPos.x - enemy.body.position.x;
                const dz = playerPos.z - enemy.body.position.z;
                const distToPlayer = Math.sqrt(dx*dx + dz*dz);
                enemy.minimapIcon.visible = this.reconActive || distToPlayer < 120;
            }
            if (enemy.isDead && !enemy.wasCounted) { if (enemy.onKilledByPlayer) enemy.onKilledByPlayer(); enemy.wasCounted = true; }
        }

        this.updateUIGameplay(playerPos);
        this.renderer.render(this.scene, this.player.camera);
        this.minimapCamera.position.set(playerPos.x, 200, playerPos.z);
        this.playerIcon.position.set(playerPos.x, 101, playerPos.z);
        this.minimapRenderer.render(this.scene, this.minimapCamera);
        if (document.getElementById('full-map-overlay').classList.contains('active')) this.fullMapRenderer.render(this.scene, this.fullMapCamera);
    }

    updateUIGameplay(playerPos) {
        const hpBar = document.getElementById('health-bar');
        const medicStatus = document.getElementById('medic-status');
        const ammoText = document.getElementById('ammo');
        const ksUI = document.getElementById('killstreak-container');
        if(!hpBar || !medicStatus || !ammoText || !ksUI) return;
        hpBar.style.width = `${Math.max(0, this.player.health)}%`;
        if (this.player.isBleeding) hpBar.classList.add('bleeding'); else hpBar.classList.remove('bleeding');
        if (this.player.isHealing) { medicStatus.innerText = "BANDAGING... STANDBY"; medicStatus.style.color = "#ff0"; }
        else if (this.player.isBleeding) { medicStatus.innerText = "BLEEDING! PRESS H TO BANDAGE"; medicStatus.style.color = "#f00"; }
        else { medicStatus.innerText = `BANDAGES: ${this.player.bandages} | READY`; medicStatus.style.color = "#ff0"; }
        if (this.killstreakXP >= 500) { ksUI.classList.add('ready'); ksUI.querySelector('span').innerText = "(4) READY"; }
        else { ksUI.classList.remove('ready'); ksUI.querySelector('span').innerText = `${Math.floor(this.killstreakXP)} / 500`; }
        
        const hq = this.enemyBase.hqBody;
        let statusText = `ENEMY HQ HP: ${Math.max(0, Math.ceil(hq.health))}`;
        if (this.activeVehicle) statusText += ` | VEHICLE: HP ${Math.ceil(this.activeVehicle.health)}`;
        else { const w = this.player.weapons[this.player.currentWeaponIndex]; statusText += ` | AMMO: ${w.ammo}/${w.reserve}`; }
        ammoText.innerText = statusText;
    }

    toggleVehicle() {
        if (this.activeVehicle) {
            this.activeVehicle.isOccupied = false; this.activeVehicle.isSniperMode = false;
            this.player.body.position.set(this.activeVehicle.body.position.x + 5, this.activeVehicle.body.position.y + 2, this.activeVehicle.body.position.z);
            this.player.enabled = true; this.activeVehicle = null;
        } else {
            const nearbyTank = this.tanks.find(t => !t.isDestroyed && new CANNON.Vec3().copy(t.body.position).vsub(this.player.body.position).length() < 12);
            const nearbyHeli = this.helicopters.find(h => !h.isDestroyed && new CANNON.Vec3().copy(h.body.position).vsub(this.player.body.position).length() < 12);
            if (nearbyTank) this.activeVehicle = nearbyTank; else if (nearbyHeli) this.activeVehicle = nearbyHeli;
            if (this.activeVehicle) { 
                this.activeVehicle.isOccupied = true; this.player.enabled = false; 
                const targetPos = new THREE.Vector3(); this.activeVehicle.chaseCameraAnchor.getWorldPosition(targetPos);
                this.player.camera.position.copy(targetPos);
            }
        }
    }

    endGame(victory) {
        this.isGameOver = true;
        const overlay = document.getElementById('scoreboard-overlay');
        if(overlay) overlay.classList.add('active');
        const res = document.getElementById('sb-mission-result');
        if(res) { res.innerText = victory ? "MISSION ACCOMPLISHED" : "MISSION FAILED"; res.style.color = victory ? "#0f0" : "#f00"; }
        const kills = document.getElementById('sb-kills'); if(kills) kills.innerText = this.sessionKills;
        const caps = document.getElementById('sb-caps'); if(caps) caps.innerText = victory ? "ENEMY HQ DESTROYED" : "HQ INTACT";
        const xp = document.getElementById('sb-xp'); if(xp) xp.innerText = Math.floor(this.playerXP);
        const rank = document.getElementById('sb-rank'); if(rank) rank.innerText = this.playerRank;
        document.exitPointerLock();
    }
}
new Game();
