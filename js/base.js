import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Base {
    constructor(scene, world, position, audio, particles) {
        this.scene = scene;
        this.world = world;
        this.position = position;
        this.audio = audio;
        this.particles = particles;
        
        this.group = new THREE.Group();
        this.group.position.set(position.x, position.y, position.z);
        this.scene.add(this.group);

        this.initMaterials();
        
        this.createMuddyGround();
        this.createAirstrip();      
        this.createCantonment();    
        this.createFortifications(); 
        this.createSupplyDepot();   
        this.createSpawnPad();
        this.createDetailedBuildings();
        this.createMinimapHighlight();
    }

    initMaterials() {
        this.mudMat = new THREE.MeshStandardMaterial({ color: 0x1a1c1a, roughness: 1.0 });
        this.concreteMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.9 });
        this.armyGrayMat = new THREE.MeshStandardMaterial({ color: 0x5a5e5a, roughness: 0.8 });
        this.armyTanMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.9 });
        this.armyGreenMat = new THREE.MeshStandardMaterial({ color: 0x2e3b23, roughness: 0.9 });
        this.woodMat = new THREE.MeshStandardMaterial({ color: 0x3d2817, roughness: 0.9 });
        this.windowMat = new THREE.MeshStandardMaterial({ color: 0x050505, metalness: 0.9, roughness: 0.1 });
        this.roofMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });
    }

    createMuddyGround() {
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), this.mudMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.1;
        ground.receiveShadow = true;
        this.group.add(ground);
    }

    createAirstrip() {
        const runway = new THREE.Mesh(new THREE.BoxGeometry(20, 0.2, 120), this.concreteMat);
        runway.position.set(40, 0.1, 0);
        runway.castShadow = true;
        runway.receiveShadow = true;
        this.group.add(runway);
        
        const wBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(10, 0.1, 60)) });
        wBody.position.set(this.position.x + 40, this.position.y + 0.1, this.position.z);
        this.world.addBody(wBody);

        this.createTower(25, 0, -40);
    }

    createTower(x, y, z) {
        const towerGroup = new THREE.Group();
        towerGroup.position.set(x, y, z);
        this.group.add(towerGroup);

        const mesh = new THREE.Mesh(new THREE.BoxGeometry(6, 16, 6), this.concreteMat);
        mesh.position.y = 8;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        towerGroup.add(mesh);

        const tBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(3, 8, 3)) });
        tBody.position.set(this.position.x + x, this.position.y + 8, this.position.z + z);
        tBody.mesh = mesh;
        tBody.onHit = (damage) => {
            if(this.particles) this.particles.createPhysicalDebris(this.world, tBody.position, 0x555555, 1);
        };
        this.world.addBody(tBody);
    }

    createCantonment() {
        const colors = [this.armyGrayMat, this.armyTanMat, this.armyGreenMat];
        for(let row = 0; row < 2; row++) {
            const side = row === 0 ? -1 : 1;
            for(let i = 0; i < 3; i++) {
                this.createDetailedHut(side * 15 - 40, 0, -25 + (i * 18), colors[i % colors.length]);
            }
        }
    }

    createDetailedHut(x, y, z, mat) {
        const mesh = new THREE.Mesh(
            new THREE.CylinderGeometry(3.5, 3.5, 12, 12, 1, false, 0, Math.PI),
            mat
        );
        mesh.rotation.z = Math.PI / 2;
        mesh.rotation.x = Math.PI / 2;
        mesh.position.set(x, 0, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.group.add(mesh);

        const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(3.5, 2, 6)) });
        body.position.set(this.position.x + x, this.position.y + 1.5, this.position.z + z);
        body.mesh = mesh;
        body.onHit = (damage) => {
            if(this.particles) this.particles.createPhysicalDebris(this.world, body.position, 0x666666, 1);
        };
        this.world.addBody(body);
    }

    createFortifications() {
        const wallSize = 130;
        const height = 5;

        const walls = [
            { x: 0, z: -65, w: wallSize, d: 1.5 },
            { x: -65, z: 0, w: 1.5, d: wallSize },
            { x: 65, z: 0, w: 1.5, d: wallSize },
            { x: 40, z: 65, w: 50, d: 1.5 },
            { x: -40, z: 65, w: 50, d: 1.5 }
        ];

        walls.forEach(w => {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w.w, height, w.d), this.concreteMat);
            mesh.position.set(w.x, height/2, w.z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.group.add(mesh);
            const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(w.w/2, height/2, w.d/2)) });
            body.position.set(this.position.x + w.x, this.position.y + height/2, this.position.z + w.z);
            body.mesh = mesh;
            body.onHit = () => {
                if(this.particles) this.particles.createPhysicalDebris(this.world, body.position, 0x444444, 1);
            };
            this.world.addBody(body);
        });
    }

    createSupplyDepot() {
        for(let i=0; i<10; i++) {
            const rx = -15 + Math.random() * 30;
            const rz = 25 + Math.random() * 30;
            this.createDestructibleCrate(rx, 0, rz);
        }
    }

    createDestructibleCrate(x, y, z) {
        const size = 1.5 + Math.random();
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), this.woodMat);
        mesh.position.set(x, size/2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.group.add(mesh);

        const body = new CANNON.Body({ mass: 50, shape: new CANNON.Box(new CANNON.Vec3(size/2, size/2, size/2)) });
        body.position.set(this.position.x + x, this.position.y + size/2, this.position.z + z);
        body.mesh = mesh;
        body.health = 40;
        body.onHit = (damage) => {
            body.health -= damage;
            if(body.health <= 0) {
                this.group.remove(mesh);
                this.world.removeBody(body);
                if(this.particles) this.particles.createPhysicalDebris(this.world, body.position, 0x3d2817, 8);
            }
        };
        this.world.addBody(body);
    }

    createDetailedBuildings() {
        this.createDetailedBuilding(20, 0, -20, 14, 8, 18, this.armyGrayMat);
        this.createDetailedBuilding(-20, 0, 0, 12, 6, 14, this.armyTanMat);
        this.createDetailedBuilding(50, 0, -20, 10, 6, 10, this.armyGreenMat);
    }

    createDetailedBuilding(x, y, z, w, h, l, mat) {
        const bGroup = new THREE.Group();
        bGroup.position.set(x, y, z);
        this.group.add(bGroup);

        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), mat);
        mesh.position.y = h/2;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        bGroup.add(mesh);

        const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(w/2, h/2, l/2)) });
        body.position.set(this.position.x + x, this.position.y + h/2, this.position.z + z);
        body.mesh = mesh;
        body.onHit = () => {
             if(this.particles) this.particles.createPhysicalDebris(this.world, body.position, 0x555555, 1);
        };
        this.world.addBody(body);
    }

    createSpawnPad() {
        const pad = new THREE.Mesh(new THREE.BoxGeometry(20, 0.2, 20), this.concreteMat);
        pad.position.set(0, 0.1, 40); 
        pad.receiveShadow = true;
        this.group.add(pad);
    }

    createMinimapHighlight() {
        const icon = new THREE.Mesh(
            new THREE.BoxGeometry(25, 1, 25), 
            new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true })
        );
        icon.position.set(0, 120, 0);
        icon.layers.set(1);
        this.group.add(icon);
    }

    update(delta, time) {}
}