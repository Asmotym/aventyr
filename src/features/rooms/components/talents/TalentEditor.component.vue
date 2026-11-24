<template>
  <Teleport to=".room-panel-host" defer>
    <RoomSlidePanel v-model="open" :label="t('talents.editor')" :before-close="canClose" class="talents-ui talent-editor-panel">
      <v-card v-if="draft && service.state.snapshot?.canManage" class="talent-editor">
        <v-card-title class="talent-popup-heading talent-editor-heading"><span class="talent-popup-icon"><v-icon icon="mdi-vector-polyline" size="29" /></span><div><div class="talent-eyebrow">{{ t('talents.layouts.' + draft.layout) }} · {{ t('talents.design.builder') }}</div><h2>{{ t('talents.editor') }}</h2></div><span class="talent-draft-status" :class="{ 'is-dirty': dirty }"><i />{{ t(dirty ? 'talents.design.unsaved' : 'talents.design.draft') }}</span><AppCloseButton :disabled="service.state.busy || uploading" @click="close" /></v-card-title>
        <v-divider />
        <v-card-text class="talent-editor-body" :class="{ 'has-context': nodeDraft || subtreeDraft || selectedShape }">
          <v-alert v-if="localError || service.state.error" type="error" variant="tonal" class="ma-3 talent-editor-error">{{ localError || service.state.error }}</v-alert>
          <v-defaults-provider :defaults="{ VTextField: { variant: 'outlined', density: 'comfortable' }, VTextarea: { variant: 'outlined', density: 'comfortable' }, VSwitch: { inset: true, color: 'primary', density: 'compact' } }">
            <div class="editor-layout">
              <aside class="editor-inspector">
                <v-tabs v-model="tab" density="comfortable" grow color="primary" class="talent-inspector-tabs"><v-tab v-for="item in inspectorTabs" :key="item" :value="item"><v-icon :icon="inspectorIcons[item]" size="17" class="mr-1" />{{ t('talents.' + item) }}</v-tab></v-tabs>
                <div class="talent-inspector-content">
                  <template v-if="tab === 'tree'">
                    <section class="talent-inspector-section"><div class="talent-inspector-heading"><v-icon icon="mdi-text-box-outline" /><h3>{{ t('talents.design.treeIdentity') }}</h3></div><v-text-field v-model="draft.name" :label="t('talents.name')" :maxlength="200" /><v-textarea v-model="draft.description" :label="t('talents.description')" rows="2" auto-grow :maxlength="10000" hide-details /><TalentAppearance :target="draft" :room-id="roomId" :uploading="uploading" class="mt-4" @upload="upload($event, draft)" /></section>
                    <section class="talent-inspector-section"><div class="talent-inspector-heading"><v-icon icon="mdi-file-tree-outline" /><h3>{{ t('talents.progression.organization') }}</h3></div><AppDropdown v-model="draft.parentTreeId" :items="parentTrees" item-title="name" item-value="id" :label="t('talents.progression.parentTree')" clearable /><p class="talent-field-hint">{{ t('talents.progression.parentHint') }}</p><AppDropdown :model-value="draft.accessMode ?? 'available'" @update:model-value="draft.accessMode = $event" :items="accessModes" :label="t('talents.progression.accessMode')" class="mt-3" /><p class="talent-field-hint">{{ t('talents.progression.accessHint') }}</p></section>
                    <section class="talent-inspector-section"><div class="talent-inspector-heading"><v-icon icon="mdi-circle-multiple-outline" /><h3>{{ t('talents.design.pointEconomy') }}</h3></div><AppDropdown v-model="draft.currency" :items="currencies" :label="t('talents.currency')" hide-details /><p class="talent-field-hint">{{ t('talents.design.currencyHint') }}</p></section>
                    <v-expansion-panels v-model="inspectorSections" multiple variant="accordion" class="talent-inspector-accordions">
                      <v-expansion-panel value="appearance"><v-expansion-panel-title><v-icon icon="mdi-palette-outline" size="18" class="mr-2" />{{ t('talents.design.appearance') }}</v-expansion-panel-title><v-expansion-panel-text>
                        <section class="talent-appearance-section" :aria-label="t('talents.design.nodeAppearance')">
                          <h4 class="talent-appearance-section-heading"><v-icon icon="mdi-star-four-points-outline" size="16" />{{ t('talents.design.nodeAppearance') }}</h4>
                          <div class="talent-toggle-row"><div>{{ t('talents.options.iconsOnly') }}</div><v-switch v-model="draft.options.iconsOnly" :aria-label="t('talents.options.iconsOnly')" hide-details /></div>
                          <AppDropdown v-model="draft.options.levelPosition" :items="levelPositions" :label="t('talents.levelPosition')" hide-details class="mt-3" />
                        </section>
                        <section class="talent-appearance-section" :aria-label="t('talents.design.connectionAppearance')">
                          <h4 class="talent-appearance-section-heading"><v-icon icon="mdi-vector-polyline" size="16" />{{ t('talents.design.connectionAppearance') }}</h4>
                          <TalentConnectionStyles :line="draft.options.connectionStyle ?? 'rounded'" :arrow="draft.options.connectionArrow ?? 'triangle'" @update:line="draft.options.connectionStyle = $event" @update:arrow="draft.options.connectionArrow = $event" :line-label="t('talents.design.defaultConnectionStyle')" :arrow-label="t('talents.design.defaultArrowStyle')" show-labels stacked />
                          <p class="talent-field-hint">{{ t('talents.design.connectionDefaultsHint') }}</p>
                        </section>
                      </v-expansion-panel-text></v-expansion-panel>
                      <v-expansion-panel value="rules"><v-expansion-panel-title><v-icon icon="mdi-shield-check-outline" size="18" class="mr-2" />{{ t('talents.design.playerOptions') }}</v-expansion-panel-title><v-expansion-panel-text><div v-for="key in ['allowRevert', 'allowRespec', 'selectSubtree'] as const" :key="key" class="talent-toggle-row"><div>{{ t('talents.options.' + key) }}</div><v-switch v-model="draft.options[key]" :aria-label="t('talents.options.' + key)" hide-details /></div><template v-if="draft.options.selectSubtree"><div v-for="key in ['allowSpecializationRespec', 'refundSpecialization'] as const" :key="key" class="talent-toggle-row"><div>{{ t('talents.options.' + key) }}</div><v-switch v-model="draft.options[key]" :aria-label="t('talents.options.' + key)" hide-details /></div></template></v-expansion-panel-text></v-expansion-panel>
                      <v-expansion-panel v-if="draft.layout === 'centered'" value="layout"><v-expansion-panel-title><v-icon icon="mdi-orbit" size="18" class="mr-2" />{{ t('talents.design.layoutOptions') }}</v-expansion-panel-title><v-expansion-panel-text><v-text-field v-model.number="draft.options.startingNodes" type="number" min="0" max="50" :label="t('talents.startingNodes')" /><v-btn size="small" variant="tonal" color="primary" prepend-icon="mdi-auto-fix" @click="generateRoots">{{ t('talents.generateRoots') }}</v-btn><div class="talent-toggle-row mt-2"><div>{{ t('talents.separators') }}</div><v-switch v-model="draft.options.separators" :aria-label="t('talents.separators')" hide-details /></div></v-expansion-panel-text></v-expansion-panel>
                    </v-expansion-panels>
                  </template>
                  <template v-if="tab === 'subtrees'">
                    <div class="talent-inspector-section"><div class="talent-inspector-heading"><v-icon icon="mdi-layers-outline" /><h3>{{ t('talents.subtrees') }}</h3><v-chip size="x-small" variant="tonal">{{ draft.subtrees.length }}</v-chip></div><p class="talent-field-hint">{{ t('talents.design.subtreeHint') }}</p><v-btn prepend-icon="mdi-plus" color="primary" variant="tonal" block class="mt-3" @click="addSubtree">{{ t('talents.addSubtree') }}</v-btn></div>
                    <div class="talent-subtree-list"><button v-for="subtree in draft.subtrees" :key="subtree.id" type="button" class="talent-subtree-list-item" @click="editSubtree(subtree.id)"><v-icon :icon="subtree.icon || 'mdi-layers-outline'" size="20" /><span><strong>{{ subtree.name }}</strong><small>{{ t('talents.design.talentCount', draft.nodes.filter(node => node.subtreeId === subtree.id).length) }}</small></span><v-icon icon="mdi-pencil-outline" size="16" /></button></div>
                  </template>
                  <template v-if="tab === 'shapes'">
                    <section class="talent-inspector-section">
                      <div class="talent-inspector-heading"><v-icon icon="mdi-shape-outline" /><h3>{{ t('talents.shapes') }}</h3></div>
                      <p class="talent-field-hint">{{ t('talents.design.shapesHint') }}</p>
                      <v-btn color="primary" variant="tonal" prepend-icon="mdi-plus" block class="mt-3" :disabled="(draft.decorations?.length ?? 0) >= 100" @click="addShape()">{{ t('talents.design.addShape') }}</v-btn>
                    </section>
                    <div class="talent-subtree-list"><button v-for="shape in draft.decorations ?? []" :key="shape.id" type="button" class="talent-subtree-list-item" :aria-pressed="selectedShapeId === shape.id" @click="editShape(shape.id)"><v-icon icon="mdi-shape-outline" size="20" /><span><strong>{{ shape.text || t('talents.design.newShape') }}</strong><small>{{ t('talents.design.shapeTypes.' + shape.shape) }}</small></span><v-icon icon="mdi-pencil-outline" size="16" /></button></div>

                  </template>
                </div>
              </aside>
              <main class="editor-graph"><TalentCanvas :tree="previewTree!" :room-id="roomId" editable :selected="selected" :region-id="selectRegion" @region="setRegion" @select="selected = $event" @edit-node="editNode" @edit-subtree="editSubtree" @move-subtree="moveSubtree" @resize-subtree="resizeSubtree" @connect="connectNodes" @disconnect="disconnectNodes" @style-connection="styleConnection" @arrow-connection="arrowConnection" @subtree-drag-start="startSubtreeMove" @subtree-drag-end="endSubtreeMove" @move="moveNode" @create="addNode" @create-decoration="addShape" @edit-decoration="editShape" @move-decoration="moveShape" @resize-decoration="resizeShape"><template #toolbar-actions><v-btn v-if="selectedNode" icon="mdi-pencil-outline" variant="text" size="small" :aria-label="t('talents.design.editTalent')" :title="t('talents.design.editTalent')" @click="editNode(selectedNode.id)" /><v-btn v-if="draft.layout !== 'free'" icon="mdi-auto-fix" variant="text" size="small" :aria-label="t('talents.arrange')" :title="t('talents.arrange')" @click="arrange" /><v-btn prepend-icon="mdi-plus" color="primary" variant="tonal" size="small" @click="addNode()">{{ t('talents.addNode') }}</v-btn></template></TalentCanvas></main>
            </div>
          </v-defaults-provider>
      <RoomSlidePanel class="talent-context-panel" :model-value="!!nodeDraft" :label="t('talents.design.editTalent')" width="480px" :modal="false" :before-close="canCloseContext" @update:model-value="!$event && closeContext()">
        <v-card v-if="nodeDraft" class="talents-ui talent-context-editor"><v-card-title class="talent-popup-heading"><span class="talent-popup-icon node-appearance-icon" :style="talentColorStyle(nodeDraft.color)"><v-icon :icon="nodeDraft.icon || 'mdi-star-four-points-outline'" size="30" /></span><div><div class="talent-eyebrow">{{ draft?.name }}</div><h2>{{ t('talents.design.editTalent') }}</h2></div><AppCloseButton :disabled="uploading" @click="closeContext" /></v-card-title><v-divider /><v-card-text class="talent-popup-body"><v-defaults-provider :defaults="formDefaults"><div v-if="draft" class="talent-context-fields">
                      <section class="talent-inspector-section"><div class="talent-inspector-heading"><v-icon icon="mdi-star-four-points-outline" /><h3>{{ t('talents.design.talentIdentity') }}</h3><v-chip size="x-small" variant="tonal">{{ nodeDraft.levels.length }} {{ t('talents.design.ranks') }}</v-chip></div><v-text-field v-model="nodeDraft.name" :label="t('talents.name')" :maxlength="200" /><v-textarea v-model="nodeDraft.description" :label="t('talents.description')" :maxlength="10000" rows="2" auto-grow hide-details /><div class="talent-category-picker" role="group" :aria-label="t('talents.progression.category')"><v-btn v-for="kind in ['passive', 'active'] as const" :key="kind" :prepend-icon="kind === 'active' ? 'mdi-lightning-bolt' : 'mdi-shield-outline'" :variant="(nodeDraft.category ?? 'passive') === kind ? 'tonal' : 'text'" :color="(nodeDraft.category ?? 'passive') === kind ? 'primary' : undefined" :aria-pressed="(nodeDraft.category ?? 'passive') === kind" size="small" @click="nodeDraft.category = kind">{{ t('talents.progression.' + kind) }}</v-btn></div></section>
                      <v-expansion-panels v-model="contextSections" multiple variant="accordion" class="talent-inspector-accordions">
                        <v-expansion-panel value="appearance"><v-expansion-panel-title><v-icon icon="mdi-palette-outline" size="18" class="mr-2" />{{ t('talents.design.appearance') }}</v-expansion-panel-title><v-expansion-panel-text><TalentAppearance :target="nodeDraft" :room-id="roomId" :uploading="uploading" @upload="upload($event, nodeDraft)" /><div class="shape-setting-label mt-5">{{ t('talents.design.shapeColor') }}</div><TalentColorPicker :model-value="nodeDraft.color ?? 'primary'" @update:model-value="nodeDraft.color = $event" /></v-expansion-panel-text></v-expansion-panel>
                        <v-expansion-panel value="connections"><v-expansion-panel-title><v-icon icon="mdi-source-branch" size="18" class="mr-2" />{{ t('talents.design.connections') }}</v-expansion-panel-title><v-expansion-panel-text><AppDropdown v-if="draft.layout !== 'free'" v-model="nodeDraft.subtreeId" :items="draft.subtrees" item-title="name" item-value="id" :label="t('talents.subtree')" clearable /><AppDropdown v-model="nodeParents" :items="draft.nodes.filter(n => n.id !== nodeDraft?.id)" item-title="name" item-value="id" multiple chips :label="t('talents.parents')" /><AppDropdown v-model="nodeDraft.parentMode" :items="modes" :label="t('talents.parentMode')" hide-details /></v-expansion-panel-text></v-expansion-panel>
                        <v-expansion-panel value="tree-link"><v-expansion-panel-title><v-icon icon="mdi-link-variant" size="18" class="mr-2" />{{ t('talents.progression.treeConnection') }}</v-expansion-panel-title><v-expansion-panel-text><AppDropdown v-model="nodeDraft.linkedTreeId" :items="linkTrees" item-title="name" item-value="id" :label="t('talents.progression.unlockTree')" clearable /><p class="talent-field-hint">{{ t('talents.progression.unlockHint') }}</p></v-expansion-panel-text></v-expansion-panel>
                        <v-expansion-panel value="conditions"><v-expansion-panel-title><v-icon icon="mdi-shield-key-outline" size="18" class="mr-2" />{{ t('talents.conditions') }}</v-expansion-panel-title><v-expansion-panel-text><v-text-field :model-value="nodeDraft.cost ?? 1" @update:model-value="nodeDraft.cost = Number($event)" type="number" min="0" max="1000000" :label="t('talents.progression.nodeCost')" /><v-switch v-model="nodeDraft.autoUnlock" :label="t('talents.progression.autoUnlock')" :aria-label="t('talents.progression.autoUnlock')" hide-details /><p class="talent-field-hint">{{ t(nodeDraft.autoUnlock ? 'talents.progression.autoUnlockHint' : 'talents.progression.costHint') }}</p><TalentConditions v-model="nodeDraft.conditions" :tree="nodeConditionTree" :label="t('talents.conditions')" /><TalentConditions v-model="nodeDraft.hide" :tree="nodeConditionTree" :label="t('talents.hideConditions')" /></v-expansion-panel-text></v-expansion-panel>
                        <v-expansion-panel value="ranks"><v-expansion-panel-title><v-icon icon="mdi-stairs-up" size="18" class="mr-2" />{{ t('talents.design.ranks') }}<v-chip size="x-small" variant="tonal" class="ml-2">{{ nodeDraft.levels.length }}</v-chip></v-expansion-panel-title><v-expansion-panel-text><fieldset v-for="(level, index) in nodeDraft.levels" :key="level.id" class="level-editor"><legend>{{ t('talents.level') }} {{ index + 1 }}</legend><v-text-field v-model="level.name" :label="t('talents.design.rankName')" :maxlength="200" /><v-textarea v-model="level.description" :label="t('talents.design.rankDescription')" :maxlength="10000" rows="2" auto-grow /><v-switch :model-value="level.cost !== undefined" :label="t('talents.progression.overrideCost')" :aria-label="t('talents.progression.overrideCost')" hide-details @update:model-value="setRankCostOverride(level, !!$event)" /><v-text-field v-if="level.cost !== undefined" v-model.number="level.cost" type="number" min="0" max="1000000" :label="t('talents.progression.rankCost')" /><p v-else class="talent-field-hint">{{ t('talents.progression.inheritedCost', { cost: nodeDraft.cost ?? 1 }) }}</p><TalentConditions v-model="level.conditions" :tree="nodeConditionTree" :label="t('talents.conditions')" /><v-btn v-if="nodeDraft.levels.length > 1" size="x-small" color="error" variant="text" prepend-icon="mdi-minus" @click="nodeDraft.levels.splice(index, 1)">{{ t('talents.delete') }}</v-btn></fieldset><v-btn size="small" color="primary" variant="tonal" prepend-icon="mdi-plus" class="mt-3" @click="nodeDraft.levels.push({ id: uid(), name: '', description: '', conditions: emptyConditions() })">{{ t('talents.addLevel') }}</v-btn></v-expansion-panel-text></v-expansion-panel>
                        <v-expansion-panel value="position"><v-expansion-panel-title><v-icon icon="mdi-cursor-move" size="18" class="mr-2" />{{ t('talents.design.position') }}</v-expansion-panel-title><v-expansion-panel-text><div class="talent-coordinate-row"><v-text-field v-model.number="nodeDraft.x" type="number" label="X" hide-details /><v-text-field v-model.number="nodeDraft.y" type="number" label="Y" hide-details /></div></v-expansion-panel-text></v-expansion-panel>
                      </v-expansion-panels>

        </div></v-defaults-provider></v-card-text><v-card-actions class="talent-popup-footer"><v-btn v-if="!nodeIsNew" color="error" variant="text" prepend-icon="mdi-delete-outline" :disabled="uploading" @click="deleteNode(nodeDraft.id)">{{ t('talents.deleteNode') }}</v-btn><v-spacer /><v-btn variant="text" :disabled="uploading" @click="closeContext">{{ t('common.cancel') }}</v-btn><v-btn color="primary" variant="flat" prepend-icon="mdi-check" :disabled="uploading || !nodeDraft.name.trim()" @click="applyNode">{{ t('talents.design.applyToTree') }}</v-btn></v-card-actions></v-card>
      </RoomSlidePanel>
      <RoomSlidePanel class="talent-context-panel" :model-value="!!subtreeDraft" :label="t('talents.design.editSubtree')" width="480px" :modal="false" :before-close="canCloseContext" @update:model-value="!$event && closeContext()">
        <v-card v-if="subtreeDraft" class="talents-ui talent-context-editor"><v-card-title class="talent-popup-heading"><span class="talent-popup-icon"><v-icon :icon="subtreeDraft.icon || 'mdi-layers-outline'" size="30" /></span><div><div class="talent-eyebrow">{{ draft?.name }}</div><h2>{{ t('talents.design.editSubtree') }}</h2></div><AppCloseButton :disabled="uploading" @click="closeContext" /></v-card-title><v-divider /><v-card-text class="talent-popup-body"><v-defaults-provider :defaults="formDefaults"><div v-if="draft" class="talent-context-fields">
