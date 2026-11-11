<template>
  <v-dialog v-model="open" max-width="1100" scrollable>
    <v-card>
      <v-card-title class="d-flex align-center ga-2"><v-icon>mdi-bag-personal</v-icon>{{ t('bag.title') }}<v-spacer />
        <v-avatar v-for="person in activePresence" :key="person.userId" :color="userColor(person.userId)" size="28" :title="memberName(person.userId) + ' · ' + presenceLabel(person)">
          <img v-if="memberAvatar(person.userId)" :src="memberAvatar(person.userId)" :alt="memberName(person.userId)" style="width:100%" /><span v-else>{{ memberName(person.userId).slice(0, 1) }}</span>
        </v-avatar>
        <v-btn v-if="canEdit" prepend-icon="mdi-shape-outline" size="small" variant="tonal" :title="t('bag.customFields')" :aria-label="t('bag.customFields')" @click="templatesOpen = true"><span class="d-none d-sm-inline">{{ t('bag.customFields') }}</span></v-btn>
        <v-btn icon="mdi-close" variant="text" :title="t('common.close')" @click="open = false" />
      </v-card-title>
      <v-card-text>
        <v-alert v-if="error" type="error" closable @click:close="error = ''">{{ error }}<v-btn variant="text" @click="load">{{ t('bag.reload') }}</v-btn></v-alert>
        <div class="bag-scope-frame">
        <v-tabs v-model="scope" class="bag-scope-tabs" height="48" grow hide-slider>
          <v-tab value="team" prepend-icon="mdi-account-group" class="bag-scope-tab">{{ t('bag.team') }}</v-tab>
          <v-tab value="personal" prepend-icon="mdi-bag-personal" class="bag-scope-tab">{{ t('bag.personal') }}</v-tab>
        </v-tabs>
        </div>
        <v-progress-linear v-if="loading" indeterminate />
        <div class="bag-toolbar my-3">
          <v-tabs :key="scope + ':' + (bag?.id || 'loading')" v-model="sectionId" show-arrows hide-slider height="52" class="bag-sections">
            <v-tab tag="div" :height="44" v-for="section in sectionTabs" :key="section.id" :value="section.id" :class="{ 'bag-uncategorized-tab': section.id === 'uncategorized' && !section.color, 'bag-section-tab--reordering': reorderTabId === section.id }" :style="{ ...tabColorStyle(section.color), ...sectionStyle(section.id) }" class="bag-section-tab" :data-bag-tab="section.id" :aria-label="section.name + (reorderTabId === section.id ? ' · ' + t('bag.reordering') : '')" @pointerdown="startTabPress($event, section.id)" @pointerleave="leaveTabPress" @click.capture="finishTabPress($event, section.id)" @contextmenu="openTabContext($event, section.id)" @keydown.capture="tabContextKey($event, section.id)">
              <v-icon v-if="section.icon" :icon="section.icon" class="mr-2" size="20" /><span class="bag-section-tab-name">{{ section.name }}</span><v-icon icon="mdi-check-circle" size="17" class="bag-section-selected-mark" :class="{ 'bag-section-selected-mark--visible': sectionId === section.id }" aria-hidden="true" />
              <v-menu v-if="canEdit && !reorderTabId" :model-value="tabMenuItem === section.id" @update:model-value="tabMenuItem = $event ? section.id : tabMenuItem === section.id ? null : tabMenuItem" activator="parent" open-on-hover open-on-focus :open-on-click="false" :open-delay="200" :close-delay="150" location="bottom" :offset="8">
                <v-list density="compact" :aria-label="t('bag.actions')">
                  <v-list-item prepend-icon="mdi-sort-variant" :title="t('bag.reorderTabs')" :disabled="busy" @click="beginTabReorder(section.id)" />
                  <v-list-item prepend-icon="mdi-pencil" :title="t('bag.editTab')" :disabled="busy" @click="editSection(section)" />
                  <v-list-item v-if="section.id !== 'uncategorized'" prepend-icon="mdi-delete-outline" :title="t('bag.deleteSection')" :disabled="busy" @click="confirmDelete('deleteBagSection', section)" />
                </v-list>
              </v-menu>
            </v-tab>
            <button v-if="canEdit" type="button" class="bag-add-section" :title="t('bag.addSection')" :disabled="busy || !!reorderTabId" @click.stop="editSection()" @keydown.stop><v-icon icon="mdi-plus" size="20" aria-hidden="true" /><span>{{ t('bag.addSection') }}</span></button>
          </v-tabs>
          <v-select v-model="sortOrder" :items="sortOptions" :label="t('bag.orderItems')" :aria-label="t('bag.orderItems')" density="compact" variant="outlined" hide-details class="bag-sort-select">
            <template #selection="{ item }"><v-icon :icon="item.raw.icon" size="18" class="mr-2" />{{ item.title }}</template>
            <template #item="{ props: sortProps, item }"><v-list-item v-bind="sortProps" :prepend-icon="item.raw.icon" :aria-label="item.title + ' · ' + t(item.raw.value.endsWith('asc') ? 'bag.ascending' : 'bag.descending')" /></template>
          </v-select>
          <v-btn-toggle v-model="gridSize" class="bag-grid-size-toggle" mandatory density="compact" divided variant="outlined" :aria-label="t('bag.gridSize')">
            <v-btn v-for="size in gridSizes" :key="size.value" :value="size.value" :icon="size.icon" :title="t('bag.gridSizes.' + size.value)" :aria-label="t('bag.gridSizes.' + size.value)" :aria-pressed="gridSize === size.value" />
          </v-btn-toggle>
        </div>
        <div v-if="reorderTabId" class="bag-tab-reorder-toolbar" role="group" :aria-label="t('bag.reorderTabs')">
          <v-icon icon="mdi-drag-horizontal" color="primary" /><span class="bag-tab-reorder-hint">{{ t('bag.reorderTabsHint') }}</span>
          <v-btn icon="mdi-arrow-left" size="small" variant="tonal" :title="t('bag.tabEarlier')" :aria-label="t('bag.tabEarlier')" :disabled="busy || reorderIds!.indexOf(reorderTabId) === 0" @click="shiftReorderTab(-1)" />
          <v-btn icon="mdi-arrow-right" size="small" variant="tonal" :title="t('bag.tabLater')" :aria-label="t('bag.tabLater')" :disabled="busy || reorderIds!.indexOf(reorderTabId) === reorderIds!.length - 1" @click="shiftReorderTab(1)" />
          <v-btn size="small" variant="text" :disabled="busy" @click="cancelTabReorder">{{ t('common.cancel') }}</v-btn><v-btn size="small" color="primary" variant="flat" :loading="busy" @click="saveTabOrder">{{ t('common.save') }}</v-btn>
        </div>
        <div class="d-flex ga-2 mb-2"><v-chip v-for="person in activePresence.filter(p => p.state === 'adding')" :key="person.userId" :color="userColor(person.userId)" size="small">{{ memberName(person.userId) }} · {{ presenceLabel(person) }}</v-chip></div>
        <section class="bag-active-section" :style="{ '--section-accent': activeSection?.color || 'rgb(var(--v-theme-primary))' }" :aria-label="activeSection?.name">
          <header class="bag-active-section-heading">
            <span class="bag-active-section-icon"><v-icon :icon="activeSection?.icon || (sectionId === 'uncategorized' ? 'mdi-inbox-outline' : 'mdi-folder-outline')" size="24" /></span>
            <div class="bag-active-section-label"><span>{{ t('bag.' + scope) }}</span><h3>{{ activeSection?.name }}</h3></div>
            <v-chip size="small" variant="tonal">{{ t('bag.itemCount', { count: items.length }) }}</v-chip>
          </header>
        <div class="bag-inventory-grid" :class="'bag-inventory-grid--' + gridSize">
          <div v-for="item in items" :key="item.id" class="bag-inventory-slot" :style="{ '--rarity': BAG_RARITY_COLORS[item.rarity], ...rowStyle(item.id) }">
            <BagItemPreview :item="item" :room-id="roomId" tile>
              <span class="bag-inventory-art">
                <BagImage v-if="item.imageId || item.icon" :room-id="roomId" :image-id="item.imageId" :icon="item.icon" :icon-size="gridSize === 'small' ? 40 : gridSize === 'large' ? 80 : 56" />
                <v-icon v-else icon="mdi-treasure-chest-outline" size="48" aria-hidden="true" />
              </span>
              <span class="bag-inventory-name">{{ item.name }}</span>
            </BagItemPreview>
            <v-btn v-if="item.favorite" class="bag-inventory-favorite" icon="mdi-star" color="amber" size="x-small" variant="flat" :title="t('bag.unfavorite')" :aria-label="t('bag.unfavorite')" :disabled="busy || !canEdit" @click.stop="toggleFavorite(item)" />
            <v-btn class="bag-inventory-menu-trigger" icon="mdi-dots-horizontal" size="x-small" variant="flat" :title="t('bag.actions')" :aria-label="t('bag.actions')" aria-haspopup="menu" :aria-expanded="gridMenuItem === item.id" @click.stop="gridMenuItem = gridMenuItem === item.id ? null : item.id" />
            <v-menu :model-value="gridMenuItem === item.id" @update:model-value="gridMenuItem = $event ? item.id : gridMenuItem === item.id ? null : gridMenuItem" activator="parent" :z-index="4100" open-on-hover open-on-focus :open-on-click="false" :open-delay="200" :close-delay="150" location="top start" :offset="10">
              <v-list class="bag-item-actions-popup" density="compact" :style="{ '--item-accent': BAG_RARITY_COLORS[item.rarity] }" :aria-label="t('bag.actions')">
                <v-list-item v-if="canEdit" :prepend-icon="item.favorite ? 'mdi-star-off-outline' : 'mdi-star-outline'" :title="t(item.favorite ? 'bag.unfavorite' : 'bag.favorite')" :disabled="busy" @click="toggleFavorite(item)" />
                <v-list-item v-if="canEdit" prepend-icon="mdi-pencil" :title="t('bag.edit')" :disabled="busy" @click="editItem(item)" />
                <v-list-item v-if="canEdit" prepend-icon="mdi-folder-move-outline" :title="t('bag.move')" :disabled="busy" @click="startMove(item)" />
                <v-list-item v-if="canEdit" prepend-icon="mdi-delete-outline" :title="t('bag.remove')" :disabled="busy" @click="confirmDelete('deleteBagItem', item)" />
                <v-list-item prepend-icon="mdi-share-variant" :title="t('bag.share')" :disabled="busy" @click="share(item)" />
                <v-list-item v-if="canEdit && scope === 'personal'" prepend-icon="mdi-gift-outline" :title="t('bag.give')" :disabled="busy" @click="giving = item; recipient = null" />
              </v-list>
            </v-menu>
          </div>
          <button v-if="canEdit" type="button" class="bag-inventory-add" :disabled="busy || !bag" @click="editItem()">
            <v-icon icon="mdi-plus" size="32" aria-hidden="true" />
            <span>{{ t('bag.addRow') }}</span>
          </button>
          <p v-if="!items.length && !canEdit" class="bag-inventory-empty text-center text-medium-emphasis py-6">{{ t('bag.empty') }}</p>
        </div>
        </section>
      </v-card-text>
    </v-card>
  </v-dialog>
  <v-dialog :model-value="!!sectionDraft" max-width="420" persistent><v-card v-if="sectionDraft"><v-card-title>{{ t('bag.section') }}</v-card-title><v-card-text>
    <v-alert v-if="error" type="error">{{ error }}<v-btn v-if="sectionDraft.id" @click="reloadSectionDraft">{{ t('bag.reloadDraft') }}</v-btn></v-alert><v-text-field v-model="sectionDraft.name" :label="t('bag.name')" :aria-label="t('bag.name')" maxlength="120" autofocus @keydown.enter="saveSection" />
    <BagIconPicker v-model="sectionDraft.icon" />
    <div class="d-flex align-center ga-3 mt-3">
      <v-select v-model="sectionDraft.color" :items="sectionColors" :label="t('bag.tabColor')" hide-details>
        <template #selection="{ item }"><span class="bag-color-swatch" :style="{ background: item.value || 'transparent' }" />{{ item.title }}</template>
        <template #item="{ props: colorProps, item }"><v-list-item v-bind="colorProps"><template #prepend><span class="bag-color-swatch mr-3" :style="{ background: item.value || 'transparent' }" /></template></v-list-item></template>
      </v-select>
      <label class="bag-custom-color"><span>{{ t('bag.customColor') }}</span><input type="color" :value="sectionDraft.color || '#546e7a'" :aria-label="t('bag.customColor')" @input="sectionDraft.color = ($event.target as HTMLInputElement).value" /></label>
    </div>
    </v-card-text><v-card-actions><v-btn :disabled="busy" @click="sectionDraft = null">{{ t('common.cancel') }}</v-btn><v-btn :disabled="busy || !sectionDraft.name.trim()" :loading="busy" @click="saveSection">{{ t('common.save') }}</v-btn></v-card-actions></v-card></v-dialog>
  <v-dialog :model-value="!!draft" max-width="1200" class="bag-editor-dialog" persistent>
    <v-card v-if="draft" class="bag-editor">
      <v-card-title class="bag-editor-title">{{ t(draft.id ? 'bag.edit' : 'bag.addRow') }}</v-card-title>
      <div class="bag-editor-layout">
        <section class="bag-editor-form" :aria-label="t('bag.edit')">
          <v-defaults-provider :defaults="editorDefaults">
    <v-alert v-if="error" type="error">{{ error }}<v-btn v-if="draft.id" @click="reloadDraft">{{ t('bag.reloadDraft') }}</v-btn></v-alert>
    <v-expansion-panels v-model="editorPanels" multiple variant="accordion" class="bag-editor-panels">
      <v-expansion-panel value="general">
        <v-expansion-panel-title>{{ t('bag.general') }}</v-expansion-panel-title>
        <v-expansion-panel-text eager>
          <div class="bag-editor-section">
    <v-text-field v-model="draft.name" :label="t('bag.name')" :aria-label="t('bag.name')" maxlength="120" :rules="[v => !!v?.trim() || t('bag.required')]" />
    <div class="bag-editor-image-picker">
      <input ref="imageInput" type="file" hidden accept="image/jpeg,image/png,image/webp" :disabled="busy" @change="selectImage" />
      <v-btn prepend-icon="mdi-image-plus-outline" variant="tonal" :disabled="busy" :loading="busy" :aria-describedby="imageHintId" @click="imageInput?.click()">{{ t('bag.selectImage') }}</v-btn>
      <p :id="imageHintId" class="bag-editor-image-hint">{{ t('bag.imageHint') }}</p>
    </div>
    <BagIconPicker v-model="draft.icon" :label="t('bag.selectIcon')" />
    <div v-if="draft.imageId" class="d-flex align-center ga-2"><BagImage :room-id="roomId" :image-id="draft.imageId" :icon="draft.icon" :icon-size="48" style="width:64px;height:64px;object-fit:contain" /><v-btn size="small" @click="draft.imageId = null">{{ t('bag.removeImage') }}</v-btn></div>
    <v-textarea v-model="draft.description" :label="t('bag.description')" :aria-label="t('bag.description')" maxlength="10000" rows="2" auto-grow no-resize /><v-checkbox v-model="draft.displayDescription" :label="t('bag.displayInTable')" :aria-label="t('bag.displayInTable')" density="compact" />
    <v-select v-model="draft.rarity" :label="t('bag.rarity')" :aria-label="t('bag.rarity')" :items="rarities">
      <template #selection="{ item }">
        <span class="bag-rarity-selection" :style="{ background: item.raw.color }">{{ item.title }}</span>
      </template>
      <template #item="{ props: itemProps, item }">
        <v-list-item v-bind="itemProps" role="option" :aria-selected="draft.rarity === item.value" :class="['bag-rarity-option', 'rarity-' + item.raw.tier]" :style="{ '--rarity': item.raw.color, background: item.raw.color, color: '#141821' }">
          <template #title>
            <div class="bag-card-name">
              <span class="bag-rarity-option-title">{{ item.title }}</span>
              <v-icon v-if="draft.rarity === item.value" class="bag-rarity-option-check" icon="mdi-check" size="18" aria-hidden="true" />
            </div>
          </template>
        </v-list-item>
      </template>
    </v-select>
          </div>
        </v-expansion-panel-text>
      </v-expansion-panel>
      <v-expansion-panel value="fields">
        <v-expansion-panel-title>{{ t('bag.fields') }}</v-expansion-panel-title>
        <v-expansion-panel-text eager>
          <div class="bag-editor-section">
    <div class="bag-item-fields-heading"><div><h3>{{ t('bag.itemFieldsTitle') }}</h3><p>{{ t('bag.itemFieldsHint') }}</p></div><v-chip size="small" variant="tonal">{{ draft.fields.length }}/50</v-chip></div>
    <div v-if="!draft.fields.length" class="bag-item-fields-empty"><v-icon icon="mdi-text-box-plus-outline" size="36" color="primary" /><strong>{{ t('bag.noItemFields') }}</strong><span>{{ t('bag.noItemFieldsHint') }}</span></div>
    <article v-for="(field, i) in draft.fields" :key="i" class="bag-item-field-card">
      <div class="bag-item-field-card-heading">
        <v-avatar :color="templateAppearance(field.type).color" size="30" variant="tonal"><v-icon :icon="templateAppearance(field.type).icon" size="18" /></v-avatar>
        <span class="text-caption font-weight-bold">{{ t('bag.types.' + field.type) }}</span>
        <v-chip v-if="field.templateId" size="x-small" variant="tonal" prepend-icon="mdi-content-copy">{{ t('bag.copiedField') }}</v-chip><v-spacer />
        <div class="d-flex"><v-btn icon="mdi-arrow-up" variant="text" :disabled="i === 0" :title="t('bag.moveUp')" :aria-label="t('bag.moveUp')" @click="moveField(i, -1)" /><v-btn icon="mdi-arrow-down" variant="text" :disabled="i === draft.fields.length - 1" :title="t('bag.moveDown')" :aria-label="t('bag.moveDown')" @click="moveField(i, 1)" /><v-btn icon="mdi-delete-outline" variant="text" color="error" :title="t('bag.remove')" :aria-label="t('bag.remove')" @click="draft.fields.splice(i, 1)" /></div>
      </div>
      <div class="bag-item-field-card-inputs">
        <v-text-field v-model="field.name" :label="t('bag.name')" :aria-label="t('bag.name')" :readonly="!!field.templateId" :prepend-inner-icon="field.templateId ? 'mdi-lock-outline' : undefined" maxlength="120" variant="outlined" />
        <v-textarea v-if="field.type === 'string'" :model-value="String(field.value)" @update:model-value="field.value = $event" :label="t('bag.value')" :aria-label="t('bag.value')" maxlength="4000" rows="1" auto-grow variant="outlined" />
        <v-text-field v-else-if="field.type === 'integer'" v-model.number="field.value" type="number" step="1" :label="t('bag.value')" :aria-label="t('bag.value')" variant="outlined" />
        <v-select v-else :model-value="field.value as string | string[]" @update:model-value="field.value = $event ?? (field.type === 'multi-select' ? [] : '')" :items="field.options" :multiple="field.type === 'multi-select'" :chips="field.type === 'multi-select'" :label="t('bag.value')" :aria-label="t('bag.value')" variant="outlined" />
      </div>
    </article>
    <v-btn class="bag-item-add-field" block prepend-icon="mdi-plus" variant="outlined" :disabled="draft.fields.length >= 50" @click="fieldPickerOpen = true">{{ t('bag.addField') }}</v-btn>
          </div>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
          </v-defaults-provider>
        </section>
        <aside class="bag-editor-preview" :aria-label="t('bag.preview')" tabindex="0">
          <div class="bag-editor-preview-content">
            <BagItemPreview :item="draft" :room-id="roomId" inline />
          </div>
        </aside>
      </div>
      <v-card-actions class="bag-editor-actions"><v-spacer /><v-btn :disabled="busy" @click="draft = null">{{ t('common.cancel') }}</v-btn><v-btn color="primary" :loading="busy" :disabled="busy || !draft.name.trim() || draft.fields.some(f => !f.name.trim())" @click="saveItem">{{ t('common.save') }}</v-btn></v-card-actions></v-card></v-dialog>
  <v-dialog v-model="fieldPickerOpen" max-width="680" scrollable>
    <v-card class="bag-field-picker"><v-card-title class="bag-templates-title"><v-icon icon="mdi-text-box-plus-outline" class="mr-3" />{{ t('bag.addField') }}</v-card-title>
      <v-card-text>
        <p class="bag-templates-intro">{{ t('bag.addFieldIntro') }}</p>
        <div class="bag-field-quick-options">
          <button v-for="type in (['string', 'integer'] as const)" :key="type" type="button" class="bag-field-quick-option" @click="addField(type)"><v-avatar :color="templateAppearance(type).color" size="40" variant="tonal"><v-icon :icon="templateAppearance(type).icon" /></v-avatar><span><strong>{{ t('bag.types.' + type) }}</strong><small>{{ t(type === 'string' ? 'bag.stringFieldHint' : 'bag.integerFieldHint') }}</small></span><v-icon icon="mdi-plus" size="20" /></button>
        </div>
        <v-tabs v-model="fieldCatalog" color="primary" class="mt-4"><v-tab value="mine" prepend-icon="mdi-lock-outline">{{ t('bag.myFields') }}</v-tab><v-tab value="public" prepend-icon="mdi-earth">{{ t('bag.publicFields') }}</v-tab></v-tabs>
        <v-text-field v-model="fieldSearch" :label="t('bag.searchFields')" prepend-inner-icon="mdi-magnify" variant="outlined" density="compact" hide-details clearable class="my-4" />
        <div class="bag-field-catalog">
          <button v-for="template in filteredFieldCatalog" :key="template.id" type="button" class="bag-field-catalog-entry" @click="addField(template)"><v-avatar :color="templateAppearance(template.type).color" size="34" variant="tonal"><v-icon :icon="templateAppearance(template.type).icon" size="20" /></v-avatar><span><strong>{{ template.name }}</strong><small>{{ t('bag.types.' + template.type) }}<template v-if="fieldCatalog === 'public'"> · {{ memberName(template.ownerId || '') }}</template></small></span><v-icon icon="mdi-plus-circle-outline" color="primary" size="22" /></button>
          <div v-if="!filteredFieldCatalog.length" class="bag-template-empty"><v-icon :icon="fieldCatalog === 'public' ? 'mdi-earth' : 'mdi-shape-outline'" size="32" /><p>{{ t('bag.noMatchingFields') }}</p></div>
        </div>
      </v-card-text>
      <v-card-actions class="bag-templates-footer"><v-btn v-if="canEdit" prepend-icon="mdi-shape-outline" variant="tonal" @click="fieldPickerOpen = false; templatesOpen = true">{{ t('bag.customFields') }}</v-btn><v-spacer /><v-btn @click="fieldPickerOpen = false">{{ t('common.close') }}</v-btn></v-card-actions>
    </v-card>
  </v-dialog>
  <v-dialog v-model="templatesOpen" max-width="960" scrollable>
    <v-card class="bag-templates-dialog">
      <v-card-title class="bag-templates-title"><v-icon icon="mdi-shape-outline" class="mr-3" />{{ t('bag.customFields') }}<v-spacer /><v-chip size="small" variant="tonal">{{ t('bag.myFields') }}</v-chip></v-card-title>
      <v-card-text class="bag-templates-body">
        <p class="bag-templates-intro">{{ t('bag.customFieldsDescription') }}</p>
        <v-alert v-if="error" type="error" class="mb-4">{{ error }}<v-btn v-if="templateDraft.id" @click="reloadTemplateDraft">{{ t('bag.reloadDraft') }}</v-btn></v-alert>
        <div class="bag-templates-layout">
          <section class="bag-template-library" :aria-label="t('bag.savedFields')">
            <div class="bag-template-section-heading"><h3>{{ t('bag.savedFields') }}</h3><v-chip size="x-small" variant="tonal">{{ bag?.templates.length || 0 }}</v-chip></div>
            <div class="bag-template-list">
              <article v-for="template in bag?.templates" :key="template.id" class="bag-template-entry" :class="{ 'bag-template-entry--selected': templateDraft.id === template.id }">
                <div class="bag-template-entry-header">
                  <v-avatar :color="templateAppearance(template.type).color" variant="tonal" size="38"><v-icon :icon="templateAppearance(template.type).icon" size="22" /></v-avatar>
                  <div class="bag-template-entry-label"><h4>{{ template.name }}</h4><span>{{ t('bag.types.' + template.type) }} · {{ t(template.public ? 'bag.publicField' : 'bag.privateField') }}</span></div>
                  <div class="d-flex"><v-btn icon="mdi-pencil-outline" size="small" variant="text" :disabled="busy" :title="t('bag.edit')" :aria-label="t('bag.edit') + ': ' + template.name" @click="templateDraft = clone(template); optionText = template.options.join('\n')" /><v-btn icon="mdi-delete-outline" size="small" variant="text" color="error" :disabled="busy" :title="t('bag.remove')" :aria-label="t('bag.remove') + ': ' + template.name" @click="confirmDelete('deleteBagTemplate', template)" /></div>
                </div>
                <div v-if="template.options.length" class="bag-template-option-chips"><v-chip v-for="option in template.options.slice(0, 3)" :key="option" size="x-small" variant="tonal">{{ option }}</v-chip><span v-if="template.options.length > 3" class="text-caption text-medium-emphasis">+{{ template.options.length - 3 }}</span></div>
              </article>
              <div v-if="!bag?.templates.length" class="bag-template-empty"><v-icon icon="mdi-shape-plus-outline" size="36" /><h4>{{ t('bag.noSavedFields') }}</h4><p>{{ t('bag.noSavedFieldsHint') }}</p></div>
            </div>
            <v-btn class="bag-template-new" prepend-icon="mdi-plus" block variant="outlined" :disabled="busy" @click="resetTemplate">{{ t('bag.newField') }}</v-btn>
          </section>
          <section class="bag-template-workbench" :aria-label="t(templateDraft.id ? 'bag.editField' : 'bag.newField')">
            <div class="bag-template-workbench-heading"><v-icon :icon="templateDraft.id ? 'mdi-pencil-box-outline' : 'mdi-plus-box-outline'" color="primary" /><div><span class="bag-template-eyebrow">{{ t(templateDraft.id ? 'bag.editField' : 'bag.newField') }}</span><h3>{{ templateDraft.id ? templateDraft.name : t('bag.defineField') }}</h3></div></div>
            <v-form @submit.prevent="saveTemplate">
              <div class="bag-template-inputs">
                <div class="bag-template-visibility"><v-switch v-model="templateDraft.public" :label="t('bag.makePublic')" color="primary" hide-details density="compact" :disabled="busy" /><p>{{ t('bag.publicFieldHint') }}</p></div>
                <v-text-field v-model="templateDraft.name" :label="t('bag.name')" :aria-label="t('bag.name')" maxlength="120" variant="outlined" density="comfortable" hide-details="auto" :disabled="busy" />
                <v-select v-model="templateDraft.type" :label="t('bag.type')" :aria-label="t('bag.type')" :items="fieldTypes" :prepend-inner-icon="templateAppearance(templateDraft.type).icon" variant="outlined" density="comfortable" hide-details="auto" :disabled="busy" />
                <div v-if="['select', 'multi-select'].includes(templateDraft.type)" class="bag-template-options-editor"><div class="bag-template-section-heading"><h4>{{ t('bag.options') }}</h4><v-icon icon="mdi-format-list-bulleted" size="18" /></div><v-textarea v-model="optionText" :label="t('bag.options')" :aria-label="t('bag.options')" :hint="t('bag.optionsHint')" persistent-hint variant="outlined" density="compact" rows="3" auto-grow :disabled="busy" /></div>
              </div>
              <div class="bag-template-save-actions"><v-btn v-if="templateDraft.id" variant="text" :disabled="busy" @click="resetTemplate">{{ t('common.cancel') }}</v-btn><v-spacer /><v-btn type="submit" color="primary" variant="flat" :prepend-icon="templateDraft.id ? 'mdi-check' : 'mdi-plus'" :disabled="busy || !canSaveTemplate" :loading="busy">{{ t(templateDraft.id ? 'common.save' : 'bag.createField') }}</v-btn></div>
            </v-form>
          </section>
        </div>
      </v-card-text>
      <v-card-actions class="bag-templates-footer"><v-spacer /><v-btn variant="text" @click="templatesOpen = false">{{ t('common.close') }}</v-btn></v-card-actions>
    </v-card>
  </v-dialog>
  <v-dialog :model-value="!!moving" max-width="440" persistent><v-card><v-card-title>{{ t('bag.move') }}</v-card-title><v-card-text>
    <v-alert v-if="error" type="error" class="mb-3">{{ error }}</v-alert>
    <p class="mb-3 text-body-2">{{ moving?.name }}</p>
    <v-select v-model="moveScope" :items="[{ title: t('bag.team'), value: 'team' }, { title: t('bag.personal'), value: 'personal' }]" :label="t('bag.destinationBag')" :disabled="busy" />
    <v-select v-model="moveSection" :items="moveSections" :label="t('bag.destinationTab')" :loading="moveLoading" :disabled="busy || moveLoading || !moveBag" />
    <v-alert v-if="scope === 'personal' && moveScope === 'team'" type="info" variant="tonal">{{ t('bag.moveToTeamNotice') }}</v-alert>
    </v-card-text><v-card-actions><v-btn :disabled="busy" @click="moving = null">{{ t('common.cancel') }}</v-btn><v-btn :loading="busy" :disabled="busy || moveLoading || !moveBag || (moveScope === scope && moveSection === (moving?.sectionId || 'uncategorized'))" @click="moveItem">{{ t('bag.move') }}</v-btn></v-card-actions></v-card></v-dialog>
  <v-dialog :model-value="!!giving" max-width="440" persistent><v-card><v-card-title>{{ t('bag.give') }}</v-card-title><v-card-text>
    <v-alert v-if="error" type="error">{{ error }}</v-alert><v-select v-model="recipient" :items="recipients" :label="t('bag.recipient')" :aria-label="t('bag.recipient')" /></v-card-text><v-card-actions><v-btn :disabled="busy" @click="giving = null">{{ t('common.cancel') }}</v-btn><v-btn :disabled="!recipient || busy" :loading="busy" @click="give">{{ t('bag.give') }}</v-btn></v-card-actions></v-card></v-dialog>
  <v-dialog :model-value="!!deletion" max-width="420" persistent><v-card><v-card-title>{{ t('bag.remove') }}</v-card-title><v-card-text><v-alert v-if="error" type="error">{{ error }}</v-alert>{{ t(deletion?.action === 'deleteBagSection' ? 'bag.deleteSectionHint' : 'bag.deleteConfirm') }}</v-card-text><v-card-actions><v-btn :disabled="busy" @click="deletion = null">{{ t('common.cancel') }}</v-btn><v-btn color="error" :disabled="busy" :loading="busy" @click="remove">{{ t('bag.remove') }}</v-btn></v-card-actions></v-card></v-dialog>
  <v-dialog :model-value="!!sharing" max-width="420"><v-card><v-card-title>{{ t('bag.share') }}</v-card-title><v-card-text>{{ t('bag.sharePersonal') }}</v-card-text><v-card-actions><v-btn @click="sharing = null">{{ t('common.cancel') }}</v-btn><v-btn :loading="busy" :disabled="busy" @click="performShare">{{ t('bag.share') }}</v-btn></v-card-actions></v-card></v-dialog>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoomsStore } from 'core/stores/rooms.store';
