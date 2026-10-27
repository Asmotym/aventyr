<template>
  <v-window-item value="dices">
    <v-expansion-panels v-model="context.dicePanelsOpen.value" class="mb-6" variant="accordion">
      <v-expansion-panel value="custom">
        <v-expansion-panel-title>{{ context.t('dice.settings.createTitle') }}</v-expansion-panel-title>
        <v-expansion-panel-text>
          <template v-if="!context.currentUser">
            <v-alert type="info" variant="tonal" density="comfortable">
              {{ context.t('dice.settings.signInDice') }}
            </v-alert>
          </template>
          <template v-else>
            <p class="text-caption text-medium-emphasis mb-3">
              {{ context.t('dice.settings.createHelp') }}
            </p>
            <v-text-field
              v-model="context.diceManager.newDiceNotation.value"
              :label="context.t('dice.fields.notation')"
              variant="outlined"
              density="comfortable"
              :placeholder="context.t('dice.fields.notationPlaceholderAdvantage')"
              :hint="context.t('dice.fields.notationHint')"
              persistent-hint
              :disabled="!context.access.value.rights.manageDice || context.diceManager.diceMutationLoading.value"
              :error-messages="context.diceManager.newDiceError.value ? [context.diceManager.newDiceError.value] : []"
            />
            <v-text-field
              v-model="context.diceManager.newDiceDescription.value"
              :label="context.t('dice.fields.descriptionOptional')"
              variant="outlined"
              density="comfortable"
              :placeholder="context.t('dice.fields.customDescriptionPlaceholder')"
              :disabled="!context.access.value.rights.manageDice || context.diceManager.diceMutationLoading.value"
              class="mt-3"
            />
            <v-select
              v-model="context.diceManager.newDiceCategoryId.value"
              :items="context.diceManager.diceCategories.value"
              item-title="name"
              item-value="id"
              :label="context.t('dice.category.label')"
              variant="outlined"
              density="comfortable"
              class="mt-3"
              :disabled="!context.access.value.rights.manageDice || context.diceManager.diceMutationLoading.value || context.diceManager.roomDicesLoading.value"
              :loading="context.diceManager.roomDicesLoading.value"
              :hint="context.diceManager.roomDicesLoading.value ? context.t('dice.category.loading') : context.t('dice.category.hint')"
              persistent-hint
            />
            <v-alert
              v-if="context.diceManager.diceManagementError.value"
              type="error"
              variant="tonal"
              density="comfortable"
              class="mt-3"
            >
              {{ context.diceManager.diceManagementError.value }}
            </v-alert>
            <div class="d-flex flex-wrap gap-2 mt-3">
              <v-btn
                color="primary"
                :disabled="!context.access.value.rights.manageDice || context.diceManager.diceMutationLoading.value"
                :loading="context.diceManager.diceMutationLoading.value"
                @click="context.diceManager.addCustomDice"
              >
                {{ context.t('dice.actions.add') }}
              </v-btn>
              <v-btn
                variant="text"
                :disabled="!context.access.value.rights.manageDice || context.diceManager.diceMutationLoading.value"
                @click="context.diceManager.clearNewDiceForm"
              >
                {{ context.t('common.clear') }}
              </v-btn>
            </div>
          </template>
        </v-expansion-panel-text>
      </v-expansion-panel>

      <v-expansion-panel value="categories">
        <v-expansion-panel-title>{{ context.t('dice.category.title') }}</v-expansion-panel-title>
        <v-expansion-panel-text>
          <template v-if="!context.currentUser">
            <v-alert type="info" variant="tonal" density="comfortable">
              {{ context.t('dice.category.signIn') }}
            </v-alert>
          </template>
          <template v-else>
            <p class="text-caption text-medium-emphasis mb-3">
              {{ context.t('dice.category.description') }}
            </p>
            <v-text-field
              v-model="context.diceManager.newCategoryName.value"
              :label="context.t('dice.category.name')"
              variant="outlined"
              density="comfortable"
              :placeholder="context.t('dice.category.placeholder')"
              :disabled="!context.access.value.rights.manageDiceCategories || context.diceManager.categoryMutationLoading.value"
              :error-messages="context.diceManager.newCategoryError.value ? [context.diceManager.newCategoryError.value] : []"
            />
            <v-alert
              v-if="context.diceManager.categoryManagementError.value"
              type="error"
              variant="tonal"
              density="comfortable"
              class="mt-2"
            >
              {{ context.diceManager.categoryManagementError.value }}
            </v-alert>
            <div class="d-flex flex-wrap gap-2 mt-3">
              <v-btn
                color="primary"
                :disabled="!context.access.value.rights.manageDiceCategories || context.diceManager.categoryMutationLoading.value"
                :loading="context.diceManager.categoryMutationLoading.value"
                @click="context.diceManager.addDiceCategory"
              >
                {{ context.t('dice.category.create') }}
              </v-btn>
              <v-btn
                variant="text"
                :disabled="!context.access.value.rights.manageDiceCategories || context.diceManager.categoryMutationLoading.value"
                @click="context.diceManager.newCategoryName.value = ''"
              >
                {{ context.t('common.clear') }}
              </v-btn>
            </div>
            <div v-for="category in context.diceManager.diceCategories.value" :key="category.id" class="d-flex align-center ga-2 mt-3">
              <v-text-field :model-value="context.diceManager.categoryNameDrafts.value[category.id] ?? category.name" :label="context.t('dice.category.name')" hide-details density="compact" :disabled="!context.access.value.rights.manageDiceCategories || context.diceManager.categoryMutationLoading.value" @update:model-value="context.diceManager.categoryNameDrafts.value[category.id] = $event" />
              <v-btn :disabled="!context.access.value.rights.manageDiceCategories || context.diceManager.categoryMutationLoading.value || !context.diceManager.categoryNameDrafts.value[category.id]?.trim() || context.diceManager.categoryNameDrafts.value[category.id] === category.name" @click="context.diceManager.renameDiceCategory(category)">{{ context.t('common.save') }}</v-btn>
            </div>
          </template>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>

    <section>
      <div class="text-subtitle-2 mb-2">{{ context.t('dice.settings.myDice') }}</div>
      <template v-if="!context.currentUser">
        <p class="text-caption text-medium-emphasis">
          {{ context.t('dice.settings.signInView') }}
        </p>
      </template>
      <template v-else>
        <v-progress-linear
          v-if="context.diceManager.roomDicesLoading.value"
          indeterminate
          color="primary"
          class="mb-3"
        />
        <v-alert
          v-else-if="context.diceManager.roomDicesError.value"
          type="error"
          variant="tonal"
          density="comfortable"
          class="mb-3"
        >
          {{ context.diceManager.roomDicesError.value }}
          <template #append>
            <v-btn variant="text" size="small" @click="context.diceManager.ensureRoomDicesLoaded(true)">{{ context.t('common.retry') }}</v-btn>
          </template>
        </v-alert>
        <template v-else-if="context.diceManager.customDices.value.length === 0">
          <p class="text-caption text-medium-emphasis">
            {{ context.t('dice.settings.empty') }}
          </p>
        </template>
        <template v-else>
          <div class="custom-dice-list">
            <v-card
              v-for="dice in context.diceManager.customDices.value"
              :key="dice.id"
              variant="tonal"
              class="custom-dice-card mb-3"
            >
              <div v-if="context.diceManager.editingDiceId.value !== dice.id" class="custom-dice-card__content">
                <div>
                  <div class="text-subtitle-2">{{ dice.notation }}</div>
                  <div v-if="dice.description" class="text-body-2 text-medium-emphasis">
                    {{ dice.description }}
                  </div>
                  <div class="text-caption text-medium-emphasis mt-1">
                    {{ context.t('dice.category.display', { category: dice.categoryName ?? context.t('dice.category.general') }) }}
                  </div>
                </div>
                <div class="custom-dice-card__actions">
                  <v-btn
                    icon="mdi-pencil"
                    variant="text"
                    size="small"
                    :disabled="!context.access.value.rights.manageDice || context.diceManager.diceMutationLoading.value"
                    @click="context.diceManager.startEditingDice(dice)"
                  />
                  <v-btn
                    icon="mdi-delete"
                    variant="text"
                    size="small"
                    color="error"
                    :disabled="!context.access.value.rights.manageDice || context.diceManager.diceMutationLoading.value"
                    @click="context.diceManager.deleteCustomDice(dice.id)"
                  />
                </div>
              </div>
              <div v-else>
                <v-text-field
                  v-model="context.diceManager.editDiceNotation.value"
                  :label="context.t('dice.fields.notation')"
                  variant="outlined"
                  density="comfortable"
                  :placeholder="context.t('dice.fields.notationPlaceholderDisadvantage')"
                  :hint="context.t('dice.fields.notationHint')"
                  persistent-hint
                  :disabled="!context.access.value.rights.manageDice || context.diceManager.diceMutationLoading.value"
                  :error-messages="context.diceManager.editDiceError.value ? [context.diceManager.editDiceError.value] : []"
                />
                <v-text-field
                  v-model="context.diceManager.editDiceDescription.value"
                  :label="context.t('dice.fields.descriptionOptional')"
                  variant="outlined"
                  density="comfortable"
                  class="mt-3"
                  :disabled="!context.access.value.rights.manageDice || context.diceManager.diceMutationLoading.value"
                />
                <v-select
                  v-model="context.diceManager.editDiceCategoryId.value"
                  :items="context.diceManager.diceCategories.value"
                  item-title="name"
                  item-value="id"
                  :label="context.t('dice.category.label')"
                  variant="outlined"
                  density="comfortable"
                  class="mt-3"
                  :disabled="!context.access.value.rights.manageDice || context.diceManager.diceMutationLoading.value || context.diceManager.roomDicesLoading.value"
                />
                <div class="d-flex justify-end gap-2 mt-3">
                  <v-btn
                    variant="text"
                    :disabled="!context.access.value.rights.manageDice || context.diceManager.diceMutationLoading.value"
                    @click="context.diceManager.cancelEditingDice"
                  >
                    {{ context.t('common.cancel') }}
                  </v-btn>
                  <v-btn
                    color="primary"
                    :disabled="!context.access.value.rights.manageDice || context.diceManager.diceMutationLoading.value"
                    :loading="context.diceManager.diceMutationLoading.value"
                    @click="context.diceManager.saveEditingDice"
                  >
                    {{ context.t('common.save') }}
                  </v-btn>
                </div>
              </div>
            </v-card>
          </div>
        </template>
      </template>
    </section>
  </v-window-item>
</template>

<script setup lang="ts">

defineProps<{
  context: any;
}>();

</script>

<style scoped>
.custom-dice-list {
  margin-top: 12px;
  max-height: 320px;
  overflow-y: auto;
  padding-right: 6px;
}

.custom-dice-card {
  padding: 16px;
}

.custom-dice-card__content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.custom-dice-card__actions {
  display: flex;
  gap: 4px;
}
</style>