<v-text-field v-model="subtreeDraft.name" :label="t('talents.name')" :maxlength="200" /><v-textarea v-model="subtreeDraft.description" :label="t('talents.description')" :maxlength="10000" rows="2" auto-grow /><TalentAppearance :target="subtreeDraft" :room-id="roomId" :uploading="uploading" class="mb-4" @upload="upload($event, subtreeDraft)" /><v-text-field v-model.number="subtreeDraft.maxPoints" type="number" min="0" :label="t('talents.maxPoints')" /><template v-if="draft.layout === 'free'"><div class="talent-coordinate-row"><v-text-field v-model.number="subtreeDraft.width" type="number" min="80" :label="t('talents.width')" /><v-text-field v-model.number="subtreeDraft.height" type="number" min="80" :label="t('talents.height')" /></div><v-btn size="small" variant="tonal" color="primary" prepend-icon="mdi-vector-square" :disabled="uploading" @click="drawSubtreeRegion">{{ t('talents.drawRegion') }}</v-btn></template><v-btn v-if="!subtreeIsNew" color="error" variant="text" size="small" prepend-icon="mdi-delete-outline" class="mt-3" :disabled="uploading" @click="deleteSubtree(subtreeDraft.id)">{{ t('talents.delete') }}</v-btn>
        </div></v-defaults-provider></v-card-text><v-card-actions class="talent-popup-footer"><v-spacer /><v-btn variant="text" :disabled="uploading" @click="closeContext">{{ t('common.cancel') }}</v-btn><v-btn color="primary" variant="flat" prepend-icon="mdi-check" :disabled="uploading || !subtreeDraft.name.trim()" @click="applySubtree">{{ t('talents.design.applyToTree') }}</v-btn></v-card-actions></v-card>
      </RoomSlidePanel>
      <RoomSlidePanel class="talent-context-panel" :model-value="!!selectedShape" :label="t('talents.design.editShape')" width="480px" :modal="false" :before-close="canCloseContext" @update:model-value="!$event && closeContext()">
        <v-card v-if="selectedShape" class="talents-ui talent-context-editor"><v-card-title class="talent-popup-heading"><span class="talent-popup-icon"><v-icon icon="mdi-shape-outline" size="30" /></span><div><div class="talent-eyebrow">{{ draft?.name }}</div><h2>{{ t('talents.design.editShape') }}</h2></div><AppCloseButton @click="closeContext" /></v-card-title><v-divider /><v-card-text class="talent-popup-body"><v-defaults-provider :defaults="formDefaults"><div class="talent-context-fields">
                    <section v-if="selectedShape" class="talent-inspector-section talent-shape-fields">
                      <div class="shape-setting-label">{{ t('talents.design.shapeType') }}</div>
                      <div class="shape-type-picker" role="group" :aria-label="t('talents.design.shapeType')"><v-btn v-for="type in shapeTypes" :key="type.value" :icon="type.icon" :variant="selectedShape.shape === type.value ? 'tonal' : 'text'" :color="selectedShape.shape === type.value ? 'primary' : undefined" size="small" :title="type.title" :aria-label="type.title" :aria-pressed="selectedShape.shape === type.value" @click="selectedShape.shape = type.value" /></div>
                      <v-textarea v-model="selectedShape.text" :label="t('talents.design.shapeText')" rows="3" auto-grow :maxlength="4000" />
                      <div class="shape-setting-label">{{ t('talents.design.textFormatting') }}</div>
                      <div class="shape-type-picker shape-format-picker" role="group" :aria-label="t('talents.design.textFormatting')"><v-btn v-for="format in shapeFormats" :key="format.value" :icon="format.icon" :variant="selectedShape[format.value] ? 'tonal' : 'text'" :color="selectedShape[format.value] ? 'primary' : undefined" size="small" :title="format.title" :aria-label="format.title" :aria-pressed="!!selectedShape[format.value]" @click="selectedShape[format.value] = !selectedShape[format.value]" /></div>
                      <div class="shape-setting-label">{{ t('talents.design.shapeColor') }}</div>
                      <TalentColorPicker v-model="selectedShape.color" />
                      <div class="shape-size-heading"><span>{{ t('talents.design.shapeFontSize') }}</span><output>{{ selectedShape.fontSize }} px</output></div><v-slider v-model="selectedShape.fontSize" :min="10" :max="48" :step="1" :name="t('talents.design.shapeFontSize')" thumb-label color="primary" hide-details class="shape-size-slider" />
                      <div class="talent-coordinate-row"><v-text-field v-model.number="selectedShape.width" type="number" min="80" max="5000" :label="t('talents.width')" /><v-text-field v-model.number="selectedShape.height" type="number" min="48" max="5000" :label="t('talents.height')" /></div>

                    </section>
        </div></v-defaults-provider></v-card-text><v-card-actions class="talent-popup-footer"><v-btn color="error" variant="text" prepend-icon="mdi-delete-outline" @click="deleteShape(selectedShape.id)">{{ t('talents.design.deleteShape') }}</v-btn><v-spacer /><v-btn variant="text" @click="closeContext">{{ t('common.cancel') }}</v-btn><v-btn color="primary" variant="flat" prepend-icon="mdi-check" @click="applyShape">{{ t('talents.design.applyToTree') }}</v-btn></v-card-actions></v-card>
      </RoomSlidePanel>
        </v-card-text>
        <v-card-actions class="talent-popup-footer talent-editor-footer"><span class="talent-editor-summary"><v-icon icon="mdi-star-four-points-outline" size="15" />{{ t('talents.design.talentCount', draft.nodes.length) }}<span>·</span>{{ t('talents.design.subtreeCount', draft.subtrees.length) }}</span><v-spacer /><v-btn variant="text" :disabled="service.state.busy || uploading" @click="close">{{ t('common.cancel') }}</v-btn><v-btn color="primary" variant="flat" prepend-icon="mdi-check" :loading="service.state.busy" :disabled="service.state.busy || uploading || !!nodeDraft || !!subtreeDraft || !!selectedShape" :title="nodeDraft || subtreeDraft || selectedShape ? t('talents.design.finishSidebar') : undefined" @click="save(false)">{{ t('common.save') }}</v-btn></v-card-actions>
      </v-card>
      <v-dialog v-model="resetDialog" max-width="560" :aria-label="t('talents.resetBuilds')"><v-card class="talents-ui talent-popup"><v-card-title class="talent-popup-heading"><span class="talent-popup-icon"><v-icon icon="mdi-restore" size="28" /></span><div><h2>{{ t('talents.resetBuilds') }}</h2></div></v-card-title><v-card-text class="talent-popup-body"><p class="text-body-2 mb-4">{{ t('talents.resetWarning') }}</p><div v-for="member in resetMembers" :key="member.userId" class="talent-refund-row"><strong>{{ member.name }}</strong><span>{{ member.global }} {{ t('talents.global') }} · {{ member.tree }} {{ t('talents.treePoints') }}</span></div></v-card-text><v-card-actions class="talent-popup-footer"><v-spacer /><v-btn @click="resetDialog = false">{{ t('common.cancel') }}</v-btn><v-btn color="error" variant="flat" :loading="service.state.busy" @click="save(true)">{{ t('talents.confirmReset') }}</v-btn></v-card-actions></v-card></v-dialog>
    </RoomSlidePanel>
  </Teleport>
