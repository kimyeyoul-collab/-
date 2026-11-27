import React, { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, shadow, space, type } from './src/theme';
import { StoreProvider, useStore } from './src/store';
import { HomeScreen } from './src/screens/HomeScreen';
import { SongDetailScreen } from './src/screens/SongDetailScreen';
import { RecordingScreen } from './src/screens/RecordingScreen';
import { ResultScreen } from './src/screens/ResultScreen';
import { CreatorUploadScreen } from './src/screens/CreatorUploadScreen';
import { Toast } from './src/components/Toast';
import { Logo, MicIcon } from './src/components/Icons';

export default function App() {
  return (
    <StoreProvider>
      <StatusBar style="light" />
      <Shell />
    </StoreProvider>
  );
}

function Shell() {
  const { route, navigate, toast, dismissToast } = useStore();
  const { width } = useWindowDimensions();
  const [toastKey, setToastKey] = useState(0);
  const wide = Platform.OS === 'web' && width > 620;

  // react-native-web keeps the browser's focus ring on inputs: hide it so the
  // search bar and form fields keep the dark design while focused.
  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    const doc = (globalThis as unknown as Record<string, any>).document;
    if (!doc || doc.getElementById('kcs-input-focus')) return;
    const style = doc.createElement('style');
    style.id = 'kcs-input-focus';
    style.textContent =
      'input:focus, textarea:focus, select:focus { outline: none !important; box-shadow: none !important; }';
    doc.head.appendChild(style);
  }, []);

  React.useEffect(() => {
    if (toast) setToastKey(current => current + 1);
  }, [toast]);

  const screen = useMemo(() => {
    switch (route.name) {
      case 'song':
        return <SongDetailScreen songId={route.songId} />;
      case 'recording':
        return <RecordingScreen songId={route.songId} />;
      case 'result':
        return <ResultScreen songId={route.songId} />;
      case 'creator':
        return <CreatorUploadScreen />;
      case 'home':
      default:
        return <HomeScreen />;
    }
  }, [route]);

  const showTabs = route.name === 'home' || route.name === 'creator';

  return (
    <View style={styles.page}>
      <LinearGradient
        colors={['#0B0F14', '#080B10', '#05070A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {wide ? (
        <>
          <View style={styles.ambientOne} />
          <View style={styles.ambientTwo} />
        </>
      ) : null}

      <View style={[styles.frame, wide && styles.frameWide]}>
        <View style={styles.flex}>{screen}</View>
        {showTabs ? (
          <TabBar
            active={route.name === 'creator' ? 'creator' : 'home'}
            onHome={() => navigate({ name: 'home' })}
            onCreator={() => navigate({ name: 'creator' })}
          />
        ) : null}
        <Toast
          message={toast?.message ?? null}
          tone={toast?.tone ?? 'ok'}
          toastKey={toastKey}
          onHide={dismissToast}
        />
      </View>
    </View>
  );
}

function TabBar({
  active,
  onHome,
  onCreator,
}: {
  active: 'home' | 'creator';
  onHome: () => void;
  onCreator: () => void;
}) {
  return (
    <View style={styles.tabBar}>
      <TabButton label="홈" active={active === 'home'} onPress={onHome} icon="home" />
      <TabButton label="크리에이터" active={active === 'creator'} onPress={onCreator} icon="creator" />
    </View>
  );
}

function TabButton({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon: 'home' | 'creator';
}) {
  const tint = active ? colors.coral : colors.textFaint;
  return (
    <Pressable onPress={onPress} style={styles.tabButton}>
      <View style={styles.tabIcon}>
        {icon === 'home' ? (
          <View style={{ width: 15, height: 15, justifyContent: 'flex-end', alignItems: 'center' }}>
            <View
              style={{
                width: 0,
                height: 0,
                borderLeftWidth: 8,
                borderRightWidth: 8,
                borderBottomWidth: 7,
                borderLeftColor: 'transparent',
                borderRightColor: 'transparent',
                borderBottomColor: tint,
                marginBottom: 1,
              }}
            />
            <View
              style={{
                width: 11,
                height: 7,
                borderWidth: 1.6,
                borderTopWidth: 0,
                borderColor: tint,
                borderBottomLeftRadius: 2,
                borderBottomRightRadius: 2,
              }}
            />
          </View>
        ) : (
          <MicIcon size={12} color={tint} />
        )}
      </View>
      <Text style={[styles.tabLabel, active && { color: colors.coral }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  flex: { flex: 1 },
  ambientOne: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: 420,
    backgroundColor: 'rgba(255,77,79,0.07)',
    top: '6%',
    left: '8%',
  },
  ambientTwo: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 360,
    backgroundColor: 'rgba(55,200,240,0.05)',
    bottom: '4%',
    right: '6%',
  },
  frame: {
    flex: 1,
    width: '100%',
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  frameWide: {
    maxWidth: 432,
    maxHeight: 900,
    marginVertical: 24,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...shadow.card,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 64,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: 'rgba(9,13,18,0.98)',
  },
  tabButton: { alignItems: 'center', justifyContent: 'center', gap: 3, flex: 1, height: '100%' },
  tabIcon: { height: 16, justifyContent: 'center' },
  tabLabel: { ...type.micro, color: colors.textFaint, fontSize: 10 },
});
