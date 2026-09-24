import {COSTUMES_TAB_INDEX, SOUNDS_TAB_INDEX} from '../../reducers/editor-tab';

const messages = {
    editingCostume: {
        id: 'gui.collaboration.editingCostume',
        defaultMessage: 'Editing costume "{assetName}" in {where}'
    },
    editingCostumes: {
        id: 'gui.collaboration.editingCostumes',
        defaultMessage: 'Editing costumes in {where}'
    },
    editingBackdrop: {
        id: 'gui.collaboration.editingBackdrop',
        defaultMessage: 'Editing backdrop "{assetName}" in {where}'
    },
    editingBackdrops: {
        id: 'gui.collaboration.editingBackdrops',
        defaultMessage: 'Editing backdrops in {where}'
    },
    editingSound: {
        id: 'gui.collaboration.editingSound',
        defaultMessage: 'Editing sound "{assetName}" in {where}'
    },
    editingSounds: {
        id: 'gui.collaboration.editingSounds',
        defaultMessage: 'Editing sounds in {where}'
    },
    editingCode: {
        id: 'gui.collaboration.editingCode',
        defaultMessage: 'Editing code in {where}'
    },
    theStage: {
        id: 'gui.collaboration.theStage',
        defaultMessage: 'the Stage'
    }
};

/**
 * Fallback used when no formatMessage is provided, so the caller can keep
 * working without react-intl.
 */
const fallbackFormatMessage = (descriptor, values) => {
    let result = descriptor.defaultMessage;
    if (values) {
        Object.keys(values).forEach(key => {
            result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), () => values[key]);
        });
    }
    return result;
};

/**
 * Put into words where someone is working, e.g. "Editing costume \"walk-a\" in
 * Sprite1". Used for the peer list in the collaboration window and for the
 * Bilup Accounts presence status, so both always say the same thing.
 *
 * Names are resolved from the VM at call time rather than carried along, so a
 * rename never leaves a stale description behind.
 *
 * @param {VirtualMachine} vm The VM.
 * @param {object} activity {targetId, tab, assetIndex} — assetIndex optional.
 * @param {Function} [formatMessage] react-intl formatMessage, used to localize
 *     the description. Falls back to the English default when omitted.
 * @returns {string|null} The description, or null when the sprite is unknown.
 */
const describeActivity = (vm, activity, formatMessage) => {
    if (!vm || !vm.runtime || !activity || !activity.targetId) return null;
    const target = vm.runtime.getTargetById(activity.targetId);
    if (!target) return null;

    const fmt = formatMessage || fallbackFormatMessage;

    const where = target.isStage ? fmt(messages.theStage) : target.getName();
    const asset = typeof activity.assetIndex === 'number' ? (
        activity.tab === COSTUMES_TAB_INDEX ?
            (target.getCostumes() || [])[activity.assetIndex] :
            (target.getSounds() || [])[activity.assetIndex]
    ) : null;

    switch (activity.tab) {
    case COSTUMES_TAB_INDEX:
        if (asset) {
            return fmt(
                target.isStage ? messages.editingBackdrop : messages.editingCostume,
                {assetName: asset.name, where}
            );
        }
        return fmt(target.isStage ? messages.editingBackdrops : messages.editingCostumes, {where});
    case SOUNDS_TAB_INDEX:
        if (asset) {
            return fmt(messages.editingSound, {assetName: asset.name, where});
        }
        return fmt(messages.editingSounds, {where});
    default:
        return fmt(messages.editingCode, {where});
    }
};

export default describeActivity;
