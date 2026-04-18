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
        this.minimapRenderer = new THREE.WebGLRenderer({ canvas: this.minimapCanvas, antialias: true });
        this.minimapRenderer.setSize(220, 220);

        this.scene = new THREE.Scene();
        this.world = new CANNON.World();
        this.world.gravity.set(0, -25, 0);

        this.timeOfDay = 0;
        this.daySpeed = 0.05;

        this.tempCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.tempCamera.position.set(0, 50, 100);
        this.tempCamera.lookAt(0, 0, 0);
        
        this.audio = new AudioManager(this.tempCamera);
        this.isLoaded = false;
        this.isGameOver = false;
        
        this.tips = [
            "TIP: Use Tanks to provide cover for infantry when approaching MG nests.",
            "TIP: Capture strategic points to bleed the enemy's reinforcement tickets.",
            "TIP: Helicopter support can clear rooftops and hidden snipers quickly.",
            "TIP: Listen for the whistle of incoming artillery—take cover immediately.",
            "TIP: Your AI allies will follow you to objectives—lead the charge!",
            "TIP: Use Right-Click to zoom in for more accurate rifle shots.",
            "TIP: Press F to enter or exit available vehicles on the battlefield.",
            "TIP: The mini-map shows friendly units in green and detected enemies in red."
        ];

        this.loadingImages = [
            "https://images.unsplash.com/photo-1599032909756-5dee8c65f6d6?auto=format&fit=crop&q=80&w=1920",
            "https://images.unsplash.com/photo-1518112166137-859095689100?auto=format&fit=crop&q=80&w=1920",
            "https://images.unsplash.com/photo-1533560913523-c0978282c06a?auto=format&fit=crop&q=80&w=1920",
            "https://images.unsplash.com/photo-1506197357084-5853f75196d7?auto=format&fit=crop&q=80&w=1920",
            "https://images.unsplash.com/photo-1440439603332-159e99298f3c?auto=format&fit=crop&q=80&w=1920",
            "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=1920"
        ];
        
        this.initUI();
        
        window.addEventListener('resize', () => this.onWindowResize());
        this.clock = new THREE.Clock();
        this.animate();
    }

    initUI() {
        const homeScreen = document.getElementById('home-screen');
        const loadingScreen = document.getElementById('loading-screen');
        const btnBegin = document.getElementById('btn-begin');

        btnBegin.addEventListener('click', () => {
            homeScreen.classList.add('hidden');
            loadingScreen.classList.remove('hidden');
            this.audio.startAudioContext();
            this.loadGame();
        });

        const btnResume = document.getElementById('btn-resume');
        if (btnResume) {
            btnResume.addEventListener('click', () => {
                document.getElementById('esc-menu').classList.add('hidden');
                if (this.isLoaded) this.player.requestPointerLock();
            });
        }
    }

    startTipCycle() {
        const tipElement = document.getElementById('loading-tip');
        const bgElement = document.getElementById('loading-background');
        let tipIndex = 0;
        let imgIndex = 0;
        bgElement.style.backgroundImage = `url('${this.loadingImages[0]}')`;

        this.tipInterval = setInterval(() => {
            tipIndex = (tipIndex + 1) % this.tips.length;
            imgIndex = (imgIndex + 1) % this.loadingImages.length;
            tipElement.style.opacity = 0;
            setTimeout(() => {
                tipElement.innerText = this.tips[tipIndex];
                bgElement.style.backgroundImage = `url('${this.loadingImages[imgIndex]}')`;
                tipElement.style.opacity = 1;
            }, 500);
        }, 3500); // Slightly faster cycling
    }

    async loadGame() {
        const loadingBar = document.getElementById('loading-bar');
        const loadingStatus = document.getElementById('loading-status');
        const loadingPercent = document.getElementById('loading-percentage');
        
        this.startTipCycle();

        let progress = 0;
        const updateUI = (p, status) => {
            progress = Math.max(progress, p);
            const displayP = Math.floor(progress);
            loadingBar.style.width = `${displayP}%`;
            loadingPercent.innerText = `${displayP}%`;
            if (status) {
                loadingStatus.classList.remove('typewriter');
                void loadingStatus.offsetWidth; 
                loadingStatus.innerText = status;
                loadingStatus.classList.add('typewriter');
            }
        };

        const yieldThread = () => new Promise(resolve => requestAnimationFrame(resolve));

        // --- STEP 1: INITIALIZE SOUND & ANTHEM (0-15%) ---
        updateUI(5, "INITIALIZING FIELD AUDIO...");
        await this.audio.loadSound('anthem', 'https://cdn.freesound.org/previews/235/235653_3534964-lq.mp3', false, true, 0.5);
        this.audio.play('anthem');
        updateUI(15, "ANTHEM BROADCASTING...");

        // --- STEP 2: PARALLEL ASSET LOADING (15-60%) ---
        // We load all heavy sounds at once to save time
        updateUI(16, "BUFFERING COMBAT SOUNDSCAPES...");
        const soundAssets = [
            ['action_theme', 'https://cdn.freesound.org/previews/267/267528_4221199-lq.mp3', false, true, 0.6],
            ['ui_click', 'https://cdn.freesound.org/previews/256/256113_3263906-lq.mp3', false, false, 0.4],
            ['rifle_fire', 'https://cdn.freesound.org/previews/146/146747_2437358-lq.mp3', false, false, 0.8],
            ['rifle_cycle', 'https://cdn.freesound.org/previews/218/218151_2210086-lq.mp3', false, false, 0.6],
            ['bullet_whiz', 'https://cdn.freesound.org/previews/192/192138_1066060-lq.mp3', false, false, 0.5],
            ['tank_engine', 'https://cdn.freesound.org/previews/320/320661_5250656-lq.mp3', false, true, 0.6],
            ['tank_fire', 'https://cdn.freesound.org/previews/146/146747_2437358-lq.mp3', false, false, 0.9],
            ['tank_tracks', 'https://cdn.freesound.org/previews/261/261763_4933934-lq.mp3', false, true, 0.3],
            ['heli_engine', 'https://cdn.freesound.org/previews/337/337346_4221199-lq.mp3', false, true, 0.6],
            ['heli_fire', 'https://cdn.freesound.org/previews/253/253381_4474943-lq.mp3', false, false, 0.5],
            ['explosion_blast', 'https://cdn.freesound.org/previews/103/103213_746654-lq.mp3', false, false, 0.9],
            ['base_hum', 'https://cdn.freesound.org/previews/212/212134_4083377-lq.mp3', true, true, 0.3],
            ['ambient_wind', 'https://cdn.freesound.org/previews/458/458021_9228514-lq.mp3', false, true, 0.3],
            ['reinforcement', 'https://cdn.freesound.org/previews/369/369932_6081467-lq.mp3', false, false, 0.7]
        ];

        let finishedSounds = 0;
        await Promise.all(soundAssets.map(async (s) => {
            await this.audio.loadSound(...s);
            finishedSounds++;
            const soundProgress = 16 + (finishedSounds / soundAssets.length) * 44;
            updateUI(soundProgress, `SYNCING ASSET: ${s[0].toUpperCase()}...`);
        }));

        // --- STEP 3: WORLD GENERATION (60-90%) ---
        updateUI(65, "ANALYZING TERRAIN DATA...");
        await yieldThread();
        this.terrain = new Terrain(this.scene, this.world);
        
        updateUI(70, "CALIBRATING ATMOSPHERIC LIGHTS...");
        this.initLights();
        this.initPhysicsMaterial();
        await yieldThread();
        
        updateUI(75, "DEPLOYING FIELD VEGETATION...");
        this.vegetation = new Vegetation(this.scene, this.world, this.terrain);
        await yieldThread();
        
        updateUI(80, "INITIALIZING BALLISTIC PARTICLES...");
        this.particles = new ParticleSystem(this.scene);
        await yieldThread();
        
        updateUI(85, "ARMING INFANTRY SQUAD...");
        this.player = new Player(this.scene, this.world, this.renderer.domElement, null, this.particles);
        this.player.body.position.set(-50, 5, -50); 
        this.player.audio = this.audio;
        this.audio.listener.parent.remove(this.audio.listener);
        this.player.camera.add(this.audio.listener);
        await yieldThread();
        updateUI(90, "SYSTEMS SYNCHRONIZED.");

        // --- STEP 4: UNITS & OBJECTIVES (90-100%) ---
        updateUI(92, "FORTIFYING OUTPOSTS...");
        this.base = new Base(this.scene, this.world, { x: -50, y: 0, z: -50 }, this.audio, this.particles);
        this.objectives = [
            new Objective(this.scene, "ABLE", { x: 25, y: 0, z: -40 }, this.audio),
            new Objective(this.scene, "BAKER", { x: -50, y: 0, z: 10 }, this.audio),
            new Objective(this.scene, "CHARLIE", { x: 50, y: 0, z: 40 }, this.audio)
        ];
        
        updateUI(94, "DEPLOYING MOTORIZED DIVISIONS...");
        this.tanks = [
            new Tank(this.scene, this.world, { x: -20, y: 5, z: -80 }, this.audio, this.particles), 
            new Tank(this.scene, this.world, { x: -10, y: 5, z: -80 }, this.audio, this.particles), 
            new Tank(this.scene, this.world, { x: 0, y: 5, z: -80 }, this.audio, this.particles)    
        ];
        this.helicopters = [new Helicopter(this.scene, this.world, { x: -20, y: 15, z: 20 }, this.audio, this.particles)];
        
        updateUI(96, "INFILTRATING STRIKE TEAMS...");
        this.spawnEnemies(12);
        this.spawnAllies(5);
        
        updateUI(98, "FINALIZING TACTICAL OVERLAY...");
        this.alliedTickets = 500;
        this.enemyTickets = 500;
        this.activeVehicle = null;
        this.initMinimap();
        await yieldThread();

        updateUI(100, "COMMAND AUTHORIZED. AWAITING DEPLOYMENT.");

        clearInterval(this.tipInterval);
        
        setTimeout(() => {
            const btnDeploy = document.getElementById('btn-deploy');
            btnDeploy.classList.remove('hidden');
            
            btnDeploy.addEventListener('click', () => {
                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('ui-layer').classList.remove('hidden');
                
                this.audio.fadeSound('anthem', 0, 2);
                this.audio.fadeSound('action_theme', 0.6, 2);
                this.audio.play('ambient_wind');

                try { this.player.requestPointerLock(); } catch (e) {}
                this.isLoaded = true;
            });
        }, 500);
    }

    initLights() {
        this.ambientLight = new THREE.AmbientLight(0xd0e0e3, 0.4);
        this.scene.add(this.ambientLight);
        this.sunLight = new THREE.DirectionalLight(0xfff5e6, 0.8);
        this.sunLight.position.set(100, 150, 50);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.set(2048, 2048);
        this.scene.add(this.sunLight);
        this.scene.fog = new THREE.FogExp2(0xd0e0e3, 0.002);
    }

    initPhysicsMaterial() {
        const defaultMat = new CANNON.Material('default');
        const contactMat = new CANNON.ContactMaterial(defaultMat, defaultMat, { friction: 0.1, restitution: 0.3 });
        this.world.addContactMaterial(contactMat);
        this.world.defaultContactMaterial = contactMat;
    }

    spawnEnemies(count) {
        this.enemies = this.enemies || [];
        for(let i=0; i<count; i++) {
            let x, z;
            do { x = (Math.random() - 0.5) * 800; z = (Math.random() - 0.5) * 800; } 
            while (Math.sqrt((x - (-50))**2 + (z - (-50))**2) < 200);
            let type = (Math.random() > 0.85 ? 'tank' : (Math.random() > 0.70 ? 'aa_flak' : 'infantry'));
            const enemy = new Enemy(this.scene, this.world, { x, y: 30, z }, this.audio, type);
            const iconColor = type === 'tank' ? 0xffaa00 : (type === 'aa_flak' ? 0xffff00 : 0xff0000);
            const icon = new THREE.Mesh(new THREE.CircleGeometry(type === 'tank' ? 6 : 3, 16), new THREE.MeshBasicMaterial({ color: iconColor }));
            icon.rotation.x = -Math.PI / 2; icon.layers.set(1); this.scene.add(icon);
            enemy.minimapIcon = icon; this.enemies.push(enemy);
        }
    }

    spawnAllies(count) {
        this.allies = this.allies || [];
        for(let i=0; i<count; i++) {
            const x = -40 + (Math.random() - 0.5) * 40; const z = -40 + (Math.random() - 0.5) * 40;
            const ally = new Ally(this.scene, this.world, { x, y: 5, z }, this.audio);
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
        if (this.isLoaded) {
            this.player.camera.aspect = window.innerWidth / window.innerHeight;
            this.player.camera.updateProjectionMatrix();
        } else {
            this.tempCamera.aspect = window.innerWidth / window.innerHeight;
            this.tempCamera.updateProjectionMatrix();
        }
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    updateEnvironment(delta) {
        this.timeOfDay += delta * 0.05;
        const sunX = Math.cos(this.timeOfDay) * 200;
        const sunY = Math.sin(this.timeOfDay) * 200;
        this.sunLight.position.set(sunX, sunY, 50);
        const dayFactor = Math.max(0, Math.min(1, sunY / 50));
        this.sunLight.intensity = dayFactor * 0.8;
        this.ambientLight.intensity = 0.1 + (dayFactor * 0.3);
        const dayColor = new THREE.Color(0x8899a6);
        const nightColor = new THREE.Color(0x050510);
        const currentColor = dayColor.clone().lerp(nightColor, 1 - dayFactor);
        this.scene.background = currentColor;
        if (this.scene.fog) this.scene.fog.color = currentColor;
    }

    animate() {
        if (this.isGameOver) return;
        requestAnimationFrame(() => this.animate());
        const delta = this.clock.getDelta();

        if (!this.isLoaded) {
            this.renderer.render(this.scene, this.tempCamera);
            return;
        }

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

        this.audio.updateAltitudeEffects(this.activeVehicle ? this.activeVehicle.body.position.y : this.player.body.position.y);
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
        this.allies.forEach(ally => ally.update(delta, playerPos, this.enemies, this.objectives));
        this.enemies.forEach(enemy => enemy.update(delta, playerPos, this.player));

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
