"use client";

import { useEffect, useRef } from "react";

function sparkMap(THREE: typeof import("three")) {
  const s = 64;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d");
  if (!g) return null;
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, "rgba(255,246,208,1)");
  grd.addColorStop(0.28, "rgba(255,246,208,0.55)");
  grd.addColorStop(1, "rgba(255,246,208,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

/** Soft round stars. Occasional gold glint, ~1s, then gone. */
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
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);

      const map = sparkMap(THREE);
      const count = 400;
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 28;
        pos[i * 3 + 1] = (Math.random() - 0.5) * 18;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 12;
      }
      const dots = new THREE.BufferGeometry();
      dots.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const starMat = new THREE.PointsMaterial({
        color: 0xd4a017,
        size: 0.14,
        map: map ?? undefined,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      });
      const points = new THREE.Points(dots, starMat);
      scene.add(points);

      const glintPos = new Float32Array(3);
      const glintGeo = new THREE.BufferGeometry();
      glintGeo.setAttribute("position", new THREE.BufferAttribute(glintPos, 3));
      const glintMat = new THREE.PointsMaterial({
        color: 0xfff6d0,
        size: 0.35,
        map: map ?? undefined,
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
          until = t + 700 + Math.random() * 500;
          next = t + 3500 + Math.random() * 9000;
        }
        if (t < until) {
          const envelope = Math.sin(((t - start) / (until - start)) * Math.PI);
          glintMat.opacity = envelope * 0.9;
          glintMat.size = 0.22 + envelope * 0.7;
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
        map?.dispose();
        starMat.dispose();
        glintMat.dispose();
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
