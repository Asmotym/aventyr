<template>
  <RoomSlidePanel v-model="open" :label="t('talents.title')" class="talents-ui talent-viewer-panel">
    <v-card class="talent-viewer">
      <v-card-title class="talent-popup-heading talent-viewer-heading"><span class="talent-popup-icon"><v-icon icon="mdi-source-branch" size="30" /></span><div><div class="talent-eyebrow">{{ t('talents.design.progression') }}</div><h2>{{ t('talents.title') }}</h2></div><span v-if="unlockNotice" class="talent-unlock-notice" role="status" :title="unlockNotice">{{ unlockNotice }}</span><AppCloseButton @click="open = false" /></v-card-title>
      <v-divider />
      <v-card-text class="talent-viewer-body">

        <div v-if="snapshot?.settings.enabled" class="viewer-layout">
          <nav class="talent-tree-navigation" :aria-label="t('talents.title')">
            <div class="talent-navigation-heading"><span class="talent-eyebrow">{{ t('talents.design.yourTrees') }}</span><span>{{ visibleTrees.length.toString().padStart(2, '0') }}</span></div>
            <div class="talent-navigation-list"><div v-for="{ tree: item, depth, hasChildren } in navigationTrees" :key="item.id" class="talent-tree-nav-row" :data-depth="depth" :style="{ paddingLeft: Math.min(depth, 3) * 12 + 'px' }"><button v-if="hasChildren" type="button" class="talent-tree-collapse" :aria-expanded="!collapsedTrees.has(item.id)" :aria-label="t(collapsedTrees.has(item.id) ? 'talents.progression.expand' : 'talents.progression.collapse', { name: item.name })" @click="toggleTree(item.id)"><v-icon :icon="collapsedTrees.has(item.id) ? 'mdi-chevron-right' : 'mdi-chevron-down'" size="16" /></button><button type="button" class="talent-nav-item" :class="{ 'is-active': selected === item.id }" :aria-current="selected === item.id ? 'page' : undefined" @click="selectTree(item.id)"><strong class="talent-nav-title" :title="item.name">{{ item.name }}</strong><span class="talent-nav-meta"><span class="talent-nav-icon"><TalentImage :room-id="roomId" :image-id="item.imageId" :icon="item.icon" /></span><span class="talent-nav-copy"><small>{{ investedPoints(item) }} {{ t('talents.design.pointsInvested') }}</small><span class="talent-nav-progress"><span :style="{ width: (totalLevels(item) ? acquiredRanks(item) / totalLevels(item) * 100 : 0) + '%' }" /></span></span><span v-if="availablePoints(item) > 0" class="talent-unspent-badge" :aria-label="t('talents.unspent')"><v-icon icon="mdi-plus" size="11" />{{ availablePoints(item) }}</span></span></button></div></div>
            <div v-if="tree" class="talent-wallets" :aria-label="t('talents.unspent')">
              <div v-if="snapshot.settings.globalEnabled && tree.currency !== 'tree'" class="talent-wallet"><v-icon icon="mdi-circle-multiple-outline" size="16" /><span><strong>{{ snapshot.player.global }}</strong><small>{{ t('talents.global') }}</small></span></div>
              <div v-if="tree.currency !== 'global'" class="talent-wallet"><TalentImage :room-id="roomId" :image-id="tree.imageId" :icon="tree.icon" class="point-icon" /><span><strong>{{ snapshot.player.trees[tree.id] ?? 0 }}</strong><small>{{ t('talents.treePoints') }}</small></span></div>
            </div>
            <div class="talent-navigation-note"><v-icon icon="mdi-cursor-default-click-outline" size="20" /><p>{{ t('talents.design.viewerHint') }}</p></div>
          </nav>
          <main v-if="tree" class="viewer-main">
            <p v-if="tree.description" class="talent-tree-description">{{ tree.description }}</p>
            <section v-if="tree.options.selectSubtree && !progress?.selectedSubtree" class="talent-specialization"><div class="talent-empty"><v-icon icon="mdi-compass-rose" size="42" /><h3>{{ t('talents.choose') }}</h3><p>{{ t('talents.design.specializationHint') }}</p></div><div class="talent-specialization-grid"><article v-for="subtree in tree.subtrees" :key="subtree.id" class="talent-specialization-card"><span class="talent-specialization-icon"><TalentImage :room-id="roomId" :image-id="subtree.imageId" :icon="subtree.icon" /></span><h4>{{ subtree.name }}</h4><p>{{ subtree.description }}</p><v-btn color="primary" variant="tonal" append-icon="mdi-arrow-right" :disabled="service.state.busy" @click="service.mutate({ op: 'select', treeId: tree.id, subtreeId: subtree.id })">{{ t('talents.choose') }}</v-btn></article></div></section>
            <div v-else class="talent-play-workspace">
              <div class="talent-play-graph"><TalentCanvas :key="tree.id" :tree="tree" :room-id="roomId" :states="snapshot.states[tree.id]" :linked-trees="visibleTrees" :selected="nodeId" @select="nodeId = $event" @open-tree="selectTree" @allocate="allocate" @revert="revert">
                <template #heading-details><span class="talent-build-summary"><span aria-hidden="true">·</span><v-icon icon="mdi-star-four-points-outline" size="14" />{{ investedPoints(tree) }} {{ t('talents.design.pointsInvested') }}</span></template>
                <template #toolbar-end><v-btn v-if="tree.options.allowRespec" variant="text" size="small" prepend-icon="mdi-restore" :disabled="service.state.busy" @click="respec(false)">{{ t('talents.respec') }}</v-btn><v-btn v-if="tree.options.selectSubtree && tree.options.allowSpecializationRespec" variant="text" size="small" prepend-icon="mdi-swap-horizontal" :disabled="service.state.busy" @click="respec(true)">{{ t('talents.changeSpecialization') }}</v-btn></template>
              </TalentCanvas><div class="talent-graph-legend"><span><i class="legend-dot legend-dot--available" />{{ t('talents.design.available') }}</span><span><v-icon icon="mdi-circle-half-full" size="14" class="legend-partial" />{{ t('talents.design.inProgress') }}</span><span><v-icon icon="mdi-check-decagram-outline" size="14" />{{ t('talents.design.mastered') }}</span></div></div>
              <aside class="talent-detail-panel" :aria-label="t('talents.design.talentDetails')" aria-live="polite">
                <template v-if="node"><div class="talent-detail-content"><div class="talent-detail-heading"><span class="talent-eyebrow">{{ t('talents.design.talentDetails') }}</span><v-chip size="x-small" variant="tonal" :color="state?.level === node.levels.length ? 'primary' : undefined">{{ t('talents.level') }} {{ state?.level ?? 0 }}/{{ node.levels.length }}</v-chip></div><div class="talent-detail-emblem" :style="talentColorStyle(node.color)" :data-category="node.category ?? 'passive'" :class="{ 'is-acquired': (state?.level ?? 0) > 0 }"><TalentImage :room-id="roomId" :image-id="node.imageId" :icon="node.icon" /><v-icon v-if="state?.level === node.levels.length" class="talent-detail-complete" icon="mdi-check-decagram" size="24" /></div><h4>{{ node.name }}</h4><div class="talent-rank-track" :style="talentColorStyle(node.color)" :aria-label="t('talents.level') + ' ' + (state?.level ?? 0) + '/' + node.levels.length"><span v-for="rank in Math.min(node.levels.length, 20)" :key="rank" :class="{ 'is-filled': rank <= (state?.level ?? 0) }" /></div><v-chip size="x-small" variant="tonal" class="talent-category-detail" :prepend-icon="node.category === 'active' ? 'mdi-lightning-bolt' : 'mdi-shield-outline'">{{ t('talents.progression.' + (node.category ?? 'passive')) }}</v-chip><v-btn v-if="node.linkedTreeId && visibleTrees.some(tree => tree.id === node?.linkedTreeId)" size="small" variant="text" color="primary" append-icon="mdi-open-in-new" @click="selectTree(node.linkedTreeId!)">{{ t('talents.progression.openTree') }}</v-btn><p class="node-description">{{ node.description || t('talents.design.noDescription') }}</p><div v-if="state?.reason" class="talent-requirement-status" :class="{ 'is-mastered': state.reason === 'maximum' }"><v-icon :icon="state.reason === 'maximum' ? 'mdi-check-decagram-outline' : 'mdi-lock-outline'" size="17" /><span>{{ t('talents.reasons.' + state.reason) }}</span></div><TalentRequirements v-if="state?.reason === 'prerequisites'" :state="state" /><p v-if="state?.dependents.length" class="talent-dependents">{{ t('talents.dependentTalents') }}: {{ state.dependents.join(', ') }}</p></div><div class="talent-detail-actions"><v-btn color="primary" variant="flat" block :disabled="service.state.busy || !state?.canAllocate" :aria-label="t('talents.allocate')" :aria-description="(state?.cost ?? 1) === 0 ? t('talents.progression.free') : t('talents.progression.cost', { cost: state?.cost ?? 1 })" prepend-icon="mdi-plus" @click="allocate(node.id)">{{ t('talents.allocate') }} · {{ (state?.cost ?? 1) === 0 ? t('talents.progression.free') : (state?.cost ?? 1) }}</v-btn><v-btn variant="text" block :disabled="service.state.busy || !state?.canRevert" prepend-icon="mdi-minus" @click="revert(node.id)">{{ t('talents.revert') }}</v-btn></div></template>
                <div v-else class="talent-empty talent-detail-empty"><div class="talent-detail-placeholder"><v-icon icon="mdi-star-four-points-outline" size="32" /></div><h3>{{ t('talents.design.discoverTalent') }}</h3><p>{{ t('talents.design.selectTalentHint') }}</p></div>
              </aside>
            </div>
          </main>
          <div v-else class="talent-empty talent-no-trees"><v-icon icon="mdi-source-branch" size="52" /><h3>{{ t('talents.empty') }}</h3><p>{{ t('talents.design.emptyViewerHint') }}</p></div>
        </div>
        <div v-else class="talent-empty"><v-icon icon="mdi-source-branch" size="48" /><h3>{{ t('talents.reasons.disabled') }}</h3></div>
      </v-card-text>
    </v-card>
  </RoomSlidePanel>
