import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Enemy {
    constructor(scene, world, position, audio) {
        this.scene = scene;
        this.world = world;
        this.audio = audio;
        
        this.health = 30;
        this.speed = 3;
        this.isDead = false;
        this.fireRate = 2.5; // Slower than player for fairness
        this.fireTimer = Math.random() * 2;
        this.shootDist = 35;

        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.initPhysics(position);
        this.initVisuals();
    }

    initPhysics(position) {
        this.body = new CANNON.Body({
            mass: 80,
            shape: new CANNON.Box(new CANNON.Vec3(0.4, 0.9, 0.4)),
            position: new CANNON.Vec3(position.x, position.y, position.z),
            fixedRotation: true
        });
        this.world.addBody(this.body);
        this.body.mesh = this.group;
        
        this.body.onHit = (damage) => this.takeDamage(damage);
    }

    initVisuals() {
        const uniformMat = new THREE.MeshStandardMaterial({ color: 0x4a4e4d }); // German Grey
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xffdbac });
        const helmetMat = new THREE.MeshStandardMaterial({ color: 0x3d3535 });

        // Body
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.3), uniformMat);
        torso.position.y = 0.4;
        this.group.add(torso);

        // Head
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), skinMat);
        head.position.y = 0.95;
        this.group.add(head);

        // Helmet (Stahlhelm shape)
        const helmet = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.2), helmetMat);
        helmet.position.y = 1.1;
        this.group.add(helmet);

        // Rifle
        this.gun = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.9), new THREE.MeshStandardMaterial({color: 0x222222}));
        this.gun.position.set(0.3, 0.4, -0.4);
        this.group.add(this.gun);
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0 && !this.isDead) {
            this.isDead = true;
            this.group.rotation.x = -Math.PI/2;
            this.body.mass = 0;
            this.body.type = CANNON.Body.STATIC;
            this.world.removeBody(this.body);
            setTimeout(() => this.scene.remove(this.group), 5000);
        }
    }

    update(delta, playerPosition, player) {
        if (this.isDead) return;

        const target = new THREE.Vector3(playerPosition.x, this.body.position.y, playerPosition.z);
        const current = new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z);
        const dir = target.clone().sub(current);
        const dist = dir.length();

        if (dist > 5 && dist < 60) {
            const moveDir = dir.clone().normalize();
            this.body.velocity.x = moveDir.x * this.speed;
            this.body.velocity.z = moveDir.z * this.speed;
            this.group.lookAt(playerPosition.x, this.group.position.y, playerPosition.z);
        } else {
            this.body.velocity.x *= 0.9;
            this.body.velocity.z *= 0.9;
        }

        // Shooting logic
        if (dist < this.shootDist) {
            this.fireTimer += delta;
            if (this.fireTimer >= this.fireRate) {
                this.shoot(player);
                this.fireTimer = 0;
            }
        }
    }

    shoot(player) {
        // --- AUDIO: ENEMY RIFLE REPORT ---
        if(this.audio) {
            // Positional sound (so you can hear where the enemy is)
            this.audio.play('rifle_fire', { randomPitch: true });
        }

        const bulletGeo = new THREE.SphereGeometry(0.1);
        const bulletMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
        const bullet = new THREE.Mesh(bulletGeo, bulletMat);
        
        const startPos = new THREE.Vector3();
        this.gun.getWorldPosition(startPos);
        bullet.position.copy(startPos);
        this.scene.add(bullet);

        const targetPos = player.camera.position.clone();
        const dir = targetPos.sub(startPos).normalize();
        
        const speed = 60;
        const startTime = Date.now();

        const animateBullet = () => {
            const elapsed = Date.now() - startTime;
            if (elapsed > 2000 || this.isDead) {
                this.scene.remove(bullet);
                return;
            }
            bullet.position.add(dir.clone().multiplyScalar(speed * 0.016));
            
            // --- AUDIO: SUPERSONIC WHIZ (If bullet passes near player) ---
            const distToPlayer = bullet.position.distanceTo(player.camera.position);
            if (distToPlayer < 2 && !bullet.userData.whizzed) {
                if(this.audio) this.audio.play('bullet_whiz');
                bullet.userData.whizzed = true;
            }

            if (distToPlayer < 1) {
                player.takeDamage(10);
                this.scene.remove(bullet);
                return;
            }
            requestAnimationFrame(animateBullet);
        };
        animateBullet();
    }
}