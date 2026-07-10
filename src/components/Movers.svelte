<script lang="ts">
  import { ui } from "../lib/store.svelte";
  import type { Dataset } from "../lib/data";

  let { data }: { data: Dataset } = $props();

  const movers = $derived.by(() => {
    const W = data.windows.length;
    const floor = data.level === "country" ? 5 : 9;
    const candidates: { index: number; speed: number }[] = [];
    for (let i = 0; i < data.n; i++) {
      let m = 0;
      for (let w = 0; w < W; w++) m = Math.max(m, data.exposure[i * W + w]);
      if (m >= floor) candidates.push({ index: i, speed: data.speed[i] });
    }
    candidates.sort((a, b) => b.speed - a.speed);
    return candidates.slice(0, 12);
  });

  const maxSpeed = $derived(movers.length ? movers[0].speed : 1);
</script>

<section class="rounded border border-white/10 p-3 text-xs">
  <div class="text-[10px] uppercase tracking-widest text-[#898781] mb-1.5">fastest movers</div>
  <ul class="flex flex-col gap-1">
    {#each movers as mover}
      <li class="flex items-center gap-2">
        <button
          class="flex-1 text-left truncate hover:text-[#3987e5] {ui.selected === mover.index ? 'text-[#3987e5]' : ''}"
          onclick={() => (ui.selected = mover.index)}
        >{data.names[mover.index]}</button>
        <span class="inline-block h-1.5 rounded bg-[#6da7ec]" style="width: {Math.max(4, (mover.speed / maxSpeed) * 48)}px"></span>
      </li>
    {/each}
  </ul>
</section>
