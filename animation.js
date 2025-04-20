import * as THREE from 'three';

export class AnimationSystem {
    constructor(scene) {
        this.scene = scene;
        this.mixer = null;
        this.clock = new THREE.Clock();
        this.animations = {};
        this.currentAnimation = null;
        this.currentAction = null;
        this.isPlaying = false;
        this.currentTime = 0;
        this.timeScale = 1.0;
        this.keyframes = {};
        this.selectedBone = null;
    }
    
    setupTimeline() {
        // Setup timeline controls
        const timelineScrubber = document.getElementById('timeline-scrubber');
        const frameCounter = document.getElementById('frame-counter');
        const playPauseButton = document.getElementById('play-pause');
        const addKeyframeButton = document.getElementById('add-keyframe');
        const newAnimationButton = document.getElementById('new-animation');
        
        playPauseButton.addEventListener('click', () => {
            this.togglePlay();
            playPauseButton.querySelector('.icon').textContent = this.isPlaying ? '❚❚' : '▶';
        });
        
        timelineScrubber.addEventListener('input', (event) => {
            const value = event.target.value;
            this.setCurrentTime(value / 100 * this.getDuration());
            this.updateFrameCounter();
        });
        
        addKeyframeButton.addEventListener('click', () => {
            if (this.selectedBone) {
                this.addKeyframe(this.currentTime, this.selectedBone);
            } else {
                console.warn('No bone selected for keyframe');
            }
        });
        
        newAnimationButton.addEventListener('click', () => {
            const name = prompt('Enter name for new animation:', 'Animation ' + (Object.keys(this.animations).length + 1));
            if (name) {
                this.createNewAnimation(name);
            }
        });
        
        // Create initial animation
        this.createNewAnimation('Animation 1');
    }
    
    createNewAnimation(name) {
        // Create a new animation clip
        const tracks = [];
        const duration = 5; // Default 5 seconds
        const clip = new THREE.AnimationClip(name, duration, tracks);
        
        // Store the animation
        this.animations[name] = {
            clip: clip,
            duration: duration,
            keyframes: {}
        };
        
        // Add to the UI list
        const animationList = document.getElementById('animation-list');
        const listItem = document.createElement('li');
        listItem.textContent = name;
        listItem.dataset.animationName = name;
        listItem.addEventListener('click', () => {
            this.selectAnimation(name);
        });
        animationList.appendChild(listItem);
        
        // Select the new animation
        this.selectAnimation(name);
    }
    
    selectAnimation(name) {
        if (!this.animations[name]) {
            console.warn(`Animation ${name} not found`);
            return;
        }
        
        // Deselect current animation in UI
        const currentSelected = document.querySelector('#animation-list li.selected');
        if (currentSelected) {
            currentSelected.classList.remove('selected');
        }
        
        // Select new animation in UI
        const newSelected = document.querySelector(`#animation-list li[data-animation-name="${name}"]`);
        if (newSelected) {
            newSelected.classList.add('selected');
        }
        
        // Switch to the new animation
        this.currentAnimation = this.animations[name];
        this.keyframes = this.currentAnimation.keyframes;
        
        // Update the timeline
        document.getElementById('timeline-scrubber').max = 100;
        this.setCurrentTime(0);
        this.updateFrameCounter();
        
        // Update the animation mixer
        this.updateAnimationMixer();
    }
    
    updateAnimationMixer() {
        if (!this.scene) return;
        
        // Find the skinned mesh
        let skinnedMesh = null;
        this.scene.traverse((object) => {
            if (object.isSkinnedMesh) {
                skinnedMesh = object;
            }
        });
        
        if (!skinnedMesh) {
            console.warn('No skinned mesh found for animation');
            return;
        }
        
        // Create or update the mixer
        if (!this.mixer) {
            this.mixer = new THREE.AnimationMixer(skinnedMesh);
        }
        
        // Stop current action if it exists
        if (this.currentAction) {
            this.currentAction.stop();
        }
        
        // Start new action if we have a current animation
        if (this.currentAnimation && this.currentAnimation.clip.tracks.length > 0) {
            this.currentAction = this.mixer.clipAction(this.currentAnimation.clip);
            this.currentAction.play();
            this.mixer.setTime(this.currentTime);
            
            if (!this.isPlaying) {
                this.currentAction.paused = true;
            }
        }
    }
    
    togglePlay() {
        this.isPlaying = !this.isPlaying;
        
        if (this.currentAction) {
            this.currentAction.paused = !this.isPlaying;
        }
    }
    
    setCurrentTime(time) {
        this.currentTime = Math.max(0, Math.min(time, this.getDuration()));
        
        if (this.mixer) {
            this.mixer.setTime(this.currentTime);
        }
        
        // Update scrubber position
        const timelineScrubber = document.getElementById('timeline-scrubber');
        timelineScrubber.value = (this.currentTime / this.getDuration()) * 100;
    }
    
    getDuration() {
        return this.currentAnimation ? this.currentAnimation.duration : 5;
    }
    
    updateFrameCounter() {
        const frameCounter = document.getElementById('frame-counter');
        const fps = 30;  // Frames per second
        const currentFrame = Math.floor(this.currentTime * fps);
        const totalFrames = Math.floor(this.getDuration() * fps);
        frameCounter.textContent = `${currentFrame} / ${totalFrames}`;
    }
    
