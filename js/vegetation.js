import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Vegetation {
    constructor(scene, world, terrain) {
        this.scene = scene;
        this.world = world;
        this.terrain = terrain;
        
        this.treeCount = 120;
        this.bushCount = 180;
        this.grassCount = 6000;

        this.objects = []; 
        this.grass = null;
        this.windTime = 0;
        
        this.init();
    }

    isNearBase(x, z) {
        const distAllied = Math.sqrt((x - (-150))**2 + (z - 0)**2);
        const distEnemy = Math.sqrt((x - 150)**2 + (z - 0)**2);
        return distAllied < 130 || distEnemy < 130;
    }

    init() {
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0a, roughness: 0.9 });
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x142b0a, roughness: 1.0 });
        const bushMat = new THREE.MeshStandardMaterial({ color: 0x1e330d, roughness: 1.0 });

        for (let i = 0; i < this.treeCount + this.bushCount; i++) {
            const isTree = i < this.treeCount;
            let x = (Math.random() - 0.5) * 800;
            let z = (Math.random() - 0.5) * 800;
            
            if (this.isNearBase(x, z)) continue;

            const y = this.getYAt(x, z);
            if (y === null) continue;
            
            if (isTree) this.createTree(x, y, z, woodMat, leafMat);
            else this.createBush(x, y, z, bushMat);
        }

        this.createGrass();
    }

    getYAt(x, z) {
        if (!this.terrain || !this.terrain.mesh) return 0;
        const raycaster = new THREE.Raycaster();
        raycaster.set(new THREE.Vector3(x, 300, z), new THREE.Vector3(0, -1, 0));
        const intersects = raycaster.intersectObject(this.terrain.mesh);
        return intersects.length > 0 ? intersects[0].point.y : 0;
    }

    createTree(x, y, z, woodMat, leafMat) {
        const group = new THREE.Group();
        group.position.set(x, y, z);
        
        const trunkHeight = 5 + Math.random() * 4;
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, trunkHeight, 6), woodMat);
        trunk.position.y = trunkHeight / 2;
        trunk.castShadow = true; trunk.receiveShadow = true;
        group.add(trunk);

        const leafGroup = new THREE.Group();
        leafGroup.position.y = trunkHeight * 0.7;
        group.add(leafGroup);

        const layers = 4;
        for (let j = 0; j < layers; j++) {
            const leaves = new THREE.Mesh(new THREE.ConeGeometry(3 - j*0.6, 4, 8), leafMat);
            leaves.position.y = j * 1.8;
            leaves.castShadow = true; leaves.receiveShadow = true;
            leafGroup.add(leaves);
        }
        
        // Physics body is STATIC (mass 0)
        const body = new CANNON.Body({ mass: 0, shape: new CANNON.Cylinder(0.5, 0.5, trunkHeight, 8), position: new CANNON.Vec3(x, y + trunkHeight/2, z)});
        this.world.addBody(body);

        this.objects.push({ mesh: group, leafGroup: leafGroup, active: false, type: 'tree' });
    }

    createBush(x, y, z, bushMat) {
        const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 0), bushMat);
        mesh.position.set(x, y + 0.5, z);
        mesh.scale.set(1, 0.6, 1);
        mesh.castShadow = true; mesh.receiveShadow = true;
        
        const body = new CANNON.Body({ mass: 0, shape: new CANNON.Sphere(1.2), position: new CANNON.Vec3(x, y + 0.5, z)});
        this.world.addBody(body);

        this.objects.push({ mesh: mesh, active: false, type: 'bush' });
    }

    createGrass() {
        const bladeGeo = new THREE.PlaneGeometry(0.3, 0.8, 1, 3);
        bladeGeo.translate(0, 0.4, 0);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0x2d3b1a, side: THREE.DoubleSide, roughness: 1.0
        });

        material.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = { value: 0 };
            shader.vertexShader = `
                uniform float uTime;
                ${shader.vertexShader}
            `.replace(
                `#include <begin_vertex>`,
                `#include <begin_vertex>
                float wind = sin(uTime * 1.5 + position.x * 2.0 + position.z * 2.0) * (position.y * 0.3);
                transformed.x += wind;
                `
            );
            this.grassShader = shader;
        };

        const instancedMesh = new THREE.InstancedMesh(bladeGeo, material, this.grassCount);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < this.grassCount; i++) {
            const x = (Math.random() - 0.5) * 900;
            const z = (Math.random() - 0.5) * 900;
            if (this.isNearBase(x, z)) { dummy.position.set(0, -500, 0); } 
            else {
                const y = this.getYAt(x, z);
                dummy.position.set(x, y, z);
                dummy.rotation.y = Math.random() * Math.PI;
                const s = 0.8 + Math.random() * 0.8;
                dummy.scale.set(s, s, s);
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
        this.objects.forEach(obj => {
            if (obj.active && obj.type === 'tree' && obj.leafGroup) {
                obj.leafGroup.rotation.z = Math.sin(this.windTime * 0.8 + obj.mesh.position.x) * 0.05;
            }
        });
        if (this.grassShader) this.grassShader.uniforms.uTime.value = this.windTime;
    }
}