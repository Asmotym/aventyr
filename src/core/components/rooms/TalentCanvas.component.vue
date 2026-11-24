<template>
  <div class="talent-canvas-shell" :class="{ 'is-editor': editable }">
    <div class="canvas-toolbar">
      <div class="canvas-heading"><strong class="canvas-title" :title="tree.name">{{ tree.name }}</strong><span class="canvas-title-separator" aria-hidden="true">·</span><span class="canvas-caption"><v-icon :icon="editable ? 'mdi-vector-polyline' : 'mdi-source-branch'" size="17" />{{ t('talents.design.talentCount', visibleNodes.length) }}</span><slot name="heading-details" /></div>
      <div class="canvas-actions"><slot name="toolbar-actions" /><v-btn v-if="editable" icon="mdi-shape-outline" variant="text" size="small" :aria-label="t('talents.design.addShape')" :title="t('talents.design.addShape')" @click="emit('create-decoration', canvasCenter())" />
      <div class="canvas-zoom-controls"><v-btn icon="mdi-minus" variant="text" :aria-label="t('talents.zoomOut')" size="x-small" @click="zoomAt(zoom - .15)" /><span>{{ Math.round(zoom * 100) }}%</span><v-btn icon="mdi-plus" variant="text" :aria-label="t('talents.zoomIn')" size="x-small" @click="zoomAt(zoom + .15)" /></div>
      <v-btn class="canvas-fit-control" size="small" variant="text" :aria-label="t('talents.fit')" @click="resetView"><v-icon icon="mdi-fit-to-screen-outline" size="18" /><span class="canvas-fit-label">{{ t('talents.fit') }}</span></v-btn><slot name="toolbar-end" />
      </div>
    </div>
    <div v-if="editable && selectedConnection" class="canvas-connection-actions">
      <span>{{ connectionLabel(selectedConnection.parent, selectedConnection.child) }}</span>
      <TalentConnectionStyles :line="selectedConnectionStyle" :arrow="selectedArrowStyle" allow-reset :line-override="!!selectedEdge?.style" :arrow-override="!!selectedEdge?.arrow" @update:line="emit('style-connection', selectedConnection.parent, selectedConnection.child, $event)" @update:arrow="emit('arrow-connection', selectedConnection.parent, selectedConnection.child, $event)" @reset-line="emit('style-connection', selectedConnection.parent, selectedConnection.child, null)" @reset-arrow="emit('arrow-connection', selectedConnection.parent, selectedConnection.child, null)" />
      <v-btn color="error" variant="tonal" size="small" prepend-icon="mdi-link-off" @click="removeSelectedConnection">{{ t('talents.design.removeConnection') }}</v-btn><v-btn icon="mdi-close" variant="text" size="x-small" :aria-label="t('common.close')" @click="selectedConnection = null" />
    </div>
    <p v-if="regionId" class="pa-2">{{ t('talents.drawHint') }}</p>
    <div ref="viewport" class="canvas-viewport" tabindex="0" :aria-label="t('talents.canvas')" :class="{ 'is-panning': isPanning }" @pointerdown="startCanvasGesture" @dblclick="createAtPointer" @contextmenu.prevent @wheel.prevent="onWheel" @keydown.esc="connectionEscape">
      <div class="canvas-scroll-space" :style="{ width: workspace.width + 'px', height: workspace.height + 'px', backgroundSize: `${100 * zoom}px ${100 * zoom}px, ${100 * zoom}px ${100 * zoom}px, ${20 * zoom}px ${20 * zoom}px, ${20 * zoom}px ${20 * zoom}px`, backgroundPosition: `${canvasPadding.x + offset.x * zoom}px ${canvasPadding.y + offset.y * zoom}px` }">
      <div class="talent-world" :style="{ width: bounds.width + 'px', height: bounds.height + 'px', transform: `translate(${canvasPadding.x}px, ${canvasPadding.y}px) scale(${zoom})` }">
        <TalentDecorations :decorations="decorations" :editable="editable" :offset="offset" :zoom="zoom" :snap="snapDecoration" @edit="emit('edit-decoration', $event)" @move="(id, x, y) => emit('move-decoration', id, x, y)" @resize="(id, width, height) => emit('resize-decoration', id, width, height)" @gesture-start="freezeForDecoration" @gesture-end="endDecorationGesture" />
        <svg class="connections" :width="bounds.width" :height="bounds.height" aria-hidden="true">
          <defs><marker :id="arrowId" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" /></marker>
            <marker :id="arrowId + '-chevron'" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 1 1 L 9 5 L 1 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></marker>
            <marker :id="arrowId + '-diamond'" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 5 L 5 0 L 10 5 L 5 10 z" fill="currentColor" /></marker>
          </defs>
          <template v-if="!editable && (tree.layout === 'free' || (tree.layout === 'classic' && tree.options.separators))">
            <g v-for="subtree in tree.subtrees" :key="subtree.id">
              <rect :x="subtree.x + offset.x" :y="subtree.y + offset.y" :width="subtree.width" :height="subtree.height" rx="12" class="subtree-region" />
              <text :x="subtree.x + offset.x + 12" :y="subtree.y + offset.y + 24" fill="currentColor">{{ subtree.name }}</text>
            </g>
          </template>
          <g v-if="tree.layout === 'centered' && tree.options.separators"><g v-for="(subtree, index) in tree.subtrees" :key="subtree.id"><line :x1="offset.x + 600" :y1="offset.y + 500" :x2="offset.x + 600 + Math.cos((index - .5) / tree.subtrees.length * Math.PI * 2 - Math.PI / 2) * radialRadius" :y2="offset.y + 500 + Math.sin((index - .5) / tree.subtrees.length * Math.PI * 2 - Math.PI / 2) * radialRadius" class="talent-edge" stroke-dasharray="6 4" /><text v-if="!editable" :x="offset.x + 600 + Math.cos(index / tree.subtrees.length * Math.PI * 2 - Math.PI / 2) * (radialRadius - 24)" :y="offset.y + 500 + Math.sin(index / tree.subtrees.length * Math.PI * 2 - Math.PI / 2) * (radialRadius - 24)" fill="currentColor">{{ subtree.name }}</text></g></g>
          <path v-for="edge in editable ? [] : visibleEdges" :key="edge.parent + ':' + edge.child" :d="edgePath(edge)" :class="{ 'is-acquired': (states?.[edge.parent]?.level ?? 0) > 0 && (states?.[edge.child]?.level ?? 0) > 0 }" :marker-end="edgeMarker(edge)" class="talent-edge" />
          <template v-if="tree.layout === 'centered' && tree.options.startingNodes === 0"><line v-for="root in visibleNodes.filter(node => !tree.edges.some(edge => edge.child === node.id))" :key="'hub-' + root.id" :x1="offset.x + 600" :y1="offset.y + 500" :x2="position(root.id).x + 32" :y2="position(root.id).y + 32" class="talent-edge talent-hub-edge" /></template>
          <circle v-if="tree.layout === 'centered' && tree.options.startingNodes === 0" :cx="offset.x + 600" :cy="offset.y + 500" r="12" class="subtree-region" />
        </svg>
        <div v-if="editable" v-for="subtree in canvasSubtrees" :key="'subtree-' + subtree.id" class="canvas-subtree" :class="{ 'is-dragging': draggingSubtree === subtree.id, 'is-resizing': resizingSubtree === subtree.id, 'is-centered': tree.layout === 'centered' }" :data-subtree-id="subtree.id" :style="{ left: subtree.x + offset.x + 'px', top: subtree.y + offset.y + 'px', width: subtree.width + 'px', height: subtree.height + 'px' }">
          <div class="canvas-subtree-heading"><button type="button" class="canvas-subtree-name" :aria-label="t('talents.design.editSubtree') + ': ' + subtree.name" @click.stop="emit('edit-subtree', subtree.id)"><v-icon :icon="subtree.icon || 'mdi-layers-outline'" size="15" /><span>{{ subtree.name }}</span></button><button type="button" class="canvas-subtree-drag" :aria-label="t('talents.design.moveSubtree') + ': ' + subtree.name" :title="t('talents.design.dragSubtreeHint')" @pointerdown="startSubtreeDrag($event, subtree.id)" @keydown="moveSubtreeWithKeys($event, subtree.id)" @click.stop><v-icon icon="mdi-cursor-move" size="17" /></button></div>
          <button v-for="edge in resizeEdges" :key="edge" type="button" class="subtree-resize-handle" :class="'resize-' + edge" :aria-label="t('talents.design.resizeSubtree') + ': ' + subtree.name + ' (' + t('talents.design.resizeEdges.' + edge) + ')'" :title="t('talents.design.resizeHint')" @pointerdown="startSubtreeResize($event, subtree.id, edge)" @keydown="resizeSubtreeWithKeys($event, subtree.id, edge)" @click.stop />
        </div>
        <svg v-if="editable && (majorGridSnap.x !== null || majorGridSnap.y !== null)" class="canvas-grid-guides" :width="bounds.width" :height="bounds.height" aria-hidden="true">
          <line v-if="majorGridSnap.x !== null" data-axis="vertical" :x1="majorGridSnap.x + offset.x" :x2="majorGridSnap.x + offset.x" :y1="guideFrame().y" :y2="guideFrame().y + guideFrame().height" />
          <line v-if="majorGridSnap.y !== null" data-axis="horizontal" :y1="majorGridSnap.y + offset.y" :y2="majorGridSnap.y + offset.y" :x1="guideFrame().x" :x2="guideFrame().x + guideFrame().width" />
        </svg>
        <svg v-if="editable && centerSnap" class="canvas-alignment-guides" :width="bounds.width" :height="bounds.height" aria-hidden="true">
          <line v-if="centerSnap.vertical" data-axis="vertical" :x1="centerSnap.region.x + centerSnap.region.width / 2 + offset.x" :x2="centerSnap.region.x + centerSnap.region.width / 2 + offset.x" :y1="centerSnap.region.y + offset.y" :y2="centerSnap.region.y + centerSnap.region.height + offset.y" />
          <line v-if="centerSnap.horizontal" data-axis="horizontal" :y1="centerSnap.region.y + centerSnap.region.height / 2 + offset.y" :y2="centerSnap.region.y + centerSnap.region.height / 2 + offset.y" :x1="centerSnap.region.x + offset.x" :x2="centerSnap.region.x + centerSnap.region.width + offset.x" />
          <circle :cx="centerSnap.region.x + centerSnap.region.width / 2 + offset.x" :cy="centerSnap.region.y + centerSnap.region.height / 2 + offset.y" r="4" />
        </svg>
        <svg v-if="editable" class="connection-editor-layer" :width="bounds.width" :height="bounds.height">
          <g v-for="edge in visibleEdges" :key="edge.parent + ':' + edge.child">
            <path :d="edgePath(edge)" class="talent-edge editor-edge" :class="{ 'is-selected': selectedConnection?.parent === edge.parent && selectedConnection?.child === edge.child }" :marker-end="edgeMarker(edge)" />
            <path :d="edgePath(edge)" class="connection-hit-target" :data-parent="edge.parent" :data-child="edge.child" role="button" tabindex="0" :aria-label="t('talents.design.connection') + ': ' + connectionLabel(edge.parent, edge.child)" :aria-pressed="selectedConnection?.parent === edge.parent && selectedConnection?.child === edge.child" @pointerdown="selectConnection($event, edge)" @click.stop="selectedConnection = edge" @keydown="connectionKeydown($event, edge)" />
          </g>
          <path v-if="connectionSource && connectionPointer" :d="previewPath()" class="connection-preview" :class="{ 'is-invalid': connectionTarget && talentConnectionError(tree, connectionSource, connectionTarget) }" :marker-end="arrowMarker(tree.options.connectionArrow ?? 'triangle')" />
        </svg>
        <div v-for="node in visibleNodes" :key="node.id" class="node-controls" :class="{ 'is-connecting': connectionSource }" :style="{ left: position(node.id).x + 'px', top: position(node.id).y + 'px' }">
        <button type="button" class="talent-node" :style="talentColorStyle(node.color)" :data-color="node.color" :data-node-id="node.id" :data-category="node.category ?? 'passive'" :class="{ 'is-unallocated': !editable && !(states?.[node.id]?.level ?? 0), 'is-partial': !editable && (states?.[node.id]?.level ?? 0) > 0 && (states?.[node.id]?.level ?? 0) < node.levels.length, 'is-connection-target': connectionSource && connectionTarget === node.id && !talentConnectionError(tree, connectionSource, node.id), selected: selected === node.id, available: states?.[node.id]?.canAllocate, maximum: states?.[node.id]?.level === node.levels.length, acquired: (states?.[node.id]?.level ?? 0) > 0, locked: !editable && !states?.[node.id]?.canAllocate && !(states?.[node.id]?.level ?? 0) }" :aria-label="node.name + ': ' + (states?.[node.id]?.level ?? 0) + '/' + node.levels.length" :aria-pressed="selected === node.id" @pointerdown="startDrag($event, node)" @click="clicked(node.id)" @dblclick="editable && emit('edit-node', node.id)" @keydown="nodeKeydown($event, node.id)">
          <TalentImage :room-id="roomId" :image-id="node.imageId" :icon="node.icon" class="node-icon" />
          <span v-if="!editable" class="node-state" :class="{ 'state-bottom-left': tree.options.levelPosition === 'top-right' }"><v-icon v-if="states?.[node.id]?.level === node.levels.length" icon="mdi-check" size="12" /><v-icon v-else-if="(states?.[node.id]?.level ?? 0) > 0" icon="mdi-circle-half-full" size="12" /><v-icon v-else-if="states?.[node.id]?.canAllocate" icon="mdi-plus" size="12" /><v-icon v-else-if="!(states?.[node.id]?.level ?? 0)" icon="mdi-lock-outline" size="11" /></span>
          <span class="node-kind" :class="{ 'is-active-skill': node.category === 'active' }" :title="t('talents.progression.' + (node.category ?? 'passive'))" aria-hidden="true"><v-icon :icon="node.category === 'active' ? 'mdi-lightning-bolt' : 'mdi-shield-outline'" size="11" /></span>
          <span v-if="node.linkedTreeId || node.unlocksTree" class="node-tree-link" :title="t('talents.progression.unlockAnother')" aria-hidden="true"><v-icon icon="mdi-file-tree-outline" size="11" /></span>
          <span v-if="!editable" class="node-progress" aria-hidden="true"><span :style="{ width: Math.min(100, (states?.[node.id]?.level ?? 0) / node.levels.length * 100) + '%' }" /></span>
          <span v-if="!tree.options.iconsOnly" class="node-name" :class="{ 'name-below-level': tree.options.levelPosition === 'bottom' }">{{ node.name }}</span>
          <span class="node-level" :class="'level-' + tree.options.levelPosition">{{ states?.[node.id]?.level ?? 0 }}/{{ node.levels.length }}</span>
          <v-tooltip activator="parent" location="top" max-width="320" content-class="talent-node-tooltip">
            <strong>{{ node.name }}</strong><span class="talent-kind-label"><v-icon :icon="node.category === 'active' ? 'mdi-lightning-bolt' : 'mdi-shield-outline'" size="12" />{{ t('talents.progression.' + (node.category ?? 'passive')) }}</span><p v-if="node.description">{{ node.description }}</p>
            <p v-if="!editable && (states?.[node.id]?.level ?? 0) < node.levels.length" class="talent-cost-label">{{ costLabel(states?.[node.id]?.cost ?? rankCost(node, states?.[node.id]?.level ?? 0)) }}</p>
            <p v-if="node.autoUnlock" class="talent-cost-label">{{ t('talents.progression.autoUnlock') }}</p>
            <p v-if="node.linkedTreeId || node.unlocksTree">{{ linkedTreeLabel(node.linkedTreeId) }}</p>
            <template v-for="(rank, index) in node.levels" :key="rank.id">
              <div v-if="rank.name?.trim() || rank.description?.trim()" class="talent-tooltip-rank" :class="{ 'is-unreached': index >= (states?.[node.id]?.level ?? 0) }" :data-reached="index < (states?.[node.id]?.level ?? 0)">
                <strong><span class="talent-tooltip-rank-number">{{ t('talents.level') }} {{ index + 1 }}<template v-if="rank.name?.trim()"> · </template></span>{{ rank.name }}</strong>
                <p v-if="rank.description?.trim()">{{ rank.description }}</p>
              </div>
            </template>
            <p v-if="states?.[node.id]?.reason">{{ t('talents.reasons.' + states[node.id]!.reason) }}</p>
            <TalentRequirements v-if="!editable && states?.[node.id]?.reason === 'prerequisites'" :state="states?.[node.id]" />
          </v-tooltip>
        </button>
        <button v-if="editable" v-for="side in connectorSides" :key="side" type="button" class="node-connector" :class="{ 'is-active': connectionSource === node.id && sourceSide === side, 'is-target': connectionTarget === node.id && targetSide === side }" :data-node-id="node.id" :data-side="side" :style="{ left: connectorOffsets[side].x + 'px', top: connectorOffsets[side].y + 'px' }" :aria-label="t('talents.design.connectFrom') + ': ' + node.name + ' (' + t('talents.design.connectorSides.' + side) + ')'" :title="t('talents.design.connectorHint')" @pointerenter="hoverConnectionTarget(node.id, side)" @pointerdown="startConnection($event, node.id, side)" @click.stop.prevent="connectorClick($event, node.id, side)" />
        </div>
      </div>
      </div>
      <div v-if="!visibleNodes.length && !decorations.length" class="canvas-empty"><div class="canvas-empty-card"><span><v-icon icon="mdi-source-branch" size="36" /></span><h3>{{ t(editable ? 'talents.design.blankCanvas' : 'talents.design.noVisibleTalents') }}</h3><p>{{ t(editable ? 'talents.design.blankCanvasHint' : 'talents.design.lockedCanvasHint') }}</p><v-btn v-if="editable" color="primary" variant="tonal" prepend-icon="mdi-plus" @click="emit('create')">{{ t('talents.design.placeFirstTalent') }}</v-btn></div></div>
    </div>
    <nav v-if="unlockedPaths.length" class="canvas-linked-paths" :aria-label="t('talents.progression.unlockedPaths')">
      <div class="canvas-paths-heading"><v-icon icon="mdi-lock-open-variant-outline" size="14" />{{ t('talents.progression.unlockedPaths') }}</div>
      <div class="canvas-paths-list"><button v-for="{ tree: target, sources } in unlockedPaths" :key="target.id" type="button" class="canvas-path-link" :aria-label="t('talents.progression.openLinkedTree', { name: target.name })" :title="target.name" @click="emit('open-tree', target.id)"><span class="canvas-path-icon"><TalentImage :room-id="roomId" :image-id="target.imageId" :icon="target.icon" /></span><span class="canvas-path-copy"><strong>{{ target.name }}</strong><small>{{ t('talents.progression.linkedVia', { names: sources.map(node => node.name).join(', ') }) }}</small></span><v-icon icon="mdi-arrow-top-right" size="18" /></button></div>
    </nav>
    <div v-if="editable" class="canvas-interaction-hint"><v-icon icon="mdi-cursor-move" size="14" />{{ t('talents.dragHint') }}</div>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, useId, onBeforeUnmount, onMounted, nextTick, watch } from 'vue';
