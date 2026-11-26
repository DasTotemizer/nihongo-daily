import { NativeTabs } from 'expo-router/native-tabs';
import React from 'react';

import { usePalette } from '@/state/app';

export default function TabsLayout() {
  const p = usePalette();
  return (
    <NativeTabs
      backgroundColor={p.bg}
      indicatorColor={p.accentSoft}
      iconColor={{ default: p.textMuted, selected: p.brandInk }}
      labelStyle={{ default: { color: p.textMuted }, selected: { color: p.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="newspaper" sf="newspaper" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="discover">
        <NativeTabs.Trigger.Label>Discover</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="explore" sf="safari" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="saved">
        <NativeTabs.Trigger.Label>Saved</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="bookmarks" sf="bookmark" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="archive">
        <NativeTabs.Trigger.Label>Archive</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="inventory_2" sf="archivebox" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="search">
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="search" sf="magnifyingglass" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
