<template>
  <fieldset class="talent-conditions"><legend>{{ label }}</legend><p v-if="!model.items.length" class="talent-conditions__condition-empty">{{ t('talents.design.noConditions') }}</p>
    <AppDropdown v-if="model.items.length > 1" v-model="model.mode" :items="[{ title: t('talents.all'), value: 'all' }, { title: t('talents.any'), value: 'any' }]" :label="t('talents.conditionMode')" density="compact" hide-details />
    <div v-for="(condition, index) in model.items" :key="index" class="talent-conditions__condition-row">
      <AppDropdown :model-value="condition.type" :items="types" :label="t('talents.conditionType')" density="compact" hide-details @update:model-value="changeType(index, $event)" />
      <AppDropdown v-if="condition.type === 'node'" v-model="condition.nodeId" :items="groupedNodes" item-title="name" item-value="id" :label="t('talents.node')" density="compact" hide-details>
        <template #item="{ props: itemProps, item }">
          <v-list-subheader v-if="item.raw.group" class="talent-condition-group"><v-icon :icon="item.raw.icon" size="15" class="mr-2" />{{ item.title }}</v-list-subheader>
          <v-list-item v-else v-bind="itemProps" role="option" :title="item.title" :prepend-icon="item.raw.icon" :aria-selected="condition.nodeId === item.value" />
        </template>
      </AppDropdown>
      <AppDropdown v-if="condition.type === 'subtreePoints'" v-model="condition.subtreeId" :items="tree.subtrees" item-title="name" item-value="id" :label="t('talents.subtree')" density="compact" hide-details />
      <v-text-field type="number" v-model.number="condition.amount" :label="t('talents.minimum')" min="0" max="1000000" variant="outlined" density="compact" hide-details />
      <v-btn icon="mdi-delete-outline" :aria-label="t('talents.delete')" size="small" variant="text" @click="model.items.splice(index, 1)" />
    </div>
    <v-btn size="small" color="primary" prepend-icon="mdi-plus" variant="text" @click="model.items.push({ type: 'treePoints', amount: 1 })">{{ t('talents.addCondition') }}</v-btn>
  </fieldset>
</template>
<script setup lang="ts">
import AppDropdown from '@/shared/ui/AppDropdown.component.vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { TalentConditions, TalentTree, TalentCondition } from '@shared/rooms/talents.types';
const model = defineModel<TalentConditions>({ required: true });
const props = defineProps<{ label: string; tree: TalentTree }>();
const { t } = useI18n();
const types = computed(() => ['node', 'treePoints', 'subtreePoints'].map(value => ({ value, title: t('talents.conditionTypes.' + value) })));
const groupedNodes = computed(() => {
  const items: { id: string; name: string; icon?: string | null; group?: boolean; props?: { disabled: boolean } }[] = [];
  const subtreeIds = new Set(props.tree.subtrees.map(subtree => subtree.id));
  const groups = [...props.tree.subtrees.map(subtree => ({ id: subtree.id, name: subtree.name, icon: subtree.icon || 'mdi-file-tree', nodes: props.tree.nodes.filter(node => node.subtreeId === subtree.id) })), { id: 'ungrouped', name: t('talents.design.ungroupedNodes'), icon: 'mdi-folder-outline', nodes: props.tree.nodes.filter(node => !node.subtreeId || !subtreeIds.has(node.subtreeId)) }];
  for (const [index, group] of groups.entries()) {
    if (!group.nodes.length) continue;
    items.push({ id: '__group:' + index, name: group.name, icon: group.icon, group: true, props: { disabled: true } }, ...group.nodes);
  }
  return items;
});
function changeType(index: number, type: TalentCondition['type']) { model.value.items[index] = type === 'node' ? { type, nodeId: '', amount: 1 } : type === 'subtreePoints' ? { type, subtreeId: '', amount: 1 } : { type, amount: 1 }; }
</script>
<style scoped lang="scss" src="@/assets/styles/features/rooms/talents/talent-conditions.scss"></style>