</template>
<script setup lang="ts">
import AppCloseButton from '@/shared/ui/AppCloseButton.vue';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { talentRoom, talentImageRequest } from '@/features/rooms/services/talents.service';
import { validateTalentTree, validateTalentCatalog, talentConnectionError } from 'netlify/core/utils/talents';
import { emptyConditions, type TalentTree, type TalentDecoration, type TalentRank, type TalentConnectorSide, type TalentConnectionStyle, type TalentArrowStyle, type TalentNode, type TalentIcon, type TalentSubtree, type TalentResult } from 'netlify/core/types/talents.types';
import RoomSlidePanel from '@/features/rooms/components/RoomSlidePanel.component.vue';
import TalentCanvas from '@/features/rooms/components/talents/TalentCanvas.component.vue';
import TalentConditions from '@/features/rooms/components/talents/TalentConditions.component.vue';
import AppDropdown from '@/shared/ui/AppDropdown.component.vue';
import TalentAppearance from '@/features/rooms/components/talents/TalentAppearance.component.vue';
import TalentColorPicker from '@/features/rooms/components/talents/TalentColorPicker.component.vue';
import { talentColorStyle } from '@/features/rooms/components/talents/talent-colors';
import TalentConnectionStyles from '@/features/rooms/components/talents/TalentConnectionStyles.component.vue';
import '@/assets/styles/features/rooms/talents.css';
const props = defineProps<{ roomId: string; userId: string; tree: TalentTree }>();
const open = defineModel<boolean>({ default: false });
const { t } = useI18n(); const service = talentRoom(props.roomId, props.userId);
const uploading = ref(false);
const baseRevision = ref(service.state.snapshot?.revision ?? 0);
const draft = ref<TalentTree>(), original = ref(''), localError = ref(''), tab = ref('tree'), selected = ref<string | null>(null), selectRegion = ref<string | null>(null);
const resetDialog = ref(false), resetMembers = ref<NonNullable<TalentResult['resetRequired']>>([]);
const inspectorSections = ref<string[]>(['connections']);
const contextSections = ref<string[]>(['connections']);
const dirty = computed(() => JSON.stringify(draft.value) !== original.value);
const selectedShapeId = ref<string | null>(null);
const selectedShape = ref<TalentDecoration | null>(null);
const previewTree = computed(() => draft.value && selectedShape.value ? { ...draft.value, decorations: (draft.value.decorations ?? []).map(shape => shape.id === selectedShape.value!.id ? selectedShape.value! : shape) } : draft.value);
const shapeFormats = computed(() => ([{ value: 'bold', icon: 'mdi-format-bold' }, { value: 'italic', icon: 'mdi-format-italic' }, { value: 'underline', icon: 'mdi-format-underline' }, { value: 'strikethrough', icon: 'mdi-format-strikethrough' }] as const).map(format => ({ ...format, title: t('talents.design.' + format.value) })));
const shapeTypes = computed(() => ([{ value: 'rectangle', icon: 'mdi-rectangle-outline' }, { value: 'rounded', icon: 'mdi-square-rounded-outline' }, { value: 'ellipse', icon: 'mdi-ellipse-outline' }, { value: 'diamond', icon: 'mdi-rhombus-outline' }] as const).map(type => ({ ...type, title: t('talents.design.shapeTypes.' + type.value) })));

