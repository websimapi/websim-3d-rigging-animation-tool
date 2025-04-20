import * as THREE from 'three';
import * as tf from 'tensorflow';

export class RiggingSystem {
    constructor(scene) {
        this.scene = scene;
        this.skeleton = null;
        this.boneVisualization = null;
        this.skinnedMesh = null;
        this.poseNetModel = null;
        
        // Initialize TensorFlow model for pose detection
        this.loadPoseDetectionModel();
    }
    
    async loadPoseDetectionModel() {
        try {
            // We're using a simpler approach for now, but would load a real model in production
            console.log('Preparing for pose detection...');
            // In a full implementation, we would load:
            // this.poseNetModel = await tf.loadGraphModel('path/to/model');
        } catch (error) {
            console.error('Failed to load pose detection model:', error);
        }
    }
    
    async generateSkeleton(model, complexity) {
        if (!model) {
            throw new Error('No model available for rigging');
        }
        
        // Clean up previous skeleton if it exists
        this.cleanupPreviousSkeleton();
        
        // Analyze the model geometry to find key points for joints
        const jointPositions = await this.analyzeModelGeometry(model, parseInt(complexity));
        
        // Create the skeleton hierarchy
        this.createSkeleton(jointPositions);
        
        // Bind the mesh to the skeleton (skinning)
        this.bindMeshToSkeleton(model);
        
        // Create a visual representation of the bones
        this.createBoneVisualization();
        
        return this.skeleton;
    }
    
    cleanupPreviousSkeleton() {
        if (this.boneVisualization) {
            this.scene.remove(this.boneVisualization);
            this.boneVisualization = null;
        }
        
        if (this.skeleton) {
            // Remove any existing skeleton-related objects
            this.skeleton = null;
        }
    }
    