import { useRoomAccess } from 'core/composables/useRoomAccess';
import { bagRequest } from 'core/services/rooms.service';
import { bagImageRequest } from 'core/services/bag-images.service';
import { BAG_RARITIES, type BagActionName, type BagAction, type BagSnapshot, type BagScope, type BagItem, type BagSection, type BagTemplate, type BagPresence } from 'netlify/core/types/bag.types';
import BagItemPreview from './BagItemPreview.component.vue';
import BagImage from './BagImage.component.vue';
import BagIconPicker from './BagIconPicker.component.vue';
import { BAG_SORT_TYPES, validBagSort, sortBagItems, type BagSort } from 'core/utils/bag-sort.utils';
import { BAG_RARITY_COLORS } from 'core/utils/bag-rarity.utils';
const props = defineProps<{ roomId: string; userId: string }>();
const open = defineModel<boolean>({ default: false });
const imageInput = ref<HTMLInputElement | null>(null), imageHintId = useId();
const editorPanels = ref<string[]>(['general']);
const gridMenuItem = ref<string | null>(null);
const tabMenuItem = ref<string | null>(null);
const reorderTabId = ref<string | null>(null), reorderIds = ref<string[] | null>(null);
let reorderRevision = 0;
let tabPressTimer: ReturnType<typeof setTimeout> | undefined;
let tabPressOrigin: { x: number; y: number; pointerId: number; element: HTMLElement } | null = null;
let suppressTabClick = false;
let tabDragged = false;
let tabScrolling = false;
let lastTouchTabPress: { id: string; at: number } | null = null;
function cancelTabPress() {
  if (tabPressTimer) clearTimeout(tabPressTimer);
  tabPressTimer = undefined;
  window.removeEventListener('pointermove', moveTabPress);
  window.removeEventListener('pointerup', endTabPress);
  window.removeEventListener('pointercancel', cancelTabPress);
  const origin = tabPressOrigin;
  tabPressOrigin = null;
  if (origin?.element.hasPointerCapture(origin.pointerId)) origin.element.releasePointerCapture(origin.pointerId);
}
function cancelTabReorder() { cancelTabPress(); reorderTabId.value = null; reorderIds.value = null; tabDragged = false; }
function beginTabReorder(id: string) {
  if (!canEdit.value || busy.value || !bag.value) return;
  if (!reorderIds.value) { reorderIds.value = sectionTabs.value.map(tab => tab.id); reorderRevision = bag.value.revision; }
  reorderTabId.value = id; tabMenuItem.value = null;
}
function startTabPress(event: PointerEvent, id: string) {
  cancelTabPress();
  if (!canEdit.value || busy.value || !event.isPrimary || event.button !== 0) return;
  suppressTabClick = false; tabDragged = false; tabScrolling = false;
  lastTouchTabPress = event.pointerType === 'mouse' ? null : { id, at: Date.now() };
  const element = event.currentTarget as HTMLElement;
  tabPressOrigin = { x: event.clientX, y: event.clientY, pointerId: event.pointerId, element };
  window.addEventListener('pointermove', moveTabPress, { passive: false });
  window.addEventListener('pointerup', endTabPress);
  window.addEventListener('pointercancel', cancelTabPress);
  const activate = () => { beginTabReorder(id); suppressTabClick = true; element.setPointerCapture(event.pointerId); };
  if (reorderTabId.value) activate();
  else tabPressTimer = setTimeout(() => { tabPressTimer = undefined; activate(); }, 550);
}
function moveTabPress(event: PointerEvent) {
  const origin = tabPressOrigin;
  if (!origin || event.pointerId !== origin.pointerId) return;
  if (!reorderTabId.value || !reorderIds.value) {
    const dx = event.clientX - origin.x, dy = event.clientY - origin.y;
    if (tabScrolling || Math.hypot(dx, dy) > 10) {
      if (tabScrolling || Math.abs(dx) > Math.abs(dy)) {
        if (tabPressTimer) clearTimeout(tabPressTimer);
        tabPressTimer = undefined; tabScrolling = true; suppressTabClick = true; lastTouchTabPress = null;
        const container = origin.element.closest('.bag-sections')?.querySelector('.v-slide-group__container');
        if (container) container.scrollLeft -= dx;
        origin.x = event.clientX; origin.y = event.clientY; event.preventDefault();
      } else cancelTabPress();
    }
    return;
  }
  if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) < 8) return;
  event.preventDefault(); tabDragged = true;
  const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-bag-tab]');
  const target = hit?.dataset.bagTab;
  if (target && target !== reorderTabId.value && reorderIds.value.includes(target)) {
    const next = [...reorderIds.value], from = next.indexOf(reorderTabId.value), to = next.indexOf(target);
    next.splice(from, 1); next.splice(to, 0, reorderTabId.value); reorderIds.value = next;
  }
  const container = origin.element.closest('.bag-sections')?.querySelector('.v-slide-group__container');
  if (container) { const rect = container.getBoundingClientRect(); if (event.clientX < rect.left + 30) container.scrollLeft -= 20; else if (event.clientX > rect.right - 30) container.scrollLeft += 20; }
}
function leaveTabPress() { if (!reorderTabId.value) cancelTabPress(); }
function endTabPress(event: PointerEvent) { if (tabPressOrigin && event.pointerId !== tabPressOrigin.pointerId) return; const save = tabDragged; cancelTabPress(); if (save) void saveTabOrder(); }
function finishTabPress(event: MouseEvent, id: string) {
  if (reorderTabId.value || (suppressTabClick && event.detail !== 0)) {
    event.preventDefault(); event.stopImmediatePropagation(); suppressTabClick = false;
    if (reorderTabId.value) reorderTabId.value = id;
  }
}
function openTabContext(event: Event, id: string) {
  if (!canEdit.value) return;
  event.preventDefault();
  if (reorderTabId.value) return;
  if (tabPressOrigin || (lastTouchTabPress?.id === id && Date.now() - lastTouchTabPress.at < 1500)) {
    suppressTabClick = true;
    if (tabPressTimer) clearTimeout(tabPressTimer);
    tabPressTimer = undefined; beginTabReorder(id); return;
  }
  cancelTabPress(); tabMenuItem.value = id;
}
function shiftReorderTab(direction: number) {
  if (!reorderIds.value || !reorderTabId.value || busy.value) return;
  const next = [...reorderIds.value], index = next.indexOf(reorderTabId.value), target = index + direction;
  if (target < 0 || target >= next.length) return;
  next.splice(index, 1); next.splice(target, 0, reorderTabId.value); reorderIds.value = next;
}
async function saveTabOrder() {
  if (!reorderIds.value || busy.value) return;
  if (await mutate('reorderBagSections', { revision: reorderRevision, sectionIds: [...reorderIds.value] })) cancelTabReorder();
}
function tabContextKey(event: KeyboardEvent, id: string) {
  if (reorderTabId.value) {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); event.stopImmediatePropagation(); reorderTabId.value = id; shiftReorderTab(event.key === 'ArrowLeft' ? -1 : 1); }
    else if (event.key === 'Escape') { event.preventDefault(); cancelTabReorder(); }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopImmediatePropagation(); void saveTabOrder(); }
  } else if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) openTabContext(event, id);
}

