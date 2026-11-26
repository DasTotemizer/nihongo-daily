import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Cover } from '@/components/editorial/cover';
import { PageHeader } from '@/components/editorial/masthead';
import { StoryRow } from '@/components/editorial/stories';
import { Chip } from '@/components/ui/chip';
import { Icon } from '@/components/ui/icon';
import { T } from '@/components/ui/text';
import { monthLabel, shortDate, weekday } from '@/domain/dates';
import { useData, usePalette } from '@/state/app';
import { GUTTER, fonts } from '@/theme';

type View_ = 'editions' | 'articles' | 'topics';

export default function Archive() {
  const p = usePalette();
  const [view, setView] = useState<View_>('editions');
  const [category, setCategory] = useState<string | null>(null);
  const [status, setStatus] = useState<'all' | 'unread' | 'read'>('all');

  const { data } = useData(async ({ content, user }) => {
    const issues = await user.issues();
    const leads = await content.cards(issues.map((i) => i.leadArticleId).filter((x): x is string => !!x));
    const states = await user.readingStates();
    const published = await user.issuedArticleIds();
    const cards = (await content.cards([...published])).sort((a, b) => a.stage - b.stage || (a.sequence ?? 9999) - (b.sequence ?? 9999));
    const categories = await content.categories();
    const concepts = await content.concepts();
    return { issues, leads: new Map(leads.map((l) => [l.id, l])), states, cards, categories, concepts };
  });

  const months: { label: string; items: NonNullable<typeof data>['issues'] }[] = [];
  for (const i of data?.issues ?? []) {
    const label = monthLabel(i.issueDate);
    if (months.at(-1)?.label !== label) months.push({ label, items: [] });
    months.at(-1)!.items.push(i);
  }

  const filtered = (data?.cards ?? []).filter((c) => {
    if (category && c.categoryId !== category) return false;
    const st = data?.states.get(c.id)?.status;
    if (status === 'read' && st !== 'read') return false;
    if (status === 'unread' && st === 'read') return false;
    return true;
  });

  return (
    <ScrollView style={{ backgroundColor: p.bg }} contentContainerStyle={{ paddingBottom: 40 }} stickyHeaderIndices={[1]}>
      <PageHeader title="Archive" ja="アーカイブ" />
      <View style={[styles.tabs, { backgroundColor: p.bg, borderBottomColor: p.rule }]}>
        {(['editions', 'articles', 'topics'] as const).map((v) => (
          <Pressable key={v} onPress={() => setView(v)} accessibilityRole="tab" accessibilityState={{ selected: view === v }} style={[styles.tab, view === v && { borderBottomColor: p.brand }]}>
            <T v="ui" style={{ fontFamily: fonts.sansMedium, color: view === v ? p.text : p.textMuted }}>
              {v === 'editions' ? 'Editions' : v === 'articles' ? 'Articles' : 'Topics'}
            </T>
          </Pressable>
        ))}
      </View>

      {view === 'editions' &&
        months.map((m) => (
          <View key={m.label}>
            <T v="label" color="muted" style={{ paddingHorizontal: GUTTER, marginTop: 20, marginBottom: 6 }}>
              {m.label}
            </T>
            {m.items.map((issue, idx) => {
              const lead = issue.leadArticleId ? data?.leads.get(issue.leadArticleId) : undefined;
              const read = issue.articleIds.filter((id) => data?.states.get(id)?.status === 'read').length;
              return (
                <Pressable
                  key={issue.id}
                  onPress={() => router.push({ pathname: '/edition/[id]', params: { id: issue.id } })}
                  android_ripple={{ color: p.rule }}
                  accessibilityRole="link"
                  style={[styles.issue, { borderTopColor: idx === 0 ? p.ruleStrong : p.rule, borderTopWidth: idx === 0 ? 2 : StyleSheet.hairlineWidth }]}>
                  <View style={styles.issueDate}>
                    <T v="lead" style={{ fontSize: 26, lineHeight: 30 }}>
                      {Number(issue.issueDate.slice(8))}
                    </T>
                    <T v="meta" color="muted">
                      {weekday(issue.issueDate).slice(0, 3)}
                    </T>
                  </View>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <T v="meta" color="muted">
                      No. {issue.editionNumber} · {shortDate(issue.issueDate)}
                      {issue.isBackIssue ? ' · while you were away' : ''}
                    </T>
                    <T v="small" style={{ marginTop: 2 }} numberOfLines={2}>
                      {lead?.headline ?? issue.title}
                    </T>
                    <T v="meta" color={read === issue.articleIds.length ? 'muted' : 'secondary'} style={{ marginTop: 4 }}>
                      {issue.articleIds.length} articles · {read === issue.articleIds.length ? 'all read' : `${read} read`}
                    </T>
                  </View>
                  {lead ? <Cover imageId={lead.imageId} aspect={1} style={{ width: 64 }} accent={lead.accent} /> : null}
                </Pressable>
              );
            })}
          </View>
        ))}

      {view === 'articles' ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip label="All sections" active={!category} onPress={() => setCategory(null)} />
            {data?.categories
              .filter((c) => data.cards.some((a) => a.categoryId === c.id))
              .map((c) => <Chip key={c.id} label={c.name} active={category === c.id} onPress={() => setCategory(c.id)} />)}
          </ScrollView>
          <View style={[styles.chips, { paddingTop: 0 }]}>
            {(['all', 'unread', 'read'] as const).map((s) => (
              <Chip key={s} label={s === 'all' ? 'Everything' : s === 'unread' ? 'Not read yet' : 'Read'} active={status === s} onPress={() => setStatus(s)} />
            ))}
          </View>
          <T v="meta" color="muted" style={{ paddingHorizontal: GUTTER, marginBottom: 4 }}>
            {filtered.length} {filtered.length === 1 ? 'article' : 'articles'}
          </T>
          {filtered.map((c, i) => (
            <StoryRow key={c.id} card={c} state={data?.states.get(c.id)} first={i === 0} />
          ))}
        </>
      ) : null}

      {view === 'topics' &&
        [1, 2, 3, 4, 5]
          .filter((stage) => data?.concepts.some((c) => c.stage === stage))
          .map((stage) => (
            <View key={stage}>
              <T v="label" color="muted" style={{ paddingHorizontal: GUTTER, marginTop: 20, marginBottom: 6 }}>
                Stage {stage} · {data?.concepts.find((c) => c.stage === stage)?.taeKimSection}
              </T>
              {data?.concepts
                .filter((c) => c.stage === stage)
                .map((c, idx) => (
                  <Pressable
                    key={c.id}
                    onPress={() => router.push({ pathname: '/concept/[id]', params: { id: c.id } })}
                    accessibilityRole="link"
                    style={[styles.topic, { borderTopColor: idx === 0 ? p.ruleStrong : p.rule, borderTopWidth: idx === 0 ? 2 : StyleSheet.hairlineWidth }]}>
                    <View style={{ flex: 1 }}>
                      <T v="small">{c.name}</T>
                      <T v="meta" color="muted" numberOfLines={1}>
                        {c.description}
                      </T>
                    </View>
                    <Icon name="chevron-right" color={p.textMuted} />
                  </Pressable>
                ))}
            </View>
          ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', paddingHorizontal: GUTTER, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { paddingVertical: 12, marginRight: 22, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  issue: { flexDirection: 'row', alignItems: 'center', marginHorizontal: GUTTER, paddingVertical: 14 },
  issueDate: { width: 50, alignItems: 'flex-start' },
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: GUTTER, paddingVertical: 12, flexWrap: 'wrap' },
  topic: { flexDirection: 'row', alignItems: 'center', marginHorizontal: GUTTER, paddingVertical: 12 },
});
