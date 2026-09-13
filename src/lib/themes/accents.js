import * as accentPurple from './accent/purple';
import * as accentBlue from './accent/blue';
import * as accentRed from './accent/red';
import * as accentOrange from './accent/orange';
import * as accentYellow from './accent/yellow';
import * as accentGreen from './accent/green';
import * as accentGreenTea from './accent/green-tea';
import * as accentPaleBlue from './accent/pale-blue';
import * as accentEggplantPurple from './accent/eggplant-purple';
import * as accentPink from './accent/pink';

const ACCENTS = [
    {
        name: 'Red',
        accent: accentRed,
        description: 'Red accent color',
        id: 'tw.accent.red'
    },
    {
        name: 'Orange',
        accent: accentOrange,
        description: 'Orange accent color',
        id: 'tw.accent.orange'
    },
    {
        name: 'Yellow',
        accent: accentYellow,
        description: 'Yellow accent color',
        id: 'tw.accent.yellow'
    },
    {
        name: 'Green',
        accent: accentGreen,
        description: 'Green accent color',
        id: 'tw.accent.green'
    },
    {
        name: 'Green Tea',
        accent: accentGreenTea,
        description: 'Green Tea accent color',
        id: 'tw.accent.green-tea'
    },
    {
        name: 'Pale Blue',
        accent: accentPaleBlue,
        description: 'Pale Blue accent color',
        id: 'tw.accent.pale-blue'
    },
    {
        name: 'Blue',
        accent: accentBlue,
        description: 'Blue accent color',
        id: 'tw.accent.blue'
    },
    {
        name: 'Purple',
        accent: accentPurple,
        description: 'Purple accent color',
        id: 'tw.accent.purple'
    },
    {
        name: 'Eggplant',
        accent: accentEggplantPurple,
        description: 'Eggplant accent color',
        id: 'tw.accent.eggplant-purple'
    },
    {
        name: 'Pink',
        accent: accentPink,
        description: 'Pink accent color',
        id: 'tw.accent.pink'
    }
];

const ACCENT_GROUPS = [
    {
        label: {id: 'mw.accentGroup.colors', defaultMessage: 'Colors'},
        accents: ['red', 'orange', 'yellow', 'green', 'pale-blue', 'blue', 'purple', 'eggplant-purple', 'pink']
    }
];

const ACCENT_MAP = {};
for (const accent of ACCENTS) {
    // Use the id short name (e.g. "pale-blue", "eggplant-purple") as the key so
    // it matches ACCENT_GROUPS, the settings panel and persisted theme values.
    // Previously the display name was used ("Pale Blue" -> "pale blue",
    // "Eggplant" -> "eggplant"), which hid those accents from the picker.
    const accentId = accent.id.split('.').pop();
    ACCENT_MAP[accentId] = {
        ...accent.accent,
        defaultMessage: accent.name,
        description: accent.description,
        id: accent.id
    };
}
const ACCENT_DEFAULT = ACCENTS[5].id.split('.').pop();

export {
    ACCENTS,
    ACCENT_MAP,
    ACCENT_GROUPS,
    ACCENT_DEFAULT
};
