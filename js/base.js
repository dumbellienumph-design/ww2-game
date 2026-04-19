import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { VFX } from './vfx.js';

export class Base {
    constructor(scene, world, position, audio, particles, isEnemy = false) {
        this.scene = scene;
        this.world = world;
        this.position = position;
        this.particles = particles;
        this.isEnemy = isEnemy;
        
        this.group = new THREE.Group();
        this.group.position.set(position.x, position.y, position.z);
        this.scene.add(this.group);

        this.initMaterials();
        this.createGround();
        this.createDetailedBuildings();
        this.createFortifications();
        
        if (isEnemy) {
            this.createCommandCenter();
        } else {
            this.createSpawnPad();
        }

        // --- NEW: NO MAN'S LAND COVER ---
        this.createBattlefieldCover();
    }

    initMaterials() {
        this.mudMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
        this.concreteMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a });
        this.armyGrayMat = new THREE.MeshStandardMaterial({ color: 0x5a5e5a });
        this.armyGreenMat = new THREE.MeshStandardMaterial({ color: 0x2e3b23 });
        this.woodMat = new THREE.MeshStandardMaterial({ color: 0x3d2817 });
        this.sandbagMat = new THREE.MeshStandardMaterial({ color: 0x8b7355 });
    }

    createGround() {
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), this.mudMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.group.add(ground);
    }

    createBattlefieldCover() {
        // Only Allied base generates these toward the center
        if (this.isEnemy) return;
        
        for (let i = 0; i < 15; i++) {
            const x = 50 + Math.random() * 150;
            const z = (Math.random() - 0.5) * 200;
            const type = Math.random();
            
            if (type > 0.6) this.createDragonsTooth(x, 0, z);
            else this.createSandbagWall(x, 0, z, Math.random() * Math.PI);
        }
    }

    createDragonsTooth(x, y, z) {
        const mesh = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.5, 4), this.concreteMat);
        mesh.position.set(x, 1.25, z);
        mesh.rotation.y = Math.PI / 4;
        mesh.castShadow = true; mesh.receiveShadow = true;
        this.group.add(mesh);

        const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(0.8, 1.25, 0.8)) });
        body.position.set(this.position.x + x, this.position.y + 1.25, this.position.z + z);
        this.world.addBody(body);
    }

    createSandbagWall(x, y, z, rot) {
        const wall = new THREE.Group();
        wall.position.set(x, 0.4, z);
        wall.rotation.y = rot;
        
        for(let i=0; i<3; i++) {
            for(let j=0; j<2; j++) {
                const bag = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.6, 4, 8), this.sandbagMat);
                bag.rotation.z = Math.PI / 2;
                bag.position.set((i-1)*0.7, j*0.5, 0);
                wall.add(bag);
            }
        }
        this.group.add(wall);

        const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(1.2, 0.6, 0.4)) });
        body.position.set(this.position.x + x, this.position.y + 0.6, this.position.z + z);
        body.quaternion.setFromEuler(0, rot, 0);
        this.world.addBody(body);
    }

    createCommandCenter() {
        const w=25, h=15, l=25;
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), this.armyGrayMat);
        mesh.position.y = h/2;
        mesh.castShadow = true; mesh.receiveShadow = true;
        this.group.add(mesh);

        const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(w/2, h/2, l/2)) });
        body.position.set(this.position.x, this.position.y + h/2, this.position.z);
        body.mesh = mesh;
        body.health = 2500;
        body.onHit = (damage) => {
            body.health -= damage;
            if (body.health <= 0 && !this.isDestroyed) {
                this.isDestroyed = true;
                VFX.createExplosion(this.scene, this.world, body.position, 40, 0, null);
                this.group.remove(mesh);
                this.world.removeBody(body);
                if(window.game) window.game.endGame(true);
            }
        };
        this.world.addBody(body);
        this.hqBody = body;
    }

    createDetailedBuildings() {
        this.createBuilding(30, 0, -30, 15, 8, 20, this.armyGrayMat);
        this.createBuilding(-40, 0, 20, 12, 6, 16, this.armyGreenMat);
    }

    createBuilding(x, y, z, w, h, l, mat) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), mat);
        mesh.position.set(x, h/2, z);
        mesh.castShadow = true; mesh.receiveShadow = true;
        this.group.add(mesh);

        const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(w/2, h/2, l/2)) });
        body.position.set(this.position.x + x, this.position.y + h/2, this.position.z + z);
        this.world.addBody(body);
    }

    createFortifications() {
        for(let i=0; i<4; i++) {
            this.createWallSeg(70, 0, -30 + i*20);
        }
    }

    createWallSeg(x, y, z) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 5, 15), this.concreteMat);
        mesh.position.set(x, 2.5, z);
        mesh.castShadow = true; mesh.receiveShadow = true;
        this.group.add(mesh);
        const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(1, 2.5, 7.5)) });
        body.position.set(this.position.x + x, this.position.y + 2.5, this.position.z + z);
        this.world.addBody(body);
    }

    createSpawnPad() {
        const pad = new THREE.Mesh(new THREE.BoxGeometry(25, 0.2, 25), this.concreteMat);
        pad.position.set(0, 0.1, 50); 
        this.group.add(pad);
    }

    update(delta, time) {}
}