const editorDefaults = {
  VTextField: { density: 'compact', hideDetails: 'auto' },
  VTextarea: { density: 'compact', hideDetails: 'auto' },
  VSelect: { density: 'compact', hideDetails: 'auto' },
  VCheckbox: { density: 'compact', hideDetails: true },
  VBtn: { size: 'small' },
};
const { t, locale } = useI18n(), store = useRoomsStore();
const access = useRoomAccess(computed(() => props.userId));
const canEdit = computed(() => access.value.rights.viewBag && access.value.rights.editBag);
const bag = ref<BagSnapshot | null>(null), scope = ref<BagScope>('team'), sectionId = ref('uncategorized');
watch([open, scope, sectionId, canEdit], () => { gridMenuItem.value = null; tabMenuItem.value = null; cancelTabReorder(); });
const error = ref(''), loading = ref(false), busy = ref(false);
const draft = ref<BagItem | null>(null), sectionDraft = ref<BagSection | null>(null), giving = ref<BagItem | null>(null), sharing = ref<BagItem | null>(null), recipient = ref<string | null>(null);
const moving = ref<BagItem | null>(null), moveScope = ref<BagScope>('team'), moveSection = ref('uncategorized');
const moveBag = ref<BagSnapshot | null>(null), moveLoading = ref(false);
let moveGeneration = 0;
const moveSections = computed(() => [
  { title: moveBag.value?.uncategorized?.name || t('bag.uncategorized'), value: 'uncategorized' },
  ...(moveBag.value?.sections.map(section => ({ title: section.name, value: section.id })) ?? []),
]);
async function loadMoveBag() {
  const current = ++moveGeneration, destination = moveScope.value;
  moveLoading.value = true; moveBag.value = null; moveSection.value = 'uncategorized'; error.value = '';
  try {
    const result = await bagRequest('bag', { roomId: props.roomId, userId: props.userId, scope: destination });
    if (current === moveGeneration && moving.value && result.bag) moveBag.value = result.bag;
  } catch (e) { if (current === moveGeneration && moving.value) error.value = e instanceof Error ? e.message : String(e); }
  finally { if (current === moveGeneration) moveLoading.value = false; }
}
function startMove(item: BagItem) {
  moving.value = clone(item); moveScope.value = scope.value; gridMenuItem.value = null;
  void loadMoveBag();
}
watch(moveScope, () => { if (moving.value) void loadMoveBag(); });
watch(moving, value => { if (!value) { moveGeneration++; moveBag.value = null; moveLoading.value = false; } });
async function moveItem() {
  const item = moving.value;
  if (!item || moveLoading.value || !moveBag.value) return;
  if (await mutate('moveBagItem', { id: item.id, revision: item.revision, destinationScope: moveScope.value, destinationSectionId: moveSection.value === 'uncategorized' ? null : moveSection.value })) moving.value = null;
}
const deletion = ref<{ action: BagActionName; id: string; revision: number } | null>(null);
const templatesOpen = ref(false), fieldPickerOpen = ref(false);
const fieldCatalog = ref<'mine' | 'public'>('mine'), fieldSearch = ref<string | null>('');
const filteredFieldCatalog = computed(() => {
  const source = fieldCatalog.value === 'mine' ? bag.value?.templates : bag.value?.publicTemplates;
  const query = (fieldSearch.value || '').trim().toLocaleLowerCase();
  return (source || []).filter(template => (template.name + ' ' + t('bag.types.' + template.type) + ' ' + template.options.join(' ')).toLocaleLowerCase().includes(query));
});
watch(fieldPickerOpen, value => { if (value) { fieldSearch.value = ''; fieldCatalog.value = 'mine'; } });
const templateDraft = ref<BagTemplate>({ id: '', revision: 0, name: '', type: 'string', options: [], public: false }), optionText = ref('');
function templateAppearance(type: BagTemplate['type']) {
  return ({ string: { icon: 'mdi-format-text', color: 'blue' }, integer: { icon: 'mdi-numeric', color: 'teal' }, select: { icon: 'mdi-form-select', color: 'purple' }, 'multi-select': { icon: 'mdi-format-list-checks', color: 'orange' } })[type];
}
const canSaveTemplate = computed(() => {
  if (!templateDraft.value.name.trim()) return false;
  if (!['select', 'multi-select'].includes(templateDraft.value.type)) return true;
  const options = optionText.value.split('\n').map(option => option.trim()).filter(Boolean);
  return options.length > 0 && options.length <= 100 && options.every(option => option.length <= 120) && new Set(options).size === options.length;
});
const colorPresets = ['#546e7a', '#b71c1c', '#ad5b00', '#827717', '#2e7d32', '#00796b', '#1565c0', '#6a1b9a', '#ad1457'];
const sectionColors = computed(() => [
  { title: t('bag.defaultColor'), value: null },
  ...colorPresets.map((value, index) => ({ title: t('bag.tabColors.' + index), value })),
  ...(sectionDraft.value?.color && !colorPresets.includes(sectionDraft.value.color) ? [{ title: t('bag.customColor'), value: sectionDraft.value.color }] : []),
]);
function tabColorStyle(color?: string | null) {
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return {};
  const channels = [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  const luminance = channels[0]! * .2126 + channels[1]! * .7152 + channels[2]! * .0722;
  return { backgroundColor: color, color: luminance > .179 ? '#141821' : '#fff' };
}
const rarities = computed(() => BAG_RARITIES.map((value, tier) => ({ title: t('bag.rarities.' + value), value, tier, color: BAG_RARITY_COLORS[value] })));
const fieldTypes = computed(() => ['string', 'integer', 'select', 'multi-select'].map(value => ({ title: t('bag.types.' + value), value })));
const gridSizes = [
  { value: 'small', icon: 'mdi-view-comfy' },
  { value: 'medium', icon: 'mdi-view-grid' },
  { value: 'large', icon: 'mdi-view-agenda' },
] as const;
type GridSize = typeof gridSizes[number]['value'];
const gridSize = ref<GridSize>('medium');
const gridSizeKey = computed(() => `bag.gridSize.${props.userId}.${props.roomId}.${scope.value}.${sectionId.value}`);
let loadedGridSizeKey = '';
watch(gridSizeKey, key => {
  loadedGridSizeKey = key;
  try { const saved = localStorage.getItem(key); gridSize.value = saved === 'small' || saved === 'large' ? saved : 'medium'; } catch { gridSize.value = 'medium'; }
}, { immediate: true, flush: 'sync' });
watch(gridSize, value => { if (loadedGridSizeKey === gridSizeKey.value) try { localStorage.setItem(loadedGridSizeKey, value); } catch { /* Sizing works without browser storage. */ } }, { flush: 'sync' });
const sortOrder = ref<BagSort>('created-desc');
const sortKey = computed(() => `bag.sort.${props.userId}.${props.roomId}.${scope.value}.${sectionId.value}`);
let loadedSortKey = '';
watch(sortKey, key => {
  loadedSortKey = key;
  try { const saved = localStorage.getItem(key); sortOrder.value = validBagSort(saved) ? saved : 'created-desc'; } catch { sortOrder.value = 'created-desc'; }
}, { immediate: true, flush: 'sync' });
watch(sortOrder, value => { if (loadedSortKey === sortKey.value) try { localStorage.setItem(loadedSortKey, value); } catch { /* Sorting works without browser storage. */ } }, { flush: 'sync' });
const sortOptions = computed(() => BAG_SORT_TYPES.map(value => ({ value, title: t('bag.sort.' + value.split('-')[0]), icon: value.endsWith('asc') ? 'mdi-sort-ascending' : 'mdi-sort-descending' })));
const items = computed(() => sortBagItems(bag.value?.items.filter(i => i.sectionId === (sectionId.value === 'uncategorized' ? null : sectionId.value)) ?? [], sortOrder.value, locale.value));
async function toggleFavorite(item: BagItem) { gridMenuItem.value = null; await mutate('setBagItemFavorite', { id: item.id, revision: item.revision, favorite: !item.favorite }); }

const sectionTabs = computed<BagSection[]>(() => {
  const tabs = [{ ...bag.value?.uncategorized, id: 'uncategorized', name: bag.value?.uncategorized?.name || t('bag.uncategorized'), revision: bag.value?.revision ?? 0 }, ...(bag.value?.sections ?? [])];
  const order = reorderIds.value || bag.value?.tabOrder || tabs.map(tab => tab.id);
  return tabs.sort((a, b) => { const ai = order.indexOf(a.id), bi = order.indexOf(b.id); return (ai < 0 ? order.length : ai) - (bi < 0 ? order.length : bi); });
});
const activeSection = computed(() => sectionTabs.value.find(tab => tab.id === sectionId.value));
const recipients = computed(() => store.members.filter(m => m.userId !== props.userId).map(m => ({ title: m.nickname || m.username || m.userId, value: m.userId })));
const activePresence = computed(() => store.bagPresence[scope.value].filter(p => p.userId !== props.userId && p.expiresAt > now.value));
let lastSyncError: string | null = null;
const now = ref(Date.now()); let timer: ReturnType<typeof setInterval> | undefined, generation = 0;
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
function memberName(id: string) { const m = store.members.find(m => m.userId === id); return m?.nickname || m?.username || id; }
function memberAvatar(id: string) { return store.members.find(m => m.userId === id)?.avatar; }
function userColor(id: string) { return `hsl(${[...id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 360, 0)} 65% 55%)`; }
function rowStyle(id: string) { const p = activePresence.value.find(p => p.itemId === id && p.state === 'editing'); return p ? { boxShadow: `inset 4px 0 ${userColor(p.userId)}` } : {}; }
function sectionStyle(id: string) { const p = activePresence.value.find(p => p.sectionId === id); return p ? { borderBottom: `3px solid ${userColor(p.userId)}` } : {}; }
function accept(snapshot: BagSnapshot) { if (snapshot.scope === scope.value && (!bag.value || bag.value.id !== snapshot.id || snapshot.revision >= bag.value.revision)) { bag.value = snapshot; if (sectionId.value !== 'uncategorized' && !snapshot.sections.some(s => s.id === sectionId.value)) sectionId.value = 'uncategorized'; } }
async function load() {
  if (!open.value) return;
  const current = ++generation, requestedScope = scope.value;
  loading.value = true;
  try { const snapshot = await store.subscribeBag(requestedScope); if (current === generation && open.value) accept(snapshot); }
  catch (e) { if (current === generation && open.value) { lastSyncError = e instanceof Error ? e.message : String(e); error.value = lastSyncError; } }
  finally { if (current === generation) loading.value = false; }
}
async function mutate(action: BagActionName, extra: Partial<BagAction['payload']> = {}) {
  if (busy.value) return;
  busy.value = true; error.value = '';
  try { const result = await bagRequest(action, { roomId: props.roomId, userId: props.userId, scope: scope.value, ...extra }); if (result.bag && open.value) { store.acceptBagSnapshot(result.bag); accept(result.bag); } if (result.message) store.appendMessages([result.message]); return result; }
  catch (e) { error.value = e instanceof Error ? e.message : String(e); }
  finally { busy.value = false; }
}
function editSection(section?: BagSection) { error.value = ''; sectionDraft.value = section ? clone(section) : { id: '', revision: 0, name: '', color: null, icon: null }; }
async function reloadSectionDraft() { await load(); const latest = sectionTabs.value.find(s => s.id === sectionDraft.value?.id); if (latest) { sectionDraft.value = clone(latest); error.value = ''; } }
async function saveSection() { const d = sectionDraft.value; if (!d?.name.trim() || busy.value) return; const result = await mutate(d.id === 'uncategorized' ? 'updateBagUncategorized' : d.id ? 'updateBagSection' : 'createBagSection', { id: d.id, revision: d.revision, data: { name: d.name, color: d.color ?? null, icon: d.icon ?? null } }); if (result) { sectionId.value = d.id || result.selectedId || 'uncategorized'; sectionDraft.value = null; } }
function editItem(item?: BagItem) { editorPanels.value = ['general']; error.value = ''; draft.value = item ? clone(item) : { id: '', revision: 0, creatorId: props.userId, sectionId: sectionId.value === 'uncategorized' ? null : sectionId.value, name: '', description: '', displayDescription: false, rarity: 'Common', imageId: null, icon: activeSection.value?.icon ?? null, fields: [] }; }
async function saveItem() { const d = draft.value; if (!d) return; if (await mutate(d.id ? 'updateBagItem' : 'createBagItem', { id: d.id, revision: d.revision, data: d })) draft.value = null; }
async function reloadDraft() { await load(); const item = bag.value?.items.find(i => i.id === draft.value?.id); if (item) { draft.value = clone(item); error.value = ''; } }
function addField(value: 'string' | 'integer' | BagTemplate) { if (!draft.value || draft.value.fields.length >= 50) return; const template = typeof value === 'object' ? value : null; const type = template?.type ?? value as 'string' | 'integer'; draft.value.fields.push({ name: template?.name ?? '', type, options: template ? [...template.options] : [], ...(template ? { templateId: template.id } : {}), value: type === 'integer' ? 0 : type === 'multi-select' ? [] : type === 'select' ? template?.options[0] ?? '' : '', display: false }); fieldPickerOpen.value = false; }
function moveField(index: number, direction: number) { if (!draft.value) return; const fields = draft.value.fields; [fields[index], fields[index + direction]] = [fields[index + direction]!, fields[index]!]; }
async function reloadTemplateDraft() { await load(); const latest = bag.value?.templates.find(t => t.id === templateDraft.value.id); if (latest) { templateDraft.value = clone(latest); optionText.value = latest.options.join('\n'); error.value = ''; } }
function resetTemplate() { templateDraft.value = { id: '', revision: 0, name: '', type: 'string', options: [], public: false }; optionText.value = ''; }
async function saveTemplate() { if (!canSaveTemplate.value || busy.value) return; const d = templateDraft.value; if (await mutate(d.id ? 'updateBagTemplate' : 'createBagTemplate', { id: d.id, revision: d.revision, data: { ...d, options: optionText.value.split('\n').map(s => s.trim()).filter(Boolean) } })) resetTemplate(); }
function confirmDelete(action: BagActionName, entry: { id: string; revision: number }) { error.value = ''; deletion.value = { action, id: entry.id, revision: entry.revision }; }
async function remove() { const d = deletion.value; if (d && await mutate(d.action, { id: d.id, revision: d.revision })) { if (d.action === 'deleteBagTemplate' && templateDraft.value.id === d.id) resetTemplate(); deletion.value = null; } }
async function give() { const d = giving.value; if (d && recipient.value && await mutate('giveBagItem', { id: d.id, revision: d.revision, targetUserId: recipient.value })) giving.value = null; }
async function share(item: BagItem) { if (scope.value === 'personal') sharing.value = item; else await mutate('shareBagItem', { id: item.id }); }
async function performShare() { if (sharing.value && await mutate('shareBagItem', { id: sharing.value.id })) sharing.value = null; }
function selectImage(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) void pickImage(file);
}
async function pickImage(input: File | File[] | null) { const file = Array.isArray(input) ? input[0] : input; if (!file || !draft.value) return; if (file.size > 5 * 1024 * 1024) { error.value = t('bag.imageHint'); return; } busy.value = true; error.value = ''; try { const response = await bagImageRequest(props.roomId, undefined, file, scope.value); const data = await response.json(); if (draft.value) draft.value.imageId = data.data.imageId; } catch (e) { error.value = e instanceof Error ? e.message : String(e); } finally { busy.value = false; } }
function presenceLabel(person: BagPresence) {
  const key = person.target === 'section' ? (person.state === 'adding' ? 'addingSection' : 'editingSection') : person.target === 'template' ? (person.state === 'adding' ? 'addingField' : 'editingField') : person.state;
  return t('bag.presence.' + key);
}
function sendPresence() {
  if (!open.value) return;
  const target = templatesOpen.value ? 'template' : draft.value ? 'item' : (sectionDraft.value || reorderTabId.value) ? 'section' : 'bag';
  const state = templatesOpen.value ? (templateDraft.value.id ? 'editing' : 'adding') : draft.value ? (draft.value.id ? 'editing' : 'adding') : sectionDraft.value ? (sectionDraft.value.id ? 'editing' : 'adding') : reorderTabId.value ? 'editing' : 'viewing';
  const activeSectionId = sectionDraft.value?.id || reorderTabId.value || sectionId.value;
  store.sendBagPresence({ scope: scope.value, state, target,
    sectionId: activeSectionId === 'uncategorized' ? null : activeSectionId,
    itemId: templatesOpen.value ? null : draft.value?.id || null, templateId: templatesOpen.value ? templateDraft.value.id || null : null });
}
function closeEditors() { cancelTabReorder(); moving.value = null; draft.value = null; sectionDraft.value = null; deletion.value = null; giving.value = null; sharing.value = null; templatesOpen.value = false; fieldPickerOpen.value = false; resetTemplate(); }
watch(() => store.bagSnapshots[scope.value], snapshot => {
  if (!open.value) return;
  if (snapshot) { accept(snapshot); loading.value = false; if (error.value === lastSyncError) error.value = ''; lastSyncError = null; }
  else if (store.bagSyncError) { bag.value = null; loading.value = false; }
});
watch(() => store.bagSyncError, message => { if (message && open.value) { lastSyncError = message; error.value = message; loading.value = false; bag.value = null; } });
watch(open, value => { if (value) { scope.value = 'team'; sectionId.value = 'uncategorized'; void load(); } else { generation++; bag.value = null; closeEditors(); store.closeBag(); } sendPresence(); });
watch(scope, () => { generation++; bag.value = null; sectionId.value = 'uncategorized'; closeEditors(); void load(); sendPresence(); });
watch([() => draft.value?.id, () => !!draft.value, sectionId, () => sectionDraft.value?.id, () => !!sectionDraft.value, reorderTabId, templatesOpen, () => templateDraft.value.id], sendPresence);
watch(canEdit, value => { if (!value) closeEditors(); });
watch(() => access.value.rights.viewBag, value => { if (!value) open.value = false; });
onMounted(() => { timer = setInterval(() => { now.value = Date.now(); if (open.value) sendPresence(); }, 10_000); if (open.value) void load(); });
onBeforeUnmount(() => { cancelTabPress(); generation++; if (timer) clearInterval(timer); store.closeBag(); });
</script>
<style scoped>
.bag-item-actions-popup { border: 1px solid color-mix(in srgb, var(--item-accent) 55%, rgb(var(--v-theme-on-surface)) 15%); border-radius: 8px !important; box-shadow: 0 6px 24px rgba(0, 0, 0, .3); }

