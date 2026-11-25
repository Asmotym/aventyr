import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { emptySettingsPackage, parseSettingsPackage, pruneTransferImages, SETTINGS_TRANSFER_LIMIT, validateTransferDependencies, type RoomSettingsPackage, type SettingsTransferPreview, type TransferSectionKey } from '@shared/rooms/settings-transfer';
import { settingsTransferRequest } from '../services/rooms.service';
export function allTransferSelections(data: RoomSettingsPackage): string[] {
    return Object.entries(data.sections).flatMap(([key, s]) => [key, ...Object.keys(s.values).map(field => `${key}.value.${field}`), ...Object.entries(s.lists).flatMap(([list, entries]) => entries.map((_, index) => `${key}.${list}.${index}`))]);
}
export function selectTransferPackage(data: RoomSettingsPackage, selection: string[]): RoomSettingsPackage {
    const result = emptySettingsPackage(); result.images = data.images;
    for (const [key, s] of Object.entries(data.sections)) if (selection.includes(key)) result.sections[key as TransferSectionKey] = {
        values: Object.fromEntries(Object.entries(s.values).filter(([field]) => selection.includes(`${key}.value.${field}`))),
        lists: Object.fromEntries(Object.entries(s.lists).map(([list, entries]) => [list, entries.filter((_, index) => selection.includes(`${key}.${list}.${index}`))])),
    };
    const pruned = pruneTransferImages(result); validateTransferDependencies(pruned); return pruned;
}
export function useSettingsTransfer(props: { roomId: string; userId: string; roomName: string }, imported: (sections: TransferSectionKey[]) => void) {
    const { t } = useI18n();
    const dialog = ref<'import' | 'export' | null>(null), data = ref<RoomSettingsPackage | null>(null), selection = ref<string[]>([]);
    const mode = ref<'add' | 'replace' | null>(null), busy = ref(false), error = ref(''), notice = ref(''), preview = ref<SettingsTransferPreview | null>(null);
    const fileInput = ref<HTMLInputElement>(), manualClipboard = ref(false), clipboardText = ref('');
    const payload = () => ({ roomId: props.roomId, userId: props.userId });
    watch([selection, mode], () => { preview.value = null; }, { deep: true });
    function reset() { data.value = null; selection.value = []; mode.value = null; preview.value = null; error.value = ''; manualClipboard.value = false; clipboardText.value = ''; }
    async function attempt(operation: () => Promise<void>) { busy.value = true; error.value = ''; try { await operation(); } catch (e) { error.value = e instanceof Error ? e.message : t('settingsTransfer.failed'); } finally { busy.value = false; } }
    function accept(text: string) { data.value = null; selection.value = []; mode.value = null; preview.value = null; data.value = parseSettingsPackage(text); selection.value = allTransferSelections(data.value); manualClipboard.value = false; }
    async function open(kind: 'import' | 'export') {
        reset(); notice.value = ''; dialog.value = kind;
        if (kind === 'export') await attempt(async () => { const result = await settingsTransferRequest('exportSettings', payload()); data.value = result.settingsPackage!; selection.value = allTransferSelections(data.value); });
    }
    async function readFile(event: Event) {
        const input = event.target as HTMLInputElement, file = input.files?.[0]; input.value = '';
        if (file) await attempt(async () => { data.value = null; selection.value = []; preview.value = null; mode.value = null; if (file.size > SETTINGS_TRANSFER_LIMIT) throw new Error(t('settingsTransfer.tooLarge')); accept(await file.text()); });
    }
    async function readClipboard() {
        reset();
        await attempt(async () => { try { accept(await navigator.clipboard.readText()); } catch (e) { manualClipboard.value = true; throw e; } });
    }
    function readManual() { void attempt(async () => accept(clipboardText.value)); }
    const selected = () => { if (!data.value) throw new Error(t('settingsTransfer.empty')); return selectTransferPackage(data.value, selection.value); };
    const canImport = computed(() => !!mode.value && !!data.value && selection.value.some(key => !key.includes('.') && (mode.value === 'replace' || Object.entries(data.value!.sections[key as TransferSectionKey]?.lists ?? {}).some(([list, entries]) => entries.some((_, i) => selection.value.includes(`${key}.${list}.${i}`))))));
    async function review() { await attempt(async () => { const result = await settingsTransferRequest('previewSettingsImport', { ...payload(), package: selected(), mode: mode.value! }); preview.value = result.settingsPreview!; }); }
    async function apply() {
        const token = preview.value?.token; if (!token) return;
        await attempt(async () => {
            // Clear the token before sending: an ambiguous network outcome must be reviewed again.
            preview.value = null;
            const packageToImport = selected();
            await settingsTransferRequest('importSettings', { ...payload(), package: packageToImport, mode: mode.value!, token });
            dialog.value = null; reset(); notice.value = t('settingsTransfer.imported'); imported(Object.keys(packageToImport.sections) as TransferSectionKey[]);
        });
    }
    async function exportTo(destination: 'file' | 'clipboard') {
        await attempt(async () => {
            const value = selected(); if (!Object.keys(value.sections).length) throw new Error(t('settingsTransfer.empty'));
            const text = JSON.stringify(value, null, 2); if (new TextEncoder().encode(text).length > SETTINGS_TRANSFER_LIMIT) throw new Error(t('settingsTransfer.tooLarge'));
            if (destination === 'clipboard') { await navigator.clipboard.writeText(text); notice.value = t('settingsTransfer.copied'); }
            else { const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = `${props.roomName.replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 80) || 'room'}-settings.json`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
        });
    }
    return { dialog, data, selection, mode, busy, error, notice, preview, fileInput, manualClipboard, clipboardText, reset, open, readFile, readClipboard, readManual, canImport, review, apply, exportTo };
}
