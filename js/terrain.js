import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Terrain {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        
        this.size = 500; 
        this.resolution = 128; 
        
        this.generate();
    }

    generate() {
        const matrix = [];
        for (let i = 0; i < this.resolution; i++) {
            matrix.push(new Float32Array(this.resolution));
        }

        const geometry = new THREE.PlaneGeometry(this.size, this.size, this.resolution - 1, this.resolution - 1);
        geometry.rotateX(-Math.PI / 2);
        const positions = geometry.attributes.position.array;

        for (let x = 0; x < this.resolution; x++) {
            for (let z = 0; z < this.resolution; z++) {
                const xNorm = (x / (this.resolution - 1)) - 0.5;
                const zNorm = (z / (this.resolution - 1)) - 0.5;
                const dist = Math.sqrt(xNorm * xNorm + zNorm * zNorm);
                
                let h = 0;
                // --- PERFECTLY FLAT BASE ZONE ---
                // Increase the flat radius to 0.2 (100 units) to fit the whole base
                if (dist > 0.2) {
                    const noise = Math.sin(x * 0.1) * Math.cos(z * 0.1) * 15;
                    const jagged = Math.sin(x * 0.5) * 2;
                    h = (noise + jagged) * ((dist - 0.2) * 5); // Ramp up after the flat zone
                    h = Math.max(-5, Math.min(h, 60));
                } else {
                    h = 0; // Perfectly flat at base ground level
                }
                
                matrix[x][z] = h;
                const vertexIndex = (z * this.resolution + x) * 3;
                positions[vertexIndex + 1] = h;
            }
        }
        
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({ 
            color: 0x4b5320, 
            roughness: 1.0,
            flatShading: true
        });
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.receiveShadow = true;
        this.scene.add(this.mesh);

        const hfShape = new CANNON.Heightfield(matrix, {
            elementSize: this.size / (this.resolution - 1)
        });
        
        this.body = new CANNON.Body({ mass: 0 });
        this.body.addShape(hfShape);
        this.body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        this.body.position.set(-this.size / 2, 0, this.size / 2);
        this.world.addBody(this.body);

        const floorShape = new CANNON.Plane();
        const floorBody = new CANNON.Body({ mass: 0 });
        floorBody.addShape(floorShape);
        floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        floorBody.position.set(0, 0, 0); 
        this.world.addBody(floorBody);
    }
}