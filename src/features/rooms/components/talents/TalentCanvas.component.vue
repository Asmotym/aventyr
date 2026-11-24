<template>
  <div class="talent-canvas" :class="{ 'talent-canvas--editor': editable }">
    <div class="talent-canvas__toolbar">
      <div class="talent-canvas__heading"><strong class="talent-canvas__title" :title="tree.name">{{ tree.name }}</strong><span class="talent-canvas__title-separator" aria-hidden="true">·</span><span class="talent-canvas__caption"><v-icon :icon="editable ? 'mdi-vector-polyline' : 'mdi-source-branch'" size="17" />{{ t('talents.design.talentCount', visibleNodes.length) }}</span><slot name="heading-details" /></div>
      <div class="talent-canvas__actions"><slot name="toolbar-actions" /><v-btn v-if="editable" icon="mdi-shape-outline" variant="text" size="small" :aria-label="t('talents.design.addShape')" :title="t('talents.design.addShape')" @click="emit('create-decoration', canvasCenter())" />
      <div class="talent-canvas__zoom-controls"><v-btn icon="mdi-minus" variant="text" :aria-label="t('talents.zoomOut')" size="x-small" @click="zoomAt(zoom - .15)" /><span>{{ Math.round(zoom * 100) }}%</span><v-btn icon="mdi-plus" variant="text" :aria-label="t('talents.zoomIn')" size="x-small" @click="zoomAt(zoom + .15)" /></div>
      <v-btn class="talent-canvas__fit-control" size="small" variant="text" :aria-label="t('talents.fit')" @click="resetView"><v-icon icon="mdi-fit-to-screen-outline" size="18" /><span class="talent-canvas__fit-label">{{ t('talents.fit') }}</span></v-btn><slot name="toolbar-end" />
      </div>
    </div>
    <div v-if="editable && selectedConnection" class="talent-canvas__connection-actions">
      <span>{{ connectionLabel(selectedConnection.parent, selectedConnection.child) }}</span>
      <TalentConnectionStyles :line="selectedConnectionStyle" :arrow="selectedArrowStyle" allow-reset :line-override="!!selectedEdge?.style" :arrow-override="!!selectedEdge?.arrow" @update:line="emit('style-connection', selectedConnection.parent, selectedConnection.child, $event)" @update:arrow="emit('arrow-connection', selectedConnection.parent, selectedConnection.child, $event)" @reset-line="emit('style-connection', selectedConnection.parent, selectedConnection.child, null)" @reset-arrow="emit('arrow-connection', selectedConnection.parent, selectedConnection.child, null)" />
      <v-btn color="error" variant="tonal" size="small" prepend-icon="mdi-link-off" @click="removeSelectedConnection">{{ t('talents.design.removeConnection') }}</v-btn><AppCloseButton size="x-small" @click="selectedConnection = null" />
    </div>
    <p v-if="regionId" class="pa-2">{{ t('talents.drawHint') }}</p>
    <div ref="viewport" class="talent-canvas__viewport" tabindex="0" :aria-label="t('talents.canvas')" :class="{ 'talent-canvas__viewport--panning': isPanning }" @pointerdown="startCanvasGesture" @dblclick="createAtPointer" @contextmenu.prevent @wheel.prevent="onWheel" @keydown.esc="connectionEscape">
      <div class="talent-canvas__scroll-space" :style="{ '--talent-canvas-scroll-space-width': workspace.width + 'px', '--talent-canvas-scroll-space-height': workspace.height + 'px', '--talent-canvas-scroll-space-background-size': `${100 * zoom}px ${100 * zoom}px, ${100 * zoom}px ${100 * zoom}px, ${20 * zoom}px ${20 * zoom}px, ${20 * zoom}px ${20 * zoom}px`, '--talent-canvas-scroll-space-background-position': `${canvasPadding.x + offset.x * zoom}px ${canvasPadding.y + offset.y * zoom}px` }">
      <div class="talent-canvas__world" :style="{ '--talent-canvas-world-width': bounds.width + 'px', '--talent-canvas-world-height': bounds.height + 'px', '--talent-canvas-world-transform': `translate(${canvasPadding.x}px, ${canvasPadding.y}px) scale(${zoom})` }">
        <TalentDecorations :decorations="decorations" :editable="editable" :offset="offset" :zoom="zoom" :snap="snapDecoration" @edit="emit('edit-decoration', $event)" @move="(id, x, y) => emit('move-decoration', id, x, y)" @resize="(id, width, height) => emit('resize-decoration', id, width, height)" @gesture-start="freezeForDecoration" @gesture-end="endDecorationGesture" />
        <svg class="talent-canvas__connections" :width="bounds.width" :height="bounds.height" aria-hidden="true">
          <defs><marker :id="arrowId" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" /></marker>
            <marker :id="arrowId + '-chevron'" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 1 1 L 9 5 L 1 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></marker>
            <marker :id="arrowId + '-diamond'" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 5 L 5 0 L 10 5 L 5 10 z" fill="currentColor" /></marker>
          </defs>
          <template v-if="!editable && (tree.layout === 'free' || (tree.layout === 'classic' && tree.options.separators))">
            <g v-for="subtree in tree.subtrees" :key="subtree.id">
              <rect :x="subtree.x + offset.x" :y="subtree.y + offset.y" :width="subtree.width" :height="subtree.height" rx="12" class="talent-canvas__subtree-region" />
              <text :x="subtree.x + offset.x + 12" :y="subtree.y + offset.y + 24" fill="currentColor">{{ subtree.name }}</text>
            </g>
          </template>
          <g v-if="tree.layout === 'centered' && tree.options.separators"><g v-for="(subtree, index) in tree.subtrees" :key="subtree.id"><line :x1="offset.x + 600" :y1="offset.y + 500" :x2="offset.x + 600 + Math.cos((index - .5) / tree.subtrees.length * Math.PI * 2 - Math.PI / 2) * radialRadius" :y2="offset.y + 500 + Math.sin((index - .5) / tree.subtrees.length * Math.PI * 2 - Math.PI / 2) * radialRadius" class="talent-canvas__edge" stroke-dasharray="6 4" /><text v-if="!editable" :x="offset.x + 600 + Math.cos(index / tree.subtrees.length * Math.PI * 2 - Math.PI / 2) * (radialRadius - 24)" :y="offset.y + 500 + Math.sin(index / tree.subtrees.length * Math.PI * 2 - Math.PI / 2) * (radialRadius - 24)" fill="currentColor">{{ subtree.name }}</text></g></g>
          <path v-for="edge in editable ? [] : visibleEdges" :key="edge.parent + ':' + edge.child" :d="edgePath(edge)" :class="{ 'talent-canvas__edge--acquired': (states?.[edge.parent]?.level ?? 0) > 0 && (states?.[edge.child]?.level ?? 0) > 0 }" :marker-end="edgeMarker(edge)" class="talent-canvas__edge" />
          <template v-if="tree.layout === 'centered' && tree.options.startingNodes === 0"><line v-for="root in visibleNodes.filter(node => !tree.edges.some(edge => edge.child === node.id))" :key="'hub-' + root.id" :x1="offset.x + 600" :y1="offset.y + 500" :x2="position(root.id).x + 32" :y2="position(root.id).y + 32" class="talent-canvas__edge talent-hub-edge" /></template>
          <circle v-if="tree.layout === 'centered' && tree.options.startingNodes === 0" :cx="offset.x + 600" :cy="offset.y + 500" r="12" class="talent-canvas__subtree-region" />
        </svg>
        <div v-if="editable" v-for="subtree in canvasSubtrees" :key="'subtree-' + subtree.id" class="talent-canvas__subtree" :class="{ 'talent-canvas__subtree--dragging': draggingSubtree === subtree.id, 'talent-canvas__subtree--resizing': resizingSubtree === subtree.id, 'talent-canvas__subtree--centered': tree.layout === 'centered' }" :data-subtree-id="subtree.id" :style="{ '--talent-canvas-subtree-left': subtree.x + offset.x + 'px', '--talent-canvas-subtree-top': subtree.y + offset.y + 'px', '--talent-canvas-subtree-width': subtree.width + 'px', '--talent-canvas-subtree-height': subtree.height + 'px' }">
          <div class="talent-canvas__subtree-heading"><button type="button" class="talent-canvas__subtree-name" :aria-label="t('talents.design.editSubtree') + ': ' + subtree.name" @click.stop="emit('edit-subtree', subtree.id)"><v-icon :icon="subtree.icon || 'mdi-layers-outline'" size="15" /><span>{{ subtree.name }}</span></button><button type="button" class="talent-canvas__subtree-drag" :aria-label="t('talents.design.moveSubtree') + ': ' + subtree.name" :title="t('talents.design.dragSubtreeHint')" @pointerdown="startSubtreeDrag($event, subtree.id)" @keydown="moveSubtreeWithKeys($event, subtree.id)" @click.stop><v-icon icon="mdi-cursor-move" size="17" /></button></div>
          <button v-for="edge in resizeEdges" :key="edge" type="button" class="talent-canvas__subtree-resize-handle" :class="'talent-canvas__subtree-resize-handle--resize-' + edge" :aria-label="t('talents.design.resizeSubtree') + ': ' + subtree.name + ' (' + t('talents.design.resizeEdges.' + edge) + ')'" :title="t('talents.design.resizeHint')" @pointerdown="startSubtreeResize($event, subtree.id, edge)" @keydown="resizeSubtreeWithKeys($event, subtree.id, edge)" @click.stop />
        </div>
        <svg v-if="editable && (majorGridSnap.x !== null || majorGridSnap.y !== null)" class="talent-canvas__grid-guides" :width="bounds.width" :height="bounds.height" aria-hidden="true">
          <line v-if="majorGridSnap.x !== null" data-axis="vertical" :x1="majorGridSnap.x + offset.x" :x2="majorGridSnap.x + offset.x" :y1="guideFrame().y" :y2="guideFrame().y + guideFrame().height" />
          <line v-if="majorGridSnap.y !== null" data-axis="horizontal" :y1="majorGridSnap.y + offset.y" :y2="majorGridSnap.y + offset.y" :x1="guideFrame().x" :x2="guideFrame().x + guideFrame().width" />
        </svg>
        <svg v-if="editable && centerSnap" class="talent-canvas__alignment-guides" :width="bounds.width" :height="bounds.height" aria-hidden="true">
          <line v-if="centerSnap.vertical" data-axis="vertical" :x1="centerSnap.region.x + centerSnap.region.width / 2 + offset.x" :x2="centerSnap.region.x + centerSnap.region.width / 2 + offset.x" :y1="centerSnap.region.y + offset.y" :y2="centerSnap.region.y + centerSnap.region.height + offset.y" />
          <line v-if="centerSnap.horizontal" data-axis="horizontal" :y1="centerSnap.region.y + centerSnap.region.height / 2 + offset.y" :y2="centerSnap.region.y + centerSnap.region.height / 2 + offset.y" :x1="centerSnap.region.x + offset.x" :x2="centerSnap.region.x + centerSnap.region.width + offset.x" />
          <circle :cx="centerSnap.region.x + centerSnap.region.width / 2 + offset.x" :cy="centerSnap.region.y + centerSnap.region.height / 2 + offset.y" r="4" />
        </svg>
        <svg v-if="editable" class="talent-canvas__connection-editor-layer" :width="bounds.width" :height="bounds.height">
          <g v-for="edge in visibleEdges" :key="edge.parent + ':' + edge.child">
            <path :d="edgePath(edge)" class="talent-canvas__edge talent-canvas__editor-edge" :class="{ 'talent-canvas__editor-edge--selected': selectedConnection?.parent === edge.parent && selectedConnection?.child === edge.child }" :marker-end="edgeMarker(edge)" />
            <path :d="edgePath(edge)" class="talent-canvas__connection-hit-target" :data-parent="edge.parent" :data-child="edge.child" role="button" tabindex="0" :aria-label="t('talents.design.connection') + ': ' + connectionLabel(edge.parent, edge.child)" :aria-pressed="selectedConnection?.parent === edge.parent && selectedConnection?.child === edge.child" @pointerdown="selectConnection($event, edge)" @click.stop="selectedConnection = edge" @keydown="connectionKeydown($event, edge)" />
          </g>
          <path v-if="connectionSource && connectionPointer" :d="previewPath()" class="talent-canvas__connection-preview" :class="{ 'talent-canvas__connection-preview--invalid': connectionTarget && talentConnectionError(tree, connectionSource, connectionTarget) }" :marker-end="arrowMarker(tree.options.connectionArrow ?? 'triangle')" />
        </svg>
        <div v-for="node in visibleNodes" :key="node.id" class="talent-canvas__node-controls" :class="{ 'talent-canvas__node-controls--connecting': connectionSource }" :style="{ '--talent-canvas-node-controls-left': position(node.id).x + 'px', '--talent-canvas-node-controls-top': position(node.id).y + 'px' }">
        <button type="button" class="talent-canvas__node" :style="talentColorStyle(node.color)" :data-color="node.color" :data-node-id="node.id" :data-category="node.category ?? 'passive'" :class="{ 'talent-canvas__node--unallocated': !editable && !(states?.[node.id]?.level ?? 0), 'talent-canvas__node--partial': !editable && (states?.[node.id]?.level ?? 0) > 0 && (states?.[node.id]?.level ?? 0) < node.levels.length, 'talent-canvas__node--connection-target': connectionSource && connectionTarget === node.id && !talentConnectionError(tree, connectionSource, node.id), 'talent-canvas__node--selected': selected === node.id, 'talent-canvas__node--available': states?.[node.id]?.canAllocate, 'talent-canvas__node--maximum': states?.[node.id]?.level === node.levels.length, 'talent-canvas__node--acquired': (states?.[node.id]?.level ?? 0) > 0, 'talent-canvas__node--locked': !editable && !states?.[node.id]?.canAllocate && !(states?.[node.id]?.level ?? 0) }" :aria-label="node.name + ': ' + (states?.[node.id]?.level ?? 0) + '/' + node.levels.length" :aria-pressed="selected === node.id" @pointerdown="startDrag($event, node)" @click="clicked(node.id)" @dblclick="editable && emit('edit-node', node.id)" @keydown="nodeKeydown($event, node.id)">
          <TalentImage :room-id="roomId" :image-id="node.imageId" :icon="node.icon" class="talent-canvas__node-icon" />
          <span v-if="!editable" class="talent-canvas__node-state" :class="{ 'talent-canvas__node-state--bottom-left': tree.options.levelPosition === 'top-right' }"><v-icon v-if="states?.[node.id]?.level === node.levels.length" icon="mdi-check" size="12" /><v-icon v-else-if="(states?.[node.id]?.level ?? 0) > 0" icon="mdi-circle-half-full" size="12" /><v-icon v-else-if="states?.[node.id]?.canAllocate" icon="mdi-plus" size="12" /><v-icon v-else-if="!(states?.[node.id]?.level ?? 0)" icon="mdi-lock-outline" size="11" /></span>
          <span class="talent-canvas__node-kind" :class="{ 'talent-canvas__node-kind--active-skill': node.category === 'active' }" :title="t('talents.progression.' + (node.category ?? 'passive'))" aria-hidden="true"><v-icon :icon="node.category === 'active' ? 'mdi-lightning-bolt' : 'mdi-shield-outline'" size="11" /></span>
          <span v-if="node.linkedTreeId || node.unlocksTree" class="talent-canvas__node-tree-link" :title="t('talents.progression.unlockAnother')" aria-hidden="true"><v-icon icon="mdi-file-tree-outline" size="11" /></span>
          <span v-if="!editable" class="talent-canvas__node-progress" aria-hidden="true"><span class="talent-canvas__node-progress-fill" :style="{ '--talent-canvas-node-progress-fill-width': Math.min(100, (states?.[node.id]?.level ?? 0) / node.levels.length * 100) + '%' }" /></span>
          <span v-if="!tree.options.iconsOnly" class="talent-canvas__node-name" :class="{ 'talent-canvas__node-name--name-below-level': tree.options.levelPosition === 'bottom' }">{{ node.name }}</span>
          <span class="talent-canvas__node-level" :class="'talent-canvas__node-level--' + tree.options.levelPosition">{{ states?.[node.id]?.level ?? 0 }}/{{ node.levels.length }}</span>
          <v-tooltip activator="parent" location="top" max-width="320" content-class="talent-node-tooltip">
            <strong>{{ node.name }}</strong><span class="talents-ui__kind-label"><v-icon :icon="node.category === 'active' ? 'mdi-lightning-bolt' : 'mdi-shield-outline'" size="12" />{{ t('talents.progression.' + (node.category ?? 'passive')) }}</span><p v-if="node.description">{{ node.description }}</p>
            <p v-if="!editable && (states?.[node.id]?.level ?? 0) < node.levels.length" class="talents-ui__cost-label">{{ costLabel(states?.[node.id]?.cost ?? rankCost(node, states?.[node.id]?.level ?? 0)) }}</p>
            <p v-if="node.autoUnlock" class="talents-ui__cost-label">{{ t('talents.progression.autoUnlock') }}</p>
            <p v-if="node.linkedTreeId || node.unlocksTree">{{ linkedTreeLabel(node.linkedTreeId) }}</p>
            <template v-for="(rank, index) in node.levels" :key="rank.id">
              <div v-if="rank.name?.trim() || rank.description?.trim()" class="talent-node-tooltip__rank" :class="{ 'talent-node-tooltip__rank--unreached': index >= (states?.[node.id]?.level ?? 0) }" :data-reached="index < (states?.[node.id]?.level ?? 0)">
                <strong><span class="talent-node-tooltip__rank-number">{{ t('talents.level') }} {{ index + 1 }}<template v-if="rank.name?.trim()"> · </template></span>{{ rank.name }}</strong>
                <p v-if="rank.description?.trim()">{{ rank.description }}</p>
              </div>
            </template>
            <p v-if="states?.[node.id]?.reason">{{ t('talents.reasons.' + states[node.id]!.reason) }}</p>
            <TalentRequirements v-if="!editable && states?.[node.id]?.reason === 'prerequisites'" :state="states?.[node.id]" />
          </v-tooltip>
        </button>
        <button v-if="editable" v-for="side in connectorSides" :key="side" type="button" class="talent-canvas__node-connector" :class="{ 'talent-canvas__node-connector--active': connectionSource === node.id && sourceSide === side, 'talent-canvas__node-connector--target': connectionTarget === node.id && targetSide === side }" :data-node-id="node.id" :data-side="side" :style="{ '--talent-canvas-node-connector-left': connectorOffsets[side].x + 'px', '--talent-canvas-node-connector-top': connectorOffsets[side].y + 'px' }" :aria-label="t('talents.design.connectFrom') + ': ' + node.name + ' (' + t('talents.design.connectorSides.' + side) + ')'" :title="t('talents.design.connectorHint')" @pointerenter="hoverConnectionTarget(node.id, side)" @pointerdown="startConnection($event, node.id, side)" @click.stop.prevent="connectorClick($event, node.id, side)" />
        </div>
      </div>
      </div>
      <div v-if="!visibleNodes.length && !decorations.length" class="talent-canvas__empty"><div class="talent-canvas__empty-card"><span><v-icon icon="mdi-source-branch" size="36" /></span><h3>{{ t(editable ? 'talents.design.blankCanvas' : 'talents.design.noVisibleTalents') }}</h3><p>{{ t(editable ? 'talents.design.blankCanvasHint' : 'talents.design.lockedCanvasHint') }}</p><v-btn v-if="editable" color="primary" variant="tonal" prepend-icon="mdi-plus" @click="emit('create')">{{ t('talents.design.placeFirstTalent') }}</v-btn></div></div>
    </div>
    <nav v-if="unlockedPaths.length" class="talent-canvas__linked-paths" :aria-label="t('talents.progression.unlockedPaths')">
      <div class="talent-canvas__paths-heading"><v-icon icon="mdi-lock-open-variant-outline" size="14" />{{ t('talents.progression.unlockedPaths') }}</div>
      <div class="talent-canvas__paths-list"><button v-for="{ tree: target, sources } in unlockedPaths" :key="target.id" type="button" class="talent-canvas__path-link" :aria-label="t('talents.progression.openLinkedTree', { name: target.name })" :title="target.name" @click="emit('open-tree', target.id)"><span class="talent-canvas__path-icon"><TalentImage :room-id="roomId" :image-id="target.imageId" :icon="target.icon" /></span><span class="talent-canvas__path-copy"><strong>{{ target.name }}</strong><small>{{ t('talents.progression.linkedVia', { names: sources.map(node => node.name).join(', ') }) }}</small></span><v-icon icon="mdi-arrow-top-right" size="18" /></button></div>
    </nav>
    <div v-if="editable" class="talent-canvas__interaction-hint"><v-icon icon="mdi-cursor-move" size="14" />{{ t('talents.dragHint') }}</div>
  </div>
