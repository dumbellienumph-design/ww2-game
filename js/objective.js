import * as THREE from 'three';

export class Objective {
    constructor(scene, name, position, audio) {
        this.scene = scene;
        this.name = name; // Able, Baker, Charlie
        this.position = new THREE.Vector3(position.x, position.y, position.z);
        this.audio = audio;
        
        this.radius = 15;
        this.captureProgress = 0; // -100 (Enemy) to 100 (Allied)
        this.owner = 'neutral'; // 'allied', 'enemy', 'neutral'
        
        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        this.scene.add(this.group);

        this.initVisuals();
    }

    initVisuals() {
        // 1. FLAG POLE
        const poleGeo = new THREE.CylinderGeometry(0.1, 0.15, 12);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.8 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y = 6;
        this.group.add(pole);

        // 2. THE FLAG
        const flagGeo = new THREE.PlaneGeometry(3, 2);
        this.flagMat = new THREE.MeshBasicMaterial({ color: 0x888888, side: THREE.DoubleSide });
        this.flag = new THREE.Mesh(flagGeo, this.flagMat);
        this.flag.position.set(1.5, 10, 0);
        this.group.add(this.flag);

        // 3. CAPTURE ZONE (Ground Ring)
        const ringGeo = new THREE.RingGeometry(this.radius - 0.5, this.radius, 64);
        this.ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
        const ring = new THREE.Mesh(ringGeo, this.ringMat);
        ring.rotation.x = -Math.PI/2;
        ring.position.y = 0.1;
        this.group.add(ring);

        // 4. FLOATING LABEL
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white'; ctx.font = 'bold 80px Arial'; ctx.textAlign = 'center';
        ctx.fillText(this.name[0], 64, 100);
        const tex = new THREE.CanvasTexture(canvas);
        const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
        label.position.y = 13;
        label.scale.set(3, 3, 1);
        this.group.add(label);
    }

    update(delta, allies, enemies) {
        // Logic: Count units in radius
        let alliedCount = 0;
        let enemyCount = 0;

        allies.forEach(a => {
            const d = new THREE.Vector3(a.body.position.x, 0, a.body.position.z).distanceTo(new THREE.Vector3(this.position.x, 0, this.position.z));
            if (d < this.radius) alliedCount++;
        });

        enemies.forEach(e => {
            if (e.isDead) return;
            const d = new THREE.Vector3(e.body.position.x, 0, e.body.position.z).distanceTo(new THREE.Vector3(this.position.x, 0, this.position.z));
            if (d < this.radius) enemyCount++;
        });

        // Capture progression
        const rate = 15 * delta; // 15% per second
        if (alliedCount > enemyCount) {
            this.captureProgress = Math.min(100, this.captureProgress + rate);
        } else if (enemyCount > alliedCount) {
            this.captureProgress = Math.max(-100, this.captureProgress - rate);
        }

        // Ownership change
        const oldOwner = this.owner;
        if (this.captureProgress >= 100) this.owner = 'allied';
        else if (this.captureProgress <= -100) this.owner = 'enemy';
        else this.owner = 'neutral';

        // Feedback
        if (this.owner !== oldOwner && this.audio) {
            this.audio.play('ui_click'); // Objective Secured Sound
        }

        // Visual Update
        if (this.owner === 'allied') {
            this.flagMat.color.setHex(0x00ff00);
            this.ringMat.color.setHex(0x00ff00);
        } else if (this.owner === 'enemy') {
            this.flagMat.color.setHex(0xff0000);
            this.ringMat.color.setHex(0xff0000);
        } else {
            this.flagMat.color.setHex(0x888888);
            this.ringMat.color.setHex(0xffffff);
        }

        // Flag wave effect
        this.flag.rotation.y = Math.sin(Date.now() * 0.003) * 0.2;
    }
}