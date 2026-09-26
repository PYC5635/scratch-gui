import * as React from 'react';
import * as ReactDOM from 'react-dom';
import LanguagePackageManager from '../../../components/language-package/LanguagePackageManager';
import WindowManager from '../../window-system/window-manager.js';

export default async function ({ addon, global, console }) {
    const msg = addon.tab.l10n;
    
    addon.tab.api.addMenuItem({
        name: msg('language-package/menu-item'),
        icon: 'lucide-globe',
        menu: 'edit',
        onClick: () => {
            showLanguagePackageWindow();
        }
    });
}

function showLanguagePackageWindow() {
    const languageWindow = WindowManager.createWindow({
        id: 'language-package-manager',
        title: '语言包管理',
        width: 850,
        height: 600,
        minWidth: 600,
        minHeight: 400,
        className: 'sa-language-package-window',
        onClose: () => {}
    });

    const content = document.createElement('div');
    content.className = 'sa-language-package-content';

    languageWindow.setContent(content);
    languageWindow.show();

    ReactDOM.render(
        React.createElement(LanguagePackageManager),
        content
    );
}