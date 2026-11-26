import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * One optional daily reminder that the new edition is ready. It never mentions
 * streaks or missed days. Returns false if the user declined permission.
 */
export async function scheduleDailyEdition(time: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('edition', {
      name: 'Daily edition',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  await Notifications.cancelAllScheduledNotificationsAsync();
  const [hour, minute] = time.split(':').map(Number);
  await Notifications.scheduleNotificationAsync({
    content: { title: '日本語 Daily', body: "Today's edition is ready whenever you are." },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: 'edition' },
  });
  return true;
}

export async function cancelDailyEdition() {
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}