import { talentConnectionError, rankCost } from 'netlify/core/utils/talents';
import { useI18n } from 'vue-i18n';

import { talentColorStyle } from './talent-colors';
import TalentImage from './TalentImage.component.vue';
import TalentDecorations from './TalentDecorations.component.vue';
import TalentConnectionStyles from './TalentConnectionStyles.component.vue';
import TalentRequirements from './TalentRequirements.component.vue';
import type { TalentTree, TalentNode, TalentNodeState, TalentEdge, TalentConnectorSide, TalentConnectionStyle, TalentArrowStyle, TalentSubtree } from 'netlify/core/types/talents.types';
const props = defineProps<{ tree: TalentTree; roomId: string; editable?: boolean; selected?: string | null; regionId?: string | null; states?: Record<string, TalentNodeState>; linkedTrees?: TalentTree[] }>();
const emit = defineEmits<{ select: [id: string]; 'open-tree': [id: string]; allocate: [id: string]; revert: [id: string]; move: [id: string, x: number, y: number]; region: [id: string, x: number, y: number, width: number, height: number]; create: [point?: { x: number; y: number }]; 'edit-node': [id: string]; 'edit-subtree': [id: string]; 'move-subtree': [id: string, dx: number, dy: number]; 'subtree-drag-start': [id: string]; 'subtree-drag-end': [id: string]; 'resize-subtree': [id: string, x: number, y: number, width: number, height: number]; connect: [parent: string, child: string, parentSide: TalentConnectorSide, childSide: TalentConnectorSide]; disconnect: [parent: string, child: string]; 'style-connection': [parent: string, child: string, style: TalentConnectionStyle | null]; 'arrow-connection': [parent: string, child: string, arrow: TalentArrowStyle | null]; 'create-decoration': [point: { x: number; y: number }]; 'edit-decoration': [id: string]; 'move-decoration': [id: string, x: number, y: number]; 'resize-decoration': [id: string, width: number, height: number] }>();
const { t } = useI18n(); const arrowId = useId();
const zoom = ref(1), viewport = ref<HTMLElement>();
const isPanning = ref(false), draggingSubtree = ref<string | null>(null), resizingSubtree = ref<string | null>(null);
const connectionSource = ref<string | null>(null), connectionTarget = ref<string | null>(null), connectionPointer = ref<{ x: number; y: number } | null>(null);
const connectorSides = ['top', 'right', 'bottom', 'left'] as const;
const connectorOffsets = { top: { x: 32, y: 0 }, right: { x: 64, y: 32 }, bottom: { x: 32, y: 64 }, left: { x: 0, y: 32 } };
const connectorDirections = { top: { x: 0, y: -1 }, right: { x: 1, y: 0 }, bottom: { x: 0, y: 1 }, left: { x: -1, y: 0 } };
const sourceSide = ref<TalentConnectorSide>('right'), targetSide = ref<TalentConnectorSide>('left');
const selectedConnection = ref<{ parent: string; child: string } | null>(null);
const selectedEdge = computed(() => props.tree.edges.find(edge => edge.parent === selectedConnection.value?.parent && edge.child === selectedConnection.value?.child));
const selectedConnectionStyle = computed(() => selectedEdge.value?.style ?? props.tree.options.connectionStyle ?? 'rounded');
const selectedArrowStyle = computed(() => selectedEdge.value?.arrow ?? props.tree.options.connectionArrow ?? 'triangle');
function arrowMarker(arrow: TalentArrowStyle) { return arrow === 'none' ? 'none' : `url(#${arrowId}${arrow === 'triangle' ? '' : '-' + arrow})`; }
function edgeMarker(edge: TalentEdge) { return arrowMarker(edge.arrow ?? props.tree.options.connectionArrow ?? 'triangle'); }

