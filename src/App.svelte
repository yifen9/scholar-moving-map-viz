<script lang="ts">
  import { onMount } from "svelte";
  import { loadDataset, type Dataset } from "./lib/data";
  import { MapScene } from "./lib/scene";
  import { ui } from "./lib/store.svelte";
  import Controls from "./components/Controls.svelte";
  import Search from "./components/Search.svelte";
  import Detail from "./components/Detail.svelte";
  import Legend from "./components/Legend.svelte";
  import About from "./components/About.svelte";

  let canvas3d: HTMLCanvasElement;
  let canvas2d: HTMLCanvasElement;
  let data: Dataset | null = $state(null);
  let scene3d: MapScene | null = null;
  let scene2d: MapScene | null = null;
  let error = $state("");

  const pick = (index: number) => {
    ui.selected = index;
  };

  onMount(() => {
    let frame = 0;
    let last = performance.now();
    let direction = 1;
    (async () => {
      try {
        data = await loadDataset(`${import.meta.env.BASE_URL}data/`);
      } catch (event) {
        error = String(event);
        return;
      }
      scene3d = new MapScene(canvas3d, { flat: false, data, onPick: pick });
      scene2d = new MapScene(canvas2d, { flat: true, data, onPick: pick });
      ui.loaded = true;

      const loop = (now: number) => {
        const dt = (now - last) / 1000;
        last = now;
        if (ui.playing) {
          let t = ui.t + direction * dt * ui.playSpeed;
          if (t > 3) {
            t = 3;
            direction = -1;
          }
          if (t < 0) {
            t = 0;
            direction = 1;
          }
          ui.t = t;
        }
        for (const scene of [scene3d, scene2d]) {
          if (!scene) continue;
          scene.apply(ui.t, ui.singleRun, ui.halo, ui.haloScale, ui.pointScale);
          scene.updateSelection(ui.selected, ui.t, ui.singleRun);
          scene.render();
        }
        frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);

    })();
    return () => cancelAnimationFrame(frame);
  });

  $effect(() => {
    if (!ui.loaded) return;
    const mode = ui.colorBy;
    scene3d?.setColors(mode);
    scene2d?.setColors(mode);
  });

  $effect(() => {
    if (!ui.loaded) return;
    const threshold = ui.minExposureLog;
    scene3d?.setVisibility(threshold);
    scene2d?.setVisibility(threshold);
  });

  $effect(() => {
    if (!ui.loaded) return;
    const on = ui.trails;
    scene3d?.setMoverTrails(on);
    scene2d?.setMoverTrails(on);
  });

  $effect(() => {
    if (!ui.loaded || ui.selected < 0) return;
    scene3d?.focusOn(ui.selected);
  });

</script>

<div class="h-screen w-screen bg-[#0d0d0d] text-white flex overflow-hidden font-sans">
  <div class="relative flex-1 min-w-0">
    <canvas bind:this={canvas3d} class="h-full w-full block cursor-crosshair"></canvas>

    {#if ui.view2d}
      <div class="hidden sm:block absolute bottom-4 left-4 w-[300px] h-[240px] rounded-lg overflow-hidden border border-white/10 bg-[#0d0d0d]/80">
        <div class="absolute top-1.5 left-2 z-10 text-[10px] uppercase tracking-wider text-[#898781]">
          top view · PC1 × PC2
        </div>
        <canvas bind:this={canvas2d} class="h-full w-full block"></canvas>
      </div>
    {/if}

    {#if !ui.loaded && !error}
      <div class="absolute inset-0 grid place-items-center text-[#898781] text-sm">loading 30,895 institutions…</div>
    {/if}
    {#if error}
      <div class="absolute inset-0 grid place-items-center text-red-400 text-sm">{error}</div>
    {/if}

    {#if data}
      <div class="absolute top-4 left-4 pointer-events-none select-none">
        <h1 class="text-lg font-semibold tracking-tight">A Moving Map of Science</h1>
        <p class="text-xs text-[#c3c2b7] max-w-[360px] mt-1">
          30,895 research institutions placed by who exchanges researchers with whom,
          2008–2019 in four steps. Blur is measured uncertainty, not style.
        </p>
      </div>
      <Legend />
    {/if}
  </div>

  {#if data}
    <aside class="w-[340px] shrink-0 h-full overflow-y-auto bg-[#1a1a19] border-l border-white/10 p-4 flex flex-col gap-4">
      <Search {data} />
      <Controls {data} />
      <Detail {data} />
      <div class="mt-auto pt-3 border-t border-white/10 text-[11px] text-[#898781] leading-relaxed">
        <button class="underline hover:text-white" onclick={() => (ui.aboutOpen = true)}>about this map</button>
        <div class="mt-1">Yifeng Li · <a class="hover:text-white" href="https://yifen9.li">yifen9.li</a></div>
      </div>
    </aside>
  {/if}

  <About />
</div>
