import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Ally {
    constructor(scene, world, position, audio) {
        this.scene = scene;
        this.world = world;
        this.health = 100;
        this.speed = 6;
        this.isDead = false;
        this.state = 'follow'; 
        
        this.fireTimer = 0;
        this.fireRate = 1.5;

        this.group = new THREE.Group();
        this.scene.add(this.group);
        this.initPhysics(position);
        this.initVisuals();
    }

    initPhysics(position) {
        this.body = new CANNON.Body({
            mass: 80, shape: new CANNON.Box(new CANNON.Vec3(0.4, 0.9, 0.4)),
            position: new CANNON.Vec3(position.x, position.y, position.z),
            fixedRotation: true, linearDamping: 0.5
        });
        this.world.addBody(this.body);
        this.body.mesh = this.group;
        this.body.onHit = (damage) => this.takeDamage(damage);
    }

    initVisuals() {
        const olive = new THREE.MeshStandardMaterial({ color: 0x3b4d2b });
        const faceMat = new THREE.MeshStandardMaterial({ color: 0xdbac98 });
        const darkGrey = new THREE.MeshStandardMaterial({ color: 0x111111 });

        // Torso
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.3), olive);
        torso.position.y = 0.4;
        torso.castShadow = true; torso.receiveShadow = true;
        this.group.add(torso);

        // Head
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), faceMat);
        head.position.y = 0.9;
        this.group.add(head);

        // M1 Helmet
        const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2), olive);
        helmet.position.y = 1.0;
        helmet.scale.set(1.1, 0.8, 1.1);
        helmet.castShadow = true;
        this.group.add(helmet);

        // Backpack
        const pack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.15), olive);
        pack.position.set(0, 0.4, -0.2);
        this.group.add(pack);
    }

    setOrder(order, pos) {
        this.state = order.toLowerCase();
        this.orderTarget = pos.clone();
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0 && !this.isDead) {
            this.isDead = true;
            this.group.rotation.x = Math.PI / 2.2;
            this.body.mass = 0; this.body.type = CANNON.Body.STATIC;
            setTimeout(() => this.scene.remove(this.group), 15000);
        }
    }

    update(delta, playerPos, enemies, objectives, isPlayerActive) {
        if (this.isDead || !isPlayerActive) return;

        // --- CLAMP TO GROUND ---
        if (window.game && window.game.getTerrainHeight) {
            const groundY = window.game.getTerrainHeight(this.body.position.x, this.body.position.z);
            if (this.body.position.y < groundY + 1.0) {
                this.body.position.y = groundY + 1.0;
                this.body.velocity.y = 0;
            }
        }

        const currentPos = new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z);
        const pPos = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
        
        // Find nearest enemy
        let nearestEnemy = null;
        let minDist = 100;
        enemies.forEach(e => {
            if(!e.isDead) {
                const dist = currentPos.distanceTo(new THREE.Vector3(e.body.position.x, e.body.position.y, e.body.position.z));
                if(dist < minDist) { minDist = dist; nearestEnemy = e; }
            }
        });

        if (nearestEnemy) {
            this.group.lookAt(nearestEnemy.body.position.x, this.group.position.y, nearestEnemy.body.position.z);
            this.fireTimer += delta;
            if (this.fireTimer >= this.fireRate) { this.shoot(nearestEnemy.body.position); this.fireTimer = 0; }
        } else {
            this.group.lookAt(pPos.x, this.group.position.y, pPos.z);
        }

        // Move logic
        let target = pPos;
        if (this.state === 'advance' && objectives.length > 0) target = objectives[0].position;
        
        const distToTarget = currentPos.distanceTo(target);
        if (distToTarget > 10) {
            const moveDir = new THREE.Vector3().subVectors(target, currentPos).normalize();
            this.body.velocity.x = moveDir.x * this.speed;
            this.body.velocity.z = moveDir.z * this.speed;
        } else {
            this.body.velocity.set(0, 0, 0);
        }
    }

    shoot(targetPos) {
        const startPos = this.group.position.clone().add(new THREE.Vector3(0, 1.0, 0));
        const dir = new THREE.Vector3().subVectors(targetPos, startPos).normalize();
        const bullet = new THREE.Mesh(new THREE.SphereGeometry(0.1), new THREE.MeshBasicMaterial({color: 0xffffff}));
        bullet.position.copy(startPos); this.scene.add(bullet);
        const startTime = Date.now();
        const anim = () => {
            if (Date.now() - startTime > 2000 || this.isDead) { this.scene.remove(bullet); return; }
            bullet.position.add(dir.clone().multiplyScalar(2.0));
            requestAnimationFrame(anim);
        };
        anim();
    }
}