const resizeEdges = ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'] as const;
type ResizeEdge = typeof resizeEdges[number];
type SubtreeBounds = { x: number; y: number; width: number; height: number };
const minimumZoom = computed(() => props.editable ? .25 : .01);
const navigationPadding = computed(() => props.editable ? 1600 : 0);
const visibleNodes = computed(() => props.tree.nodes.filter(n => props.editable || !props.states?.[n.id]?.hidden));
const decorations = computed(() => props.tree.decorations ?? []);
const unlockedPaths = computed(() => props.editable ? [] : (props.linkedTrees ?? []).filter(tree => tree.id !== props.tree.id).map(tree => ({ tree, sources: visibleNodes.value.filter(node => node.linkedTreeId === tree.id && (props.states?.[node.id]?.level ?? 0) > 0) })).filter(path => path.sources.length));
const visibleEdges = computed(() => props.tree.edges.filter(e => visibleNodes.value.some(n => n.id === e.parent) && visibleNodes.value.some(n => n.id === e.child)));
const snapRegions = ref<TalentSubtree[] | null>(null);
const majorGridSnap = ref<{ x: number | null; y: number | null }>({ x: null, y: null });
const centerSnap = ref<{ region: TalentSubtree; vertical: boolean; horizontal: boolean } | null>(null);
const canvasSubtrees = computed(() => snapRegions.value ?? props.tree.subtrees.map(subtree => {
  if (props.tree.layout !== 'centered' || subtree.boundsMode === 'manual') return subtree;
  const members = props.tree.nodes.filter(node => node.subtreeId === subtree.id);
  if (!members.length) return subtree;
  const x = Math.min(...members.map(node => node.x)) - 32, y = Math.min(...members.map(node => node.y)) - 56;
  return { ...subtree, x, y, width: Math.max(180, Math.max(...members.map(node => node.x)) + 96 - x), height: Math.max(120, Math.max(...members.map(node => node.y)) + 96 - y) };
}));
const viewportSize = ref({ width: 600, height: 420 });
const radialRadius = computed(() => Math.max(220, ...visibleNodes.value.map(node => Math.hypot(node.x + 32 - 600, node.y + 32 - 500))) + 70);
const frozenContent = ref<{ minX: number; minY: number; maxX: number; maxY: number } | null>(null);
const content = computed(() => {
  if (frozenContent.value) return frozenContent.value;
  const showRegions = props.editable || props.tree.layout === 'free' || (props.tree.layout === 'classic' && props.tree.options.separators);
  const regions: { x: number; y: number; width: number; height: number }[] = showRegions ? [...canvasSubtrees.value] : props.tree.layout === 'centered' && props.tree.options.separators && props.tree.subtrees.length ? [{ x: 600 - radialRadius.value, y: 500 - radialRadius.value, width: radialRadius.value * 2, height: radialRadius.value * 2 }] : [];
  if (props.tree.layout === 'centered' && props.tree.options.separators && props.tree.subtrees.length) regions.push({ ...props.tree.subtrees[0]!, x: 600 - radialRadius.value, y: 500 - radialRadius.value, width: radialRadius.value * 2, height: radialRadius.value * 2 });
  regions.push(...decorations.value);
  const hub = props.tree.layout === 'centered' && props.tree.options.startingNodes === 0 && visibleNodes.value.length ? [{ x: 588, y: 488 }] : [];
  const items = [...visibleNodes.value, ...hub];
  const minX = Math.min(...(props.editable && props.tree.layout === 'free' ? [0] : []), ...items.map(n => n.x), ...regions.map(r => r.x));
  const minY = Math.min(...(props.editable && props.tree.layout === 'free' ? [0] : []), ...items.map(n => n.y), ...regions.map(r => r.y));
  const maxX = Math.max(...items.map(n => n.x + 64), ...regions.map(r => r.x + r.width));
  const maxY = Math.max(...items.map(n => n.y + (props.tree.options.iconsOnly ? 64 : 108)), ...regions.map(r => r.y + r.height));
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : { minX: 0, minY: 0, maxX: 160, maxY: 160 };
});
const offset = computed(() => ({ x: (props.editable ? 80 : (bounds.value.width - content.value.maxX + content.value.minX) / 2) - content.value.minX, y: (props.editable ? 80 : (bounds.value.height - content.value.maxY + content.value.minY) / 2) - content.value.minY }));
const bounds = computed(() => ({ width: Math.max(280, content.value.maxX - content.value.minX + 160), height: Math.max(260, content.value.maxY - content.value.minY + 160) }));
const workspace = computed(() => ({
  width: Math.max(viewportSize.value.width, bounds.value.width * zoom.value) + navigationPadding.value * zoom.value * 2,
  height: Math.max(viewportSize.value.height, bounds.value.height * zoom.value) + navigationPadding.value * zoom.value * 2
}));
const canvasPadding = computed(() => ({
  x: navigationPadding.value * zoom.value + Math.max(0, (viewportSize.value.width - bounds.value.width * zoom.value) / 2),
  y: navigationPadding.value * zoom.value + Math.max(0, (viewportSize.value.height - bounds.value.height * zoom.value) / 2)
}));
function guideFrame() { return { x: ((viewport.value?.scrollLeft ?? 0) - canvasPadding.value.x) / zoom.value, y: ((viewport.value?.scrollTop ?? 0) - canvasPadding.value.y) / zoom.value, width: viewportSize.value.width / zoom.value, height: viewportSize.value.height / zoom.value }; }
function canvasCenter() { const frame = guideFrame(); return { x: frame.x + frame.width / 2 - offset.value.x, y: frame.y + frame.height / 2 - offset.value.y }; }
function freezeForDecoration() { cleanup(); frozenContent.value = { ...content.value }; snapRegions.value = canvasSubtrees.value.map(region => ({ ...region })); }
function endDecorationGesture() { centerSnap.value = null; majorGridSnap.value = { x: null, y: null }; snapRegions.value = null; releaseFrozenContent(); }
function snapDecoration(shape: { width: number; height: number }, x: number, y: number) { return snapPosition(x, y, shape.width, shape.height); }
function snapPosition(rawX: number, rawY: number, width: number, height: number, subtreeId?: string | null) {
  const scale = zoom.value, cx = rawX + width / 2, cy = rawY + height / 2;
  const regions = (snapRegions.value ?? canvasSubtrees.value).filter(region => cx >= region.x && cx <= region.x + region.width && cy >= region.y && cy <= region.y + region.height);
  const region = regions.find(region => region.id === subtreeId) ?? regions[0];
  const vertical = !!region && Math.abs(cx - region.x - region.width / 2) * scale <= 10;
  const horizontal = !!region && Math.abs(cy - region.y - region.height / 2) * scale <= 10;
  centerSnap.value = region && (vertical || horizontal) ? { region, vertical, horizontal } : null;
  const gridX = Math.round(cx / 100) * 100, gridY = Math.round(cy / 100) * 100;
  const gridVertical = !vertical && Math.abs(cx - gridX) * scale <= 10;
  const gridHorizontal = !horizontal && Math.abs(cy - gridY) * scale <= 10;
  majorGridSnap.value = { x: gridVertical ? gridX : null, y: gridHorizontal ? gridY : null };
  return { x: vertical ? region!.x + region!.width / 2 - width / 2 : gridVertical ? gridX - width / 2 : Math.round(rawX / 20) * 20, y: horizontal ? region!.y + region!.height / 2 - height / 2 : gridHorizontal ? gridY - height / 2 : Math.round(rawY / 20) * 20 };
}
function position(id: string) { const n = props.tree.nodes.find(n => n.id === id); return { x: (n?.x ?? 0) + offset.value.x, y: (n?.y ?? 0) + offset.value.y }; }
function connectorPoint(id: string, side: TalentConnectorSide) { const point = position(id), delta = connectorOffsets[side]; return { x: point.x + delta.x, y: point.y + delta.y }; }
function connectionCurve(a: { x: number; y: number }, b: { x: number; y: number }, from: TalentConnectorSide, to?: TalentConnectorSide) {
  const bend = Math.max(40, Math.min(180, Math.hypot(b.x - a.x, b.y - a.y) / 2)), da = connectorDirections[from], db = connectorDirections[to ?? 'left'];
  return `M ${a.x} ${a.y} C ${a.x + da.x * bend} ${a.y + da.y * bend}, ${b.x + db.x * bend} ${b.y + db.y * bend}, ${b.x} ${b.y}`;
}
function squareConnection(a: { x: number; y: number }, b: { x: number; y: number }, from: TalentConnectorSide, to: TalentConnectorSide) {
  const da = connectorDirections[from], db = connectorDirections[to], lead = 32;
  const start = { x: a.x + da.x * lead, y: a.y + da.y * lead }, end = { x: b.x + db.x * lead, y: b.y + db.y * lead };
  const middle = da.x && db.x ? `L ${(start.x + end.x) / 2} ${start.y} L ${(start.x + end.x) / 2} ${end.y}`
    : da.y && db.y ? `L ${start.x} ${(start.y + end.y) / 2} L ${end.x} ${(start.y + end.y) / 2}`
    : da.x ? `L ${end.x} ${start.y}` : `L ${start.x} ${end.y}`;
  return `M ${a.x} ${a.y} L ${start.x} ${start.y} ${middle} L ${end.x} ${end.y} L ${b.x} ${b.y}`;
}
function connectionPath(start: { x: number; y: number }, end: { x: number; y: number }, from: TalentConnectorSide, to: TalentConnectorSide, style: TalentConnectionStyle) {
  if (style === 'straight') return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  if (style === 'square') return squareConnection(start, end, from, to);
  return connectionCurve(start, end, from, to);
}
function previewPath() {
  if (!connectionSource.value || !connectionPointer.value) return '';
  return connectionPath(connectorPoint(connectionSource.value, sourceSide.value), connectionPointer.value, sourceSide.value, connectionTarget.value ? targetSide.value : 'left', props.tree.options.connectionStyle ?? 'rounded');
}
function edgePath(edge: TalentEdge) {
  const { parent, child } = edge, a = position(parent), b = position(child);
  if (props.editable || edge.parentSide || edge.childSide || edge.style || props.tree.options.connectionStyle) {
    const from = edge.parentSide ?? 'right', to = edge.childSide ?? 'left', start = connectorPoint(parent, from), end = connectorPoint(child, to);
    return connectionPath(start, end, from, to, edge.style ?? props.tree.options.connectionStyle ?? 'rounded');
  }
  const x1 = a.x + 32, y1 = a.y + 32, x2 = b.x + 32, y2 = b.y + 32;
  return props.tree.layout === 'classic' ? `M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}` : `M ${x1} ${y1} L ${x2} ${y2}`;
}
function centerView() {
  viewport.value?.scrollTo({
    left: canvasPadding.value.x + bounds.value.width * zoom.value / 2 - viewportSize.value.width / 2,
    top: canvasPadding.value.y + bounds.value.height * zoom.value / 2 - viewportSize.value.height / 2
  });
}
let manualView = false;
function resetView() {
  manualView = false;
  zoom.value = Math.max(minimumZoom.value, Math.min(1, (viewportSize.value.width - 32) / bounds.value.width, (viewportSize.value.height - 32) / bounds.value.height));
  void nextTick(centerView);
}
function frameStartingNode() {
  if (!props.editable) { resetView(); return; }
  centerView();
  if (viewportSize.value.width >= 450 || !viewport.value) return;
  const node = visibleNodes.value.find(n => n.id === props.selected) ?? visibleNodes.value.find(n => !props.tree.edges.some(e => e.child === n.id)) ?? visibleNodes.value[0];
  if (!node) return;
  const point = position(node.id);
  viewport.value.scrollTo({ left: (point.x + 32) * zoom.value + canvasPadding.value.x - viewportSize.value.width / 2, top: (point.y + 32) * zoom.value + canvasPadding.value.y - viewportSize.value.height / 2 });
}
/** Keep the world point under the pointer stable as the zoom changes. */
function zoomAt(value: number, pointer?: { x: number; y: number }) {
  const el = viewport.value;
  if (!el) return;
  const next = Math.max(minimumZoom.value, Math.min(props.editable ? 2 : 8, value));
  if (next === zoom.value) return;
  manualView = true;
  const rect = el.getBoundingClientRect();
  const inside = pointer && pointer.x >= rect.left && pointer.x <= rect.right && pointer.y >= rect.top && pointer.y <= rect.bottom;
  const x = inside ? pointer.x - rect.left : el.clientWidth / 2;
  const y = inside ? pointer.y - rect.top : el.clientHeight / 2;
  const worldX = (el.scrollLeft + x - canvasPadding.value.x) / zoom.value;
  const worldY = (el.scrollTop + y - canvasPadding.value.y) / zoom.value;
  zoom.value = next;
  void nextTick(() => el.scrollTo({ left: canvasPadding.value.x + worldX * next - x, top: canvasPadding.value.y + worldY * next - y }));
}
let wheelFrame: number | null = null, wheelDelta = 0;
let wheelPointer = { x: 0, y: 0 };
function onWheel(event: WheelEvent) {
  if (isPanning.value || frozenContent.value) return;
  wheelDelta += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewportSize.value.height : 1);
  wheelPointer = { x: event.clientX, y: event.clientY };
  if (wheelFrame !== null) return;
  wheelFrame = window.requestAnimationFrame(() => {
    zoomAt(zoom.value * Math.exp(-wheelDelta * .0015), wheelPointer);
    wheelDelta = 0; wheelFrame = null;
  });
}
function onFocusedWheel(event: WheelEvent) {
  const el = viewport.value, target = event.target;
  if (event.defaultPrevented || !el || !el.getClientRects().length || !el.contains(document.activeElement) || document.querySelector('.v-overlay--active:not(.v-tooltip)')) return;
  if (target instanceof Element && target.closest('.canvas-viewport')) return;
  event.preventDefault(); onWheel(event);
}
let observer: ResizeObserver | undefined;
let initialized = false;
onMounted(async () => {
  await nextTick();
  if (!viewport.value) return;
  observer = new ResizeObserver(([entry]) => {
    if (!entry || entry.contentRect.width <= 0 || entry.contentRect.height <= 0) return;
    viewportSize.value = { width: entry.contentRect.width, height: entry.contentRect.height };
    if (!initialized) { initialized = true; void nextTick(frameStartingNode); }
    else if (!props.editable && !manualView) void nextTick(resetView);
  });
  observer.observe(viewport.value);
  document.addEventListener('wheel', onFocusedWheel, { passive: false });
});
watch(() => props.tree.id, () => { zoom.value = 1; void nextTick(frameStartingNode); });
let cleanup = () => {}; let dragged = false;
function releaseFrozenContent() {
  if (!frozenContent.value) return;
  const el = viewport.value, x = canvasPadding.value.x + offset.value.x * zoom.value, y = canvasPadding.value.y + offset.value.y * zoom.value;
  const left = el?.scrollLeft ?? 0, top = el?.scrollTop ?? 0;
  frozenContent.value = null;
  void nextTick(() => el?.scrollTo({ left: left + canvasPadding.value.x + offset.value.x * zoom.value - x, top: top + canvasPadding.value.y + offset.value.y * zoom.value - y }));
}
function startDrag(event: PointerEvent, node: TalentNode) {
  if (!props.editable || event.button !== 0 || connectionSource.value) return;
  cleanup(); dragged = false; frozenContent.value = { ...content.value };
  // Auto-sized centered subtrees stay still while their centerlines are used.
  snapRegions.value = canvasSubtrees.value.map(region => ({ ...region }));
  const x = event.clientX, y = event.clientY, originalX = node.x, originalY = node.y, scale = zoom.value;
  let finished = false;
  const move = (e: PointerEvent) => {
    if (Math.abs(e.clientX - x) + Math.abs(e.clientY - y) > 5) dragged = true;
    if (!dragged) return;
    const rawX = originalX + (e.clientX - x) / scale, rawY = originalY + (e.clientY - y) / scale;
    const point = snapPosition(rawX, rawY, 64, 64, node.subtreeId);
    emit('move', node.id, point.x, point.y);
  };
  const up = () => cleanup();
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up, { once: true }); window.addEventListener('pointercancel', up, { once: true }); window.addEventListener('blur', up, { once: true });
  cleanup = () => {
    if (finished) return; finished = true;
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); window.removeEventListener('blur', up);
    centerSnap.value = null; majorGridSnap.value = { x: null, y: null }; snapRegions.value = null; releaseFrozenContent();
  };
}
function createAtPointer(event: MouseEvent) {
  if (!props.editable || event.button !== 0 || props.regionId || connectionSource.value || !viewport.value) return;
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest('button, input, select, textarea, a, [role="button"], .node-controls, .canvas-subtree-heading')) return;
  event.preventDefault();
  const el = viewport.value, rect = el.getBoundingClientRect();
  emit('create', { x: (event.clientX - rect.left + el.scrollLeft - canvasPadding.value.x) / zoom.value - offset.value.x, y: (event.clientY - rect.top + el.scrollTop - canvasPadding.value.y) / zoom.value - offset.value.y });
}
function startCanvasGesture(event: PointerEvent) {
  if (event.button !== 0 && event.button !== 2) return;
  const target = event.target instanceof Element ? event.target : null;
  const nodeId = target?.closest<HTMLElement>('.talent-node')?.dataset.nodeId;
  const subtreeId = target?.closest<HTMLElement>('.canvas-subtree')?.dataset.subtreeId;
  const decorationId = target?.closest<HTMLElement>('.canvas-decoration')?.dataset.decorationId;
  if (event.button === 0 && target?.closest('button, input, select, textarea, a')) return;
  if (event.button === 0 && nodeId) return;
  cancelConnection(); selectedConnection.value = null; startPan(event, nodeId, subtreeId, decorationId);
}
function startPan(event: PointerEvent, nodeId?: string, subtreeId?: string, decorationId?: string) {
  const el = viewport.value;
  if (!el) return;
  cleanup();
  el.focus({ preventScroll: true });
  if (event.button === 2) event.preventDefault();
  if (props.regionId && event.button === 0) {
    const id = props.regionId, rect = el.getBoundingClientRect();
    const startX = (event.clientX - rect.left + el.scrollLeft - canvasPadding.value.x) / zoom.value - offset.value.x;
    const startY = (event.clientY - rect.top + el.scrollTop - canvasPadding.value.y) / zoom.value - offset.value.y;
    const up = (end: PointerEvent) => {
      const x = (end.clientX - rect.left + el.scrollLeft - canvasPadding.value.x) / zoom.value - offset.value.x;
      const y = (end.clientY - rect.top + el.scrollTop - canvasPadding.value.y) / zoom.value - offset.value.y;
      emit('region', id, Math.round(Math.min(startX, x) / 20) * 20, Math.round(Math.min(startY, y) / 20) * 20, Math.max(80, Math.round(Math.abs(x - startX) / 20) * 20), Math.max(80, Math.round(Math.abs(y - startY) / 20) * 20));
      cleanup();
    };
    window.addEventListener('pointerup', up, { once: true });
    window.addEventListener('pointercancel', cancel, { once: true });
    cleanup = () => { window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); };
    return;
  }
  const x = event.clientX, y = event.clientY, left = el.scrollLeft, top = el.scrollTop;
  let moved = false;
  const move = (e: PointerEvent) => {
    if (Math.hypot(e.clientX - x, e.clientY - y) > 4) moved = true;
    if (!moved) return;
    manualView = true;
    isPanning.value = true;
    el.scrollLeft = left - (e.clientX - x); el.scrollTop = top - (e.clientY - y);
  };
  const up = () => {
    cleanup();
    if (event.button === 2 && !moved) {
      if (nodeId) { if (props.editable) emit('edit-node', nodeId); else emit('revert', nodeId); }
      else if (decorationId && props.editable) emit('edit-decoration', decorationId);
      else if (subtreeId && props.editable) emit('edit-subtree', subtreeId);
    }
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up, { once: true });
  window.addEventListener('pointercancel', cancel, { once: true });
  window.addEventListener('blur', cancel, { once: true });
  cleanup = () => {
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel); window.removeEventListener('blur', cancel);
    isPanning.value = false;
  };
}
function startSubtreeDrag(event: PointerEvent, id: string) {
  if (event.button !== 0 || !props.editable) return;
  event.preventDefault(); event.stopPropagation(); cleanup();
  frozenContent.value = { ...content.value }; draggingSubtree.value = id;
  emit('subtree-drag-start', id);
  const x = event.clientX, y = event.clientY, scale = zoom.value;
  let previousX = 0, previousY = 0, finished = false;
  const move = (e: PointerEvent) => {
    const dx = Math.round((e.clientX - x) / scale / 20) * 20, dy = Math.round((e.clientY - y) / scale / 20) * 20;
    if (dx !== previousX || dy !== previousY) emit('move-subtree', id, dx - previousX, dy - previousY);
    previousX = dx; previousY = dy;
  };
  const up = () => cleanup();
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up, { once: true });
  window.addEventListener('pointercancel', up, { once: true }); window.addEventListener('blur', up, { once: true });
  cleanup = () => {
    if (finished) return; finished = true;
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up); window.removeEventListener('blur', up);
    emit('subtree-drag-end', id); draggingSubtree.value = null; releaseFrozenContent();
  };
}
function resizeBounds(bounds: SubtreeBounds, edge: ResizeEdge, dx: number, dy: number): SubtreeBounds {
  let left = bounds.x, top = bounds.y, right = bounds.x + bounds.width, bottom = bounds.y + bounds.height;
  if (edge.includes('e')) right = Math.max(left + 80, right + dx);
  if (edge.includes('s')) bottom = Math.max(top + 80, bottom + dy);
  if (edge.includes('w')) left = Math.min(right - 80, left + dx);
  if (edge.includes('n')) top = Math.min(bottom - 80, top + dy);
  return { x: left, y: top, width: right - left, height: bottom - top };
}
function emitResize(id: string, bounds: SubtreeBounds) { const current = canvasSubtrees.value.find(subtree => subtree.id === id); if (current && current.x === bounds.x && current.y === bounds.y && current.width === bounds.width && current.height === bounds.height) return; emit('resize-subtree', id, bounds.x, bounds.y, bounds.width, bounds.height); }
function startSubtreeResize(event: PointerEvent, id: string, edge: ResizeEdge) {
  if (event.button !== 0 || !props.editable) return;
  const subtree = canvasSubtrees.value.find(subtree => subtree.id === id);
  if (!subtree) return;
  event.preventDefault(); event.stopPropagation(); cleanup();
  const bounds = { x: subtree.x, y: subtree.y, width: subtree.width, height: subtree.height };
  const x = event.clientX, y = event.clientY, scale = zoom.value;
  frozenContent.value = { ...content.value }; resizingSubtree.value = id;
  emit('subtree-drag-start', id);
  let finished = false;
  const move = (e: PointerEvent) => emitResize(id, resizeBounds(bounds, edge, Math.round((e.clientX - x) / scale / 20) * 20, Math.round((e.clientY - y) / scale / 20) * 20));
  const up = () => cleanup();
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up, { once: true });
  window.addEventListener('pointercancel', up, { once: true }); window.addEventListener('blur', up, { once: true });
  cleanup = () => {
    if (finished) return; finished = true;
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up); window.removeEventListener('blur', up);
    emit('subtree-drag-end', id); resizingSubtree.value = null; releaseFrozenContent();
  };
}
function resizeSubtreeWithKeys(event: KeyboardEvent, id: string, edge: ResizeEdge) {
  const delta = ({ ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] } as Record<string, [number, number]>)[event.key];
  const subtree = canvasSubtrees.value.find(subtree => subtree.id === id);
  if (!delta || !subtree) return;
  event.preventDefault(); event.stopPropagation(); cleanup(); frozenContent.value = { ...content.value };
  emit('subtree-drag-start', id); emitResize(id, resizeBounds(subtree, edge, delta[0], delta[1])); emit('subtree-drag-end', id); releaseFrozenContent();
}
function moveSubtreeWithKeys(event: KeyboardEvent, id: string) {
  const delta = ({ ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] } as Record<string, [number, number]>)[event.key];
  if (!delta) return;
  event.preventDefault(); event.stopPropagation(); cleanup(); frozenContent.value = { ...content.value };
  emit('subtree-drag-start', id); emit('move-subtree', id, delta[0], delta[1]); emit('subtree-drag-end', id); releaseFrozenContent();
}
function nodeKeydown(event: KeyboardEvent, id: string) {
  if (props.editable && (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))) { event.preventDefault(); emit('edit-node', id); }
}
function costLabel(cost: number) { return cost === 0 ? t('talents.progression.free') : t('talents.progression.cost', { cost }); }
function linkedTreeLabel(id?: string | null) { const tree = props.linkedTrees?.find(tree => tree.id === id); return tree ? t('talents.progression.unlockNamed', { name: tree.name }) : t('talents.progression.unlockAnother'); }
function connectionLabel(parent: string, child: string) { return `${props.tree.nodes.find(node => node.id === parent)?.name ?? ''} → ${props.tree.nodes.find(node => node.id === child)?.name ?? ''}`; }
function selectConnection(event: PointerEvent, edge: { parent: string; child: string }) {
  if (event.button !== 0) return;
  event.stopPropagation(); cancelConnection(); selectedConnection.value = edge;
}
function connectionKeydown(event: KeyboardEvent, edge: { parent: string; child: string }) {
  if (['Enter', ' '].includes(event.key)) { event.preventDefault(); selectedConnection.value = edge; }
  if (['Delete', 'Backspace'].includes(event.key)) { event.preventDefault(); emit('disconnect', edge.parent, edge.child); selectedConnection.value = null; }
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); selectedConnection.value = null; }
}
function removeSelectedConnection() { if (selectedConnection.value) emit('disconnect', selectedConnection.value.parent, selectedConnection.value.child); selectedConnection.value = null; }
function cancelConnection() { if (!connectionSource.value) return; cleanup(); connectionSource.value = null; connectionTarget.value = null; connectionPointer.value = null; }
function connectionEscape(event: KeyboardEvent) { if (!connectionSource.value && !selectedConnection.value) return; event.preventDefault(); event.stopPropagation(); cancelConnection(); selectedConnection.value = null; }
function hoverConnectionTarget(id: string, side: TalentConnectorSide) { if (!connectionSource.value) return; connectionTarget.value = id; targetSide.value = side; connectionPointer.value = connectorPoint(id, side); }
function connectorClick(event: MouseEvent, id: string, side: TalentConnectorSide) {
  if (event.detail !== 0) return;
  if (connectionSource.value) { const source = connectionSource.value; const from = sourceSide.value; cancelConnection(); emit('connect', source, id, from, side); }
  else { connectionSource.value = id; sourceSide.value = side; selectedConnection.value = null; connectionPointer.value = connectorPoint(id, side); }
}
function startConnection(event: PointerEvent, id: string, side: TalentConnectorSide) {
  if (event.button !== 0 || !props.editable) return;
  if (connectionSource.value) { event.preventDefault(); event.stopPropagation(); const source = connectionSource.value, from = sourceSide.value; cancelConnection(); emit('connect', source, id, from, side); return; }
  event.preventDefault(); event.stopPropagation(); cancelConnection(); cleanup();
  viewport.value?.focus({ preventScroll: true });
  connectionSource.value = id; sourceSide.value = side; selectedConnection.value = null; frozenContent.value = { ...content.value };
  const x = event.clientX, y = event.clientY;
  let moved = false, finished = false;
  const update = (e: PointerEvent) => {
    const el = viewport.value!; const rect = el.getBoundingClientRect();
    moved ||= Math.hypot(e.clientX - x, e.clientY - y) > 4;
    const dot = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('.node-connector');
    connectionTarget.value = dot && el.contains(dot) ? dot.dataset.nodeId ?? null : null;
    targetSide.value = (dot?.dataset.side as TalentConnectorSide) ?? 'left';
    connectionPointer.value = connectionTarget.value ? connectorPoint(connectionTarget.value, targetSide.value) : { x: (e.clientX - rect.left + el.scrollLeft - canvasPadding.value.x) / zoom.value, y: (e.clientY - rect.top + el.scrollTop - canvasPadding.value.y) / zoom.value };
  };
  update(event);
  const up = (e: PointerEvent) => {
    update(e); const target = connectionTarget.value, to = targetSide.value, keep = !moved && target === id; cleanup();
    if (keep) { connectionSource.value = id; connectionPointer.value = connectorPoint(id, side); }
    else if (target) emit('connect', id, target, side, to);
  };
  const abort = () => cleanup();
  window.addEventListener('pointermove', update); window.addEventListener('pointerup', up, { once: true }); window.addEventListener('pointercancel', abort, { once: true }); window.addEventListener('blur', abort, { once: true });
  cleanup = () => {
    if (finished) return; finished = true;
    window.removeEventListener('pointermove', update); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', abort); window.removeEventListener('blur', abort);
    connectionSource.value = null; connectionTarget.value = null; connectionPointer.value = null; releaseFrozenContent();
  };
}
watch(visibleEdges, edges => { if (selectedConnection.value && !edges.some(edge => edge.parent === selectedConnection.value!.parent && edge.child === selectedConnection.value!.child)) selectedConnection.value = null; });
function cancel() { cleanup(); }
function clicked(id: string) { if (props.editable && connectionSource.value) { cancelConnection(); return; } selectedConnection.value = null; if (dragged) { dragged = false; return; } emit('select', id); if (!props.editable) emit('allocate', id); }
onBeforeUnmount(() => { cleanup(); observer?.disconnect(); document.removeEventListener('wheel', onFocusedWheel); if (wheelFrame !== null) window.cancelAnimationFrame(wheelFrame); });
</script>
<style scoped>
.talent-canvas-shell:not(.is-editor) .canvas-scroll-space { background-image:none; }
.talent-canvas-shell:not(.is-editor) { height:auto; min-height:0; }.talent-canvas-shell:not(.is-editor) .canvas-viewport { min-height:0; max-height:none; contain:size; }
.talent-canvas-shell:not(.is-editor) .canvas-heading { flex-wrap:wrap; row-gap:4px; }.talent-canvas-shell:not(.is-editor) .canvas-title { flex-shrink:0; }
.talent-canvas-shell { position:relative; display:flex; flex-direction:column; min-width:0; min-height:380px; height:100%; background:rgb(var(--v-theme-surface)); }.canvas-toolbar { display:flex; flex-wrap:wrap; gap:8px; align-items:center; padding:8px 12px; border-bottom:1px solid rgba(var(--v-border-color),var(--v-border-opacity)); background:rgb(var(--v-theme-surface)); flex-shrink:0; }.canvas-heading { display:flex; align-items:center; gap:10px; min-width:0; flex:1 1 160px; }.canvas-title { font-size:13px; font-weight:650; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:220px; }.canvas-title-separator { color:rgba(var(--v-theme-on-surface),.3); }.canvas-actions { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-left:auto; }.canvas-fit-control :deep(.v-btn__content) { gap:6px; }.canvas-caption { display:flex; align-items:center; gap:7px; font-size:11px; color:rgba(var(--v-theme-on-surface),.55); white-space:nowrap; }.canvas-zoom-controls { display:flex; align-items:center; border:1px solid rgba(var(--v-border-color),var(--v-border-opacity)); border-radius:8px; gap:1px; }.canvas-zoom-controls > span { min-width:38px; text-align:center; font-size:10px; font-variant-numeric:tabular-nums; color:rgba(var(--v-theme-on-surface),.65); }.canvas-viewport { overflow:auto; flex:1; min-height:340px; height:44vh; max-height:620px; position:relative; background-color:rgba(var(--v-theme-primary), .018); background-image:radial-gradient(ellipse at 50% 40%,rgba(var(--v-theme-primary), .055),transparent 70%); touch-action:pan-x pan-y; cursor:grab; }.canvas-viewport.is-panning,.canvas-viewport.is-panning :deep(*) { cursor:grabbing !important; user-select:none; }.canvas-scroll-space {
  position:relative;
  overflow:hidden;
  background-image:
    linear-gradient(to right, rgba(var(--v-theme-on-surface), .18) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(var(--v-theme-on-surface), .18) 1px, transparent 1px),
    linear-gradient(to right, rgba(var(--v-theme-on-surface), .09) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(var(--v-theme-on-surface), .09) 1px, transparent 1px);
  background-repeat:repeat;
}.talent-world { position:absolute; top:0; left:0; transform-origin:top left; }.connections { position:absolute; inset:0; pointer-events:none; color:rgb(var(--v-theme-primary)); }.talent-edge { stroke:currentColor; stroke-width:2; opacity:.22; fill:none; }.talent-edge.is-acquired { opacity:.8; stroke-width:2.5; }.subtree-region { fill:rgba(var(--v-theme-primary), .035); stroke:rgba(var(--v-theme-primary), .18); stroke-dasharray:6 5; }.connections text { font-size:12px; font-weight:600; opacity:.7; }.talent-node { position:absolute; z-index:2; width:64px; height:64px; display:flex; align-items:center; justify-content:center; border:1.5px solid rgba(var(--v-theme-on-surface), .22); border-radius:18px; background:rgb(var(--v-theme-surface)); color:rgba(var(--v-theme-on-surface),.65); cursor:pointer; box-shadow:0 3px 10px rgba(0,0,0,.05); transition:box-shadow 160ms ease,border-color 160ms ease; }.talent-node[data-color] { color:rgb(var(--talent-accent)); border-color:rgba(var(--talent-accent),.4); }.talent-node.locked[data-color] .node-icon { filter:none; }.talent-node.available { border-color:rgb(var(--talent-accent, var(--v-theme-primary))); color:rgb(var(--talent-accent, var(--v-theme-primary))); box-shadow:0 0 0 4px rgba(var(--talent-accent, var(--v-theme-primary)), .08),0 4px 12px rgba(var(--talent-accent, var(--v-theme-primary)),.08); }.talent-node.acquired { background:rgb(var(--v-theme-surface)); border-color:rgb(var(--talent-accent, var(--v-theme-primary))); color:rgb(var(--talent-accent, var(--v-theme-primary))); box-shadow:inset 0 0 0 5px rgba(var(--talent-accent, var(--v-theme-primary)), .1); }.talent-node.maximum { background:rgb(var(--talent-accent, var(--v-theme-primary))); border-color:rgb(var(--talent-accent, var(--v-theme-primary))); color:rgb(var(--talent-on-accent, var(--v-theme-on-primary))); box-shadow:0 0 0 4px rgba(var(--talent-accent, var(--v-theme-primary)), .12),0 4px 12px rgba(var(--talent-accent, var(--v-theme-primary)),.12); }.talent-node.locked .node-icon { opacity:.45; filter:grayscale(1); }.talent-node.selected,.talent-node:focus-visible { outline:2px solid rgb(var(--talent-accent, var(--v-theme-primary))); outline-offset:7px; }.talent-node:hover { box-shadow:0 0 0 5px rgba(var(--talent-accent, var(--v-theme-primary)), .1); border-color:rgb(var(--talent-accent, var(--v-theme-primary))); }.node-icon { width:32px; height:32px; object-fit:contain; font-size:30px; }.node-state { position:absolute; top:-6px; right:-6px; width:20px; height:20px; display:grid; place-items:center; border-radius:7px; background:rgb(var(--v-theme-surface)); border:1px solid rgba(var(--v-border-color),var(--v-border-opacity)); color:rgba(var(--v-theme-on-surface),.45); }.available .node-state,.maximum .node-state { background:rgb(var(--talent-accent, var(--v-theme-primary))); color:rgb(var(--talent-on-accent, var(--v-theme-on-primary))); border-color:rgb(var(--v-theme-surface)); }.node-state:empty { display:none; }.node-state.state-bottom-left { top:auto; right:auto; bottom:-6px; left:-6px; }.node-name.name-below-level { top:92px; }.node-name { position:absolute; top:76px; width:140px; font-size:11px; font-weight:600; text-align:center; color:rgb(var(--v-theme-on-surface)); }.node-level { position:absolute; font-size:10px; font-weight:700; font-variant-numeric:tabular-nums; background:rgb(var(--v-theme-surface)); color:rgba(var(--v-theme-on-surface),.8); padding:2px 6px; border-radius:6px; border:1px solid rgba(var(--v-border-color),var(--v-border-opacity)); white-space:nowrap; }.maximum .node-level { color:rgb(var(--talent-accent, var(--v-theme-primary))); border-color:rgba(var(--talent-accent, var(--v-theme-primary)),.3); }.level-top { bottom:calc(100% + 4px); }.level-bottom { top:calc(100% + 4px); }.level-top-left { top:-10px; left:-10px; }.level-top-right { top:-10px; right:-10px; }.level-bottom-left { bottom:-10px; left:-10px; }.level-bottom-right { bottom:-10px; right:-10px; }.node-tooltip { display:none; position:absolute; left:82px; top:0; width:220px; padding:14px; border-radius:12px; z-index:5; background:rgb(var(--v-theme-surface)); color:rgba(var(--v-theme-on-surface),.7); border:1px solid rgba(var(--v-border-color),var(--v-border-opacity)); box-shadow:0 10px 30px rgba(0,0,0,.12); text-align:left; pointer-events:none; white-space:pre-wrap; font-size:11px; line-height:1.7; }.node-tooltip strong { font-size:13px; color:rgb(var(--v-theme-on-surface)); }.talent-node:hover,.talent-node:focus { z-index:6; }.talent-node:hover .node-tooltip,.talent-node:focus-visible .node-tooltip { display:block; }.canvas-interaction-hint { display:flex; gap:6px; align-items:center; padding:10px 14px; font-size:10px; color:rgba(var(--v-theme-on-surface),.5); border-top:1px solid rgba(var(--v-border-color),var(--v-border-opacity)); }.canvas-empty { position:absolute; inset:0; display:flex; flex-direction:column; justify-content:center; align-items:center; padding:24px; gap:14px; text-align:center; pointer-events:none; }.canvas-empty-card { display:flex; flex-direction:column; align-items:center; gap:12px; width:100%; max-width:340px; padding:20px; border:1px solid rgba(var(--v-border-color),var(--v-border-opacity)); border-radius:18px; background:rgb(var(--v-theme-surface)); box-shadow:0 8px 28px rgba(0,0,0,.08); }.canvas-empty-card > span { display:grid; place-items:center; width:48px; height:48px; border:1px dashed rgba(var(--v-theme-primary),.3); border-radius:24px; color:rgb(var(--v-theme-primary)); background:rgba(var(--v-theme-primary),.035); }.canvas-empty h3 { font-size:17px; font-weight:650; letter-spacing:-.02em; }.canvas-empty p { font-size:12px; line-height:1.7; color:rgba(var(--v-theme-on-surface),.6); max-width:260px; }.canvas-empty .v-btn { pointer-events:auto; }.is-editor .canvas-viewport { height:52vh; max-height:none; }.is-editor .talent-node { touch-action:none; color:rgb(var(--talent-accent, var(--v-theme-primary))); border-color:rgba(var(--talent-accent, var(--v-theme-primary)),.4); }
@media(max-width:600px) { .canvas-heading { flex-basis:100%; }.canvas-actions { width:100%; justify-content:flex-end; gap:6px; }.canvas-actions :deep(.v-btn) { font-size:11px; }.canvas-fit-label { display:none; }.canvas-fit-control { min-width:30px; padding:0 6px; }.canvas-caption { font-size:10px; }.canvas-toolbar { padding:8px; gap:4px; }.canvas-viewport { min-height:300px; height:40vh; }.is-editor .canvas-viewport { height:44vh; }.canvas-interaction-hint { font-size:9px; } }
@media(prefers-reduced-motion:reduce) { .talent-node { transition:none; } }
.canvas-subtree { position:absolute; z-index:1; border:1px dashed rgba(var(--v-theme-primary),.25); border-radius:12px; background:rgba(var(--v-theme-primary),.035); }.canvas-subtree.is-centered { background:rgba(var(--v-theme-primary),.015); border-color:rgba(var(--v-theme-primary),.15); }.canvas-subtree.is-dragging,.canvas-subtree.is-resizing { border-style:solid; border-color:rgb(var(--v-theme-primary)); box-shadow:0 0 0 3px rgba(var(--v-theme-primary),.08); }.canvas-subtree-heading { display:flex; align-items:center; gap:8px; padding:10px; }.canvas-subtree-name { display:flex; align-items:center; gap:7px; min-width:0; flex:1; text-align:left; padding:4px 6px; color:rgb(var(--v-theme-primary)); font-size:12px; font-weight:600; cursor:pointer; }.canvas-subtree-name span { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }.canvas-subtree-drag { display:grid; place-items:center; width:28px; height:28px; border-radius:7px; border:1px solid rgba(var(--v-theme-primary),.2); background:rgb(var(--v-theme-surface)); color:rgb(var(--v-theme-primary)); cursor:grab; flex-shrink:0; touch-action:none; }.canvas-subtree-drag:active { cursor:grabbing; }.canvas-subtree-drag:focus-visible,.canvas-subtree-name:focus-visible { outline:2px solid rgb(var(--v-theme-primary)); outline-offset:2px; }

