import twTranslations from './generated-translations.json';
import wenyan from '../zh-wenyan/translations.js';

// 以指定语言为基底构造 zh-wenyan（文言文）语言包：
// 全键覆盖（无英文/空值泄漏），再用文言文词典覆盖核心字符串。
const buildWenyanLocale = editorMessages => {
    const base = editorMessages['zh-cn'] || {};
    const messages = {...base};
    // 补上 zh-cn 缺失、仅 en 有的键，保证全覆盖
    if (editorMessages.en) {
        Object.keys(editorMessages.en).forEach(k => {
            if (!(k in messages)) messages[k] = editorMessages.en[k];
        });
    }
    Object.assign(messages, wenyan);
    return messages;
};

const addAdditionalTranslations = editorMessages => {
    for (const locale of Object.keys(editorMessages)) {
        const toMixIn = twTranslations[locale.toLowerCase()];
        if (toMixIn) {
            Object.assign(editorMessages[locale], toMixIn);
        }
    }

    // PineEditor 内置文言文语言：仅当尚无同名语言时注册
    if (!editorMessages['zh-wenyan']) {
        editorMessages['zh-wenyan'] = buildWenyanLocale(editorMessages);
    }
};

export default addAdditionalTranslations;