    async analyzeModelGeometry(model, complexity) {
        return new Promise((resolve) => {
            // This is a simplified version - in a real implementation, 
            // we would use PoseNet or custom algorithms to detect joints
            
            // Create a bounding box to get model dimensions
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            
            // Default joint positions based on a humanoid model
            // We adjust the number of joints based on the requested complexity
            const height = size.y;
            const jointPositions = {
                hips: new THREE.Vector3(0, height * 0.45, 0),
                spine: new THREE.Vector3(0, height * 0.55, 0),
                chest: new THREE.Vector3(0, height * 0.65, 0),
                neck: new THREE.Vector3(0, height * 0.75, 0),
                head: new THREE.Vector3(0, height * 0.85, 0),
                leftShoulder: new THREE.Vector3(-size.x * 0.2, height * 0.72, 0),
                leftElbow: new THREE.Vector3(-size.x * 0.3, height * 0.6, 0),
                leftHand: new THREE.Vector3(-size.x * 0.4, height * 0.45, 0),
                rightShoulder: new THREE.Vector3(size.x * 0.2, height * 0.72, 0),
                rightElbow: new THREE.Vector3(size.x * 0.3, height * 0.6, 0),
                rightHand: new THREE.Vector3(size.x * 0.4, height * 0.45, 0),
                leftHip: new THREE.Vector3(-size.x * 0.1, height * 0.45, 0),
                leftKnee: new THREE.Vector3(-size.x * 0.12, height * 0.25, 0),
                leftFoot: new THREE.Vector3(-size.x * 0.12, height * 0.05, 0),
                rightHip: new THREE.Vector3(size.x * 0.1, height * 0.45, 0),
                rightKnee: new THREE.Vector3(size.x * 0.12, height * 0.25, 0),
                rightFoot: new THREE.Vector3(size.x * 0.12, height * 0.05, 0)
            };
            
            // Adjust positions based on complexity
            // Lower complexity means fewer joints
            let finalJoints = {};
            
            // Base skeleton for all complexity levels
            finalJoints = {
                hips: jointPositions.hips,
                spine: jointPositions.spine,
                chest: jointPositions.chest,
                neck: jointPositions.neck,
                head: jointPositions.head,
                leftShoulder: jointPositions.leftShoulder,
                rightShoulder: jointPositions.rightShoulder,
                leftElbow: jointPositions.leftElbow,
                rightElbow: jointPositions.rightElbow,
                leftHand: jointPositions.leftHand,
                rightHand: jointPositions.rightHand,
                leftHip: jointPositions.leftHip,
                rightHip: jointPositions.rightHip,
                leftKnee: jointPositions.leftKnee,
                rightKnee: jointPositions.rightKnee,
                leftFoot: jointPositions.leftFoot,
                rightFoot: jointPositions.rightFoot
            };
            
            // Add more joints for higher complexity
            if (complexity >= 3) {
                // Add finger joints, spine segments, etc.
                finalJoints.leftThumb = new THREE.Vector3(-size.x * 0.42, height * 0.45, 0.02);
                finalJoints.leftIndex = new THREE.Vector3(-size.x * 0.42, height * 0.45, 0.01);
                finalJoints.leftMiddle = new THREE.Vector3(-size.x * 0.42, height * 0.45, 0);
                finalJoints.leftRing = new THREE.Vector3(-size.x * 0.42, height * 0.45, -0.01);
                finalJoints.leftPinky = new THREE.Vector3(-size.x * 0.42, height * 0.45, -0.02);
                
                finalJoints.rightThumb = new THREE.Vector3(size.x * 0.42, height * 0.45, 0.02);
                finalJoints.rightIndex = new THREE.Vector3(size.x * 0.42, height * 0.45, 0.01);
                finalJoints.rightMiddle = new THREE.Vector3(size.x * 0.42, height * 0.45, 0);
                finalJoints.rightRing = new THREE.Vector3(size.x * 0.42, height * 0.45, -0.01);
                finalJoints.rightPinky = new THREE.Vector3(size.x * 0.42, height * 0.45, -0.02);
            }
            
            if (complexity >= 4) {
                // Add toe joints, more spine segments, shoulder blade, etc.
                finalJoints.leftToes = new THREE.Vector3(-size.x * 0.12, height * 0.02, size.z * 0.1);
                finalJoints.rightToes = new THREE.Vector3(size.x * 0.12, height * 0.02, size.z * 0.1);
                
                // Additional spine segments
                finalJoints.spineLower = new THREE.Vector3(0, height * 0.5, 0);
                finalJoints.spineMiddle = new THREE.Vector3(0, height * 0.6, 0);
                finalJoints.spineUpper = new THREE.Vector3(0, height * 0.7, 0);
            }
            
            if (complexity >= 5) {
                // Even more detailed skeleton with facial bones, multiple finger segments, etc.
                finalJoints.jaw = new THREE.Vector3(0, height * 0.82, 0.02);
                
                // Finger segments - left hand
                finalJoints.leftThumbMid = new THREE.Vector3(-size.x * 0.41, height * 0.45, 0.02);
                finalJoints.leftIndexMid = new THREE.Vector3(-size.x * 0.41, height * 0.45, 0.01);
                finalJoints.leftMiddleMid = new THREE.Vector3(-size.x * 0.41, height * 0.45, 0);
                finalJoints.leftRingMid = new THREE.Vector3(-size.x * 0.41, height * 0.45, -0.01);
                finalJoints.leftPinkyMid = new THREE.Vector3(-size.x * 0.41, height * 0.45, -0.02);
                
                // Finger segments - right hand
                finalJoints.rightThumbMid = new THREE.Vector3(size.x * 0.41, height * 0.45, 0.02);
                finalJoints.rightIndexMid = new THREE.Vector3(size.x * 0.41, height * 0.45, 0.01);
                finalJoints.rightMiddleMid = new THREE.Vector3(size.x * 0.41, height * 0.45, 0);
                finalJoints.rightRingMid = new THREE.Vector3(size.x * 0.41, height * 0.45, -0.01);
                finalJoints.rightPinkyMid = new THREE.Vector3(size.x * 0.41, height * 0.45, -0.02);
            }
            
            // Simulate a delay to represent complex processing
            setTimeout(() => {
                resolve(finalJoints);
            }, 500);
        });
    }
    