.bag-section-tab { touch-action: pan-y; }
.bag-section-tab--reordering { outline: 2px dashed rgb(var(--v-theme-primary)); outline-offset: -3px; cursor: grabbing; box-shadow: inset 0 0 0 4px rgba(var(--v-theme-primary), .15); }
.bag-tab-reorder-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 10px 12px; margin-bottom: 12px; border: 1px solid rgba(var(--v-theme-primary), .4); border-radius: 8px; background: rgba(var(--v-theme-primary), .06); }
.bag-tab-reorder-hint { flex: 1; min-width: 150px; font-size: 12px; }

.bag-item-fields-heading { display: flex; align-items: start; justify-content: space-between; gap: 12px; }
.bag-item-fields-heading h3 { font-size: 15px; margin-bottom: 4px; }
.bag-item-fields-heading p, .bag-template-visibility p { font-size: 12px; line-height: 1.5; color: rgba(var(--v-theme-on-surface), .65); }
.bag-item-fields-empty { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; padding: 24px 16px; border: 1px dashed rgba(var(--v-theme-primary), .35); border-radius: 10px; background: rgba(var(--v-theme-primary), .04); }
.bag-item-fields-empty span { font-size: 12px; color: rgba(var(--v-theme-on-surface), .65); }
.bag-item-field-card { border: 1px solid rgba(var(--v-theme-on-surface), .18); border-radius: 10px; background: rgba(var(--v-theme-on-surface), .025); }
.bag-item-field-card-heading { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 8px 10px; border-bottom: 1px solid rgba(var(--v-theme-on-surface), .1); background: rgba(var(--v-theme-on-surface), .035); border-radius: 10px 10px 0 0; }
.bag-item-field-card-inputs { display: flex; flex-direction: column; gap: 12px; padding: 14px; }
.bag-item-add-field { border-style: dashed; min-height: 40px; }
.bag-field-quick-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.bag-field-quick-option, .bag-field-catalog-entry { display: flex; align-items: center; text-align: start; gap: 12px; min-width: 0; padding: 16px; border: 1px solid rgba(var(--v-theme-on-surface), .15); border-radius: 10px; background: rgba(var(--v-theme-on-surface), .035); color: rgb(var(--v-theme-on-surface)); cursor: pointer; }
.bag-field-quick-option > span, .bag-field-catalog-entry > span { display: flex; flex: 1; flex-direction: column; gap: 3px; min-width: 0; }
.bag-field-quick-option strong, .bag-field-catalog-entry strong { font-size: 14px; overflow-wrap: anywhere; }
.bag-field-quick-option small, .bag-field-catalog-entry small { font-size: 12px; color: rgba(var(--v-theme-on-surface), .65); }
.bag-field-quick-option:hover, .bag-field-catalog-entry:hover { background: rgba(var(--v-theme-primary), .08); border-color: rgba(var(--v-theme-primary), .5); }
.bag-field-quick-option:focus-visible, .bag-field-catalog-entry:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
.bag-field-catalog { display: flex; flex-direction: column; gap: 8px; }
.bag-field-catalog-entry { padding: 12px; }
.bag-template-visibility { padding: 10px 14px; border: 1px solid rgba(var(--v-theme-primary), .25); border-radius: 8px; background: rgba(var(--v-theme-primary), .04); }
@media (max-width: 480px) { .bag-field-quick-options { grid-template-columns: minmax(0, 1fr); } }

