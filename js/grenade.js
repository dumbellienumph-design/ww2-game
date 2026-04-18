import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { VFX } from './vfx.js';

export class Grenade {
    constructor(scene, world, position, velocity, audio) {
        this.scene = scene;
        this.world = world;
        this.audio = audio;
        
        this.isExploded = false;
        this.fuseTime = 3.0;
        this.timer = 0;

        this.initPhysics(position, velocity);
        this.initVisuals();
    }

    initPhysics(position, velocity) {
        const shape = new CANNON.Sphere(0.2);
        this.body = new CANNON.Body({
            mass: 2,
            shape: shape,
            position: new CANNON.Vec3(position.x, position.y, position.z),
            velocity: new CANNON.Vec3(velocity.x, velocity.y, velocity.z),
            linearDamping: 0.1,
            angularDamping: 0.1
        });
        this.world.addBody(this.body);
    }

    initVisuals() {
        const geo = new THREE.SphereGeometry(0.2, 8, 8);
        const mat = new THREE.MeshStandardMaterial({ color: 0x2e3b23 });
        this.mesh = new THREE.Mesh(geo, mat);
        this.scene.add(this.mesh);
    }

    update(delta) {
        if (this.isExploded) return;

        this.timer += delta;
        this.mesh.position.copy(this.body.position);
        this.mesh.quaternion.copy(this.body.quaternion);

        if (this.timer >= this.fuseTime) {
            this.explode();
        }
    }

    explode() {
        this.isExploded = true;
        VFX.createExplosion(this.scene, this.world, this.mesh.position, 8, 100, this.audio);
        this.scene.remove(this.mesh);
        this.world.removeBody(this.body);
    }
}