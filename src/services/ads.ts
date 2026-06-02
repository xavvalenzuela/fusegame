import {
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';

const REWARDED_AD_ID = __DEV__
  ? TestIds.REWARDED
  : 'ca-app-pub-2747379081239953/3746804355';

let _preloaded: RewardedAd | null = null;

export function preloadRewardedAd(): void {
  const ad = RewardedAd.createForAdRequest(REWARDED_AD_ID, {
    requestNonPersonalizedAdsOnly: true,
  });

  const unsubLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
    unsubLoaded();
    _preloaded = ad;
  });

  ad.addAdEventListener(AdEventType.ERROR, () => {
    _preloaded = null;
    setTimeout(preloadRewardedAd, 30_000);
  });

  ad.load();
}

export function showRewardedAd(onRewarded: () => void, onDismissed?: () => void): void {
  const preloaded = _preloaded;
  _preloaded = null;

  const ad = preloaded ?? RewardedAd.createForAdRequest(REWARDED_AD_ID, {
    requestNonPersonalizedAdsOnly: true,
  });

  let earned = false;
  const unsubs: (() => void)[] = [];

  function cleanup() { unsubs.forEach(fn => fn()); }

  unsubs.push(ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
    earned = true;
  }));

  unsubs.push(ad.addAdEventListener(AdEventType.CLOSED, () => {
    cleanup();
    if (earned) onRewarded();
    onDismissed?.();
    preloadRewardedAd();
  }));

  unsubs.push(ad.addAdEventListener(AdEventType.ERROR, () => {
    cleanup();
    onDismissed?.();
    preloadRewardedAd();
  }));

  if (preloaded) {
    ad.show();
  } else {
    unsubs.push(ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      ad.show();
    }));
    ad.load();
  }
}