.bag-templates-title { display: flex; align-items: center; padding: 20px 24px 16px; }
.bag-templates-body { padding-top: 0 !important; }
.bag-templates-intro { color: rgba(var(--v-theme-on-surface), .7); font-size: 13px; line-height: 1.6; margin: 0 0 24px; max-width: 760px; }
.bag-templates-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 24px; align-items: start; }
.bag-template-section-heading { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.bag-template-section-heading h3, .bag-template-section-heading h4 { font-size: 13px; font-weight: 700; letter-spacing: .04em; }
.bag-template-list { display: flex; flex-direction: column; gap: 10px; max-height: 420px; overflow-y: auto; padding: 2px; }
.bag-template-entry { padding: 12px; border: 1px solid rgba(var(--v-theme-on-surface), .13); border-radius: 10px; background: rgba(var(--v-theme-on-surface), .035); }
.bag-template-entry--selected { border-color: rgba(var(--v-theme-primary), .8); background: rgba(var(--v-theme-primary), .09); box-shadow: inset 3px 0 rgb(var(--v-theme-primary)); }
.bag-template-entry-header { display: flex; align-items: center; gap: 10px; }
.bag-template-entry-label { flex: 1; min-width: 0; }
.bag-template-entry-label h4 { font-size: 14px; overflow-wrap: anywhere; line-height: 1.35; }
.bag-template-entry-label > span { font-size: 12px; color: rgba(var(--v-theme-on-surface), .6); }
.bag-template-option-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 10px; }
.bag-template-option-chips :deep(.v-chip__content) { max-width: 180px; overflow: hidden; text-overflow: ellipsis; display: block; }
.bag-template-new { margin-top: 12px; border-style: dashed; border-color: rgba(var(--v-theme-on-surface), .3); }
.bag-template-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; padding: 36px 20px; border: 1px dashed rgba(var(--v-theme-on-surface), .2); border-radius: 10px; color: rgba(var(--v-theme-on-surface), .6); }
.bag-template-empty h4 { font-size: 14px; color: rgb(var(--v-theme-on-surface)); }
.bag-template-empty p { font-size: 13px; line-height: 1.5; }
.bag-template-workbench { border: 1px solid rgba(var(--v-theme-primary), .3); border-radius: 12px; overflow: hidden; background: rgba(var(--v-theme-on-surface), .025); }
.bag-template-workbench-heading { display: flex; align-items: center; gap: 12px; padding: 18px; background: rgba(var(--v-theme-primary), .09); border-bottom: 1px solid rgba(var(--v-theme-primary), .18); }
.bag-template-eyebrow { color: rgb(var(--v-theme-primary)); font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.bag-template-workbench-heading h3 { font-size: 17px; line-height: 1.4; overflow-wrap: anywhere; }
.bag-template-inputs { display: flex; flex-direction: column; gap: 18px; padding: 20px 18px; }
.bag-template-options-editor { padding: 14px; border-radius: 8px; background: rgba(var(--v-theme-on-surface), .04); }
.bag-template-save-actions { display: flex; align-items: center; gap: 8px; padding: 14px 18px; border-top: 1px solid rgba(var(--v-theme-on-surface), .1); }
.bag-templates-footer { border-top: 1px solid rgba(var(--v-theme-on-surface), .1); padding: 12px 20px; }
@media (max-width: 700px) { .bag-templates-layout { grid-template-columns: minmax(0, 1fr); gap: 20px; } .bag-template-list { max-height: 260px; } .bag-templates-title { padding-inline: 16px; } }

.bag-toolbar { display: flex; align-items: center; flex-wrap: nowrap; gap: 8px; min-width: 0; overflow-x: auto; padding-block: 6px; }
.bag-toolbar .bag-sections { flex: 1 1 0; min-width: 140px; max-width: none; }
.bag-grid-size-toggle { flex-shrink: 0; }
.bag-add-section { display: inline-flex; align-items: center; align-self: center; justify-content: center; gap: 8px; flex-shrink: 0; height: 44px; padding: 0 16px; border: 1px dashed rgba(var(--v-theme-on-surface), .35); border-radius: 7px; background: rgba(var(--v-theme-on-surface), .025); color: rgba(var(--v-theme-on-surface), .75); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.bag-add-section:hover:not(:disabled), .bag-add-section:focus-visible { border-color: rgb(var(--v-theme-primary)); color: rgb(var(--v-theme-primary)); background: rgba(var(--v-theme-primary), .08); }
.bag-add-section:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: -3px; }
.bag-add-section:disabled { opacity: .45; cursor: default; }
.bag-sort-select { flex: 0 0 170px; min-width: 0; }
.bag-grid-size-toggle :deep(.v-btn) { min-width: 38px; width: 38px; }
@media (max-width: 600px) { .bag-sort-select { flex-basis: 140px; } .bag-grid-size-toggle :deep(.v-btn) { min-width: 34px; width: 34px; } }
.bag-inventory-favorite { position: absolute; top: 6px; left: 6px; z-index: 1; }

.bag-scope-frame { padding: 6px; margin-bottom: 16px; border: 1px solid rgba(var(--v-theme-on-surface), .16); border-radius: 10px; background: rgba(var(--v-theme-on-surface), .045); }
.bag-scope-tabs { flex-shrink: 0; }
.bag-scope-tab { height: 48px; margin-inline: 3px; border: 1px solid transparent; border-radius: 7px !important; font-size: 15px; font-weight: 700; letter-spacing: .06em; }
.bag-scope-tab :deep(.v-icon) { font-size: 24px; margin-inline-end: 10px; }
.bag-scope-tab.v-tab--selected { color: rgb(var(--v-theme-primary)); background: rgba(var(--v-theme-primary), .17); border-color: rgba(var(--v-theme-primary), .6); box-shadow: 0 2px 8px rgba(0, 0, 0, .15); }
.bag-scope-tab:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: -3px; }

