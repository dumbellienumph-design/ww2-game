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

class Game {
    constructor() {
        // Main Renderer
        this.canvas = document.querySelector('#game-canvas');
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;

        // Minimap Renderer
        this.minimapCanvas = document.querySelector('#minimap-canvas');
        this.minimapRenderer = new THREE.WebGLRenderer({ canvas: this.minimapCanvas, antialias: true });
        this.minimapRenderer.setSize(200, 200);
        this.minimapRenderer.setPixelRatio(1);

        this.scene = new THREE.Scene();
        // Gritty, overcast WWII sky
        const skyColor = new THREE.Color(0x8899a6); 
        this.scene.background = skyColor;
        this.scene.fog = new THREE.FogExp2(skyColor, 0.0035); // Volumetric fog

        this.world = new CANNON.World();
        this.world.gravity.set(0, -25, 0);

        this.initLights();
        this.initPhysicsMaterial();
        this.terrain = new Terrain(this.scene, this.world);
        this.vegetation = new Vegetation(this.scene, this.world, this.terrain);
        this.base = new Base(this.scene, this.world, { x: -50, y: 0, z: -50 });
        
        this.player = new Player(this.scene, this.world, this.renderer.domElement);
        this.player.body.position.set(-50, 5, -50); // Land on the spawn pad

        this.tanks = [
            new Tank(this.scene, this.world, { x: -20, y: 5, z: -80 }), // Tank 1 in base
            new Tank(this.scene, this.world, { x: -10, y: 5, z: -80 }), // Tank 2 in base
            new Tank(this.scene, this.world, { x: 0, y: 5, z: -80 })    // Tank 3 in base
        ];
        this.helicopters = [new Helicopter(this.scene, this.world, { x: -20, y: 15, z: 20 })];
        this.enemies = [];
        this.allies = [];
        this.activeVehicle = null;

        this.initMinimap();
        this.spawnEnemies(10);
        this.spawnAllies(5);
        this.initUI();
        
        window.addEventListener('resize', () => this.onWindowResize());
        this.clock = new THREE.Clock();
        this.animate();
    }

    initMinimap() {
        this.minimapSize = 80;
        this.minimapCamera = new THREE.OrthographicCamera(-this.minimapSize, this.minimapSize, this.minimapSize, -this.minimapSize, 1, 1000);
        this.minimapCamera.position.set(0, 200, 0);
        this.minimapCamera.lookAt(0, 0, 0);
        this.minimapCamera.up.set(0, 0, -1);

        // Player Arrow Icon
        const arrowShape = new THREE.Shape();
        arrowShape.moveTo(0, 6);
        arrowShape.lineTo(-3, -4);
        arrowShape.lineTo(0, -2);
        arrowShape.lineTo(3, -4);
        arrowShape.lineTo(0, 6);
        const arrowGeo = new THREE.ShapeGeometry(arrowShape);
        const arrowMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        this.playerIcon = new THREE.Mesh(arrowGeo, arrowMat);
        this.playerIcon.rotation.x = -Math.PI / 2;
        this.playerIcon.layers.set(1);
        this.scene.add(this.playerIcon);

        this.initCompassLabels();
    }

    createTextTexture(text) {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.font = 'Bold 48px Courier New';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(text, 32, 32);
        return new THREE.CanvasTexture(canvas);
    }

    initCompassLabels() {
        this.compassLabels = {};
        const labels = ['N', 'S', 'E', 'W'];
        labels.forEach(label => {
            const mat = new THREE.SpriteMaterial({ map: this.createTextTexture(label) });
            const sprite = new THREE.Sprite(mat);
            sprite.scale.set(15, 15, 1);
            sprite.layers.set(1);
            this.scene.add(sprite);
            this.compassLabels[label] = sprite;
        });
    }

    initLights() {
        const ambientLight = new THREE.AmbientLight(0xd0e0e3, 0.4); // Cooler, dimmer ambient
        this.scene.add(ambientLight);
        
        const sunLight = new THREE.DirectionalLight(0xfff5e6, 0.8); // Slightly warmer directional
        sunLight.position.set(100, 150, 50);
        sunLight.castShadow = true;
        
        // High quality shadow map for a professional look
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 500;
        const d = 150;
        sunLight.shadow.camera.left = -d;
        sunLight.shadow.camera.right = d;
        sunLight.shadow.camera.top = d;
        sunLight.shadow.camera.bottom = -d;
        sunLight.shadow.bias = -0.0005; // Reduce shadow acne
        
        this.scene.add(sunLight);
    }

