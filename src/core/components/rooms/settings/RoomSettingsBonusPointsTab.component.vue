<template>
  <v-window-item eager value="bonusPoints">
    <section class="mb-6">
      <div class="text-subtitle-2 mb-2">{{ context.t('bonusPoints.title') }}</div>
      <p class="text-caption text-medium-emphasis mb-3">
        {{ context.t('bonusPoints.description') }}
      </p>
      <v-alert
        v-if="!context.canManageBonusPoints.value"
        type="info"
        variant="tonal"
        density="comfortable"
        class="mb-3"
      >
        {{ context.t('bonusPoints.creatorOnly') }}
      </v-alert>

      <v-alert
        v-if="context.bonusPointsError.value"
        type="error"
        density="comfortable"
        variant="tonal"
        class="mb-4"
      >
        {{ context.bonusPointsError.value }}
      </v-alert>

      <v-progress-linear
        v-if="context.$roomsStore.bonusPointsLoading"
        indeterminate
        color="primary"
        class="mb-4"
      />

      <v-switch
          :model-value="context.bonusPointsEnabled.value"
          :disabled="!context.canManageBonusPoints.value || context.bonusPointsSaving.value"
          inset
          density="comfortable"
          color="primary"
          class="mb-2"
          @update:model-value="context.handleBonusPointsToggle"
        >
          <template #label>
            <span>{{ context.t('bonusPoints.enable') }}</span>
          </template>
        </v-switch>

        <div v-if="context.bonusPointsEnabled.value" class="bonus-points-form__row d-flex flex-column">
          <v-text-field
            v-model="context.bonusPointsMaxInput.value"
            type="number"
            min="1"
            :label="context.t('bonusPoints.maxPoints')"
            variant="outlined"
            density="comfortable"
            :disabled="!context.canManageBonusPoints.value || context.bonusPointsSaving.value"
          />
          <details class="mb-4"><summary>{{ context.t('roomRework.advanced') }}</summary>
          <v-switch
            :model-value="context.bonusPointsAllowExtremeSpend.value"
            :disabled="!context.canManageBonusPoints.value || context.bonusPointsSaving.value"
            inset
            density="comfortable"
            color="primary"
            @update:model-value="context.handleBonusPointsAllowExtremeSpendToggle"
          >
            <template #label>
              <span>{{ context.t('bonusPoints.allowExtremeSpend') }}</span>
            </template>
          </v-switch>
          </details>
          <v-btn
            color="primary"
            :disabled="!context.canManageBonusPoints.value || context.bonusPointsSaving.value"
            :loading="context.bonusPointsSaving.value"
            @click="context.saveBonusPointSettings"
            class="bonus-points-form__save-button"
          >
            {{ context.t('common.save') }}
          </v-btn>
        </div>

      <BonusConfigurationEditor :key="context.editorEpoch.value" v-if="context.bonusPointsEnabled.value && context.room && context.currentUser" :room-id="context.room.id" :user-id="context.currentUser.id" @dirty="context.bonusEditorDirty.value = $event" />

      <section v-if="context.canManageBonusPoints.value" class="mt-6">
        <div class="d-flex align-center justify-space-between mb-2">
          <div class="text-subtitle-2">{{ context.t('bonusPoints.balances.title') }}</div>
          <v-chip size="small" variant="tonal">
            {{ context.$roomsStore.bonusPointBalances.length }}
          </v-chip>
        </div>
        <p class="text-caption text-medium-emphasis mb-3">
          {{ context.t('bonusPoints.balances.description') }}
        </p>
        <v-list v-if="context.$roomsStore.bonusPointBalances.length" density="comfortable">
          <v-list-item
            v-for="balance in context.$roomsStore.bonusPointBalances"
            :key="balance.userId"
            class="bonus-balance-item"
          >
            <template #prepend>
              <UserProfileAvatar
                :user-id="balance.userId"
                :avatar="balance.avatar"
                :display-name="context.getBonusPointBalanceDisplayName(balance)"
                :room-id="context.room?.id"
                :size="32"
                :classes="['mr-3']"
              />
            </template>
            <v-list-item-title>{{ context.getBonusPointBalanceDisplayName(balance) }}</v-list-item-title>
            <template #append>
              <div class="bonus-balance-controls">
                <v-btn
                  icon="mdi-minus"
                  size="small"
                  variant="text"
                  :disabled="context.bonusPointBalanceSavingId.value === balance.userId || Number(balance.points) <= 0"
                  @click="context.incrementMemberBonusPoints(balance.userId, -1)"
                />
                <v-text-field
                  :model-value="balance.points"
                  type="number"
                  min="0"
                  :max="context.bonusPointsMaxInput.value"
                  density="compact"
                  variant="outlined"
                  hide-details
                  class="bonus-balance-input"
                  :disabled="context.bonusPointBalanceSavingId.value === balance.userId"
                  @update:model-value="context.updateMemberBonusPointBalance(balance.userId, Number($event))"
                />
                <v-btn
                  icon="mdi-plus"
                  size="small"
                  variant="text"
                  :disabled="context.bonusPointBalanceSavingId.value === balance.userId || Number(balance.points) >= Number(context.bonusPointsMaxInput.value)"
                  @click="context.incrementMemberBonusPoints(balance.userId, 1)"
                />
              </div>
            </template>
          </v-list-item>
        </v-list>
        <p v-else class="text-caption text-medium-emphasis">
          {{ context.t('bonusPoints.balances.empty') }}
        </p>
      </section>

      <v-alert
        v-if="!context.bonusPointsEnabled.value"
        type="info"
        variant="tonal"
        density="comfortable"
        class="mb-4"
      >
        {{ context.t('bonusPoints.disabled') }}
      </v-alert>
    </section>
  </v-window-item>
</template>

<script setup lang="ts">
import type { RoomSettingsContext } from '../RoomSettingsDialog.component.vue';
import BonusConfigurationEditor from './BonusConfigurationEditor.component.vue';
import UserProfileAvatar from 'core/components/UserProfileAvatar.component.vue';

defineProps<{
  context: RoomSettingsContext;
}>();

</script>

<style scoped>
.bonus-points-form {
  border: 1px solid rgba(var(--v-theme-outline), 0.18);
  border-radius: 12px;
  padding: 16px;
}

.bonus-points-form__row {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-bottom: 12px;
}

.bonus-rule-item {
  border-bottom: 1px solid rgba(var(--v-theme-outline), 0.18);
  margin-bottom: 12px;
  padding-bottom: 12px;
}

.bonus-rule-item:last-of-type {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.bonus-balance-item {
  border-bottom: 1px solid rgba(var(--v-theme-outline), 0.18);
  padding-bottom: 8px;
}

.bonus-balance-item:last-of-type {
  border-bottom: none;
}

.bonus-balance-controls {
  display: grid;
  grid-template-columns: 32px 88px 32px;
  gap: 8px;
  align-items: center;
}

.bonus-balance-input {
  width: 88px;
}

@media (max-width: 640px) {
  .bonus-points-form__row {
    grid-template-columns: 1fr;
  }

  .bonus-balance-controls {
    grid-template-columns: 32px 72px 32px;
  }

  .bonus-balance-input {
    width: 72px;
  }
}
</style>
