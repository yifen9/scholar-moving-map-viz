<script lang="ts">
  import { ui } from "../lib/store.svelte";
</script>

{#if ui.aboutOpen}
  <div class="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6" onclick={() => (ui.aboutOpen = false)} role="presentation">
    <div class="max-w-xl rounded-lg bg-[#1a1a19] border border-white/10 p-6 text-sm leading-relaxed" onclick={(e) => e.stopPropagation()} role="presentation">
      <h2 class="text-base font-semibold mb-2">About this map</h2>
      <p class="text-[#c3c2b7]">
        Each point is a research institution, placed by skip-gram embeddings of researcher career
        trajectories from OpenAlex (2008–2019): institutions that exchange researchers sit close together.
        Time is cut into four 3-year windows, each embedded independently — motion between frames is
        measured, not modelled.
      </p>
      <p class="text-[#c3c2b7] mt-2">
        Every window is trained from two disjoint halves of the researcher population, twice each. The
        halo around a point is its measured irreproducibility across those runs — blur is data, not
        decoration. The <em>single run</em> switch shows what an uncorrected map looks like: most of the
        apparent motion of small institutions is training noise.
      </p>
      <p class="text-[#c3c2b7] mt-2">
        Positions are the first three principal components of each institution's similarity profile
        against 512 frequently-observed anchors (69% of variance), in a frame shared across windows.
        Institutions observed fewer than 8 times per window-half are excluded.
      </p>
      <p class="text-[#898781] mt-3 text-xs">Yifeng Li · <a class="underline hover:text-white" href="https://yifen9.li">yifen9.li</a></p>
      <button class="mt-4 px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-xs" onclick={() => (ui.aboutOpen = false)}>close</button>
    </div>
  </div>
{/if}