.bag-section-tab { position: relative; -webkit-touch-callout: none; user-select: none; }
.bag-uncategorized-tab { background: rgba(var(--v-theme-on-surface), .12); border: 1px solid rgba(var(--v-theme-on-surface), .35); color: rgb(var(--v-theme-on-surface)); font-weight: 700; }
.bag-uncategorized-tab.v-tab--selected { background: rgba(var(--v-theme-on-surface), .2); border-color: rgba(var(--v-theme-on-surface), .65); }
.bag-sections :deep(.v-slide-group__content) { flex: 0 0 auto; min-width: 100%; width: max-content; gap: 8px; align-items: center; }
.bag-section-tab { align-self: center; border: 1px solid rgba(var(--v-theme-on-surface), .18); border-radius: 7px !important; font-weight: 500; }
.bag-section-tab.v-tab--selected { border-color: currentColor; box-shadow: inset 0 -3px currentColor; font-weight: 800; }
.bag-section-tab-name { max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bag-section-selected-mark { margin-inline-start: 10px; visibility: hidden; }
.bag-section-selected-mark--visible { visibility: visible; }
.bag-section-tab:focus-visible { outline: 2px solid currentColor; outline-offset: -4px; }
.bag-active-section { min-width: 0; border: 1px solid color-mix(in srgb, var(--section-accent) 40%, transparent); border-top: 3px solid var(--section-accent); border-radius: 10px; padding: 18px; background: linear-gradient(180deg, color-mix(in srgb, var(--section-accent) 6%, transparent), transparent 180px); }
.bag-active-section-heading { display: flex; align-items: center; gap: 12px; padding-bottom: 16px; margin-bottom: 10px; border-bottom: 1px solid color-mix(in srgb, var(--section-accent) 22%, transparent); }
.bag-active-section-icon { display: grid; place-items: center; width: 44px; height: 44px; flex-shrink: 0; border-radius: 10px; border: 1px solid color-mix(in srgb, var(--section-accent) 45%, transparent); background: color-mix(in srgb, var(--section-accent) 15%, transparent); }
.bag-active-section-label { flex: 1; min-width: 0; }
.bag-active-section-label > span { color: rgba(var(--v-theme-on-surface), .6); font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
.bag-active-section-label h3 { font-size: 18px; line-height: 1.4; overflow-wrap: anywhere; }
@media (max-width: 600px) { .bag-active-section { padding: 12px; } .bag-active-section-heading { gap: 8px; } .bag-active-section-label h3 { font-size: 16px; } }


.bag-color-swatch { display: inline-block; width: 20px; height: 20px; border: 1px solid currentColor; border-radius: 4px; margin-inline-end: 8px; flex-shrink: 0; }
.bag-custom-color { display: flex; flex-direction: column; gap: 4px; font-size: 12px; }
.bag-custom-color input { width: 48px; height: 32px; cursor: pointer; }
.bag-inventory-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--bag-tile-size, 150px)), 1fr)); gap: 16px; padding: 8px 0; }
.bag-inventory-grid--small { --bag-tile-size: 110px; gap: 12px; font-size: 13px; }
.bag-inventory-grid--large { --bag-tile-size: 210px; font-size: 16px; }
.bag-inventory-add { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; width: 100%; min-width: 0; aspect-ratio: 1; padding: 12px; border: 2px dashed rgba(var(--v-theme-on-surface), .3); border-radius: 8px; color: rgba(var(--v-theme-on-surface), .75); background: rgba(var(--v-theme-on-surface), .025); font: inherit; font-weight: 600; cursor: pointer; }
.bag-inventory-add:hover:not(:disabled), .bag-inventory-add:focus-visible { color: rgb(var(--v-theme-primary)); border-color: rgb(var(--v-theme-primary)); background: rgba(var(--v-theme-primary), .08); }
.bag-inventory-add:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 3px; }
.bag-inventory-add:disabled { opacity: .45; cursor: default; }
.bag-inventory-slot { position: relative; min-width: 0; border-radius: 8px; }
.bag-inventory-slot :deep(.bag-inventory-tile) { display: flex; flex-direction: column; width: 100%; aspect-ratio: 1; padding: 12px; gap: 8px; border: 2px solid var(--rarity); border-radius: 8px; background: radial-gradient(ellipse at center, color-mix(in srgb, var(--rarity) 12%, transparent), transparent), rgba(var(--v-theme-on-surface), .035); box-shadow: inset 0 0 16px color-mix(in srgb, var(--rarity) 10%, transparent); text-decoration: none; white-space: normal; }
.bag-inventory-slot :deep(.bag-inventory-tile:hover), .bag-inventory-slot :deep(.bag-inventory-tile:focus-visible) { outline: 2px solid var(--rarity); outline-offset: 3px; box-shadow: 0 0 16px color-mix(in srgb, var(--rarity) 28%, transparent); }
.bag-inventory-art { display: flex; flex: 1; min-height: 0; width: 100%; align-items: center; justify-content: center; }
.bag-inventory-art :deep(img) { width: 100%; height: 100%; object-fit: contain; }
.bag-inventory-name { width: 100%; font-weight: 700; line-height: 1.25; text-align: center; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; flex-shrink: 0; }
.bag-inventory-menu-trigger { position: absolute; top: 6px; right: 6px; opacity: 0; }
.bag-inventory-slot:hover .bag-inventory-menu-trigger, .bag-inventory-slot:focus-within .bag-inventory-menu-trigger, .bag-inventory-menu-trigger[aria-expanded="true"] { opacity: 1; }
@media (hover: none) { .bag-inventory-menu-trigger { opacity: 1; } }
.bag-inventory-empty { grid-column: 1 / -1; }
@media (max-width: 480px) {
  .bag-inventory-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .bag-inventory-grid--small { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .bag-inventory-grid--large { grid-template-columns: minmax(0, 1fr); }
}

.bag-editor { height: min(780px, calc(100dvh - 48px)); display: flex; flex-direction: column; overflow: hidden; }
.bag-editor-dialog :deep(.v-overlay__content) { width: calc(100% - 32px); margin: 16px; }
.bag-editor-title, .bag-editor-actions { flex: 0 0 auto; }
.bag-editor-layout { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 420px; grid-template-rows: minmax(0, 1fr); overflow: hidden; }
.bag-editor-form { display: flex; flex-direction: column; gap: 12px; min-width: 0; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 16px 20px; }
.bag-editor-form > :deep(*) { flex-shrink: 0; }
.bag-editor-form :deep(.v-field__input) { font-size: 14px; }
.bag-editor-form :deep(.v-label) { font-size: 13px; }
.bag-editor-section { display: flex; flex-direction: column; gap: 12px; }
.bag-editor-panels :deep(.v-expansion-panel-title) { min-height: 42px; padding: 10px 16px; font-size: 14px; font-weight: 600; }
.bag-editor-panels :deep(.v-expansion-panel-text__wrapper) { padding: 12px; }
.bag-editor-field { display: flex; flex-direction: column; gap: 8px; }
.bag-editor-field-actions { display: flex; flex-wrap: wrap; gap: 8px; flex-shrink: 0; padding-bottom: 4px; }
.bag-editor-image-hint { margin: 6px 0 0; font-size: 12px; line-height: 1.4; color: rgba(var(--v-theme-on-surface), .6); }
.bag-editor-preview { min-width: 0; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-gutter: stable; padding: 40px 32px 32px; background: rgba(var(--v-theme-on-surface), .035); border-inline-start: 1px solid rgba(var(--v-theme-on-surface), .12); }
.bag-editor-preview-content { display: flex; flex-direction: column; align-items: center; gap: 20px; }
.bag-editor-preview-content :deep(.bag-item-card--inline) { order: 0; }
.bag-editor-preview-content :deep(.bag-item-link) { order: 1; max-width: 100%; overflow-wrap: anywhere; }
@media (max-width: 759px) {
  .bag-editor-layout { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) auto; }
  .bag-editor-form { padding: 16px; }
  .bag-editor-preview { max-height: min(340px, 40dvh); padding: 28px 24px 24px; border-inline-start: 0; border-top: 1px solid rgba(var(--v-theme-on-surface), .12); }
  .bag-editor-preview-content { gap: 10px; }
}

.bag-rarity-selection { display: inline-block; padding: 2px 10px; border-radius: 4px; color: #141821; font-weight: 600; }
.bag-rarity-option { margin: 4px 8px; border-radius: 6px; animation: none; box-shadow: none; }
.bag-rarity-option .bag-card-name { margin: 0; padding: 8px 32px 12px; border: 0; }
.bag-rarity-option .bag-card-name::after { bottom: 4px; min-width: 24px; font-size: 10px; line-height: 12px; }
.bag-rarity-option-title { font-size: 14px; font-weight: 700; letter-spacing: .03em; }
.bag-rarity-option-check { position: absolute; inset-inline-end: 4px; top: 50%; transform: translateY(-50%); }

</style>
