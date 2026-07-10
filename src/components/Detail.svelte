<script lang="ts">
  import { ui } from "../lib/store.svelte";
  import type { Dataset } from "../lib/data";

  let { data, instData }: { data: Dataset; instData: Dataset | null } = $props();

  const i = $derived(ui.selected);
  const W = $derived(data.windows.length);
  const windowIndex = $derived(Math.min(Math.round(ui.t), W - 1));

  const neighbourIds = $derived.by(() => {
    if (i < 0) return [] as number[];
    const out: number[] = [];
    for (let k = 0; k < data.neighbourCount; k++) {
      out.push(data.neighbours[(i * W + windowIndex) * data.neighbourCount + k]);
    }
    return out;
  });

  const memberCount = $derived.by(() => {
    if (i < 0 || data.level !== "country" || !instData) return 0;
    const code = data.countryIndex[i];
    let count = 0;
    for (let j = 0; j < instData.n; j++) if (instData.countryIndex[j] === code) count++;
    return count;
  });

  const rhoValues = $derived.by(() => {
    if (i < 0) return [] as number[];
    const out: number[] = [];
    for (let p = 0; p < W - 1; p++) out.push(data.rho[i * (W - 1) + p]);
    return out;
  });

  const fmt = (v: number, digits = 2) => (Number.isFinite(v) ? v.toFixed(digits) : "–");
</script>

{#if i >= 0}
  <section class="rounded border border-white/10 p-3 text-xs flex flex-col gap-2">
    <div class="flex items-start justify-between gap-2">
      <div>
        <div class="text-sm font-medium leading-snug">{data.names[i]}</div>
        <div class="text-[#898781]">
          {#if data.level === "country"}
            {memberCount.toLocaleString()} institutions
          {:else}
            {data.countries[data.countryIndex[i]]}
          {/if}
        </div>
      </div>
      <button class="text-[#898781] hover:text-white" onclick={() => (ui.selected = -1)} aria-label="close">✕</button>
    </div>

    <div class="grid gap-1 text-center" style="grid-template-columns: repeat({Math.min(W, 5)}, minmax(0, 1fr))">
      {#each data.windows as w, wi}
        <div class="rounded bg-black/30 py-1 {wi === windowIndex ? 'ring-1 ring-[#3987e5]' : ''}">
          <div class="text-[9px] text-[#898781]">{w.slice(0, 4)}{w.length > 4 ? "·" : ""}</div>
          <div class="tabular-nums text-[11px]">{Math.round(2 ** data.exposure[i * W + wi]).toLocaleString()}</div>
          <div class="text-[9px] text-[#898781]">rel {fmt(data.reliability[i * W + wi])}</div>
        </div>
      {/each}
    </div>

    <div>
      <div class="text-[#898781] mb-0.5">retention ρ per step (1 = no motion beyond noise)</div>
      <div class="flex gap-1 flex-wrap">
        {#each rhoValues as value}
          <span class="rounded bg-black/30 px-1.5 py-0.5 tabular-nums">{fmt(value)}</span>
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
      {#if data.level === "institution"}
        <div class="text-[9px] text-[#898781] mt-1">drag the time slider — for rarely-seen institutions this list churns.</div>
      {/if}
    </div>
  </section>
{/if}
