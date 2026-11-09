'use client';
// The hero's 3D scene (React Three Fiber): a glass "device" showing the SaveMyGrade dashboard,
// floating UI cards at different depths, orbit rings and sparkles, bloom glow and per-card depth of field.
// Drag to rotate with inertia, "spin 360°" button, mouse parallax and scroll-driven tilt.
import * as THREE from 'three';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Float, Lightformer, RoundedBox, Sparkles } from '@react-three/drei';
import gsap from 'gsap';
import { CARDS, drawBack, drawDashboard, radialGlow } from './textures';
import { useCanvasTexture } from './useCanvasTexture';
import { track } from '@/lib/site';

const REST = -0.34;
const TAU = Math.PI * 2;

function GlowPlane() {
  const { texture } = useCanvasTexture(512, 512, radialGlow);
  const ref = useRef();
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (ref.current) ref.current.material.opacity = 0.8 + Math.sin(t * 0.9) * 0.12;
  });
  return (
    <mesh ref={ref} position={[0, 0, -2.2]} renderOrder={-1}>
      <planeGeometry args={[14, 10]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function Rings() {
  const a = useRef();
  const b = useRef();
  useFrame((_, dt) => {
    if (a.current) a.current.rotation.z += dt * 0.07;
    if (b.current) b.current.rotation.z -= dt * 0.045;
  });
  return (
    <group position={[0, -0.2, -1.4]} rotation={[1.2, 0, 0.12]}>
      <mesh ref={a}>
        <torusGeometry args={[3.95, 0.009, 8, 220]} />
        <meshBasicMaterial color="#3E6B5C" toneMapped={false} transparent opacity={0.55} />
      </mesh>
      <mesh ref={b} scale={1.11}>
        <torusGeometry args={[3.95, 0.006, 8, 220]} />
        <meshBasicMaterial color="#B8862F" toneMapped={false} transparent opacity={0.55} />
      </mesh>
    </group>
  );
}

function Device() {
  const screen = useCanvasTexture(2048, 1300, drawDashboard);
  const back = useCanvasTexture(2048, 1300, drawBack);
  return (
    <group>
      <RoundedBox args={[5.92, 3.86, 0.14]} radius={0.09} smoothness={5}>
        <meshPhysicalMaterial color="#17302A" metalness={0.55} roughness={0.26} clearcoat={1} clearcoatRoughness={0.12} envMapIntensity={1.4} />
      </RoundedBox>
      <mesh position={[0, 0, 0.0715]}>
        <planeGeometry args={[5.62, 3.567]} />
        <meshBasicMaterial map={screen.texture} transparent toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, -0.0715]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[5.62, 3.567]} />
        <meshBasicMaterial map={back.texture} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

const PAD = 36;
function Card({ spec, focusRef, i }) {
  const tex = useCanvasTexture(spec.w, spec.h, spec.draw, { blur: 14, pad: PAD });
  const ref = useRef();
  const sharp = useRef();
  const soft = useRef();
  const v = useMemo(() => new THREE.Vector3(), []);
  const h = (spec.width * spec.h) / spec.w;
  const k = (spec.w + PAD * 2) / spec.w;
  useFrame(({ camera }) => {
    if (!ref.current || !sharp.current || !soft.current) return;
    ref.current.getWorldPosition(v);
    const d = v.distanceTo(camera.position);
    const x = Math.min(1, Math.max(0, (Math.abs(d - focusRef.current) - 0.9) / 2.2));
    const b = x * x * (3 - 2 * x);
    sharp.current.opacity = 1 - b * 0.92;
    soft.current.opacity = b * 0.95;
  });
  return (
    <Float speed={1.2 + i * 0.15} rotationIntensity={0.22} floatIntensity={0.55} floatingRange={[-0.08, 0.08]}>
      <group ref={ref} position={spec.pos}>
        <mesh renderOrder={2}>
          <planeGeometry args={[spec.width, h]} />
          <meshBasicMaterial ref={sharp} map={tex.texture} transparent depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh renderOrder={3} position={[0, 0, 0.002]}>
          <planeGeometry args={[spec.width * k, h * ((spec.h + PAD * 2) / spec.h)]} />
          <meshBasicMaterial ref={soft} map={tex.blurred} transparent depthWrite={false} toneMapped={false} opacity={0} />
        </mesh>
      </group>
    </Float>
  );
}

function Rig({ ctl, scrollRef, focusRef, reduce, children }) {
  const g = useRef();
  const { viewport, camera } = useThree();
  const base = Math.min(1, viewport.width / (viewport.width < 7.5 ? 7.4 : 8.7));
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, delta) => {
    const s = ctl.current;
    const dt = Math.min(delta, 0.05);
    const now = performance.now() / 1000;
    if (!s.drag && !s.spinning) {
      s.target += s.vy * dt;
      s.vy *= Math.pow(0.06, dt);
      if (Math.abs(s.vy) < 0.12 && now - s.last > 2.4) {
        const rest = REST + (reduce ? 0 : Math.sin(now * 0.38) * 0.16);
        const goal = rest + Math.round((s.target - rest) / TAU) * TAU;
        s.target += (goal - s.target) * (1 - Math.pow(0.35, dt));
      }
    }
    s.ry += (s.target - s.ry) * (1 - Math.pow(s.drag ? 1e-6 : 0.004, dt));
    s.px += (s.mx - s.px) * (1 - Math.pow(0.02, dt));
    s.py += (s.my - s.py) * (1 - Math.pow(0.02, dt));
    const sc = scrollRef.current || 0;
    const o = g.current;
    if (!o) return;
    o.rotation.y = s.ry + s.px * 0.2;
    o.rotation.x = 0.06 + s.py * 0.12 + sc * 0.5;
    o.rotation.z = -0.025 - s.px * 0.025;
    o.position.y = -sc * 1.3 + (reduce ? 0 : Math.sin(now * 0.8) * 0.05);
    o.scale.setScalar(base * (1 - sc * 0.12));
    o.getWorldPosition(v);
    focusRef.current = v.distanceTo(camera.position);
  });
  return <group ref={g}>{children}</group>;
}

