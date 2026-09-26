import React, { useState, useEffect } from 'react';
import languageService from '../../services/LanguageService';
import style from './LanguagePackageManager.css';

const LanguagePackageManager = () => {
    const [packages, setPackages] = useState([]);
    const [uploadError, setUploadError] = useState('');
    const [uploadSuccess, setUploadSuccess] = useState('');
    const [selectedLocale, setSelectedLocale] = useState('');
    const [templateType, setTemplateType] = useState('plugin');
    const [templateLocale, setTemplateLocale] = useState('zh-CN');

    useEffect(() => {
        loadPackages();
        setSelectedLocale(languageService.currentLocale);
    }, []);

    const loadPackages = () => {
        setPackages(languageService.getUploadedPackages());
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const result = languageService.uploadLanguagePackage(event.target.result);
            
            if (result.success) {
                setUploadSuccess(result.message);
                setUploadError('');
                loadPackages();
            } else {
                setUploadError(result.errors.join('\n'));
                setUploadSuccess('');
            }
        };
        reader.readAsText(file);
    };

    const handleDownloadTemplate = () => {
        const template = languageService.generateTemplate(templateType, templateLocale);
        const blob = new Blob([template], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `language-template-${templateType}-${templateLocale}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleDeletePackage = (type, locale) => {
        if (confirm(`确定要删除语言包 ${type}-${locale} 吗？`)) {
            languageService.deleteLanguagePackage(type, locale);
            loadPackages();
        }
    };

    const handleLocaleChange = (e) => {
        const locale = e.target.value;
        setSelectedLocale(locale);
        languageService.setCurrentLocale(locale);
    };

    const supportedLocales = languageService.getSupportedLocales();

    return (
        <div className={style.container}>
            <div className={style.header}>
                <h2>语言包管理</h2>
                <div className={style.localeSelector}>
                    <label>当前语言：</label>
                    <select value={selectedLocale} onChange={handleLocaleChange}>
                        {supportedLocales.map(locale => (
                            <option key={locale} value={locale}>
                                {locale === 'zh-CN' ? '中文' : locale === 'en' ? 'English' : locale}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className={style.section}>
                <h3>上传语言包</h3>
                <div className={style.uploadArea}>
                    <input
                        type="file"
                        accept=".json"
                        onChange={handleFileUpload}
                        className={style.fileInput}
                    />
                    <button className={style.uploadButton}>选择文件</button>
                </div>
                
                {uploadSuccess && (
                    <div className={style.successMessage}>{uploadSuccess}</div>
                )}
                
                {uploadError && (
                    <div className={style.errorMessage}>
                        <strong>上传失败：</strong>
                        <pre>{uploadError}</pre>
                    </div>
                )}
            </div>

            <div className={style.section}>
                <h3>下载模板</h3>
                <div className={style.templateOptions}>
                    <div className={style.optionGroup}>
                        <label>类型：</label>
                        <select value={templateType} onChange={(e) => setTemplateType(e.target.value)}>
                            <option value="plugin">插件翻译</option>
                            <option value="block">积木翻译</option>
                            <option value="ui">界面翻译</option>
                        </select>
                    </div>
                    <div className={style.optionGroup}>
                        <label>语言：</label>
                        <select value={templateLocale} onChange={(e) => setTemplateLocale(e.target.value)}>
                            <option value="zh-CN">中文</option>
                            <option value="en">English</option>
                            <option value="ja">日本語</option>
                            <option value="ko">한국어</option>
                            <option value="fr">Français</option>
                            <option value="de">Deutsch</option>
                        </select>
                    </div>
                </div>
                <button className={style.downloadButton} onClick={handleDownloadTemplate}>
                    下载模板文件
                </button>
                <p className={style.hint}>
                    模板包含所有可用的翻译键，您只需填写翻译内容即可。
                </p>
            </div>

            <div className={style.section}>
                <h3>已上传的语言包</h3>
                {packages.length === 0 ? (
                    <p className={style.emptyMessage}>暂无上传的语言包</p>
                ) : (
                    <table className={style.packageTable}>
                        <thead>
                            <tr>
                                <th>类型</th>
                                <th>语言</th>
                                <th>名称</th>
                                <th>上传时间</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {packages.map((pkg, index) => (
                                <tr key={index}>
                                    <td>{pkg.type}</td>
                                    <td>{pkg.locale}</td>
                                    <td>{pkg.name}</td>
                                    <td>{new Date(pkg.uploadedAt).toLocaleString()}</td>
                                    <td>
                                        <button 
                                            className={style.deleteButton}
                                            onClick={() => handleDeletePackage(pkg.type, pkg.locale)}
                                        >
                                            删除
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div className={style.section}>
                <h3>语言包格式说明</h3>
                <pre className={style.formatExample}>
{`{
  "type": "plugin",
  "locale": "zh-CN",
  "name": "中文",
  "translations": {
    "plugin-name": "插件名称",
    "plugin-description": "插件描述",
    "button-text": "按钮文字"
  }
}`}
                </pre>
                <ul className={style.formatNotes}>
                    <li><strong>type</strong>: 语言包类型，可选值：plugin（插件）、block（积木）、ui（界面）</li>
                    <li><strong>locale</strong>: 语言代码，如 zh-CN、en、ja 等</li>
                    <li><strong>name</strong>: 语言名称，用于显示</li>
                    <li><strong>translations</strong>: 翻译键值对对象</li>
                </ul>
            </div>
        </div>
    );
};

export default LanguagePackageManager;