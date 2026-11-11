<template>
  <button ref="trigger" type="button" :aria-describedby="inline || visible ? tooltipId : undefined" :aria-expanded="inline || visible" class="bag-item-link" :class="{ 'bag-inventory-tile': tile }" :style="{ color: color }" @mouseenter="show" @mousemove="move" @mouseleave="hide" @focus="show" @blur="hide" @click="toggle" @keydown.esc="close">
    <slot><BagImage v-if="item.imageId || item.icon" :room-id="roomId" :image-id="item.imageId" :icon="item.icon" icon-size="1em" class="bag-inline-image" />{{ item.name }}</slot>
  </button>
  <Teleport to="body" :disabled="inline">
    <article v-if="inline || visible" :id="tooltipId" ref="card" tabindex="0" :role="inline ? 'region' : 'tooltip'" :aria-label="inline ? t('bag.preview') : undefined" @keydown.esc="close" class="bag-item-card" :class="['rarity-' + tier, { pinned, 'bag-item-card--inline': inline }]" :style="{ '--rarity': color, left: inline ? undefined : x + 'px', top: inline ? undefined : y + 'px', transform: inline ? undefined : `scale(${previewScale})`, transformOrigin: inline ? undefined : 'top left' }">
      <div v-if="tier >= 3" class="bag-card-edge-effects" aria-hidden="true">
        <span v-for="corner in ['top-left', 'top-right', 'bottom-right', 'bottom-left']" :key="corner" class="bag-card-corner" :class="'bag-card-corner--' + corner" />
        <span v-if="tier >= 5" class="bag-card-sparks">
          <span v-for="spark in 6" :key="spark" class="bag-card-spark" :style="{ '--spark-index': spark }" />
        </span>
      </div>
      <span class="rarity-label">{{ t('bag.rarities.' + item.rarity) }}</span>
      <div class="bag-card-content" :class="{ 'has-art': item.imageId || item.icon }">
        <div v-if="item.imageId || item.icon" class="bag-card-art">
          <BagImage :room-id="roomId" :image-id="item.imageId" :icon="item.icon" :icon-size="96" class="bag-card-image" />
        </div>
        <div class="bag-card-details">
          <header class="bag-card-name"><h3>{{ item.name }}</h3></header>
          <p v-if="item.description" class="bag-card-description">{{ item.description }}</p>
          <dl v-if="item.fields.length" :class="{ 'bag-fields-columns': item.fields.length >= 4 }">
            <div v-for="(field, i) in item.fields" :key="i" class="bag-card-field">
              <dt>{{ field.name }}</dt>
              <dd>{{ Array.isArray(field.value) ? field.value.join(', ') : field.value }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </article>
  </Teleport>
</template>
<script setup lang="ts">
import { computed, ref, useId, onMounted, onBeforeUnmount, nextTick, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { BAG_RARITIES, type BagItem } from 'netlify/core/types/bag.types';
import BagImage from './BagImage.component.vue';
import { BAG_RARITY_COLORS } from 'core/utils/bag-rarity.utils';
const props = defineProps<{ item: BagItem; roomId: string; inline?: boolean; tile?: boolean }>();
const { t } = useI18n();
const tooltipId = useId(), pinned = ref(false), trigger = ref<HTMLElement>(), card = ref<HTMLElement>();
const visible = ref(false), x = ref(0), y = ref(0), previewScale = ref(1);
let anchor = { x: 0, y: 0 };
let sizeObserver: ResizeObserver | undefined;
const tier = computed(() => Math.max(0, BAG_RARITIES.indexOf(props.item.rarity)));
const color = computed(() => BAG_RARITY_COLORS[props.item.rarity] ?? BAG_RARITY_COLORS.Common);
function position(px: number, py: number) {
  anchor = { x: px, y: py };
  const width = card.value?.offsetWidth ?? Math.min(340, window.innerWidth - 16);
  const height = card.value?.offsetHeight ?? 0;
  const badgeOverhang = (card.value?.querySelector<HTMLElement>('.rarity-label')?.offsetHeight ?? 28) / 2;
  // Fit oversized cards without restoring an internal scrollbar.
  const scale = Math.min(1, (window.innerHeight - 16) / (height + badgeOverhang));
  previewScale.value = scale;
  x.value = Math.max(8, Math.min(px + 16, window.innerWidth - width * scale - 8));
  y.value = Math.max(8 + badgeOverhang * scale, Math.min(py + 16, window.innerHeight - height * scale - 8));
}
function fit() { if (visible.value && !props.inline) position(anchor.x, anchor.y); }
function show(event: MouseEvent | FocusEvent) {
  if (props.inline) return;
  visible.value = true;
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  position(rect.left, rect.bottom);
  void nextTick(fit);
}
function move(event: MouseEvent) { if (props.inline) return; position(event.clientX, event.clientY); }
function hide() { if (!pinned.value) visible.value = false; }
function close() { pinned.value = false; visible.value = false; }
function toggle(event: MouseEvent) {
  if (props.inline) { card.value?.focus(); return; }
  pinned.value = !pinned.value;
  visible.value = pinned.value;
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  position(rect.left, rect.bottom);
  void nextTick(fit);
}
function outside(event: PointerEvent) { if (!trigger.value?.contains(event.target as Node) && !card.value?.contains(event.target as Node)) close(); }
watch(card, element => {
  sizeObserver?.disconnect();
  if (element && !props.inline) {
    sizeObserver = new ResizeObserver(fit);
    sizeObserver.observe(element);
    fit();
  }
});
onMounted(() => {
  document.addEventListener('pointerdown', outside);
  window.addEventListener('resize', fit);
});
onBeforeUnmount(() => {
  sizeObserver?.disconnect();
  document.removeEventListener('pointerdown', outside);
  window.removeEventListener('resize', fit);
});

</script>
<style>
.bag-item-link { display: inline-flex; align-items: center; gap: 6px; text-align: left; text-decoration: underline dotted; cursor: pointer; }
.bag-inline-image { width: 1em; height: 1em; object-fit: contain; }
.bag-item-card {
  --frame-paint: linear-gradient(135deg, var(--rarity), #fff8 25%, var(--rarity) 45%, #14182166 75%, var(--rarity));
  --frame-speed: 10s;
  --frame-glow: 10px;
  --corner-size: 10px;
  --edge-accent: var(--rarity);
  isolation: isolate;
  position: fixed;
  z-index: 4000;
  pointer-events: none;
  width: min(340px, calc(100vw - 16px));
  border: 2px solid var(--rarity);
  border-radius: 14px;
  background: radial-gradient(ellipse at top, color-mix(in srgb, var(--rarity) 10%, #1b202b), #11151e 75%);
  color: #eee;
  box-shadow: 0 12px 36px #000a;
  overflow-wrap: anywhere;
}
.bag-item-card.pinned { pointer-events: auto; }
.bag-item-card--inline { position: relative; z-index: auto; pointer-events: auto; width: min(340px, 100%); flex-shrink: 0; }
.bag-card-content { position: relative; z-index: 1; overflow: clip; padding: 28px 18px 0; border-radius: 12px; }
.bag-item-card .rarity-label {
  position: absolute;
  z-index: 4;
  top: 0;
  left: 50%;
  transform: translate(-50%, -50%);
  max-width: calc(100% - 32px);
  padding: 5px 18px;
  border: 1px solid var(--rarity);
  border-radius: 6px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--rarity) 24%, #151922), #151922);
  box-shadow: 0 4px 12px #0008;
  color: var(--rarity);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .14em;
  line-height: 1.5;
  text-align: center;
  text-transform: uppercase;
}
.bag-card-art { display: grid; place-items: center; min-height: 120px; margin-bottom: 14px; background: radial-gradient(ellipse, color-mix(in srgb, var(--rarity) 12%, transparent), transparent 70%); }
.bag-card-image { display: block; width: auto; height: auto; max-width: 112px; max-height: 112px; object-fit: contain; filter: drop-shadow(0 6px 10px #0008); }
.bag-card-name {
  --name-ornament: '·';
  position: relative;
  isolation: isolate;
  margin: 0 -18px 18px;
  padding: 8px 30px 14px;
  border-top: 1px solid var(--rarity);
  border-bottom: 1px solid color-mix(in srgb, var(--rarity) 60%, #141821);
  background: transparent;
  text-align: center;
}
.bag-card-name::before { content: ''; position: absolute; inset: 0; z-index: -1; pointer-events: none; }
.bag-card-name::after {
  content: var(--name-ornament);
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translate(-50%, 50%);
  min-width: 36px;
  padding: 0 8px;
  background: var(--rarity);
  color: #141821;
  font-size: 14px;
  line-height: 16px;
}
/* Each title has its own motif, while the details retain the shared rarity surface. */
.rarity-0 .bag-card-name { --name-ornament: '·'; }
.rarity-0 .bag-card-name::before { background: linear-gradient(90deg, transparent, #14182108, transparent); }
.rarity-1 .bag-card-name { --name-ornament: '❧'; }
.rarity-1 .bag-card-name::before { background: linear-gradient(135deg, #143d2526 10px, transparent 10px), linear-gradient(225deg, #143d2526 10px, transparent 10px); }
.rarity-2 .bag-card-name { --name-ornament: '◇'; }
.rarity-2 .bag-card-name::before { background: linear-gradient(90deg, #153e681c 1px, transparent 1px) left / 12px 100%, linear-gradient(#153e6810 1px, transparent 1px) top / 100% 12px; mask-image: linear-gradient(90deg, #000, transparent 28%, transparent 72%, #000); }
.rarity-3 .bag-card-name { --name-ornament: '✦'; }
.rarity-3 .bag-card-name::before { background: radial-gradient(ellipse at 50% 100%, #fff9cfb3, transparent 65%), linear-gradient(90deg, #79500624, transparent 22%, transparent 78%, #79500624); }
.rarity-4 .bag-card-name { --name-ornament: '❖'; }
.rarity-4 .bag-card-name::before { background: repeating-linear-gradient(135deg, transparent 0 7px, #773a1324 7px 9px); mask-image: linear-gradient(90deg, #000, transparent 25%, transparent 75%, #000); }
.rarity-5 .bag-card-name { --name-ornament: '▲'; }
.rarity-5 .bag-card-name::before { background: linear-gradient(135deg, #71331e40 14px, transparent 14px) left, linear-gradient(225deg, #71331e40 14px, transparent 14px) right, linear-gradient(0deg, #fff1c74d, transparent 70%); background-repeat: no-repeat; }
.rarity-6 .bag-card-name { --name-ornament: '◆'; }
.rarity-6 .bag-card-name::before { background: linear-gradient(45deg, #6b112a33 12%, transparent 12% 88%, #6b112a33 88%), linear-gradient(135deg, #6b112a1f 12%, transparent 12% 88%, #6b112a1f 88%); }
.rarity-7 .bag-card-name { --name-ornament: '♛'; }
.rarity-7 .bag-card-name::before { background: radial-gradient(ellipse at 0 50%, #4d245a55 0 6%, transparent 7% 12%, #4d245a33 13% 15%, transparent 16%), radial-gradient(ellipse at 100% 50%, #4d245a55 0 6%, transparent 7% 12%, #4d245a33 13% 15%, transparent 16%), linear-gradient(0deg, #fff0cd4d, transparent); }
.rarity-8 .bag-card-name { --name-ornament: '✺'; }
.rarity-8 .bag-card-name::before { background: radial-gradient(circle at 12% 30%, #fff7db 0 1px, transparent 2px), radial-gradient(circle at 88% 30%, #fff7db 0 1px, transparent 2px), radial-gradient(circle at 20% 75%, #81345b80 0 1px, transparent 2px), radial-gradient(circle at 80% 75%, #81345b80 0 1px, transparent 2px), radial-gradient(ellipse at bottom, #ffe6f980, transparent 65%); }
.rarity-9 .bag-card-name { --name-ornament: '☼'; }
.rarity-9 .bag-card-name::before { background: radial-gradient(ellipse at 50% 120%, transparent 45%, #668ab966 46% 47%, transparent 48% 62%, #668ab933 63% 64%, transparent 65%), linear-gradient(90deg, #bddcfa80, transparent 35% 65%, #bddcfa80); }
.rarity-10 .bag-card-name { --name-ornament: '✵'; }
.rarity-10 .bag-card-name::before { background: conic-gradient(from -30deg at 50% 110%, transparent 0deg, #d2a5524d 10deg, transparent 20deg 40deg, #d2a5524d 50deg, transparent 60deg 300deg, #d2a5524d 310deg, transparent 320deg 340deg, #d2a5524d 350deg, transparent 360deg), linear-gradient(0deg, #f2d39266, transparent); }
.rarity-11 .bag-card-name { --name-ornament: '✶'; }
.rarity-11 .bag-card-name::before { background: linear-gradient(110deg, #b2dcf866, #d2b0ef66, #f4c8dd66, #f6e5b366, #b2dcf866); background-size: 250% 100%; animation: bag-name-prism 8s ease-in-out infinite alternate; }
@keyframes bag-name-prism { to { background-position: 100% 0; } }
.bag-card-name h3 { margin: 0; color: inherit; font-family: inherit; font-size: 22px; font-weight: 700; line-height: 1.25; letter-spacing: .02em; }
.bag-card-details { margin-inline: -18px; padding: 0 18px 18px; background: var(--rarity); color: #141821; }
.bag-card-description { margin: 0; padding: 14px 12px; border-radius: 7px; background: transparent; color: inherit; font-size: 13px; font-style: italic; line-height: 1.65; white-space: pre-wrap; }
.bag-item-card dl { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; margin-top: 16px; padding: 14px 12px; border-radius: 7px; background: transparent; color: inherit; line-height: 1.5; white-space: pre-wrap; }
.bag-item-card dl.bag-fields-columns { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.bag-card-field { min-width: 0; }
.bag-card-content:not(.has-art) { padding-top: 0; }
.bag-card-content:not(.has-art) .bag-card-name { padding-top: 24px; }
.bag-item-card dt { color: inherit; font-size: 11px; line-height: 1.1; opacity: .75; }
.bag-item-card dd { margin: 0; text-align: left; font-size: 14px; font-weight: 600; line-height: 1.3; }
/* The gradient lives on the existing frame; ornaments never cover item content. */
@property --bag-frame-angle {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}
.bag-item-card::before,
.bag-item-card::after {
  content: '';
  position: absolute;
  pointer-events: none;
  border-radius: inherit;
  background: var(--frame-paint);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
}
.bag-item-card::before {
  inset: -2px;
  z-index: 2;
  padding: 2px;
  filter: drop-shadow(0 0 var(--frame-glow) color-mix(in srgb, var(--edge-accent) 65%, transparent));
}
.bag-item-card::after {
  display: none;
  inset: -10px;
  z-index: -1;
  padding: 10px;
  opacity: .4;
  filter: blur(10px);
}
.bag-item-card.rarity-0::before { opacity: .45; filter: none; }
.bag-item-card.rarity-1 { --frame-paint: linear-gradient(150deg, #d8ffe4, #63d471 18%, #236a3b 55%, #a4edb5); --frame-glow: 4px; }
.bag-item-card.rarity-2 { --frame-paint: linear-gradient(135deg, #d9f4ff, #64b5f6 15%, #2862a3 45%, #c9f4ff 65%, #64b5f6); --frame-glow: 7px; }
.bag-item-card.rarity-3 { --frame-paint: conic-gradient(from 45deg, #ffe066, #fff9d6, #ad7c14, #ffe066, #fff9d6, #ffe066); --edge-accent: #ffe066; }
.bag-item-card.rarity-4 { --frame-paint: conic-gradient(from var(--bag-frame-angle), #bd501b, #ffac49 18%, #fff1b6 25%, #ffac49 32%, #8e3b0c 65%, #ffac49); --frame-speed: 12s; --corner-size: 12px; }
.bag-item-card.rarity-5 { --frame-paint: conic-gradient(from var(--bag-frame-angle), #84300d, #ff8717 20%, #fff0b1 28%, #ff8717 34%, #a83b12 65%, #ffb652); --frame-speed: 10s; --corner-size: 15px; --frame-glow: 13px; }
.bag-item-card.rarity-6 { --frame-paint: conic-gradient(from var(--bag-frame-angle), #7d122b, #ff6060 16%, #ffe3dd 22%, #ff6060 28%, #b91643 60%, #ff9393 80%, #7d122b); --frame-speed: 8s; --corner-size: 16px; --frame-glow: 15px; }
.bag-item-card.rarity-7 { --frame-paint: conic-gradient(from var(--bag-frame-angle), #6a2fba, #bf83ff 18%, #ffe9ad 25%, #bf83ff 34%, #6a2fba 58%, #ffe9ad 75%, #6a2fba); --frame-speed: 10s; --corner-size: 18px; --edge-accent: #f5d791; --frame-glow: 17px; }
.bag-item-card.rarity-8 { --frame-paint: conic-gradient(from var(--bag-frame-angle), #a5298a, #ff8cda 16%, #fff4e0 23%, #ff8cda 30%, #a24bcb 55%, #ffb8ec 80%, #a5298a); --frame-speed: 9s; --corner-size: 18px; --frame-glow: 20px; }
.bag-item-card.rarity-9 { --frame-paint: conic-gradient(from var(--bag-frame-angle), #609cd6, #f4faff 15%, #b9f0ff 28%, #649ec9 48%, #fff 65%, #b5d9ff 80%, #609cd6); --frame-speed: 12s; --corner-size: 20px; --edge-accent: #b9e7ff; --frame-glow: 22px; }
.bag-item-card.rarity-10 { --frame-paint: conic-gradient(from var(--bag-frame-angle), #b7862c, #fff7de 15%, #ffe09a 30%, #fff 45%, #c8983e 60%, #fff7de 78%, #b7862c); --frame-speed: 14s; --corner-size: 22px; --edge-accent: #ffe4a1; --frame-glow: 25px; }
.bag-item-card.rarity-11 { --frame-paint: conic-gradient(from var(--bag-frame-angle), #b6f3ff, #d1b4ff 16%, #fff 23%, #ffc2e8 38%, #ffeab7 55%, #fff 64%, #bdf6ed 80%, #b6f3ff); --frame-speed: 8s; --corner-size: 24px; --edge-accent: #dccbff; --frame-glow: 28px; }
.bag-item-card:is(.rarity-4, .rarity-5, .rarity-6, .rarity-7, .rarity-8, .rarity-9, .rarity-10, .rarity-11)::before {
  animation: bag-frame-flow var(--frame-speed) linear infinite;
}
.bag-item-card:is(.rarity-5, .rarity-6, .rarity-7, .rarity-8, .rarity-9, .rarity-10, .rarity-11)::after {
  display: block;
  animation: bag-frame-flow var(--frame-speed) linear infinite, bag-frame-aura 5s ease-in-out infinite alternate;
}
.bag-card-edge-effects { position: absolute; inset: -6px; z-index: 3; pointer-events: none; }
.bag-card-corner {
  position: absolute;
  width: var(--corner-size);
  height: var(--corner-size);
  background: linear-gradient(135deg, #fff, var(--edge-accent) 45%, color-mix(in srgb, var(--edge-accent) 55%, #251832));
  clip-path: polygon(50% 0, 75% 30%, 100% 50%, 75% 70%, 50% 100%, 25% 70%, 0 50%, 25% 30%);
  filter: drop-shadow(0 0 5px var(--edge-accent));
  transform: rotate(var(--corner-turn));
}
.bag-card-corner--top-left { top: 0; left: 0; --corner-turn: -45deg; }
.bag-card-corner--top-right { top: 0; right: 0; --corner-turn: 45deg; }
.bag-card-corner--bottom-right { bottom: 0; right: 0; --corner-turn: 135deg; }
.bag-card-corner--bottom-left { bottom: 0; left: 0; --corner-turn: 225deg; }
.rarity-5 .bag-card-corner { clip-path: polygon(50% 0, 100% 24%, 80% 80%, 50% 100%, 20% 80%, 0 24%); }
.rarity-6 .bag-card-corner { clip-path: polygon(50% 0, 62% 36%, 100% 50%, 62% 64%, 50% 100%, 38% 64%, 0 50%, 38% 36%); }
.rarity-7 .bag-card-corner { clip-path: polygon(0 0, 100% 0, 100% 22%, 44% 30%, 30% 44%, 22% 100%, 0 100%, 15% 35%, 35% 15%); }
.rarity-8 .bag-card-corner { clip-path: polygon(50% 0, 60% 30%, 85% 15%, 70% 40%, 100% 50%, 70% 60%, 85% 85%, 60% 70%, 50% 100%, 40% 70%, 15% 85%, 30% 60%, 0 50%, 30% 40%, 15% 15%, 40% 30%); }
.rarity-9 .bag-card-corner { clip-path: polygon(50% 0, 75% 32%, 100% 50%, 68% 60%, 50% 100%, 32% 60%, 0 50%, 25% 32%); }
.rarity-10 .bag-card-corner { clip-path: polygon(50% 0, 60% 25%, 85% 10%, 75% 40%, 100% 50%, 75% 60%, 85% 90%, 60% 75%, 50% 100%, 40% 75%, 15% 90%, 25% 60%, 0 50%, 25% 40%, 15% 10%, 40% 25%); }
.rarity-11 .bag-card-corner { clip-path: polygon(50% 0, 60% 32%, 80% 20%, 68% 40%, 100% 50%, 68% 60%, 80% 80%, 60% 68%, 50% 100%, 40% 68%, 20% 80%, 32% 60%, 0 50%, 32% 40%, 20% 20%, 40% 32%); }
.bag-card-sparks { position: absolute; inset: 0; }
.bag-card-spark {
  position: absolute;
  width: 4px;
  height: 4px;
  background: var(--edge-accent);
  box-shadow: 0 0 8px 2px color-mix(in srgb, var(--edge-accent) 65%, transparent);
  animation: bag-edge-spark 4s ease-in-out infinite;
  animation-delay: calc(var(--spark-index) * -.65s);
}
.bag-card-spark:nth-child(1) { left: 2px; top: 18%; }
.bag-card-spark:nth-child(2) { right: 2px; top: 36%; }
.bag-card-spark:nth-child(3) { left: 36%; bottom: 2px; }
.bag-card-spark:nth-child(4) { left: 2px; top: 74%; }
.bag-card-spark:nth-child(5) { right: 2px; top: 87%; }
.bag-card-spark:nth-child(6) { right: 22%; top: 2px; }
.rarity-5 .bag-card-spark { width: 3px; height: 6px; border-radius: 50%; }
.rarity-6 .bag-card-spark { height: 10px; clip-path: polygon(65% 0, 100% 0, 60% 45%, 100% 45%, 0 100%, 35% 55%, 0 55%); }
.rarity-7 .bag-card-spark { border-radius: 50%; }
.bag-item-card:is(.rarity-8, .rarity-9, .rarity-10, .rarity-11) .bag-card-spark { width: 10px; height: 10px; background: transparent; box-shadow: none; }
.bag-item-card:is(.rarity-8, .rarity-9, .rarity-10, .rarity-11) .bag-card-spark::after { content: '✦'; position: absolute; inset: 0; color: var(--edge-accent); font-size: 12px; line-height: 10px; text-shadow: 0 0 8px var(--edge-accent); }
.rarity-9 .bag-card-spark { animation-duration: 6s; }
.rarity-10 .bag-card-spark { animation-duration: 7s; }
.rarity-11 .bag-card-spark { animation-duration: 5s; }
.bag-item-card:is(.rarity-7, .rarity-8, .rarity-9, .rarity-10, .rarity-11) .rarity-label { box-shadow: 0 4px 12px #0008, 0 0 15px color-mix(in srgb, var(--edge-accent) 35%, transparent); }
/* The final tiers grow luminous side crests without adding another frame. */
.bag-card-edge-effects::before,
.bag-card-edge-effects::after {
  content: '';
  display: none;
  position: absolute;
  top: 50%;
  width: 8px;
  height: 76px;
  background: linear-gradient(0deg, transparent, var(--edge-accent), #fff, var(--edge-accent), transparent);
  clip-path: polygon(100% 0, 72% 28%, 100% 50%, 72% 72%, 100% 100%, 35% 75%, 0 50%, 35% 25%);
  filter: drop-shadow(0 0 6px var(--edge-accent));
  animation: bag-edge-crest 6s ease-in-out infinite alternate;
}
.bag-card-edge-effects::before { left: 0; transform: translateY(-50%); }
.bag-card-edge-effects::after { right: 0; transform: translateY(-50%) scaleX(-1); }
.bag-item-card:is(.rarity-9, .rarity-10, .rarity-11) .bag-card-edge-effects::before,
.bag-item-card:is(.rarity-9, .rarity-10, .rarity-11) .bag-card-edge-effects::after { display: block; }
.rarity-10 .bag-card-edge-effects::before,
.rarity-10 .bag-card-edge-effects::after { width: 11px; height: 104px; clip-path: polygon(100% 0, 55% 25%, 100% 20%, 50% 45%, 100% 50%, 50% 55%, 100% 80%, 55% 75%, 100% 100%, 0 50%); }
.rarity-11 .bag-card-edge-effects::before,
.rarity-11 .bag-card-edge-effects::after { width: 14px; height: 136px; background: linear-gradient(0deg, transparent, #b6f3ff, #d1b4ff, #fff, #ffc2e8, #ffeab7, transparent); clip-path: polygon(100% 0, 55% 20%, 100% 28%, 35% 40%, 100% 50%, 35% 60%, 100% 72%, 55% 80%, 100% 100%, 18% 68%, 0 50%, 18% 32%); }
@keyframes bag-edge-crest { from { opacity: .45; } to { opacity: 1; } }
@keyframes bag-frame-flow { to { --bag-frame-angle: 360deg; } }
@keyframes bag-frame-aura { to { opacity: .75; filter: blur(14px); } }
@keyframes bag-edge-spark {
  0%, 100% { opacity: .2; transform: translateY(3px) rotate(45deg) scale(.6); }
  50% { opacity: 1; transform: translateY(-4px) rotate(45deg) scale(1); }
}
.rarity-7 { background: radial-gradient(ellipse at top, #38274b, #11151e 75%); }
.rarity-8 { background: radial-gradient(ellipse at top, #49263f, #11151e 75%); }
.rarity-9 { background: radial-gradient(ellipse at top, #304865, #11151e 75%); }
.rarity-10 { background: radial-gradient(ellipse at top, #5c4c28, #11151e 75%); }
.rarity-11 { background: conic-gradient(from 45deg, #26203c, #162d3c, #392b43, #26203c); }
@media (prefers-reduced-motion: reduce) {
  .bag-item-card,
  .bag-item-card[class*="rarity-"]::before,
  .bag-item-card[class*="rarity-"]::after,
  .bag-item-card .bag-card-name::before,
  .bag-item-card .bag-card-edge-effects::before,
  .bag-item-card .bag-card-edge-effects::after,
  .bag-item-card .bag-card-spark { animation: none; }
  .bag-item-card .bag-card-spark { opacity: .65; transform: rotate(45deg); }
}
</style>
