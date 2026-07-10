<script lang="ts">
  import { ui, type ColorMode, type Level } from "../lib/store.svelte";
  import type { Dataset, DatasetInfo } from "../lib/data";

  let {
    data,
    datasets,
    onDataset,
    onReset,
  }: { data: Dataset; datasets: DatasetInfo[]; onDataset: (id: string) => void; onReset: () => void } = $props();

  const modes: { id: ColorMode; label: string }[] = [
    { id: "continent", label: "continent" },
    { id: "country", label: "country" },
    { id: "speed", label: "drift speed" },
    { id: "exposure", label: "exposure" },
  ];
  const levels: { id: Level; label: string }[] = [
    { id: "institution", label: "institutions" },
    { id: "country", label: "countries" },
  ];

  const maxT = $derived(data.windows.length - 1);
  const windowLabel = $derived(data.windows[Math.min(Math.round(ui.t), maxT)]);
  const tickLabels = $derived.by(() => {
    const w = data.windows;
    if (w.length <= 5) return w.map((label) => label.slice(0, 4));
    return [w[0].slice(0, 4), w[Math.floor(w.length / 2)].slice(0, 4), w[w.length - 1].slice(0, 4)];
  });
</script>

{#snippet heading(text: string)}
  <div class="text-[10px] uppercase tracking-widest text-[#898781] border-b border-white/5 pb-0.5">{text}</div>
{/snippet}

<section class="flex flex-col gap-2.5 text-xs text-[#c3c2b7]">
  {@render heading("time")}
  <div>
    <div class="flex items-center justify-between mb-1">
      <span class="tabular-nums text-white">{windowLabel}</span>
      <span class="text-[#898781]">{data.windows.length} windows</span>
    </div>
    <div class="flex items-center gap-2">
      <button
        class="w-8 h-8 rounded bg-white/10 hover:bg-white/20 grid place-items-center text-sm shrink-0"
        onclick={() => (ui.playing = !ui.playing)}
        aria-label={ui.playing ? "pause" : "play"}
      >{ui.playing ? "⏸" : "▶"}</button>
      <input type="range" min="0" max={maxT} step="0.001" bind:value={ui.t} class="flex-1 accent-[#3987e5]"
        oninput={() => (ui.playing = false)} />
    </div>
    <div class="flex justify-between text-[10px] text-[#898781] mt-0.5">
      {#each tickLabels as tick}<span>{tick}</span>{/each}
    </div>
    <label class="block mt-1">
      playback speed
      <input type="range" min="0.1" max="1.5" step="0.05" bind:value={ui.playSpeed} class="w-full accent-[#3987e5]" />
    </label>
  </div>

  {@render heading("view")}
  <div class="flex items-center gap-2 flex-wrap">
    {#each levels as level}
      <button
        class="px-2 py-1 rounded text-xs border {ui.level === level.id
          ? 'bg-white/15 border-white/30 text-white'
          : 'border-white/10 hover:bg-white/5'}"
        onclick={() => {
          ui.level = level.id;
          ui.selected = -1;
          ui.hovered = -1;
        }}
      >{level.label}</button>
    {/each}
    {#if datasets.length > 1}
      <select
        class="bg-black/40 border border-white/10 rounded px-1.5 py-1 text-xs"
        value={ui.datasetId}
        onchange={(event) => onDataset((event.target as HTMLSelectElement).value)}
      >
        {#each datasets as info}
          <option value={info.id}>{info.label}</option>
        {/each}
      </select>
    {/if}
  </div>
  <div class="flex items-center gap-3 flex-wrap">
    <label class="flex items-center gap-1.5">
      <input type="checkbox" bind:checked={ui.view2d} class="accent-[#3987e5]" /> 2D top view
    </label>
    <label class="flex items-center gap-1.5">
      <input type="checkbox" bind:checked={ui.autoRotate} class="accent-[#3987e5]" /> auto-rotate
    </label>
    <button class="px-2 py-0.5 rounded border border-white/10 hover:bg-white/5" onclick={onReset}>reset view</button>
  </div>

  {@render heading("colour & size")}
  <div class="flex gap-1 flex-wrap">
    {#each modes as mode}
      <button
        class="px-2 py-1 rounded text-xs border {ui.colorBy === mode.id
          ? 'bg-white/15 border-white/30 text-white'
          : 'border-white/10 hover:bg-white/5'}"
        onclick={() => (ui.colorBy = mode.id)}
      >{mode.label}</button>
    {/each}
  </div>
  <label class="block">
    size contrast <span class="text-white tabular-nums">{ui.sizeContrast.toFixed(1)}</span>
    <span class="text-[#898781]">(0 = equal dots, 2 = size ∝ how often seen)</span>
    <input type="range" min="0" max="2" step="0.1" bind:value={ui.sizeContrast} class="w-full accent-[#3987e5]" />
  </label>
  <label class="block">
    point size <span class="text-white tabular-nums">{ui.pointScale.toFixed(1)}×</span>
    <input type="range" min="0.4" max="2.5" step="0.1" bind:value={ui.pointScale} class="w-full accent-[#3987e5]" />
  </label>

  {@render heading("links & labels")}
  <label class="block">
    neighbour links <span class="text-white tabular-nums">{ui.linkK === 0 ? "off" : `k=${ui.linkK}`}</span>
    <input type="range" min="0" max={data.neighbourCount} step="1" bind:value={ui.linkK} class="w-full accent-[#3987e5]" />
  </label>
  {#if ui.linkK > 0}
    <label class="block">
      link opacity <span class="text-white tabular-nums">{ui.linkOpacity.toFixed(2)}</span>
      <input type="range" min="0.01" max="0.3" step="0.01" bind:value={ui.linkOpacity} class="w-full accent-[#3987e5]" />
    </label>
  {/if}
  <label class="block">
    name labels <span class="text-white tabular-nums">{ui.labelCount === 0 ? "off" : ui.labelCount}</span>
    <input type="range" min="0" max="80" step="5" bind:value={ui.labelCount} class="w-full accent-[#3987e5]" />
  </label>
  <label class="flex items-center justify-between">
    <span>trails of top movers</span>
    <input type="checkbox" bind:checked={ui.trails} class="accent-[#3987e5]" />
  </label>

  {@render heading("uncertainty")}
  <label class="flex items-center justify-between">
    <span>uncertainty halo</span>
    <input type="checkbox" bind:checked={ui.halo} class="accent-[#3987e5]" />
  </label>
  {#if ui.halo}
    <label class="block">
      halo scale <span class="text-white tabular-nums">{ui.haloScale.toFixed(1)}×</span>
      <input type="range" min="0.2" max="3" step="0.1" bind:value={ui.haloScale} class="w-full accent-[#3987e5]" />
    </label>
  {/if}
  <label class="flex items-center justify-between" title="Show positions from a single training run instead of the multi-run average — this is what an uncorrected map looks like.">
    <span>single run <span class="text-[#898781]">(raw, noisy)</span></span>
    <input type="checkbox" bind:checked={ui.singleRun} class="accent-[#e66767]" />
  </label>

  {@render heading("filter")}
  <label class="block">
    min appearances <span class="text-white tabular-nums">{Math.round(2 ** ui.minExposureLog).toLocaleString()}</span>
    <input type="range" min="3" max="12" step="1" bind:value={ui.minExposureLog} class="w-full accent-[#3987e5]" />
  </label>
</section>
