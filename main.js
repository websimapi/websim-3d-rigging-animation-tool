import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import * as tf from 'tensorflow';

import { RiggingSystem } from './rigging.js';
import { AnimationSystem } from './animation.js';

class App {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.model = null;
        this.riggingSystem = null;
        this.animationSystem = null;
        
        this.init();
        this.setupEventListeners();
    }
    
    init() {
        // Create Three.js scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x333333);
        
        // Camera setup
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 1, 3);
        
        // Renderer setup
        const canvas = document.getElementById('3d-canvas');
        this.renderer = new THREE.WebGLRenderer({ 
            canvas, 
            antialias: true 
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.updateRendererSize();
        
        // Controls for camera
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        
        // Add lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(1, 1, 1);
        this.scene.add(directionalLight);
        
        // Add grid
        const gridHelper = new THREE.GridHelper(10, 10);
        this.scene.add(gridHelper);
        
        // Initialize systems
        this.riggingSystem = new RiggingSystem(this.scene);
        this.animationSystem = new AnimationSystem(this.scene);
        
        // Start animation loop
        this.animate();
        
        // Update status
        this.updateStatus('Ready. Import a 3D model to begin.');
    }
    
    animate() {
        requestAnimationFrame(this.animate.bind(this));
        
        this.controls.update();
        
        if (this.animationSystem) {
            this.animationSystem.update();
        }
        
        this.renderer.render(this.scene, this.camera);
    }
    
    updateRendererSize() {
        const container = document.querySelector('.canvas-container');
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        this.renderer.setSize(width, height);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }
    
    setupEventListeners() {
        // Resize handler
        window.addEventListener('resize', this.updateRendererSize.bind(this));
        
        // Model import handlers
        document.getElementById('import-model').addEventListener('click', () => {
            document.getElementById('model-input').click();
        });
        
        document.getElementById('model-input').addEventListener('change', (event) => {
            if (event.target.files.length > 0) {
                this.importModel(event.target.files[0]);
            }
        });
        
        // Drag and drop for model import
        const dropArea = document.querySelector('.drop-area');
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, preventDefaults, false);
        });
        
        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        ['dragenter', 'dragover'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => {
                dropArea.classList.add('active');
            });
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => {
                dropArea.classList.remove('active');
            });
        });
        
        dropArea.addEventListener('drop', (e) => {
            const file = e.dataTransfer.files[0];
            if (file) {
                this.importModel(file);
            }
        });
        
        // Rigging controls
        document.getElementById('auto-rig').addEventListener('click', () => {
            document.getElementById('model-panel').classList.add('hidden');
            document.getElementById('rig-panel').classList.remove('hidden');
            this.updateStatus('Ready to generate skeleton. Adjust complexity as needed.');
        });
        
        document.getElementById('generate-skeleton').addEventListener('click', () => {
            const complexity = document.getElementById('skeleton-complexity').value;
            this.showLoadingIndicator(true);
            
            // Use setTimeout to allow the UI to update before potentially heavy processing
            setTimeout(() => {
                this.riggingSystem.generateSkeleton(this.model, complexity)
                    .then(() => {
                        this.updateStatus('Skeleton generated. You can now edit the bones or proceed to animation.');
                        document.getElementById('edit-skeleton').disabled = false;
                        document.getElementById('animate').disabled = false;
                        this.showLoadingIndicator(false);
                    })
                    .catch(error => {
                        console.error('Error generating skeleton:', error);
                        this.updateStatus('Failed to generate skeleton: ' + error.message);
                        this.showLoadingIndicator(false);
                    });
            }, 100);
        });
        
        document.getElementById('skeleton-complexity').addEventListener('input', (e) => {
            const value = e.target.value;
            let complexityText = '';
            
            switch (parseInt(value)) {
                case 1: complexityText = 'Very Simple'; break;
                case 2: complexityText = 'Simple'; break;
                case 3: complexityText = 'Medium'; break;
                case 4: complexityText = 'Complex'; break;
                case 5: complexityText = 'Very Complex'; break;
            }
            
            document.getElementById('complexity-value').textContent = complexityText;
        });
        
        // Animation controls
        document.getElementById('animate').addEventListener('click', () => {
            document.getElementById('rig-panel').classList.add('hidden');
            document.getElementById('animation-panel').classList.remove('hidden');
            this.animationSystem.setupTimeline();
            this.updateStatus('Animation mode active. Create keyframes to animate the character.');
        });
        
        // Export
        document.getElementById('export').addEventListener('click', () => {
            document.getElementById('export-modal').classList.remove('hidden');
        });
        
        document.getElementById('export-cancel').addEventListener('click', () => {
            document.getElementById('export-modal').classList.add('hidden');
        });
        
        document.getElementById('export-confirm').addEventListener('click', () => {
            const format = document.querySelector('input[name="export-format"]:checked').value;
            this.exportModel(format);
            document.getElementById('export-modal').classList.add('hidden');
        });
    }
    
    importModel(file) {
        this.showLoadingIndicator(true);
        this.updateStatus('Loading model...');
        
        const fileName = file.name.toLowerCase();
        const reader = new FileReader();
        
        reader.onload = (event) => {
            const buffer = event.target.result;
            
            let loader;
            if (fileName.endsWith('.glb') || fileName.endsWith('.gltf')) {
                loader = new GLTFLoader();
            } else if (fileName.endsWith('.fbx')) {
                loader = new FBXLoader();
            } else if (fileName.endsWith('.obj')) {
                loader = new OBJLoader();
            } else {
                this.updateStatus('Unsupported file format. Please use GLTF, GLB, FBX, or OBJ.');
                this.showLoadingIndicator(false);
                return;
            }
            
            try {
                loader.parse(buffer, '', (loadedObject) => {
                    // Clear previous model if it exists
                    if (this.model) {
                        this.scene.remove(this.model);
                    }
                    
                    // GLTF stores the actual model in scene, others directly
                    if (loadedObject.scene) {
                        this.model = loadedObject.scene;
                    } else {
                        this.model = loadedObject;
                    }
                    
                    // Center the model
                    const box = new THREE.Box3().setFromObject(this.model);
                    const center = box.getCenter(new THREE.Vector3());
                    this.model.position.x = -center.x;
                    this.model.position.y = -center.y;
                    this.model.position.z = -center.z;
                    
                    // Scale the model to a reasonable size
                    const size = box.getSize(new THREE.Vector3());
                    const maxDim = Math.max(size.x, size.y, size.z);
                    if (maxDim > 2) {
                        const scale = 2 / maxDim;
                        this.model.scale.set(scale, scale, scale);
                    }
                    
                    this.scene.add(this.model);
                    
                    // Update model info
                    this.updateModelInfo(file.name, this.model);
                    
                    // Enable rigging button
                    document.getElementById('auto-rig').disabled = false;
                    
                    this.updateStatus('Model loaded successfully.');
                    this.showLoadingIndicator(false);
                }, (error) => {
                    console.error('Error loading model:', error);
                    this.updateStatus('Failed to load model: ' + error.message);
                    this.showLoadingIndicator(false);
                });
            } catch (error) {
                console.error('Error parsing model:', error);
                this.updateStatus('Failed to parse model: ' + error.message);
                this.showLoadingIndicator(false);
            }
        };
        
        reader.onerror = (error) => {
            console.error('Error reading file:', error);
            this.updateStatus('Failed to read file: ' + error.message);
            this.showLoadingIndicator(false);
        };
        
        reader.readAsArrayBuffer(file);
    }
    
    updateModelInfo(fileName, model) {
        document.getElementById('model-name').textContent = fileName;
        
        let vertexCount = 0;
        let triangleCount = 0;
        
        model.traverse((child) => {
            if (child.isMesh) {
                const geometry = child.geometry;
                
                if (geometry.index !== null) {
                    triangleCount += geometry.index.count / 3;
                } else {
                    triangleCount += geometry.attributes.position.count / 3;
                }
                
                vertexCount += geometry.attributes.position.count;
            }
        });
        
        document.getElementById('model-vertices').textContent = vertexCount.toLocaleString();
        document.getElementById('model-triangles').textContent = triangleCount.toLocaleString();
        
        document.querySelector('.model-info').classList.remove('hidden');
    }
    
    exportModel(format) {
        if (!this.model) {
            this.updateStatus('No model to export.');
            return;
        }
        
        this.showLoadingIndicator(true);
        this.updateStatus('Preparing model for export...');
        
        if (format === 'glb' || format === 'gltf') {
            const exporter = new GLTFExporter();
            const options = {
                binary: format === 'glb',
                animations: this.animationSystem.getAnimations()
            };
            
            exporter.parse(this.model, (result) => {
                let blob;
                
                if (format === 'glb') {
                    blob = new Blob([result], { type: 'application/octet-stream' });
                } else {
                    blob = new Blob([JSON.stringify(result)], { type: 'application/json' });
                }
                
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `model.${format}`;
                link.click();
                
                this.updateStatus(`Model exported as ${format.toUpperCase()}.`);
                this.showLoadingIndicator(false);
            }, (error) => {
                console.error('Error exporting model:', error);
                this.updateStatus('Failed to export model: ' + error.message);
                this.showLoadingIndicator(false);
            }, options);
        } else if (format === 'fbx') {
            // FBX export is more complex and not fully supported in Three.js
            this.updateStatus('FBX export is not fully implemented yet. Please use GLB or GLTF format.');
            this.showLoadingIndicator(false);
        }
    }
    
    updateStatus(message) {
        document.getElementById('status-message').textContent = message;
    }
    
    showLoadingIndicator(show) {
        const indicator = document.querySelector('.loading-indicator');
        if (show) {
            indicator.classList.remove('hidden');
        } else {
            indicator.classList.add('hidden');
        }
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new App();
});

