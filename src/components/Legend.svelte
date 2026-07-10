<script lang="ts">
  import { ui } from "../lib/store.svelte";
  import { CONTINENT_COLORS, SPEED_RAMP, countryColor, cssColor } from "../lib/palette";
  import { countryName, type Dataset } from "../lib/data";

  let { data }: { data: Dataset | null } = $props();

  const topCountries = $derived.by(() => {
    if (!data || ui.colorBy !== "country") return [] as { cc: number; name: string; count: number }[];
    const counts = new Map<number, number>();
    for (let i = 0; i < data.n; i++) {
      counts.set(data.countryIndex[i], (counts.get(data.countryIndex[i]) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([cc, count]) => ({ cc, name: countryName(data.countries[cc]), count }));
  });
</script>

<div class="hidden sm:block absolute bottom-4 right-4 rounded bg-[#1a1a19]/90 border border-white/10 px-3 py-2 text-[11px] pointer-events-none select-none max-w-[220px]">
  {#if ui.colorBy === "continent"}
    <div class="flex flex-col gap-1">
      {#each Object.entries(CONTINENT_COLORS) as [name, color]}
        <div class="flex items-center gap-2">
          <span class="inline-block w-2.5 h-2.5 rounded-full" style="background:{color}"></span>
          <span class="text-[#c3c2b7]">{name}</span>
        </div>
      {/each}
    </div>
  {:else if ui.colorBy === "country"}
    <div class="flex flex-col gap-1">
      {#each topCountries as entry}
        <div class="flex items-center gap-2">
          <span class="inline-block w-2.5 h-2.5 rounded-full" style="background:{cssColor(countryColor(entry.cc))}"></span>
          <span class="text-[#c3c2b7] truncate">{entry.name}</span>
        </div>
      {/each}
      <div class="text-[#898781]">every country has its own colour</div>
    </div>
  {:else}
    <div class="flex items-center gap-2">
      <span class="text-[#c3c2b7]">{ui.colorBy === "speed" ? "slow" : "low"}</span>
      <span class="inline-block h-2 w-24 rounded" style="background:linear-gradient(90deg, {SPEED_RAMP.join(',')})"></span>
      <span class="text-[#c3c2b7]">{ui.colorBy === "speed" ? "fast" : "high"}</span>
    </div>
    {#if ui.colorBy === "speed"}
      <div class="text-[#898781] mt-1">mean noise-corrected motion per step</div>
    {/if}
  {/if}
  <div class="mt-1.5 pt-1.5 border-t border-white/10 text-[#898781]">
    {#if ui.sizeContrast > 0}<div>size = how often seen in the data</div>{/if}
    {#if ui.halo}<div>halo = measured uncertainty</div>{/if}
  </div>
</div>
