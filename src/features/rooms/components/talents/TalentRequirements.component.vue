<template>
  <section v-if="groups.length" class="talent-requirements" :aria-label="t('talents.design.unmetRequirements')">
    <strong class="talent-requirements__heading">{{ t('talents.design.unmetRequirements') }}</strong>
    <div v-for="group in groups" :key="group.source" class="talent-requirements__requirement-group">
      <div class="talent-requirements__requirement-group-heading"><span>{{ t('talents.design.' + groupLabels[group.source]) }}</span><small>{{ t(group.mode === 'any' ? 'talents.design.requireAny' : 'talents.design.requireAll') }}</small></div>
      <ul><li v-for="(requirement, index) in group.items" :key="index"><span>{{ requirementLabel(requirement) }}</span><strong :aria-label="t('talents.design.requirementProgress', { current: requirement.current, required: requirement.amount })">{{ requirement.current }}/{{ requirement.amount }}</strong></li></ul>
    </div>
  </section>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { TalentNodeState, TalentRequirement, TalentRequirementGroup } from '@shared/rooms/talents.types';
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
<style scoped lang="scss" src="@/assets/styles/features/rooms/talents/talent-requirements.scss"></style>
