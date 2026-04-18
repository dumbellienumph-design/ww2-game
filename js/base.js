import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Base {
    constructor(scene, world, position) {
        this.scene = scene;
        this.world = world;
        this.position = position;
        
        this.group = new THREE.Group();
        this.group.position.set(position.x, position.y, position.z);
        this.scene.add(this.group);

        this.initMaterials();
        
        this.searchlights = [];

        // --- BASE SECTIONS ---
        this.createAirstrip();      
        this.createCantonment();    
        this.createFortifications(); 
        this.createSupplyDepot();   
        this.createSpawnPad();
        this.createMinimapHighlight();
        this.createMainGate(0, 65);
        this.createMessHall(-20, 0, 0); 
        this.createHeadquarters(20, 0, -20);
        this.createParadeGround(20, 0, 10);
        this.createSignalCenter(50, 0, -20);
        this.createMotorPoolComplex(-50, 0, 10);
        this.createFuelFarm(-50, 0, -30);
        this.createAmmunitionMags(-50, 0, -55);
        this.createWaterTower(50, 0, 40);
        this.createTrainingGround(-40, 0, 45);
    }

    initMaterials() {
        this.concreteMat = new THREE.MeshStandardMaterial({ color: 0x5a5a5a, roughness: 0.9 });
        this.formworkConcreteMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 1.0 });
        this.oilStainedConcreteMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 });
        this.corrugatedMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.6, roughness: 0.4 });
        this.camoMat = new THREE.MeshStandardMaterial({ color: 0x354230, roughness: 1.0 });
        this.earthBermMat = new THREE.MeshStandardMaterial({ color: 0x2d4c0b, roughness: 1.0 });
        this.woodMat = new THREE.MeshStandardMaterial({ color: 0x4d2a15, roughness: 0.9 });
        this.weatheredWoodMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 1.0 });
        this.sandbagMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 1.0 });
        this.metalMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.2 });
        this.armyGrayMat = new THREE.MeshStandardMaterial({ color: 0x707470, metalness: 0.5, roughness: 0.6 });
        this.blastDoorMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.9, roughness: 0.3 });
        this.steelLatticeMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.3, wireframe: true });
        this.dirtMat = new THREE.MeshStandardMaterial({ color: 0x554433, roughness: 1.0 });
        this.wireMat = new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.9, wireframe: true });
        this.whiteWoodMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.9 });
        this.creamSidingMat = new THREE.MeshStandardMaterial({ color: 0xe5e0c5, roughness: 1.0 }); 
        this.darkGreenMat = new THREE.MeshStandardMaterial({ color: 0x1a2e1a, roughness: 0.9 });
        this.brickMat = new THREE.MeshStandardMaterial({ color: 0x7a3a2a, roughness: 0.9 });
        this.stripeRedMat = new THREE.MeshStandardMaterial({ color: 0x8b0000 });
        this.stripeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        this.blackMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        this.stoneMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 1.0 });
    }

    createAirstrip() {
        const runwayGeo = new THREE.BoxGeometry(20, 0.2, 120);
        const runway = new THREE.Mesh(runwayGeo, this.concreteMat);
        runway.position.set(40, 0.1, 0);
        runway.receiveShadow = true;
        this.group.add(runway);

        const wShape = new CANNON.Box(new CANNON.Vec3(10, 0.1, 60));
        const wBody = new CANNON.Body({ mass: 0, shape: wShape });
        wBody.position.set(this.position.x + 40, this.position.y + 0.1, this.position.z + 0);
        this.world.addBody(wBody);

        this.createControlTower(25, 0, -40);
        this.createHangar(55, 0, 0);
    }

    createControlTower(x, y, z) {
        const towerGroup = new THREE.Group();
        towerGroup.position.set(x, y, z);
        this.group.add(towerGroup);
        const base = new THREE.Mesh(new THREE.BoxGeometry(6, 12, 6), this.concreteMat);
        base.position.y = 6;
        towerGroup.add(base);
        const deck = new THREE.Mesh(new THREE.BoxGeometry(8, 4, 8), new THREE.MeshStandardMaterial({ color: 0x111111, transparent: true, opacity: 0.6 }));
        deck.position.y = 14;
        towerGroup.add(deck);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.5, 8.2), this.concreteMat);
        roof.position.y = 16;
        towerGroup.add(roof);
        const body = new CANNON.Body({ mass: 0 });
        body.addShape(new CANNON.Box(new CANNON.Vec3(3, 6, 3)), new CANNON.Vec3(0, 6, 0));
        body.addShape(new CANNON.Box(new CANNON.Vec3(4, 2, 4)), new CANNON.Vec3(0, 14, 0));
        body.position.set(this.position.x + x, this.position.y, this.position.z + z);
        this.world.addBody(body);
    }

    createHangar(x, y, z) {
        const hangarGroup = new THREE.Group();
        hangarGroup.position.set(x, y, z);
        this.group.add(hangarGroup);
        const hangarGeo = new THREE.CylinderGeometry(10, 10, 30, 12, 1, false, 0, Math.PI);
        hangarGeo.rotateZ(Math.PI / 2);
        hangarGeo.rotateX(Math.PI / 2);
        const hangar = new THREE.Mesh(hangarGeo, this.corrugatedMat);
        hangarGroup.add(hangar);
        const body = new CANNON.Body({ mass: 0 });
        for (let i = 0; i < 5; i++) {
            const angle = (i / 4) * Math.PI;
            const px = Math.cos(angle) * 9.5;
            const py = Math.sin(angle) * 9.5;
            const box = new CANNON.Box(new CANNON.Vec3(1.5, 0.5, 15));
            const quat = new CANNON.Quaternion();
            quat.setFromEuler(0, 0, angle + Math.PI/2);
            body.addShape(box, new CANNON.Vec3(px, py, 0), quat);
        }
        body.position.set(this.position.x + x, this.position.y, this.position.z + z);
        this.world.addBody(body);
    }

    createCantonment() {
        const streetWidth = 10;
        const hutSpacingX = 12;
        const hutSpacingZ = 18;
        for(let row = 0; row < 2; row++) {
            const side = row === 0 ? -1 : 1;
            const xOffset = side * (streetWidth/2 + hutSpacingX/2);
            for(let i = 0; i < 3; i++) {
                const zOffset = -25 + (i * hutSpacingZ);
                this.createQuonsetHut(xOffset - 40, 0, zOffset);
            }
            this.createWashhouse(xOffset - 40, 0, 30);
        }
        const streetGeo = new THREE.PlaneGeometry(60, streetWidth);
        const street = new THREE.Mesh(streetGeo, this.dirtMat);
        street.rotation.x = -Math.PI/2;
        street.position.set(-40, 0.06, -7);
        this.group.add(street);
    }

    createQuonsetHut(x, y, z) {
        const hutGroup = new THREE.Group();
        hutGroup.position.set(x, y, z);
        this.group.add(hutGroup);
        const radius = 3.5, width = 10, length = 12;
        const hutGeo = new THREE.CylinderGeometry(radius, radius, length, 24, 1, true, 0, Math.PI);
        hutGeo.rotateZ(Math.PI / 2);
        hutGeo.rotateX(Math.PI / 2);
        const hut = new THREE.Mesh(hutGeo, this.corrugatedMat);
        hutGroup.add(hut);
        const wallGeo = new THREE.CircleGeometry(radius, 24, 0, Math.PI);
        const wallF = new THREE.Mesh(wallGeo, this.woodMat);
        wallF.position.set(0, 0, -length/2);
        hutGroup.add(wallF);
        const wallB = wallF.clone();
        wallB.position.z = length/2;
        wallB.rotation.y = Math.PI;
        hutGroup.add(wallB);
        const door = new THREE.Mesh(new THREE.PlaneGeometry(1, 2), this.blackMat);
        door.position.set(0, 1, -length/2 - 0.01);
        hutGroup.add(door);
        const step = new THREE.Mesh(new THREE.BoxGeometry(2, 0.3, 1), this.concreteMat);
        step.position.set(0, 0.15, -length/2 - 0.5);
        hutGroup.add(step);
        const body = new CANNON.Body({ mass: 0 });
        for(let i=0; i<3; i++) {
            const angle = (i/2) * Math.PI;
            const px = Math.cos(angle) * 3;
            const py = Math.sin(angle) * 3;
            const box = new CANNON.Box(new CANNON.Vec3(1, 0.5, length/2));
            const quat = new CANNON.Quaternion();
            quat.setFromEuler(0, 0, angle + Math.PI/2);
            if(py > 0) body.addShape(box, new CANNON.Vec3(px, py, 0), quat);
        }
        body.addShape(new CANNON.Box(new CANNON.Vec3(1, 0.15, 0.5)), new CANNON.Vec3(0, 0.15, -length/2 - 0.5));
        body.position.set(this.position.x + x, this.position.y, this.position.z + z);
        this.world.addBody(body);
    }

    createWashhouse(x, y, z) {
        const washGroup = new THREE.Group();
        washGroup.position.set(x, y, z);
        this.group.add(washGroup);
        const w = 5, l = 8, h = 3;
        const slab = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.2, l + 1), this.concreteMat);
        slab.position.y = 0.1;
        washGroup.add(slab);
        const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), this.creamSidingMat);
        building.position.y = h/2 + 0.2;
        washGroup.add(building);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.2, l + 0.5), this.darkGreenMat);
        roof.position.y = h + 0.3;
        roof.rotation.x = 0.1;
        washGroup.add(roof);
        const body = new CANNON.Body({ mass: 0 });
        body.addShape(new CANNON.Box(new CANNON.Vec3((w+1)/2, 0.1, (l+1)/2)), new CANNON.Vec3(0, 0.1, 0));
        body.addShape(new CANNON.Box(new CANNON.Vec3(w/2, h/2, l/2)), new CANNON.Vec3(0, h/2 + 0.2, 0));
        body.position.set(this.position.x + x, this.position.y, this.position.z + z);
        this.world.addBody(body);
    }

    createFortifications() {
        const wallSize = 130;
        const gateOpening = 15;
        const bounds = [
            { x: 0, z: -wallSize/2, len: wallSize, rot: 0 },       
            { x: 0, z: wallSize/2, len: wallSize, rot: 0, isSouth: true }, 
            { x: -wallSize/2, z: 0, len: wallSize, rot: Math.PI/2 }, 
            { x: wallSize/2, z: 0, len: wallSize, rot: Math.PI/2 }  
        ];
        bounds.forEach(b => {
            if(b.isSouth) {
                const sideLen = (wallSize - gateOpening) / 2;
                this.createDoubleFence(gateOpening/2 + sideLen/2, b.z, sideLen, b.rot);
                this.createDoubleFence(-gateOpening/2 - sideLen/2, b.z, sideLen, b.rot);
            } else { 
                this.createDoubleFence(b.x, b.z, b.len, b.rot); 
            }
        });
        const cornerCoords = [[-65, -65], [65, -65], [-65, 65], [65, 65]];
        cornerCoords.forEach(c => this.createWatchTower(c[0], 0, c[1]));
    }

    createWatchTower(x, y, z) {
        const towerGroup = new THREE.Group();
        towerGroup.position.set(x, y, z);
        this.group.add(towerGroup);
        const h = 14;
        const tower = new THREE.Mesh(new THREE.BoxGeometry(4, h, 4), this.woodMat);
        tower.position.y = h/2;
        towerGroup.add(tower);
        const box = new THREE.Mesh(new THREE.BoxGeometry(5, 3.5, 5), this.woodMat);
        box.position.y = h + 1.75;
        towerGroup.add(box);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(6, 0.5, 6), this.darkGreenMat);
        roof.position.y = h + 3.5;
        towerGroup.add(roof);
        const lightBase = new THREE.Group();
        lightBase.position.set(0, h + 3.8, 0);
        towerGroup.add(lightBase);
        const slMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.2, 12).rotateX(Math.PI/2), this.metalMat);
        lightBase.add(slMesh);
        const beamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, side: THREE.DoubleSide });
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 15, 100, 12, 1, true).rotateX(-Math.PI/2).translate(0, 0, -50), beamMat);
        lightBase.add(beam);
        this.searchlights.push(lightBase);
        const bagGeo = new THREE.CapsuleGeometry(0.25, 0.5, 4, 8).rotateZ(Math.PI/2);
        const body = new CANNON.Body({ mass: 0 });
        body.addShape(new CANNON.Box(new CANNON.Vec3(2, h/2, 2)), new CANNON.Vec3(0, h/2, 0));
        body.addShape(new CANNON.Box(new CANNON.Vec3(2.5, 1.75, 2.5)), new CANNON.Vec3(0, h + 1.75, 0));
        for(let a = -Math.PI/2; a <= Math.PI/2; a += Math.PI/8) {
            const bx = Math.cos(a) * 4.5;
            const bz = Math.sin(a) * 4.5;
            for(let h_stack=0; h_stack<3; h_stack++) {
                const bag = new THREE.Mesh(bagGeo, this.sandbagMat);
                bag.position.set(bx, h_stack*0.4 + 0.25, bz);
                bag.rotation.y = a + Math.PI/2;
                towerGroup.add(bag);
                const bagShape = new CANNON.Cylinder(0.25, 0.25, 1.0, 8);
                const bagQuat = new CANNON.Quaternion();
                bagQuat.setFromEuler(0, a + Math.PI/2, Math.PI/2);
                body.addShape(bagShape, new CANNON.Vec3(bx, h_stack*0.4 + 0.25, bz), bagQuat);
            }
        }
        body.position.set(this.position.x + x, this.position.y, this.position.z + z);
        this.world.addBody(body);
    }

    createDoubleFence(x, z, length, rotation) {
        const fenceGroup = new THREE.Group();
        fenceGroup.position.set(x, 0, z);
        fenceGroup.rotation.y = rotation;
        this.group.add(fenceGroup);
        const fenceDist = 3.0;
        const path = new THREE.Mesh(new THREE.PlaneGeometry(length, fenceDist + 1), this.dirtMat);
        path.rotation.x = -Math.PI/2;
        path.position.y = 0.05;
        fenceGroup.add(path);
        const body = new CANNON.Body({ mass: 0 });
        for(let side = -1; side <= 1; side += 2) {
            const sideZ = side * (fenceDist / 2);
            const postCount = Math.floor(length / 3);
            for(let i=0; i<=postCount; i++) {
                const lx = (i / postCount - 0.5) * length;
                const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3), this.metalMat);
                post.position.set(lx, 1.5, sideZ);
                fenceGroup.add(post);
                const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.8, 0.05), this.metalMat);
                arm.position.set(lx, 2.8, sideZ + (side * 0.2));
                arm.rotation.x = side * (Math.PI / 4);
                fenceGroup.add(arm);
            }
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(length, 2.5), new THREE.MeshStandardMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.3, side: THREE.DoubleSide }));
            mesh.position.set(0, 1.25, sideZ);
            fenceGroup.add(mesh);
            const coilCount = Math.floor(length / 1.5);
            for(let i=0; i<coilCount; i++) {
                const lx = (i / coilCount - 0.5) * length;
                const coil = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.02, 8, 20), this.wireMat);
                coil.position.set(lx, 0.4, sideZ);
                coil.rotation.y = Math.PI/2;
                fenceGroup.add(coil);
            }
            body.addShape(new CANNON.Box(new CANNON.Vec3(length/2, 1.5, 0.2)), new CANNON.Vec3(0, 1.5, sideZ));
        }
        const quat = new CANNON.Quaternion();
        quat.setFromEuler(0, rotation, 0);
        body.quaternion.copy(quat);
        body.position.set(this.position.x + x, this.position.y, this.position.z + z);
        this.world.addBody(body);
    }

    createMainGate(x, z) {
        const gateGroup = new THREE.Group();
        gateGroup.position.set(x, 0, z);
        this.group.add(gateGroup);
        const gh = new THREE.Group();
        gh.position.set(-6, 0, 0);
        gateGroup.add(gh);
        const house = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), this.whiteWoodMat);
        house.position.y = 1.5;
        gh.add(house);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.4, 3.4), this.darkGreenMat);
        roof.position.y = 3.2;
        gh.add(roof);
        const winMat = new THREE.MeshStandardMaterial({ color: 0x050505, metalness: 0.9, roughness: 0.1 });
        const wFront = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.5), winMat); wFront.position.set(0, 1.8, 1.51); gh.add(wFront);
        const wLeft = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.5), winMat); wLeft.position.set(-1.51, 1.8, 0); wLeft.rotation.y = -Math.PI/2; gh.add(wLeft);
        const wRight = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.5), winMat); wRight.position.set(1.51, 1.8, 0); wRight.rotation.y = Math.PI/2; gh.add(wRight);
        const ghBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(1.5, 1.5, 1.5)) });
        ghBody.position.set(this.position.x + x - 6, this.position.y + 1.5, this.position.z + z);
        this.world.addBody(ghBody);
        const armPivot = new THREE.Group();
        armPivot.position.set(-3.5, 1.2, 0);
        gateGroup.add(armPivot);
        const pivotPost = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.5), this.darkGreenMat);
        pivotPost.position.y = -0.5;
        armPivot.add(pivotPost);
        for(let i=0; i<10; i++) {
            const seg = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.2, 0.2), i%2 === 0 ? this.stripeRedMat : this.stripeWhiteMat);
            seg.position.set(i + 0.5, 0, 0);
            armPivot.add(seg);
        }
        armPivot.rotation.z = 0.1;
        const armBody = new CANNON.Body({ mass: 0 });
        const armQuat = new CANNON.Quaternion();
        armQuat.setFromEuler(0, 0, 0.1);
        armBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 0.1, 0.1)), new CANNON.Vec3(1.5, 1.2 + 0.5, 0), armQuat);
        armBody.position.set(this.position.x + x, this.position.y, this.position.z + z);
        this.world.addBody(armBody);
        const sentry = new THREE.Group();
        sentry.position.set(-10, 0, 3);
        gateGroup.add(sentry);
        const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.8, 1.2), this.whiteWoodMat);
        box.position.y = 1.4;
        sentry.add(box);
        for(let i=0; i<8; i++) {
            const stripe = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.2), this.blackMat);
            stripe.position.set(0, 0.4 + i*0.3, 0.61);
            stripe.rotation.z = Math.PI / 4;
            sentry.add(stripe);
        }
        const sBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(0.6, 1.4, 0.6)) });
        sBody.position.set(this.position.x + x - 10, this.position.y + 1.4, this.position.z + z + 3);
        this.world.addBody(sBody);
        const signGroup = new THREE.Group();
        signGroup.position.set(4, 0, 0);
        gateGroup.add(signGroup);
        const signPost = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3, 0.15), this.woodMat);
        signPost.position.y = 1.5;
        signGroup.add(signPost);
        const signBoard = new THREE.Mesh(new THREE.BoxGeometry(3, 1.5, 0.1), this.whiteWoodMat);
        signBoard.position.y = 2.5;
        signGroup.add(signBoard);
        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white'; ctx.fillRect(0,0,512,256);
        ctx.fillStyle = 'black'; ctx.font = 'bold 80px Courier New'; ctx.textAlign = 'center';
        ctx.fillText('STOP', 256, 100); ctx.font = 'bold 32px Courier New'; ctx.fillText('IDENTIFICATION REQUIRED', 256, 180);
        const textMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.3), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas) }));
        textMesh.position.set(0, 2.5, 0.06);
        signGroup.add(textMesh);
        const signBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(1.5, 1.5, 0.1)) });
        signBody.position.set(this.position.x + x + 4, this.position.y + 1.5, this.position.z + z);
        this.world.addBody(signBody);
    }

    createMessHall(x, y, z) {
        const mhGroup = new THREE.Group();
        mhGroup.position.set(x, y, z);
        this.group.add(mhGroup);
        const width = 8, length = 20, height = 4;
        for(let px = -width/2 + 0.5; px <= width/2 - 0.5; px += width-1) {
            for(let pz = -length/2 + 0.5; pz <= length/2 - 0.5; pz += 4) {
                const pier = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), this.concreteMat);
                pier.position.set(px, 0.25, pz);
                mhGroup.add(pier);
            }
        }
        const main = new THREE.Mesh(new THREE.BoxGeometry(width, height, length), this.creamSidingMat);
        main.position.y = height/2 + 0.5;
        main.castShadow = true;
        mhGroup.add(main);
        const roofGroup = new THREE.Group();
        roofGroup.position.y = height + 0.5;
        mhGroup.add(roofGroup);
        const roofShape = new THREE.Shape();
        roofShape.moveTo(-width/2 - 0.5, 0);
        roofShape.lineTo(0, 2.5);
        roofShape.lineTo(width/2 + 0.5, 0);
        roofShape.closePath();
        const roofExtrude = new THREE.ExtrudeGeometry(roofShape, { depth: length + 1, bevelEnabled: false });
        const roof = new THREE.Mesh(roofExtrude, this.darkGreenMat);
        roof.position.z = -length/2 - 0.5;
        roofGroup.add(roof);
        const chimney = new THREE.Mesh(new THREE.BoxGeometry(1.2, 7, 1.2), this.brickMat);
        chimney.position.set(0, 4, length/2 - 2);
        mhGroup.add(chimney);
        const winMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.2 });
        for(let wz = -length/2 + 2; wz <= length/2 - 4; wz += 2.5) {
            const wL = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.2), winMat);
            wL.position.set(-width/2 - 0.01, height/2 + 0.5, wz);
            wL.rotation.y = -Math.PI/2;
            mhGroup.add(wL);
            const wR = wL.clone();
            wR.position.x = width/2 + 0.01;
            wR.rotation.y = Math.PI/2;
            mhGroup.add(wR);
        }
        const porch = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 2), this.woodMat);
        porch.position.set(0, 0.5, -length/2 - 1);
        mhGroup.add(porch);
        const porchRoof = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.2, 2.2), this.darkGreenMat);
        porchRoof.position.set(0, 3.2, -length/2 - 1);
        mhGroup.add(porchRoof);
        const body = new CANNON.Body({ mass: 0 });
        body.addShape(new CANNON.Box(new CANNON.Vec3(width/2, height/2, length/2)), new CANNON.Vec3(0, height/2 + 0.5, 0));
        body.addShape(new CANNON.Box(new CANNON.Vec3(2, 0.2, 1)), new CANNON.Vec3(0, 0.5, -length/2 - 1));
        body.position.set(this.position.x + x, this.position.y, this.position.z + z);
        this.world.addBody(body);
    }

    createHeadquarters(x, y, z) {
        const hqGroup = new THREE.Group();
        hqGroup.position.set(x, y, z);
        this.group.add(hqGroup);
        const w = 12, l = 15, h = 7;
        const main = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), this.whiteWoodMat);
        main.position.y = h/2;
        main.castShadow = true;
        hqGroup.add(main);
        const amGeo = new THREE.BoxGeometry(w + 0.4, 0.1, 0.5);
        for(let i=0; i<2; i++) {
            const am = new THREE.Mesh(amGeo, this.darkGreenMat);
            am.position.set(0, 2.5 + i*3, -l/2 - 0.2);
            am.rotation.x = -0.3;
            hqGroup.add(am);
        }
        const porch = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 2), this.concreteMat);
        porch.position.set(0, 0.2, -l/2 - 1);
        hqGroup.add(porch);
        const colGeo = new THREE.BoxGeometry(0.3, h, 0.3);
        const colL = new THREE.Mesh(colGeo, this.whiteWoodMat);
        colL.position.set(-1.8, h/2, -l/2 - 1.8);
        hqGroup.add(colL);
        const colR = colL.clone();
        colR.position.x = 1.8;
        hqGroup.add(colR);
        const portRoof = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.3, 2.4), this.darkGreenMat);
        portRoof.position.set(0, h, -l/2 - 1);
        hqGroup.add(portRoof);
        const flagGroup = new THREE.Group();
        flagGroup.position.set(0, 0, -l/2 - 8);
        hqGroup.add(flagGroup);
        const court = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 0.2, 32), this.stoneMat);
        flagGroup.add(court);
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 15), this.whiteWoodMat);
        mast.position.y = 7.5;
        flagGroup.add(mast);
        const crosstree = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 0.1), this.whiteWoodMat);
        crosstree.position.y = 12;
        flagGroup.add(crosstree);
        const finial = new THREE.Mesh(new THREE.SphereGeometry(0.15), new THREE.MeshStandardMaterial({color: 0xffd700, metalness: 1}));
        finial.position.y = 15;
        flagGroup.add(finial);
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.8), this.whiteWoodMat);
        sign.position.set(0, 1.5, -l/2 - 1.96);
        hqGroup.add(sign);
        const body = new CANNON.Body({ mass: 0 });
        body.addShape(new CANNON.Box(new CANNON.Vec3(w/2, h/2, l/2)), new CANNON.Vec3(0, h/2, 0));
        body.addShape(new CANNON.Box(new CANNON.Vec3(2, 0.2, 1)), new CANNON.Vec3(0, 0.2, -l/2 - 1));
        body.position.set(this.position.x + x, this.position.y, this.position.z + z);
        this.world.addBody(body);
    }

    createParadeGround(x, y, z) {
        const pgGroup = new THREE.Group();
        pgGroup.position.set(x, y, z);
        this.group.add(pgGroup);
        const w = 40, l = 40;
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(w, l), this.dirtMat);
        ground.rotation.x = -Math.PI/2;
        ground.position.y = 0.05;
        pgGroup.add(ground);
        const stoneGeo = new THREE.BoxGeometry(0.6, 0.3, 0.4);
        for(let side = 0; side < 4; side++) {
            const isHorizontal = side % 2 === 0;
            const length = isHorizontal ? w : l;
            const count = Math.floor(length / 1.5);
            for(let i=0; i<count; i++) {
                const s = new THREE.Mesh(stoneGeo, this.stoneMat);
                const pos = (i / count - 0.5) * length;
                const offset = 20.2;
                if(side === 0) s.position.set(pos, 0.15, -offset);
                if(side === 1) s.position.set(offset, 0.15, pos);
                if(side === 2) s.position.set(pos, 0.15, offset);
                if(side === 3) s.position.set(-offset, 0.15, pos);
                s.rotation.y = isHorizontal ? 0 : Math.PI/2;
                pgGroup.add(s);
            }
        }
    }

    createSignalCenter(x, y, z) {
        const scGroup = new THREE.Group();
        scGroup.position.set(x, y, z);
        this.group.add(scGroup);
        const bunker = new THREE.Mesh(new THREE.BoxGeometry(8, 4, 10), this.formworkConcreteMat);
        bunker.position.set(-5, 2, 0);
        scGroup.add(bunker);
        const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.3), this.metalMat);
        door.position.set(-5, 1.1, 5.1);
        scGroup.add(door);
        const towerHeight = 25;
        const towerGroup = new THREE.Group();
        towerGroup.position.set(8, 0, 0);
        scGroup.add(towerGroup);
        const towerSkeleton = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 3, towerHeight, 4), this.steelLatticeMat);
        towerSkeleton.position.y = towerHeight / 2;
        towerGroup.add(towerSkeleton);
        const trench = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 1), this.concreteMat);
        trench.position.set(1, 0.1, 0);
        scGroup.add(trench);
        const bunkerBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(4, 2, 5)) });
        bunkerBody.position.set(this.position.x + x - 5, this.position.y + 2, this.position.z + z);
        this.world.addBody(bunkerBody);
        const towerBody = new CANNON.Body({ mass: 0, shape: new CANNON.Cylinder(3, 3, towerHeight, 8) });
        towerBody.position.set(this.position.x + x + 8, this.position.y + towerHeight/2, this.position.z + z);
        this.world.addBody(towerBody);
    }

    createMotorPoolComplex(x, y, z) {
        const mpGroup = new THREE.Group();
        mpGroup.position.set(x, y, z);
        this.group.add(mpGroup);
        const shedW = 20, shedL = 12, shedH = 6;
        const floor = new THREE.Mesh(new THREE.BoxGeometry(shedW, 0.2, shedL), this.oilStainedConcreteMat);
        floor.position.y = 0.1;
        mpGroup.add(floor);
        const backWall = new THREE.Mesh(new THREE.BoxGeometry(shedW, shedH, 0.5), this.woodMat);
        backWall.position.set(0, shedH/2, shedL/2 - 0.25);
        mpGroup.add(backWall);
        const sideWallGeo = new THREE.BoxGeometry(0.5, shedH, shedL);
        const wallL = new THREE.Mesh(sideWallGeo, this.woodMat);
        wallL.position.set(-shedW/2 + 0.25, shedH/2, 0);
        mpGroup.add(wallL);
        const wallR = wallL.clone();
        wallR.position.x = shedW/2 - 0.25;
        mpGroup.add(wallR);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(shedW + 1, 0.2, shedL + 1), this.corrugatedMat);
        roof.position.y = shedH;
        roof.rotation.x = -0.1;
        mpGroup.add(roof);
        const pit = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 8), this.blackMat);
        pit.position.set(0, 0.16, -1);
        mpGroup.add(pit);
        const body = new CANNON.Body({ mass: 0 });
        body.addShape(new CANNON.Box(new CANNON.Vec3(shedW/2, shedH/2, 0.25)), new CANNON.Vec3(0, shedH/2, shedL/2 - 0.25));
        body.addShape(new CANNON.Box(new CANNON.Vec3(0.25, shedH/2, shedL/2)), new CANNON.Vec3(-shedW/2, shedH/2, 0));
        body.addShape(new CANNON.Box(new CANNON.Vec3(0.25, shedH/2, shedL/2)), new CANNON.Vec3(shedW/2, shedH/2, 0));
        body.addShape(new CANNON.Box(new CANNON.Vec3(shedW/2, 0.1, shedL/2)), new CANNON.Vec3(0, 0.1, 0));
        body.position.set(this.position.x + x, this.position.y, this.position.z + z);
        this.world.addBody(body);
    }

    createFuelFarm(x, y, z) {
        const fuelGroup = new THREE.Group();
        fuelGroup.position.set(x, y, z);
        this.group.add(fuelGroup);
        const farmW = 15, farmL = 15;
        const breakMesh = new THREE.Mesh(new THREE.PlaneGeometry(farmW + 5, farmL + 5), this.dirtMat);
        breakMesh.rotation.x = -Math.PI/2;
        breakMesh.position.y = 0.05;
        fuelGroup.add(breakMesh);
        const drumGeo = new THREE.CylinderGeometry(0.4, 0.4, 1.2, 12);
        const palletGeo = new THREE.BoxGeometry(2, 0.15, 2);
        const body = new CANNON.Body({ mass: 0 });
        const createStack = (sx, sz) => {
            const pallet = new THREE.Mesh(palletGeo, this.woodMat);
            pallet.position.set(sx, 0.07, sz);
            fuelGroup.add(pallet);
            for(let dx = -0.5; dx <= 0.5; dx += 1) {
                for(let dz = -0.5; dz <= 0.5; dz += 1) {
                    for(let dh = 0; dh < 2; dh++) {
                        const drum = new THREE.Mesh(drumGeo, this.metalMat);
                        drum.position.set(sx + dx, 0.75 + (dh * 1.2), sz + dz);
                        fuelGroup.add(drum);
                    }
                }
            }
            body.addShape(new CANNON.Box(new CANNON.Vec3(1, 1.2, 1)), new CANNON.Vec3(sx, 1.2, sz));
        };
        createStack(-3, -2);
        createStack(3, 3);
        const netH = 3.5;
        const netGroup = new THREE.Group();
        netGroup.position.y = netH;
        fuelGroup.add(netGroup);
        const netGeo = new THREE.PlaneGeometry(farmW, farmL, 8, 8);
        const net = new THREE.Mesh(netGeo, this.wireMat);
        net.rotation.x = -Math.PI/2;
        netGroup.add(net);
        body.position.set(this.position.x + x, this.position.y, this.position.z + z);
        this.world.addBody(body);
    }

    createAmmunitionMags(x, y, z) {
        const magGroup = new THREE.Group();
        magGroup.position.set(x, y, z);
        this.group.add(magGroup);
        const w = 12, l = 15, h = 4.5;
        const bermGeo = new THREE.CylinderGeometry(w/2 + 1, w/2 + 1, l, 24, 1, false, 0, Math.PI);
        bermGeo.rotateZ(Math.PI / 2);
        bermGeo.rotateX(Math.PI / 2);
        const berm = new THREE.Mesh(bermGeo, this.earthBermMat);
        magGroup.add(berm);
        const headwall = new THREE.Mesh(new THREE.BoxGeometry(w + 2, h + 1, 0.6), this.formworkConcreteMat);
        headwall.position.set(0, (h+1)/2, l/2);
        magGroup.add(headwall);
        const wingGeo = new THREE.BoxGeometry(0.6, h + 1, 4);
        const wingL = new THREE.Mesh(wingGeo, this.formworkConcreteMat);
        wingL.position.set(-w/2 - 1, (h+1)/2, l/2 + 2);
        wingL.rotation.y = -0.3;
        magGroup.add(wingL);
        const wingR = wingL.clone();
        wingR.position.x = w/2 + 1;
        wingR.rotation.y = 0.3;
        magGroup.add(wingR);
        for(let side = -1; side <= 1; side += 2) {
            const door = new THREE.Mesh(new THREE.BoxGeometry(2.1, 3.2, 0.2), this.blastDoorMat);
            door.position.set(side * 1.1, 1.6, l/2 + 0.3);
            magGroup.add(door);
        }
        const body = new CANNON.Body({ mass: 0 });
        body.addShape(new CANNON.Box(new CANNON.Vec3(w/2 + 1, h/2 + 0.5, l/2)), new CANNON.Vec3(0, h/2 + 0.5, 0));
        body.position.set(this.position.x + x, this.position.y, this.position.z + z);
        this.world.addBody(body);
    }

    createTrainingGround(x, y, z) {
        const tgGroup = new THREE.Group();
        tgGroup.position.set(x, y, z);
        this.group.add(tgGroup);
        const wallH = 2.5, wallW = 6;
        const wallGroup = new THREE.Group();
        wallGroup.position.set(-10, 0, 0);
        tgGroup.add(wallGroup);
        const wallMain = new THREE.Mesh(new THREE.BoxGeometry(wallW, wallH, 0.4), this.weatheredWoodMat);
        wallMain.position.y = wallH/2;
        wallGroup.add(wallMain);
        const wallBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(wallW/2, wallH/2, 0.2)) });
        wallBody.position.set(this.position.x + x - 10, this.position.y + wallH/2, this.position.z + z);
        this.world.addBody(wallBody);
        const pitW = 6, pitL = 15;
        const sand = new THREE.Mesh(new THREE.PlaneGeometry(pitW, pitL), this.dirtMat);
        sand.rotation.x = -Math.PI/2; sand.position.y = 0.05; tgGroup.add(sand);
        const logGroup = new THREE.Group();
        logGroup.position.set(10, 0, 0);
        tgGroup.add(logGroup);
        for(let i=0; i<3; i++) {
            const log = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 5), this.woodMat);
            log.rotateX(Math.PI/2); log.position.set(i%2 === 0 ? 0.5 : -0.5, 0.4, (i-1)*5); logGroup.add(log);
            const logBody = new CANNON.Body({ mass: 0, shape: new CANNON.Cylinder(0.2, 0.2, 5, 8) });
            logBody.quaternion.setFromEuler(Math.PI/2, 0, 0);
            logBody.position.set(this.position.x + x + 10 + log.position.x, this.position.y + 0.4, this.position.z + z + log.position.z);
            this.world.addBody(logBody);
        }
    }

    createSupplyDepot() {
        for(let i=0; i<20; i++) {
            const rx = -15 + Math.random() * 30;
            const rz = 25 + Math.random() * 30;
            if (Math.random() > 0.4) this.createCrate(rx, 0, rz);
            else this.createBarrel(rx, 0, rz);
        }
    }

    createCrate(x, y, z) {
        const s = 1.2 + Math.random() * 0.8;
        const crate = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), this.woodMat);
        crate.position.set(x, s/2, z);
        crate.rotation.y = Math.random() * Math.PI;
        this.group.add(crate);
        const body = new CANNON.Body({ mass: 100, shape: new CANNON.Box(new CANNON.Vec3(s/2, s/2, s/2)) });
        body.position.set(this.position.x + x, this.position.y + s/2, this.position.z + z);
        const quat = new CANNON.Quaternion();
        quat.setFromEuler(0, crate.rotation.y, 0);
        body.quaternion.copy(quat);
        this.world.addBody(body);
        body.mesh = crate; 
    }

    createBarrel(x, y, z) {
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.2, 12), this.metalMat);
        barrel.position.set(x, 0.6, z);
        this.group.add(barrel);
        const body = new CANNON.Body({ mass: 50, shape: new CANNON.Cylinder(0.4, 0.4, 1.2, 8) });
        body.position.set(this.position.x + x, this.position.y + 0.6, this.position.z + z);
        this.world.addBody(body);
        body.mesh = barrel;
    }

    update(delta, time) {
        this.searchlights.forEach((sl, i) => {
            sl.rotation.y = Math.sin(time * 0.5 + i) * 1.5;
            sl.rotation.x = Math.sin(time * 0.3 + i) * 0.4 - 0.2;
        });
    }

    createSpawnPad() {
        const pad = new THREE.Mesh(new THREE.BoxGeometry(12, 0.5, 12), this.concreteMat);
        pad.position.set(0, 0.25, 0);
        this.group.add(pad);
        const padBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(6, 0.25, 6)) });
        padBody.position.set(this.position.x, this.position.y + 0.25, this.position.z);
        this.world.addBody(padBody);
    }

    createMinimapHighlight() {
        const iconGeo = new THREE.BoxGeometry(25, 1, 25);
        const iconMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true });
        const icon = new THREE.Mesh(iconGeo, iconMat);
        icon.position.set(0, 120, 0);
        icon.layers.set(1);
        this.group.add(icon);
    }

    createWaterTower(x, y, z) {
        const wtGroup = new THREE.Group();
        wtGroup.position.set(x, y, z);
        this.group.add(wtGroup);
        const height = 20, tankRadius = 4, tankHeight = 5;
        const legGeo = new THREE.CylinderGeometry(0.15, 0.2, height, 8);
        const spread = 4;
        const legPositions = [[spread, spread], [-spread, spread], [spread, -spread], [-spread, -spread]];
        legPositions.forEach(pos => {
            const leg = new THREE.Mesh(legGeo, this.armyGrayMat);
            leg.position.set(pos[0], height/2, pos[1]);
            leg.rotation.z = -Math.sign(pos[0]) * 0.1;
            leg.rotation.x = Math.sign(pos[1]) * 0.1;
            wtGroup.add(leg);
        });
        const jacket = new THREE.Mesh(new THREE.BoxGeometry(1.2, height, 1.2), this.woodMat);
        jacket.position.y = height/2;
        wtGroup.add(jacket);
        const tankBase = new THREE.Group();
        tankBase.position.y = height;
        wtGroup.add(tankBase);
        const bottom = new THREE.Mesh(new THREE.SphereGeometry(tankRadius, 16, 16, 0, Math.PI*2, Math.PI/2, Math.PI/2), this.armyGrayMat);
        tankBase.add(bottom);
        const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(tankRadius, tankRadius, tankHeight, 16), this.armyGrayMat);
        cylinder.position.y = tankHeight/2;
        tankBase.add(cylinder);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(tankRadius + 0.2, 2.5, 16), this.metalMat);
        roof.position.y = tankHeight + 1.25;
        tankBase.add(roof);
        const body = new CANNON.Body({ mass: 0 });
        body.addShape(new CANNON.Cylinder(tankRadius, tankRadius, height + tankHeight, 8));
        body.position.set(this.position.x + x, this.position.y + (height+tankHeight)/2, this.position.z + z);
        this.world.addBody(body);
    }
}