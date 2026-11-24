<template>
  <section v-if="groups.length" class="talent-unmet-requirements" :aria-label="t('talents.design.unmetRequirements')">
    <strong class="requirements-heading">{{ t('talents.design.unmetRequirements') }}</strong>
    <div v-for="group in groups" :key="group.source" class="requirement-group">
      <div class="requirement-group-heading"><span>{{ t('talents.design.' + groupLabels[group.source]) }}</span><small>{{ t(group.mode === 'any' ? 'talents.design.requireAny' : 'talents.design.requireAll') }}</small></div>
      <ul><li v-for="(requirement, index) in group.items" :key="index"><span>{{ requirementLabel(requirement) }}</span><strong :aria-label="t('talents.design.requirementProgress', { current: requirement.current, required: requirement.amount })">{{ requirement.current }}/{{ requirement.amount }}</strong></li></ul>
    </div>
  </section>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { TalentNodeState, TalentRequirement, TalentRequirementGroup } from 'netlify/core/types/talents.types';
const props = defineProps<{ state?: TalentNodeState }>();
const { t } = useI18n();
const groupLabels = { parents: 'parentRequirements', node: 'nodeRequirements', rank: 'rankRequirements' };
const groups = computed<TalentRequirementGroup[]>(() => props.state?.requirementGroups ?? (props.state?.requirements.length ? [{ source: 'node', mode: 'all', items: props.state.requirements }] : []));
function requirementLabel(requirement: TalentRequirement) {
  if (requirement.type === 'node') return t('talents.design.nodeRankRequirement', { name: requirement.name || t('talents.node') });
  const label = t('talents.conditionTypes.' + requirement.type);
  return requirement.name ? `${label}: ${requirement.name}` : label;
}
</script>
<style scoped>
.talent-unmet-requirements { margin-top:10px; padding-top:10px; border-top:1px solid rgba(var(--v-border-color),var(--v-border-opacity)); font-size:11px; text-align:left; }
.requirements-heading { font-size:12px; color:rgb(var(--v-theme-on-surface)); }
.requirement-group { margin-top:8px; }.requirement-group-heading { display:flex; flex-wrap:wrap; gap:4px 8px; align-items:baseline; font-weight:600; color:rgba(var(--v-theme-on-surface),.8); }
.requirement-group-heading small { font-size:10px; font-weight:400; color:rgba(var(--v-theme-on-surface),.6); }
.requirement-group ul { list-style:none; padding:0; }.requirement-group li { display:flex; justify-content:space-between; gap:12px; padding-top:4px; line-height:1.5; color:rgba(var(--v-theme-on-surface),.7); }.requirement-group li > span { overflow-wrap:anywhere; }.requirement-group li > strong { flex-shrink:0; font-size:11px; color:rgb(var(--v-theme-primary)); font-variant-numeric:tabular-nums; }
</style>