    createSkeleton(jointPositions) {
        // Create a hierarchical bone structure
        const bones = [];
        const boneMap = {};
        
        // Create root bone
        const hipBone = new THREE.Bone();
        hipBone.position.copy(jointPositions.hips);
        hipBone.name = 'hips';
        bones.push(hipBone);
        boneMap.hips = hipBone;
        
        // Create spine chain
        const spineBone = this.createBone('spine', jointPositions.spine, hipBone, boneMap, bones);
        const chestBone = this.createBone('chest', jointPositions.chest, spineBone, boneMap, bones);
        const neckBone = this.createBone('neck', jointPositions.neck, chestBone, boneMap, bones);
        const headBone = this.createBone('head', jointPositions.head, neckBone, boneMap, bones);
        
        // Left arm chain
        const leftShoulderBone = this.createBone('leftShoulder', jointPositions.leftShoulder, chestBone, boneMap, bones);
        const leftElbowBone = this.createBone('leftElbow', jointPositions.leftElbow, leftShoulderBone, boneMap, bones);
        const leftHandBone = this.createBone('leftHand', jointPositions.leftHand, leftElbowBone, boneMap, bones);
        
        // Right arm chain
        const rightShoulderBone = this.createBone('rightShoulder', jointPositions.rightShoulder, chestBone, boneMap, bones);
        const rightElbowBone = this.createBone('rightElbow', jointPositions.rightElbow, rightShoulderBone, boneMap, bones);
        const rightHandBone = this.createBone('rightHand', jointPositions.rightHand, rightElbowBone, boneMap, bones);
        
        // Left leg chain
        const leftHipBone = this.createBone('leftHip', jointPositions.leftHip, hipBone, boneMap, bones);
        const leftKneeBone = this.createBone('leftKnee', jointPositions.leftKnee, leftHipBone, boneMap, bones);
        const leftFootBone = this.createBone('leftFoot', jointPositions.leftFoot, leftKneeBone, boneMap, bones);
        
        // Right leg chain
        const rightHipBone = this.createBone('rightHip', jointPositions.rightHip, hipBone, boneMap, bones);
        const rightKneeBone = this.createBone('rightKnee', jointPositions.rightKnee, rightHipBone, boneMap, bones);
        const rightFootBone = this.createBone('rightFoot', jointPositions.rightFoot, rightKneeBone, boneMap, bones);
        
        // Add additional bones for higher complexity skeletons
        if (jointPositions.leftToes) {
            this.createBone('leftToes', jointPositions.leftToes, leftFootBone, boneMap, bones);
        }
        
        if (jointPositions.rightToes) {
            this.createBone('rightToes', jointPositions.rightToes, rightFootBone, boneMap, bones);
        }
        
        // Fingers for left hand
        if (jointPositions.leftThumb) {
            const leftThumbBone = this.createBone('leftThumb', jointPositions.leftThumb, leftHandBone, boneMap, bones);
            if (jointPositions.leftThumbMid) {
                this.createBone('leftThumbMid', jointPositions.leftThumbMid, leftThumbBone, boneMap, bones);
            }
        }
        
        if (jointPositions.leftIndex) {
            const leftIndexBone = this.createBone('leftIndex', jointPositions.leftIndex, leftHandBone, boneMap, bones);
            if (jointPositions.leftIndexMid) {
                this.createBone('leftIndexMid', jointPositions.leftIndexMid, leftIndexBone, boneMap, bones);
            }
        }
        
        if (jointPositions.leftMiddle) {
            const leftMiddleBone = this.createBone('leftMiddle', jointPositions.leftMiddle, leftHandBone, boneMap, bones);
            if (jointPositions.leftMiddleMid) {
                this.createBone('leftMiddleMid', jointPositions.leftMiddleMid, leftMiddleBone, boneMap, bones);
            }
        }
        
        if (jointPositions.leftRing) {
            const leftRingBone = this.createBone('leftRing', jointPositions.leftRing, leftHandBone, boneMap, bones);
            if (jointPositions.leftRingMid) {
                this.createBone('leftRingMid', jointPositions.leftRingMid, leftRingBone, boneMap, bones);
            }
        }
        
        if (jointPositions.leftPinky) {
            const leftPinkyBone = this.createBone('leftPinky', jointPositions.leftPinky, leftHandBone, boneMap, bones);
            if (jointPositions.leftPinkyMid) {
                this.createBone('leftPinkyMid', jointPositions.leftPinkyMid, leftPinkyBone, boneMap, bones);
            }
        }
        
        // Fingers for right hand
        if (jointPositions.rightThumb) {
            const rightThumbBone = this.createBone('rightThumb', jointPositions.rightThumb, rightHandBone, boneMap, bones);
            if (jointPositions.rightThumbMid) {
                this.createBone('rightThumbMid', jointPositions.rightThumbMid, rightThumbBone, boneMap, bones);
            }
        }
        
        if (jointPositions.rightIndex) {
            const rightIndexBone = this.createBone('rightIndex', jointPositions.rightIndex, rightHandBone, boneMap, bones);
            if (jointPositions.rightIndexMid) {
                this.createBone('rightIndexMid', jointPositions.rightIndexMid, rightIndexBone, boneMap, bones);
            }
        }
        
        if (jointPositions.rightMiddle) {
            const rightMiddleBone = this.createBone('rightMiddle', jointPositions.rightMiddle, rightHandBone, boneMap, bones);
            if (jointPositions.rightMiddleMid) {
                this.createBone('rightMiddleMid', jointPositions.rightMiddleMid, rightMiddleBone, boneMap, bones);
            }
        }
        
        if (jointPositions.rightRing) {
            const rightRingBone = this.createBone('rightRing', jointPositions.rightRing, rightHandBone, boneMap, bones);
            if (jointPositions.rightRingMid) {
                this.createBone('rightRingMid', jointPositions.rightRingMid, rightRingBone, boneMap, bones);
            }
        }
        
        if (jointPositions.rightPinky) {
            const rightPinkyBone = this.createBone('rightPinky', jointPositions.rightPinky, rightHandBone, boneMap, bones);
            if (jointPositions.rightPinkyMid) {
                this.createBone('rightPinkyMid', jointPositions.rightPinkyMid, rightPinkyBone, boneMap, bones);
            }
        }
        
        // Create the skeleton
        this.skeleton = new THREE.Skeleton(bones);
        
        // Update bone matrices
        this.skeleton.bones.forEach(bone => {
            if (bone.parent && bone.parent.isBone) {
                // Calculate the proper local position relative to parent
                const parentWorldPos = new THREE.Vector3();
                bone.parent.getWorldPosition(parentWorldPos);
                
                const boneWorldPos = bone.position.clone();
                bone.position.subVectors(boneWorldPos, parentWorldPos);
            }
        });
        
        this.skeleton.bones[0].position.set(0, 0, 0); // Reset the root position
        this.skeleton.pose(); // Reset pose to bind pose
    }
    
