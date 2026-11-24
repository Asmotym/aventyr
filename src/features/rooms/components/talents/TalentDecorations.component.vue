<template>
  <div v-for="shape in decorations" :key="shape.id" class="talent-decorations" :class="['talent-decorations--' + shape.shape, { 'talent-decorations--editable': editable, 'talent-decorations--resizing': resizing === shape.id }]" :data-decoration-id="shape.id" :style="{ '--talent-decorations-left': shape.x + offset.x + 'px', '--talent-decorations-top': shape.y + offset.y + 'px', '--talent-decorations-width': shape.width + 'px', '--talent-decorations-height': shape.height + 'px', '--shape-rgb': colors[shape.color], '--talent-decorations-font-size': shape.fontSize + 'px' }">
    <svg class="talent-decorations__decoration-background" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <ellipse v-if="shape.shape === 'ellipse'" cx="50" cy="50" rx="49" ry="49" />
      <polygon v-else-if="shape.shape === 'diamond'" points="50,1 99,50 50,99 1,50" />
      <rect v-else x="1" y="1" width="98" height="98" :rx="shape.shape === 'rounded' ? 10 : 0" />
    </svg>
    <div class="talent-decorations__decoration-text" :style="{ '--talent-decorations-decoration-text-font-weight': shape.bold ? '700' : '400', '--talent-decorations-decoration-text-font-style': shape.italic ? 'italic' : 'normal', '--talent-decorations-decoration-text-text-decoration': [shape.underline ? 'underline' : '', shape.strikethrough ? 'line-through' : ''].filter(Boolean).join(' ') || 'none' }"><span>{{ shape.text }}</span></div>
    <div v-if="editable" class="talent-decorations__decoration-actions">
      <button type="button" class="talent-decorations__decoration-control" :aria-label="t('talents.design.moveShape')" :title="t('talents.design.moveShape')" @pointerdown="start($event, shape)" @keydown="moveWithKeys($event, shape)"><v-icon icon="mdi-cursor-move" size="16" /></button>
      <button type="button" class="talent-decorations__decoration-control" :aria-label="t('talents.design.editShape')" @click.stop="emit('edit', shape.id)"><v-icon icon="mdi-pencil-outline" size="15" /></button>
    </div>
    <button v-if="editable" v-for="edge in resizeEdges" :key="edge" type="button" class="talent-decorations__decoration-resize-handle" :class="'talent-decorations__decoration-resize-handle--resize-' + edge" :aria-label="t('talents.design.resizeShape') + ' (' + t('talents.design.resizeEdges.' + edge) + ')'" :title="t('talents.design.resizeHint')" @pointerdown="start($event, shape, edge)" @keydown="resizeWithKeys($event, shape, edge)" @click.stop />
  </div>
</template>
<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { talentColors as colors } from '@/features/rooms/components/talents/talent-colors';
import type { TalentDecoration } from '@shared/rooms/talents.types';
const props = defineProps<{ decorations: TalentDecoration[]; editable?: boolean; offset: { x: number; y: number }; zoom: number; snap?: (shape: TalentDecoration, x: number, y: number) => { x: number; y: number } }>();
const emit = defineEmits<{ move: [id: string, x: number, y: number]; resize: [id: string, width: number, height: number]; edit: [id: string]; 'gesture-start': []; 'gesture-end': [] }>();
const { t } = useI18n();

const resizeEdges = ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'] as const;
type ResizeEdge = typeof resizeEdges[number];
const resizing = ref<string | null>(null);
let cleanup = () => {};
function start(event: PointerEvent, shape: TalentDecoration, edge?: ResizeEdge) {
  if (event.button !== 0) return;
  event.preventDefault(); event.stopPropagation(); cleanup(); emit('gesture-start');
  const original = { ...shape }, startX = event.clientX, startY = event.clientY, scale = props.zoom;
  resizing.value = edge ? shape.id : null;
  let finished = false;
  const move = (next: PointerEvent) => {
    const dx = (next.clientX - startX) / scale, dy = (next.clientY - startY) / scale;
    if (edge) emitBounds(shape.id, resizeBounds(original, edge, Math.round(dx / 20) * 20, Math.round(dy / 20) * 20));
    else { const point = props.snap?.(original, original.x + dx, original.y + dy) ?? { x: Math.round((original.x + dx) / 20) * 20, y: Math.round((original.y + dy) / 20) * 20 }; emit('move', shape.id, point.x, point.y); }
  };
  const end = () => cleanup();
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end); window.addEventListener('blur', end);
  cleanup = () => { if (finished) return; finished = true; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); window.removeEventListener('blur', end); resizing.value = null; emit('gesture-end'); };
}
function moveWithKeys(event: KeyboardEvent, shape: TalentDecoration) {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  event.preventDefault(); event.stopPropagation();
  emit('gesture-start');
  emit('move', shape.id, shape.x + (event.key === 'ArrowLeft' ? -20 : event.key === 'ArrowRight' ? 20 : 0), shape.y + (event.key === 'ArrowUp' ? -20 : event.key === 'ArrowDown' ? 20 : 0));
  emit('gesture-end');
}
function resizeBounds(shape: TalentDecoration, edge: ResizeEdge, dx: number, dy: number) {
  let left = shape.x, top = shape.y, right = shape.x + shape.width, bottom = shape.y + shape.height;
  if (edge.includes('e')) right = Math.min(left + 5000, Math.max(left + 80, right + dx));
  if (edge.includes('s')) bottom = Math.min(top + 5000, Math.max(top + 48, bottom + dy));
  if (edge.includes('w')) left = Math.max(right - 5000, Math.min(right - 80, left + dx));
  if (edge.includes('n')) top = Math.max(bottom - 5000, Math.min(bottom - 48, top + dy));
  return { x: left, y: top, width: right - left, height: bottom - top };
}
function emitBounds(id: string, bounds: { x: number; y: number; width: number; height: number }) { emit('move', id, bounds.x, bounds.y); emit('resize', id, bounds.width, bounds.height); }
function resizeWithKeys(event: KeyboardEvent, shape: TalentDecoration, edge: ResizeEdge) {
  const delta = ({ ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] } as Record<string, [number, number]>)[event.key];
  if (!delta) return;
  event.preventDefault(); event.stopPropagation(); cleanup(); emit('gesture-start');
  emitBounds(shape.id, resizeBounds(shape, edge, delta[0], delta[1])); emit('gesture-end');
}
onBeforeUnmount(() => cleanup());
</script>
<style scoped lang="scss" src="@/assets/styles/features/rooms/talents/talent-decorations.scss"></style>
