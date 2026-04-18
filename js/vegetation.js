import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Vegetation {
    constructor(scene, world, terrain) {
        this.scene = scene;
        this.world = world;
        this.terrain = terrain;
        
        this.treeCount = 100;
        this.bushCount = 150;
        this.grassCount = 30000;
        
        this.init();
    }

    isNearBase(x, z) {
        // Base area: Roughly centered at -50, -50 with a radius of 75 to be safe
        const dx = x - (-50);
        const dz = z - (-50);
        return (dx * dx + dz * dz) < 75 * 75;
    }

    init() {
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x3d2817 });
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x1a3314 });
        const bushMat = new THREE.MeshStandardMaterial({ color: 0x2d4c0b });

        for (let i = 0; i < this.treeCount + this.bushCount; i++) {
            const isTree = i < this.treeCount;
            let x = (Math.random() - 0.5) * 450;
            let z = (Math.random() - 0.5) * 450;
            
            if (this.isNearBase(x, z)) continue;

            const y = this.getYAt(x, z);
            if (y === null) continue;
            if (isTree) this.createTree(x, y, z, woodMat, leafMat);
            else this.createBush(x, y, z, bushMat);
        }

        this.createGrass();
    }

    getYAt(x, z) {
        const raycaster = new THREE.Raycaster();
        raycaster.set(new THREE.Vector3(x, 100, z), new THREE.Vector3(0, -1, 0));
        const intersects = raycaster.intersectObject(this.terrain.mesh);
        return intersects.length > 0 ? intersects[0].point.y : null;
    }

    createTree(x, y, z, woodMat, leafMat) {
        const group = new THREE.Group();
        group.position.set(x, y, z);
        const trunkHeight = 4 + Math.random() * 3;
        const trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, trunkHeight, 6);
        const trunk = new THREE.Mesh(trunkGeo, woodMat);
        trunk.position.y = trunkHeight / 2;
        group.add(trunk);
        const layers = 3 + Math.floor(Math.random() * 2);
        for (let j = 0; j < layers; j++) {
            const coneGeo = new THREE.ConeGeometry(2.5 - j * 0.4, 3, 8);
            const leaves = new THREE.Mesh(coneGeo, leafMat);
            leaves.position.y = trunkHeight * 0.7 + j * 1.5;
            group.add(leaves);
        }
        this.scene.add(group);
        const trunkShape = new CANNON.Cylinder(0.5, 0.5, trunkHeight, 8);
        const trunkBody = new CANNON.Body({ mass: 0, shape: trunkShape, position: new CANNON.Vec3(x, y + trunkHeight / 2, z)});
        this.world.addBody(trunkBody);
    }

    createBush(x, y, z, bushMat) {
        const group = new THREE.Group();
        group.position.set(x, y, z);
        const size = 0.6 + Math.random() * 1.2;
        for (let j = 0; j < 4; j++) {
            const sphereGeo = new THREE.IcosahedronGeometry(size, 0);
            const sphere = new THREE.Mesh(sphereGeo, bushMat);
            sphere.position.set((Math.random() - 0.5) * size, Math.random() * size * 0.5, (Math.random() - 0.5) * size);
            sphere.scale.set(1, 0.7, 1);
            group.add(sphere);
        }
        this.scene.add(group);
        const bushShape = new CANNON.Sphere(size * 0.8);
        const bushBody = new CANNON.Body({ mass: 0, shape: bushShape, position: new CANNON.Vec3(x, y + size * 0.4, z)});
        this.world.addBody(bushBody);
    }

    createGrass() {
        const bladeGeo = new THREE.PlaneGeometry(0.2, 0.5, 1, 1);
        const posAttr = bladeGeo.attributes.position;
        posAttr.setX(0, -0.02);
        posAttr.setX(1, 0.02);
        bladeGeo.translate(0, 0.25, 0);

        const plane1 = bladeGeo.clone();
        const plane2 = bladeGeo.clone().rotateY(Math.PI / 3);
        const plane3 = bladeGeo.clone().rotateY(-Math.PI / 3);
        
        const mergedGeometry = new THREE.BufferGeometry();
        const positions = [];
        const normals = [];
        const uvs = [];

        [plane1, plane2, plane3].forEach(p => {
            positions.push(...p.attributes.position.array);
            normals.push(...p.attributes.normal.array);
            uvs.push(...p.attributes.uv.array);
        });

        mergedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        mergedGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        mergedGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

        const material = new THREE.MeshStandardMaterial({ 
            color: 0x3a5f0b, 
            side: THREE.DoubleSide,
            flatShading: true,
            roughness: 1.0
        });

        const instancedMesh = new THREE.InstancedMesh(mergedGeometry, material, this.grassCount);
        const dummy = new THREE.Object3D();

        for (let i = 0; i < this.grassCount; i++) {
            const x = (Math.random() - 0.5) * 490;
            const z = (Math.random() - 0.5) * 490;
            
            if (this.isNearBase(x, z)) {
                dummy.position.set(0, -100, 0);
            } else {
                const y = this.getYAt(x, z);
                if (y === null) {
                    dummy.position.set(0, -100, 0);
                } else {
                    dummy.position.set(x, y, z);
                    dummy.rotation.y = Math.random() * Math.PI;
                    const s = 0.7 + Math.random() * 0.6;
                    dummy.scale.set(s, s, s);
                }
            }
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);
        }

        instancedMesh.instanceMatrix.needsUpdate = true;
        this.scene.add(instancedMesh);
    }
}