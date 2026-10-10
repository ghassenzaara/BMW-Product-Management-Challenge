"use client";

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { getZone, type CarModel, type Zone, type ZoneId } from "@/lib/car/zones";
import { cn } from "@/lib/utils";

export interface Hotspot {
  zone: ZoneId;
  count: number;
}

interface Props {
  model: CarModel;
  /** Zone to fly to and light up; null shows the whole car. */
  active: ZoneId | null;
  hotspots: Hotspot[];
  onPick: (zone: ZoneId) => void;
  /** Pixels on the right covered by an overlay; the view shifts left so the zone stays visible. */
  insetRight?: number;
}

const HIGHLIGHT = new THREE.Color("#ff6a1f");
const PAINT = new THREE.Color("#aeb6c2");

/** Uniforms shared by every material of the car, so one update moves the highlight on all meshes. */
function makeUniforms() {
  return {
    uZoneCenter: { value: new THREE.Vector3() },
    uZoneRadius: { value: new THREE.Vector3(1, 1, 1) },
    uGlow: { value: 0 },
    uXray: { value: 0 },
    uTime: { value: 0 },
    uColor: { value: HIGHLIGHT },
  };
}
type Uniforms = ReturnType<typeof makeUniforms>;

/**
 * The models are merged shells, so a part cannot be selected as a mesh.
 * Instead every fragment inside the zone's ellipsoid is tinted and glows,
 * and the rest of the body can fade to a see-through shell.
 */
function patchMaterial(material: THREE.MeshStandardMaterial, uniforms: Uniforms) {
  material.side = THREE.DoubleSide;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vZonePos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvZonePos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vZonePos;\nuniform vec3 uZoneCenter;\nuniform vec3 uZoneRadius;\nuniform float uGlow;\nuniform float uXray;\nuniform float uTime;\nuniform vec3 uColor;",
      )
      .replace(
        "#include <color_fragment>",
        // The i5 file stacks a dark and a light copy of each window in the same place; the dark one is nudged forward so they stop flickering.
        "#include <color_fragment>\n#ifdef USE_COLOR\ngl_FragDepth = gl_FragCoord.z - (1.0 - dot(vColor.rgb, vec3(0.333))) * 0.00003;\n#endif\nfloat zoneHit = (1.0 - smoothstep(0.55, 1.0, length((vZonePos - uZoneCenter) / uZoneRadius))) * uGlow;\ndiffuseColor.rgb = mix(diffuseColor.rgb, uColor, zoneHit * 0.85);",
      )
      .replace(
        "#include <normal_fragment_maps>",
        "#include <normal_fragment_maps>\nfloat rim = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.0);\ndiffuseColor.a = mix(diffuseColor.a, mix(0.05, 0.5, rim), uXray);\ndiffuseColor.a = mix(diffuseColor.a, 0.92, zoneHit);",
      )
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\ntotalEmissiveRadiance += uColor * zoneHit * (0.75 + 0.25 * sin(uTime * 3.0));",
      );
  };
  material.needsUpdate = true;
}

interface Frame {
  length: number;
  height: number;
  width: number;
}

/** Normalised zone coordinates to metres. The car's front points to +X, the roof to +Y, the right side to +Z. */
function zoneToWorld(zone: Zone, f: Frame) {
  const [u, v, w] = zone.center;
  const [ru, rv, rw] = zone.radius;
  return {
    center: new THREE.Vector3(f.length / 2 - u * f.length, v * f.height, (w * f.width) / 2),
    radius: new THREE.Vector3(ru * f.length, rv * f.height, (rw * f.width) / 2),
  };
}

function cameraFor(zone: Zone | null, f: Frame) {
  if (!zone) {
    const target = new THREE.Vector3(0, f.height * 0.45, 0);
    return { target, position: target.clone().add(new THREE.Vector3(0.62, 0.3, -0.72).normalize().multiplyScalar(f.length * 1.45)) };
  }
  const { center } = zoneToWorld(zone, f);
  const az = THREE.MathUtils.degToRad(zone.view.azimuth);
  const el = THREE.MathUtils.degToRad(zone.view.elevation);
  const dir = new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), -Math.sin(az) * Math.cos(el));
  return { target: center, position: center.clone().add(dir.multiplyScalar(zone.view.distance * f.length)) };
}

