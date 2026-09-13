import React, {useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import {useIntl} from '../../lib/tw-use-intl.jsx';
import {Coins, Wallet as WalletIcon, HeartHandshake, Send, ExternalLink, CalendarCheck} from 'lucide-react';
import api, {projectUrl} from '../api';
import {getAccountSummary, claimDaily} from '../../lib/rotur/client.js';
import {CREDIT_PACKS, getBillingStatus, openCreditCheckout, openBillingPortal, consumeBillingResult} from '../credits';
import {useUser} from '../UserContext.jsx';
import styles from './Wallet.module.css';

const fmtCredits = value => Math.round((Number(value) || 0) * 100) / 100;

const formatDate = ms => {
    if (!ms) return '';
    try {
        return new Date(ms).toLocaleDateString([], {year: 'numeric', month: 'short', day: 'numeric'});
    } catch (e) {
        return '';
    }
};

const Wallet = () => {
    const intl = useIntl();
    const {user, loading} = useUser();
    const [account, setAccount] = useState(null);
    const [accountLoaded, setAccountLoaded] = useState(false);
    const [purchases, setPurchases] = useState(null);
    const [claiming, setClaiming] = useState(false);
    const [claimMsg, setClaimMsg] = useState('');
    const [billing, setBilling] = useState(null);
    const [checkoutBusy, setCheckoutBusy] = useState(false);
    const [checkoutError, setCheckoutError] = useState('');
    const billingMsg = consumeBillingResult();

    useEffect(() => {
        if (!user) {
            setAccount(null);
            setPurchases(null);
            setBilling(null);
            return () => {};
        }
        let stale = false;
        getAccountSummary()
            .then(data => {
                if (stale) return;
                setAccount(data);
                setAccountLoaded(true);
            })
            .catch(() => !stale && setAccountLoaded(true));
        api.purchases()
            .then(data => !stale && setPurchases(data.purchases || []))
            .catch(() => !stale && setPurchases([]));
        getBillingStatus()
            .then(data => !stale && setBilling(data))
            .catch(() => !stale && setBilling({billing_configured: false}));
        return () => {
            stale = true;
        };
    }, [user]);

    if (loading) {
        return <main className={styles.page}><p className={styles.status}>{intl.formatMessage({id: 'mw.community.wallet.loading', defaultMessage: 'Loading…'})}</p></main>;
    }
    if (!user) {
        return <main className={styles.page}><p className={styles.status}>{intl.formatMessage({id: 'mw.community.wallet.signIn', defaultMessage: 'Sign in to view your wallet.'})}</p></main>;
    }

    const balance = account && account.balance !== null ? account.balance : null;

    const doClaimDaily = async () => {
        if (claiming) return;
        setClaiming(true);
        setClaimMsg('');
        try {
            await claimDaily();
            setClaimMsg(intl.formatMessage({id: 'mw.community.wallet.claimed', defaultMessage: 'Daily credits claimed!'}));
            const data = await getAccountSummary();
            if (data) {
                setAccount(data);
                setAccountLoaded(true);
            }
        } catch (e) {
            if (e.waitHours) {
                setClaimMsg(intl.formatMessage({id: 'mw.community.wallet.claimedWait', defaultMessage: 'Already claimed. Come back in {hours}h.'}, {hours: e.waitHours}));
            } else if (e.needsReauth) {
                setClaimMsg(intl.formatMessage({id: 'mw.community.wallet.reauthNeeded', defaultMessage: 'Your current login cannot claim daily credits. Log out and back in, then try again.'}));
            } else {
                setClaimMsg(e.message || intl.formatMessage({id: 'mw.community.wallet.claimFailed', defaultMessage: 'Could not claim daily credits.'}));
            }
        } finally {
            setClaiming(false);
        }
    };

    const buy = async pack => {
        if (checkoutBusy) return;
        setCheckoutBusy(true);
        setCheckoutError('');
        try {
            await openCreditCheckout(pack);
        } catch (e) {
            setCheckoutError(e.needsReauth ?
                'Your current login cannot buy credits. Log out and back in, then try again.' :
                (e.message || 'Could not open checkout.'));
        } finally {
            setCheckoutBusy(false);
        }
    };

    const manageBilling = async () => {
        if (checkoutBusy) return;
        setCheckoutBusy(true);
        setCheckoutError('');
        try {
            await openBillingPortal();
        } catch (e) {
            setCheckoutError(e.message || 'Could not open billing.');
        } finally {
            setCheckoutBusy(false);
        }
    };

    return (
        <main className={styles.page}>
            <h1 className={styles.heading}>{intl.formatMessage({id: 'mw.community.wallet.title', defaultMessage: 'Wallet'})}</h1>

            <section className={styles.balanceCard}>
                <span className={styles.balanceIcon}><WalletIcon size={22} /></span>
                <div>
                    <div className={styles.balanceLabel}>{intl.formatMessage({id: 'mw.community.wallet.yourBalance', defaultMessage: 'Your balance'})}</div>
                    <div className={styles.balanceValue}>
                        {balance !== null ? (
                            <>
                                {fmtCredits(balance).toLocaleString()}
                                <span className={styles.balanceUnit}>{intl.formatMessage({id: 'mw.community.wallet.credits', defaultMessage: 'credits'})}</span>
                            </>
                        ) : (
                            <span className={styles.balanceUnknown}>
                                {accountLoaded ? intl.formatMessage({id: 'mw.community.wallet.balanceFailed', defaultMessage: 'Could not load your balance right now'}) : '…'}
                            </span>
                        )}
                    </div>
                    {claimMsg ? <div className={styles.claimMsg}>{claimMsg}</div> : null}
                </div>
                <button
                    className={styles.claimBtn}
                    onClick={doClaimDaily}
                    disabled={claiming}
                >
                    <CalendarCheck size={16} />
                    {claiming ?
                        intl.formatMessage({id: 'mw.community.wallet.claiming', defaultMessage: 'Claiming…'}) :
                        intl.formatMessage({id: 'mw.community.wallet.claimDaily', defaultMessage: 'Claim daily'})}
                </button>
            </section>

            {account && (account.donationsReceived > 0 || account.donationsGiven > 0) ? (
                <div className={styles.donationRow}>
                    {account.donationsReceived > 0 ? (
                        <div className={styles.donationCard}>
                            <HeartHandshake size={16} />
                            <span>{intl.formatMessage({id: 'mw.community.wallet.donationsReceived', defaultMessage: '{count} received in donations'}, {count: fmtCredits(account.donationsReceived)})}</span>
                        </div>
                    ) : null}
                    {account.donationsGiven > 0 ? (
                        <div className={styles.donationCard}>
                            <Send size={16} />
                            <span>{intl.formatMessage({id: 'mw.community.wallet.donationsGiven', defaultMessage: '{count} given in donations'}, {count: fmtCredits(account.donationsGiven)})}</span>
                        </div>
                    ) : null}
                </div>
            ) : null}

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Buy credits</h2>
                <p className={styles.sectionLead}>
                    Top up through Stripe. Credits are added to your Rotur account after checkout.
                </p>
                {billingMsg ? (
                    <p className={styles.billingMsg}>
                        {billingMsg === 'success' ?
                            'Payment successful. Credits will appear in your balance shortly.' :
                            'Checkout cancelled.'}
                    </p>
                ) : null}
                <div className={styles.tiers}>
                    {CREDIT_PACKS.map(pack => (
                        <button
                            key={pack.lookupKey}
                            type="button"
                            className={styles.tier}
                            onClick={() => buy(pack)}
                            disabled={checkoutBusy}
                        >
                            <span className={styles.tierCredits}>
                                {pack.credits.toLocaleString()}
                                <span> credits</span>
                            </span>
                            <span className={styles.tierPrice}>${pack.price.toFixed(2)}</span>
                        </button>
                    ))}
                </div>
                {checkoutBusy ? <p className={styles.checkoutNote}>Opening secure Stripe checkout…</p> : null}
                {checkoutError ? <p className={styles.checkoutError}>{checkoutError}</p> : null}
                {billing && !billing.billing_configured ? (
                    <p className={styles.checkoutError}>Stripe billing is currently unavailable. Try again later.</p>
                ) : null}
                {billing && billing.stripe_portal ? (
                    <button
                        type="button"
                        className={styles.portalButton}
                        onClick={manageBilling}
                        disabled={checkoutBusy}
                    >
                        <ExternalLink size={14} />
                        Manage billing
                    </button>
                ) : null}
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>{intl.formatMessage({id: 'mw.community.wallet.purchaseHistory', defaultMessage: 'Purchase history'})}</h2>
                {purchases === null ? (
                    <p className={styles.status}>{intl.formatMessage({id: 'mw.community.wallet.loading', defaultMessage: 'Loading…'})}</p>
                ) : purchases.length ? (
                    <ul className={styles.purchases}>
                        {purchases.map((purchase, index) => (
                            <li
                                key={`${purchase.projectId}-${index}`}
                                className={styles.purchaseRow}
                            >
                                <Link
                                    to={projectUrl(purchase.projectId)}
                                    className={styles.purchaseTitle}
                                >{purchase.title || purchase.projectId}</Link>
                                <span className={styles.purchaseMeta}>
                                    <span className={styles.purchaseAmount}>
                                        <Coins size={13} />
                                        {fmtCredits(purchase.amount)}
                                    </span>
                                    {purchase.at ? (
                                        <span className={styles.purchaseDate}>{formatDate(purchase.at)}</span>
                                    ) : null}
                                </span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className={styles.empty}>
                        {intl.formatMessage({id: 'mw.community.wallet.noPurchases', defaultMessage: 'You have not bought any projects yet.'})}{' '}
                        <Link
                            to="/explore"
                            className={styles.exploreLink}
                        >
                            {intl.formatMessage({id: 'mw.community.wallet.exploreProjects', defaultMessage: 'Explore projects'})}
                            <ExternalLink size={13} />
                        </Link>
                    </p>
                )}
            </section>
        </main>
    );
};

export default Wallet;
