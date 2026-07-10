<script lang="ts">
  import { ui } from "../lib/store.svelte";
  import { CONTINENT_COLORS, SPEED_RAMP } from "../lib/palette";
</script>

<div class="hidden sm:block absolute bottom-4 right-4 rounded bg-[#1a1a19]/90 border border-white/10 px-3 py-2 text-[11px] pointer-events-none select-none">
  {#if ui.colorBy === "continent"}
    <div class="flex flex-col gap-1">
      {#each Object.entries(CONTINENT_COLORS) as [name, color]}
        <div class="flex items-center gap-2">
          <span class="inline-block w-2.5 h-2.5 rounded-full" style="background:{color}"></span>
          <span class="text-[#c3c2b7]">{name}</span>
        </div>
      {/each}
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
  {#if ui.halo}
    <div class="mt-1.5 pt-1.5 border-t border-white/10 text-[#898781]">halo radius = measured uncertainty</div>
  {/if}
</div>
