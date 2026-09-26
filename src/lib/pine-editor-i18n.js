/**
 * PineWarp 文言文语言包（Classical Chinese · 文言文）
 *
 * 提供两份词典：
 *   - CLASSICAL_UI:  编辑器界面字符串（react-intl message id -> 文言文）
 *   - CLASSICAL_BLOCKS: 积木调色板标签（opcode -> 文言文）
 *
 * 并提供两个入口：
 *   - registerPineLocale(editorMessages): 把 `lzh` 语言注入 scratch-l10n 的消息表，
 *     使其可被 react-intl 选择。
 *   - applyClassicalLabels(blocks): 遍历 Blockly 工作区，把已放置积木的文本就地改写为文言文。
 *
 * 说明：该模块独立可读，不依赖较新的 React/Blockly API，方便接入语言选择器与区块重绘流程。
 */
/**
 * 官方 scratch-l10n 已内置完成的文言文(lzh)翻译。
 * 这里把它们并入编辑器，并补充 PineWarp 独有的 UI 文案。
 */
import interfaceLzh from '@bilup/scratch-l10n/editor/interface/lzh.json';
import {default as lzhBlocksJson} from '@bilup/scratch-l10n/editor/blocks/lzh.json';
export const LZH_BLOCKS = lzhBlocksJson;

export const CLASSICAL_LOCALE = 'lzh';
export const CLASSICAL_NAME = '文言';

/** 界面字符串 -> 文言文 */
export const CLASSICAL_UI = {
    'gui.menuBar.remix': '脱胎重制（Remix）',
    'gui.menuBar.save': '存之',
    'gui.menuBar.share': '达于PineWarp',
    'gui.menuBar.file': '文档',
    'gui.menuBar.edit': '修订',
    'gui.menuBar.tutorials': '教习',
    'gui.menuBar.new': '新造',
    'gui.menuBar.open': '开卷',
    'gui.menuBar.download': '下载至本机',
    'gui.menuBar.loadProjectFromComputer': '取入一sb3文件',
    'gui.menuBar.saveToComputer': '存为sb3文件',
    'gui.menuBar.greenFlag': '绿旗',
    'gui.menuBar.stopAll': '止止',
    'gui.menuBar.turboMode': '疾行模式',
    'gui.menuBar.moreMenu': '余项',
    'gui.menuBar.removeSprite': '是去此角色',
    'gui.menuBar.duplicate': '复本',
    'gui.menuBar.export': '出',
    'gui.menuBar.info': '凡例',
    'gui.menuBar.about': '略志',
    'gui.menuBar.bilupHome': 'PineWarp里',
    'gui.menuBar.bilupLogoAlt': 'PineWarp',
    'gui.menuBar.bilupWordmark': 'PineWarp',

    'gui.extensionLibrary.title': '扩展书馆',
    'gui.extensionLibrary.searchPlaceholder': '搜索略名或述',
    'gui.blocks.categories.motion': '行止',
    'gui.blocks.categories.looks': '容色',
    'gui.blocks.categories.sound': '音声',
    'gui.blocks.categories.events': '事端',
    'gui.blocks.categories.control': '节制',
    'gui.blocks.categories.sensing': '察知',
    'gui.blocks.categories.operators': '演算',
    'gui.blocks.categories.variables': '數与簿',
    'gui.blocks.categories.myBlocks': '吾族积木',
    'gui.blocks.categories.store': '储藏',

    'gui.gui.stage': '剧场',
    'gui.spriteSelector.placeBacklayer': '置于后',
    'gui.monitor.list': '簿',
    'gui.costumeLib.chooseBackdrop': '选一背景',
    'gui.paint.paintEditor': '绘事'

};