.subtree-resize-handle { position:absolute; z-index:3; border:0; padding:0; background:transparent; touch-action:none; opacity:0; transition:opacity 120ms ease; }
.canvas-subtree:hover > .subtree-resize-handle,.canvas-subtree:focus-within > .subtree-resize-handle,.canvas-subtree.is-resizing > .subtree-resize-handle { opacity:1; }
.subtree-resize-handle::after { content:''; position:absolute; top:50%; left:50%; width:7px; height:7px; transform:translate(-50%,-50%); border:1px solid rgb(var(--v-theme-primary)); border-radius:2px; background:rgb(var(--v-theme-surface)); }
.resize-n,.resize-s { left:12px; right:12px; height:12px; cursor:ns-resize; }.resize-n { top:-6px; }.resize-s { bottom:-6px; }
.resize-e,.resize-w { top:12px; bottom:12px; width:12px; cursor:ew-resize; }.resize-e { right:-6px; }.resize-w { left:-6px; }
.resize-ne,.resize-nw,.resize-se,.resize-sw { width:16px; height:16px; }.resize-ne,.resize-sw { cursor:nesw-resize; }.resize-nw,.resize-se { cursor:nwse-resize; }
.resize-ne { top:-8px; right:-8px; }.resize-nw { top:-8px; left:-8px; }.resize-se { bottom:-8px; right:-8px; }.resize-sw { bottom:-8px; left:-8px; }
.subtree-resize-handle:focus-visible { opacity:1; outline:2px solid rgb(var(--v-theme-primary)); outline-offset:2px; }
@media(pointer:coarse) { .subtree-resize-handle { opacity:1; }.resize-n,.resize-s { height:20px; }.resize-n { top:-10px; }.resize-s { bottom:-10px; }.resize-e,.resize-w { width:20px; }.resize-e { right:-10px; }.resize-w { left:-10px; }.resize-ne,.resize-nw,.resize-se,.resize-sw { width:24px; height:24px; }.resize-ne { top:-12px; right:-12px; }.resize-nw { top:-12px; left:-12px; }.resize-se { bottom:-12px; right:-12px; }.resize-sw { bottom:-12px; left:-12px; } }
@media(prefers-reduced-motion:reduce) { .subtree-resize-handle { transition:none; } }

