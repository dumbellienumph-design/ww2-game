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
import { ParticleSystem } from './particles.js';
import { AudioManager } from './audio.js';

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
                element.style.opacity = Math.max(0.2, 1 - (distFromCenter * 2));
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
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; 

        this.minimapCanvas = document.querySelector('#minimap-canvas');
        this.minimapRenderer = new THREE.WebGLRenderer({ canvas: this.minimapCanvas });
        this.minimapRenderer.setSize(220, 220);

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x2d3238); 
        this.scene.fog = new THREE.FogExp2(0x2d3238, 0.003);
        
        this.world = new CANNON.World();
        this.world.gravity.set(0, -25, 0);

        this.isGameOver = false;
        this.isPlayerActive = false; 
        this.activeRadius = 250; 

        this.playerXP = 0;
        this.playerRank = 'PRIVATE';
        this.sessionKills = 0;
        
        this.initWorld();
        this.initUI();
        this.initCompass();
        
        window.addEventListener('resize', () => this.onWindowResize());
        this.clock = new THREE.Clock();
        this.createStartOverlay();
    }

    createStartOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'start-overlay';
        overlay.style = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.95); z-index:2000; display:flex; flex-direction:column; justify-content:center; align-items:center; color:#ff0; font-family:monospace; cursor:pointer;';
        overlay.innerHTML = '<h1 style="font-size:3.5rem; letter-spacing:15px; margin:0; text-shadow:0 0 20px #ff0;">WW2 FRONTLINES</h1><p style="font-size:1.2rem; margin-top:30px; opacity:0.6; letter-spacing:5px;">CLICK TO DEPLOY</p>';
        document.body.appendChild(overlay);
        
        const start = () => {
            overlay.removeEventListener('click', start);
            overlay.remove();
            this.player.requestPointerLock();
            this.animate();
            GameUI.notify("MISSION: DESTROY ENEMY HQ", "#ff0");
        };
        overlay.addEventListener('click', start);
    }

    addXP(amount, reason) {
        this.playerXP += amount;
        GameUI.notify(`+${amount} XP ${reason}`, "#ff0");
        const oldRank = this.playerRank;
        if (this.playerXP >= 5000) this.playerRank = 'CAPTAIN';
        else if (this.playerXP >= 2500) this.playerRank = 'LIEUTENANT';
        else if (this.playerXP >= 1000) this.playerRank = 'SERGEANT';
        if (this.playerRank !== oldRank) {
            GameUI.notify(`PROMOTED TO ${this.playerRank}`, "#0f0");
            const rs = document.querySelector('#rank-indicator span'); if(rs) rs.innerText = this.playerRank;
        }
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

    initUI() {
        document.addEventListener('mousedown', () => {
            if (!this.isGameOver && !document.pointerLockElement && !document.getElementById('start-overlay')) {
                this.player.requestPointerLock();
            }
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

    initWorld() {
        this.terrain = new Terrain(this.scene, this.world);
        this.initLights();
        this.initPhysicsMaterial();
        this.vegetation = new Vegetation(this.scene, this.world, this.terrain);
        this.particles = new ParticleSystem(this.scene);
        this.player = new Player(this.scene, this.world, this.renderer.domElement, null, this.particles);
        
        this.player.camera.layers.enable(0);
        this.player.camera.layers.disable(1); 

        this.player.body.position.set(-150, 15, 0); 
        this.player.yaw = -Math.PI/2; 

        this.alliedBase = new Base(this.scene, this.world, { x: -150, y: 0, z: 0 }, null, this.particles, false);
        this.enemyBase = new Base(this.scene, this.world, { x: 150, y: 0, z: 0 }, null, this.particles, true);
        
        this.objectives = [
            { name: "ENEMY HQ", position: new THREE.Vector3(150, 0, 0), id: 'hq' },
            { name: "BASE", position: new THREE.Vector3(-150, 0, 0), id: 'base' }
        ];
        
        this.spawnEnemies(20); 
        this.spawnAllies(10);
        this.initMinimap();
    }

    initLights() {
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(this.ambientLight);

        this.hemiLight = new THREE.HemisphereLight(0x7c8485, 0x222818, 0.6);
        this.scene.add(this.hemiLight);

        this.sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
        this.sunLight.position.set(200, 400, 100);
        
        this.sunLight.shadow.camera.left = -400;
        this.sunLight.shadow.camera.right = 400;
        this.sunLight.shadow.camera.top = 400;
        this.sunLight.shadow.camera.bottom = -400;
        this.sunLight.shadow.camera.near = 1;
        this.sunLight.shadow.camera.far = 1200;
        this.sunLight.shadow.mapSize.set(2048, 2048);
        
        // --- FIX: CRITICAL STABILITY BIAS ---
        this.sunLight.shadow.bias = -0.003;
        this.sunLight.shadow.radius = 2;
        this.sunLight.castShadow = true;
        
        this.scene.add(this.sunLight);
    }

    initPhysicsMaterial() {
        const defaultMat = new CANNON.Material('default');
        const contactMat = new CANNON.ContactMaterial(defaultMat, defaultMat, { friction: 0.1, restitution: 0.1 });
        this.world.addContactMaterial(contactMat);
        this.world.defaultContactMaterial = contactMat;
    }

    spawnEnemies(count) {
        this.enemies = [];
        for(let i=0; i<count; i++) {
            const x = 120 + (Math.random()-0.5)*150; const z = (Math.random()-0.5)*150;
            const enemy = new Enemy(this.scene, this.world, { x, y: 30, z }, null, 'infantry');
            const icon = new THREE.Mesh(new THREE.CircleGeometry(4, 16), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
            icon.rotation.x = -Math.PI / 2; icon.layers.set(1); this.scene.add(icon);
            enemy.minimapIcon = icon; 
            enemy.onKilledByPlayer = () => { GameUI.addKill("YOU", "ENEMY", true); this.addXP(100, "ENEMY NEUTRALIZED"); this.sessionKills++; };
            this.enemies.push(enemy);
        }
    }

    spawnAllies(count) {
        this.allies = [];
        for(let i=0; i<count; i++) {
            const x = -150 + (Math.random()-0.5)*60; const z = (Math.random()-0.5)*60;
            const ally = new Ally(this.scene, this.world, { x, y: 5, z }, null);
            const icon = new THREE.Mesh(new THREE.CircleGeometry(3, 16), new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
            icon.rotation.x = -Math.PI / 2; icon.layers.set(1); this.scene.add(icon);
            ally.minimapIcon = icon; this.allies.push(ally);
        }
    }

    initMinimap() {
        this.minimapSize = 250;
        this.minimapCamera = new THREE.OrthographicCamera(-this.minimapSize, this.minimapSize, this.minimapSize, -this.minimapSize, 1, 1000);
        this.minimapCamera.position.set(0, 250, 0);
        this.minimapCamera.lookAt(0, 0, 0);
        this.minimapCamera.up.set(0, 0, -1);
        this.minimapCamera.layers.enable(0);
        this.minimapCamera.layers.enable(1); 

        this.playerIcon = new THREE.Mesh(new THREE.CircleGeometry(8, 16), new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
        this.playerIcon.rotation.x = -Math.PI / 2; this.playerIcon.layers.set(1); this.scene.add(this.playerIcon);
    }

    onWindowResize() {
        if (this.player) { this.player.camera.aspect = window.innerWidth / window.innerHeight; this.player.camera.updateProjectionMatrix(); }
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    getTerrainHeight(x, z) {
        if (!this.terrain || !this.terrain.mesh) return 0;
        const raycaster = new THREE.Raycaster();
        raycaster.set(new THREE.Vector3(x, 250, z), new THREE.Vector3(0, -1, 0));
        const intersects = raycaster.intersectObject(this.terrain.mesh);
        return intersects.length > 0 ? intersects[0].point.y : 0;
    }

    animate() {
        if (this.isGameOver) return;
        requestAnimationFrame(() => this.animate());
        const delta = Math.min(this.clock.getDelta(), 0.05);

        const playerPos = this.player.body.position;

        // --- NEW: SNAPPING SHADOW CAMERA ---
        // Snaps the sun position to a 2m grid to prevent jitter
        const snap = 2;
        const snappedX = Math.round(playerPos.x / snap) * snap;
        const snappedZ = Math.round(playerPos.z / snap) * snap;
        this.sunLight.position.set(snappedX + 200, 400, snappedZ + 100);
        this.sunLight.target.position.set(snappedX, 0, snappedZ);
        this.sunLight.target.updateMatrixWorld();

        if (this.player) {
            if (!this.isPlayerActive) { if (Math.abs(this.player.body.velocity.x) > 0.1) this.isPlayerActive = true; }
            GameUI.updateCompass(this.player.yaw);
            const wpTargets = this.objectives.map(o => {
                const p = new THREE.Vector3(o.position.x, 5, o.position.z);
                return { id: o.id, position: p, dist: playerPos.distanceTo(new CANNON.Vec3(p.x, p.y, p.z)) };
            });
            GameUI.updateWaypoints(this.player.camera, wpTargets);
        }
        
        this.world.step(1/60, delta, 5);
        this.particles.update(delta, this.player.camera);
        if (this.vegetation) this.vegetation.update(delta);

        this.world.bodies.forEach(body => { if(body.mesh) { body.mesh.position.copy(body.position); body.mesh.quaternion.copy(body.quaternion); } });
        
        this.player.update(delta, this.terrain);

        this.allies.forEach(ally => ally.update(delta, playerPos, this.enemies, [], this.isPlayerActive));
        
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i]; enemy.update(delta, playerPos, this.player);
            if (enemy.minimapIcon) {
                enemy.minimapIcon.position.set(enemy.body.position.x, 100, enemy.body.position.z);
                enemy.minimapIcon.visible = playerPos.distanceTo(enemy.body.position) < 250;
            }
            if (enemy.isDead && !enemy.wasCounted) { if (enemy.onKilledByPlayer) enemy.onKilledByPlayer(); enemy.wasCounted = true; }
        }

        this.updateUIGameplay();
        this.renderer.render(this.scene, this.player.camera);
        
        this.minimapCamera.position.set(playerPos.x, 250, playerPos.z);
        this.playerIcon.position.set(playerPos.x, 101, playerPos.z);
        this.minimapRenderer.render(this.scene, this.minimapCamera);
    }

    updateUIGameplay() {
        const hpBar = document.getElementById('health-bar');
        const ammoText = document.getElementById('ammo');
        if(!hpBar || !ammoText) return;
        hpBar.style.width = `${Math.max(0, this.player.health)}%`;
        const hq = this.enemyBase.hqBody;
        const w = this.player.weapons[this.player.currentWeaponIndex];
        ammoText.innerText = `HQ HP: ${Math.max(0, Math.ceil(hq.health))} | AMMO: ${w.ammo}/${w.reserve}`;
    }

    endGame(victory) {
        this.isGameOver = true;
        const overlay = document.getElementById('scoreboard-overlay');
        overlay.classList.add('active');
        document.getElementById('sb-mission-result').innerText = victory ? "MISSION ACCOMPLISHED" : "MISSION FAILED";
        document.getElementById('sb-mission-result').style.color = victory ? "#0f0" : "#f00";
        document.getElementById('sb-kills').innerText = this.sessionKills;
        document.getElementById('sb-xp').innerText = Math.floor(this.playerXP);
        document.exitPointerLock();
    }
}
new Game();