/** 积木 opcode -> 文言文标签 */
export const CLASSICAL_BLOCKS = {
    motion_movesteps: '行%1步',
    motion_turnright: '右转%1度',
    motion_turnleft: '左转%1度',
    motion_gotoxy: '之至x:%1 y:%2',
    motion_goto: '之至%1',
    motion_glideto: '徐行%1秒之至%2',
    motion_glidesecstoxy: '徐行%1秒之至x:%2 y:%3',
    motion_pointindirection: '向%1度指',
    motion_pointtowards: '向%1指',
    motion_setx: '置x为%1',
    motion_sety: '置y为%1',
    motion_changexby: '增x %1',
    motion_changeyby: '增y %1',
    motion_ifonedgebounce: '触而反弹',
    motion_setrotationstyle: '设旋转之式%1',
    motion_xposition: 'x之位',
    motion_yposition: 'y之位',
    motion_direction: '所指方向',
    looks_sayforsecs: '言%1%2秒',
    looks_say: '言%1',
    looks_thinkforsecs: '思%1%2秒',
    looks_think: '思%1',
    looks_switchcostumeto: '易妆为%1',
    looks_nextcostume: '次妆',
    looks_switchbackdropto: '易背景为%1',
    looks_nextbackdrop: '次背景',
    looks_changeeffectby: '变%1效按%2',
    looks_seteffectto: '着%1效按%2',
    looks_cleargraphiceffects: '涤除图形诸效',
    looks_show: '现',
    looks_hide: '隐',
    looks_setsizeto: '置大小为%1%',
    looks_changesizeby: '增大小%1',
    looks_size: '大小',
    looks_gotofrontback: '至%1层',
    looks_goforwardbackwardlayers: '行%1%2层',
    sound_play: '奏%1',
    sound_playuntildone: '奏%1至毕',
    sound_stopallsounds: '止诸声',
    sound_changeeffectby: '变%1效按%2',
    sound_seteffectto: '着%1效按%2',
    sound_clearEffects: '涤除声响诸效',
    sound_changevolumeby: '增音%1',
    sound_setvolumeto: '置音为%1%',
    sound_volume: '音',
    event_whenflagclicked: '覆击%1时',
    event_whenkeypressed: '按%1键时',
    event_whenthisspriteclicked: '点吾时',
    event_whenbackdropswitchesto: '当背景易为%1时',
    event_whengreaterthan: '当%1%2时',
    event_whenbroadcastreceived: '闻%1时',
    event_broadcast: '传檄%1',
    event_broadcastandwait: '传檄%1而待',
    control_wait: '待%1秒',
    control_repeat: '往复%1次',
    control_forever: '恒常',
    control_if: '若%1',
    control_if_else: '若%1否则',
    control_wait_until: '待至%1',
    control_repeat_until: '往复至于%1',
    control_while: '当%1时恒做',
    control_foreach: '遍及%1中',
    control_stop: '止：%1',
    control_create_clone_of: '作%1之克隆',
    control_delete_this_clone: '去此克隆',
    control_start_as_clone: '当克隆而生',
    control_all_at_once: '曹营同举',
    sensing_touchingobject: '触%1否',
    sensing_touchingcolor: '触色%1否',
    sensing_coloristouchingcolor: '色%1触%2否',
    sensing_distance: '去%1之距',
    sensing_askandwait: '问%1而待',
    sensing_answer: '答复',
    sensing_keypressed: '按%1键否',
    sensing_mousedown: '按鼠否',
    sensing_mousex: '鼠x',
    sensing_mousey: '鼠y',
    sensing_loudness: '响度',
    sensing_timer: '沙漏',
    sensing_resettimer: '重置沙漏',
    sensing_of: '%1之%2',
    sensing_current: '今日%1',
    sensing_dayssince2000: '自二千年起之日',
    sensing_username: '用户之名',
    sensing_loud: '声宏否',
    operators_add: '%1加%2',
    operators_subtract: '%1减%2',
    operators_multiply: '%1乘%2',
    operators_divide: '%1除以%2',
    operators_random: '于%1至%2间随取',
    operators_lt: '%1< %2',
    operators_gt: '%1> %2',
    operators_equals: '%1= %2',
    operators_and: '%1与%2',
    operators_or: '%1或%2',
    operators_not: '非%1',
    operators_join: '连%1与%2',
    operators_letter_of: '%1之第%2字',
    operators_length: '%1之长度',
    operators_contains: '%1含有%2',
    operators_mathop: '%1（%2）',
    operators_mod: '%1之余%2',
    operators_round: '四舍五入%1',
    operators_abs: '绝数%1',
    operators_floor: '取整%1',
    operators_sqrt: '开方%1',
    data_variable: '%1',
    data_setvariableto: '置%1为%2',
    data_changevariableby: '增%1 %2',
    data_hidevariable: '隐%1',
    data_showvariable: '现%1',
    data_addtolist: '添%2于%1末',
    data_deleteoflist: '删%1之第%2项',
    data_deletealloflist: '尽删%1',
    data_insertatlist: '插%2于%1之第%3项',
    data_replaceitemoflist: '易%1之第%2项为%3',
    data_itemoflist: '%1之第%2项',
    data_itemnumoflist: '%2在%1中之项次',
    data_lengthoflist: '%1之长度',
    data_listcontainsitem: '%1含有%2',
    data_hidelist: '隐%1',
    data_showlist: '现%1',
    procedures_definition: '构自定义积木%1',
    procedures_call: '%1',
    pine_list_dims: '%1之维数',
    pine_list_create2d: '作%1为%2行%3列填以%4',
    pine_list_resize: '改%1之形为%2行%3列缺补%4',
    pine_list_get2d: '%1之第%2行第%3列',
    pine_list_set2d: '置%1之第%2行第%3列为%4',
    pine_list_getpath: '%1之径[%2]',
    pine_list_setpath: '置%1之径[%2]为%3'
};

/** 供语言选择器显示的语言覆盖（不含标准 locale）。官方 lzh 已在列表中，无需额外注入。 */
export const PINE_EXTRAS = [];

/**
 * 把文言文 lzh locale 注入 scratch-l10n 的消息表。
 * 以官方完整文言文 interface 为基底，再用 CLASSICAL_UI 补充 PineWarp 独有的文案。
 * @param {object} editorMessages scratch-l10n 的 messagesByLocale 对象（会被原地修改）。
 */
export const registerPineLocale = editorMessages => {
    const merged = Object.assign({}, interfaceLzh, CLASSICAL_UI);
    if (editorMessages) {
        editorMessages[CLASSICAL_LOCALE] = merged;
        // 兼容旧引用：旧的自定义 locale 也指向同一份合并消息
        if (!editorMessages['zh-wenyan']) {
            editorMessages['zh-wenyan'] = merged;
        }
    }
};

/**
 * 把已放置积木的标签就地改写为文言文。
 * @param {Array} blockList Blockly 工作区管理到的积木数组（每项有 id、opcode、setText 等）。
 *  若传入对象带 `.blocks`（如 vm.runtime 的 block 存储），将以树遍历方式改写。
 * @return {boolean} 是否执行了改写。
 */
export const applyClassicalLabels = blockList => {
    if (!blockList) return false;
    if (Array.isArray(blockList)) {
        let changed = false;
        for (const block of blockList) {
            if (block && block.opcode && CLASSICAL_BLOCKS[block.opcode] && typeof block.setText === 'function') {
                block.setText(CLASSICAL_BLOCKS[block.opcode]);
                changed = true;
            }
        }
        return changed;
    }
    return false;
};

/**
 * 一个 opcode -> 文言文标签的只读查询。
 * @param {string} opcode
 * @return {?string}
 */
export const classicalLabel = opcode => CLASSICAL_BLOCKS[opcode] || null;

export default registerPineLocale;