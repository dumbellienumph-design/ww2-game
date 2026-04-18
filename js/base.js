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
        
        // --- OPTIMIZED BASE SECTIONS WITH VISUAL DETAIL ---
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
        // --- DARKENED MUDDY GROUND CONTRAST ---
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

        // Tower with Windows
        this.createTower(25, 0, -40);
    }

    createTower(x, y, z) {
        const towerGroup = new THREE.Group();
        towerGroup.position.set(x, y, z);
        this.group.add(towerGroup);

        const body = new THREE.Mesh(new THREE.BoxGeometry(6, 16, 6), this.concreteMat);
        body.position.y = 8;
        body.castShadow = true;
        body.receiveShadow = true;
        towerGroup.add(body);

        // Windows
        for(let i=0; i<4; i++) {
            const win = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.5), this.windowMat);
            win.position.set(0, 12, 3.01);
            win.rotation.y = (i * Math.PI) / 2;
            // Orbit placement
            const angle = (i * Math.PI) / 2;
            win.position.x = Math.sin(angle) * 3.01;
            win.position.z = Math.cos(angle) * 3.01;
            towerGroup.add(win);
        }

        const tBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(3, 8, 3)) });
        tBody.position.set(this.position.x + x, this.position.y + 8, this.position.z + z);
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
        const hutGroup = new THREE.Group();
        hutGroup.position.set(x, y, z);
        this.group.add(hutGroup);

        const hut = new THREE.Mesh(
            new THREE.CylinderGeometry(3.5, 3.5, 12, 12, 1, false, 0, Math.PI),
            mat
        );
        hut.rotation.z = Math.PI / 2;
        hut.rotation.x = Math.PI / 2;
        hut.castShadow = true;
        hut.receiveShadow = true;
        hutGroup.add(hut);

        // Door
        const door = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.5), this.windowMat);
        door.position.set(0, 1.25, -6.01);
        hutGroup.add(door);

        const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(3.5, 2, 6)) });
        body.position.set(this.position.x + x, this.position.y + 1.5, this.position.z + z);
        this.world.addBody(body);
    }

    createFortifications() {
        const wallSize = 130;
        const thickness = 1.5;
        const height = 5;

        const walls = [
            { x: 0, z: -65, w: wallSize, d: thickness },
            { x: -65, z: 0, w: thickness, d: wallSize },
            { x: 65, z: 0, w: thickness, d: wallSize },
            { x: 40, z: 65, w: 50, d: thickness },
            { x: -40, z: 65, w: 50, d: thickness }
        ];

        walls.forEach(w => {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w.w, height, w.d), this.concreteMat);
            mesh.position.set(w.x, height/2, w.z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.group.add(mesh);
            const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(w.w/2, height/2, w.d/2)) });
            body.position.set(this.position.x + w.x, this.position.y + height/2, this.position.z + w.z);
            this.world.addBody(body);
        });
    }

    createSupplyDepot() {
        for(let i=0; i<6; i++) {
            const rx = -15 + Math.random() * 30;
            const rz = 25 + Math.random() * 30;
            const mat = Math.random() > 0.5 ? this.woodMat : this.armyTanMat;
            const cluster = new THREE.Mesh(new THREE.BoxGeometry(4, 2.5, 4), mat);
            cluster.position.set(rx, 1.25, rz);
            cluster.castShadow = true;
            cluster.receiveShadow = true;
            this.group.add(cluster);
            const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(2, 1.25, 2)) });
            body.position.set(this.position.x + rx, this.position.y + 1.25, this.position.z + rz);
            this.world.addBody(body);
        }
    }

    createDetailedBuildings() {
        // HQ (Gray with Overhang Roof)
        this.createDetailedBuilding(20, 0, -20, 14, 8, 18, this.armyGrayMat);
        // Mess Hall (Tan)
        this.createDetailedBuilding(-20, 0, 0, 12, 6, 14, this.armyTanMat);
        // Signal Center (Green)
        this.createDetailedBuilding(50, 0, -20, 10, 6, 10, this.armyGreenMat);
    }

    createDetailedBuilding(x, y, z, w, h, l, mat) {
        const bGroup = new THREE.Group();
        bGroup.position.set(x, y, z);
        this.group.add(bGroup);

        const main = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), mat);
        main.position.y = h/2;
        main.castShadow = true;
        main.receiveShadow = true;
        bGroup.add(main);

        // Windows
        const winGeo = new THREE.PlaneGeometry(1.2, 1.8);
        for(let side = 0; side < 2; side++) {
            const sz = side === 0 ? 1 : -1;
            for(let i = -1; i <= 1; i++) {
                const win = new THREE.Mesh(winGeo, this.windowMat);
                win.position.set(i * (w/4), h * 0.6, (l/2 + 0.01) * sz);
                if(side === 1) win.rotation.y = Math.PI;
                bGroup.add(win);
            }
        }

        // Detailed Roof with overhang
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 2, 0.8, l + 2), this.roofMat);
        roof.position.y = h + 0.4;
        roof.castShadow = true;
        roof.receiveShadow = true;
        bGroup.add(roof);

        const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3((w+1)/2, (h+0.8)/2, (l+1)/2)) });
        body.position.set(this.position.x + x, this.position.y + h/2, this.position.z + z);
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