    initPhysicsMaterial() {
        const defaultMat = new CANNON.Material('default');
        const contactMat = new CANNON.ContactMaterial(defaultMat, defaultMat, { friction: 0.1, restitution: 0.3 });
        this.world.addContactMaterial(contactMat);
        this.world.defaultContactMaterial = contactMat;
    }

    spawnEnemies(count) {
        for(let i=0; i<count; i++) {
            let x, z;
            do {
                x = (Math.random() - 0.5) * 400;
                z = (Math.random() - 0.5) * 400;
            } while (Math.sqrt((x - (-50))**2 + (z - (-50))**2) < 100);

            const enemy = new Enemy(this.scene, this.world, { x, y: 20, z });
            const iconGeo = new THREE.CircleGeometry(3, 16);
            const iconMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
            const icon = new THREE.Mesh(iconGeo, iconMat);
            icon.rotation.x = -Math.PI / 2;
            icon.layers.set(1);
            this.scene.add(icon);
            enemy.minimapIcon = icon;
            this.enemies.push(enemy);
        }
    }

    spawnAllies(count) {
        for(let i=0; i<count; i++) {
            // Spawn allies inside the base area (Cantonment)
            const x = -40 + (Math.random() - 0.5) * 40;
            const z = -40 + (Math.random() - 0.5) * 40;
            const ally = new Ally(this.scene, this.world, { x, y: 5, z });
            
            const iconGeo = new THREE.CircleGeometry(2, 16);
            const iconMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 }); // Green for allies
            const icon = new THREE.Mesh(iconGeo, iconMat);
            icon.rotation.x = -Math.PI / 2;
            icon.layers.set(1);
            this.scene.add(icon);
            ally.minimapIcon = icon;
            this.allies.push(ally);
        }
    }

    initUI() {
        const menu = document.getElementById('main-menu');
        const gameUI = document.getElementById('game-ui');
        const deployBtn = document.getElementById('btn-mission-1');

        deployBtn.addEventListener('click', () => {
            deployBtn.innerText = "LOADING...";
            deployBtn.disabled = true;

            // Small delay to allow the browser to process UI changes before locking pointer
            setTimeout(() => {
                menu.classList.add('hidden');
                gameUI.classList.remove('hidden');
                
                // Wrap in try-catch as Pointer Lock requires user interaction and can fail
                try {
                    this.player.requestPointerLock();
                } catch (e) {
                    console.warn("Pointer lock failed, but mission starting.");
                }
                
                deployBtn.innerText = "DEPLOY NOW";
                deployBtn.disabled = false;
            }, 500);
        });

        document.getElementById('btn-tutorial').addEventListener('click', () => {
            alert('WASD Move, Mouse Look, F Enter/Exit, Left Click Shoot. Space Jump. Right Click Sniper Mode.');
        });
        document.addEventListener('keydown', (e) => {
            if(e.key === 'Escape') { menu.classList.remove('hidden'); gameUI.classList.add('hidden'); document.exitPointerLock(); }
            if(e.code === 'KeyF') this.toggleVehicle();
        });
        document.addEventListener('mousedown', (e) => {
            if (this.activeVehicle && e.button === 2) { // Right Click
                this.activeVehicle.isSniperMode = !this.activeVehicle.isSniperMode;
            }
        });
        window.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    toggleVehicle() {
        if (this.activeVehicle) {
            this.activeVehicle.isOccupied = false;
            this.activeVehicle.isSniperMode = false;
            this.player.body.position.set(this.activeVehicle.body.position.x + 5, this.activeVehicle.body.position.y + 2, this.activeVehicle.body.position.z);
            this.player.enabled = true;
            this.activeVehicle = null;
        } else {
            const nearbyTank = this.tanks.find(t => new CANNON.Vec3().copy(t.body.position).vsub(this.player.body.position).length() < 12);
            const nearbyHeli = this.helicopters.find(h => new CANNON.Vec3().copy(h.body.position).vsub(this.player.body.position).length() < 12);
            if (nearbyTank) this.activeVehicle = nearbyTank;
            else if (nearbyHeli) this.activeVehicle = nearbyHeli;
            if (this.activeVehicle) { 
                this.activeVehicle.isOccupied = true; 
                this.player.enabled = false; 
                // Set initial camera position to prevent jump
                const targetPos = new THREE.Vector3();
                this.activeVehicle.chaseCameraAnchor.getWorldPosition(targetPos);
                this.player.camera.position.copy(targetPos);
            }
        }
    }

    onWindowResize() {
        this.player.camera.aspect = window.innerWidth / window.innerHeight;
        this.player.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const delta = this.clock.getDelta();
        
        this.world.step(1/60, delta, 10);
        this.base.update(delta, this.clock.elapsedTime);

        this.world.bodies.forEach(body => {
            if(body.mesh) { body.mesh.position.copy(body.position); body.mesh.quaternion.copy(body.quaternion); }
        });

        if (this.player.body.position.y < -15) {
            this.player.body.position.set(0, 10, 0);
            this.player.body.velocity.set(0, 0, 0);
        }

        if (this.activeVehicle) {
            this.activeVehicle.update(delta, this.player.moveState, this.player.camera);
            
            const targetPos = new THREE.Vector3();
            const anchor = (this.activeVehicle.isSniperMode && this.activeVehicle.sniperCameraAnchor) ? 
                this.activeVehicle.sniperCameraAnchor : 
                this.activeVehicle.chaseCameraAnchor;
                
            anchor.getWorldPosition(targetPos);
            
            // Smoothly move camera towards target anchor
            this.player.camera.position.lerp(targetPos, 0.1);
            
            if (this.activeVehicle.isSniperMode) {
                const targetRot = new THREE.Quaternion();
                anchor.getWorldQuaternion(targetRot);
                this.player.camera.quaternion.slerp(targetRot, 0.2);
            } else {
                const lookAtPos = new THREE.Vector3();
                if (this.activeVehicle instanceof Tank) {
                    this.activeVehicle.turretGroup.getWorldPosition(lookAtPos);
                } else {
                    this.activeVehicle.group.getWorldPosition(lookAtPos);
                }
                this.player.camera.lookAt(lookAtPos);
            }
            
            // Keep player body synced for proximity checks
            this.player.body.position.copy(this.activeVehicle.body.position);
        } else {
            this.player.update(delta, this.terrain);
        }

        const playerPos = this.activeVehicle ? this.activeVehicle.body.position : this.player.body.position;
        this.enemies.forEach((enemy, index) => {
            enemy.update(delta, playerPos, this.player);
            if (enemy.minimapIcon) {
                enemy.minimapIcon.position.set(enemy.body.position.x, 100, enemy.body.position.z);
                if (enemy.isDead) this.scene.remove(enemy.minimapIcon);
            }
            if (enemy.isDead && !enemy.group.parent) this.enemies.splice(index, 1);
        });

        // Update UI
        document.getElementById('health').innerText = `HP: ${Math.ceil(this.player.health)}`;
        document.getElementById('ammo').innerText = `AMMO: ${this.player.ammo}/150`;

        // Update Player Icon
        this.playerIcon.position.set(playerPos.x, 101, playerPos.z);
        const camEuler = new THREE.Euler().setFromQuaternion(this.player.camera.quaternion, 'YXZ');
        this.playerIcon.rotation.z = camEuler.y;

        // Update Minimap Camera
        this.minimapCamera.position.set(playerPos.x, 200, playerPos.z);

        // Update Compass Labels
        const labelDist = this.minimapSize * 0.85;
        this.compassLabels['N'].position.set(playerPos.x, 150, playerPos.z - labelDist);
        this.compassLabels['S'].position.set(playerPos.x, 150, playerPos.z + labelDist);
        this.compassLabels['E'].position.set(playerPos.x + labelDist, 150, playerPos.z);
        this.compassLabels['W'].position.set(playerPos.x - labelDist, 150, playerPos.z);

        // 1. Render Main Scene
        this.player.camera.layers.set(0); 
        this.renderer.render(this.scene, this.player.camera);

        // 2. Render Minimap
        this.minimapCamera.layers.enable(0);
        this.minimapCamera.layers.enable(1);
        this.minimapRenderer.render(this.scene, this.minimapCamera);
    }
}

new Game();