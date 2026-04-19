import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Vegetation {
    constructor(scene, world, terrain) {
        this.scene = scene;
        this.world = world;
        this.terrain = terrain;
        
        this.treeCount = 100;
        this.bushCount = 150;
        this.grassCount = 5000;

        this.objects = []; 
        this.grass = null;
        this.windTime = 0;
        
        this.init();
    }

    isNearBase(x, z) {
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
        trunk.castShadow = true; trunk.receiveShadow = true;
        group.add(trunk);

        const leafGroup = new THREE.Group();
        leafGroup.position.y = trunkHeight * 0.7;
        group.add(leafGroup);

        const layers = 3 + Math.floor(Math.random() * 2);
        for (let j = 0; j < layers; j++) {
            const coneGeo = new THREE.ConeGeometry(2.5 - j * 0.4, 3, 8);
            const leaves = new THREE.Mesh(coneGeo, leafMat);
            leaves.position.y = j * 1.5;
            leaves.castShadow = true; leaves.receiveShadow = true;
            leafGroup.add(leaves);
        }
        
        const trunkShape = new CANNON.Cylinder(0.5, 0.5, trunkHeight, 8);
        const trunkBody = new CANNON.Body({ mass: 0, shape: trunkShape, position: new CANNON.Vec3(x, y + trunkHeight / 2, z)});
        
        this.objects.push({ mesh: group, leafGroup: leafGroup, body: trunkBody, active: false, type: 'tree' });
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
            sphere.castShadow = true; sphere.receiveShadow = true;
            group.add(sphere);
        }
        
        const bushShape = new CANNON.Sphere(size * 0.8);
        const bushBody = new CANNON.Body({ mass: 0, shape: bushShape, position: new CANNON.Vec3(x, y + size * 0.4, z)});
        
        this.objects.push({ mesh: group, body: bushBody, active: false, type: 'bush' });
    }

    createGrass() {
        const bladeGeo = new THREE.PlaneGeometry(0.2, 0.6, 1, 4);
        bladeGeo.translate(0, 0.3, 0);

        const material = new THREE.MeshStandardMaterial({ 
            color: 0x3a5f0b, 
            side: THREE.DoubleSide,
            flatShading: true,
            roughness: 1.0
        });

        // --- NEW: GRASS WIND ANIMATION SHADER ---
        material.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = { value: 0 };
            shader.vertexShader = `
                uniform float uTime;
                ${shader.vertexShader}
            `.replace(
                `#include <begin_vertex>`,
                `#include <begin_vertex>
                float speed = 1.5;
                float heightFactor = position.y * 0.5;
                float wind = sin(uTime * speed + instanceMatrix[3][0] * 0.1 + instanceMatrix[3][2] * 0.1) * 0.2;
                transformed.x += wind * heightFactor;
                transformed.z += wind * heightFactor * 0.5;
                `
            );
            this.grassShader = shader;
        };

        const instancedMesh = new THREE.InstancedMesh(bladeGeo, material, this.grassCount);
        const dummy = new THREE.Object3D();

        for (let i = 0; i < this.grassCount; i++) {
            const x = (Math.random() - 0.5) * 490;
            const z = (Math.random() - 0.5) * 490;
            if (this.isNearBase(x, z)) { dummy.position.set(0, -100, 0); } 
            else {
                const y = this.getYAt(x, z);
                if (y === null) dummy.position.set(0, -100, 0);
                else {
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
        instancedMesh.receiveShadow = true;
        this.scene.add(instancedMesh);
        this.grass = instancedMesh;
    }

    update(delta) {
        this.windTime += delta;

        // Update Tree Sway
        this.objects.forEach(obj => {
            if (obj.active && obj.type === 'tree' && obj.leafGroup) {
                const sway = Math.sin(this.windTime * 1.2 + obj.body.position.x * 0.1) * 0.03;
                obj.leafGroup.rotation.z = sway;
                obj.leafGroup.rotation.x = sway * 0.5;
            }
        });

        // Update Grass Wind
        if (this.grassShader) {
            this.grassShader.uniforms.uTime.value = this.windTime;
        }
    }
}