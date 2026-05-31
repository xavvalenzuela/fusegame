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

  const unsubscribeLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
    ad.show();
  });

  const unsubscribeEarned = ad.addAdEventListener(
    RewardedAdEventType.EARNED_REWARD,
    () => {
      onRewarded();
    },
  );

  const unsubscribeClosed = ad.addAdEventListener(
    AdEventType.CLOSED,
    () => {
      unsubscribeLoaded();
      unsubscribeEarned();
      unsubscribeClosed();
      onDismissed?.();
    },
  );

  ad.load();
}
