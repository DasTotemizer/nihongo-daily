import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { IMAGES } from '@/generated/images';
import { usePalette } from '@/state/app';

import { T } from '../ui/text';

/** Article artwork. Falls back to a typographic panel when an article has no image. */
export function Cover({ imageId, aspect = 16 / 10, style, fallbackText, accent }: {
  imageId: string | null | undefined;
  aspect?: number;
  style?: ViewStyle;
  fallbackText?: string;
  accent?: string;
}) {
  const p = usePalette();
  const src = imageId ? IMAGES[imageId] : undefined;
  if (!src) {
    return (
      <View style={[{ aspectRatio: aspect, backgroundColor: p.surface, justifyContent: 'flex-end', padding: 10 }, style]}>
        <View style={{ height: 4, width: 28, backgroundColor: accent ?? p.brand, marginBottom: 8 }} />
        {fallbackText ? (
          <T v="small" numberOfLines={2} color="secondary">
            {fallbackText}
          </T>
        ) : null}
      </View>
    );
  }
  return (
    <View style={[{ aspectRatio: aspect, backgroundColor: p.surface, overflow: 'hidden' }, style]}>
      <Image source={src} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} accessibilityIgnoresInvertColors />
    </View>
  );
}
