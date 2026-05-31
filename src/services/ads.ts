import {
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';

// Swap these for your real AdMob unit IDs before publishing
const REWARDED_AD_ID = __DEV__
  ? TestIds.REWARDED
  : 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX'; // TODO: replace with real ID

export function showRewardedAd(onRewarded: () => void, onDismissed?: () => void): void {
  const ad = RewardedAd.createForAdRequest(REWARDED_AD_ID, {
    requestNonPersonalizedAdsOnly: true,
  });

  let earned = false;
  const unsubs: (() => void)[] = [];

  function cleanup() {
    unsubs.forEach(fn => fn());
  }

  unsubs.push(ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
    ad.show();
  }));

  // Track reward earned — but don't grant it yet (ad still on screen)
  unsubs.push(ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
    earned = true;
  }));

  // Grant reward only after ad is fully closed
  unsubs.push(ad.addAdEventListener(AdEventType.CLOSED, () => {
    cleanup();
    if (earned) onRewarded();
    onDismissed?.();
  }));

  // Clean up all listeners on error so loadingBoost state resets
  unsubs.push(ad.addAdEventListener(AdEventType.ERROR, () => {
    cleanup();
    onDismissed?.();
  }));

  ad.load();
}
