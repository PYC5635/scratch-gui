import React, {useCallback} from 'react';
import {Globe, Link as LinkIcon, Lock, ChevronDown, Check} from 'lucide-react';
import {useIntl} from '../../lib/tw-use-intl.jsx';
import {Dropdown, DropdownItem} from './ui/Dropdown.jsx';
import styles from './VisibilityMenu.module.css';

const OPTIONS = [
    {value: 'public', labelId: 'mw.community.visibilityMenu.shared', labelDefault: 'Shared', icon: Globe},
    {value: 'unlisted', labelId: 'mw.community.visibilityMenu.unlisted', labelDefault: 'Unlisted', icon: LinkIcon},
    {value: 'private', labelId: 'mw.community.visibilityMenu.private', labelDefault: 'Unshared', icon: Lock}
];

const VisibilityMenu = ({value, onChange}) => {
    const intl = useIntl();
    const t = useCallback(
        (messageId, defaultMessage, values) => intl.formatMessage({id: messageId, defaultMessage}, values),
        [intl]
    );
    const current = OPTIONS.find(option => option.value === value) || OPTIONS[0];
    const CurrentIcon = current.icon;
    return (
        <Dropdown
            width={210}
            renderTrigger={({toggle}) => (
                <button
                    type="button"
                    className={styles.button}
                    onClick={toggle}
                    aria-label={t('mw.community.visibilityMenu.ariaLabel', 'Project visibility')}
                >
                    <CurrentIcon size={16} />
                    {t(current.labelId, current.labelDefault)}
                    <ChevronDown size={15} />
                </button>
            )}
        >
            {({close}) => OPTIONS.map(option => {
                const OptionIcon = option.icon;
                return (
                    <DropdownItem
                        key={option.value}
                        onClick={() => {
                            close();
                            if (option.value !== value) onChange(option.value);
                        }}
                    >
                        <OptionIcon size={15} />
                        {t(option.labelId, option.labelDefault)}
                        {option.value === value ? (
                            <Check
                                size={14}
                                className={styles.check}
                            />
                        ) : null}
                    </DropdownItem>
                );
            })}
        </Dropdown>
    );
};

export default VisibilityMenu;
