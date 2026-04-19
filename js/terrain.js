import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Terrain {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        
        this.size = 800; 
        this.resolution = 128; // Higher resolution for better mountains
        
        this.init();
    }

    init() {
        const geometry = new THREE.PlaneGeometry(this.size, this.size, this.resolution, this.resolution);
        const vertices = geometry.attributes.position.array;

        // --- RESTORE MOUNTAINS & LEVEL BASES ---
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];
            const z = vertices[i + 1];
            
            // Base Locations
            const distToAlliedBase = Math.sqrt((x - (-150))**2 + (z - 0)**2);
            const distToEnemyBase = Math.sqrt((x - 150)**2 + (z - 0)**2);

            // Generate realistic rolling hills and mountains
            let height = (Math.sin(x * 0.01) * Math.cos(z * 0.01)) * 15;
            height += (Math.sin(x * 0.03) * Math.sin(z * 0.03)) * 5;
            
            // Add jagged mountain peaks at edges
            if (Math.abs(x) > 250 || Math.abs(z) > 250) {
                height += (Math.random() * 5);
            }

            // LEVEL THE BASES
            if (distToAlliedBase < 100) {
                const factor = Math.max(0, Math.min(1, (distToAlliedBase - 60) / 40));
                height *= factor;
            } else if (distToEnemyBase < 100) {
                const factor = Math.max(0, Math.min(1, (distToEnemyBase - 60) / 40));
                height *= factor;
            }

            vertices[i + 2] = height;
        }

        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({ 
            color: 0x222818, // Dark Forest Green
            roughness: 1.0,
            metalness: 0.0,
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