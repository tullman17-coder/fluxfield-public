"use client";

import { useEffect, useRef } from "react";

/** Star field. Occasional gold glint, ~1s, then gone. */
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

      const glintPos = new Float32Array(3);
      const glintGeo = new THREE.BufferGeometry();
      glintGeo.setAttribute("position", new THREE.BufferAttribute(glintPos, 3));
      const glintMat = new THREE.PointsMaterial({
        color: 0xfff6d0,
        size: 0.2,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      });
      const glint = new THREE.Points(glintGeo, glintMat);
      points.add(glint);

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
      let next = 2500 + Math.random() * 6000;
      let start = 0;
      let until = 0;
      const tick = (t: number) => {
        points.rotation.y = t * 0.000042;
        if (t >= next) {
          const i = Math.floor(Math.random() * count);
          glintPos[0] = pos[i * 3];
          glintPos[1] = pos[i * 3 + 1];
          glintPos[2] = pos[i * 3 + 2];
          glintGeo.attributes.position.needsUpdate = true;
          start = t;
          until = t + 600 + Math.random() * 500;
          next = t + 3500 + Math.random() * 9000;
        }
        if (t < until) {
          const envelope = Math.sin(((t - start) / (until - start)) * Math.PI);
          glintMat.opacity = envelope * 0.95;
          glintMat.size = 0.12 + envelope * 0.55;
        } else {
          glintMat.opacity = 0;
        }
        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);

      dispose = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", onResize);
        dots.dispose();
        glintGeo.dispose();
        (points.material as { dispose: () => void }).dispose();
        (glint.material as { dispose: () => void }).dispose();
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
