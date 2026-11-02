import { useEffect, useRef } from 'react';

// Original woven surface: a small Three.js study connecting the developer page to Interlace.
// Loaded on demand, with explicit disposal and offscreen / reduced-motion handling.
export function EngineeringScene({ paused, light }) {
  const host = useRef(null);
  const options = useRef({ paused, light });
  useEffect(() => { options.current = { paused, light }; }, [paused, light]);
  useEffect(() => {
    let disposed = false, cleanup = () => {};
    import('three').then(T => {
      if (disposed) return;
      const el = host.current;
      let renderer;
      try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); }
      catch { el.dataset.fallback = 'true'; return; }
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      renderer.setClearColor(0, 0);
      el.appendChild(renderer.domElement);
      const scene = new T.Scene(), camera = new T.PerspectiveCamera(38, 1, .1, 100);
      camera.position.z = 12;
      const group = new T.Group(); scene.add(group);
      const geometry = new T.TorusKnotGeometry(2.05, .64, 220, 22, 2, 3);
      const material = new T.MeshStandardMaterial({ color: '#367b81', metalness: .64, roughness: .4 });
      const surface = new T.Mesh(geometry, material); group.add(surface);
      const wireMaterial = new T.MeshBasicMaterial({ color: '#b6efe4', wireframe: true, transparent: true, opacity: .16 });
      group.add(new T.Mesh(geometry, wireMaterial));
      group.rotation.set(.35, -.5, -.35);
      scene.add(new T.AmbientLight('#e6e5df', 1.6));
      const key = new T.DirectionalLight('#d6ffff', 4); key.position.set(4, 5, 6); scene.add(key);
      const rim = new T.DirectionalLight('#fea172', 3); rim.position.set(-4, -1, 2); scene.add(rim);
      let frame, visible = true, target = { x: 0, y: 0 }, last = 0, rotation = 0;
      const reduced = matchMedia('(prefers-reduced-motion: reduce)');
      const resize = () => { if (!el.clientWidth || !el.clientHeight) return; renderer.setSize(el.clientWidth, el.clientHeight); camera.aspect = el.clientWidth / el.clientHeight; camera.updateProjectionMatrix(); renderer.render(scene, camera); };
      const observer = new ResizeObserver(resize); observer.observe(el);
      const viewport = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; }); viewport.observe(el);
      const move = e => { const r = el.getBoundingClientRect(); target = { x: (e.clientX - r.left) / r.width - .5, y: (e.clientY - r.top) / r.height - .5 }; };
      el.addEventListener('pointermove', move);
      let previousLight;
      const render = now => {
        frame = requestAnimationFrame(render);
        const dt = Math.min((now - last) / 1000, .05);
        if (now - last < 1000 / 30) return;
        last = now;
        if (!visible || document.hidden) return;
        const changed = previousLight !== options.current.light;
        if (changed) { previousLight = options.current.light; material.color.set(previousLight ? '#4a7d80' : '#367b81'); }
        if (!options.current.paused && !reduced.matches) {
          rotation += dt * .065;
          group.rotation.y += (-.5 + target.x * .3 + rotation - group.rotation.y) * .035;
          group.rotation.x += (.35 + target.y * .25 - group.rotation.x) * .035;
          group.rotation.z = -.35 + Math.sin(rotation * .7) * .12;
        } else if (!changed && el.dataset.ready) return;
        renderer.render(scene, camera); el.dataset.ready = 'true';
      };
      resize(); frame = requestAnimationFrame(render);
      const lost = e => { e.preventDefault(); el.dataset.fallback = 'true'; cancelAnimationFrame(frame); };
      renderer.domElement.addEventListener('webglcontextlost', lost);
      cleanup = () => { cancelAnimationFrame(frame); observer.disconnect(); viewport.disconnect(); el.removeEventListener('pointermove', move); renderer.domElement.removeEventListener('webglcontextlost', lost); geometry.dispose(); material.dispose(); wireMaterial.dispose(); renderer.dispose(); renderer.domElement.remove(); };
    }).catch(() => { if (host.current) host.current.dataset.fallback = 'true'; });
    return () => { disposed = true; cleanup(); };
  }, []);
  return <div className="engineering-scene" ref={host} aria-hidden="true"><svg className="scene-fallback" viewBox="0 0 600 600"><g fill="none" stroke="currentColor">{Array.from({length: 22}, (_, i) => <ellipse key={i} cx="300" cy="300" rx={180} ry={70+i*3} transform={`rotate(${i*8} 300 300)`} />)}</g></svg></div>;
}
