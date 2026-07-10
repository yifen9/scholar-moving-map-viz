<script lang="ts">
  import { ui } from "../lib/store.svelte";
  import type { Dataset } from "../lib/data";

  let { data }: { data: Dataset } = $props();

  const i = $derived(ui.selected);
  const windowIndex = $derived(Math.min(Math.floor(ui.t + 0.5), 3));

  const neighbourIds = $derived.by(() => {
    if (i < 0) return [] as number[];
    const out: number[] = [];
    for (let k = 0; k < data.neighbourCount; k++) {
      out.push(data.neighbours[(i * 4 + windowIndex) * data.neighbourCount + k]);
    }
    return out;
  });

  const fmt = (v: number, digits = 2) => (Number.isFinite(v) ? v.toFixed(digits) : "–");
</script>

{#if i >= 0}
  <section class="rounded border border-white/10 p-3 text-xs flex flex-col gap-2">
    <div class="flex items-start justify-between gap-2">
      <div>
        <div class="text-sm font-medium leading-snug">{data.names[i]}</div>
        <div class="text-[#898781]">{data.countries[data.countryIndex[i]]}</div>
      </div>
      <button class="text-[#898781] hover:text-white" onclick={() => (ui.selected = -1)} aria-label="close">✕</button>
    </div>

    <div class="grid grid-cols-4 gap-1 text-center">
      {#each data.windows as w, wi}
        <div class="rounded bg-black/30 py-1 {wi === windowIndex ? 'ring-1 ring-[#3987e5]' : ''}">
          <div class="text-[9px] text-[#898781]">{w.slice(0, 4)}</div>
          <div class="tabular-nums">{Math.round(2 ** data.exposure[i * 4 + wi])}</div>
          <div class="text-[9px] text-[#898781]">rel {fmt(data.reliability[i * 4 + wi])}</div>
        </div>
      {/each}
    </div>

    <div>
      <div class="text-[#898781] mb-0.5">retention ρ per step (1 = no motion beyond noise)</div>
      <div class="flex gap-1">
        {#each [0, 1, 2] as p}
          <span class="rounded bg-black/30 px-2 py-0.5 tabular-nums">{fmt(data.rho[i * 3 + p])}</span>
        {/each}
      </div>
    </div>

    <div>
      <div class="text-[#898781] mb-0.5">nearest neighbours in {data.windows[windowIndex]}</div>
      <ul class="flex flex-col gap-0.5">
        {#each neighbourIds as nid}
          <li>
            <button class="text-left hover:text-[#3987e5]" onclick={() => (ui.selected = nid)}>
              {data.names[nid]}
            </button>
          </li>
        {/each}
      </ul>
      <div class="text-[9px] text-[#898781] mt-1">drag the time slider — for rarely-seen institutions this list churns.</div>
    </div>
  </section>
{/if}
