<template>
  <button ref="trigger" type="button" :aria-describedby="inline || visible ? tooltipId : undefined" :aria-expanded="inline || visible" class="bag-item-link" :style="{ color: color }" @mouseenter="show" @mousemove="move" @mouseleave="hide" @focus="show" @blur="hide" @click="toggle" @keydown.esc="close">
    <BagImage v-if="item.imageId" :room-id="roomId" :image-id="item.imageId" class="bag-inline-image" />{{ item.name }}
  </button>
  <Teleport to="body" :disabled="inline">
    <article v-if="inline || visible" :id="tooltipId" ref="card" tabindex="0" :role="inline ? 'region' : 'tooltip'" :aria-label="inline ? t('bag.preview') : undefined" @keydown.esc="close" class="bag-item-card" :class="['rarity-' + tier, { pinned, 'bag-item-card--inline': inline }]" :style="{ '--rarity': color, left: inline ? undefined : x + 'px', top: inline ? undefined : y + 'px', transform: inline ? undefined : `scale(${previewScale})`, transformOrigin: inline ? undefined : 'top left' }">
      <span class="rarity-label">{{ t('bag.rarities.' + item.rarity) }}</span>
      <div class="bag-card-content" :class="{ 'has-art': item.imageId }">
        <div v-if="item.imageId" class="bag-card-art">
          <BagImage :room-id="roomId" :image-id="item.imageId" class="bag-card-image" />
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
const props = defineProps<{ item: BagItem; roomId: string; inline?: boolean }>();
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
.bag-card-content { overflow: clip; padding: 28px 18px 0; border-radius: 12px; }
.bag-item-card .rarity-label {
  position: absolute;
  z-index: 2;
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
.rarity-1,.rarity-2,.rarity-3,.rarity-4 { box-shadow: 0 12px 36px #000a, 0 0 18px color-mix(in srgb, var(--rarity), transparent 82%); }
.rarity-5,.rarity-6,.rarity-7,.rarity-8,.rarity-9,.rarity-10,.rarity-11 { box-shadow: 0 12px 36px #000a, 0 0 26px color-mix(in srgb, var(--rarity), transparent 60%); animation: bag-glow 3s ease-in-out infinite alternate; }
.rarity-7 { background: radial-gradient(ellipse at top, #38274b, #11151e 75%); }
.rarity-8 { background: radial-gradient(ellipse at top, #49263f, #11151e 75%); }
.rarity-9 { background: radial-gradient(ellipse at top, #304865, #11151e 75%); }
.rarity-10 { background: radial-gradient(ellipse at top, #5c4c28, #11151e 75%); }
.rarity-11 { background: conic-gradient(from 45deg, #26203c, #162d3c, #392b43, #26203c); }
@keyframes bag-glow { to { box-shadow: 0 12px 36px #000a, 0 0 36px color-mix(in srgb, var(--rarity), transparent 30%); } }
@media (prefers-reduced-motion: reduce) { .bag-item-card, .bag-item-card .bag-card-name::before { animation: none; } }
</style>
