import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Terrain {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        
        this.size = 1200; 
        this.resolution = 128; 
        
        // --- HOLISTIC REALISM: STATIC HEIGHT FUNCTION ---
        // This ensures physics and visuals are 100% identical
        this.getHeight = (x, z) => {
            const s1 = 0.003, s2 = 0.015, s3 = 0.05;
            let h = (Math.sin(x * s1) * Math.cos(z * s1)) * 40; // Mountains
            h += (Math.cos(x * s2) * Math.sin(z * s2)) * 12;    // Hills
            h += (Math.sin(x * s3) * Math.sin(z * s3)) * 1.5;   // Micro-grit

            const edgeDist = Math.max(Math.abs(x), Math.abs(z));
            if (edgeDist > 350) h += (edgeDist - 350) * 0.5; // Boundary Cliffs

            // Level bases at (-150, 0) and (150, 0)
            const distAllied = Math.sqrt((x - (-150))**2 + (z - 0)**2);
            const distEnemy = Math.sqrt((x - 150)**2 + (z - 0)**2);
            if (distAllied < 140) h *= Math.smoothstep(distAllied, 80, 140);
            else if (distEnemy < 140) h *= Math.smoothstep(distEnemy, 80, 140);

            return h;
        };

        this.init();
    }

    init() {
        const geometry = new THREE.PlaneGeometry(this.size, this.size, this.resolution, this.resolution);
        const vertices = geometry.attributes.position.array;
        
        geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(vertices.length), 3));
        const colors = geometry.attributes.color.array;

        const matrix = [];
        for (let i = 0; i <= this.resolution; i++) {
            matrix.push([]);
            for (let j = 0; j <= this.resolution; j++) {
                const index = (i * (this.resolution + 1) + j) * 3;
                const x = vertices[index];
                const z = vertices[index + 1];
                
                const height = this.getHeight(x, z);
                vertices[index + 2] = height;
                matrix[i].push(height);

                // --- PROCEDURAL SPLAT-MAP ---
                let r = 0.12, g = 0.18, b = 0.1; // Lush Grass
                if (height > 20) { r=0.35; g=0.32; b=0.3; } // Rock
                else if (height < 2) { r=0.18; g=0.15; b=0.12; } // Mud
                
                colors[index] = r + (Math.random()*0.02);
                colors[index+1] = g + (Math.random()*0.02);
                colors[index+2] = b + (Math.random()*0.02);
            }
        }

        geometry.computeVertexNormals();
        const material = new THREE.MeshStandardMaterial({ 
            vertexColors: true, roughness: 1.0, metalness: 0.0
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.rotation.x = -Math.PI / 2;
        this.mesh.receiveShadow = true;
        this.mesh.name = 'terrain';
        this.scene.add(this.mesh);

        // Physics Sync
        const hfShape = new CANNON.Heightfield(matrix, { elementSize: this.size / this.resolution });
        const hfBody = new CANNON.Body({ mass: 0 });
        hfBody.addShape(hfShape);
        hfBody.position.set(-this.size / 2, 0, this.size / 2);
        hfBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        this.world.addBody(hfBody);
        this.body = hfBody;
    }
}

Math.smoothstep = (x, min, max) => {
    if (x <= min) return 0;
    if (x >= max) return 1;
    const t = (x - min) / (max - min);
    return t * t * (3 - 2 * t);
};
