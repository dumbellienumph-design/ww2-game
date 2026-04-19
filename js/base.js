import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { VFX } from './vfx.js';

export class Base {
    constructor(scene, world, position, audio, particles, isEnemy = false) {
        this.scene = scene;
        this.world = world;
        this.position = position;
        this.audio = audio;
        this.particles = particles;
        this.isEnemy = isEnemy;
        
        this.group = new THREE.Group();
        this.group.position.set(position.x, position.y, position.z);
        this.scene.add(this.group);

        this.initMaterials();
        this.createMuddyGround();
        this.createAirstrip();      
        this.createCantonment();    
        this.createDestructibleFortifications(); 
        this.createSupplyDepot();   
        this.createSpawnPad();
        this.createDetailedBuildings();
        
        // --- NEW: BATTLEFIELD OBSTACLES FOR COVER ---
        this.createBattlefieldObstacles();

        if (!isEnemy) {
            this.createWorldBoundaries();
            this.createMinimapHighlight();
        } else {
            this.createCommandCenter();
        }
    }

    initMaterials() {
        this.mudMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 1.0 });
        this.concreteMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.9 });
        this.armyGrayMat = new THREE.MeshStandardMaterial({ color: 0x5a5e5a });
        this.armyTanMat = new THREE.MeshStandardMaterial({ color: 0x8b7355 });
        this.armyGreenMat = new THREE.MeshStandardMaterial({ color: 0x2e3b23 });
        this.woodMat = new THREE.MeshStandardMaterial({ color: 0x3d2817 });
        this.windowMat = new THREE.MeshStandardMaterial({ color: 0x050505, metalness: 0.9 });
        this.roofMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    }

    createBattlefieldObstacles() {
        // Dragon's Teeth (Anti-tank blocks) across the center field
        for(let i=0; i<10; i++) {
            const z = (i - 5) * 15;
            this.createDragonsTooth(this.isEnemy ? -40 : 40, 0, z);
        }
    }

    createDragonsTooth(x, y, z) {
        const mesh = new THREE.Mesh(new THREE.ConeGeometry(2, 3, 4), this.concreteMat);
        mesh.position.set(x, 1.5, z);
        mesh.rotation.y = Math.PI/4;
        mesh.castShadow = true; mesh.receiveShadow = true;
        this.group.add(mesh);

        const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(1, 1.5, 1)) });
        body.position.set(this.position.x + x, this.position.y + 1.5, this.position.z + z);
        this.world.addBody(body);
    }

    createWorldBoundaries() {
        const borderSize = 650;
        const borderHeight = 60;
        const thickness = 5;
        const borderMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

        const borders = [
            { x: 0, z: -borderSize/2, w: borderSize, d: thickness },
            { x: 0, z: borderSize/2, w: borderSize, d: thickness },
            { x: -borderSize/2, z: 0, w: thickness, d: borderSize },
            { x: borderSize/2, z: 0, w: thickness, d: borderSize }
        ];

        borders.forEach(b => {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.w, borderHeight, b.d), borderMat);
            mesh.position.set(b.x - this.position.x, borderHeight/2, b.z - this.position.z);
            this.group.add(mesh);
            const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(b.w/2, borderHeight/2, b.d/2)) });
            body.position.set(b.x, borderHeight/2, b.z);
            this.world.addBody(body);
        });
    }

    createCommandCenter() {
        const w=25, h=15, l=25;
        const bGroup = new THREE.Group();
        this.group.add(bGroup);

        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), this.armyGrayMat);
        mesh.position.y = h/2;
        mesh.castShadow = true; mesh.receiveShadow = true;
        bGroup.add(mesh);

        // Windows for Boss Building
        for(let i=0; i<8; i++) {
            const win = new THREE.Mesh(new THREE.PlaneGeometry(2, 3), this.windowMat);
            win.position.set((i%2===0?1:-1)*12.51, 8, (i<4?1:-1)*8);
            if(i%2===0) win.rotation.y = Math.PI/2; else win.rotation.y = -Math.PI/2;
            bGroup.add(win);
        }

        const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(w/2, h/2, l/2)) });
        body.position.set(this.position.x, this.position.y + h/2, this.position.z);
        body.mesh = mesh;
        body.health = 2500;
        body.onHit = (damage) => {
            body.health -= damage;
            if(this.particles) this.particles.createPhysicalDebris(this.world, body.position, 0x333333, 2);
            if(body.health <= 0 && !this.isDestroyed) {
                this.isDestroyed = true;
                VFX.createExplosion(this.scene, this.world, body.position, 40, 0, null);
                this.group.remove(bGroup);
                this.world.removeBody(body);
                if(window.game) window.game.endGame(true);
            }
        };
        this.world.addBody(body);
        this.hqBody = body;
    }

    createMuddyGround() {
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), this.mudMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.group.add(ground);
    }

    createAirstrip() {
        const runway = new THREE.Mesh(new THREE.BoxGeometry(30, 0.2, 140), this.concreteMat);
        runway.position.set(60, 0.1, 0);
        runway.receiveShadow = true;
        this.group.add(runway);
    }

    createDetailedBuildings() {
        const colors = [this.armyGrayMat, this.armyTanMat, this.armyGreenMat];
        // HQ
        this.createBuilding(20, 0, -20, 15, 8, 20, colors[0]);
        // Mess Hall
        this.createBuilding(-30, 0, 10, 12, 6, 16, colors[1]);
        // Motor Pool
        this.createBuilding(-30, 0, -30, 18, 7, 12, colors[2]);
    }

    createBuilding(x, y, z, w, h, l, mat) {
        const bGroup = new THREE.Group();
        bGroup.position.set(x, y, z);
        this.group.add(bGroup);

        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), mat);
        mesh.position.y = h/2;
        mesh.castShadow = true; mesh.receiveShadow = true;
        bGroup.add(mesh);

        const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1.5, 0.8, l + 1.5), this.roofMat);
        roof.position.y = h + 0.4;
        roof.castShadow = true; roof.receiveShadow = true;
        bGroup.add(roof);

        const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(w/2, h/2, l/2)) });
        body.position.set(this.position.x + x, this.position.y + h/2, this.position.z + z);
        body.mesh = mesh;
        this.world.addBody(body);
    }

    createCantonment() {
        for(let i=0; i<4; i++) {
            this.createSimpleHut(-60, 0, -40 + i*25);
        }
    }

    createSimpleHut(x, y, z) {
        const hut = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 15, 12, 1, false, 0, Math.PI), this.armyGrayMat);
        hut.rotation.z = Math.PI / 2; hut.rotation.x = Math.PI / 2;
        hut.position.set(x, 0, z);
        hut.castShadow = true; hut.receiveShadow = true;
        this.group.add(hut);
        const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(4, 3, 7.5)) });
        body.position.set(this.position.x + x, this.position.y + 2, this.position.z + z);
        this.world.addBody(body);
    }

    createDestructibleFortifications() {
        // Main front walls
        for(let i=0; i<6; i++) {
            this.createWallSeg(80, 0, -40 + i*15);
        }
    }

    createWallSeg(x, y, z) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 6, 12), this.concreteMat);
        mesh.position.set(x, 3, z);
        mesh.castShadow = true; mesh.receiveShadow = true;
        this.group.add(mesh);
        const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(1, 3, 6)) });
        body.position.set(this.position.x + x, this.position.y + 3, this.position.z + z);
        body.mesh = mesh;
        body.health = 200;
        body.onHit = (d) => { body.health -= d; if(body.health <= 0) { this.group.remove(mesh); this.world.removeBody(body); } };
        this.world.addBody(body);
    }

    createSupplyDepot() {
        for(let i=0; i<15; i++) {
            const rx = -10 + Math.random()*20; const rz = 40 + Math.random()*20;
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), this.woodMat);
            mesh.position.set(rx, 1, rz);
            mesh.castShadow = true; mesh.receiveShadow = true;
            this.group.add(mesh);
            const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(1, 1, 1)) });
            body.position.set(this.position.x + rx, this.position.y + 1, this.position.z + rz);
            body.mesh = mesh;
            body.onHit = () => { this.group.remove(mesh); this.world.removeBody(body); };
            this.world.addBody(body);
        }
    }

    createSpawnPad() {
        const pad = new THREE.Mesh(new THREE.BoxGeometry(25, 0.2, 25), this.concreteMat);
        pad.position.set(0, 0.1, 40); 
        pad.receiveShadow = true;
        this.group.add(pad);
    }

    createMinimapHighlight() {}

    update(delta, time) {}
}