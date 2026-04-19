import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Terrain {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        
        this.size = 600; // Slightly larger for border walls
        this.resolution = 64; 
        
        this.init();
    }

    init() {
        const geometry = new THREE.PlaneGeometry(this.size, this.size, this.resolution, this.resolution);
        const vertices = geometry.attributes.position.array;

        // Create heightmap logic
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];
            const z = vertices[i + 1];
            
            // --- NEW: TERRAIN LEVELING LOGIC ---
            // Base 1 (Player) Area: -100 to 0
            const distToPlayerBase = Math.sqrt((x - (-50))**2 + (z - (-50))**2);
            // Base 2 (Enemy) Area: 100 to 200
            const distToEnemyBase = Math.sqrt((x - 150)**2 + (z - 150)**2);

            let height = (Math.sin(x * 0.02) * Math.cos(z * 0.02)) * 5;
            height += (Math.sin(x * 0.05) * Math.sin(z * 0.05)) * 2;

            if (distToPlayerBase < 80) {
                // Flatten player base area completely
                const factor = Math.smoothstep(distToPlayerBase, 60, 80);
                height *= factor;
            } else if (distToEnemyBase < 80) {
                // Flatten enemy base area completely
                const factor = Math.smoothstep(distToEnemyBase, 60, 80);
                height *= factor;
            }

            vertices[i + 2] = height;
        }

        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({ 
            color: 0x2d3b23, // Grass green
            roughness: 0.9,
            metalness: 0.1,
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
        
        // Align heightfield with visual plane
        hfBody.position.set(-this.size / 2, 0, this.size / 2);
        hfBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        this.world.addBody(hfBody);
    }
}

// Simple smoothstep helper if not available
Math.smoothstep = function (x, edge0, edge1) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
};