    createBone(name, position, parent, boneMap, bones) {
        const bone = new THREE.Bone();
        bone.name = name;
        bone.position.copy(position);
        
        if (parent) {
            parent.add(bone);
        }
        
        bones.push(bone);
        boneMap[name] = bone;
        
        return bone;
    }
    
    bindMeshToSkeleton(model) {
        // Find all meshes in the model
        const meshes = [];
        model.traverse(child => {
            if (child.isMesh) {
                meshes.push(child);
            }
        });
        
        if (meshes.length === 0) {
            console.warn('No meshes found in the model for skinning');
            return;
        }
        
        // For each mesh, create a skinned mesh
        meshes.forEach(mesh => {
            // Skip if it's already a skinned mesh
            if (mesh.isSkinnedMesh) return;
            
            const geometry = mesh.geometry.clone();
            const material = mesh.material.clone();
            
            // Create bone influences - this is a simplified approach
            // In a real implementation, we would use more sophisticated algorithms 
            // to determine how vertices are influenced by bones
            this.createBoneInfluences(geometry, mesh);
            
            // Create skinned mesh
            const skinnedMesh = new THREE.SkinnedMesh(geometry, material);
            skinnedMesh.add(this.skeleton.bones[0]); // Add root bone
            skinnedMesh.bind(this.skeleton);
            
            // Replace the original mesh with the skinned mesh
            mesh.parent.add(skinnedMesh);
            skinnedMesh.position.copy(mesh.position);
            skinnedMesh.quaternion.copy(mesh.quaternion);
            skinnedMesh.scale.copy(mesh.scale);
            
            mesh.parent.remove(mesh);
            
            this.skinnedMesh = skinnedMesh;
        });
    }
    
