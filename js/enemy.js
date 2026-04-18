import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { VFX } from './vfx.js';

export class Enemy {
    constructor(scene, world, position, audio, type = 'infantry') {
        this.scene = scene;
        this.world = world;
        this.audio = audio;
        this.type = type;
        
        this.health = (type === 'tank') ? 300 : (type === 'aa_flak' ? 150 : 50);
        this.speed = (type === 'tank') ? 3 : 5;
        this.isDead = false;
        
        this.fireTimer = Math.random() * 2;
        this.fireRate = (type === 'tank') ? 5 : 2;
        this.detectionDist = 100;

        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.initPhysics(position);
        this.initVisuals();
    }

    initPhysics(position) {
        let shape;
        if (this.type === 'tank') shape = new CANNON.Box(new CANNON.Vec3(2, 1, 3));
        else if (this.type === 'aa_flak') shape = new CANNON.Box(new CANNON.Vec3(1.5, 1.5, 1.5));
        else shape = new CANNON.Box(new CANNON.Vec3(0.4, 0.9, 0.4));

        this.body = new CANNON.Body({
            mass: (this.type === 'tank') ? 5000 : 80,
            shape: shape,
            position: new CANNON.Vec3(position.x, position.y, position.z),
            fixedRotation: true,
            linearDamping: 0.5
        });
        this.world.addBody(this.body);
        this.body.mesh = this.group;
        this.body.onHit = (damage) => this.takeDamage(damage);
    }

    initVisuals() {
        const grey = new THREE.MeshStandardMaterial({ color: 0x4a4e4d });
        const darkGrey = new THREE.MeshStandardMaterial({ color: 0x222222 });

        if (this.type === 'tank') {
            const hull = new THREE.Mesh(new THREE.BoxGeometry(4, 1.5, 6), grey);
            this.group.add(hull);
            const turret = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.8, 8), grey);
            turret.position.y = 1.1;
            this.group.add(turret);
        } else if (this.type === 'aa_flak') {
            const base = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 3), darkGrey);
            this.group.add(base);
            this.gunPivot = new THREE.Group();
            this.gunPivot.position.y = 0.5;
            this.group.add(this.gunPivot);
            const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3), grey);
            gun.rotation.x = Math.PI / 2; gun.position.z = -1.5;
            this.gunPivot.add(gun);
        } else {
            const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.3), grey);
            torso.position.y = 0.4;
            this.group.add(torso);
            const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.25), darkGrey);
            helmet.position.y = 1.0;
            this.group.add(helmet);
        }
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0 && !this.isDead) {
            this.isDead = true;
            if (this.type === 'tank') {
                VFX.createExplosion(this.scene, this.world, this.group.position, 10, 0, this.audio);
                this.scene.remove(this.group);
            } else {
                this.group.rotation.x = Math.PI / 2.5;
                this.body.mass = 0;
                this.body.type = CANNON.Body.STATIC;
                setTimeout(() => this.scene.remove(this.group), 10000);
            }
        }
    }

    update(delta, playerPos, player) {
        if (this.isDead) return;

        const currentPos = new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z);
        const dist = currentPos.distanceTo(playerPos);

        if (dist < this.detectionDist) {
            this.group.lookAt(playerPos.x, this.group.position.y, playerPos.z);
            
            if (this.type !== 'aa_flak') {
                const moveDir = new THREE.Vector3().subVectors(playerPos, currentPos).normalize();
                if (dist > 20) {
                    this.body.velocity.x = moveDir.x * this.speed;
                    this.body.velocity.z = moveDir.z * this.speed;
                } else {
                    this.body.velocity.set(0, this.body.velocity.y, 0);
                }
            }

            this.fireTimer += delta;
            if (this.fireTimer >= this.fireRate) {
                this.shoot(playerPos, player);
                this.fireTimer = 0;
            }
        } else {
            this.body.velocity.set(0, this.body.velocity.y, 0);
        }
    }

    shoot(targetPos, player) {
        if (this.audio && typeof this.audio.play === 'function') this.audio.play('rifle_fire', { randomPitch: true });
        
        const startPos = this.group.position.clone().add(new THREE.Vector3(0, 1.2, 0));
        // Add slight inaccuracy to allow near-misses (suppression)
        const inaccuracy = 0.05;
        const target = targetPos.clone().add(new THREE.Vector3(
            (Math.random() - 0.5) * inaccuracy * 50,
            (Math.random() - 0.5) * inaccuracy * 20,
            (Math.random() - 0.5) * inaccuracy * 50
        ));
        const dir = new THREE.Vector3().subVectors(target, startPos).normalize();

        const bullet = new THREE.Mesh(new THREE.SphereGeometry(0.1), new THREE.MeshBasicMaterial({color: 0xff0000}));
        bullet.position.copy(startPos);
        this.scene.add(bullet);
        
        const startTime = Date.now();
        const anim = () => {
            if (Date.now() - startTime > 2000 || this.isDead) { this.scene.remove(bullet); return; }
            bullet.position.add(dir.clone().multiplyScalar(1.5));
            
            // Check for hit
            const distToPlayer = bullet.position.distanceTo(player.camera.position);
            if (distToPlayer < 1.5) {
                player.takeDamage(10);
                this.scene.remove(bullet);
                return;
            }

            // Check for NEAR MISS (Suppression)
            if (distToPlayer < 4.0) {
                player.suppress(0.1);
            }

            requestAnimationFrame(anim);
        };
        anim();
    }
}