import React, { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Switch, View } from 'react-native';

import { JaText } from '@/components/article/japanese';
import { SectionHeading } from '@/components/editorial/stories';
import { Chip } from '@/components/ui/chip';
import { T } from '@/components/ui/text';
import type { JaLine } from '@/content/types';
import { cancelDailyEdition, scheduleDailyEdition } from '@/platform/notifications';
import { useApp, usePalette } from '@/state/app';
import { GUTTER } from '@/theme';

const SAMPLE: JaLine = [
  { s: [{ b: '私', r: 'わたし' }], rm: 'watashi' },
  { s: [{ b: 'は' }], rm: 'wa' },
  { s: [{ b: '学生', r: 'がくせい' }], rm: 'gakusei' },
  { s: [{ b: 'です' }], rm: 'desu' },
  { s: [{ b: '。' }], p: true },
];

const TIMES = ['07:00', '07:30', '08:00', '12:30', '18:00', '20:00'];

export default function SettingsScreen() {
  const { settings, setSetting, user } = useApp();
  const p = usePalette();
  const [notice, setNotice] = useState<string | null>(null);

  const Toggle = ({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) => (
    <View style={[styles.row, { borderTopColor: p.rule }]}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <T v="ui">{label}</T>
        <T v="meta" color="muted">
          {hint}
        </T>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: p.brand, false: p.rule }} thumbColor={p.raised} accessibilityLabel={label} />
    </View>
  );

  const setTime = async (t: string | null) => {
    if (t) {
      const ok = await scheduleDailyEdition(t);
      if (!ok) {
        setNotice('Notifications are not allowed for this app. You can turn them on in Android settings.');
        return;
      }
      setNotice(null);
    } else {
      await cancelDailyEdition();
    }
    await setSetting('notifyAt', t);
  };

  const exportData = async () => {
    const data = await user.exportAll();
    await Share.share({ title: '日本語 Daily backup', message: JSON.stringify({ app: 'nihongo-daily', exportedAt: new Date().toISOString(), data }) });
  };

  return (
    <ScrollView style={{ backgroundColor: p.bg }} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={[styles.preview, { backgroundColor: p.surface }]}>
        <T v="label" color="muted" style={{ marginBottom: 8 }}>
          Preview
        </T>
        <JaText line={SAMPLE} size={22} />
        {settings.translations ? (
          <T v="body" color="secondary" style={{ fontSize: 16, marginTop: 4 }}>
            I am a student.
          </T>
        ) : null}
      </View>

      <SectionHeading title="Reading" ja="読み方" />
      <Toggle label="Furigana" hint="Show readings above kanji" value={settings.furigana} onChange={(v) => setSetting('furigana', v)} />
      <Toggle label="Romaji" hint="Off by default, so you get used to reading Japanese scripts" value={settings.romaji} onChange={(v) => setSetting('romaji', v)} />
      <Toggle label="English translations" hint="When off, tap any example to reveal its translation" value={settings.translations} onChange={(v) => setSetting('translations', v)} />
      <View style={[styles.row, { borderTopColor: p.rule, flexDirection: 'column', alignItems: 'flex-start' }]}>
        <T v="ui">Japanese text size</T>
        <View style={styles.chips}>
          {[
            [0.9, 'Small'],
            [1, 'Standard'],
            [1.15, 'Large'],
            [1.3, 'Largest'],
          ].map(([v, l]) => (
            <Chip key={l} label={l as string} active={settings.textScale === v} onPress={() => setSetting('textScale', v as number)} />
          ))}
        </View>
      </View>
      <View style={[styles.row, { borderTopColor: p.rule, flexDirection: 'column', alignItems: 'flex-start' }]}>
        <T v="ui">Audio</T>
        <T v="meta" color="muted">
          Spoken Japanese arrives with the Audio Edition in a later update.
        </T>
      </View>

      <SectionHeading title="Appearance" ja="表示" />
      <View style={[styles.row, { borderTopColor: p.rule }]}>
        <View style={styles.chips}>
          <Chip label="Match phone" active={settings.theme === 'system'} onPress={() => setSetting('theme', 'system')} />
          <Chip label="Light" active={settings.theme === 'light'} onPress={() => setSetting('theme', 'light')} />
          <Chip label="Dark" active={settings.theme === 'dark'} onPress={() => setSetting('theme', 'dark')} />
        </View>
      </View>

      <SectionHeading title="Daily reminder" ja="お知らせ" />
      <View style={[styles.row, { borderTopColor: p.rule, flexDirection: 'column', alignItems: 'flex-start' }]}>
        <T v="meta" color="muted">
          One gentle note when the new edition is ready. No streaks, and nothing about days you missed.
        </T>
        <View style={styles.chips}>
          <Chip label="Off" active={!settings.notifyAt} onPress={() => setTime(null)} />
          {TIMES.map((t) => (
            <Chip key={t} label={t} active={settings.notifyAt === t} onPress={() => setTime(t)} />
          ))}
        </View>
        {notice ? (
          <T v="meta" style={{ color: p.bad, marginTop: 8 }}>
            {notice}
          </T>
        ) : null}
      </View>

      <SectionHeading title="Your course" ja="コース" />
      <Toggle
        label="Skip the kana lessons"
        hint="For readers who already know hiragana and katakana. The lessons stay available."
        value={settings.startingPoint === 'kana'}
        onChange={(v) => setSetting('startingPoint', v ? 'kana' : 'new')}
      />

      <SectionHeading title="Your data" ja="データ" />
      <Pressable onPress={exportData} accessibilityRole="button" style={[styles.row, { borderTopColor: p.rule }]}>
        <View style={{ flex: 1 }}>
          <T v="ui" style={{ color: p.brandInk }}>
            Export a backup
          </T>
          <T v="meta" color="muted">
            Reading history, bookmarks and quiz results, as a file you can keep. Everything is stored on this phone.
          </T>
        </View>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  preview: { marginHorizontal: GUTTER, padding: 14, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', marginHorizontal: GUTTER, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
});