export default function HeroScene({ spinRef, scrollRef }) {
  const ctl = useRef({ ry: REST, target: REST, vy: 0, drag: false, spinning: false, last: 0, lastX: 0, lastT: 0, mx: 0, my: 0, px: 0, py: 0, dragged: false });
  const focusRef = useRef(12);
  const wrapRef = useRef(null);
  const [active, setActive] = useState(true);
  const [intro, setIntro] = useState(false);
  const [hi, setHi] = useState(true);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    setHi(window.innerWidth >= 768 && (navigator.hardwareConcurrency || 8) > 4);
    setReduce(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    setIntro(document.documentElement.classList.contains('intro'));
    const endIntro = () => setIntro(false);
    window.addEventListener('smg:intro-end', endIntro);
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { rootMargin: '120px' });
    if (wrapRef.current) io.observe(wrapRef.current);
    const move = (e) => {
      ctl.current.mx = (e.clientX / window.innerWidth) * 2 - 1;
      ctl.current.my = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('smg:intro-end', endIntro);
    };
  }, []);

  useEffect(() => {
    if (!spinRef) return;
    spinRef.current = () => {
      const s = ctl.current;
      gsap.killTweensOf(s);
      s.spinning = true;
      s.vy = 0;
      gsap.to(s, {
        target: s.target + TAU,
        duration: 1.9,
        ease: 'power3.inOut',
        onComplete: () => {
          s.spinning = false;
          s.last = performance.now() / 1000;
        },
      });
      track('lp_hero_spin');
    };
    return () => { spinRef.current = null; };
  }, [spinRef]);

  const down = (e) => {
    const s = ctl.current;
    gsap.killTweensOf(s);
    s.spinning = false;
    s.drag = true;
    s.vy = 0;
    s.lastX = e.clientX;
    s.lastT = performance.now();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (x) {}
    if (!s.dragged) { s.dragged = true; track('lp_hero_drag'); }
  };
  const moveDrag = (e) => {
    const s = ctl.current;
    if (!s.drag) return;
    const now = performance.now();
    const dx = e.clientX - s.lastX;
    const dt = Math.max(8, now - s.lastT) / 1000;
    s.target += dx * 0.0095;
    s.vy = s.vy * 0.6 + ((dx * 0.0095) / dt) * 0.4;
    s.lastX = e.clientX;
    s.lastT = now;
    s.last = now / 1000;
  };
  const up = () => {
    const s = ctl.current;
    if (performance.now() - s.lastT > 90) s.vy = 0;
    s.drag = false;
    s.last = performance.now() / 1000;
  };

  return (
    <div
      ref={wrapRef}
      className="hero-canvas absolute inset-0 cursor-grab select-none active:cursor-grabbing"
      style={{ touchAction: 'pan-y' }}
      onPointerDown={down}
      onPointerMove={moveDrag}
      onPointerUp={up}
      onPointerCancel={up}
      data-testid="hero-3d"
    >
      <Canvas
        dpr={[1, hi ? 2 : 1.5]}
        camera={{ position: [0, 0, 12], fov: 34, near: 0.1, far: 60 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        frameloop={active && !intro ? 'always' : 'never'}
      >
        <ambientLight intensity={0.6} />
        <pointLight position={[-6, 4, 5]} intensity={80} color="#F1DDA9" />
        <pointLight position={[6, -3, 4]} intensity={60} color="#3E6B5C" />
        <Environment resolution={256} frames={1}>
          <Lightformer form="rect" intensity={2.5} color="#F1DDA9" position={[-5, 2, 4]} scale={[6, 3, 1]} />
          <Lightformer form="rect" intensity={2} color="#3E6B5C" position={[5, -2, 4]} scale={[6, 3, 1]} />
          <Lightformer form="ring" intensity={2} color="#B8862F" position={[0, 5, -3]} scale={3} />
          <Lightformer form="rect" intensity={1.2} color="#ffffff" position={[0, 0, 9]} scale={[12, 12, 1]} />
        </Environment>
        <GlowPlane />
        <Rings />
        <Rig ctl={ctl} scrollRef={scrollRef} focusRef={focusRef} reduce={reduce}>
          <Device />
          {CARDS.map((c, i) => (
            <Card key={c.key} spec={c} i={i} focusRef={focusRef} />
          ))}
        </Rig>
        <Sparkles count={hi ? 90 : 40} scale={[10, 7, 5]} size={2.4} speed={reduce ? 0 : 0.35} opacity={0.8} color="#B8862F" />
      </Canvas>
    </div>
  );
}
