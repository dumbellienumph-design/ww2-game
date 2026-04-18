import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class VFX {
    static createExplosion(scene, world, position, radius = 5, damage = 50) {
        // Visual: Expanding orange sphere
        const geo = new THREE.SphereGeometry(radius);
        const mat = new THREE.MeshBasicMaterial({ 
            color: 0xff4500, 
            transparent: true, 
            opacity: 0.8 
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(position);
        scene.add(mesh);

        // Particle flash
        const particleCount = 20;
        const particles = [];
        const partGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        for(let i=0; i<particleCount; i++) {
            const pMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
            const p = new THREE.Mesh(partGeo, pMat);
            p.position.copy(position);
            const dir = new THREE.Vector3(
                (Math.random() - 0.5),
                (Math.random() - 0.5),
                (Math.random() - 0.5)
            ).normalize();
            p.userData.velocity = dir.multiplyScalar(Math.random() * 20 + 10);
            scene.add(p);
            particles.push(p);
        }

        // Animation logic
        let scale = 0.1;
        const startTime = Date.now();
        const duration = 500;

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / duration;

            if (progress >= 1) {
                scene.remove(mesh);
                particles.forEach(p => scene.remove(p));
                return;
            }

            // Expand sphere
            scale = progress * 2;
            mesh.scale.set(scale, scale, scale);
            mesh.material.opacity = 1 - progress;

            // Move particles
            particles.forEach(p => {
                p.position.add(p.userData.velocity.clone().multiplyScalar(0.016));
                p.userData.velocity.multiplyScalar(0.95); // Drag
                p.rotation.x += 0.1;
                p.rotation.y += 0.1;
                p.scale.multiplyScalar(0.95);
            });

            requestAnimationFrame(animate);
        };
        animate();

        // Physics: Area of Effect Damage
        world.bodies.forEach(body => {
            const dist = body.position.distanceTo(new CANNON.Vec3(position.x, position.y, position.z));
            if (dist < radius) {
                if (body.onHit) {
                    const falloff = 1 - (dist / radius);
                    body.onHit(damage * falloff);
                }
                // Push away
                const dir = body.position.vsub(new CANNON.Vec3(position.x, position.y, position.z)).unit();
                const force = 10000 * (1 - dist/radius);
                body.applyImpulse(dir.scale(force), body.position);
            }
        });
    }
}