    createBoneInfluences(geometry, mesh) {
        if (!geometry.attributes.position) {
            console.warn('Geometry has no position attribute');
            return;
        }
        
        const positions = geometry.attributes.position.array;
        const vertexCount = positions.length / 3;
        
        // Create arrays for skinning
        const skinIndices = new Float32Array(vertexCount * 4);
        const skinWeights = new Float32Array(vertexCount * 4);
        
        // Get the world position of each bone
        const bonePositions = this.skeleton.bones.map(bone => {
            const worldPos = new THREE.Vector3();
            bone.getWorldPosition(worldPos);
            return worldPos;
        });
        
        // For each vertex, find the 4 closest bones and assign weights
        for (let i = 0; i < vertexCount; i++) {
            const vx = positions[i * 3];
            const vy = positions[i * 3 + 1];
            const vz = positions[i * 3 + 2];
            
            // Convert to world space
            const vertexWorld = new THREE.Vector3(vx, vy, vz);
            vertexWorld.applyMatrix4(mesh.matrixWorld);
            
            // Calculate distances to each bone
            const distances = bonePositions.map((bonePos, index) => {
                return {
                    index: index,
                    distance: vertexWorld.distanceTo(bonePos)
                };
            });
            
            // Sort by distance
            distances.sort((a, b) => a.distance - b.distance);
            
            // Take the 4 closest bones
            const closestBones = distances.slice(0, 4);
            
            // Normalize weights to sum to 1
            const totalWeight = closestBones.reduce((sum, b) => sum + (1 / (b.distance + 0.1)), 0);
            
            // Assign indices and weights
            for (let j = 0; j < 4; j++) {
                if (j < closestBones.length) {
                    const bone = closestBones[j];
                    const weight = (1 / (bone.distance + 0.1)) / totalWeight;
                    
                    skinIndices[i * 4 + j] = bone.index;
                    skinWeights[i * 4 + j] = weight;
                } else {
                    skinIndices[i * 4 + j] = 0;
                    skinWeights[i * 4 + j] = 0;
                }
            }
        }
        
        // Add the skinning data to the geometry
        geometry.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndices, 4));
        geometry.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeights, 4));
    }
    
    createBoneVisualization() {
        if (!this.skeleton) return;
        
        // Create a visual representation of the bones
        const boneContainer = new THREE.Group();
        boneContainer.name = 'boneVisualization';
        
        // Add visual elements for each bone
        this.skeleton.bones.forEach(bone => {
            if (bone.parent && bone.parent.isBone) {
                const boneLength = bone.position.length();
                
                // Create a cylinder representing the bone
                const geometry = new THREE.CylinderGeometry(0.01, 0.01, boneLength, 8);
                // Rotate and position the cylinder to align with the bone
                geometry.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));
                geometry.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, -boneLength / 2));
                
                const material = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
                const boneMesh = new THREE.Mesh(geometry, material);
                
                // Create a small sphere for the joint
                const jointGeometry = new THREE.SphereGeometry(0.02, 8, 8);
                const jointMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
                const joint = new THREE.Mesh(jointGeometry, jointMaterial);
                
                // Get the world position and orientation of the bone
                const boneParentWorldPos = new THREE.Vector3();
                bone.parent.getWorldPosition(boneParentWorldPos);
                
                const boneWorldPos = new THREE.Vector3();
                bone.getWorldPosition(boneWorldPos);
                
                // Position the joint at the beginning of the bone
                joint.position.copy(boneParentWorldPos);
                
                // Calculate the direction from parent to bone
                const direction = new THREE.Vector3().subVectors(boneWorldPos, boneParentWorldPos);
                const length = direction.length();
                
                // Position the bone mesh to start at the parent joint
                boneMesh.position.copy(boneParentWorldPos);
                
                // Orient the bone to point to the child
                if (length > 0) {
                    direction.normalize();
                    const quaternion = new THREE.Quaternion().setFromUnitVectors(
                        new THREE.Vector3(0, 0, 1), 
                        direction
                    );
                    boneMesh.quaternion.copy(quaternion);
                    
                    // Scale the bone to match the distance
                    boneMesh.scale.set(1, 1, length);
                }
                
                boneContainer.add(boneMesh);
                boneContainer.add(joint);
            }
        });
        
        this.scene.add(boneContainer);
        this.boneVisualization = boneContainer;
    }
}

