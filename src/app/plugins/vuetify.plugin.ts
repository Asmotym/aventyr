import { createVuetify } from 'vuetify';
import { getInitialVuetifyTheme } from '@/shared/preferences/theme.service';
import * as themes from '@/shared/themes';

import { VAlert } from 'vuetify/components/VAlert';
import { VApp } from 'vuetify/components/VApp';
import { VAppBar, VAppBarTitle } from 'vuetify/components/VAppBar';
import { VAvatar } from 'vuetify/components/VAvatar';
import { VBtn } from 'vuetify/components/VBtn';
import { VBtnToggle } from 'vuetify/components/VBtnToggle';
import { VCard, VCardActions, VCardSubtitle, VCardText, VCardTitle } from 'vuetify/components/VCard';
import { VCheckbox } from 'vuetify/components/VCheckbox';
import { VChip } from 'vuetify/components/VChip';
import { VCol, VContainer, VRow, VSpacer } from 'vuetify/components/VGrid';
import { VDefaultsProvider } from 'vuetify/components/VDefaultsProvider';
import { VDialog } from 'vuetify/components/VDialog';
import { VDivider } from 'vuetify/components/VDivider';
import { VExpansionPanel, VExpansionPanelText, VExpansionPanelTitle, VExpansionPanels } from 'vuetify/components/VExpansionPanel';
import { VFileInput } from 'vuetify/components/VFileInput';
import { VFooter } from 'vuetify/components/VFooter';
import { VForm } from 'vuetify/components/VForm';
import { VIcon } from 'vuetify/components/VIcon';
import { VImg } from 'vuetify/components/VImg';
import { VInfiniteScroll } from 'vuetify/components/VInfiniteScroll';
import { VList, VListItem, VListItemSubtitle, VListItemTitle, VListSubheader } from 'vuetify/components/VList';
import { VMain } from 'vuetify/components/VMain';
import { VMenu } from 'vuetify/components/VMenu';
import { VNumberInput } from 'vuetify/components/VNumberInput';
import { VProgressCircular } from 'vuetify/components/VProgressCircular';
import { VProgressLinear } from 'vuetify/components/VProgressLinear';
import { VRadio } from 'vuetify/components/VRadio';
import { VRadioGroup } from 'vuetify/components/VRadioGroup';
import { VResponsive } from 'vuetify/components/VResponsive';
import { VSkeletonLoader } from 'vuetify/components/VSkeletonLoader';
import { VSlider } from 'vuetify/components/VSlider';
import { VSnackbar } from 'vuetify/components/VSnackbar';
import { VSwitch } from 'vuetify/components/VSwitch';
import { VTab, VTabs } from 'vuetify/components/VTabs';
import { VTable } from 'vuetify/components/VTable';
import { VTextField } from 'vuetify/components/VTextField';
import { VTextarea } from 'vuetify/components/VTextarea';
import { VTooltip } from 'vuetify/components/VTooltip';
import { VVirtualScroll } from 'vuetify/components/VVirtualScroll';
import { VWindow, VWindowItem } from 'vuetify/components/VWindow';

const dropdownDefaults = {
    variant: 'outlined',
    density: 'comfortable',
    color: 'primary',
    menuProps: { maxHeight: 360 },
    VChip: { color: 'primary', variant: 'tonal', size: 'small' },
}

export const vuetify = createVuetify({
    components: {
        VAlert,
        VApp,
        VAppBar,
        VAppBarTitle,
        VAvatar,
        VBtn,
        VBtnToggle,
        VCard,
        VCardActions,
        VCardSubtitle,
        VCardText,
        VCardTitle,
        VCheckbox,
        VChip,
        VCol,
        VContainer,
        VDefaultsProvider,
        VDialog,
        VDivider,
        VExpansionPanel,
        VExpansionPanelText,
        VExpansionPanelTitle,
        VExpansionPanels,
        VFileInput,
        VFooter,
        VForm,
        VIcon,
        VImg,
        VInfiniteScroll,
        VList,
        VListItem,
        VListItemSubtitle,
        VListItemTitle,
        VListSubheader,
        VMain,
        VMenu,
        VNumberInput,
        VProgressCircular,
        VProgressLinear,
        VRadio,
        VRadioGroup,
        VResponsive,
        VRow,
        VSkeletonLoader,
        VSlider,
        VSnackbar,
        VSpacer,
        VSwitch,
        VTab,
        VTable,
        VTabs,
        VTextField,
        VTextarea,
        VTooltip,
        VVirtualScroll,
        VWindow,
        VWindowItem,
    },
    icons: {
        defaultSet: 'mdi',
    },
    theme: {
        defaultTheme: getInitialVuetifyTheme(),
        themes: {
            aventyrDark: themes.aventyrDark,
            aventyrLight: themes.aventyrLight,
            arcaneDark: themes.arcaneDark,
            arcaneLight: themes.arcaneLight,
            explorerDark: themes.explorerDark,
            explorerLight: themes.explorerLight,
            kingdomDark: themes.kingdomDark,
            kingdomLight: themes.kingdomLight,
            campfireDark: themes.campfireDark,
            campfireLight: themes.campfireLight,
        },
        /*
        * Vuetify will generate:
        *
        * bg-primary-lighten-1
        * bg-primary-darken-1
        * text-accent-lighten-2
        * text-success-darken-2
        * etc.
        */
        variations: {
            colors: [
                'primary',
                'secondary',
                'accent',
                'success',
                'warning',
                'error',
                'info',

                'arcane',
                'mana',
                'forest',
                'moss',
                'royal',
                'crown',
                'ember',
                'flame',
            ],

            lighten: 2,
            darken: 2,
        },
    },
    defaults: {
        VBtn: {
            elevation: 0,
        },

        VCard: {
            rounded: 'lg',
            elevation: 1,
        },

        VDialog: {
            maxWidth: 700,
        },

        VMenu: {
            offset: 8,
        },

        VTextField: {
            variant: 'outlined',
            density: 'comfortable',
            color: 'primary',
        },

        VTextarea: {
            variant: 'outlined',
            density: 'comfortable',
            color: 'primary',
        },

        VSelect: dropdownDefaults,
        VAutocomplete: dropdownDefaults,
        VCombobox: dropdownDefaults,

        VCheckbox: {
            color: 'primary',
        },

        VRadio: {
            color: 'primary',
        },

        VSwitch: {
            color: 'primary',
            inset: true,
        },

        VSlider: {
            color: 'primary',
        },

        VProgressCircular: {
            color: 'primary',
        },

        VProgressLinear: {
            color: 'primary',
        },

        VTooltip: {
            location: 'top',
        },

        VExpansionPanels: {
            bgColor: 'surface-variant',
        },
    },
})

