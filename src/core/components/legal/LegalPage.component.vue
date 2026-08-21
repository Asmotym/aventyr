<template>
  <HeaderComponent />
  <v-container class="legal-page py-6 py-md-10">
    <article>
      <header class="mb-8">
        <h1 class="text-h3 mb-2">{{ t(`legal.${document}.title`) }}</h1>
        <p class="text-body-2 text-medium-emphasis mb-4">
          {{ t('legal.lastUpdated', { date: t('legal.updateDate') }) }}
        </p>
        <p class="text-body-1 legal-introduction">
          {{ t(`legal.${document}.introduction`) }}
        </p>
      </header>

      <section
        v-for="section in sections"
        :key="section"
        class="legal-section mb-7"
      >
        <h2 class="text-h5 mb-3">
          {{ t(`legal.${document}.sections.${section}.title`) }}
        </h2>
        <p class="text-body-1">
          {{ t(`legal.${document}.sections.${section}.body`, { email: CONTACT_EMAIL }) }}
        </p>
      </section>
    </article>
  </v-container>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import HeaderComponent from 'core/components/Header.component.vue';

type LegalDocument = 'terms' | 'privacy';

const props = defineProps<{
  document: LegalDocument;
}>();

const CONTACT_EMAIL = 'clement.boucherpro@gmail.com';

const sectionKeys: Record<LegalDocument, readonly string[]> = {
  terms: [
    'operator',
    'acceptance',
    'eligibility',
    'accounts',
    'conduct',
    'availability',
    'intellectualProperty',
    'thirdParties',
    'suspension',
    'liability',
    'changes',
    'law',
  ],
  privacy: [
    'controller',
    'dataCollected',
    'localStorage',
    'purposes',
    'legalBases',
    'sharing',
    'retention',
    'security',
    'internationalTransfers',
    'rights',
    'children',
    'changes',
  ],
};

const { t } = useI18n();
const sections = computed(() => sectionKeys[props.document]);
</script>

<style scoped>
.legal-page {
  width: min(100%, 920px);
}

.legal-introduction,
.legal-section p {
  line-height: 1.75;
  white-space: pre-line;
}

@media (max-width: 599px) {
  .legal-page h1 {
    font-size: 2rem !important;
    line-height: 1.2;
  }
}
</style>
