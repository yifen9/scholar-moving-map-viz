<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { loadDataset, loadIndex, aggregateCountries, type Dataset, type DatasetInfo } from "./lib/data";
  import { MapScene } from "./lib/scene";
  import { ui } from "./lib/store.svelte";
  import Controls from "./components/Controls.svelte";
  import Search from "./components/Search.svelte";
  import Detail from "./components/Detail.svelte";
  import Legend from "./components/Legend.svelte";
  import About from "./components/About.svelte";

  let canvas3d: HTMLCanvasElement | null = $state(null);
  let canvas2d: HTMLCanvasElement | null = $state(null);
  let labelHost: HTMLDivElement | null = $state(null);
  let yearEl: HTMLDivElement | null = $state(null);

  let datasets: DatasetInfo[] = $state([]);
  let instData: Dataset | null = $state(null);
  let countryData: Dataset | null = $state(null);
  let error = $state("");
  let scenes: { s3: MapScene; s2: MapScene } | null = null;
  let dimKey = "";

  const activeData = $derived(ui.level === "country" ? countryData : instData);
  const sceneKey = $derived(`${ui.datasetId}:${ui.level}`);

  const W = $derived(activeData ? activeData.windows.length : 2);

  const labelList = $derived.by(() => {
    const data = activeData;
    if (!data || !ui.labels) return [] as { index: number; name: string }[];
    const limit = data.level === "country" ? 40 : 25;
    const scored: { index: number; score: number }[] = [];
    for (let i = 0; i < data.n; i++) {
      let m = 0;
      for (let w = 0; w < data.windows.length; w++) m = Math.max(m, data.exposure[i * data.windows.length + w]);
      if (m >= ui.minExposureLog) scored.push({ index: i, score: m });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(({ index }) => ({ index, name: data.names[index] }));
  });

  const pick = (index: number) => {
    ui.selected = index;
  };
  const hover = (index: number, x: number, y: number) => {
    ui.hovered = index;
    ui.hoverX = x;
    ui.hoverY = y;
  };

  async function switchDataset(id: string) {
    try {
      const base = `${import.meta.env.BASE_URL}data/`;
      const data = await loadDataset(base, id);
      instData = data;
      countryData = aggregateCountries(data);
      ui.datasetId = id;
      ui.selected = -1;
      ui.hovered = -1;
      ui.t = Math.min(ui.t, data.windows.length - 1);
      ui.loaded = true;
      if (import.meta.env.DEV) {
        (window as any).__mm = { ui, get scenes() { return scenes; }, get data() { return activeData; } };
      }
    } catch (event) {
      error = String(event);
    }
  }

  onMount(() => {
    let frame = 0;
    let last = performance.now();
    let direction = 1;
    (async () => {
      datasets = await loadIndex(`${import.meta.env.BASE_URL}data/`);
      await switchDataset(datasets[0].id);
    })();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") ui.selected = -1;
    };
    window.addEventListener("keydown", onKey);

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const data = activeData;
      if (data && scenes) {
        const maxT = data.windows.length - 1;
        if (ui.playing) {
          let t = ui.t + direction * dt * ui.playSpeed;
          if (t > maxT) {
            t = maxT;
            direction = -1;
          }
          if (t < 0) {
            t = 0;
            direction = 1;
          }
          ui.t = t;
        }
        const wNear = Math.min(Math.round(ui.t), maxT);
        const key = `${sceneKey}:${ui.selected}:${wNear}`;
        if (key !== dimKey) {
          dimKey = key;
          let related: Set<number> | null = null;
          if (ui.selected >= 0) {
            related = new Set([ui.selected]);
            const K = data.neighbourCount;
            for (let e = 0; e < K; e++) {
              related.add(data.neighbours[(ui.selected * data.windows.length + wNear) * K + e]);
            }
          }
          scenes.s3.setDim(related);
          scenes.s2.setDim(related);
        }
        for (const scene of [scenes.s3, scenes.s2]) {
          scene.apply(ui.t, ui.singleRun, ui.halo, ui.haloScale, ui.pointScale, ui.autoRotate);
          scene.updateSelection(ui.selected, ui.t, ui.singleRun);
          scene.render();
        }
        if (yearEl) {
          yearEl.textContent = data.stepYears === 1
            ? String(Math.round(parseInt(data.windows[0]) + ui.t))
            : data.windows[wNear];
        }
        if (labelHost) {
          const children = labelHost.children;
          for (let c = 0; c < children.length; c++) {
            const el = children[c] as HTMLElement;
            const index = Number(el.dataset.index);
            const { x, y, behind } = scenes.s3.project(index, ui.t, ui.singleRun);
            const off = behind || x < 0 || y < 0 || x > scenes.s3.canvas.clientWidth || y > scenes.s3.canvas.clientHeight;
            el.style.opacity = off ? "0" : "1";
            el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
          }
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
      scenes?.s3.dispose();
      scenes?.s2.dispose();
      scenes = null;
    };
  });

  $effect(() => {
    const data = activeData;
    const c3 = canvas3d;
    const c2 = canvas2d;
    if (!data || !c3 || !c2) return;
    untrack(() => {
      scenes?.s3.dispose();
      scenes?.s2.dispose();
      scenes = {
        s3: new MapScene(c3, { flat: false, data, onPick: pick, onHover: hover }),
        s2: new MapScene(c2, { flat: true, data, onPick: pick }),
      };
      dimKey = "";
      for (const scene of [scenes.s3, scenes.s2]) {
        scene.setColors(ui.colorBy);
        scene.setVisibility(ui.minExposureLog);
        scene.setLinks(ui.linkK);
        scene.setMoverTrails(ui.trails);
      }
    });
  });

  $effect(() => {
    if (!ui.loaded) return;
    const mode = ui.colorBy;
    scenes?.s3.setColors(mode);
    scenes?.s2.setColors(mode);
  });

  $effect(() => {
    if (!ui.loaded) return;
    const threshold = ui.minExposureLog;
    scenes?.s3.setVisibility(threshold);
    scenes?.s2.setVisibility(threshold);
  });

  $effect(() => {
    if (!ui.loaded) return;
    const k = ui.linkK;
    scenes?.s3.setLinks(k);
    scenes?.s2.setLinks(k);
  });

  $effect(() => {
    if (!ui.loaded) return;
    const on = ui.trails;
    scenes?.s3.setMoverTrails(on);
    scenes?.s2.setMoverTrails(on);
  });

  $effect(() => {
    if (!ui.loaded || ui.selected < 0) return;
    scenes?.s3.focusOn(ui.selected);
  });
</script>

<div class="h-screen w-screen bg-[#0d0d0d] text-white flex overflow-hidden font-sans">
  <div class="relative flex-1 min-w-0">
    {#key sceneKey}
      <canvas bind:this={canvas3d} class="h-full w-full block cursor-crosshair"></canvas>
    {/key}

    <div bind:this={labelHost} class="absolute inset-0 pointer-events-none overflow-hidden">
      {#each labelList as label (label.index)}
        <div
          data-index={label.index}
          class="absolute top-0 left-0 text-[10px] text-white/70 whitespace-nowrap pl-1.5 -translate-y-1/2"
          style="text-shadow: 0 1px 3px #000"
        >{label.name}</div>
      {/each}
    </div>

    <div bind:this={yearEl} class="absolute bottom-4 left-1/2 -translate-x-1/2 text-4xl font-semibold tabular-nums text-white/25 pointer-events-none select-none"></div>

    {#if ui.view2d}
      <div class="hidden sm:block absolute bottom-4 left-4 w-[300px] h-[240px] rounded-lg overflow-hidden border border-white/10 bg-[#0d0d0d]/80">
        <div class="absolute top-1.5 left-2 z-10 text-[10px] uppercase tracking-wider text-[#898781]">
          top view · PC1 × PC2
        </div>
        {#key sceneKey}
          <canvas bind:this={canvas2d} class="h-full w-full block"></canvas>
        {/key}
      </div>
    {/if}

    {#if ui.hovered >= 0 && activeData}
      <div
        class="fixed z-40 pointer-events-none rounded bg-[#1a1a19]/95 border border-white/15 px-2 py-1 text-xs"
        style="left: {ui.hoverX + 14}px; top: {ui.hoverY + 10}px"
      >
        {activeData.names[ui.hovered]}
        {#if activeData.level === "institution"}
          <span class="text-[#898781]">· {activeData.countries[activeData.countryIndex[ui.hovered]]}</span>
        {/if}
      </div>
    {/if}

    {#if !ui.loaded && !error}
      <div class="absolute inset-0 grid place-items-center text-[#898781] text-sm">loading the map…</div>
    {/if}
    {#if error}
      <div class="absolute inset-0 grid place-items-center text-red-400 text-sm">{error}</div>
    {/if}

    {#if instData}
      <div class="absolute top-4 left-4 pointer-events-none select-none">
        <h1 class="text-lg font-semibold tracking-tight">A Moving Map of Science</h1>
        <p class="text-xs text-[#c3c2b7] max-w-[360px] mt-1">
          {instData.n.toLocaleString()} research institutions placed by who exchanges researchers
          with whom, 2008–2019. Blur is measured uncertainty, not style.
        </p>
      </div>
      <Legend />
    {/if}
  </div>

  {#if activeData}
    <aside class="w-[340px] shrink-0 h-full overflow-y-auto bg-[#1a1a19] border-l border-white/10 p-4 flex flex-col gap-4">
      <Search data={activeData} />
      <Controls data={activeData} {datasets} onDataset={switchDataset} />
      <Detail data={activeData} {instData} />
      <div class="mt-auto pt-3 border-t border-white/10 text-[11px] text-[#898781] leading-relaxed">
        <button class="underline hover:text-white" onclick={() => (ui.aboutOpen = true)}>about this map</button>
        <div class="mt-1">Yifeng Li · <a class="hover:text-white" href="https://yifen9.li">yifen9.li</a></div>
      </div>
    </aside>
  {/if}

  <About />
</div>