.node-controls { position:absolute; width:64px; height:64px; z-index:2; }.node-controls:hover,.node-controls:focus-within { z-index:8; }
.node-controls > .talent-node { left:0; top:0; }
.node-connector { opacity:0; pointer-events:none; position:absolute; z-index:7; width:12px; height:12px; transform:translate(-50%,-50%); display:grid; place-items:center; border:2px solid rgb(var(--v-theme-surface)); border-radius:50%; color:rgb(var(--v-theme-primary)); background:rgb(var(--v-theme-primary)); cursor:crosshair; touch-action:none; box-shadow:0 0 0 3px rgba(var(--v-theme-surface),.85); }
.node-controls:hover .node-connector,.node-controls:focus-within .node-connector,.node-controls.is-connecting .node-connector { opacity:1; pointer-events:auto; }
@media (hover:none) { .node-connector { opacity:1; pointer-events:auto; } }
.node-connector.is-target,.node-connector:hover,.node-connector.is-active,.node-connector:focus-visible { background:rgb(var(--v-theme-primary)); color:rgb(var(--v-theme-on-primary)); outline:2px solid rgba(var(--v-theme-primary),.25); outline-offset:3px; }
.talent-node.is-connection-target { outline:3px dashed rgb(var(--v-theme-success)); outline-offset:6px; }
.connection-editor-layer { position:absolute; inset:0; z-index:2; pointer-events:none; overflow:visible; color:rgb(var(--v-theme-primary)); }
.editor-edge { opacity:.5; pointer-events:none; }.editor-edge.is-selected { opacity:1; stroke-width:3; }
.connection-hit-target { stroke:transparent; stroke-width:16; fill:none; pointer-events:stroke; cursor:pointer; vector-effect:non-scaling-stroke; outline:none; }
.connection-hit-target:focus-visible { stroke:rgba(var(--v-theme-primary),.2); outline:none; }
.connection-preview { fill:none; stroke:rgb(var(--v-theme-primary)); stroke-width:2; stroke-dasharray:6 4; pointer-events:none; }.connection-preview.is-invalid { stroke:rgb(var(--v-theme-error)); }
.canvas-connection-actions { display:flex; flex-wrap:wrap; align-items:center; gap:8px; padding:8px 12px; border-bottom:1px solid rgba(var(--v-border-color),var(--v-border-opacity)); background:rgba(var(--v-theme-primary),.04); }
.canvas-connection-actions > span { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12px; }.canvas-connection-actions .v-btn { flex-shrink:0; }
/* Investment has shape and fill cues as well as the numeric rank badge. */
.talent-node.is-unallocated { border-style:dashed; }
.talent-node.is-partial { border:2px solid rgb(var(--talent-accent, var(--v-theme-primary))); background-image:linear-gradient(135deg,rgba(var(--talent-accent, var(--v-theme-primary)),.3),rgba(var(--talent-accent, var(--v-theme-primary)),.12)); box-shadow:inset 0 0 0 3px rgba(var(--talent-accent, var(--v-theme-primary)),.12),0 0 0 3px rgba(var(--talent-accent, var(--v-theme-primary)),.1); }
.is-partial .node-state { background:rgb(var(--talent-accent, var(--v-theme-primary))); color:rgb(var(--talent-on-accent, var(--v-theme-on-primary))); border-color:rgb(var(--v-theme-surface)); }
.node-progress { position:absolute; left:12px; right:12px; bottom:8px; height:4px; border-radius:3px; overflow:hidden; background:rgba(var(--v-theme-on-surface),.16); }
.node-progress > span { display:block; height:100%; border-radius:inherit; background:rgb(var(--talent-accent, var(--v-theme-primary))); }
.maximum .node-progress { background:rgba(var(--talent-on-accent, var(--v-theme-on-primary)),.25); }.maximum .node-progress > span { background:rgb(var(--talent-on-accent, var(--v-theme-on-primary))); }
.canvas-alignment-guides { position:absolute; inset:0; z-index:9; overflow:visible; pointer-events:none; color:rgb(var(--v-theme-primary)); }
.canvas-alignment-guides line { stroke:currentColor; stroke-width:1.5; stroke-dasharray:6 4; vector-effect:non-scaling-stroke; }
.canvas-alignment-guides circle { fill:currentColor; stroke:rgb(var(--v-theme-surface)); stroke-width:2; vector-effect:non-scaling-stroke; }
.canvas-grid-guides { position:absolute; inset:0; z-index:8; overflow:visible; pointer-events:none; }
.canvas-grid-guides line { stroke:rgb(var(--v-theme-primary)); stroke-width:1.5; opacity:.8; vector-effect:non-scaling-stroke; }
.node-kind,.node-tree-link { position:absolute; left:-8px; top:18px; display:grid; place-items:center; width:16px; height:16px; border-radius:50%; border:1px solid rgba(var(--v-border-color),var(--v-border-opacity)); background:rgb(var(--v-theme-surface)); color:rgba(var(--v-theme-on-surface),.65); pointer-events:none; }
.node-kind.is-active-skill { background:rgb(var(--talent-accent, var(--v-theme-primary))); color:rgb(var(--talent-on-accent, var(--v-theme-on-primary))); }.node-tree-link { top:38px; color:rgb(var(--talent-accent, var(--v-theme-primary))); }
/* Category silhouettes remain distinct in every investment/availability state. */
.talent-node[data-category="passive"] { border-radius:50%; }
.talent-node[data-category="active"] { border-radius:6px; }
.canvas-linked-paths { position:absolute; z-index:10; left:14px; right:14px; bottom:14px; width:max-content; max-width:calc(100% - 28px); max-height:min(150px, 40%); overflow:auto; padding:10px; border:1px solid rgba(var(--v-theme-primary),.25); border-radius:14px; background:rgb(var(--v-theme-surface)); box-shadow:0 6px 24px rgba(0,0,0,.12); }
.canvas-paths-heading { display:flex; align-items:center; gap:6px; color:rgb(var(--v-theme-primary)); font-size:10px; font-weight:600; margin:0 2px 7px; }.canvas-paths-list { display:flex; flex-wrap:wrap; gap:8px; }.canvas-path-link { display:flex; align-items:center; gap:10px; padding:8px 10px; max-width:100%; min-width:0; width:240px; border:1px solid var(--talent-border); border-radius:9px; text-align:left; background:rgba(var(--v-theme-primary),.045); }.canvas-path-link:hover,.canvas-path-link:focus-visible { border-color:rgb(var(--v-theme-primary)); outline:2px solid rgba(var(--v-theme-primary),.2); outline-offset:1px; }.canvas-path-icon { display:grid; place-items:center; width:32px; height:32px; flex-shrink:0; color:rgb(var(--v-theme-primary)); }.canvas-path-icon :deep(img) { width:26px; height:26px; object-fit:contain; }.canvas-path-icon :deep(.v-icon) { font-size:25px; }.canvas-path-copy { display:flex; flex-direction:column; gap:3px; flex:1; min-width:0; }.canvas-path-copy strong { font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.canvas-path-copy small { font-size:10px; color:var(--talent-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.canvas-path-link > .v-icon { color:rgb(var(--v-theme-primary)); flex-shrink:0; }
@media(max-width:700px) {
  .canvas-linked-paths { position:static; flex-shrink:0; width:auto; max-width:none; max-height:50px; padding:4px 8px; border:0; border-top:1px solid var(--talent-border); border-radius:0; box-shadow:none; }
  .canvas-paths-heading { display:none; }.canvas-paths-list { flex-wrap:nowrap; }.canvas-path-link { width:auto; flex-shrink:0; padding:4px 8px; gap:6px; }.canvas-path-icon { width:20px; height:20px; }.canvas-path-icon :deep(img) { width:18px; height:18px; }.canvas-path-icon :deep(.v-icon) { font-size:18px; }.canvas-path-copy strong { font-size:11px; }.canvas-path-copy small { display:none; }
}
</style>

