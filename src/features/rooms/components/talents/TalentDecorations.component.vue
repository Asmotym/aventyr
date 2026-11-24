<template>
  <div v-for="shape in decorations" :key="shape.id" class="canvas-decoration" :class="['decoration-' + shape.shape, { 'is-editable': editable, 'is-resizing': resizing === shape.id }]" :data-decoration-id="shape.id" :style="{ left: shape.x + offset.x + 'px', top: shape.y + offset.y + 'px', width: shape.width + 'px', height: shape.height + 'px', '--shape-rgb': colors[shape.color], fontSize: shape.fontSize + 'px' }">
    <svg class="decoration-background" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <ellipse v-if="shape.shape === 'ellipse'" cx="50" cy="50" rx="49" ry="49" />
      <polygon v-else-if="shape.shape === 'diamond'" points="50,1 99,50 50,99 1,50" />
      <rect v-else x="1" y="1" width="98" height="98" :rx="shape.shape === 'rounded' ? 10 : 0" />
    </svg>
    <div class="decoration-text" :style="{ fontWeight: shape.bold ? '700' : '400', fontStyle: shape.italic ? 'italic' : 'normal', textDecoration: [shape.underline ? 'underline' : '', shape.strikethrough ? 'line-through' : ''].filter(Boolean).join(' ') || 'none' }"><span>{{ shape.text }}</span></div>
    <div v-if="editable" class="decoration-actions">
      <button type="button" class="decoration-control" :aria-label="t('talents.design.moveShape')" :title="t('talents.design.moveShape')" @pointerdown="start($event, shape)" @keydown="moveWithKeys($event, shape)"><v-icon icon="mdi-cursor-move" size="16" /></button>
      <button type="button" class="decoration-control" :aria-label="t('talents.design.editShape')" @click.stop="emit('edit', shape.id)"><v-icon icon="mdi-pencil-outline" size="15" /></button>
    </div>
    <button v-if="editable" v-for="edge in resizeEdges" :key="edge" type="button" class="decoration-resize-handle" :class="'resize-' + edge" :aria-label="t('talents.design.resizeShape') + ' (' + t('talents.design.resizeEdges.' + edge) + ')'" :title="t('talents.design.resizeHint')" @pointerdown="start($event, shape, edge)" @keydown="resizeWithKeys($event, shape, edge)" @click.stop />
  </div>
</template>
<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { talentColors as colors } from '@/features/rooms/components/talents/talent-colors';
import type { TalentDecoration } from 'netlify/core/types/talents.types';
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
<style scoped>
.canvas-decoration { position:absolute; pointer-events:none; color:rgba(var(--shape-rgb),.95); }
.decoration-background { position:absolute; inset:0; width:100%; height:100%; z-index:0; overflow:visible; }.decoration-background > * { fill:rgba(var(--shape-rgb),.08); stroke:rgba(var(--shape-rgb),.65); stroke-width:1.5; vector-effect:non-scaling-stroke; }
.decoration-text { position:absolute; inset:0; z-index:0; display:flex; align-items:center; justify-content:center; padding:0; text-align:center; white-space:pre-wrap; overflow:hidden; overflow-wrap:anywhere; line-height:1.5; }
.decoration-text > span { display:block; min-width:0; max-width:calc(100% - 32px); max-height:calc(100% - 24px); overflow:hidden; }
.decoration-diamond .decoration-text > span { max-width:58%; max-height:58%; }.decoration-ellipse .decoration-text > span { max-width:70%; max-height:70%; }
.is-editable .decoration-background { pointer-events:auto; }

.decoration-actions { position:absolute; z-index:5; top:4px; right:4px; display:flex; gap:3px; }.decoration-control { display:grid; place-items:center; width:26px; height:26px; border:1px solid rgba(var(--shape-rgb),.4); border-radius:7px; background:rgb(var(--v-theme-surface)); color:rgba(var(--shape-rgb),.95); pointer-events:auto; touch-action:none; cursor:grab; }.decoration-control:hover,.decoration-control:focus-visible { outline:2px solid rgba(var(--shape-rgb),.5); outline-offset:2px; }
.decoration-resize-handle { position:absolute; z-index:5; border:0; padding:0; background:transparent; pointer-events:auto; touch-action:none; opacity:0; transition:opacity 120ms ease; }
.canvas-decoration:hover > .decoration-resize-handle,.canvas-decoration:focus-within > .decoration-resize-handle,.canvas-decoration.is-resizing > .decoration-resize-handle { opacity:1; }
.decoration-resize-handle::after { content:''; position:absolute; top:50%; left:50%; width:7px; height:7px; transform:translate(-50%,-50%); border:1px solid rgb(var(--shape-rgb)); border-radius:2px; background:rgb(var(--v-theme-surface)); }
.resize-n,.resize-s { left:12px; right:12px; height:12px; cursor:ns-resize; }.resize-n { top:-6px; }.resize-s { bottom:-6px; }
.resize-e,.resize-w { top:12px; bottom:12px; width:12px; cursor:ew-resize; }.resize-e { right:-6px; }.resize-w { left:-6px; }
.resize-ne,.resize-nw,.resize-se,.resize-sw { width:16px; height:16px; }.resize-ne,.resize-sw { cursor:nesw-resize; }.resize-nw,.resize-se { cursor:nwse-resize; }
.resize-ne { top:-8px; right:-8px; }.resize-nw { top:-8px; left:-8px; }.resize-se { bottom:-8px; right:-8px; }.resize-sw { bottom:-8px; left:-8px; }
.decoration-resize-handle:focus-visible { opacity:1; outline:2px solid rgb(var(--shape-rgb)); outline-offset:2px; }
@media(pointer:coarse) { .decoration-resize-handle { opacity:1; }.resize-n,.resize-s { height:20px; }.resize-n { top:-10px; }.resize-s { bottom:-10px; }.resize-e,.resize-w { width:20px; }.resize-e { right:-10px; }.resize-w { left:-10px; }.resize-ne,.resize-nw,.resize-se,.resize-sw { width:24px; height:24px; }.resize-ne { top:-12px; right:-12px; }.resize-nw { top:-12px; left:-12px; }.resize-se { bottom:-12px; right:-12px; }.resize-sw { bottom:-12px; left:-12px; } }
@media(prefers-reduced-motion:reduce) { .decoration-resize-handle { transition:none; } }
</style>