/** The file's own axes and size are unknown, so the car is turned, scaled to its real length and put on the ground. */
function buildRig(source: THREE.Object3D, model: CarModel) {
  const uniforms = makeUniforms();
  const scene = source.clone(true);
  // Longest side = length, shortest = height; the model config says which end is the front and which is the roof.
  const raw = new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3()).toArray();
  const [lengthAxis, , heightAxis] = [0, 1, 2].sort((a, b) => raw[b] - raw[a]);
  const front = new THREE.Vector3().setComponent(lengthAxis, model.flipFront ? -1 : 1);
  const up = new THREE.Vector3().setComponent(heightAxis, model.flipUp ? -1 : 1);
  const right = new THREE.Vector3().crossVectors(front, up);
  const turned = new THREE.Group();
  turned.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(front, up, right).transpose());
  turned.add(scene);
  turned.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(turned);
  const size = box.getSize(new THREE.Vector3());
  const mid = box.getCenter(new THREE.Vector3());
  const scale = model.length / size.x;
  const root = new THREE.Group();
  turned.position.set(-mid.x, -box.min.y, -mid.z);
  root.add(turned);
  root.scale.setScalar(scale);

  const materials: THREE.MeshStandardMaterial[] = [];
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const own = (mesh.material as THREE.MeshStandardMaterial).clone();
    if (model.repaint) {
      own.color = PAINT.clone();
      own.metalness = 0.55;
      own.roughness = 0.38;
      // This file's stored normals and triangle winding are unreliable; per-face shading ignores both.
      own.flatShading = true;
    }
    patchMaterial(own, uniforms);
    mesh.material = own;
    materials.push(own);
  });
  const frame: Frame = { length: size.x * scale, height: size.y * scale, width: size.z * scale };
  return { root, materials, uniforms, frame };
}

const projected = new THREE.Vector3();

function Car({ model, active, hotspots, insetRight, place, onReady }: Props & { place: (zone: ZoneId, x: number, y: number) => void; onReady: () => void }) {
  const gltf = useGLTF(model.file, false, true);
  const controls = useRef<OrbitControlsImpl>(null);
  const flying = useRef(true);
  const goal = useRef({ position: new THREE.Vector3(), target: new THREE.Vector3() });
  const camera = useThree((s) => s.camera);

  const rig = useMemo(() => buildRig(gltf.scene, model), [gltf, model]);
  const { root, frame } = rig;
  // three.js objects are changed in place every frame; the ref keeps those writes out of React's render data.
  const live = useRef(rig);

  const zone = active ? getZone(active, model.body) : null;
  const xray = !!zone?.interior;

  useLayoutEffect(() => {
    live.current = rig;
    for (const m of live.current.materials) {
      m.transparent = xray;
      m.depthWrite = !xray;
    }
  }, [rig, xray]);

  useEffect(() => {
    const next = active ? getZone(active, model.body) : null;
    goal.current = cameraFor(next, rig.frame);
    flying.current = true;
    if (next) {
      const world = zoneToWorld(next, rig.frame);
      live.current.uniforms.uZoneCenter.value.copy(world.center);
      live.current.uniforms.uZoneRadius.value.copy(world.radius);
    }
  }, [active, model, rig]);

  useEffect(onReady, [onReady, rig]);

  const size = useThree((s) => s.size);
  useEffect(() => {
    const view = camera as THREE.PerspectiveCamera;
    if (insetRight) view.setViewOffset(size.width, size.height, insetRight / 2, 0, size.width, size.height);
    else view.clearViewOffset();
  }, [camera, size, insetRight]);

  useFrame((state, dt) => {
    const k = 1 - Math.exp(-dt * 4);
    const u = live.current.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    u.uGlow.value = THREE.MathUtils.lerp(u.uGlow.value, zone ? 1 : 0, k);
    u.uXray.value = THREE.MathUtils.lerp(u.uXray.value, xray ? 1 : 0, k);
    if (flying.current && controls.current) {
      camera.position.lerp(goal.current.position, k);
      controls.current.target.lerp(goal.current.target, k);
      controls.current.update();
      if (camera.position.distanceTo(goal.current.position) < 0.02) flying.current = false;
    }
    for (const h of hotspots) {
      projected.copy(zoneToWorld(getZone(h.zone, model.body), live.current.frame).center).project(camera);
      place(h.zone, (projected.x * 0.5 + 0.5) * state.size.width, (-projected.y * 0.5 + 0.5) * state.size.height);
    }
  });


  return (
    <>
      <primitive object={root} />
      {zone && <ZoneMarker zone={zone} frame={frame} />}
      <ContactShadows position={[0, 0.001, 0]} scale={frame.length * 2} far={2} blur={2.4} opacity={0.55} />
      <OrbitControls
        ref={controls}
        enablePan={false}
        minDistance={frame.length * 0.45}
        maxDistance={frame.length * 2.4}
        maxPolarAngle={Math.PI / 2 - 0.03}
        onStart={() => (flying.current = false)}
      />
    </>
  );
}