    update() {
        if (this.isPlaying && this.mixer) {
            const delta = this.clock.getDelta();
            this.mixer.update(delta * this.timeScale);
            
            this.currentTime += delta * this.timeScale;
            if (this.currentTime >= this.getDuration()) {
                this.currentTime = 0;
            }
            
            // Update the timeline scrubber
            document.getElementById('timeline-scrubber').value = (this.currentTime / this.getDuration()) * 100;
            this.updateFrameCounter();
        }
    }
    
    addKeyframe(time, bone) {
        if (!this.currentAnimation) {
            console.warn('No animation selected for keyframe');
            return;
        }
        
        if (!bone) {
            console.warn('No bone selected for keyframe');
            return;
        }
        
        // Store the bone's current position, rotation, and scale
        const position = bone.position.clone();
        const rotation = new THREE.Euler().setFromQuaternion(bone.quaternion);
        const scale = bone.scale.clone();
        
        // Store the keyframe data
        if (!this.keyframes[bone.name]) {
            this.keyframes[bone.name] = [];
        }
        
        // Check if a keyframe already exists at this time
        const existingKeyframeIndex = this.keyframes[bone.name].findIndex(k => Math.abs(k.time - time) < 0.001);
        
        if (existingKeyframeIndex >= 0) {
            // Update existing keyframe
            this.keyframes[bone.name][existingKeyframeIndex] = {
                time,
                position,
                rotation,
                scale
            };
        } else {
            // Add new keyframe
            this.keyframes[bone.name].push({
                time,
                position,
                rotation,
                scale
            });
            
            // Sort keyframes by time
            this.keyframes[bone.name].sort((a, b) => a.time - b.time);
        }
        
        // Update the animation tracks
        this.updateAnimationTracks();
        
        // Update the keyframe visualization
        this.updateKeyframeVisualization();
    }
    
    updateAnimationTracks() {
        if (!this.currentAnimation) return;
        
        const tracks = [];
        
        // Create tracks for each bone with keyframes
        for (const boneName in this.keyframes) {
            const keyframes = this.keyframes[boneName];
            
            if (keyframes.length >= 2) {  // Need at least 2 keyframes for interpolation
                // Position track
                const positionTimes = [];
                const positionValues = [];
                
                // Rotation track
                const rotationTimes = [];
                const rotationValues = [];
                
                // Scale track
                const scaleTimes = [];
                const scaleValues = [];
                
                // Collect all keyframe data
                keyframes.forEach(keyframe => {
                    positionTimes.push(keyframe.time);
                    positionValues.push(
                        keyframe.position.x,
                        keyframe.position.y,
                        keyframe.position.z
                    );
                    
                    rotationTimes.push(keyframe.time);
                    const quaternion = new THREE.Quaternion().setFromEuler(keyframe.rotation);
                    rotationValues.push(
                        quaternion.x,
                        quaternion.y,
                        quaternion.z,
                        quaternion.w
                    );
                    
                    scaleTimes.push(keyframe.time);
                    scaleValues.push(
                        keyframe.scale.x,
                        keyframe.scale.y,
                        keyframe.scale.z
                    );
                });
                
                // Create Three.js keyframe tracks
                const positionTrack = new THREE.VectorKeyframeTrack(
                    `${boneName}.position`,
                    positionTimes,
                    positionValues
                );
                
                const rotationTrack = new THREE.QuaternionKeyframeTrack(
                    `${boneName}.quaternion`,
                    rotationTimes,
                    rotationValues
                );
                
                const scaleTrack = new THREE.VectorKeyframeTrack(
                    `${boneName}.scale`,
                    scaleTimes,
                    scaleValues
                );
                
                tracks.push(positionTrack, rotationTrack, scaleTrack);
            }
        }
        
        // Update the animation clip
        this.currentAnimation.clip = new THREE.AnimationClip(
            this.currentAnimation.clip.name,
            this.currentAnimation.duration,
            tracks
        );
        
        // Update the mixer
        this.updateAnimationMixer();
    }
    
    updateKeyframeVisualization() {
        const container = document.querySelector('.keyframes-container');
        container.innerHTML = '';
        
        if (!this.currentAnimation) return;
        
        // Get all unique keyframe times
        const allTimes = new Set();
        for (const boneName in this.keyframes) {
            this.keyframes[boneName].forEach(keyframe => {
                allTimes.add(keyframe.time);
            });
        }
        
        // Create keyframe markers
        const duration = this.getDuration();
        const containerWidth = container.clientWidth;
        
        Array.from(allTimes).sort((a, b) => a - b).forEach(time => {
            const marker = document.createElement('div');
            marker.className = 'keyframe-marker';
            marker.style.left = `${(time / duration) * 100}%`;
            marker.title = `Time: ${time.toFixed(2)}s`;
            
            marker.addEventListener('click', () => {
                this.setCurrentTime(time);
                this.updateFrameCounter();
            });
            
            container.appendChild(marker);
        });
    }
    
    selectBone(bone) {
        this.selectedBone = bone;
    }
    
    getAnimations() {
        return Object.values(this.animations).map(animation => animation.clip);
    }
}

