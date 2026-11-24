<template>
  <v-window-item eager value="bonusPoints" class="room-settings-criticals-tab">
    <section class="mb-6">
      <header class="feature-hero"><div class="feature-hero__icon"><v-icon icon="mdi-star-four-points-outline" size="38" /></div><div class="feature-hero__copy"><h2>{{ context.t('bonusPoints.title') }}</h2><p>{{ context.t('bonusPoints.description') }}</p></div><span class="feature-hero__count">{{ context.$roomsStore.bonusPointTriggers.length + context.$roomsStore.bonusPointConditions.length + context.$roomsStore.bonusPointEffects.length }}</span></header>
      <v-alert
        v-if="!context.canManageBonusPoints.value"
        type="info"
        variant="tonal"
        density="comfortable"
        class="mb-3"
      >
        {{ context.t('bonusPoints.creatorOnly') }}
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
          class="room-settings-bonus-points-tab__toggle"
          @update:model-value="context.handleBonusPointsToggle"
        >
          <template #label>
            <span>{{ context.t('bonusPoints.enable') }}</span>
          </template>
        </v-switch>

        <div v-if="context.bonusPointsEnabled.value" class="bonus-points-form__row room-settings-bonus-points-tab__options">
          <v-text-field
            v-model="context.bonusPointsMaxInput.value"
            type="number"
            min="1"
            :label="context.t('bonusPoints.maxPoints')"
            variant="outlined"
            density="comfortable"
            :disabled="!context.canManageBonusPoints.value || context.bonusPointsSaving.value"
          />

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

      <section v-if="context.canManageBonusPoints.value" class="room-settings-bonus-points-tab__balance-section mt-6">
        <div class="d-flex align-center justify-space-between mb-2">
          <h3 class="room-settings-bonus-points-tab__balance-heading"><v-icon icon="mdi-account-group-outline" color="primary" />{{ context.t('bonusPoints.balances.title') }}</h3>
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
            class="room-settings-bonus-points-tab__balance-item"
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
              <div class="room-settings-bonus-points-tab__balance-controls">
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
                  class="room-settings-bonus-points-tab__balance-input"
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
import type { RoomSettingsContext } from '@/features/rooms/composables/useRoomSettings';
import BonusConfigurationEditor from '@/features/rooms/components/settings/BonusConfigurationEditor.component.vue';
import UserProfileAvatar from '@/features/profiles/components/UserProfileAvatar.component.vue';

defineProps<{
  context: RoomSettingsContext;
}>();

</script>

<style scoped lang="scss" src="@/assets/styles/features/rooms/settings/room-settings-bonus-points-tab.scss"></style>
