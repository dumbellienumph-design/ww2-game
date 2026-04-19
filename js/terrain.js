import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Terrain {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        
        this.size = 1000; 
        this.resolution = 128; 
        
        this.init();
    }

    init() {
        const geometry = new THREE.PlaneGeometry(this.size, this.size, this.resolution, this.resolution);
        const vertices = geometry.attributes.position.array;
        
        // Add vertex colors for detail
        geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(vertices.length), 3));
        const colors = geometry.attributes.color.array;

        const noise = (x, z, s) => Math.sin(x * s) * Math.cos(z * s);

        for (let i = 0, j = 0; i < vertices.length; i += 3, j += 3) {
            const x = vertices[i];
            const z = vertices[i + 1];
            
            // Base Locations
            const distToAlliedBase = Math.sqrt((x - (-150))**2 + (z - 0)**2);
            const distToEnemyBase = Math.sqrt((x - 150)**2 + (z - 0)**2);

            // 1. GENERATE MOUNTAINS (Low frequency noise)
            let height = noise(x, z, 0.005) * 30;
            height += noise(x, z, 0.02) * 10;
            height += noise(x, z, 0.05) * 2; // Mid frequency grit

            // Jagged edge mountains
            const edgeDist = Math.max(Math.abs(x), Math.abs(z));
            if (edgeDist > 300) {
                const edgeFactor = (edgeDist - 300) / 200;
                height += edgeFactor * 50 * (Math.random() * 0.5 + 0.5);
            }

            // 2. LEVEL THE BASES (Flattening circles)
            if (distToAlliedBase < 120) {
                const factor = Math.max(0, Math.min(1, (distToAlliedBase - 70) / 50));
                height *= factor;
            } else if (distToEnemyBase < 120) {
                const factor = Math.max(0, Math.min(1, (distToEnemyBase - 70) / 50));
                height *= factor;
            }

            vertices[i + 2] = height;

            // 3. PROCEDURAL VERTEX COLORS (Mud/Grass mix)
            const hFactor = Math.max(0, Math.min(1, height / 20));
            const dirtFactor = Math.random() * 0.2;
            
            // Grass Base
            let r = 0.15, g = 0.2, b = 0.1;
            
            // High peaks (Rocks/Dirt)
            if (height > 15) { r = 0.3; g = 0.28; b = 0.25; }
            // Low mud patches
            else if (height < 2) { r = 0.12; g = 0.1; b = 0.08; }

            colors[j] = r + dirtFactor;
            colors[j+1] = g + dirtFactor;
            colors[j+2] = b + dirtFactor;
        }

        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({ 
            vertexColors: true,
            roughness: 1.0,
            metalness: 0.0,
            flatShading: false
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.rotation.x = -Math.PI / 2;
        this.mesh.receiveShadow = true;
        this.mesh.name = 'terrain';
        this.scene.add(this.mesh);

        // Physics
        const matrix = [];
        for (let i = 0; i <= this.resolution; i++) {
            matrix.push([]);
            for (let j = 0; j <= this.resolution; j++) {
                const index = (i * (this.resolution + 1) + j) * 3;
                matrix[i].push(vertices[index + 2]);
            }
        }

        const hfShape = new CANNON.Heightfield(matrix, {
            elementSize: this.size / this.resolution
        });
        const hfBody = new CANNON.Body({ mass: 0 });
        hfBody.addShape(hfShape);
        hfBody.position.set(-this.size / 2, 0, this.size / 2);
        hfBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        this.world.addBody(hfBody);
    }
}