</template>
<script setup lang="ts">
import AppCloseButton from '@/shared/ui/AppCloseButton.vue';
import '@/assets/styles/features/rooms/talents.css';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { spent, treeAccessible, talentTreeRows } from 'netlify/core/utils/talents';
import { emptyTalentProgress } from 'netlify/core/types/talents.types';
import { talentRoom } from '@/features/rooms/services/talents.service';
import type { TalentTree } from 'netlify/core/types/talents.types';
import RoomSlidePanel from '@/features/rooms/components/RoomSlidePanel.component.vue';
import TalentCanvas from '@/features/rooms/components/talents/TalentCanvas.component.vue';
import TalentRequirements from '@/features/rooms/components/talents/TalentRequirements.component.vue';
import { talentColorStyle } from '@/features/rooms/components/talents/talent-colors';
import TalentImage from '@/features/rooms/components/talents/TalentImage.component.vue';
const props = defineProps<{ roomId: string; userId: string }>(); const open = defineModel<boolean>({ default: false });
const { t } = useI18n(), service = talentRoom(props.roomId, props.userId), snapshot = computed(() => service.state.snapshot);
const selected = ref<string | null>(null), nodeId = ref<string | null>(null);
const visibleTrees = computed(() => snapshot.value?.trees.filter(tree => snapshot.value!.accessibleTreeIds ? snapshot.value!.accessibleTreeIds.includes(tree.id) : treeAccessible(tree, snapshot.value!.player, snapshot.value!.hidden?.[tree.id]?.includes(props.userId))) ?? []);
const collapsedTrees = ref(new Set<string>()), unlockNotice = ref('');
const navigationTrees = computed(() => talentTreeRows(visibleTrees.value, collapsedTrees.value));
function toggleTree(id: string) { const next = new Set(collapsedTrees.value); if (next.has(id)) next.delete(id); else next.add(id); collapsedTrees.value = next; }
function expandAncestors(id: string | null) { const next = new Set(collapsedTrees.value), seen = new Set<string>(); let tree = visibleTrees.value.find(tree => tree.id === id); while (tree?.parentTreeId && !seen.has(tree.id)) { seen.add(tree.id); next.delete(tree.parentTreeId); tree = visibleTrees.value.find(parent => parent.id === tree!.parentTreeId); } collapsedTrees.value = next; }
function selectTree(id: string) { if (!visibleTrees.value.some(tree => tree.id === id)) return; selected.value = id; nodeId.value = null; expandAncestors(id); }
watch(selected, id => expandAncestors(id));
watch(visibleTrees, (trees, before) => { if (open.value && before?.length) { const added = trees.filter(tree => !before.some(previous => previous.id === tree.id)); if (added.length) unlockNotice.value = t('talents.progression.unlockedNotice', { names: added.map(tree => tree.name).join(', ') }); else if (before.some(previous => !trees.some(tree => tree.id === previous.id))) unlockNotice.value = ''; } });
watch(visibleTrees, trees => { if (!trees.some(t => t.id === selected.value)) { selected.value = trees[0]?.id ?? null; nodeId.value = null; } expandAncestors(selected.value); }, { immediate: true });
watch(open, value => { unlockNotice.value = ''; if (value) void service.load(); });
const tree = computed(() => visibleTrees.value.find(t => t.id === selected.value));
const progress = computed(() => tree.value ? snapshot.value?.player.progress[tree.value.id] : undefined);
const node = computed(() => tree.value?.nodes.find(n => n.id === nodeId.value));
const state = computed(() => tree.value && node.value ? snapshot.value?.states[tree.value.id]?.[node.value.id] : undefined);
function investedPoints(tree: TalentTree) { return spent(snapshot.value?.player.progress[tree.id] ?? emptyTalentProgress(), tree); }
function acquiredRanks(tree: TalentTree) { return Object.values(snapshot.value?.player.progress[tree.id]?.levels ?? {}).reduce((sum, ranks) => sum + ranks.length, 0); }
function totalLevels(tree: TalentTree) { return tree.nodes.reduce((total, node) => total + node.levels.length, 0); }
function availablePoints(tree: TalentTree) { const s = snapshot.value!; return (tree.currency !== 'global' ? s.player.trees[tree.id] ?? 0 : 0) + (tree.currency !== 'tree' && s.settings.globalEnabled ? s.player.global : 0); }
function allocate(id: string) { if (tree.value && snapshot.value?.states[tree.value.id]?.[id]?.canAllocate) void service.mutate({ op: 'allocate', treeId: tree.value.id, nodeId: id }); }
function revert(id: string) { if (tree.value) void service.mutate({ op: 'revert', treeId: tree.value.id, nodeId: id }); }
function respec(specialization: boolean) { if (!tree.value || !window.confirm(t(specialization && !tree.value.options.refundSpecialization ? 'talents.burnConfirm' : 'talents.respecConfirm'))) return; void service.mutate({ op: 'respec', treeId: tree.value.id, specialization, confirm: true }); }
</script>
<style scoped>
.talent-viewer-body { padding:0 !important; }.talent-viewer-heading { padding:18px 24px; }.talent-viewer-heading .talent-popup-icon { width:48px; height:48px; }.viewer-layout { display:grid; grid-template-columns:210px minmax(0,1fr); min-height:100%; }.talent-tree-navigation { min-width:0; padding:22px 12px; border-right:1px solid var(--talent-border); background:rgba(var(--v-theme-on-surface), .018); display:flex; flex-direction:column; gap:16px; }.talent-navigation-heading { display:flex; align-items:center; justify-content:space-between; padding:0 10px; }.talent-navigation-heading > span:last-child { font-size:11px; color:var(--talent-muted); font-variant-numeric:tabular-nums; }.talent-navigation-list { min-width:0; max-width:100%; display:flex; flex-direction:column; gap:8px; }.talent-nav-item { display:flex; align-items:center; gap:10px; padding:14px 10px; border:1px solid transparent; border-radius:12px; text-align:left; cursor:pointer; transition:background 160ms ease; }.talent-nav-item:hover { background:var(--talent-tint); }.talent-nav-item.is-active { background:rgba(var(--v-theme-primary), .08); border-color:rgba(var(--v-theme-primary), .24); }.talent-nav-icon { display:grid; place-items:center; flex-shrink:0; width:32px; height:36px; color:rgb(var(--v-theme-primary)); }.talent-nav-icon :deep(img) { width:28px; height:28px; object-fit:contain; }.talent-nav-icon :deep(.v-icon) { font-size:26px; }.talent-nav-copy { flex:1; min-width:0; display:flex; flex-direction:column; gap:5px; }.talent-nav-copy strong { font-size:12px; overflow-wrap:anywhere; }.talent-nav-copy small { color:var(--talent-muted); font-size:10px; }.talent-nav-progress { height:3px; background:rgba(var(--v-theme-primary), .1); border-radius:3px; overflow:hidden; }.talent-nav-progress > span { display:block; height:100%; background:rgb(var(--v-theme-primary)); border-radius:inherit; }.talent-unspent-badge { display:flex; align-items:center; padding:2px 5px; border-radius:6px; background:rgb(var(--v-theme-primary)); color:rgb(var(--v-theme-on-primary)); font-size:10px; font-weight:700; font-variant-numeric:tabular-nums; }.talent-navigation-note { display:flex; gap:10px; padding:18px 10px 0; margin-top:auto; color:var(--talent-muted); border-top:1px solid var(--talent-border); }.talent-navigation-note p { font-size:11px; line-height:1.7; }.viewer-main { min-width:0; padding:24px; }.talent-tree-description { font-size:12px; color:var(--talent-muted); line-height:1.7; margin-bottom:16px; white-space:pre-wrap; overflow-wrap:anywhere; }
.talent-wallets { display:flex; flex-wrap:wrap; gap:8px; margin-top:auto; padding:12px 8px 0; border-top:1px solid var(--talent-border); }
.talent-wallet { display:flex; align-items:center; gap:7px; flex:1; min-width:70px; }
.talent-wallet > .v-icon,.point-icon { color:rgb(var(--v-theme-primary)); }
.talent-wallet span { display:flex; flex-direction:column; }.talent-wallet strong { font-size:14px; font-variant-numeric:tabular-nums; }.talent-wallet small { font-size:10px; color:var(--talent-muted); }.point-icon { width:16px; height:16px; object-fit:contain; }
.talent-navigation-note { margin-top:0; }
.talent-build-summary { display:flex; align-items:center; gap:6px; font-size:11px; color:var(--talent-muted); white-space:nowrap; }.talent-play-workspace { display:grid; grid-template-columns:minmax(0,1fr) 245px; border:1px solid var(--talent-border); border-radius:14px; overflow:hidden; }.talent-play-graph { min-width:0; display:flex; flex-direction:column; }.talent-play-graph :deep(.talent-canvas-shell) { flex:1; }.talent-graph-legend { display:flex; flex-wrap:wrap; align-items:center; justify-content:center; gap:16px; padding:12px; border-top:1px solid var(--talent-border); color:var(--talent-muted); font-size:10px; background:rgb(var(--v-theme-surface)); }.talent-graph-legend > span { display:flex; align-items:center; gap:6px; }.legend-dot { width:8px; height:8px; border-radius:3px; display:block; }.legend-dot--available { border:1.5px dashed rgb(var(--v-theme-primary)); }.legend-dot--acquired { background:rgb(var(--v-theme-primary)); }.talent-detail-panel { border-left:1px solid var(--talent-border); padding:18px; display:flex; flex-direction:column; background:rgb(var(--v-theme-surface)); min-width:0; }.talent-detail-heading { display:flex; align-items:center; flex-wrap:wrap; gap:8px; justify-content:space-between; }.talent-detail-emblem { width:76px; height:76px; border:1px solid var(--talent-border); border-radius:22px; display:grid; place-items:center; margin:28px auto 18px; position:relative; color:rgb(var(--talent-accent, var(--v-theme-primary))); background:rgba(var(--talent-accent, var(--v-theme-primary)),.045); box-shadow:0 0 0 6px rgba(var(--talent-accent, var(--v-theme-primary)), .025); }.talent-detail-emblem.is-acquired { border-color:rgba(var(--talent-accent, var(--v-theme-primary)), .4); background:rgba(var(--talent-accent, var(--v-theme-primary)), .1); }.talent-detail-emblem :deep(img) { width:42px; height:42px; object-fit:contain; }.talent-detail-emblem :deep(.v-icon) { font-size:38px; }.talent-detail-emblem .talent-detail-complete { position:absolute; bottom:-8px; right:-8px; font-size:24px; background:rgb(var(--v-theme-surface)); border-radius:50%; }.talent-detail-panel h4 { font-size:17px; text-align:center; overflow-wrap:anywhere; }.talent-rank-track { display:flex; justify-content:center; gap:4px; margin:12px auto 22px; width:100%; max-width:140px; }.talent-rank-track span { height:4px; flex:1; border-radius:3px; background:rgba(var(--talent-accent, var(--v-theme-primary)), .12); }.talent-rank-track span.is-filled { background:rgb(var(--talent-accent, var(--v-theme-primary))); }.node-description { font-size:12px; line-height:1.8; color:var(--talent-muted); white-space:pre-wrap; overflow-wrap:anywhere; }.talent-requirement-status { display:flex; align-items:flex-start; gap:8px; font-size:11px; line-height:1.6; padding:12px; border:1px solid var(--talent-border); border-radius:10px; margin-top:18px; color:var(--talent-muted); }.talent-requirement-status.is-mastered { color:rgb(var(--v-theme-primary)); border-color:rgba(var(--v-theme-primary), .2); background:var(--talent-tint); }.talent-requirements { list-style:none; padding:8px 0; }.talent-requirements li { display:flex; justify-content:space-between; gap:10px; font-size:11px; padding:7px 0; border-bottom:1px solid var(--talent-border); }.talent-dependents { font-size:11px; color:var(--talent-muted); line-height:1.6; margin-top:14px; }.talent-detail-actions { display:flex; flex-direction:column; gap:6px; padding-top:24px; margin-top:auto; }.talent-detail-empty { flex:1; padding:24px 0; }.talent-detail-empty h3 { font-size:14px; }.talent-detail-empty p { font-size:12px; }.talent-detail-placeholder { display:grid; place-items:center; width:72px; height:72px; border:1px dashed rgba(var(--v-theme-primary), .3); border-radius:20px; color:rgb(var(--v-theme-primary)); margin-bottom:6px; }.talent-no-trees { min-height:400px; }.talent-specialization-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:16px; }.talent-specialization-card { padding:24px; border:1px solid var(--talent-border); border-radius:14px; text-align:center; display:flex; flex-direction:column; align-items:center; gap:14px; }.talent-specialization-icon { display:grid; place-items:center; width:64px; height:64px; border-radius:18px; background:var(--talent-tint); color:rgb(var(--v-theme-primary)); }.talent-specialization-icon :deep(img) { width:36px; height:36px; object-fit:contain; }.talent-specialization-icon :deep(.v-icon) { font-size:32px; }.talent-specialization-card h4 { font-size:16px; }.talent-specialization-card p { font-size:12px; line-height:1.7; color:var(--talent-muted); flex:1; }
@media(max-width:1150px) { .viewer-layout { grid-template-columns:180px minmax(0,1fr); }.viewer-main { padding:18px; }.talent-play-workspace { grid-template-columns:minmax(0,1fr); }.talent-detail-panel { border-left:0; border-top:1px solid var(--talent-border); }.talent-detail-panel:has(.talent-detail-empty) { display:none; }.talent-detail-emblem { margin:18px auto 14px; }.talent-detail-actions { flex-direction:row; padding-top:16px; }.talent-detail-actions .v-btn { flex:1; width:auto; } }
@media(max-width:700px) { .viewer-layout { grid-template-columns:minmax(0,1fr); }.talent-tree-navigation { min-width:0; padding:12px 16px; gap:10px; border-right:0; border-bottom:1px solid var(--talent-border); }.talent-navigation-list { flex-direction:row; overflow-x:auto; }.talent-nav-item { min-width:180px; flex:0 0 auto; padding:10px; }.talent-navigation-note { display:none; }.talent-navigation-heading { padding:0; }.viewer-main { padding:16px; }.talent-viewer-heading { padding:16px; }.talent-wallets { margin-top:0; padding:8px 0 0; }.talent-wallet { flex:0 1 auto; margin-right:16px; }.talent-detail-actions { flex-direction:column; }.talent-graph-legend { gap:12px; } }
/* Keep screen chrome stationary; only bounded content areas can scroll. */
.talent-viewer { overflow:hidden; }
.talent-viewer-body { display:flex; flex-direction:column; overflow:hidden !important; min-height:0; }
.viewer-layout { flex:1; height:100%; min-height:0; grid-template-rows:minmax(0,1fr); overflow:hidden; }
.talent-tree-navigation { min-height:0; overflow:hidden; }
.talent-navigation-list { min-height:0; overflow-y:auto; overscroll-behavior:contain; }
.talent-wallets,.talent-navigation-heading,.talent-navigation-note { flex-shrink:0; }
.viewer-main { display:flex; flex-direction:column; min-height:0; overflow:hidden; }
.talent-tree-description { flex-shrink:0; max-height:3.4em; overflow:hidden; }
.talent-play-workspace { flex:1; min-height:0; grid-template-rows:minmax(0,1fr); }
.talent-play-graph { min-height:0; overflow:hidden; }
.talent-play-graph :deep(.canvas-viewport) { height:0; flex:1 1 0; min-height:0; overscroll-behavior:contain; }
.talent-play-graph :deep(.talent-canvas-shell) { min-height:0; }
.talent-graph-legend { flex-shrink:0; }
.talent-detail-panel { min-height:0; overflow:hidden; }
.talent-detail-content { min-height:0; overflow:auto; overscroll-behavior:contain; }
.talent-detail-actions { flex-shrink:0; }
.talent-specialization { min-height:0; overflow:auto; overscroll-behavior:contain; }
@media(max-width:1150px) {
  .talent-play-workspace { flex:1; display:flex; flex-direction:column; }
  .talent-play-graph { flex:1; }
  .talent-detail-panel { flex:0 1 160px; max-height:35%; padding:12px; gap:8px; }
  .talent-detail-content { flex:1; }
  .talent-detail-heading { float:right; margin-left:8px; }
  .talent-detail-emblem,.talent-rank-track { display:none; }
  .talent-detail-panel h4 { text-align:left; font-size:14px; }
  .talent-detail-panel .node-description { font-size:11px; line-height:1.5; margin-top:6px; }
  .talent-detail-actions { flex-direction:row; padding-top:0; margin-top:0; }
  .talent-detail-actions .v-btn { min-width:0; font-size:11px; }
  .talent-requirement-status { margin-top:8px; padding:8px; }
}
@media(max-width:700px) {
  .viewer-layout { grid-template-rows:auto minmax(0,1fr); align-content:normal; }
  .talent-viewer-heading { padding:10px 16px; }
  .talent-viewer-heading .talent-popup-icon { width:38px; height:38px; }
  .talent-tree-navigation { padding:8px 12px; gap:6px; }
  .talent-navigation-heading { display:none; }
  .talent-navigation-list { flex-shrink:0; overflow-y:hidden; }
  .talent-nav-item { min-width:160px; padding:8px; }
  .talent-wallets { padding-top:6px; }
  .talent-wallet span { flex-direction:row; align-items:center; gap:5px; }
  .viewer-main { padding:10px 12px; }
  .talent-tree-description { margin-bottom:8px; font-size:11px; }
  .talent-graph-legend { padding:6px; gap:8px; font-size:9px; }
}
@media(max-height:700px) {
  .talent-detail-emblem { width:44px; height:44px; margin:12px auto; border-radius:14px; }
  .talent-detail-emblem :deep(.v-icon) { font-size:26px; }
  .talent-detail-actions { padding-top:12px; }
}
@media(max-width:700px) and (max-height:700px) {
  .talent-tree-description { display:none; }
  .talent-detail-panel { padding:8px; gap:6px; max-height:30%; }
  .talent-detail-actions { padding-top:0; }
}
@media(prefers-reduced-motion:reduce) { .talent-nav-item { transition:none; } }
.legend-partial { color:rgb(var(--v-theme-primary)); }
.talent-tree-nav-row { display:flex; align-items:center; min-width:0; }.talent-tree-nav-row .talent-nav-item { flex:1; min-width:0; }.talent-tree-collapse { flex-shrink:0; width:20px; color:var(--talent-muted); }.talent-unlock-notice { font-size:11px; color:rgb(var(--v-theme-primary)); max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.talent-category-detail { margin-bottom:10px; }
@media(max-width:700px) { .talent-tree-nav-row { flex:0 0 auto; min-width:160px; }.talent-unlock-notice { max-width:110px; } }
.talent-detail-emblem[data-category="passive"] { border-radius:50%; }.talent-detail-emblem[data-category="active"] { border-radius:8px; }
.talent-nav-item { flex-direction:column; align-items:stretch; gap:9px; }.talent-nav-title { display:block; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12px; }.talent-nav-meta { display:flex; align-items:center; gap:10px; min-width:0; }
</style>
