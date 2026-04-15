'use client';

import type React from 'react';
import { useRef, useMemo, useCallback, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

type MediaItem = string | { src: string; alt?: string };

// Helper to determine if a URL is a video
const isVideoUrl = (url: string): boolean => {
	const videoExtensions = ['.mp4', '.webm', '.mov', '.ogg', '.avi', '.mkv'];
	const lowercaseUrl = url.toLowerCase();
	return videoExtensions.some((ext) => lowercaseUrl.includes(ext));
};

interface FadeSettings {
	/** Fade in range as percentage of depth range (0-1) */
	fadeIn: {
		start: number;
		end: number;
	};
	/** Fade out range as percentage of depth range (0-1) */
	fadeOut: {
		start: number;
		end: number;
	};
}

interface BlurSettings {
	/** Blur in range as percentage of depth range (0-1) */
	blurIn: {
		start: number;
		end: number;
	};
	/** Blur out range as percentage of depth range (0-1) */
	blurOut: {
		start: number;
		end: number;
	};
	/** Maximum blur amount (0-10, higher values = more blur) */
	maxBlur: number;
}

interface InfiniteGalleryProps {
	images: MediaItem[];
	/** Speed multiplier applied to scroll delta (default: 1) */
	speed?: number;
	/** Spacing between images along Z in world units (default: 2.5) */
	zSpacing?: number;
	/** Number of visible planes (default: clamp to images.length, min 8) */
	visibleCount?: number;
	/** Near/far distances for opacity/blur easing (default: { near: 0.5, far: 12 }) */
	falloff?: { near: number; far: number };
	/** Fade in/out settings with ranges based on depth range percentage (default: { fadeIn: { start: 0.05, end: 0.15 }, fadeOut: { start: 0.85, end: 0.95 } }) */
	fadeSettings?: FadeSettings;
	/** Blur in/out settings with ranges based on depth range percentage (default: { blurIn: { start: 0.0, end: 0.1 }, blurOut: { start: 0.9, end: 1.0 }, maxBlur: 3.0 }) */
	blurSettings?: BlurSettings;
	/** Optional className for outer container */
	className?: string;
	/** Optional style for outer container */
	style?: React.CSSProperties;
}

interface PlaneData {
	index: number;
	z: number;
	imageIndex: number;
	x: number;
	y: number; // Added y property for vertical positioning
}

const DEFAULT_DEPTH_RANGE = 50;
const MAX_HORIZONTAL_OFFSET = 8;
const MAX_VERTICAL_OFFSET = 8;

// Hook to create video texture
function useVideoTexture(src: string): THREE.VideoTexture | null {
	const [texture, setTexture] = useState<THREE.VideoTexture | null>(null);
	const videoRef = useRef<HTMLVideoElement | null>(null);

	useEffect(() => {
		const video = document.createElement('video');
		video.src = src;
		video.crossOrigin = 'anonymous';
		video.loop = true;
		video.muted = true;
		video.playsInline = true;
		video.autoplay = true;
		videoRef.current = video;

		const handleCanPlay = () => {
			const videoTexture = new THREE.VideoTexture(video);
			videoTexture.minFilter = THREE.LinearFilter;
			videoTexture.magFilter = THREE.LinearFilter;
			videoTexture.format = THREE.RGBAFormat;
			videoTexture.colorSpace = THREE.SRGBColorSpace;
			setTexture(videoTexture);
			video.play().catch(() => {
				// Autoplay may be blocked, that's okay
			});
		};

		video.addEventListener('canplay', handleCanPlay);

		// Start loading
		video.load();

		return () => {
			video.removeEventListener('canplay', handleCanPlay);
			video.pause();
			video.src = '';
			videoRef.current = null;
			if (texture) {
				texture.dispose();
			}
		};
	}, [src]);

	// Keep video playing
	useFrame(() => {
		if (texture && videoRef.current) {
			texture.needsUpdate = true;
		}
	});

	return texture;
}

// Hook to load media (image or video)
function useMediaTextures(
	sources: { src: string; isVideo: boolean }[]
): (THREE.Texture | null)[] {
	const [textures, setTextures] = useState<(THREE.Texture | null)[]>(
		() => sources.map(() => null)
	);
	const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
	const textureRefs = useRef<(THREE.Texture | null)[]>([]);

	useEffect(() => {
		const newTextures: (THREE.Texture | null)[] = sources.map(() => null);
		const videos: (HTMLVideoElement | null)[] = [];

		sources.forEach((source, index) => {
			if (source.isVideo) {
				const video = document.createElement('video');
				video.src = source.src;
				video.crossOrigin = 'anonymous';
				video.loop = true;
				video.muted = true;
				video.playsInline = true;
				video.autoplay = true;
				videos[index] = video;

				const handleCanPlay = () => {
					const videoTexture = new THREE.VideoTexture(video);
					videoTexture.minFilter = THREE.LinearFilter;
					videoTexture.magFilter = THREE.LinearFilter;
					videoTexture.format = THREE.RGBAFormat;
					videoTexture.colorSpace = THREE.SRGBColorSpace;
					newTextures[index] = videoTexture;
					textureRefs.current[index] = videoTexture;
					setTextures([...newTextures]);
					video.play().catch(() => { });
				};

				video.addEventListener('canplay', handleCanPlay);
				video.load();
			} else {
				const loader = new THREE.TextureLoader();
				loader.load(
					source.src,
					(tex) => {
						tex.colorSpace = THREE.SRGBColorSpace;
						newTextures[index] = tex;
						textureRefs.current[index] = tex;
						setTextures([...newTextures]);
					},
					undefined,
					(error) => {
						console.error(`Failed to load texture: ${source.src}`, error);
					}
				);
			}
		});

		videoRefs.current = videos;

		return () => {
			videos.forEach((video) => {
				if (video) {
					video.pause();
					video.src = '';
				}
			});
			textureRefs.current.forEach((tex) => {
				if (tex) tex.dispose();
			});
		};
	}, [JSON.stringify(sources.map((s) => s.src))]);

	// Update video textures each frame
	useFrame(() => {
		textureRefs.current.forEach((tex, i) => {
			if (tex && sources[i]?.isVideo) {
				tex.needsUpdate = true;
			}
		});
	});

	return textures;
}

// Custom shader material for blur, opacity, and cloth folding effects
const createClothMaterial = () => {
	return new THREE.ShaderMaterial({
		transparent: true,
		uniforms: {
			map: { value: null },
			opacity: { value: 1.0 },
			blurAmount: { value: 0.0 },
			scrollForce: { value: 0.0 },
			time: { value: 0.0 },
			isHovered: { value: 0.0 },
		},
		vertexShader: `
      uniform float scrollForce;
      uniform float time;
      uniform float isHovered;
      varying vec2 vUv;
      varying vec3 vNormal;
      
      void main() {
        vUv = uv;
        vNormal = normal;
        
        vec3 pos = position;
        
        // Create smooth curving based on scroll force
        float curveIntensity = scrollForce * 0.3;
        
        // Base curve across the plane based on distance from center
        float distanceFromCenter = length(pos.xy);
        float curve = distanceFromCenter * distanceFromCenter * curveIntensity;
        
        // Add gentle cloth-like ripples
        float ripple1 = sin(pos.x * 2.0 + scrollForce * 3.0) * 0.02;
        float ripple2 = sin(pos.y * 2.5 + scrollForce * 2.0) * 0.015;
        float clothEffect = (ripple1 + ripple2) * abs(curveIntensity) * 2.0;
        
        // Flag waving effect when hovered
        float flagWave = 0.0;
        if (isHovered > 0.5) {
          // Create flag-like wave from left to right
          float wavePhase = pos.x * 3.0 + time * 8.0;
          float waveAmplitude = sin(wavePhase) * 0.1;
          // Damping effect - stronger wave on the right side (free edge)
          float dampening = smoothstep(-0.5, 0.5, pos.x);
          flagWave = waveAmplitude * dampening;
          
          // Add secondary smaller waves for more realistic flag motion
          float secondaryWave = sin(pos.x * 5.0 + time * 12.0) * 0.03 * dampening;
          flagWave += secondaryWave;
        }
        
        // Apply Z displacement for curving effect (inverted) with cloth ripples and flag wave
        pos.z -= (curve + clothEffect + flagWave);
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
		fragmentShader: `
      uniform sampler2D map;
      uniform float opacity;
      uniform float blurAmount;
      uniform float scrollForce;
      varying vec2 vUv;
      varying vec3 vNormal;
      
      void main() {
        vec4 color = texture2D(map, vUv);
        
        // Simple blur approximation
        if (blurAmount > 0.0) {
          vec2 texelSize = 1.0 / vec2(textureSize(map, 0));
          vec4 blurred = vec4(0.0);
          float total = 0.0;
          
          for (float x = -2.0; x <= 2.0; x += 1.0) {
            for (float y = -2.0; y <= 2.0; y += 1.0) {
              vec2 offset = vec2(x, y) * texelSize * blurAmount;
              float weight = 1.0 / (1.0 + length(vec2(x, y)));
              blurred += texture2D(map, vUv + offset) * weight;
              total += weight;
            }
          }
          color = blurred / total;
        }
        
        // Add subtle lighting effect based on curving
        float curveHighlight = abs(scrollForce) * 0.05;
        color.rgb += vec3(curveHighlight * 0.1);
        
        gl_FragColor = vec4(color.rgb, color.a * opacity);
      }
    `,
	});
};

function ImagePlane({
	texture,
	position,
	scale,
	material,
}: {
	texture: THREE.Texture;
	position: [number, number, number];
	scale: [number, number, number];
	material: THREE.ShaderMaterial;
}) {
	const meshRef = useRef<THREE.Mesh>(null);
	const [isHovered, setIsHovered] = useState(false);

	useEffect(() => {
		if (material && texture) {
			material.uniforms.map.value = texture;
		}
	}, [material, texture]);

	useEffect(() => {
		if (material && material.uniforms) {
			material.uniforms.isHovered.value = isHovered ? 1.0 : 0.0;
		}
	}, [material, isHovered]);

	return (
		<mesh
			ref={meshRef}
			position={position}
			scale={scale}
			material={material}
			onPointerEnter={() => setIsHovered(true)}
			onPointerLeave={() => setIsHovered(false)}
		>
			<planeGeometry args={[1, 1, 32, 32]} />
		</mesh>
	);
}

function GalleryScene({
	images,
	speed = 1,
	visibleCount = 8,
	fadeSettings = {
		fadeIn: { start: 0.05, end: 0.15 },
		fadeOut: { start: 0.85, end: 0.95 },
	},
	blurSettings = {
		blurIn: { start: 0.0, end: 0.1 },
		blurOut: { start: 0.9, end: 1.0 },
		maxBlur: 3.0,
	},
}: Omit<InfiniteGalleryProps, 'className' | 'style'>) {
	const [scrollVelocity, setScrollVelocity] = useState(0);
	const [autoPlay, setAutoPlay] = useState(true);
	const lastInteraction = useRef(Date.now());

	// Normalize images to objects and detect video types
	const normalizedMedia = useMemo(
		() =>
			images.map((img) => {
				const src = typeof img === 'string' ? img : img.src;
				const alt = typeof img === 'string' ? '' : img.alt || '';
				return { src, alt, isVideo: isVideoUrl(src) };
			}),
		[images]
	);

	// Load textures (images and videos)
	const textures = useMediaTextures(
		normalizedMedia.map((m) => ({ src: m.src, isVideo: m.isVideo }))
	);

	// Create materials pool
	const materials = useMemo(
		() => Array.from({ length: visibleCount }, () => createClothMaterial()),
		[visibleCount]
	);

	const spatialPositions = useMemo(() => {
		const positions: { x: number; y: number }[] = [];
		const maxHorizontalOffset = MAX_HORIZONTAL_OFFSET;
		const maxVerticalOffset = MAX_VERTICAL_OFFSET;

		for (let i = 0; i < visibleCount; i++) {
			// Create varied distribution patterns for both axes
			const horizontalAngle = (i * 2.618) % (Math.PI * 2); // Golden angle for natural distribution
			const verticalAngle = (i * 1.618 + Math.PI / 3) % (Math.PI * 2); // Offset angle for vertical

			const horizontalRadius = (i % 3) * 1.2; // Vary the distance from center
			const verticalRadius = ((i + 1) % 4) * 0.8; // Different pattern for vertical

			const x =
				(Math.sin(horizontalAngle) * horizontalRadius * maxHorizontalOffset) /
				3;
			const y =
				(Math.cos(verticalAngle) * verticalRadius * maxVerticalOffset) / 4;

			positions.push({ x, y });
		}

		return positions;
	}, [visibleCount]);

	const totalImages = normalizedMedia.length;
	const depthRange = DEFAULT_DEPTH_RANGE;

	// Initialize plane data
	const planesData = useRef<PlaneData[]>(
		Array.from({ length: visibleCount }, (_, i) => ({
			index: i,
			z: visibleCount > 0 ? ((depthRange / visibleCount) * i) % depthRange : 0,
			imageIndex: totalImages > 0 ? i % totalImages : 0,
			x: spatialPositions[i]?.x ?? 0, // Use spatial positions for x
			y: spatialPositions[i]?.y ?? 0, // Use spatial positions for y
		}))
	);

	useEffect(() => {
		planesData.current = Array.from({ length: visibleCount }, (_, i) => ({
			index: i,
			z:
				visibleCount > 0
					? ((depthRange / Math.max(visibleCount, 1)) * i) % depthRange
					: 0,
			imageIndex: totalImages > 0 ? i % totalImages : 0,
			x: spatialPositions[i]?.x ?? 0,
			y: spatialPositions[i]?.y ?? 0,
		}));
	}, [depthRange, spatialPositions, totalImages, visibleCount]);

	// Handle scroll input
	const handleWheel = useCallback(
		(event: WheelEvent) => {
			event.preventDefault();
			setScrollVelocity((prev) => prev + event.deltaY * 0.01 * speed);
			setAutoPlay(false);
			lastInteraction.current = Date.now();
		},
		[speed]
	);

	// Handle keyboard input
	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
				setScrollVelocity((prev) => prev - 2 * speed);
				setAutoPlay(false);
				lastInteraction.current = Date.now();
			} else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
				setScrollVelocity((prev) => prev + 2 * speed);
				setAutoPlay(false);
				lastInteraction.current = Date.now();
			}
		},
		[speed]
	);

	useEffect(() => {
		const canvas = document.querySelector('canvas');
		if (canvas) {
			canvas.addEventListener('wheel', handleWheel, { passive: false });
			document.addEventListener('keydown', handleKeyDown);

			return () => {
				canvas.removeEventListener('wheel', handleWheel);
				document.removeEventListener('keydown', handleKeyDown);
			};
		}
	}, [handleWheel, handleKeyDown]);

	// Auto-play logic
	useEffect(() => {
		const interval = setInterval(() => {
			if (Date.now() - lastInteraction.current > 3000) {
				setAutoPlay(true);
			}
		}, 1000);
		return () => clearInterval(interval);
	}, []);

	useFrame((state, delta) => {
		// Apply auto-play
		if (autoPlay) {
			setScrollVelocity((prev) => prev + 0.3 * delta);
		}

		// Damping
		setScrollVelocity((prev) => prev * 0.95);

		// Update time uniform for all materials
		const time = state.clock.getElapsedTime();
		materials.forEach((material) => {
			if (material && material.uniforms) {
				material.uniforms.time.value = time;
				material.uniforms.scrollForce.value = scrollVelocity;
			}
		});

		// Update plane positions
		const totalRange = depthRange;
		const halfRange = totalRange / 2;

		planesData.current.forEach((plane, i) => {
			let newZ = plane.z + scrollVelocity * delta * 10;
			let wrapsForward = 0;
			let wrapsBackward = 0;

			if (newZ >= totalRange) {
				wrapsForward = Math.floor(newZ / totalRange);
				newZ -= totalRange * wrapsForward;
			} else if (newZ < 0) {
				wrapsBackward = Math.ceil(-newZ / totalRange);
				newZ += totalRange * wrapsBackward;
			}

			if (totalImages > 0) {
				if (wrapsForward > 0) {
					// Find the highest imageIndex currently in use and go one beyond
					const usedIndices = planesData.current.map((p) => p.imageIndex);
					const maxIndex = Math.max(...usedIndices);
					plane.imageIndex = (maxIndex + 1) % totalImages;
				}

				if (wrapsBackward > 0) {
					// Find the lowest imageIndex currently in use and go one before
					const usedIndices = planesData.current.map((p) => p.imageIndex);
					const minIndex = Math.min(...usedIndices);
					plane.imageIndex = ((minIndex - 1) % totalImages + totalImages) % totalImages;
				}
			}

			plane.z = ((newZ % totalRange) + totalRange) % totalRange;
			plane.x = spatialPositions[i]?.x ?? 0;
			plane.y = spatialPositions[i]?.y ?? 0;

			const worldZ = plane.z - halfRange;

			// Calculate opacity based on fade settings
			const normalizedPosition = plane.z / totalRange; // 0 to 1
			let opacity = 1;

			if (
				normalizedPosition >= fadeSettings.fadeIn.start &&
				normalizedPosition <= fadeSettings.fadeIn.end
			) {
				// Fade in: opacity goes from 0 to 1 within the fade in range
				const fadeInProgress =
					(normalizedPosition - fadeSettings.fadeIn.start) /
					(fadeSettings.fadeIn.end - fadeSettings.fadeIn.start);
				opacity = fadeInProgress;
			} else if (normalizedPosition < fadeSettings.fadeIn.start) {
				// Before fade in starts: fully transparent
				opacity = 0;
			} else if (
				normalizedPosition >= fadeSettings.fadeOut.start &&
				normalizedPosition <= fadeSettings.fadeOut.end
			) {
				// Fade out: opacity goes from 1 to 0 within the fade out range
				const fadeOutProgress =
					(normalizedPosition - fadeSettings.fadeOut.start) /
					(fadeSettings.fadeOut.end - fadeSettings.fadeOut.start);
				opacity = 1 - fadeOutProgress;
			} else if (normalizedPosition > fadeSettings.fadeOut.end) {
				// After fade out ends: fully transparent
				opacity = 0;
			}

			// Clamp opacity between 0 and 1
			opacity = Math.max(0, Math.min(1, opacity));

			// Calculate blur based on blur settings
			let blur = 0;

			if (
				normalizedPosition >= blurSettings.blurIn.start &&
				normalizedPosition <= blurSettings.blurIn.end
			) {
				// Blur in: blur goes from maxBlur to 0 within the blur in range
				const blurInProgress =
					(normalizedPosition - blurSettings.blurIn.start) /
					(blurSettings.blurIn.end - blurSettings.blurIn.start);
				blur = blurSettings.maxBlur * (1 - blurInProgress);
			} else if (normalizedPosition < blurSettings.blurIn.start) {
				// Before blur in starts: full blur
				blur = blurSettings.maxBlur;
			} else if (
				normalizedPosition >= blurSettings.blurOut.start &&
				normalizedPosition <= blurSettings.blurOut.end
			) {
				// Blur out: blur goes from 0 to maxBlur within the blur out range
				const blurOutProgress =
					(normalizedPosition - blurSettings.blurOut.start) /
					(blurSettings.blurOut.end - blurSettings.blurOut.start);
				blur = blurSettings.maxBlur * blurOutProgress;
			} else if (normalizedPosition > blurSettings.blurOut.end) {
				// After blur out ends: full blur
				blur = blurSettings.maxBlur;
			}

			// Clamp blur to reasonable values
			blur = Math.max(0, Math.min(blurSettings.maxBlur, blur));

			// Update material uniforms
			const material = materials[i];
			if (material && material.uniforms) {
				material.uniforms.opacity.value = opacity;
				material.uniforms.blurAmount.value = blur;
			}
		});
	});

	if (normalizedMedia.length === 0) return null;

	return (
		<>
			{planesData.current.map((plane, i) => {
				const texture = textures[plane.imageIndex];
				const material = materials[i];

				if (!texture || !material) return null;

				const worldZ = plane.z - depthRange / 2;

				// Calculate scale to maintain aspect ratio (handle both images and videos)
				let aspect = 1;
				if (texture.image) {
					// For videos, use videoWidth/videoHeight; for images use width/height
					const width = texture.image.videoWidth || texture.image.width || 1;
					const height = texture.image.videoHeight || texture.image.height || 1;
					aspect = width / height;
				}
				const scale: [number, number, number] =
					aspect > 1 ? [2 * aspect, 2, 1] : [2, 2 / aspect, 1];

				return (
					<ImagePlane
						key={plane.index}
						texture={texture}
						position={[plane.x, plane.y, worldZ]} // Position planes relative to camera center
						scale={scale}
						material={material}
					/>
				);
			})}
		</>
	);
}

// Fallback component for when WebGL is not available
function FallbackGallery({ images }: { images: MediaItem[] }) {
	const normalizedMedia = useMemo(
		() =>
			images.map((img) => {
				const src = typeof img === 'string' ? img : img.src;
				const alt = typeof img === 'string' ? '' : img.alt || '';
				return { src, alt, isVideo: isVideoUrl(src) };
			}),
		[images]
	);

	return (
		<div className="flex flex-col items-center justify-center h-full bg-gray-100 p-4">
			<p className="text-gray-600 mb-4">
				WebGL not supported. Showing media list:
			</p>
			<div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
				{normalizedMedia.map((media, i) =>
					media.isVideo ? (
						<video
							key={i}
							src={media.src}
							className="w-full h-32 object-cover rounded"
							muted
							loop
							autoPlay
							playsInline
						/>
					) : (
						<img
							key={i}
							src={media.src || '/placeholder.svg'}
							alt={media.alt}
							className="w-full h-32 object-cover rounded"
						/>
					)
				)}
			</div>
		</div>
	);
}

export default function InfiniteGallery({
	images,
	speed,
	zSpacing,
	visibleCount,
	falloff,
	className = 'h-96 w-full',
	style,
	fadeSettings = {
		fadeIn: { start: 0.05, end: 0.25 },
		fadeOut: { start: 0.4, end: 0.43 },
	},
	blurSettings = {
		blurIn: { start: 0.0, end: 0.1 },
		blurOut: { start: 0.4, end: 0.43 },
		maxBlur: 8.0,
	},
}: InfiniteGalleryProps) {
	const [webglSupported, setWebglSupported] = useState(true);

	useEffect(() => {
		// Check WebGL support
		try {
			const canvas = document.createElement('canvas');
			const gl =
				canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
			if (!gl) {
				setWebglSupported(false);
			}
		} catch (e) {
			setWebglSupported(false);
		}
	}, []);

	if (!webglSupported) {
		return (
			<div className={className} style={style}>
				<FallbackGallery images={images} />
			</div>
		);
	}

	return (
		<div className={className} style={style}>
			<Canvas
				camera={{ position: [0, 0, 0], fov: 55 }}
				gl={{ antialias: true, alpha: true }}
			>
				<Suspense fallback={null}>
					<GalleryScene
						images={images}
						speed={speed}
						visibleCount={visibleCount}
						fadeSettings={fadeSettings}
						blurSettings={blurSettings}
					/>
				</Suspense>
			</Canvas>
		</div>
	);
}
