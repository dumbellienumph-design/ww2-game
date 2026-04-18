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
        
        // --- OPTIMIZED BASE SECTIONS ---
        this.createAirstrip();      
        this.createCantonment();    
        this.createFortifications(); 
        this.createSupplyDepot();   
        this.createSpawnPad();
        this.createSimpleBuildings();
        this.createMinimapHighlight();
    }

    initMaterials() {
        this.concreteMat = new THREE.MeshStandardMaterial({ color: 0x5a5a5a, roughness: 0.9 });
        this.armyGrayMat = new THREE.MeshStandardMaterial({ color: 0x707470, roughness: 0.8 });
        this.woodMat = new THREE.MeshStandardMaterial({ color: 0x4d2a15, roughness: 0.9 });
        this.sandbagMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 1.0 });
        this.darkGreenMat = new THREE.MeshStandardMaterial({ color: 0x1a2e1a, roughness: 0.9 });
        this.dirtMat = new THREE.MeshStandardMaterial({ color: 0x554433, roughness: 1.0 });
        this.metalMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5, roughness: 0.5 });
    }

    createAirstrip() {
        const runway = new THREE.Mesh(new THREE.BoxGeometry(20, 0.2, 120), this.concreteMat);
        runway.position.set(40, 0.1, 0);
        this.group.add(runway);
        
        const wBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(10, 0.1, 60)) });
        wBody.position.set(this.position.x + 40, this.position.y + 0.1, this.position.z);
        this.world.addBody(wBody);

        // Simple Tower
        const tower = new THREE.Mesh(new THREE.BoxGeometry(6, 16, 6), this.concreteMat);
        tower.position.set(25, 8, -40);
        this.group.add(tower);
        const tBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(3, 8, 3)) });
        tBody.position.set(this.position.x + 25, this.position.y + 8, this.position.z - 40);
        this.world.addBody(tBody);
    }

    createCantonment() {
        // Consolidated Quonset Huts (simplified meshes)
        for(let row = 0; row < 2; row++) {
            const side = row === 0 ? -1 : 1;
            for(let i = 0; i < 3; i++) {
                this.createSimpleHut(side * 15 - 40, 0, -25 + (i * 18));
            }
        }
    }

    createSimpleHut(x, y, z) {
        const hut = new THREE.Mesh(
            new THREE.CylinderGeometry(3.5, 3.5, 12, 8, 1, false, 0, Math.PI),
            this.armyGrayMat
        );
        hut.rotation.z = Math.PI / 2;
        hut.rotation.x = Math.PI / 2;
        hut.position.set(x, 0, z);
        this.group.add(hut);

        const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(3.5, 2, 6)) });
        body.position.set(this.position.x + x, this.position.y + 1.5, this.position.z + z);
        this.world.addBody(body);
    }

    createFortifications() {
        const wallSize = 130;
        const thickness = 1;
        const height = 4;

        const walls = [
            { x: 0, z: -65, w: wallSize, d: thickness },
            { x: -65, z: 0, w: thickness, d: wallSize },
            { x: 65, z: 0, w: thickness, d: wallSize },
            { x: 40, z: 65, w: 50, d: thickness }, // South wall L
            { x: -40, z: 65, w: 50, d: thickness }  // South wall R
        ];

        walls.forEach(w => {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w.w, height, w.d), this.concreteMat);
            mesh.position.set(w.x, height/2, w.z);
            this.group.add(mesh);
            const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(w.w/2, height/2, w.d/2)) });
            body.position.set(this.position.x + w.x, this.position.y + height/2, this.position.z + w.z);
            this.world.addBody(body);
        });
    }

    createSupplyDepot() {
        // Consolidated crates/barrels into simple clusters
        for(let i=0; i<5; i++) {
            const rx = -15 + Math.random() * 30;
            const rz = 25 + Math.random() * 30;
            const cluster = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 4), this.woodMat);
            cluster.position.set(rx, 1, rz);
            this.group.add(cluster);
            const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(2, 1, 2)) });
            body.position.set(this.position.x + rx, this.position.y + 1, this.position.z + rz);
            this.world.addBody(body);
        }
    }

    createSimpleBuildings() {
        // HQ
        this.createBuilding(20, 0, -20, 12, 7, 15, "HEADQUARTERS");
        // Mess Hall
        this.createBuilding(-20, 0, 0, 10, 5, 12, "MESS HALL");
        // Signal Center
        this.createBuilding(50, 0, -20, 8, 5, 8, "SIGNAL CENTER");
    }

    createBuilding(x, y, z, w, h, l, label) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), this.armyGrayMat);
        b.position.set(x, h/2, z);
        this.group.add(b);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.5, l + 1), this.darkGreenMat);
        roof.position.set(x, h + 0.25, z);
        this.group.add(roof);

        const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(w/2, h/2 + 0.25, l/2)) });
        body.position.set(this.position.x + x, this.position.y + h/2, this.position.z + z);
        this.world.addBody(body);
    }

    createSpawnPad() {
        const pad = new THREE.Mesh(new THREE.BoxGeometry(15, 0.2, 15), this.concreteMat);
        pad.position.set(0, 0.1, 45); // Centered at local 0, 45
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

    update(delta, time) {
        // Simplified searchlights removed for performance
    }
}