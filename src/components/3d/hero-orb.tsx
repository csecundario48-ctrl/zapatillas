'use client'

import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { MeshDistortMaterial, Float, Stars } from '@react-three/drei'
import * as THREE from 'three'

// Particle cloud positions — computed once at module load (not during render).
const PARTICLE_POSITIONS = (() => {
  const count = 120
  const arr = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const r = 2.5 + Math.random() * 1.2
    arr[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
    arr[i * 3 + 2] = r * Math.cos(phi)
  }
  return arr
})()

function DistortSphere() {
  const meshRef = useRef<THREE.Mesh>(null!)
  useFrame((_, delta) => {
    meshRef.current.rotation.x += delta * 0.12
    meshRef.current.rotation.y += delta * 0.18
  })
  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1.1, 64, 64]} />
      <MeshDistortMaterial
        color="#6366f1"
        emissive="#4338ca"
        emissiveIntensity={0.4}
        roughness={0.1}
        metalness={0.8}
        distort={0.45}
        speed={2}
        transparent
        opacity={0.85}
      />
    </mesh>
  )
}

function Ring() {
  const ref = useRef<THREE.Mesh>(null!)
  useFrame((_, delta) => {
    ref.current.rotation.x += delta * 0.3
    ref.current.rotation.z += delta * 0.15
  })
  return (
    <mesh ref={ref}>
      <torusGeometry args={[1.7, 0.02, 16, 120]} />
      <meshBasicMaterial color="#a78bfa" transparent opacity={0.5} />
    </mesh>
  )
}

function Ring2() {
  const ref = useRef<THREE.Mesh>(null!)
  useFrame((_, delta) => {
    ref.current.rotation.y += delta * 0.2
    ref.current.rotation.z -= delta * 0.1
  })
  return (
    <mesh ref={ref} rotation={[Math.PI / 3, 0, 0]}>
      <torusGeometry args={[2.1, 0.015, 16, 120]} />
      <meshBasicMaterial color="#6366f1" transparent opacity={0.25} />
    </mesh>
  )
}

function Particles() {
  const ref = useRef<THREE.Points>(null!)
  useFrame((_, delta) => {
    ref.current.rotation.y += delta * 0.05
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute args={[PARTICLE_POSITIONS, 3]} attach="attributes-position" />
      </bufferGeometry>
      <pointsMaterial color="#6366f1" size={0.04} transparent opacity={0.6} />
    </points>
  )
}

export function HeroOrb() {
  return (
    <div className="w-full h-full">
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <ambientLight intensity={0.2} />
        <pointLight position={[5, 5, 5]} intensity={1.5} color="#6366f1" />
        <pointLight position={[-5, -3, -3]} intensity={0.8} color="#a78bfa" />
        <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.8}>
          <DistortSphere />
          <Ring />
          <Ring2 />
        </Float>
        <Particles />
        <Stars radius={50} depth={30} count={800} factor={2} saturation={0} fade speed={0.5} />
      </Canvas>
    </div>
  )
}
