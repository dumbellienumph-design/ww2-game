import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { VFX } from './vfx.js';

export class Tank {
    constructor(scene, world, position, audio) {
        this.scene = scene;
        this.world = world;
        this.audio = audio;
        
        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.initPhysics(position);
        this.initVisuals();
        this.initMinimapIcon();
        
        this.isOccupied = false;
        this.isSniperMode = false;
        this.currentTurretYaw = 0;
        this.currentBarrelPitch = 0;
        this.traverseSpeed = 0.4; 
        this.elevationSpeed = 0.2;

        this.initAimingReticle();
    }

    initMinimapIcon() {
        const iconGeo = new THREE.BoxGeometry(6, 1, 6);
        const iconMat = new THREE.MeshBasicMaterial({ color: 0x0000ff });
        this.minimapIcon = new THREE.Mesh(iconGeo, iconMat);
        this.minimapIcon.position.set(0, 100, 0);
        this.minimapIcon.layers.set(1);
        this.group.add(this.minimapIcon);
    }

    initAimingReticle() {
        const reticleGeo = new THREE.RingGeometry(0.5, 0.6, 32);
        const reticleMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, depthTest: false, transparent: true, opacity: 0.8 });
        this.reticle = new THREE.Mesh(reticleGeo, reticleMat);
        this.reticle.renderOrder = 999;
        this.scene.add(this.reticle);
        this.reticle.visible = false;
    }

    initPhysics(position) {
        const hullShape = new CANNON.Box(new CANNON.Vec3(2.6, 1.0, 4));
        this.body = new CANNON.Body({
            mass: 25000, 
            shape: hullShape,
            position: new CANNON.Vec3(position.x, position.y, position.z),
            linearDamping: 0.2,
            angularDamping: 0.1
        });
        
        this.body.shapeOffsets[0].set(0, 0.5, 0);
        this.world.addBody(this.body);
        this.body.mesh = this.group;
    }

    initVisuals() {
        const tigerGrey = new THREE.MeshStandardMaterial({ color: 0x4a4e4d, roughness: 0.8, metalness: 0.2 });
        const darkSteel = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.8, roughness: 0.4 });
        const rustMetal = new THREE.MeshStandardMaterial({ color: 0x3d3535, metalness: 0.5, roughness: 0.7 });
        
        const vOffset = -0.5;

        const mainHull = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.3, 7.5), tigerGrey);
        mainHull.position.y = 0.65 + vOffset;
        this.group.add(mainHull);

        const frontArmor = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.2, 0.4), tigerGrey);
        frontArmor.position.set(0, 1.4 + vOffset, -3.2);
        this.group.add(frontArmor);

        const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 16);
        wheelGeo.rotateZ(Math.PI / 2);
        for (let i = 0; i < 8; i++) {
            const wz = -3.2 + i * 0.95;
            const xPos = (i % 2 === 0) ? 2.3 : 1.9;
            const wl = new THREE.Mesh(wheelGeo, darkSteel);
            wl.position.set(-xPos, 0.2, wz);
            this.group.add(wl);
            const wr = wl.clone();
            wr.position.x = xPos;
            this.group.add(wr);
        }

        this.turretGroup = new THREE.Group();
        this.turretGroup.position.set(0, 1.6 + vOffset, 0);
        this.group.add(this.turretGroup);

        const turretBase = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.9, 1.2, 16), tigerGrey);
        this.turretGroup.add(turretBase);

        const mantlet = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 0.6), tigerGrey);
        mantlet.position.set(0, 0, -1.8);
        this.turretGroup.add(mantlet);

        this.barrelGroup = new THREE.Group();
        this.barrelGroup.position.set(0, 0, -1.8);
        this.turretGroup.add(this.barrelGroup);

        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 5.5), rustMetal);
        barrel.rotateX(Math.PI / 2);
        barrel.position.z = -2.75;
        this.barrelGroup.add(barrel);

        const brake = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.8, 12), darkSteel);
        brake.rotateX(Math.PI / 2);
        brake.position.z = -5.8;
        this.barrelGroup.add(brake);

        this.chaseCameraAnchor = new THREE.Object3D();
        this.chaseCameraAnchor.position.set(0, 6, 12); 
        this.group.add(this.chaseCameraAnchor);

        this.sniperCameraAnchor = new THREE.Object3D();
        this.sniperCameraAnchor.position.set(0, 0.3, -1.5); 
        this.turretGroup.add(this.sniperCameraAnchor);
    }

    update(delta, controls, camera) {
        if (!this.isOccupied) {
            if(this.reticle) this.reticle.visible = false;
            if(this.audio) this.audio.stop('tank_engine');
            return;
        }

        // --- AUDIO: DYNAMIC ENGINE ---
        if (this.audio) {
            this.audio.play('tank_engine');
            const speed = this.body.velocity.length();
            // Maybach V12 roar: Pitch shifts from 1.0 (idle) up to 1.8 (full speed)
            const pitchRate = 1.0 + (speed / 15) * 0.8;
            this.audio.setPlaybackRate('tank_engine', pitchRate);
        }

        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.group.quaternion);
        let targetSpeed = 0;
        if (controls.forward) targetSpeed = 15;
        else if (controls.backward) targetSpeed = -10;

        const currentY = this.body.velocity.y;
        this.body.velocity.x = forward.x * targetSpeed;
        this.body.velocity.z = forward.z * targetSpeed;
        this.body.velocity.y = currentY; 

        const turnSpeed = 1.5;
        if (controls.left) this.body.angularVelocity.y = turnSpeed;
        else if (controls.right) this.body.angularVelocity.y = -turnSpeed;
        else this.body.angularVelocity.y *= 0.5;

        this.body.angularVelocity.x *= 0.1;
        this.body.angularVelocity.z *= 0.1;

        const camEuler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
        const hullEuler = new THREE.Euler().setFromQuaternion(this.group.quaternion, 'YXZ');

        let targetYaw = camEuler.y - hullEuler.y;
        let targetPitch = camEuler.x;

        let yawDiff = targetYaw - this.currentTurretYaw;
        while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
        while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
        
        const stepY = this.traverseSpeed * delta;
        if (Math.abs(yawDiff) < stepY) this.currentTurretYaw = targetYaw;
        else this.currentTurretYaw += Math.sign(yawDiff) * stepY;
        this.turretGroup.rotation.y = this.currentTurretYaw;

        targetPitch = Math.max(-0.35, Math.min(0.17, targetPitch));
        let pitchDiff = targetPitch - this.currentBarrelPitch;
        const stepX = this.elevationSpeed * delta;
        if (Math.abs(pitchDiff) < stepX) this.currentBarrelPitch = targetPitch;
        else this.currentBarrelPitch += Math.sign(pitchDiff) * stepX;
        this.barrelGroup.rotation.x = this.currentBarrelPitch;

        if(this.reticle) {
            this.reticle.visible = true;
            const rayDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.barrelGroup.getWorldQuaternion(new THREE.Quaternion()));
            const rayOrigin = new THREE.Vector3();
            this.barrelGroup.getWorldPosition(rayOrigin);
            this.reticle.position.copy(rayOrigin).add(rayDir.multiplyScalar(50));
            this.reticle.lookAt(camera.position);
            const isAimed = Math.abs(yawDiff) < 0.05 && Math.abs(pitchDiff) < 0.05;
            this.reticle.material.color.setHex(isAimed ? 0x00ff00 : 0xff0000);
        }

        if (controls.shoot) {
            this.fire();
            controls.shoot = false;
        }
    }

    fire() {
        if(this.audio) this.audio.play('tank_fire');

        this.barrelGroup.position.z += 0.4;
        setTimeout(() => this.barrelGroup.position.z -= 0.4, 60);
        const tip = new THREE.Vector3(0, 0, -6.5).applyMatrix4(this.barrelGroup.matrixWorld);
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.barrelGroup.getWorldQuaternion(new THREE.Quaternion()));
        const shellMesh = new THREE.Mesh(new THREE.SphereGeometry(0.4), new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
        this.scene.add(shellMesh);
        const shellBody = new CANNON.Body({
            mass: 25, shape: new CANNON.Sphere(0.4),
            position: new CANNON.Vec3(tip.x, tip.y, tip.z),
            velocity: new CANNON.Vec3(dir.x * 130, dir.y * 130, dir.z * 130)
        });
        this.world.addBody(shellBody);
        shellBody.mesh = shellMesh;
        shellBody.addEventListener('collide', (e) => {
            VFX.createExplosion(this.scene, this.world, shellBody.position.clone(), 15, 250, this.audio);
            setTimeout(() => { if (shellBody.world) { this.world.removeBody(shellBody); this.scene.remove(shellMesh); } }, 20);
        });
        setTimeout(() => { if(shellBody.world) { this.world.removeBody(shellBody); this.scene.remove(shellMesh); } }, 5000);
    }
}