const linkTrees = computed(() => service.state.snapshot?.trees.filter(tree => tree.id !== draft.value?.id) ?? []);
const parentTrees = computed(() => linkTrees.value.filter(tree => { if (!draft.value) return false; try { validateTalentCatalog([...(service.state.snapshot?.trees ?? []).filter(tree => tree.id !== draft.value!.id), { ...draft.value, parentTreeId: tree.id }]); return true; } catch { return false; } }));
const accessModes = computed(() => ['available', 'restricted'].map(value => ({ value, title: t('talents.progression.accessModes.' + value) })));
function setRankCostOverride(rank: TalentRank, enabled: boolean) { if (enabled) rank.cost = nodeDraft.value?.cost ?? 1; else delete rank.cost; }
const inspectorTabs = ['tree', 'subtrees', 'shapes'] as const;
const formDefaults = { VTextField: { variant: 'outlined', density: 'comfortable' }, VTextarea: { variant: 'outlined', density: 'comfortable' }, VSwitch: { inset: true, color: 'primary', density: 'compact' } };
const nodeDraft = ref<TalentNode | null>(null), nodeParents = ref<string[]>([]), nodeIsNew = ref(false), nodePositioned = ref(false);
const subtreeDraft = ref<TalentSubtree | null>(null), subtreeIsNew = ref(false);
const movingSubtree = ref<string | null>(null);
const contextBaseline = ref('');
const contextDirty = computed(() => JSON.stringify(nodeDraft.value ? [nodeDraft.value, nodeParents.value] : subtreeDraft.value ?? selectedShape.value) !== contextBaseline.value && !!(nodeDraft.value || subtreeDraft.value || selectedShape.value));
let subtreeMoveBaseline: TalentTree | null = null;
const nodeConditionTree = computed(() => ({ ...draft.value!, nodes: nodeDraft.value ? [...draft.value!.nodes.filter(node => node.id !== nodeDraft.value!.id), nodeDraft.value] : draft.value!.nodes }));
const inspectorIcons = { tree: 'mdi-file-tree-outline', node: 'mdi-star-four-points-outline', subtrees: 'mdi-layers-outline', shapes: 'mdi-shape-outline' };
const currencies = computed(() => ['global', 'tree', 'both'].map(value => ({ value, title: t('talents.currencies.' + value) })));
const modes = computed(() => ['all', 'any'].map(value => ({ value, title: t('talents.' + value) })));
const levelPositions = computed(() => ['top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right'].map(value => ({ value, title: t('talents.positions.' + value) })));
watch(() => [props.tree, open.value] as const, ([tree, isOpen]) => { if (!isOpen) return; initialize(tree); }, { immediate: true });
function initialize(tree: TalentTree) { draft.value = JSON.parse(JSON.stringify(tree)); original.value = JSON.stringify(tree); baseRevision.value = service.state.snapshot?.revision ?? 0; selected.value = null; selectedShapeId.value = null; selectedShape.value = null; tab.value = 'tree'; localError.value = ''; nodeDraft.value = null; subtreeDraft.value = null; }
watch(() => service.state.snapshot?.canManage, canManage => { if (!canManage) open.value = false; });
const selectedNode = computed(() => draft.value?.nodes.find(n => n.id === selected.value));
function uid() { return crypto.randomUUID(); }
function canClose() { return !service.state.busy && !uploading.value && ((JSON.stringify(draft.value) === original.value && !contextDirty.value) || window.confirm(t('talents.discard'))); }
function close() { if (canClose()) open.value = false; }
function makeNode(): TalentNode { const tree = draft.value!; return { id: uid(), name: t('talents.newNode'), description: '', cost: 1, category: 'passive', linkedTreeId: null, icon: 'mdi-star-four-points', imageId: null, subtreeId: tree.subtrees[0]?.id ?? null, x: 100, y: 100 + tree.nodes.length * 100, parentMode: 'all', conditions: emptyConditions(), hide: emptyConditions(), levels: [{ id: uid(), name: '', description: '', conditions: emptyConditions() }] }; }
function canCloseContext() { return !uploading.value; }
function closeContext() { if (!canCloseContext()) return; nodeDraft.value = null; subtreeDraft.value = null; selectedShape.value = null; selectedShapeId.value = null; }
function prepareContext() { if (uploading.value || (contextDirty.value && !window.confirm(t('talents.discard')))) return false; closeContext(); return true; }
function addShape(point?: { x: number; y: number }) {
  if (!prepareContext() || (draft.value!.decorations?.length ?? 0) >= 100) return;
  const shape: TalentDecoration = { id: uid(), shape: 'rounded', text: t('talents.design.newShape'), color: 'primary', fontSize: 16, x: Math.round(((point?.x ?? 160) - 120) / 20) * 20, y: Math.round(((point?.y ?? 160) - 60) / 20) * 20, width: 240, height: 120 };
  (draft.value!.decorations ??= []).push(shape); openShape(shape);
}
function openShape(shape: TalentDecoration) { selectedShape.value = JSON.parse(JSON.stringify(shape)); selectedShapeId.value = shape.id; tab.value = 'shapes'; contextBaseline.value = JSON.stringify(selectedShape.value); }
function editShape(id: string) { if (!prepareContext()) return; const shape = draft.value?.decorations?.find(shape => shape.id === id); if (shape) openShape(shape); }
function applyShape() { if (!selectedShape.value || !draft.value) return; const shape = JSON.parse(JSON.stringify(selectedShape.value)) as TalentDecoration; const index = draft.value.decorations!.findIndex(existing => existing.id === shape.id); if (index >= 0) draft.value.decorations![index] = shape; closeContext(); }
function moveShape(id: string, x: number, y: number) { const shape = draft.value?.decorations?.find(shape => shape.id === id); if (shape) { shape.x = x; shape.y = y; } if (selectedShape.value?.id === id) { selectedShape.value.x = x; selectedShape.value.y = y; const baseline = JSON.parse(contextBaseline.value); Object.assign(baseline, { x, y }); contextBaseline.value = JSON.stringify(baseline); } }
function resizeShape(id: string, width: number, height: number) { const shape = draft.value?.decorations?.find(shape => shape.id === id); if (shape) { shape.width = width; shape.height = height; } if (selectedShape.value?.id === id) { selectedShape.value.width = width; selectedShape.value.height = height; const baseline = JSON.parse(contextBaseline.value); Object.assign(baseline, { width, height }); contextBaseline.value = JSON.stringify(baseline); } }
function deleteShape(id: string) { draft.value!.decorations = draft.value!.decorations!.filter(shape => shape.id !== id); closeContext(); }
function addNode(point?: { x: number; y: number }) { if (!prepareContext()) return; nodeIsNew.value = true; nodePositioned.value = !!point; nodeParents.value = []; nodeDraft.value = makeNode(); if (point) { nodeDraft.value.x = Math.round(point.x - 32); nodeDraft.value.y = Math.round(point.y - 32); nodeDraft.value.subtreeId = draft.value!.subtrees.find(region => point.x >= region.x && point.x <= region.x + region.width && point.y >= region.y && point.y <= region.y + region.height)?.id ?? null; } contextBaseline.value = JSON.stringify([nodeDraft.value, nodeParents.value]); }
function editNode(id: string) { if (!prepareContext()) return; const node = draft.value?.nodes.find(node => node.id === id); if (!node) return; selected.value = id; nodeIsNew.value = false; nodeParents.value = draft.value!.edges.filter(edge => edge.child === id).map(edge => edge.parent); nodeDraft.value = JSON.parse(JSON.stringify(node)); contextBaseline.value = JSON.stringify([nodeDraft.value, nodeParents.value]); }
function applyNode() {
  if (!nodeDraft.value || !nodeDraft.value.name.trim()) return;
  const tree = draft.value!, node = JSON.parse(JSON.stringify(nodeDraft.value)) as TalentNode;
  const hadParent = tree.edges.some(edge => edge.child === node.id);
  if (tree.layout === 'centered' && !hadParent && nodeParents.value.length) node.subtreeId = tree.nodes.find(parent => parent.id === nodeParents.value[0])?.subtreeId ?? null;
  const index = tree.nodes.findIndex(existing => existing.id === node.id);
  if (index < 0) tree.nodes.push(node); else tree.nodes[index] = node;
  tree.edges = [...tree.edges.filter(edge => edge.child !== node.id), ...nodeParents.value.map(parent => tree.edges.find(edge => edge.parent === parent && edge.child === node.id) ?? { parent, child: node.id })];
  selected.value = node.id; nodeDraft.value = null;
  if (index < 0 && tree.layout !== 'free' && !nodePositioned.value) arrange();
  assignRegions();
}
function generateRoots() {
  const tree = draft.value!; const roots = tree.nodes.filter(n => !tree.edges.some(e => e.child === n.id));
  const count = tree.options.startingNodes;
  if (!Number.isInteger(count) || count < 2 || count > 50) return;
  if (roots.length > count) { localError.value = t('talents.tooManyRoots'); return; }
  for (let i = roots.length; i < count; i++) { const node = makeNode(); node.subtreeId = tree.subtrees[i % Math.max(1, tree.subtrees.length)]?.id ?? null; tree.nodes.push(node); }
  arrange();
}
function addSubtree() { if (!prepareContext()) return; const tree = draft.value!; subtreeIsNew.value = true; subtreeDraft.value = { id: uid(), name: t('talents.newSubtree'), description: '', icon: 'mdi-file-tree', imageId: null, maxPoints: 0, x: tree.subtrees.length * 360, y: 0, width: 320, height: 600 }; contextBaseline.value = JSON.stringify(subtreeDraft.value); }
function editSubtree(id: string) { if (!prepareContext()) return; const subtree = draft.value?.subtrees.find(subtree => subtree.id === id); if (!subtree) return; subtreeIsNew.value = false; subtreeDraft.value = JSON.parse(JSON.stringify(subtree)); contextBaseline.value = JSON.stringify(subtreeDraft.value); }
function applySubtree() { if (!subtreeDraft.value || !subtreeDraft.value.name.trim()) return; const tree = draft.value!, subtree = JSON.parse(JSON.stringify(subtreeDraft.value)) as TalentSubtree; const index = tree.subtrees.findIndex(existing => existing.id === subtree.id); if (index < 0) tree.subtrees.push(subtree); else tree.subtrees[index] = subtree; subtreeDraft.value = null; if (index < 0 && tree.layout !== 'free') arrange(); assignRegions(); }
function drawSubtreeRegion() { const id = subtreeDraft.value?.id; applySubtree(); if (id && !subtreeDraft.value) selectRegion.value = id; }
function synchronizeContextConnection(parent: string, child: string, remove = false) {
  if (nodeDraft.value?.id !== child) return;
  nodeParents.value = remove ? nodeParents.value.filter(id => id !== parent) : [...new Set([...nodeParents.value, parent])];
  const baseline = JSON.parse(contextBaseline.value) as [TalentNode, string[]];
  baseline[1] = draft.value!.edges.filter(edge => edge.child === child).map(edge => edge.parent);
  const node = draft.value!.nodes.find(node => node.id === child)!;
  nodeDraft.value.subtreeId = node.subtreeId; baseline[0].subtreeId = node.subtreeId;
  contextBaseline.value = JSON.stringify(baseline);
}
function connectNodes(parent: string, child: string, parentSide: TalentConnectorSide, childSide: TalentConnectorSide) {
  const tree = draft.value!, error = talentConnectionError(tree, parent, child);
  if (error) { localError.value = t('talents.design.connectionErrors.' + error); return; }
  const firstParent = !tree.edges.some(edge => edge.child === child);
  tree.edges.push({ parent, child, parentSide, childSide });
  if (tree.layout === 'centered' && firstParent) tree.nodes.find(node => node.id === child)!.subtreeId = tree.nodes.find(node => node.id === parent)!.subtreeId;
  synchronizeContextConnection(parent, child); localError.value = '';
}
function styleConnection(parent: string, child: string, style: TalentConnectionStyle | null) {
  const edge = draft.value!.edges.find(edge => edge.parent === parent && edge.child === child);
  if (edge) { if (style === null) delete edge.style; else edge.style = style; }
}
function arrowConnection(parent: string, child: string, arrow: TalentArrowStyle | null) {
  const edge = draft.value!.edges.find(edge => edge.parent === parent && edge.child === child);
  if (edge) { if (arrow === null) delete edge.arrow; else edge.arrow = arrow; }
}
function disconnectNodes(parent: string, child: string) {
  draft.value!.edges = draft.value!.edges.filter(edge => edge.parent !== parent || edge.child !== child);
  synchronizeContextConnection(parent, child, true); localError.value = '';
}
function deleteNode(id: string) { const tree = draft.value!; tree.nodes = tree.nodes.filter(node => node.id !== id); tree.edges = tree.edges.filter(edge => edge.parent !== id && edge.child !== id); selected.value = null; nodeDraft.value = null; }
function deleteSubtree(id: string) { const tree = draft.value!; tree.subtrees = tree.subtrees.filter(subtree => subtree.id !== id); tree.nodes.forEach(node => { if (node.subtreeId === id) node.subtreeId = null; }); subtreeDraft.value = null; }
function startSubtreeMove(id: string) { movingSubtree.value = id; subtreeMoveBaseline = JSON.parse(JSON.stringify(draft.value)); localError.value = ''; }
function synchronizeContextPositions() {
  if (!draft.value || !contextBaseline.value) return;
  if (nodeDraft.value) {
    const node = draft.value.nodes.find(node => node.id === nodeDraft.value!.id);
    if (!node) return;
    nodeDraft.value.x = node.x; nodeDraft.value.y = node.y;
    const baseline = JSON.parse(contextBaseline.value) as [TalentNode, string[]];
    baseline[0].x = node.x; baseline[0].y = node.y; contextBaseline.value = JSON.stringify(baseline);
  } else if (subtreeDraft.value) {
    const subtree = draft.value.subtrees.find(subtree => subtree.id === subtreeDraft.value!.id);
    if (!subtree) return;
    subtreeDraft.value.x = subtree.x; subtreeDraft.value.y = subtree.y; subtreeDraft.value.width = subtree.width; subtreeDraft.value.height = subtree.height; subtreeDraft.value.boundsMode = subtree.boundsMode;
    const baseline = JSON.parse(contextBaseline.value) as TalentSubtree;
    baseline.x = subtree.x; baseline.y = subtree.y; baseline.width = subtree.width; baseline.height = subtree.height; baseline.boundsMode = subtree.boundsMode; contextBaseline.value = JSON.stringify(baseline);
  }
}
function moveSubtree(id: string, dx: number, dy: number) { const tree = draft.value!, subtree = tree.subtrees.find(subtree => subtree.id === id); if (!subtree) return; subtree.x += dx; subtree.y += dy; for (const node of tree.nodes) if (node.subtreeId === id) { node.x += dx; node.y += dy; } synchronizeContextPositions(); }
function resizeSubtree(id: string, x: number, y: number, width: number, height: number) { const subtree = draft.value?.subtrees.find(subtree => subtree.id === id); if (!subtree) return; Object.assign(subtree, { x, y, width, height, boundsMode: 'manual' }); synchronizeContextPositions(); }
function endSubtreeMove(id: string) { const tree = draft.value!, subtree = tree.subtrees.find(subtree => subtree.id === id); if (tree.layout === 'free' && subtree && tree.subtrees.some(other => other.id !== id && subtree.x < other.x + other.width && subtree.x + subtree.width > other.x && subtree.y < other.y + other.height && subtree.y + subtree.height > other.y)) { if (subtreeMoveBaseline) draft.value = subtreeMoveBaseline; localError.value = t('talents.design.overlappingSubtree'); } movingSubtree.value = null; subtreeMoveBaseline = null; assignRegions(); synchronizeContextPositions(); }
function assignRegions() { const tree = draft.value!; if (movingSubtree.value) return; if (tree.layout === 'free') for (const n of tree.nodes) n.subtreeId = tree.subtrees.find(s => n.x >= s.x && n.x < s.x + s.width && n.y >= s.y && n.y < s.y + s.height)?.id ?? null; }
function moveNode(id: string, x: number, y: number) { const n = draft.value!.nodes.find(n => n.id === id)!; n.x = x; n.y = y; assignRegions(); synchronizeContextPositions(); }
function setRegion(id: string, x: number, y: number, width: number, height: number) { const region = draft.value!.subtrees.find(s => s.id === id); if (region) Object.assign(region, { x, y, width, height }); selectRegion.value = null; assignRegions(); }
watch(() => draft.value?.subtrees.map(s => [s.x, s.y, s.width, s.height]), assignRegions, { deep: true });
function arrange() {
  const tree = draft.value!; if (tree.layout === 'free') return;
  const groups = [...tree.subtrees.map(s => s.id), null];
  let groupX = 0;
  const roots = tree.nodes.filter(n => !tree.edges.some(e => e.child === n.id));
  const firstRoot = (id: string, seen = new Set<string>()): string => { if (seen.has(id)) return id; seen.add(id); const parent = tree.edges.find(e => e.child === id)?.parent; return parent ? firstRoot(parent, seen) : id; };
  const depth = (id: string, seen = new Set<string>()): number => { if (seen.has(id)) return 0; seen.add(id); const parents = tree.edges.filter(e => e.child === id); return parents.length ? 1 + Math.max(...parents.map(e => depth(e.parent, new Set(seen)))) : 0; };
  groups.forEach((group, i) => {
    const nodes = tree.nodes.filter(n => n.subtreeId === group), rows = new Map<number, number>();
    nodes.forEach(n => { const d = depth(n.id), column = rows.get(d) ?? 0; rows.set(d, column + 1); if (tree.layout === 'classic') { n.x = groupX + 50 + column * 100; n.y = 70 + d * 140; } else { const angle = (tree.subtrees.length ? i / tree.subtrees.length : Math.max(0, roots.findIndex(r => r.id === firstRoot(n.id))) / Math.max(1, roots.length)) * Math.PI * 2 - Math.PI / 2 + (tree.subtrees.length ? column * .18 : 0); const radius = 160 + d * 140; n.x = Math.round(600 + Math.cos(angle) * radius); n.y = Math.round(500 + Math.sin(angle) * radius); } });
    const subtree = tree.subtrees.find(s => s.id === group); if (subtree && tree.layout === 'classic') { subtree.x = groupX; subtree.y = 0; subtree.width = Math.max(subtree.boundsMode === 'manual' ? subtree.width : 0, 320, ...[...rows.values()].map(c => c * 100 + 100)); subtree.height = Math.max(subtree.boundsMode === 'manual' ? subtree.height : 0, 400, ...nodes.map(n => n.y + 140)); }
    groupX += Math.max(subtree ? subtree.width + 40 : 0, 360, ...[...rows.values()].map(c => c * 100 + 140));
  });
}
async function upload(value: File | File[] | null, target: TalentIcon | undefined) { const file = Array.isArray(value) ? value[0] : value; if (!file || !target || uploading.value) return; uploading.value = true; try { const response = await talentImageRequest(props.roomId, undefined, file); target.imageId = (await response.json()).data.id; } catch (error) { localError.value = error instanceof Error ? error.message : String(error); } finally { uploading.value = false; } }
async function save(confirmReset: boolean) {
  localError.value = ''; assignRegions();
  let tree: TalentTree; try { tree = validateTalentTree(JSON.parse(JSON.stringify(draft.value))); } catch (error) { localError.value = error instanceof Error ? error.message : String(error); return; }
  const result = await service.mutate({ op: 'save', tree, confirmReset }, baseRevision.value);
  if (result?.resetRequired) { resetMembers.value = result.resetRequired; resetDialog.value = true; }
  else if (result) { original.value = JSON.stringify(draft.value); resetDialog.value = false; open.value = false; }
}
</script>
<style scoped>
.talent-editor-error { flex:0 0 auto; }
.talent-editor-heading { padding:16px 20px; }.talent-editor-heading .talent-popup-icon { width:48px; height:48px; }.talent-editor-body { position:relative; padding:0 !important; display:flex; flex-direction:column; overflow:hidden !important; }.editor-layout { display:grid; grid-template-columns:340px minmax(0,1fr); flex:1; min-height:0; }.editor-inspector { min-height:0; display:flex; flex-direction:column; border-right:1px solid var(--talent-border); background:rgb(var(--v-theme-surface)); }.talent-inspector-tabs { flex:0 0 44px; border-bottom:1px solid var(--talent-border); }.talent-inspector-tabs :deep(.v-tab) { min-width:0; font-size:11px; padding:0 8px; }.talent-inspector-content { overflow-y:auto; min-height:0; padding-bottom:20px; }.talent-inspector-section { padding:20px 18px; border-bottom:1px solid var(--talent-border); }.talent-inspector-heading { display:flex; align-items:center; gap:8px; margin-bottom:18px; }.talent-inspector-heading > .v-icon { font-size:18px; color:rgb(var(--v-theme-primary)); }.talent-inspector-heading h3 { font-size:12px; font-weight:650; flex:1; }.talent-field-hint { font-size:11px; line-height:1.7; color:var(--talent-muted); margin-top:10px; }.talent-inspector-accordions { border-radius:0; }.talent-inspector-accordions :deep(.v-expansion-panel) { background:transparent; box-shadow:none; border-bottom:1px solid var(--talent-border); }.talent-inspector-accordions :deep(.v-expansion-panel__shadow) { display:none; }.talent-inspector-accordions :deep(.v-expansion-panel-title) { padding:18px; font-size:12px; min-height:52px; }.talent-inspector-accordions :deep(.v-expansion-panel-text__wrapper) { padding:0 18px 18px; }.talent-inspector-accordions :deep(.v-expansion-panel-title > .v-icon) { color:rgb(var(--v-theme-primary)); }.talent-inspector-empty { min-height:280px; }.talent-inspector-empty h3 { font-size:14px; }.talent-inspector-danger { padding:18px; }.talent-coordinate-row { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }.level-editor { padding:10px; border:1px solid var(--talent-border); border-radius:12px; margin-top:12px; }.level-editor legend { padding:0 6px; font-size:11px; font-weight:600; color:rgb(var(--v-theme-primary)); }.editor-graph { display:flex; flex-direction:column; min-width:0; min-height:0; padding:20px; background:rgba(var(--v-theme-on-surface), .018); }.editor-graph :deep(.talent-canvas-shell) { flex:1; min-height:0; border:1px solid var(--talent-border); border-radius:14px; overflow:hidden; }.editor-graph :deep(.canvas-viewport) { height:auto; min-height:300px; }.talent-draft-status { display:flex; align-items:center; gap:6px; font-size:10px; color:var(--talent-muted); white-space:nowrap; }.talent-draft-status i { width:5px; height:5px; border-radius:50%; background:rgba(var(--v-theme-on-surface),.3); }.talent-draft-status.is-dirty i { background:rgb(var(--v-theme-primary)); }.talent-editor-footer { flex-shrink:0; }.talent-editor-summary { display:flex; align-items:center; gap:6px; font-size:11px; color:var(--talent-muted); }.talent-editor-summary > span { padding:0 4px; }.talent-refund-row { display:flex; flex-direction:column; gap:4px; font-size:12px; padding:12px 0; border-bottom:1px solid var(--talent-border); }.talent-refund-row span { color:var(--talent-muted); }
@media(max-width:900px) { .talent-editor-body { overflow-y:auto !important; }.editor-layout { display:flex; flex-direction:column-reverse; flex:none; }.editor-graph { height:430px; padding:16px; flex-shrink:0; }.editor-graph :deep(.canvas-viewport) { min-height:240px; }.editor-inspector { border-right:0; border-top:1px solid var(--talent-border); }.talent-inspector-content { overflow:visible; }.talent-inspector-tabs { position:sticky; top:0; z-index:2; background:rgb(var(--v-theme-surface)); }.talent-editor-heading { padding:14px 16px; }.talent-editor-heading h2 { font-size:16px; }.talent-draft-status { display:none; } }
@media(max-width:600px) { .editor-graph { height:370px; padding:12px; }.talent-editor-summary { display:none; }.talent-editor-heading .talent-popup-icon { width:40px; height:40px; border-radius:12px; }.talent-editor-heading .talent-eyebrow { font-size:9px; } }
.talent-subtree-list { padding:0 12px; }.talent-subtree-list-item { display:flex; align-items:center; width:100%; gap:10px; padding:14px 8px; border-bottom:1px solid var(--talent-border); text-align:left; cursor:pointer; }.talent-subtree-list-item > .v-icon { color:rgb(var(--v-theme-primary)); }.talent-subtree-list-item span { flex:1; min-width:0; display:flex; flex-direction:column; gap:4px; }.talent-subtree-list-item strong { font-size:12px; overflow-wrap:anywhere; }.talent-subtree-list-item small { font-size:10px; color:var(--talent-muted); }.talent-context-fields > .talent-inspector-section { padding:0 0 20px; margin-bottom:16px; }.talent-context-fields :deep(.v-expansion-panel__shadow) { display:none; }.talent-context-fields :deep(.v-expansion-panel-title) { font-size:13px; }.talent-context-editor .talent-popup-footer { flex-wrap:wrap; }
.talent-context-panel { z-index:30; border-left:1px solid var(--talent-border); border-radius:0; box-shadow:-12px 0 32px rgba(0,0,0,.14); }.talent-context-panel > .talent-context-editor { border-radius:0 !important; background:rgb(var(--v-theme-surface)); }.talent-context-editor .talent-popup-heading { padding:18px; gap:12px; }.talent-context-editor .talent-popup-heading h2 { font-size:18px; }.talent-context-editor .talent-popup-icon { width:42px; height:42px; border-radius:12px; }.talent-context-editor .talent-popup-body { padding:20px 18px !important; min-height:0; overflow-y:auto; overscroll-behavior:contain; }.talent-context-editor .talent-popup-footer { padding:14px 18px !important; flex-shrink:0; gap:6px; }.talent-context-editor .talent-popup-footer .v-btn { font-size:11px; }.talent-editor-body.has-context { overflow:hidden !important; }
.talent-appearance-section + .talent-appearance-section { margin-top:20px; padding-top:18px; border-top:1px solid var(--talent-border); }
.talent-appearance-section-heading { display:flex; align-items:center; gap:8px; margin-bottom:14px; font-size:12px; font-weight:650; }.talent-appearance-section-heading .v-icon { color:rgb(var(--v-theme-primary)); }
.talent-category-picker { display:flex; flex-wrap:wrap; gap:4px; margin-top:16px; padding:3px; border:1px solid var(--talent-border); border-radius:10px; }
.shape-setting-label { margin:0 0 8px; font-size:11px; color:var(--talent-muted); }.shape-type-picker { display:flex; flex-wrap:wrap; gap:2px; width:max-content; max-width:100%; padding:2px; border:1px solid var(--talent-border); border-radius:8px; margin-bottom:20px; }

.shape-size-heading { display:flex; align-items:center; justify-content:space-between; font-size:11px; color:var(--talent-muted); margin-bottom:8px; }.shape-size-heading output { font-variant-numeric:tabular-nums; padding:3px 8px; border:1px solid var(--talent-border); border-radius:6px; color:rgb(var(--v-theme-on-surface)); }.shape-size-slider { margin-bottom:16px; }
.node-appearance-icon { color:rgb(var(--talent-accent)); background:rgba(var(--talent-accent),.09); }
</style>
