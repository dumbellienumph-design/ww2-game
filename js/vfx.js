import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class VFX {
    static createExplosion(scene, world, position, radius = 5, damage = 50, audio = null) {
        // --- VISUAL EFFECTS ---
        const geo = new THREE.SphereGeometry(radius);
        const mat = new THREE.MeshBasicMaterial({ 
            color: 0xff4500, 
            transparent: true, 
            opacity: 0.8 
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(position);
        scene.add(mesh);

        const particleCount = 25;
        const particles = [];
        const partGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
        for(let i=0; i<particleCount; i++) {
            const pMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
            const p = new THREE.Mesh(partGeo, pMat);
            p.position.copy(position);
            const dir = new THREE.Vector3(
                (Math.random() - 0.5),
                (Math.random() - 0.5) + 0.5, 
                (Math.random() - 0.5)
            ).normalize();
            p.userData.velocity = dir.multiplyScalar(Math.random() * 30 + 15);
            scene.add(p);
            particles.push(p);
        }

        // --- SCORCHED EARTH: BURN MARK ---
        this.createBurnMark(scene, position, radius);

        // --- AUDIO ---
        if (audio) {
            audio.play('explosion_blast', { randomPitch: true });
            setTimeout(() => {
                audio.play('explosion_debris', { randomPitch: true });
            }, 150);

            const globalVol = audio.globalVolume;
            audio.globalVolume = 0.1; 
            setTimeout(() => {
                audio.globalVolume = globalVol; 
            }, 1500);
        }

        let scale = 0.1;
        const startTime = Date.now();
        const duration = 600;

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / duration;

            if (progress >= 1) {
                scene.remove(mesh);
                particles.forEach(p => scene.remove(p));
                return;
            }

            scale = progress * 2.5;
            mesh.scale.set(scale, scale, scale);
            mesh.material.opacity = 1 - progress;

            particles.forEach(p => {
                p.position.add(p.userData.velocity.clone().multiplyScalar(0.016));
                p.userData.velocity.y -= 0.5; 
                p.userData.velocity.multiplyScalar(0.96); 
                p.rotation.x += 0.2;
                p.rotation.y += 0.2;
            });

            requestAnimationFrame(animate);
        };
        animate();

        // Physics: Area of Effect
        world.bodies.forEach(body => {
            const dist = body.position.distanceTo(new CANNON.Vec3(position.x, position.y, position.z));
            if (dist < radius) {
                if (body.onHit) {
                    const falloff = 1 - (dist / radius);
                    body.onHit(damage * falloff);
                }
                const dir = body.position.vsub(new CANNON.Vec3(position.x, position.y, position.z)).unit();
                const force = 15000 * (1 - dist/radius);
                body.applyImpulse(dir.scale(force), body.position);
            }
        });
    }

    static createBurnMark(scene, position, radius) {
        const markGeo = new THREE.CircleGeometry(radius * 0.8, 16);
        const markMat = new THREE.MeshBasicMaterial({ 
            color: 0x111111, 
            transparent: true, 
            opacity: 0.7,
            depthWrite: false, // Prevent z-fighting
            polygonOffset: true,
            polygonOffsetFactor: -4
        });
        const mark = new THREE.Mesh(markGeo, markMat);
        mark.rotation.x = -Math.PI / 2;
        mark.position.copy(position);
        mark.position.y = 0.15; // Slightly above ground
        scene.add(mark);

        // Fade out slowly over 30 seconds
        setTimeout(() => {
            const startTime = Date.now();
            const fade = () => {
                const elapsed = Date.now() - startTime;
                mark.material.opacity = 0.7 * (1 - (elapsed / 5000));
                if (elapsed < 5000) requestAnimationFrame(fade);
                else scene.remove(mark);
            };
            fade();
        }, 25000);
    }
}