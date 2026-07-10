<script lang="ts">
  import { ui } from "../lib/store.svelte";
  import { CONTINENT_COLORS, SPEED_RAMP, countryColor, cssColor } from "../lib/palette";
  import { countryName, type Dataset } from "../lib/data";

  let { data }: { data: Dataset | null } = $props();

  const countryList = $derived.by(() => {
    if (!data || ui.colorBy !== "country") return [] as { cc: number; name: string; count: number; rank: number }[];
    const counts = new Map<number, number>();
    for (let i = 0; i < data.n; i++) {
      counts.set(data.countryIndex[i], (counts.get(data.countryIndex[i]) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([cc, count]) => ({ cc, name: countryName(data.countries[cc]), count, rank: data.countryRank[cc] }));
  });
</script>

<div class="hidden sm:block absolute bottom-4 right-4 rounded bg-[#1a1a19]/90 border border-white/10 px-3 py-2 text-[11px] select-none max-w-[230px]">
  {#if ui.colorBy === "continent"}
    <div class="flex flex-col gap-1 pointer-events-none">
      {#each Object.entries(CONTINENT_COLORS) as [name, color]}
        <div class="flex items-center gap-2">
          <span class="inline-block w-2.5 h-2.5 rounded-full" style="background:{color}"></span>
          <span class="text-[#c3c2b7]">{name}</span>
        </div>
      {/each}
    </div>
  {:else if ui.colorBy === "country"}
    <div class="flex flex-col gap-0.5 max-h-[38vh] overflow-y-auto pr-1">
      {#each countryList as entry}
        <button
          class="flex items-center gap-2 text-left rounded px-0.5 hover:bg-white/10 {ui.countryFilter === entry.cc ? 'bg-white/15' : ''}"
          onclick={() => (ui.countryFilter = ui.countryFilter === entry.cc ? -1 : entry.cc)}
        >
          <span class="inline-block w-2.5 h-2.5 rounded-full shrink-0" style="background:{cssColor(countryColor(entry.rank))}"></span>
          <span class="text-[#c3c2b7] truncate flex-1">{entry.name}</span>
          <span class="text-[#898781] tabular-nums">{entry.count}</span>
        </button>
      {/each}
    </div>
  {:else}
    <div class="flex items-center gap-2 pointer-events-none">
      <span class="text-[#c3c2b7]">{ui.colorBy === "speed" ? "slow" : "low"}</span>
      <span class="inline-block h-2 w-24 rounded" style="background:linear-gradient(90deg, {SPEED_RAMP.join(',')})"></span>
      <span class="text-[#c3c2b7]">{ui.colorBy === "speed" ? "fast" : "high"}</span>
    </div>
    {#if ui.colorBy === "speed"}
      <div class="text-[#898781] mt-1 pointer-events-none">mean noise-corrected motion per step</div>
    {/if}
  {/if}
  <div class="mt-1.5 pt-1.5 border-t border-white/10 text-[#898781] pointer-events-none">
    {#if ui.sizeContrast > 0}<div>size = how often seen in the data</div>{/if}
    {#if ui.halo}<div>halo = measured uncertainty</div>{/if}
  </div>
</div>