</template>
<script setup lang="ts">
import AppCloseButton from '@/shared/ui/AppCloseButton.vue';
import { computed, ref, useId, onBeforeUnmount, onMounted, nextTick, watch } from 'vue';
import { talentConnectionError, rankCost } from '@shared/rooms/talents';
import { useI18n } from 'vue-i18n';

import { talentColorStyle } from '@/features/rooms/components/talents/talent-colors';
import TalentImage from '@/features/rooms/components/talents/TalentImage.component.vue';
import TalentDecorations from '@/features/rooms/components/talents/TalentDecorations.component.vue';
import TalentConnectionStyles from '@/features/rooms/components/talents/TalentConnectionStyles.component.vue';
import TalentRequirements from '@/features/rooms/components/talents/TalentRequirements.component.vue';
import type { TalentTree, TalentNode, TalentNodeState, TalentEdge, TalentConnectorSide, TalentConnectionStyle, TalentArrowStyle, TalentSubtree } from '@shared/rooms/talents.types';
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
  if (event.defaultPrevented || !el || !el.getClientRects().length || !el.contains(document.activeElement) || document.querySelector('.v-overlay--active:not(.v-tooltip):not(.v-snackbar)')) return;
  if (target instanceof Element && target.closest(".talent-canvas__viewport")) return;
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
  const nodeId = target?.closest<HTMLElement>(".talent-canvas__node")?.dataset.nodeId;
  const subtreeId = target?.closest<HTMLElement>(".talent-canvas__subtree")?.dataset.subtreeId;
  const decorationId = target?.closest<HTMLElement>(".talent-decorations")?.dataset.decorationId;
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
    const dot = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>(".talent-canvas__node-connector");
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
<style scoped lang="scss" src="@/assets/styles/features/rooms/talents/talent-canvas.scss"></style>