/** A soft glowing volume at the zone, visible through the see-through body when the model has no interior there. */
function ZoneMarker({ zone, frame }: { zone: Zone; frame: Frame }) {
  const { center, radius } = zoneToWorld(zone, frame);
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (mesh.current) (mesh.current.material as THREE.MeshBasicMaterial).opacity = (zone.interior ? 0.2 : 0.07) + 0.05 * Math.sin(s.clock.elapsedTime * 3);
  });
  return (
    <mesh ref={mesh} position={center} scale={radius.clone().multiplyScalar(0.8)} renderOrder={2}>
      <sphereGeometry args={[1, 32, 20]} />
      <meshBasicMaterial color={HIGHLIGHT} transparent opacity={0.15} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

export default function CarScene(props: Props) {
  const { model, active, hotspots, onPick } = props;
  const dots = useRef(new Map<ZoneId, HTMLElement>());
  const [loaded, setLoaded] = useState<string | null>(null);
  const key = model.file + model.length;
  const place = (zone: ZoneId, x: number, y: number) => {
    const el = dots.current.get(zone);
    if (el) el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  };
  return (
    <div className="absolute inset-0">
      <Canvas camera={{ position: [6, 3, -7], fov: 32, near: 0.1, far: 80 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
        <hemisphereLight args={["#ffffff", "#30384a", 0.9]} />
        <directionalLight position={[5, 8, 4]} intensity={1.6} />
        <directionalLight position={[-6, 4, -5]} intensity={0.6} />
        {/* Studio lighting built in code: no HDR download, so the demo also runs offline. */}
        <Environment resolution={256}>
          <Lightformer form="rect" intensity={3} position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[12, 5, 1]} />
          <Lightformer form="rect" intensity={1.6} position={[7, 2, 3]} rotation={[0, -Math.PI / 2, 0]} scale={[8, 3, 1]} />
          <Lightformer form="rect" intensity={1.2} position={[-7, 2, -3]} rotation={[0, Math.PI / 2, 0]} scale={[8, 3, 1]} />
          <Lightformer form="rect" intensity={0.9} position={[0, 2, -8]} scale={[10, 3, 1]} />
        </Environment>
        <Suspense fallback={null}>
          <Car key={key} {...props} place={place} onReady={() => setLoaded(key)} />
        </Suspense>
      </Canvas>
      {/* Markers are plain DOM placed over the canvas; the scene moves them every frame. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {loaded === key &&
          hotspots.map((h) => (
            <button
              key={h.zone}
              type="button"
              ref={(el) => {
                if (el) dots.current.set(h.zone, el);
                else dots.current.delete(h.zone);
              }}
              onClick={() => onPick(h.zone)}
              title={getZone(h.zone, model.body).label}
              style={{ transform: "translate(-999px, -999px)" }}
              className={cn(
                "pointer-events-auto absolute top-0 left-0 -mt-3 -ml-3 flex size-6 items-center justify-center rounded-full border text-[11px] font-semibold text-white tabular-nums shadow-md transition-colors",
                h.zone === active ? "border-white bg-orange-500" : "border-white/50 bg-slate-900/70 backdrop-blur-sm hover:bg-orange-500",
              )}
            >
              {h.count}
            </button>
          ))}
        {loaded !== key && <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md bg-slate-900/70 px-3 py-1.5 text-xs text-white">Loading 3D model…</span>}
      </div>
    </div>
  );
}