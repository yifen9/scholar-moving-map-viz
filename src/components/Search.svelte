<script lang="ts">
  import { ui } from "../lib/store.svelte";
  import type { Dataset } from "../lib/data";

  let { data }: { data: Dataset } = $props();
  let query = $state("");

  const results = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [] as number[];
    const out: number[] = [];
    for (let i = data.n - 1; i >= 0 && out.length < 8; i--) {
      if (data.names[i].toLowerCase().includes(q)) out.push(i);
    }
    return out;
  });
</script>

<section>
  <input
    type="search"
    placeholder="search institutions…"
    bind:value={query}
    class="w-full rounded bg-black/40 border border-white/10 px-3 py-2 text-sm placeholder-[#898781] focus:outline-none focus:border-[#3987e5]"
  />
  {#if results.length > 0}
    <ul class="mt-1 rounded border border-white/10 divide-y divide-white/5 overflow-hidden">
      {#each results as index}
        <li>
          <button
            class="w-full text-left px-3 py-1.5 text-xs hover:bg-white/10"
            onclick={() => {
              ui.selected = index;
              query = "";
            }}
          >
            {data.names[index]}
            <span class="text-[#898781]">· {data.countries[data.countryIndex[index]]}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>
