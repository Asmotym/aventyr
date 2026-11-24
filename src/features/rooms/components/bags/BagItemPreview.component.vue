<template>
  <button ref="trigger" type="button" :aria-describedby="inline || visible ? tooltipId : undefined" :aria-expanded="inline || visible" class="bag-item-link" :class="{ 'room-bag-dialog__inventory-tile': tile }" :style="{ '--bag-item-link-color': color }" @mouseenter="show" @mousemove="move" @mouseleave="hide" @focus="show" @blur="hide" @click="toggle" @keydown.esc="close">
    <slot><BagImage v-if="item.imageId || item.icon" :room-id="roomId" :image-id="item.imageId" :icon="item.icon" icon-size="1em" class="bag-item-card__inline-image" />{{ item.name }}</slot>
  </button>
  <Teleport to="body" :disabled="inline">
    <article v-if="inline || visible" :id="tooltipId" ref="card" tabindex="0" :role="inline ? 'region' : 'tooltip'" :aria-label="inline ? t('bag.preview') : undefined" @keydown.esc="close" class="bag-item-card bag-rarity" :class="['bag-rarity--tier-' + tier, { 'bag-item-card--pinned': pinned, 'bag-item-card--inline': inline }]" :style="{ '--rarity': color, '--bag-card-layer': inline ? undefined : previewZIndex, '--bag-card-left': inline ? undefined : x + 'px', '--bag-card-top': inline ? undefined : y + 'px', '--bag-card-transform': inline ? undefined : `scale(${previewScale})` }">
      <div v-if="tier >= 3" class="bag-item-card__edge-effects" aria-hidden="true">
        <span v-for="corner in ['top-left', 'top-right', 'bottom-right', 'bottom-left']" :key="corner" class="bag-item-card__corner" :class="'bag-item-card__corner--' + corner" />
        <span v-if="tier >= 5" class="bag-item-card__sparks">
          <span v-for="spark in 6" :key="spark" class="bag-item-card__spark" :style="{ '--spark-index': spark }" />
        </span>
      </div>
      <span class="bag-item-card__rarity-label">{{ t('bag.rarities.' + item.rarity) }}</span>
      <div class="bag-item-card__content" :class="{ 'bag-item-card__content--art': item.imageId || item.icon }">
        <div v-if="item.imageId || item.icon" class="bag-item-card__art">
          <BagImage :room-id="roomId" :image-id="item.imageId" :icon="item.icon" :icon-size="96" class="bag-item-card__image" />
        </div>
        <div class="bag-item-card__details">
          <header class="bag-item-card__name"><h3>{{ item.name }}</h3></header>
          <p v-if="item.description" class="bag-item-card__description">{{ item.description }}</p>
          <dl v-if="item.fields.length" :class="{ 'bag-item-card__fields-columns': item.fields.length >= 4 }">
            <div v-for="(field, i) in item.fields" :key="i" class="bag-item-card__field">
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
import { BAG_RARITIES, type BagItem } from '@shared/rooms/bag.types';
import BagImage from '@/features/rooms/components/bags/BagImage.component.vue';
import { BAG_RARITY_COLORS } from '@/features/rooms/utils/bag-rarity.utils';
const props = defineProps<{ item: BagItem; roomId: string; inline?: boolean; tile?: boolean }>();
const { t } = useI18n();
const tooltipId = useId(), pinned = ref(false), trigger = ref<HTMLElement>(), card = ref<HTMLElement>();
const visible = ref(false), x = ref(0), y = ref(0), previewScale = ref(1);
const previewZIndex = ref(4000);
function updatePreviewLayer() {
  // Teleported previews must clear the current dialog/menu stack, including nested dialogs.
  const overlays = document.querySelectorAll<HTMLElement>('.v-overlay--active:not(.v-snackbar)');
  previewZIndex.value = Math.max(4000, ...Array.from(overlays, overlay => (Number.parseInt(getComputedStyle(overlay).zIndex, 10) || 0) + 1));
}
let anchor = { x: 0, y: 0 };
let sizeObserver: ResizeObserver | undefined;
const tier = computed(() => Math.max(0, BAG_RARITIES.indexOf(props.item.rarity)));
const color = computed(() => BAG_RARITY_COLORS[props.item.rarity] ?? BAG_RARITY_COLORS.Common);
function position(px: number, py: number) {
  anchor = { x: px, y: py };
  const width = card.value?.offsetWidth ?? Math.min(340, window.innerWidth - 16);
  const height = card.value?.offsetHeight ?? 0;
  const badgeOverhang = (card.value?.querySelector<HTMLElement>(".bag-item-card__rarity-label")?.offsetHeight ?? 28) / 2;
  // Fit oversized cards without restoring an internal scrollbar.
  const scale = Math.min(1, (window.innerHeight - 16) / (height + badgeOverhang));
  previewScale.value = scale;
  x.value = Math.max(8, Math.min(px + 16, window.innerWidth - width * scale - 8));
  y.value = Math.max(8 + badgeOverhang * scale, Math.min(py + 16, window.innerHeight - height * scale - 8));
}
function fit() { if (visible.value && !props.inline) position(anchor.x, anchor.y); }
function show(event: MouseEvent | FocusEvent) {
  if (props.inline) return;
  updatePreviewLayer();
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
  updatePreviewLayer();
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
<style lang="scss" src="@/assets/styles/features/rooms/bags/bag-item-preview.scss"></style>
