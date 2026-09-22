"use client";

import { useEffect, useRef } from "react";

/** Higgsfield-style field: gold/crimson particles + ribbons. CSS blobs stay if WebGL dies. */
export function FieldBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let dead = false;
    let dispose = () => undefined;
    void import("three").then((THREE) => {
      if (dead || !ref.current) return;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 80);
      camera.position.z = 18;
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      renderer.setClearColor(0x000000, 0);

      const ribbons = [0xd4a017, 0x8b0000, 0xc4957d].map((color, i) => {
        const pts = Array.from({ length: 12 }, (_, n) => {
          const t = n / 11;
          return new THREE.Vector3(
            Math.sin(t * Math.PI * 2 + i) * (8 + i),
            Math.cos(t * Math.PI * 3 + i * 0.7) * 4,
            Math.sin(t * Math.PI + i) * 3,
          );
        });
        const mesh = new THREE.Mesh(
          new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.08, 6, false),
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.28,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        );
        scene.add(mesh);
        return mesh;
      });

      const count = 400;
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 28;
        pos[i * 3 + 1] = (Math.random() - 0.5) * 18;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 12;
      }
      const dots = new THREE.BufferGeometry();
      dots.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const points = new THREE.Points(
        dots,
        new THREE.PointsMaterial({ color: 0xd4a017, size: 0.06, transparent: true, opacity: 0.45 }),
      );
      scene.add(points);

      const fit = () => {
        const w = canvas.clientWidth || window.innerWidth;
        const h = canvas.clientHeight || window.innerHeight;
        camera.aspect = w / Math.max(h, 1);
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      };
      fit();
      const onResize = () => fit();
      window.addEventListener("resize", onResize);

      let raf = 0;
      const tick = (t: number) => {
        const s = t * 0.00012;
        ribbons.forEach((m, i) => {
          m.rotation.y = s * (0.6 + i * 0.2);
          m.rotation.x = s * 0.25;
        });
        points.rotation.y = s * 0.35;
        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);

      dispose = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", onResize);
        dots.dispose();
        ribbons.forEach((m) => {
          m.geometry.dispose();
          (m.material as { dispose: () => void }).dispose();
        });
        (points.material as { dispose: () => void }).dispose();
        renderer.dispose();
      };
    });

    return () => {
      dead = true;
      dispose();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    />
  );
}
